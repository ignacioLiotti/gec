import { NextResponse } from "next/server";

import {
	hasDemoCapability,
	resolveRequestAccessContext,
} from "@/lib/demo-session";
import { normalizeFolderName, normalizeFolderPath } from "@/lib/tablas";

type RouteContext = { params: Promise<{ id: string }> };
type SupabaseClient = Awaited<ReturnType<typeof resolveRequestAccessContext>>["supabase"];

const DOCUMENTS_BUCKET = "obra-documents";
const STORAGE_LIST_LIMIT = 1000;
const REFERENCE_CHUNK_SIZE = 100;

function chunk<T>(items: T[], size: number) {
	const output: T[][] = [];
	for (let index = 0; index < items.length; index += size) {
		output.push(items.slice(index, index + size));
	}
	return output;
}

function isPathInsideObra(obraId: string, storagePath: string) {
	return storagePath === obraId || storagePath.startsWith(`${obraId}/`);
}

function getFileNameFromPath(path: string) {
	return path.split("/").filter(Boolean).pop() ?? path;
}

function replaceStoragePrefix(value: string | null, fromPrefix: string, toPrefix: string) {
	if (!value) return null;
	if (value === fromPrefix) return toPrefix;
	if (value.startsWith(`${fromPrefix}/`)) {
		return `${toPrefix}${value.slice(fromPrefix.length)}`;
	}
	return null;
}

async function listFolderFilesRecursively(supabase: SupabaseClient, folderPath: string) {
	const files: string[] = [];
	const foldersToScan = [folderPath];

	while (foldersToScan.length > 0) {
		const currentFolder = foldersToScan.shift();
		if (!currentFolder) continue;

		const { data, error } = await supabase.storage
			.from(DOCUMENTS_BUCKET)
			.list(currentFolder, {
				limit: STORAGE_LIST_LIMIT,
				sortBy: { column: "name", order: "asc" },
			});
		if (error) throw error;

		for (const entry of data ?? []) {
			if (entry.name === ".emptyFolderPlaceholder") continue;
			const fullPath = `${currentFolder}/${entry.name}`.replace(/\/{2,}/g, "/");
			if (!entry.metadata) {
				foldersToScan.push(fullPath.replace(/\/$/, ""));
				continue;
			}
			files.push(fullPath);
		}
	}

	return files;
}

async function storageObjectExists(supabase: SupabaseClient, storagePath: string) {
	const parentPath = storagePath.split("/").slice(0, -1).join("/");
	const name = getFileNameFromPath(storagePath);
	const { data, error } = await supabase.storage
		.from(DOCUMENTS_BUCKET)
		.list(parentPath, { limit: STORAGE_LIST_LIMIT, search: name });
	if (error) throw error;
	return (data ?? []).some((entry) => entry.name === name && Boolean(entry.metadata));
}

async function storageFolderHasEntries(supabase: SupabaseClient, folderPath: string) {
	const { data, error } = await supabase.storage
		.from(DOCUMENTS_BUCKET)
		.list(folderPath, { limit: 1 });
	if (error) throw error;
	return (data ?? []).length > 0;
}

async function ensureFolderMarker(supabase: SupabaseClient, folderPath: string) {
	const markerPath = `${folderPath}/.keep`.replace(/\/{2,}/g, "/");
	const exists = await storageObjectExists(supabase, markerPath);
	if (exists) return;

	const { error } = await supabase.storage
		.from(DOCUMENTS_BUCKET)
		.upload(markerPath, new Blob([""], { type: "text/plain" }), { upsert: false });
	if (error) {
		const message = String(error.message ?? "").toLowerCase();
		if (message.includes("already exists") || message.includes("duplicate")) return;
		throw error;
	}
}

async function loadObraTablaRows(supabase: SupabaseClient, obraId: string) {
	const { data, error } = await supabase
		.from("obra_tablas")
		.select("id, linked_folder_path, settings")
		.eq("obra_id", obraId);
	if (error) throw error;
	return data ?? [];
}

