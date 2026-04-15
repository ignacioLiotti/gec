import {
	normalizeFieldKey,
	ensureTablaDataType,
	remapTablaRowDataToSchema,
} from "@/lib/tablas";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ApplyDefaultFolderParams = {
	tenantId: string;
	folderId: string;
	forceSync?: boolean;
	previousPath?: string;
};

type DefaultFolderBundle = {
	folderId: string;
	name: string;
	path: string;
	isOcr: boolean;
	defaultTablaId?: string;
	tablaName?: string;
	tablaDescription?: string | null;
	settings?: Record<string, unknown>;
	ocrTemplateId?: string | null;
	hasNestedData?: boolean;
	columns?: Array<{
		id?: string;
		label: string;
		fieldKey?: string;
		dataType?: string;
		required?: boolean;
		ocrScope?: string;
		description?: string | null;
		position?: number;
	}>;
};

type SpreadsheetPreset = {
	key: string;
	name: string;
	description: string;
	columns: Array<{
		field_key: string;
		label: string;
		data_type: "text" | "number" | "currency";
		position: number;
		required: boolean;
		config?: Record<string, unknown>;
	}>;
};

const CERTIFICADO_SPREADSHEET_PRESETS: SpreadsheetPreset[] = [
	{
		key: "pmc_resumen",
		name: "PMC Resumen",
		description:
			"Resumen mensual del certificado: período, monto, avance acumulado.",
		columns: [
			{
				field_key: "periodo",
				label: "Período",
				data_type: "text",
				position: 0,
				required: false,
				config: { excelKeywords: ["periodo", "mes", "month", "correspondiente"] },
			},
			{
				field_key: "nro_certificado",
				label: "N° Certificado",
				data_type: "text",
				position: 1,
				required: false,
				config: { excelKeywords: ["nro", "numero", "certificado", "cert", "n°"] },
			},
			{
				field_key: "fecha_certificacion",
				label: "Fecha Certificación",
				data_type: "text",
				position: 2,
				required: false,
				config: { excelKeywords: ["fecha", "certificacion", "date"] },
			},
			{
				field_key: "monto_certificado",
				label: "Monto Certificado",
				data_type: "currency",
				position: 3,
				required: false,
				config: { excelKeywords: ["monto", "importe", "certificado"] },
			},
			{
				field_key: "avance_fisico_acumulado_pct",
				label: "Avance Físico Acum. %",
				data_type: "number",
				position: 4,
				required: false,
				config: { excelKeywords: ["avance", "fisico", "acumulado", "%"] },
			},
			{
				field_key: "monto_acumulado",
				label: "Monto Acumulado",
				data_type: "currency",
				position: 5,
				required: false,
				config: { excelKeywords: ["monto", "acumulado", "total"] },
			},
			{
				field_key: "n_expediente",
				label: "N° Expediente",
				data_type: "text",
				position: 6,
				required: false,
				config: { excelKeywords: ["expediente", "exp", "nro", "numero", "n°"] },
			},
		],
	},
	{
		key: "pmc_items",
		name: "PMC Items",
		description:
			"Desglose por rubro/item del certificado con avances e importes.",
		columns: [
			{
				field_key: "item_code",
				label: "Código Item",
				data_type: "text",
				position: 0,
				required: false,
				config: { excelKeywords: ["item", "codigo", "cod", "rubro"] },
			},
			{
				field_key: "descripcion",
				label: "Descripción",
				data_type: "text",
				position: 1,
				required: false,
				config: { excelKeywords: ["descripcion", "rubro", "concepto", "detalle"] },
			},
			{
				field_key: "incidencia_pct",
				label: "Incidencia %",
				data_type: "number",
				position: 2,
				required: false,
				config: { excelKeywords: ["incidencia", "%"] },
			},
			{
				field_key: "monto_rubro",
				label: "Monto Rubro",
				data_type: "currency",
				position: 3,
				required: false,
				config: { excelKeywords: ["total", "rubro", "monto"] },
			},
			{
				field_key: "avance_anterior_pct",
				label: "Avance Anterior %",
				data_type: "number",
				position: 4,
				required: false,
				config: { excelKeywords: ["anterior", "avance", "%"] },
			},
			{
				field_key: "avance_periodo_pct",
				label: "Avance Período %",
				data_type: "number",
				position: 5,
				required: false,
				config: { excelKeywords: ["presente", "periodo", "avance", "%"] },
			},
			{
				field_key: "avance_acumulado_pct",
				label: "Avance Acumulado %",
				data_type: "number",
				position: 6,
				required: false,
				config: { excelKeywords: ["acumulado", "avance", "%"] },
			},
			{
				field_key: "monto_anterior",
				label: "Monto Anterior $",
				data_type: "currency",
				position: 7,
				required: false,
				config: { excelKeywords: ["anterior", "cert", "importe"] },
			},
			{
				field_key: "monto_presente",
				label: "Monto Presente $",
				data_type: "currency",
				position: 8,
				required: false,
				config: { excelKeywords: ["presente", "cert", "importe"] },
			},
			{
				field_key: "monto_acumulado",
				label: "Monto Acumulado $",
				data_type: "currency",
				position: 9,
				required: false,
				config: { excelKeywords: ["total", "acumulado", "cert", "importe"] },
			},
		],
	},
	{
		key: "curva_plan",
		name: "Curva Plan",
		description:
			"Curva de inversiones con avance mensual y acumulado.",
		columns: [
			{
				field_key: "periodo",
				label: "Período",
				data_type: "text",
				position: 0,
				required: false,
				config: { excelKeywords: ["mes", "periodo", "month"] },
			},
			{
				field_key: "avance_mensual_pct",
				label: "Avance Mensual %",
				data_type: "number",
				position: 1,
				required: false,
				config: { excelKeywords: ["avance", "mensual", "%"] },
			},
			{
				field_key: "avance_acumulado_pct",
				label: "Avance Acumulado %",
				data_type: "number",
				position: 2,
				required: false,
				config: { excelKeywords: ["acumulado", "financiero", "%"] },
			},
		],
	},
];

