import type { SupabaseClient } from "@supabase/supabase-js";
import {
	coerceValueForType,
	ensureTablaDataType,
	evaluateTablaFormula,
	normalizeFolderName,
	normalizeFolderPath,
} from "@/lib/tablas";

export type UploadInstruction = {
	obraQuery?: string;
	obraNumber?: number;
	folderQuery?: string;
};

export function parseUploadInstruction(text: string): UploadInstruction {
	const trimmed = text.trim();
	const lower = trimmed.toLowerCase();
	const obraIndex = lower.indexOf("obra");
	const carpetaIndex = lower.indexOf("carpeta");
	const folderWordIndex =
		carpetaIndex >= 0 ? carpetaIndex : lower.indexOf("folder");

	let obraQuery: string | undefined;
	let obraNumber: number | undefined;
	let folderQuery: string | undefined;

	if (obraIndex >= 0) {
		const start = obraIndex + "obra".length;
		const end =
			folderWordIndex > start ? folderWordIndex : findSentenceBoundary(trimmed, start);
		const raw = cleanupInstructionSegment(trimmed.slice(start, end));
		if (raw) {
			obraQuery = raw;
			const numberMatch = raw.match(/\d+/);
			if (numberMatch) {
				const parsed = Number(numberMatch[0]);
				if (Number.isFinite(parsed)) obraNumber = parsed;
			}
		}
	}

	if (folderWordIndex >= 0) {
		const word = carpetaIndex >= 0 ? "carpeta" : "folder";
		const start = folderWordIndex + word.length;
		const end = obraIndex > start ? obraIndex : findSentenceBoundary(trimmed, start);
		const cleaned = cleanupInstructionSegment(trimmed.slice(start, end));
		if (cleaned) folderQuery = cleaned;
	}

	if (!obraQuery && folderWordIndex > 0) {
		const raw = cleanupInstructionSegment(trimmed.slice(0, folderWordIndex));
		if (raw) obraQuery = raw;
	}

	return { obraQuery, obraNumber, folderQuery };
}

function findSentenceBoundary(text: string, start: number) {
	const rest = text.slice(start);
	const match = rest.search(/[.!?,\n]/);
	return match >= 0 ? start + match : text.length;
}

function cleanupInstructionSegment(value: string) {
	return value
		.replace(/^\s*(de|del|en|a|para)\s+/i, "")
		.replace(/\s+(de|del|en|para)\s*$/i, "")
		.replace(/\b(quiero|subir|cargar|esto)\b/gi, " ")
		.replace(/\s+/g, " ")
		.trim();
}

export function normalizePhone(value: string) {
	return value.replace(/[^\d+]/g, "").replace(/^\+?/, "+");
}

export function isObraAllowed(contact: { allowed_obra_ids?: string[] | null }, obraId: string) {
	const allowed = contact.allowed_obra_ids ?? [];
	return allowed.length === 0 || allowed.includes(obraId);
}

export async function findObraCandidates(args: {
	supabase: SupabaseClient;
	tenantId: string;
	query?: string;
	number?: number;
	limit?: number;
}) {
	const limit = args.limit ?? 5;
	if (args.number != null) {
		const { data, error } = await args.supabase
			.from("obras")
			.select("id, n, designacion_y_ubicacion")
			.eq("tenant_id", args.tenantId)
			.eq("n", args.number)
			.is("deleted_at", null)
			.limit(limit);
		if (error) throw error;
		return data ?? [];
	}

	const query = args.query?.trim();
	if (!query) return [];
	const { data, error } = await args.supabase
		.from("obras")
		.select("id, n, designacion_y_ubicacion")
		.eq("tenant_id", args.tenantId)
		.ilike("designacion_y_ubicacion", `%${query}%`)
		.is("deleted_at", null)
		.order("n", { ascending: true })
		.limit(limit);
	if (error) throw error;
	return data ?? [];
}