async function syncMovedReferences(
	supabase: SupabaseClient,
	params: {
		obraId: string;
		tenantId: string;
		oldStoragePrefix: string;
		nextStoragePrefix: string;
		oldRelativePath: string;
		nextRelativePath: string;
		movedPaths: Map<string, string>;
	},
) {
	const movedFromPaths = Array.from(params.movedPaths.keys());

	for (const pathChunk of chunk(movedFromPaths, REFERENCE_CHUNK_SIZE)) {
		const { data, error } = await supabase
			.from("obra_document_uploads")
			.select("id, storage_path")
			.eq("obra_id", params.obraId)
			.in("storage_path", pathChunk);
		if (error) throw error;

		for (const row of data ?? []) {
			const id = typeof row.id === "string" ? row.id : null;
			const currentPath = typeof row.storage_path === "string" ? row.storage_path : null;
			const nextPath = currentPath ? params.movedPaths.get(currentPath) : null;
			if (!id || !nextPath) continue;

			const { error: updateError } = await supabase
				.from("obra_document_uploads")
				.update({
					storage_path: nextPath,
					file_name: getFileNameFromPath(nextPath),
				})
				.eq("id", id);
			if (updateError) throw updateError;
		}
	}

	for (const pathChunk of chunk(movedFromPaths, REFERENCE_CHUNK_SIZE)) {
		const { data, error } = await supabase
			.from("ocr_document_processing")
			.select("id, source_path")
			.eq("obra_id", params.obraId)
			.in("source_path", pathChunk);
		if (error) throw error;

		for (const row of data ?? []) {
			const id = typeof row.id === "string" ? row.id : null;
			const currentPath = typeof row.source_path === "string" ? row.source_path : null;
			const nextPath = currentPath ? params.movedPaths.get(currentPath) : null;
			if (!id || !nextPath) continue;

			const { error: updateError } = await supabase
				.from("ocr_document_processing")
				.update({
					source_path: nextPath,
					source_file_name: getFileNameFromPath(nextPath),
				})
				.eq("id", id);
			if (updateError) throw updateError;
		}
	}

	for (const pathChunk of chunk(movedFromPaths, REFERENCE_CHUNK_SIZE)) {
		const { data, error } = await supabase
			.from("aps_models")
			.select("id, file_path")
			.eq("obra_id", params.obraId)
			.in("file_path", pathChunk);
		if (error) throw error;

		for (const row of data ?? []) {
			const id = typeof row.id === "string" ? row.id : null;
			const currentPath = typeof row.file_path === "string" ? row.file_path : null;
			const nextPath = currentPath ? params.movedPaths.get(currentPath) : null;
			if (!id || !nextPath) continue;

			const { error: updateError } = await supabase
				.from("aps_models")
				.update({ file_path: nextPath })
				.eq("id", id);
			if (updateError) throw updateError;
		}
	}

	for (const pathChunk of chunk(movedFromPaths, REFERENCE_CHUNK_SIZE)) {
		const { data, error } = await supabase
			.from("generated_documents")
			.select("id, storage_path, folder_path")
			.eq("obra_id", params.obraId)
			.in("storage_path", pathChunk);
		if (error) throw error;

		for (const row of data ?? []) {
			const id = typeof row.id === "string" ? row.id : null;
			const currentPath = typeof row.storage_path === "string" ? row.storage_path : null;
			const nextPath = currentPath ? params.movedPaths.get(currentPath) : null;
			if (!id || !nextPath) continue;

			const currentFolderPath =
				typeof row.folder_path === "string" ? normalizeFolderPath(row.folder_path) : "";
			const nextFolderPath =
				replaceStoragePrefix(
					currentFolderPath,
					params.oldRelativePath,
					params.nextRelativePath,
				) ?? currentFolderPath;

			const { error: updateError } = await supabase
				.from("generated_documents")
				.update({
					storage_path: nextPath,
					folder_path: nextFolderPath,
					file_name: getFileNameFromPath(nextPath),
				})
				.eq("id", id);
			if (updateError) throw updateError;
		}
	}

	const { data: deleteRows, error: deleteRowsError } = await supabase
		.from("obra_document_deletes")
		.select("id, storage_path, root_folder_path")
		.eq("tenant_id", params.tenantId)
		.eq("obra_id", params.obraId);
	if (deleteRowsError) throw deleteRowsError;

	for (const row of deleteRows ?? []) {
		const id = typeof row.id === "string" ? row.id : null;
		if (!id) continue;

		const storagePath = typeof row.storage_path === "string" ? row.storage_path : null;
		const rootFolderPath =
			typeof row.root_folder_path === "string" ? row.root_folder_path : null;
		const nextStoragePath = storagePath
			? params.movedPaths.get(storagePath) ??
				replaceStoragePrefix(storagePath, params.oldStoragePrefix, params.nextStoragePrefix)
			: null;
		const nextRootFolderPath = replaceStoragePrefix(
			rootFolderPath,
			params.oldStoragePrefix,
			params.nextStoragePrefix,
		);

		if (!nextStoragePath && !nextRootFolderPath) continue;

		const { error: updateError } = await supabase
			.from("obra_document_deletes")
			.update({
				...(nextStoragePath ? { storage_path: nextStoragePath } : {}),
				...(nextRootFolderPath ? { root_folder_path: nextRootFolderPath } : {}),
			})
			.eq("id", id);
		if (updateError) throw updateError;
	}

	const tablas = await loadObraTablaRows(supabase, params.obraId);
	for (const tabla of tablas) {
		const id = typeof tabla.id === "string" ? tabla.id : null;
		if (!id) continue;

		const settings =
			tabla.settings && typeof tabla.settings === "object"
				? (tabla.settings as Record<string, unknown>)
				: {};
		const currentOcrFolder =
			typeof settings.ocrFolder === "string" ? normalizeFolderPath(settings.ocrFolder) : "";
		const nextOcrFolder = replaceStoragePrefix(
			currentOcrFolder,
			params.oldRelativePath,
			params.nextRelativePath,
		);
		const currentLinkedFolder =
			typeof tabla.linked_folder_path === "string"
				? normalizeFolderPath(tabla.linked_folder_path)
				: "";
		const nextLinkedFolder = replaceStoragePrefix(
			currentLinkedFolder,
			params.oldRelativePath,
			params.nextRelativePath,
		);

		if (!nextOcrFolder && !nextLinkedFolder) continue;

		const { error: updateError } = await supabase
			.from("obra_tablas")
			.update({
				...(nextOcrFolder ? { settings: { ...settings, ocrFolder: nextOcrFolder } } : {}),
				...(nextLinkedFolder ? { linked_folder_path: nextLinkedFolder } : {}),
			})
			.eq("id", id);
		if (updateError) throw updateError;
	}

	const tablaIds = tablas
		.map((tabla) => (typeof tabla.id === "string" ? tabla.id : null))
		.filter((id): id is string => Boolean(id));

	for (const tablaChunk of chunk(tablaIds, 50)) {
		let from = 0;
		while (true) {
			const to = from + STORAGE_LIST_LIMIT - 1;
			const { data, error } = await supabase
				.from("obra_tabla_rows")
				.select("id, data")
				.in("tabla_id", tablaChunk)
				.order("id", { ascending: true })
				.range(from, to);
			if (error) throw error;
			if (!data || data.length === 0) break;

			const updates: Array<{ id: string; data: Record<string, unknown> }> = [];
			for (const row of data) {
				const id = typeof row.id === "string" ? row.id : null;
				const rowData =
					row.data && typeof row.data === "object"
						? (row.data as Record<string, unknown>)
						: null;
				const currentDocPath =
					rowData && typeof rowData.__docPath === "string" ? rowData.__docPath : null;
				const nextDocPath = currentDocPath ? params.movedPaths.get(currentDocPath) : null;
				if (!id || !rowData || !nextDocPath) continue;
				updates.push({ id, data: { ...rowData, __docPath: nextDocPath } });
			}

			for (const updateChunk of chunk(updates, REFERENCE_CHUNK_SIZE)) {
				const { error: updateRowsError } = await supabase
					.from("obra_tabla_rows")
					.upsert(updateChunk, { onConflict: "id" });
				if (updateRowsError) throw updateRowsError;
			}

			if (data.length < STORAGE_LIST_LIMIT) break;
			from += STORAGE_LIST_LIMIT;
		}
	}
}