const DOCUMENTS_BUCKET = "obra-documents";
const STORAGE_LIST_PAGE_SIZE = 1000;
const REFERENCE_UPDATE_CHUNK_SIZE = 200;

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
	if (chunkSize <= 0 || items.length === 0) return [];
	const chunks: T[][] = [];
	for (let i = 0; i < items.length; i += chunkSize) {
		chunks.push(items.slice(i, i + chunkSize));
	}
	return chunks;
}

function getFileNameFromPath(path: string): string {
	const segments = path.split("/").filter(Boolean);
	return segments.length > 0 ? segments[segments.length - 1] : "";
}

function isUniqueViolation(error: unknown): boolean {
	const code =
		typeof error === "object" &&
		error &&
		"code" in error &&
		typeof (error as { code?: unknown }).code === "string"
			? (error as { code: string }).code
			: null;
	if (code === "23505") return true;
	const message =
		typeof error === "object" &&
		error &&
		"message" in error &&
		typeof (error as { message?: unknown }).message === "string"
			? (error as { message: string }).message.toLowerCase()
			: "";
	return message.includes("duplicate key") || message.includes("already exists");
}

function isStorageAlreadyExistsError(error: unknown): boolean {
	const message =
		typeof error === "object" &&
		error &&
		"message" in error &&
		typeof (error as { message?: unknown }).message === "string"
			? (error as { message: string }).message.toLowerCase()
			: "";
	const statusCode =
		typeof error === "object" &&
		error &&
		"statusCode" in error &&
		typeof (error as { statusCode?: unknown }).statusCode === "number"
			? (error as { statusCode: number }).statusCode
			: 0;
	return (
		statusCode === 409 ||
		message.includes("already exists") ||
		message.includes("duplicate")
	);
}

function getStorageStatusCode(error: unknown): number | null {
	const rawStatusCode =
		typeof error === "object" &&
		error &&
		"statusCode" in error &&
		(typeof (error as { statusCode?: unknown }).statusCode === "number" ||
			typeof (error as { statusCode?: unknown }).statusCode === "string")
			? Number((error as { statusCode: string | number }).statusCode)
			: null;
	if (rawStatusCode && Number.isFinite(rawStatusCode)) {
		return rawStatusCode;
	}
	const rawStatus =
		typeof error === "object" &&
		error &&
		"status" in error &&
		(typeof (error as { status?: unknown }).status === "number" ||
			typeof (error as { status?: unknown }).status === "string")
			? Number((error as { status: string | number }).status)
			: null;
	return rawStatus && Number.isFinite(rawStatus) ? rawStatus : null;
}

function isStorageNotFoundError(error: unknown): boolean {
	const statusCode = getStorageStatusCode(error);
	if (statusCode === 404) return true;
	const message =
		typeof error === "object" &&
		error &&
		"message" in error &&
		typeof (error as { message?: unknown }).message === "string"
			? (error as { message: string }).message.toLowerCase()
			: "";
	return message.includes("not found") || message.includes("no such file");
}

function splitParentAndName(path: string) {
	const lastSlash = path.lastIndexOf("/");
	if (lastSlash < 0) {
		return { parent: "", name: path };
	}
	return {
		parent: path.slice(0, lastSlash),
		name: path.slice(lastSlash + 1),
	};
}

async function storageObjectExists(
	supabase: SupabaseClient,
	path: string,
): Promise<boolean> {
	const { parent, name } = splitParentAndName(path);
	const { data, error } = await supabase.storage
		.from(DOCUMENTS_BUCKET)
		.list(parent, { limit: STORAGE_LIST_PAGE_SIZE, search: name });
	if (error) {
		if (isStorageNotFoundError(error)) return false;
		throw error;
	}
	return (data ?? []).some(
		(entry) => entry.name === name && Boolean(entry.metadata),
	);
}

type StorageCopyFallbackResult =
	| "copied"
	| "destination_exists"
	| "source_missing"
	| "failed";

