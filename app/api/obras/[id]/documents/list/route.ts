import { NextResponse } from "next/server";

import {
	hasDemoCapability,
	resolveRequestAccessContext,
} from "@/lib/demo-session";
import { ensureTablaDataType, normalizeFolderName, normalizeFolderPath } from "@/lib/tablas";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";

type RouteContext = { params: Promise<{ id: string }> };

type FileSystemItem = {
	id: string;
	name: string;
	type: "folder" | "file";
	children?: FileSystemItem[];
	childrenLoaded?: boolean;
	hasFiles?: boolean;
	fileCount?: number;
	size?: number;
	mimetype?: string;
	storagePath?: string;
	relativePath?: string;
	apsUrn?: string;
	ocrEnabled?: boolean;
	dataInputMethod?: DataInputMethod;
	ocrTablaId?: string;
	ocrTablaName?: string;
	ocrFolderName?: string;
	ocrTablaColumns?: OcrColumn[];
	ocrTablaRows?: unknown[];
	extractedData?: unknown[];
	ocrDocumentStatus?: string;
	ocrDocumentId?: string;
	ocrDocumentError?: string | null;
	ocrErrorCode?: string | null;
	ocrRowsExtracted?: number | null;
	ocrExtractionId?: string | null;
	ocrFileFingerprint?: string | null;
	ocrContentFingerprintNormalized?: string | null;
	ocrFingerprintStatus?: string | null;
	ocrFingerprintError?: Record<string, unknown> | null;
	uploadedAt?: string | null;
	uploadedByUserId?: string | null;
	uploadedByLabel?: string | null;
	generatedDocumentStatus?: string | null;
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
	documents: OcrDocumentStatus[];
	dataInputMethod: DataInputMethod;
};

type OcrDocumentStatus = {
	id: string;
	tabla_id: string;
	source_bucket: string;
	source_path: string;
	source_file_name: string;
	status: string;
	error_message: string | null;
	error_code?: string | null;
	rows_extracted: number | null;
	extraction_id?: string | null;
	file_fingerprint?: string | null;
	content_fingerprint_normalized?: string | null;
	fingerprint_status?: string | null;
	fingerprint_error?: Record<string, unknown> | null;
};

type UploaderUserLike = {
	id?: string | null;
	email?: string | null;
	user_metadata?: Record<string, unknown> | null;
};

const DOCUMENTS_BUCKET = "obra-documents";
const STORAGE_LIST_LIMIT = 1000;