export async function POST(request: Request, context: RouteContext) {
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

		const { data: obraRow, error: obraError } = await supabase
			.from("obras")
			.select("id")
			.eq("id", obraId)
			.eq("tenant_id", tenantId)
			.is("deleted_at", null)
			.maybeSingle();
		if (obraError) throw obraError;
		if (!obraRow) {
			return NextResponse.json({ error: "Obra no encontrada" }, { status: 404 });
		}

		const body = (await request.json().catch(() => null)) as {
			sourceFolderPath?: unknown;
			targetParentFolderPath?: unknown;
		} | null;
		const sourceRelativePath = normalizeFolderPath(
			typeof body?.sourceFolderPath === "string" ? body.sourceFolderPath : "",
		);
		const targetParentRelativePath = normalizeFolderPath(
			typeof body?.targetParentFolderPath === "string"
				? body.targetParentFolderPath
				: "",
		);

		if (!sourceRelativePath) {
			return NextResponse.json({ error: "Falta la carpeta origen" }, { status: 400 });
		}

		const folderName = normalizeFolderName(getFileNameFromPath(sourceRelativePath));
		if (!folderName) {
			return NextResponse.json({ error: "Carpeta origen invalida" }, { status: 400 });
		}

		const nextRelativePath = targetParentRelativePath
			? `${targetParentRelativePath}/${folderName}`
			: folderName;
		if (nextRelativePath === sourceRelativePath) {
			return NextResponse.json({
				ok: true,
				movedFiles: 0,
				sourceFolderPath: sourceRelativePath,
				targetFolderPath: nextRelativePath,
			});
		}
		if (targetParentRelativePath === sourceRelativePath || targetParentRelativePath.startsWith(`${sourceRelativePath}/`)) {
			return NextResponse.json(
				{ error: "No se puede mover una carpeta dentro de si misma." },
				{ status: 400 },
			);
		}

		const oldStoragePrefix = `${obraId}/${sourceRelativePath}`;
		const nextStoragePrefix = `${obraId}/${nextRelativePath}`;
		if (!isPathInsideObra(obraId, oldStoragePrefix) || !isPathInsideObra(obraId, nextStoragePrefix)) {
			return NextResponse.json({ error: "Ruta fuera de la obra" }, { status: 400 });
		}

		const sourceFiles = await listFolderFilesRecursively(supabase, oldStoragePrefix);
		if (sourceFiles.length === 0) {
			return NextResponse.json(
				{ error: "La carpeta origen no existe o esta vacia en Storage." },
				{ status: 404 },
			);
		}

		if (await storageFolderHasEntries(supabase, nextStoragePrefix)) {
			return NextResponse.json(
				{ error: "Ya existe una carpeta destino con ese nombre." },
				{ status: 409 },
			);
		}

		const plannedMoves = sourceFiles.map((fromPath) => {
			const suffix = fromPath.slice(oldStoragePrefix.length);
			return { fromPath, toPath: `${nextStoragePrefix}${suffix}` };
		});

		for (const move of plannedMoves) {
			if (await storageObjectExists(supabase, move.toPath)) {
				return NextResponse.json(
					{ error: `Ya existe un archivo destino: ${move.toPath}` },
					{ status: 409 },
				);
			}
		}

		const movedPaths = new Map<string, string>();
		for (const move of plannedMoves) {
			const { error } = await supabase.storage
				.from(DOCUMENTS_BUCKET)
				.move(move.fromPath, move.toPath);
			if (error) {
				if (movedPaths.size > 0) {
					await syncMovedReferences(supabase, {
						obraId,
						tenantId,
						oldStoragePrefix,
						nextStoragePrefix,
						oldRelativePath: sourceRelativePath,
						nextRelativePath,
						movedPaths,
					});
				}
				throw error;
			}
			movedPaths.set(move.fromPath, move.toPath);
		}

		const sourceParentRelativePath = sourceRelativePath.split("/").slice(0, -1).join("/");
		if (sourceParentRelativePath) {
			await ensureFolderMarker(supabase, `${obraId}/${sourceParentRelativePath}`);
		}

		await syncMovedReferences(supabase, {
			obraId,
			tenantId,
			oldStoragePrefix,
			nextStoragePrefix,
			oldRelativePath: sourceRelativePath,
			nextRelativePath,
			movedPaths,
		});

		return NextResponse.json({
			ok: true,
			movedFiles: movedPaths.size,
			sourceFolderPath: sourceRelativePath,
			targetFolderPath: nextRelativePath,
		});
	} catch (error) {
		console.error("[documents:move]", error);
		const message = error instanceof Error ? error.message : "Error desconocido";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