async function copyStorageObjectFallback(
	supabase: SupabaseClient,
	params: { fromPath: string; toPath: string },
): Promise<StorageCopyFallbackResult> {
	const { data: downloaded, error: downloadError } = await supabase.storage
		.from(DOCUMENTS_BUCKET)
		.download(params.fromPath);
	if (downloadError) {
		if (isStorageNotFoundError(downloadError)) {
			return "source_missing";
		}
		console.error(
			"[apply-default-folder] Error downloading storage object for fallback copy",
			{ fromPath: params.fromPath, toPath: params.toPath },
			downloadError,
		);
		return "failed";
	}

	const uploadContentType =
		typeof downloaded.type === "string" && downloaded.type.length > 0
			? downloaded.type
			: "application/octet-stream";
	const { error: uploadError } = await supabase.storage
		.from(DOCUMENTS_BUCKET)
		.upload(params.toPath, downloaded, {
			upsert: false,
			contentType: uploadContentType,
		});
	if (uploadError) {
		if (isStorageAlreadyExistsError(uploadError)) {
			return "destination_exists";
		}
		console.error(
			"[apply-default-folder] Error uploading storage object for fallback copy",
			{ fromPath: params.fromPath, toPath: params.toPath },
			uploadError,
		);
		return "failed";
	}

	const { error: removeError } = await supabase.storage
		.from(DOCUMENTS_BUCKET)
		.remove([params.fromPath]);
	if (removeError && !isStorageNotFoundError(removeError)) {
		console.error(
			"[apply-default-folder] Error removing source object after fallback copy",
			{ fromPath: params.fromPath, toPath: params.toPath },
			removeError,
		);
	}

	return "copied";
}

function deriveLegacyFolderCandidates(params: {
	obraId: string;
	targetPath: string;
	sourcePaths: string[];
}): string[] {
	const { obraId, targetPath, sourcePaths } = params;
	if (!targetPath) return [];
	const prefix = `${obraId}/`;
	const marker = `/${targetPath}/`;
	const candidates = new Set<string>();

	for (const sourcePath of sourcePaths) {
		if (!sourcePath.startsWith(prefix)) continue;
		const relativePath = sourcePath.slice(prefix.length);
		const lastSlash = relativePath.lastIndexOf("/");
		if (lastSlash <= 0) continue;
		const sourceFolder = relativePath.slice(0, lastSlash);
		if (
			!sourceFolder ||
			sourceFolder === targetPath ||
			sourceFolder.startsWith(`${targetPath}/`)
		) {
			continue;
		}

		const wrapped = `/${sourceFolder}/`;
		const markerIndex = wrapped.indexOf(marker);
		if (markerIndex === -1) continue;

		const legacyRoot = wrapped.slice(1, markerIndex + marker.length - 1);
		if (legacyRoot && legacyRoot !== targetPath) {
			candidates.add(legacyRoot);
		}
	}

	return Array.from(candidates).sort((a, b) => b.length - a.length);
}

async function listFolderFilesRecursive(
	supabase: SupabaseClient,
	basePath: string,
): Promise<string[]> {
	const toScan = [basePath];
	const files: string[] = [];

	while (toScan.length > 0) {
		const current = toScan.shift()!;
		const { data, error } = await supabase.storage
			.from(DOCUMENTS_BUCKET)
			.list(current, { limit: STORAGE_LIST_PAGE_SIZE });
		if (error) {
			const lowerMessage =
				typeof error.message === "string" ? error.message.toLowerCase() : "";
			if (lowerMessage.includes("not found")) continue;
			throw error;
		}

		for (const entry of data ?? []) {
			const fullPath = `${current}/${entry.name}`;
			if (!entry.metadata) {
				toScan.push(fullPath);
				continue;
			}
			files.push(fullPath);
		}
	}

	return files;
}

