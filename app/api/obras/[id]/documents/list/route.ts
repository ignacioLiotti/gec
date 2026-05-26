import { NextResponse } from "next/server";

import {
	hasDemoCapability,
	resolveRequestAccessContext,
} from "@/lib/demo-session";
import { ensureTablaDataType, normalizeFolderName, normalizeFolderPath } from "@/lib/tablas";

type RouteContext = { params: Promise<{ id: string }> };

type FileSystemItem = {
	id: string;
	name: string;
	type: "folder" | "file";
	children?: FileSystemItem[];
	size?: number;
	mimetype?: string;
	storagePath?: string;
	relativePath?: string;
	ocrEnabled?: boolean;
	dataInputMethod?: DataInputMethod;
	ocrTablaId?: string;
	ocrTablaName?: string;
	ocrFolderName?: string;
	ocrTablaColumns?: OcrColumn[];
	ocrTablaRows?: unknown[];
	extractedData?: unknown[];
};

type DataInputMethod = "ocr" | "manual" | "both";

type OcrColumn = {
	id: string;
	tablaId: string;
	fieldKey: string;
	label: string;
	dataType: string;
	required: boolean;
	position?: number;
	config?: Record<string, unknown>;
};

type OcrLink = {
	tablaId: string;
	tablaName: string;
	folderName: string;
	folderLabel: string | null;
	columns: OcrColumn[];
	rows: unknown[];
	orders: unknown[];
	documents: unknown[];
	dataInputMethod: DataInputMethod;
};

const DOCUMENTS_BUCKET = "obra-documents";
const STORAGE_LIST_LIMIT = 1000;

function humanizeFolderSegment(segment: string): string {
	if (!segment) return segment;
	return segment
		.replace(/[-_]+/g, " ")
		.split(" ")
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ");
}

function normalizeDataInputMethod(value: unknown): DataInputMethod {
	if (value === "ocr" || value === "manual" || value === "both") return value;
	return "both";
}

function mapColumn(record: {
	id: string;
	tabla_id: string;
	field_key: string;
	label: string;
	data_type?: string | null;
	position?: number | null;
	required?: boolean | null;
	config?: Record<string, unknown> | null;
}): OcrColumn {
	return {
		id: record.id,
		tablaId: record.tabla_id,
		fieldKey: record.field_key,
		label: record.label,
		dataType: ensureTablaDataType(record.data_type ?? undefined),
		required: Boolean(record.required),
		position: record.position ?? 0,
		config: record.config ?? {},
	};
}

function getFolderLookupKeys(folderName: string, obraId: string) {
	const keys = new Set<string>();
	const normalizedPath = normalizeFolderPath(folderName);
	if (normalizedPath) {
		keys.add(normalizedPath);
		if (normalizedPath === obraId) {
			keys.add("");
		} else if (normalizedPath.startsWith(`${obraId}/`)) {
			keys.add(normalizedPath.slice(obraId.length + 1));
		}
	}
	const normalizedFlat = normalizeFolderName(folderName);
	if (normalizedFlat) {
		keys.add(normalizedFlat);
	}
	for (const key of Array.from(keys)) {
		const flat = normalizeFolderName(key);
		if (flat) keys.add(flat);
	}
	return Array.from(keys).filter(Boolean);
}