export async function findFolderCandidates(args: {
	supabase: SupabaseClient;
	tenantId: string;
	obraId: string;
	query?: string;
	limit?: number;
}) {
	const query = args.query?.trim() ?? "";
	const normalizedQuery = normalizeFolderName(query);
	const limit = args.limit ?? 6;

	const folders: Array<{
		path: string;
		label: string;
		kind: "regular" | "extraction";
		tablaId?: string;
		dataInputMethod?: string;
	}> = [];

	const { data: defaults, error: defaultsError } = await args.supabase
		.from("obra_default_folders")
		.select("name, path")
		.eq("tenant_id", args.tenantId)
		.order("position", { ascending: true });
	if (defaultsError) throw defaultsError;

	for (const folder of defaults ?? []) {
		const path = normalizeFolderPath(String(folder.path ?? folder.name ?? ""));
		if (!path) continue;
		folders.push({
			path,
			label: String(folder.name ?? path),
			kind: "regular",
		});
	}

	const { data: tablas, error: tablasError } = await args.supabase
		.from("obra_tablas")
		.select("id, name, settings")
		.eq("obra_id", args.obraId)
		.eq("source_type", "ocr");
	if (tablasError) throw tablasError;

	for (const tabla of tablas ?? []) {
		const settings = (tabla.settings ?? {}) as Record<string, unknown>;
		const folder = typeof settings.ocrFolder === "string" ? settings.ocrFolder : "";
		const path = normalizeFolderPath(folder);
		if (!path) continue;
		const label =
			typeof settings.ocrFolderLabel === "string" && settings.ocrFolderLabel.trim()
				? settings.ocrFolderLabel.trim()
				: String(tabla.name ?? path);
		folders.push({
			path,
			label,
			kind: "extraction",
			tablaId: String(tabla.id),
			dataInputMethod:
				typeof settings.dataInputMethod === "string"
					? settings.dataInputMethod
					: "both",
		});
	}

	const seen = new Set<string>();
	const unique = folders.filter((folder) => {
		const key = `${folder.kind}:${folder.path}:${folder.tablaId ?? ""}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});

	if (!normalizedQuery) return unique.slice(0, limit);
	return unique
		.filter((folder) => {
			const haystack = `${normalizeFolderName(folder.path)} ${normalizeFolderName(folder.label)}`;
			return haystack.includes(normalizedQuery);
		})
		.slice(0, limit);
}

export function guessFileExtension(mimeType: string) {
	if (mimeType === "image/jpeg") return "jpg";
	if (mimeType === "image/png") return "png";
	if (mimeType === "image/webp") return "webp";
	if (mimeType === "image/heic") return "heic";
	if (mimeType === "image/heif") return "heif";
	if (mimeType === "application/pdf") return "pdf";
	if (mimeType === "audio/ogg") return "ogg";
	if (mimeType === "audio/mpeg") return "mp3";
	if (mimeType === "video/mp4") return "mp4";
	return "bin";
}

export function sanitizeStorageFileName(value: string) {
	return value
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-zA-Z0-9._ -]/g, "-")
		.replace(/-+/g, "-")
		.replace(/\s+/g, " ")
		.trim();
}

export async function validateManualSubmission(args: {
	supabase: SupabaseClient;
	tablaId: string;
	values: Record<string, unknown>;
}) {
	const { data: columns, error } = await args.supabase
		.from("obra_tabla_columns")
		.select("id, field_key, label, data_type, required, config")
		.eq("tabla_id", args.tablaId)
		.order("position", { ascending: true });
	if (error) throw error;

	const parsed: Record<string, unknown> = {};
	const errors: Array<{ fieldKey: string; message: string }> = [];

	for (const column of columns ?? []) {
		const fieldKey = String(column.field_key);
		const dataType = ensureTablaDataType(String(column.data_type ?? "text"));
		const raw = args.values[fieldKey];
		const value = coerceValueForType(dataType, raw);
		parsed[fieldKey] = value;
		if (column.required && (value == null || value === "")) {
			errors.push({
				fieldKey,
				message: `${column.label ?? fieldKey} es obligatorio.`,
			});
		}
	}

	for (const column of columns ?? []) {
		const config = (column.config ?? {}) as Record<string, unknown>;
		const formula = typeof config.formula === "string" ? config.formula.trim() : "";
		if (!formula) continue;
		const dataType = ensureTablaDataType(String(column.data_type ?? "text"));
		parsed[String(column.field_key)] = coerceValueForType(
			dataType,
			evaluateTablaFormula(formula, parsed),
		);
	}

	return { parsed, errors };
}