async function moveFolderFilesForObra(
	supabase: SupabaseClient,
	params: {
		obraId: string;
		previousPath: string;
		nextPath: string;
	},
) {
	const oldFolderPrefix = `${params.obraId}/${params.previousPath}`;
	const nextFolderPrefix = `${params.obraId}/${params.nextPath}`;
	if (oldFolderPrefix === nextFolderPrefix) {
		return new Map<string, string>();
	}

	const files = await listFolderFilesRecursive(supabase, oldFolderPrefix);
	if (files.length === 0) {
		return new Map<string, string>();
	}

	const movingIntoDescendant = nextFolderPrefix.startsWith(`${oldFolderPrefix}/`);
	const movedPaths = new Map<string, string>();

	for (const fromPath of files) {
		if (
			movingIntoDescendant &&
			(fromPath === nextFolderPrefix || fromPath.startsWith(`${nextFolderPrefix}/`))
		) {
			continue;
		}
		const suffix = fromPath.slice(oldFolderPrefix.length);
		if (!suffix.startsWith("/")) continue;
		const toPath = `${nextFolderPrefix}${suffix}`;
		if (toPath === fromPath) continue;

		const { error: moveError } = await supabase.storage
			.from(DOCUMENTS_BUCKET)
			.move(fromPath, toPath);
		if (moveError) {
			if (isStorageAlreadyExistsError(moveError)) {
				// If destination already exists from a previous partial run,
				// delete stale source and continue by remapping references.
				await supabase.storage.from(DOCUMENTS_BUCKET).remove([fromPath]);
				movedPaths.set(fromPath, toPath);
				continue;
			}

			let destinationExists = false;
			try {
				destinationExists = await storageObjectExists(supabase, toPath);
			} catch (existsError) {
				console.error(
					"[apply-default-folder] Error checking destination existence during move fallback",
					{ obraId: params.obraId, fromPath, toPath },
					existsError,
				);
			}
			if (destinationExists) {
				await supabase.storage.from(DOCUMENTS_BUCKET).remove([fromPath]);
				movedPaths.set(fromPath, toPath);
				continue;
			}

			const statusCode = getStorageStatusCode(moveError);
			if (statusCode === 500 || isStorageNotFoundError(moveError)) {
				const fallback = await copyStorageObjectFallback(supabase, {
					fromPath,
					toPath,
				});
				if (fallback === "copied") {
					movedPaths.set(fromPath, toPath);
					continue;
				}
				if (fallback === "destination_exists") {
					await supabase.storage.from(DOCUMENTS_BUCKET).remove([fromPath]);
					movedPaths.set(fromPath, toPath);
					continue;
				}
				if (fallback === "source_missing") {
					// Migration edge case: metadata points to file path but blob is gone.
					// Keep path references coherent with the new folder structure.
					movedPaths.set(fromPath, toPath);
					continue;
				}
			}

			console.error(
				"[apply-default-folder] Error moving storage object",
				{ obraId: params.obraId, fromPath, toPath },
				moveError,
			);
			continue;
		}
		movedPaths.set(fromPath, toPath);
	}

	return movedPaths;
}

async function syncMovedDocumentReferences(
	supabase: SupabaseClient,
	params: {
		obraId: string;
		movedPaths: Map<string, string>;
		obraOcrTablaIds: string[];
	},
) {
	if (params.movedPaths.size === 0) return;
	const movedFromPaths = Array.from(params.movedPaths.keys());

	for (const pathChunk of chunkArray(movedFromPaths, REFERENCE_UPDATE_CHUNK_SIZE)) {
		const { data: uploads, error: uploadsError } = await supabase
			.from("obra_document_uploads")
			.select("id, storage_path")
			.eq("obra_id", params.obraId)
			.in("storage_path", pathChunk);
		if (uploadsError) {
			console.error("[apply-default-folder] Error loading upload references", uploadsError);
			continue;
		}
		for (const upload of uploads ?? []) {
			const id = typeof upload.id === "string" ? upload.id : null;
			const currentPath =
				typeof upload.storage_path === "string" ? upload.storage_path : null;
			const nextPath = currentPath ? params.movedPaths.get(currentPath) : null;
			if (!id || !currentPath || !nextPath || nextPath === currentPath) continue;

			const { error: updateUploadError } = await supabase
				.from("obra_document_uploads")
				.update({
					storage_path: nextPath,
					file_name: getFileNameFromPath(nextPath),
				})
				.eq("id", id);
			if (updateUploadError) {
				if (isUniqueViolation(updateUploadError)) {
					await supabase.from("obra_document_uploads").delete().eq("id", id);
					continue;
				}
				console.error("[apply-default-folder] Error updating upload reference", updateUploadError);
			}
		}
	}

	for (const pathChunk of chunkArray(movedFromPaths, REFERENCE_UPDATE_CHUNK_SIZE)) {
		const { data: processingRows, error: processingError } = await supabase
			.from("ocr_document_processing")
			.select("id, source_path")
			.eq("obra_id", params.obraId)
			.in("source_path", pathChunk);
		if (processingError) {
			console.error(
				"[apply-default-folder] Error loading OCR document processing references",
				processingError,
			);
			continue;
		}
		for (const row of processingRows ?? []) {
			const id = typeof row.id === "string" ? row.id : null;
			const currentPath =
				typeof row.source_path === "string" ? row.source_path : null;
			const nextPath = currentPath ? params.movedPaths.get(currentPath) : null;
			if (!id || !currentPath || !nextPath || nextPath === currentPath) continue;

			const { error: updateProcessingError } = await supabase
				.from("ocr_document_processing")
				.update({
					source_path: nextPath,
					source_file_name: getFileNameFromPath(nextPath),
				})
				.eq("id", id);
			if (updateProcessingError) {
				if (isUniqueViolation(updateProcessingError)) {
					await supabase.from("ocr_document_processing").delete().eq("id", id);
					continue;
				}
				console.error(
					"[apply-default-folder] Error updating OCR document processing reference",
					updateProcessingError,
				);
			}
		}
	}

	for (const pathChunk of chunkArray(movedFromPaths, REFERENCE_UPDATE_CHUNK_SIZE)) {
		const { data: apsRows, error: apsError } = await supabase
			.from("aps_models")
			.select("id, file_path")
			.eq("obra_id", params.obraId)
			.in("file_path", pathChunk);
		if (apsError) {
			console.error("[apply-default-folder] Error loading APS references", apsError);
			continue;
		}
		for (const model of apsRows ?? []) {
			const id = typeof model.id === "string" ? model.id : null;
			const currentPath =
				typeof model.file_path === "string" ? model.file_path : null;
			const nextPath = currentPath ? params.movedPaths.get(currentPath) : null;
			if (!id || !currentPath || !nextPath || nextPath === currentPath) continue;

			const { error: updateApsError } = await supabase
				.from("aps_models")
				.update({ file_path: nextPath })
				.eq("id", id);
			if (updateApsError) {
				if (isUniqueViolation(updateApsError)) {
					await supabase.from("aps_models").delete().eq("id", id);
					continue;
				}
				console.error("[apply-default-folder] Error updating APS reference", updateApsError);
			}
		}
	}

	const tablaIdChunks = chunkArray(params.obraOcrTablaIds, 50);
	for (const tablaChunk of tablaIdChunks) {
		let from = 0;
		while (true) {
			const to = from + STORAGE_LIST_PAGE_SIZE - 1;
			const { data: rows, error: rowsError } = await supabase
				.from("obra_tabla_rows")
				.select("id, data")
				.in("tabla_id", tablaChunk)
				.order("id", { ascending: true })
				.range(from, to);
			if (rowsError) {
				console.error(
					"[apply-default-folder] Error loading OCR row references",
					rowsError,
				);
				break;
			}

			if (!rows || rows.length === 0) break;

			const updates: Array<{ id: string; data: Record<string, unknown> }> = [];
			for (const row of rows) {
				const id = typeof row.id === "string" ? row.id : null;
				const data =
					row.data && typeof row.data === "object"
						? (row.data as Record<string, unknown>)
						: null;
				if (!id || !data) continue;
				const docPath =
					typeof data.__docPath === "string" ? data.__docPath : null;
				if (!docPath) continue;
				const nextDocPath = params.movedPaths.get(docPath);
				if (!nextDocPath || nextDocPath === docPath) continue;
				updates.push({ id, data: { ...data, __docPath: nextDocPath } });
			}

			for (const updateChunk of chunkArray(updates, REFERENCE_UPDATE_CHUNK_SIZE)) {
				const { error: upsertRowsError } = await supabase
					.from("obra_tabla_rows")
					.upsert(updateChunk, { onConflict: "id" });
				if (upsertRowsError) {
					console.error(
						"[apply-default-folder] Error updating OCR row __docPath references",
						upsertRowsError,
					);
				}
			}

			if (rows.length < STORAGE_LIST_PAGE_SIZE) break;
			from += STORAGE_LIST_PAGE_SIZE;
		}
	}
}

