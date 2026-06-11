import type { SupabaseClient } from "@supabase/supabase-js";

export type DocumentAiChatScope = {
	obraIds: string[];
	folders: Array<{ obraId: string; path: string; label?: string }>;
};

export type ValidatedObra = {
	id: string;
	nombre: string;
	avance: number | null;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseChatScope(raw: unknown): DocumentAiChatScope {
	const record = (raw ?? {}) as Record<string, unknown>;
	const obraIds = Array.isArray(record.obraIds)
		? record.obraIds
			.filter((id): id is string => typeof id === "string" && UUID_PATTERN.test(id))
			.slice(0, 10)
		: [];
	const folders: DocumentAiChatScope["folders"] = [];
	if (Array.isArray(record.folders)) {
		for (const entry of record.folders.slice(0, 20)) {
			const folder = (entry ?? {}) as Record<string, unknown>;
			const obraId = typeof folder.obraId === "string" ? folder.obraId : "";
			const path = typeof folder.path === "string" ? folder.path.trim() : "";
			if (!UUID_PATTERN.test(obraId) || !path || path.includes("..")) continue;
			folders.push({
				obraId,
				path,
				label: typeof folder.label === "string" ? folder.label : undefined,
			});
		}
	}
	return { obraIds, folders };
}

function formatObraLabel(row: Record<string, unknown>) {
	return [row.n != null ? String(row.n) : "", typeof row.designacion_y_ubicacion === "string" ? row.designacion_y_ubicacion : ""]
		.filter(Boolean)
		.join(" ")
		.trim() || "Obra sin nombre";
}

/**
 * Resolves the obras that actually belong to the tenant. Any id coming from
 * the client or the model is treated as a suggestion: only ids present in the
 * returned map may be used by tools.
 */
export async function resolveTenantObras(
	supabase: SupabaseClient,
	tenantId: string,
): Promise<Map<string, ValidatedObra>> {
	const { data, error } = await supabase
		.from("obras")
		.select("id, n, designacion_y_ubicacion, porcentaje")
		.eq("tenant_id", tenantId)
		.is("deleted_at", null)
		.order("n", { ascending: true })
		.limit(300);
	if (error) throw error;
	const map = new Map<string, ValidatedObra>();
	for (const row of (data ?? []) as Array<Record<string, unknown>>) {
		const id = String(row.id);
		map.set(id, {
			id,
			nombre: formatObraLabel(row),
			avance: typeof row.porcentaje === "number" ? row.porcentaje : null,
		});
	}
	return map;
}

export function sanitizeScope(
	scope: DocumentAiChatScope,
	tenantObras: Map<string, ValidatedObra>,
): DocumentAiChatScope {
	const obraIds = scope.obraIds.filter((id) => tenantObras.has(id));
	const folders = scope.folders.filter((folder) => tenantObras.has(folder.obraId));
	return { obraIds, folders };
}

/**
 * A storage path is only addressable when its first segment is an obra of the
 * current tenant. This is the contract of the `obra-documents` bucket
 * (`{obraId}/{relativePath}`).
 */
export function validateStoragePath(
	storagePath: string,
	tenantObras: Map<string, ValidatedObra>,
): { obraId: string; relativePath: string } | null {
	const trimmed = storagePath.trim();
	if (!trimmed || trimmed.includes("..")) return null;
	const [first, ...rest] = trimmed.split("/").filter(Boolean);
	if (!first || rest.length === 0) return null;
	if (!tenantObras.has(first)) return null;
	return { obraId: first, relativePath: rest.join("/") };
}