function readNonEmptyString(value: unknown) {
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function getUserDisplayLabel(user: UploaderUserLike | null | undefined) {
	const metadata =
		user?.user_metadata && typeof user.user_metadata === "object"
			? user.user_metadata
			: {};
	return (
		readNonEmptyString(metadata.display_name) ??
		readNonEmptyString(metadata.full_name) ??
		readNonEmptyString(metadata.name) ??
		readNonEmptyString(user?.email) ??
		null
	);
}

async function loadUploaderLabels(
	userIds: string[],
	currentUser: UploaderUserLike | null | undefined,
) {
	const uniqueUserIds = Array.from(
		new Set(userIds.map(readNonEmptyString).filter((userId): userId is string => Boolean(userId))),
	);
	const labelsByUserId = new Map<string, string>();

	if (currentUser?.id) {
		const currentLabel = getUserDisplayLabel(currentUser) ?? "Vos";
		labelsByUserId.set(currentUser.id, currentLabel);
	}
	if (uniqueUserIds.length === 0) return labelsByUserId;

	const admin = createSupabaseAdminClient();
	const { data: profiles, error: profilesError } = await admin
		.from("profiles")
		.select("user_id, full_name")
		.in("user_id", uniqueUserIds);

	if (profilesError) {
		console.error("[documents:list] uploader profiles error:", profilesError);
	} else {
		for (const profile of profiles ?? []) {
			const userId = readNonEmptyString(profile.user_id);
			const fullName = readNonEmptyString(profile.full_name);
			if (userId && fullName) {
				labelsByUserId.set(userId, fullName);
			}
		}
	}

	const missingUserIds = uniqueUserIds.filter((userId) => !labelsByUserId.has(userId));
	const authLookups = await Promise.all(
		missingUserIds.map(async (userId) => {
			try {
				const { data, error } = await admin.auth.admin.getUserById(userId);
				if (error) {
					console.error("[documents:list] uploader auth user error:", { userId, error });
					return null;
				}
				return { userId, label: getUserDisplayLabel(data.user) };
			} catch (error) {
				console.error("[documents:list] uploader auth user lookup failed:", { userId, error });
				return null;
			}
		}),
	);

	for (const lookup of authLookups) {
		if (lookup?.label) {
			labelsByUserId.set(lookup.userId, lookup.label);
		}
	}

	return labelsByUserId;
}

function getUploaderLabel(
	userId: string | null | undefined,
	labelsByUserId: Map<string, string>,
) {
	if (!userId) return null;
	return labelsByUserId.get(userId) ?? "Usuario";
}

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
		const url = new URL(_request.url);
		const requestedPath = normalizeFolderPath(url.searchParams.get("path") ?? "");
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

		const isInRequestedFolder = (storagePath: string) => {
			if (!storagePath.startsWith(`${obraId}/`)) return false;
			const relativePath = storagePath.slice(`${obraId}/`.length);
			const segments = relativePath.split("/").filter(Boolean);
			segments.pop();
			return segments.join("/") === requestedPath;
		};
		const scopedStorageLikePrefix = requestedPath
			? `${obraId}/${requestedPath}/%`
			: `${obraId}/%`;
		const shouldLoadFileMetadata = requestedPath.length > 0;
		const skippedQuery = Promise.resolve({ data: null, error: null });

		// These reads are independent of each other — fetch them in one round
		// trip instead of sequentially.
		const [
			obraResult,
			deleteRowsResult,
			defaultFoldersResult,
			tablasResult,
			trackedUploadsResult,
			generatedDocumentsResult,
			apsModelsResult,
		] = await Promise.all([
			supabase
				.from("obras")
				.select("id")
				.eq("id", obraId)
				.eq("tenant_id", tenantId)
				.is("deleted_at", null)
				.maybeSingle(),
			supabase
				.from("obra_document_deletes")
				.select("storage_path, item_type")
				.eq("tenant_id", tenantId)
				.eq("obra_id", obraId)
				.is("restored_at", null),
			supabase
				.from("obra_default_folders")
				.select("name, path")
				.eq("tenant_id", tenantId)
				.order("position", { ascending: true }),
			supabase
				.from("obra_tablas")
				.select("id, name, settings, created_at")
				.eq("obra_id", obraId)
				.eq("source_type", "ocr")
				.order("created_at", { ascending: true }),
			shouldLoadFileMetadata
				? supabase
					.from("obra_document_uploads")
					.select("storage_path, uploaded_by, uploaded_at")
					.eq("obra_id", obraId)
					.like("storage_path", scopedStorageLikePrefix)
				: skippedQuery,
			shouldLoadFileMetadata
				? supabase
					.from("generated_documents")
					.select("storage_path, status, updated_at")
					.eq("obra_id", obraId)
					.like("storage_path", scopedStorageLikePrefix)
					.order("updated_at", { ascending: false })
				: skippedQuery,
			shouldLoadFileMetadata
				? supabase
					.from("aps_models")
					.select("file_path, aps_urn")
					.eq("obra_id", obraId)
					.like("file_path", scopedStorageLikePrefix)
				: skippedQuery,
		]);

		if (obraResult.error) throw obraResult.error;
		if (!obraResult.data) {
			return NextResponse.json({ error: "Obra no encontrada" }, { status: 404 });
		}

		const { data: deleteRows, error: deleteRowsError } = deleteRowsResult;
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
		const { data: defaultFolders, error: defaultFoldersError } = defaultFoldersResult;
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

		const { data: tablas, error: tablasError } = tablasResult;
		if (tablasError) throw tablasError;

		// Second phase: these two depend on the tabla ids resolved above.
		const tablaIds = (tablas ?? []).map((tabla) => tabla.id as string);
		const [columnsResult, ocrDocumentsResult] = await Promise.all([
			shouldLoadFileMetadata && tablaIds.length > 0
				? supabase
					.from("obra_tabla_columns")
					.select("id, tabla_id, field_key, label, data_type, position, required, config")
					.in("tabla_id", tablaIds)
					.order("position", { ascending: true })
				: skippedQuery,
			tablaIds.length > 0
				? supabase
					.from("ocr_document_processing")
					.select(
						"id, tabla_id, source_bucket, source_path, source_file_name, status, error_message, error_code, rows_extracted, extraction_id, file_fingerprint, content_fingerprint_normalized, fingerprint_status, fingerprint_error"
					)
					.eq("obra_id", obraId)
					.in("tabla_id", tablaIds)
					.like("source_path", scopedStorageLikePrefix)
					.order("created_at", { ascending: false })
				: skippedQuery,
		]);

		const columnsByTabla = new Map<string, OcrColumn[]>();
		if (shouldLoadFileMetadata && tablaIds.length > 0) {
			const { data: columns, error: columnsError } = columnsResult;
			if (columnsError) throw columnsError;
			for (const column of columns ?? []) {
				const mapped = mapColumn(column);
				if (!columnsByTabla.has(mapped.tablaId)) {
					columnsByTabla.set(mapped.tablaId, []);
				}
				columnsByTabla.get(mapped.tablaId)?.push(mapped);
			}
		}

		const documentsByTabla = new Map<string, OcrDocumentStatus[]>();
		const docsByPath = new Map<string, OcrDocumentStatus>();
		const knownDocumentPaths: string[] = [];
		if (tablaIds.length > 0) {
			const { data: documents, error: documentsError } = ocrDocumentsResult;
			if (documentsError) throw documentsError;
			for (const doc of documents ?? []) {
				const sourcePath = typeof doc.source_path === "string" ? doc.source_path : "";
				if (!sourcePath || isDeletedPath(sourcePath)) continue;
				knownDocumentPaths.push(sourcePath);
				if (!isInRequestedFolder(sourcePath)) continue;
				const tablaId = doc.tabla_id as string;
				const mapped = doc as OcrDocumentStatus;
				if (!documentsByTabla.has(tablaId)) documentsByTabla.set(tablaId, []);
				documentsByTabla.get(tablaId)?.push(mapped);
				if (!docsByPath.has(sourcePath)) {
					docsByPath.set(sourcePath, mapped);
				}
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
					documents: documentsByTabla.get(tabla.id as string) ?? [],
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
			childrenLoaded: false,
			hasFiles: false,
			fileCount: 0,
			storagePath: obraId,
		};
		const folderNodeByPath = new Map<string, FileSystemItem>([["", root]]);
		const fileNodeByPath = new Map<string, FileSystemItem>();
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
				childrenLoaded: false,
				hasFiles: false,
				fileCount: 0,
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

		const markFolderHasFile = (folderPath: string) => {
			const normalizedFolderPath = normalizeFolderPath(folderPath);
			if (!normalizedFolderPath && requestedPath) return;
			const folderNode = ensureFolderPath(normalizedFolderPath);
			folderNode.hasFiles = true;
		};

		const markKnownFilePath = (storagePath: string) => {
			if (!storagePath.startsWith(`${obraId}/`)) return;
			const relativePath = storagePath.slice(`${obraId}/`.length);
			const segments = relativePath.split("/").filter(Boolean);
			if (segments.length <= 1) return;
			const fileParentPath = segments.slice(0, -1).join("/");
			if (fileParentPath === requestedPath) return;
			if (requestedPath && !fileParentPath.startsWith(`${requestedPath}/`)) return;
			const remainder = requestedPath
				? fileParentPath.slice(requestedPath.length + 1)
				: fileParentPath;
			const nextSegment = remainder.split("/").filter(Boolean)[0];
			if (!nextSegment) return;
			markFolderHasFile(requestedPath ? `${requestedPath}/${nextSegment}` : nextSegment);
		};

		for (const storagePath of knownDocumentPaths) {
			markKnownFilePath(storagePath);
		}

		const addKnownFolderForCurrentLevel = (knownFolderPath: string) => {
			const folderPath = normalizeFolderPath(knownFolderPath);
			if (!folderPath || isDeletedPath(`${obraId}/${folderPath}`)) return;
			if (folderPath === requestedPath) {
				ensureFolderPath(folderPath);
				return;
			}
			if (requestedPath && !folderPath.startsWith(`${requestedPath}/`)) return;
			const remainder = requestedPath
				? folderPath.slice(requestedPath.length + 1)
				: folderPath;
			const nextSegment = remainder.split("/").filter(Boolean)[0];
			if (!nextSegment) return;
			ensureFolderPath(requestedPath ? `${requestedPath}/${nextSegment}` : nextSegment);
		};

		for (const folder of defaultFolders ?? []) {
			const folderPath = typeof folder.path === "string" ? normalizeFolderPath(folder.path) : "";
			addKnownFolderForCurrentLevel(folderPath);
		}

		for (const link of ocrLinks) {
			const folderPath = normalizeFolderPath(link.folderName);
			addKnownFolderForCurrentLevel(folderPath);
		}

		const uploadTrackingByPath = new Map<
			string,
			{ uploadedBy: string | null; uploadedAt: string | null }
		>();
		if (shouldLoadFileMetadata) {
			const { data: trackedUploads, error: trackedUploadsError } = trackedUploadsResult;
			if (trackedUploadsError) throw trackedUploadsError;
			for (const upload of trackedUploads ?? []) {
				const storagePath = typeof upload.storage_path === "string" ? upload.storage_path : null;
				if (!storagePath || isDeletedPath(storagePath)) continue;
				markKnownFilePath(storagePath);
				if (!isInRequestedFolder(storagePath)) continue;
				uploadTrackingByPath.set(storagePath, {
					uploadedBy: typeof upload.uploaded_by === "string" ? upload.uploaded_by : null,
					uploadedAt: typeof upload.uploaded_at === "string" ? upload.uploaded_at : null,
				});
			}
		}

		let uploaderLabelByUserId = new Map<string, string>();
		if (shouldLoadFileMetadata && uploadTrackingByPath.size > 0) {
			try {
				uploaderLabelByUserId = await loadUploaderLabels(
					Array.from(uploadTrackingByPath.values())
						.map((upload) => upload.uploadedBy)
						.filter((uploadedBy): uploadedBy is string => Boolean(uploadedBy)),
					user,
				);
			} catch (error) {
				console.error("[documents:list] uploader label lookup failed:", error);
			}
		}

		const generatedDocumentStatusByPath = new Map<string, string>();
		if (shouldLoadFileMetadata) {
			const { data: generatedDocuments, error: generatedDocumentsError } = generatedDocumentsResult;
			if (generatedDocumentsError) throw generatedDocumentsError;
			for (const generatedDocument of generatedDocuments ?? []) {
				const storagePath =
					typeof generatedDocument.storage_path === "string"
						? generatedDocument.storage_path
						: null;
				const status =
					typeof generatedDocument.status === "string"
						? generatedDocument.status
						: null;
				if (!storagePath || !status || !isInRequestedFolder(storagePath) || generatedDocumentStatusByPath.has(storagePath)) {
					if (storagePath && !isDeletedPath(storagePath)) {
						markKnownFilePath(storagePath);
					}
					continue;
				}
				markKnownFilePath(storagePath);
				generatedDocumentStatusByPath.set(storagePath, status);
			}
		}

		const apsUrnByPath = new Map<string, string>();
		if (shouldLoadFileMetadata) {
			const { data: apsModels, error: apsModelsError } = apsModelsResult;
			if (apsModelsError) throw apsModelsError;
			for (const model of apsModels ?? []) {
				const filePath = typeof model.file_path === "string" ? model.file_path : null;
				const apsUrn = typeof model.aps_urn === "string" ? model.aps_urn : null;
				if (!filePath || !apsUrn || isDeletedPath(filePath)) continue;
				markKnownFilePath(filePath);
				if (!isInRequestedFolder(filePath)) continue;
				apsUrnByPath.set(filePath, apsUrn);
			}
		}

		const buildFileNode = (
			storagePath: string,
			parentNode: FileSystemItem,
			options?: {
				fileName?: string | null;
				size?: number | null;
				mimetype?: string | null;
			},
		) => {
			const existing = fileNodeByPath.get(storagePath);
			if (existing) return existing;
			const docStatus = docsByPath.get(storagePath);
			const trackedUpload = uploadTrackingByPath.get(storagePath);
			const fileName =
				options?.fileName ??
				(typeof docStatus?.source_file_name === "string" ? docStatus.source_file_name : null) ??
				storagePath.split("/").pop() ??
				"archivo";
			const fileItem: FileSystemItem = {
				id: `file-${storagePath}`,
				name: fileName,
				type: "file",
				storagePath,
				apsUrn: apsUrnByPath.get(storagePath) ?? undefined,
				size: options?.size ?? undefined,
				mimetype: options?.mimetype ?? undefined,
				ocrDocumentStatus: docStatus
					? docStatus.status
					: parentNode.ocrEnabled
						? "unprocessed"
						: undefined,
				ocrDocumentId: docStatus?.id,
				ocrDocumentError: docStatus?.error_message ?? null,
				ocrErrorCode: typeof docStatus?.error_code === "string" ? docStatus.error_code : null,
				ocrRowsExtracted: docStatus?.rows_extracted ?? null,
				ocrExtractionId: docStatus?.extraction_id ?? null,
				ocrFileFingerprint: docStatus?.file_fingerprint ?? null,
				ocrContentFingerprintNormalized: docStatus?.content_fingerprint_normalized ?? null,
				ocrFingerprintStatus: docStatus?.fingerprint_status ?? null,
				ocrFingerprintError:
					docStatus && typeof docStatus.fingerprint_error === "object"
						? docStatus.fingerprint_error
						: null,
				uploadedAt: trackedUpload?.uploadedAt ?? null,
				uploadedByUserId: trackedUpload?.uploadedBy ?? null,
				uploadedByLabel: getUploaderLabel(
					trackedUpload?.uploadedBy,
					uploaderLabelByUserId,
				),
				generatedDocumentStatus: generatedDocumentStatusByPath.get(storagePath) ?? null,
			};
			parentNode.children?.push(fileItem);
			parentNode.hasFiles = true;
			parentNode.fileCount = (parentNode.fileCount ?? 0) + 1;
			fileNodeByPath.set(storagePath, fileItem);
			return fileItem;
		};

		const listFolderContents = async (currentRelative: string) => {
			const storagePrefix = currentRelative ? `${obraId}/${currentRelative}` : obraId;
			const parentNode = ensureFolderPath(currentRelative);
			parentNode.childrenLoaded = true;
			const { data: folderContents, error: folderError } = await supabase.storage
				.from(DOCUMENTS_BUCKET)
				.list(storagePrefix, {
					limit: STORAGE_LIST_LIMIT,
					sortBy: { column: "name", order: "asc" },
				});
			if (folderError) {
				warnings.push(`${storagePrefix}: ${folderError.message ?? "storage_list_failed"}`);
				return;
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
					continue;
				}

				const storagePath = currentRelative
					? `${obraId}/${currentRelative}/${item.name}`
					: `${obraId}/${item.name}`;
				if (isDeletedPath(storagePath)) continue;

				const fileNode = buildFileNode(storagePath, parentNode, {
					fileName: item.name,
					size: item.metadata?.size ?? undefined,
					mimetype: item.metadata?.mimetype ?? undefined,
				});
				if (!fileNode.uploadedAt) {
					const fallbackUploadedAt =
						typeof item.created_at === "string"
							? item.created_at
							: typeof item.updated_at === "string"
								? item.updated_at
								: typeof item.last_accessed_at === "string"
									? item.last_accessed_at
									: null;
					fileNode.uploadedAt = fallbackUploadedAt;
				}
			}
		};

		const fallbackPaths = new Set<string>([
			...docsByPath.keys(),
			...uploadTrackingByPath.keys(),
			...generatedDocumentStatusByPath.keys(),
			...apsUrnByPath.keys(),
		]);
		const buildFallbackFiles = () => {
			for (const storagePath of fallbackPaths) {
				if (!storagePath || !storagePath.startsWith(`${obraId}/`) || isDeletedPath(storagePath)) {
					continue;
				}
				if (fileNodeByPath.has(storagePath)) continue;
				const relativePath = storagePath.slice(`${obraId}/`.length);
				if (!relativePath) continue;
				const segments = relativePath.split("/").filter(Boolean);
				if (segments.length === 0) continue;
				const fileName = segments.pop() ?? relativePath;
				const folderPath = segments.join("/");
				if (folderPath !== requestedPath) continue;
				const parentNode = ensureFolderPath(folderPath);
				buildFileNode(storagePath, parentNode, { fileName });
			}
		};

		if (requestedPath) {
			buildFallbackFiles();
			if (fallbackPaths.size === 0) {
				await listFolderContents(requestedPath);
			} else {
				ensureFolderPath(requestedPath).childrenLoaded = true;
			}
		} else {
			root.childrenLoaded = true;
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
			folder: ensureFolderPath(requestedPath),
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