type ExistingObraColumn = {
	id: string;
	field_key: string;
	data_type: string;
	config: Record<string, unknown> | null;
};

type OcrTemplateColumn = {
	fieldKey?: string;
	label?: string;
	dataType?: string;
	ocrScope?: string;
	description?: string;
};

function buildObraColumnConfig(
	bundle: DefaultFolderBundle,
	column: NonNullable<DefaultFolderBundle["columns"]>[number]
) {
	const config: Record<string, unknown> = {};
	if (bundle.hasNestedData && column.ocrScope) {
		config.ocrScope = column.ocrScope;
	}
	if (column.description) {
		config.ocrDescription = column.description;
	}
	if (column.id) {
		config.defaultColumnId = column.id;
	}
	return config;
}

function buildPreviousFieldKeyByIdentity(columns: ExistingObraColumn[]) {
	const map = new Map<string, string>();
	for (const column of columns) {
		const config =
			(column.config as Record<string, unknown> | null | undefined) ?? {};
		const defaultColumnId =
			typeof config.defaultColumnId === "string" ? config.defaultColumnId : null;
		if (defaultColumnId) {
			map.set(defaultColumnId, column.field_key);
		}
		map.set(column.field_key, column.field_key);
	}
	return map;
}

async function fetchDefaultFolderBundle(
	supabase: SupabaseClient,
	params: ApplyDefaultFolderParams,
): Promise<DefaultFolderBundle | null> {
	const { data: folder, error: folderError } = await supabase
		.from("obra_default_folders")
		.select("id, name, path")
		.eq("tenant_id", params.tenantId)
		.eq("id", params.folderId)
		.maybeSingle();

	if (folderError) throw folderError;
	if (!folder) return null;

	const { data: tabla, error: tablaError } = await supabase
		.from("obra_default_tablas")
		.select(
			"id, name, description, source_type, linked_folder_path, settings, ocr_template_id",
		)
		.eq("tenant_id", params.tenantId)
		.eq("linked_folder_path", folder.path)
		.eq("source_type", "ocr")
		.maybeSingle();

	if (tablaError) throw tablaError;

	if (!tabla) {
		return {
			folderId: folder.id as string,
			name: folder.name as string,
			path: folder.path as string,
			isOcr: false,
		};
	}

	const { data: columns, error: columnsError } = await supabase
		.from("obra_default_tabla_columns")
		.select("id, field_key, label, data_type, required, position, config")
		.eq("default_tabla_id", tabla.id)
		.order("position", { ascending: true });

	if (columnsError) throw columnsError;

	const mappedColumns: NonNullable<DefaultFolderBundle["columns"]> = (columns ?? []).map((col) => {
		const config = (col.config ?? {}) as Record<string, unknown>;
		return {
			id: col.id as string,
			label: col.label as string,
			fieldKey: col.field_key as string,
			dataType: col.data_type as string,
			required: Boolean(col.required),
			position: col.position ?? 0,
			ocrScope:
				typeof config.ocrScope === "string" ? config.ocrScope : undefined,
			description:
				typeof config.ocrDescription === "string"
					? config.ocrDescription
					: null,
		};
	});

	let resolvedColumns = mappedColumns;
	const templateId = (tabla.ocr_template_id as string | null) ?? null;
	if (resolvedColumns.length === 0 && templateId) {
		const { data: template, error: templateError } = await supabase
			.from("ocr_templates")
			.select("columns")
			.eq("id", templateId)
			.maybeSingle();

		if (templateError) throw templateError;

		const templateColumnsValue = (template as { columns?: unknown } | null)?.columns;
		const templateColumns = Array.isArray(templateColumnsValue)
			? (templateColumnsValue as OcrTemplateColumn[])
			: [];

		if (templateColumns.length > 0) {
			resolvedColumns = templateColumns.map((col, index) => ({
				id: undefined,
				label: col.label ?? `Columna ${index + 1}`,
				fieldKey: normalizeFieldKey(
					col.fieldKey ?? col.label ?? `columna_${index + 1}`,
				),
				dataType: col.dataType ?? "text",
				required: false,
				position: index,
				ocrScope: col.ocrScope,
				description: col.description ?? null,
			}));
		}
	}

	const settings = (tabla.settings as Record<string, unknown>) ?? {};
	const hasNestedData = Boolean(settings.hasNestedData);

		return {
			folderId: folder.id as string,
			name: folder.name as string,
			path: folder.path as string,
			isOcr: true,
			defaultTablaId: tabla.id as string,
			tablaName: tabla.name as string,
			tablaDescription: (tabla.description as string | null) ?? null,
			settings: {
				...settings,
				ocrFolder: folder.path,
				ocrTemplateId:
					tabla.ocr_template_id ??
					(typeof settings.ocrTemplateId === "string"
						? settings.ocrTemplateId
						: null),
				defaultTablaId: tabla.id as string,
			},
		ocrTemplateId: (tabla.ocr_template_id as string | null) ?? null,
		hasNestedData,
		columns: resolvedColumns,
	};
}