export async function GET(_request: Request, context: RouteContext) {
	const { id: obraId } = await context.params;
	if (!obraId) {
		return NextResponse.json({ error: "Obra no encontrada" }, { status: 400 });
	}

	try {
		const access = await resolveRequestAccessContext();
		const { supabase, user, tenantId, actorType } = access;

		if (!user && actorType !== "demo") {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}
		if (actorType === "demo" && !hasDemoCapability(access.demoSession, "excel")) {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}
		if (!tenantId) {
			return NextResponse.json({ error: "No tenant" }, { status: 400 });
		}

		const { data: obra, error: obraError } = await supabase
			.from("obras")
			.select("id")
			.eq("id", obraId)
			.eq("tenant_id", tenantId)
			.is("deleted_at", null)
			.maybeSingle();
		if (obraError) throw obraError;
		if (!obra) {
			return NextResponse.json({ error: "Obra no encontrada" }, { status: 404 });
		}

		const { data: deleteRows, error: deleteRowsError } = await supabase
			.from("obra_document_deletes")
			.select("storage_path, item_type")
			.eq("tenant_id", tenantId)
			.eq("obra_id", obraId)
			.is("restored_at", null);
		if (deleteRowsError) throw deleteRowsError;

		const deletedFilePaths = new Set<string>();
		const deletedFolderPaths: string[] = [];
		for (const row of deleteRows ?? []) {
			const storagePath = typeof row.storage_path === "string" ? row.storage_path.trim() : "";
			if (!storagePath) continue;
			if (row.item_type === "folder") {
				deletedFolderPaths.push(storagePath);
			} else {
				deletedFilePaths.add(storagePath);
			}
		}

		const isDeletedPath = (storagePath: string) => {
			if (!storagePath) return false;
			if (deletedFilePaths.has(storagePath)) return true;
			const legacyNormalizedStoragePath = normalizeFolderPath(storagePath);
			if (legacyNormalizedStoragePath && deletedFilePaths.has(legacyNormalizedStoragePath)) {
				return true;
			}
			return deletedFolderPaths.some(
				(folderPath) =>
					storagePath === folderPath ||
					storagePath.startsWith(`${folderPath}/`) ||
					legacyNormalizedStoragePath === folderPath ||
					legacyNormalizedStoragePath.startsWith(`${folderPath}/`),
			);
		};

		const { data: defaultFolders, error: defaultFoldersError } = await supabase
			.from("obra_default_folders")
			.select("name, path")
			.eq("tenant_id", tenantId)
			.order("position", { ascending: true });
		if (defaultFoldersError) throw defaultFoldersError;

		const displayNameByPath = new Map<string, string>();
		for (const folder of defaultFolders ?? []) {
			const folderPath = typeof folder.path === "string" ? normalizeFolderPath(folder.path) : "";
			const folderName =
				typeof folder.name === "string" && folder.name.trim().length > 0
					? folder.name.trim()
					: "";
			if (folderPath && folderName) {
				displayNameByPath.set(folderPath, folderName);
			}
		}

		const { data: tablas, error: tablasError } = await supabase
			.from("obra_tablas")
			.select("id, name, settings, created_at")
			.eq("obra_id", obraId)
			.eq("source_type", "ocr")
			.order("created_at", { ascending: true });
		if (tablasError) throw tablasError;

		const tablaIds = (tablas ?? []).map((tabla) => tabla.id as string);
		const columnsByTabla = new Map<string, OcrColumn[]>();
		if (tablaIds.length > 0) {
			const { data: columns, error: columnsError } = await supabase
				.from("obra_tabla_columns")
				.select("id, tabla_id, field_key, label, data_type, position, required, config")
				.in("tabla_id", tablaIds)
				.order("position", { ascending: true });
			if (columnsError) throw columnsError;
			for (const column of columns ?? []) {
				const mapped = mapColumn(column);
				if (!columnsByTabla.has(mapped.tablaId)) {
					columnsByTabla.set(mapped.tablaId, []);
				}
				columnsByTabla.get(mapped.tablaId)?.push(mapped);
			}
		}

		const ocrLinks: OcrLink[] = (tablas ?? []).flatMap((tabla) => {
				const settings = (tabla.settings as Record<string, unknown>) ?? {};
				const folderName = typeof settings.ocrFolder === "string" ? settings.ocrFolder : "";
				if (!folderName) return [];
				const folderLabel =
					typeof settings.ocrFolderLabel === "string" && settings.ocrFolderLabel.trim().length > 0
						? settings.ocrFolderLabel.trim()
						: null;
				const link: OcrLink = {
					tablaId: tabla.id as string,
					tablaName: tabla.name as string,
					folderName,
					folderLabel,
					columns: columnsByTabla.get(tabla.id as string) ?? [],
					rows: [],
					orders: [],
					documents: [],
					dataInputMethod: normalizeDataInputMethod(settings.dataInputMethod),
				};
				return [link];
			});

		const ocrFolderMap = new Map<string, OcrLink>();
		for (const link of ocrLinks) {
			for (const key of getFolderLookupKeys(link.folderName, obraId)) {
				ocrFolderMap.set(key, link);
			}
			const label = typeof link.folderLabel === "string" ? link.folderLabel.trim() : "";
			for (const key of getFolderLookupKeys(label, obraId)) {
				ocrFolderMap.set(key, link);
			}
			const normalizedPath = normalizeFolderPath(link.folderName);
			if (normalizedPath && label) {
				displayNameByPath.set(normalizedPath, label);
			}
		}

		const root: FileSystemItem = {
			id: "root",
			name: "Documentos",
			type: "folder",
			children: [],
			storagePath: obraId,
		};
		const folderNodeByPath = new Map<string, FileSystemItem>([["", root]]);
		const warnings: string[] = [];

		const buildFolderNode = (relativeFolderPath: string): FileSystemItem => {
			const normalizedRelative = normalizeFolderPath(relativeFolderPath);
			const linkedTabla =
				getFolderLookupKeys(normalizedRelative, obraId)
					.map((key) => ocrFolderMap.get(key))
					.find(Boolean) ||
				getFolderLookupKeys(relativeFolderPath, obraId)
					.map((key) => ocrFolderMap.get(key))
					.find(Boolean);
			const fallbackSegmentName = normalizedRelative.split("/").pop() ?? normalizedRelative;
			return {
				id: `folder-${normalizedRelative || "root"}`,
				name: displayNameByPath.get(normalizedRelative) ?? humanizeFolderSegment(fallbackSegmentName),
				type: "folder",
				children: [],
				storagePath: normalizedRelative ? `${obraId}/${normalizedRelative}` : obraId,
				relativePath: normalizedRelative,
				ocrEnabled: Boolean(linkedTabla),
				ocrTablaId: linkedTabla?.tablaId,
				ocrTablaName: linkedTabla?.tablaName,
				ocrFolderName: linkedTabla?.folderName ?? normalizedRelative,
				ocrTablaColumns: linkedTabla?.columns,
				ocrTablaRows: [],
				extractedData: [],
				dataInputMethod: linkedTabla?.dataInputMethod,
			};
		};

		const ensureFolderPath = (relativeFolderPath: string): FileSystemItem => {
			const normalizedRelative = normalizeFolderPath(relativeFolderPath);
			if (!normalizedRelative) return root;
			const existing = folderNodeByPath.get(normalizedRelative);
			if (existing) return existing;

			const segments = normalizedRelative.split("/");
			const ownName = segments.pop() ?? normalizedRelative;
			const parentPath = segments.join("/");
			const parentNode = ensureFolderPath(parentPath);
			const folderNode = buildFolderNode(normalizedRelative);
			folderNode.name = displayNameByPath.get(normalizedRelative) ?? humanizeFolderSegment(ownName);
			parentNode.children?.push(folderNode);
			folderNodeByPath.set(normalizedRelative, folderNode);
			return folderNode;
		};

		for (const folder of defaultFolders ?? []) {
			const folderPath = typeof folder.path === "string" ? normalizeFolderPath(folder.path) : "";
			if (!folderPath || isDeletedPath(`${obraId}/${folderPath}`)) continue;
			ensureFolderPath(folderPath);
		}

		for (const link of ocrLinks) {
			const folderPath = normalizeFolderPath(link.folderName);
			if (!folderPath || isDeletedPath(`${obraId}/${folderPath}`)) continue;
			ensureFolderPath(folderPath);
		}

		const queue: string[] = [""];
		const seen = new Set<string>([""]);
		while (queue.length > 0) {
			const currentRelative = queue.shift() ?? "";
			const storagePrefix = currentRelative ? `${obraId}/${currentRelative}` : obraId;
			const parentNode = ensureFolderPath(currentRelative);
			const { data: folderContents, error: folderError } = await supabase.storage
				.from(DOCUMENTS_BUCKET)
				.list(storagePrefix, {
					limit: STORAGE_LIST_LIMIT,
					sortBy: { column: "name", order: "asc" },
				});
			if (folderError) {
				warnings.push(`${storagePrefix}: ${folderError.message ?? "storage_list_failed"}`);
				continue;
			}

			for (const item of folderContents ?? []) {
				if (item.name === ".emptyFolderPlaceholder" || item.name === ".keep") continue;
				const isFolder = !item.metadata;
				if (isFolder) {
					const childRelative = currentRelative
						? `${currentRelative}/${item.name.replace(/\/$/, "")}`
						: item.name.replace(/\/$/, "");
					const normalizedChild = normalizeFolderPath(childRelative);
					const childStoragePath = normalizedChild ? `${obraId}/${normalizedChild}` : obraId;
					if (isDeletedPath(childStoragePath)) continue;
					ensureFolderPath(normalizedChild);
					if (!seen.has(normalizedChild)) {
						seen.add(normalizedChild);
						queue.push(normalizedChild);
					}
					continue;
				}

				const storagePath = currentRelative
					? `${obraId}/${currentRelative}/${item.name}`
					: `${obraId}/${item.name}`;
				if (isDeletedPath(storagePath)) continue;

				parentNode.children?.push({
					id: `file-${storagePath}`,
					name: item.name,
					type: "file",
					storagePath,
					size: item.metadata?.size ?? undefined,
					mimetype: item.metadata?.mimetype ?? undefined,
				});
			}
		}

		const sortTree = (node: FileSystemItem) => {
			node.children?.sort((a, b) => {
				if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
				return a.name.localeCompare(b.name, "es", { sensitivity: "base" });
			});
			node.children?.forEach(sortTree);
		};
		sortTree(root);

		return NextResponse.json({
			tree: root,
			links: ocrLinks,
			warnings,
		});
	} catch (error) {
		console.error("[documents-list:get]", error);
		return NextResponse.json(
			{ error: "No se pudieron cargar los documentos" },
			{ status: 500 },
		);
	}
}