export async function applyDefaultFolderToExistingObras(
	supabase: SupabaseClient,
	params: ApplyDefaultFolderParams,
) {
	const bundle = await fetchDefaultFolderBundle(supabase, params);
	if (!bundle) return { ok: false, reason: "folder_not_found" } as const;

	const { data: obras, error: obrasError } = await supabase
		.from("obras")
		.select("id")
		.eq("tenant_id", params.tenantId);

	if (obrasError) throw obrasError;

	const shouldForceSync = params.forceSync === true;
	const previousPath =
		typeof params.previousPath === "string" && params.previousPath.trim()
			? params.previousPath.trim()
			: null;

	for (const obra of obras ?? []) {
		const obraId = obra.id as string;
		try {
			const keepPath = `${obraId}/${bundle.path}/.keep`;
			await supabase.storage
				.from("obra-documents")
				.upload(keepPath, new Blob([""], { type: "text/plain" }), {
					upsert: true,
				});
		} catch (error) {
			console.error(
				"[apply-default-folder] Error creating folder",
				bundle.path,
				obraId,
				error,
				);
		}

		const { data: obraOcrTablas, error: obraOcrTablasError } = await supabase
			.from("obra_tablas")
			.select("id, name, settings")
			.eq("obra_id", obraId)
			.eq("source_type", "ocr");

		if (obraOcrTablasError) {
			console.error(
				"[apply-default-folder] Error loading existing obra tablas",
				obraOcrTablasError,
			);
			continue;
		}

		const obraOcrTablaIds = (obraOcrTablas ?? [])
			.map((tabla) => (typeof tabla.id === "string" ? tabla.id : null))
			.filter((tablaId): tablaId is string => Boolean(tablaId));

		if (previousPath && previousPath !== bundle.path) {
			try {
				const movedPaths = await moveFolderFilesForObra(supabase, {
					obraId,
					previousPath,
					nextPath: bundle.path,
				});
				if (movedPaths.size > 0) {
					await syncMovedDocumentReferences(supabase, {
						obraId,
						movedPaths,
						obraOcrTablaIds,
					});
				}
			} catch (moveError) {
				console.error(
					"[apply-default-folder] Error moving folder files during default sync",
					{ obraId, previousPath, nextPath: bundle.path },
					moveError,
				);
			}
		}

		const matchingTabla = (obraOcrTablas ?? []).find((tabla) => {
			const settings = (tabla.settings as Record<string, unknown>) ?? {};
			const tablaFolder = typeof settings.ocrFolder === "string" ? settings.ocrFolder : null;
			const defaultTablaId =
				typeof settings.defaultTablaId === "string" ? settings.defaultTablaId : null;
			if (bundle.defaultTablaId && defaultTablaId === bundle.defaultTablaId) return true;
			if (tablaFolder === bundle.path) return true;
			if (previousPath && tablaFolder === previousPath) return true;
			return bundle.tablaName ? tabla.name === bundle.tablaName : false;
		});

		if (bundle.isOcr && (previousPath === null || previousPath === bundle.path) && matchingTabla?.id) {
			try {
				const { data: processingDocs, error: processingDocsError } = await supabase
					.from("ocr_document_processing")
					.select("source_path")
					.eq("obra_id", obraId)
					.eq("tabla_id", matchingTabla.id);
				if (processingDocsError) {
					console.error(
						"[apply-default-folder] Error loading OCR source paths for legacy-folder detection",
						processingDocsError,
					);
				} else {
					const legacyFolders = deriveLegacyFolderCandidates({
						obraId,
						targetPath: bundle.path,
						sourcePaths: (processingDocs ?? [])
							.map((row) =>
								typeof row.source_path === "string" ? row.source_path : null,
							)
							.filter((path): path is string => Boolean(path)),
					});
					if (legacyFolders.length > 0) {
						const movedPaths = new Map<string, string>();
						for (const legacyFolder of legacyFolders) {
							const movedForFolder = await moveFolderFilesForObra(supabase, {
								obraId,
								previousPath: legacyFolder,
								nextPath: bundle.path,
							});
							for (const [fromPath, toPath] of movedForFolder.entries()) {
								movedPaths.set(fromPath, toPath);
							}
						}
						if (movedPaths.size > 0) {
							await syncMovedDocumentReferences(supabase, {
								obraId,
								movedPaths,
								obraOcrTablaIds,
							});
						}
					}
				}
			} catch (legacyRepairError) {
				console.error(
					"[apply-default-folder] Error repairing legacy nested folder path",
					{ obraId, targetPath: bundle.path },
					legacyRepairError,
				);
			}
		}

		if (!bundle.isOcr || !bundle.tablaName || !bundle.settings) {
			if (matchingTabla) {
				const { error: deleteTablaError } = await supabase
					.from("obra_tablas")
					.delete()
					.eq("id", matchingTabla.id);
				if (deleteTablaError) {
					console.error(
						"[apply-default-folder] Error deleting existing tabla on non-data folder",
						deleteTablaError,
					);
				}
			}
			continue;
		}

		const spreadsheetTemplate =
			typeof bundle.settings.spreadsheetTemplate === "string"
				? bundle.settings.spreadsheetTemplate
				: "auto";
		const isCertificadoSpreadsheet = spreadsheetTemplate === "certificado";

		if (isCertificadoSpreadsheet) {
			for (const preset of CERTIFICADO_SPREADSHEET_PRESETS) {
				const presetName = `${bundle.name} · ${preset.name}`;
				const existingPresetTabla = (obraOcrTablas ?? []).find((tabla) => tabla.name === presetName);
				if (existingPresetTabla && !shouldForceSync) continue;

					const presetSettings: Record<string, unknown> = {
						...bundle.settings,
						ocrFolder: bundle.path,
						spreadsheetTemplate: "certificado",
						spreadsheetPresetKey: preset.key,
						defaultTablaId: bundle.defaultTablaId,
					};

				let presetTablaId = existingPresetTabla?.id ?? null;
				if (presetTablaId) {
					const { error: updatePresetTablaError } = await supabase
						.from("obra_tablas")
					.update({
						name: presetName,
						description: preset.description,
						source_type: "ocr",
						settings: presetSettings,
						})
						.eq("id", presetTablaId);
					if (updatePresetTablaError) {
						console.error(
							"[apply-default-folder] Error updating certificado preset tabla",
							updatePresetTablaError,
						);
						continue;
					}
					await supabase.from("obra_tabla_columns").delete().eq("tabla_id", presetTablaId);
				} else {
					const { data: createdPresetTabla, error: createPresetTablaError } = await supabase
						.from("obra_tablas")
					.insert({
						obra_id: obraId,
						name: presetName,
						description: preset.description,
						source_type: "ocr",
						settings: presetSettings,
						})
						.select("id")
						.single();
					if (createPresetTablaError || !createdPresetTabla) {
						console.error(
							"[apply-default-folder] Error creating certificado preset tabla",
							createPresetTablaError,
						);
						continue;
					}
					presetTablaId = createdPresetTabla.id;
				}

				const presetColumnsPayload = preset.columns.map((column) => ({
					tabla_id: presetTablaId,
					field_key: column.field_key,
					label: column.label,
					data_type: column.data_type,
					position: column.position,
					required: column.required,
					config: column.config ?? {},
				}));
				const { error: presetColumnsError } = await supabase
					.from("obra_tabla_columns")
					.insert(presetColumnsPayload);
				if (presetColumnsError) {
					console.error(
						"[apply-default-folder] Error creating certificado preset columns",
						presetColumnsError,
					);
				}
			}
			continue;
		}

		let tablaId = matchingTabla?.id ?? null;
		if (tablaId && !shouldForceSync) {
			const { data: existingColumns, error: existingColumnsError } = await supabase
				.from("obra_tabla_columns")
				.select("id")
				.eq("tabla_id", tablaId)
				.limit(1);

			if (existingColumnsError) {
				console.error(
					"[apply-default-folder] Error checking existing columns",
					existingColumnsError,
				);
				continue;
			}

			if (existingColumns && existingColumns.length > 0) {
				continue;
			}
		}

		let previousColumns: ExistingObraColumn[] = [];
		let existingRows:
			| Array<{ id: string; data: Record<string, unknown> | null; source: string | null }>
			| null = null;

		if (tablaId) {
			const { data: loadedColumns, error: loadedColumnsError } = await supabase
				.from("obra_tabla_columns")
				.select("id, field_key, data_type, config")
				.eq("tabla_id", tablaId)
				.order("position", { ascending: true });
			if (loadedColumnsError) {
				console.error(
					"[apply-default-folder] Error loading previous columns",
					loadedColumnsError,
				);
				continue;
			}
			previousColumns = (loadedColumns ?? []) as ExistingObraColumn[];

			if (shouldForceSync) {
				const { data: loadedRows, error: loadedRowsError } = await supabase
					.from("obra_tabla_rows")
					.select("id, data, source")
					.eq("tabla_id", tablaId);
				if (loadedRowsError) {
					console.error(
						"[apply-default-folder] Error loading previous rows",
						loadedRowsError,
					);
					continue;
				}
				existingRows = (loadedRows ?? []) as Array<{
					id: string;
					data: Record<string, unknown> | null;
					source: string | null;
				}>;
			}

			const { error: updateTablaError } = await supabase
				.from("obra_tablas")
					.update({
						name: bundle.tablaName,
						description: bundle.tablaDescription ?? null,
						source_type: "ocr",
						settings: { ...bundle.settings, defaultTablaId: bundle.defaultTablaId },
					})
				.eq("id", tablaId);

			if (updateTablaError) {
				console.error(
					"[apply-default-folder] Error updating existing tabla",
					updateTablaError,
				);
				continue;
			}

			const { error: deleteColumnsError } = await supabase
				.from("obra_tabla_columns")
				.delete()
				.eq("tabla_id", tablaId);
			if (deleteColumnsError) {
				console.error(
					"[apply-default-folder] Error deleting previous columns",
					deleteColumnsError,
				);
				continue;
			}
		} else {
			const { data: tabla, error: tablaError } = await supabase
				.from("obra_tablas")
					.insert({
						obra_id: obraId,
						name: bundle.tablaName,
						description: bundle.tablaDescription ?? null,
						source_type: "ocr",
						settings: { ...bundle.settings, defaultTablaId: bundle.defaultTablaId },
					})
				.select("id")
				.single();

			if (tablaError) {
				console.error(
					"[apply-default-folder] Error creating tabla",
					tablaError,
				);
				continue;
			}
			tablaId = tabla?.id ?? null;
		}

		if (!tablaId) continue;

		const rawColumns = bundle.columns ?? [];
		if (rawColumns.length === 0) continue;

		const columnsPayload = rawColumns.map((col, index) => ({
			tabla_id: tablaId,
			field_key: normalizeFieldKey(col.fieldKey || col.label),
			label: col.label,
			data_type: ensureTablaDataType(col.dataType),
			position: col.position ?? index,
			required: Boolean(col.required),
			config: buildObraColumnConfig(bundle, col),
		}));

		const { data: insertedColumns, error: columnsError } = await supabase
			.from("obra_tabla_columns")
			.insert(columnsPayload)
			.select("id, field_key, data_type, config");

		if (columnsError) {
			console.error(
				"[apply-default-folder] Error creating columns",
				columnsError,
			);
			continue;
		}

		if (tablaId && shouldForceSync && existingRows && existingRows.length > 0) {
			const previousFieldKeyByIdentity = buildPreviousFieldKeyByIdentity(previousColumns);
			const nextColumns = (insertedColumns ?? []).map((column) => {
				const config =
					(column.config as Record<string, unknown> | null | undefined) ?? {};
				const defaultColumnId =
					typeof config.defaultColumnId === "string"
						? config.defaultColumnId
						: null;
				return {
					id: defaultColumnId ?? (column.field_key as string),
					fieldKey: column.field_key as string,
					dataType: column.data_type as string,
					config,
				};
			});

			const migratedRows = existingRows.map((row) => ({
				id: row.id,
				tabla_id: tablaId,
				data: remapTablaRowDataToSchema({
					previousData: row.data,
					nextColumns,
					previousFieldKeyByColumnId: previousFieldKeyByIdentity,
				}),
				source: row.source ?? "manual",
			}));

			const { error: upsertRowsError } = await supabase
				.from("obra_tabla_rows")
				.upsert(migratedRows, { onConflict: "id" });
			if (upsertRowsError) {
				console.error(
					"[apply-default-folder] Error migrating existing rows",
					upsertRowsError,
				);
			}
		}
	}

	return { ok: true } as const;
}
