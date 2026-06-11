import type { Obra } from "@/app/excel/schema";
import type { ExcelPageMainTableColumnConfig } from "@/lib/excel/types";
import {
	hasAnyDemoCapability,
	resolveRequestAccessContext,
} from "@/lib/demo-session";
import {
	BASE_COLUMNS,
	CONFIG_COLUMNS,
	LEGACY_BASE_COLUMNS,
	mapDbRowToObra,
	sanitizeColumns,
	type DbObraRow,
} from "./page-data";

export type ObraDetailInitialData = {
	obra: Obra | null;
	mainTableColumnsConfig: ExcelPageMainTableColumnConfig[] | null;
};

const EMPTY_RESULT: ObraDetailInitialData = {
	obra: null,
	mainTableColumnsConfig: null,
};

/**
 * Server-side prefetch for the obra detail page. Mirrors the auth checks and
 * query of GET /api/obras/[id] so the client can hydrate React Query without
 * an extra round trip after hydration. Returns nulls on any failure — the
 * client-side query remains the fallback path.
 */
export async function getObraDetailInitialData(
	obraId: string,
): Promise<ObraDetailInitialData> {
	if (!obraId || obraId === "undefined") return EMPTY_RESULT;

	try {
		const access = await resolveRequestAccessContext();
		const { supabase, user, tenantId, actorType } = access;

		if ((!user && actorType !== "demo") || !tenantId) return EMPTY_RESULT;
		if (
			actorType === "demo" &&
			!hasAnyDemoCapability(access.demoSession, ["dashboard", "excel"])
		) {
			return EMPTY_RESULT;
		}

		const [configResult, obraResult] = await Promise.all([
			supabase
				.from("tenant_main_table_configs")
				.select("columns")
				.eq("tenant_id", tenantId)
				.maybeSingle(),
			supabase
				.from("obras")
				.select(CONFIG_COLUMNS)
				.eq("id", obraId)
				.eq("tenant_id", tenantId)
				.is("deleted_at", null)
				.maybeSingle<DbObraRow>(),
		]);

		let { data, error } = obraResult;

		if (error && error.code === "42703") {
			const fallback = await supabase
				.from("obras")
				.select(BASE_COLUMNS)
				.eq("id", obraId)
				.eq("tenant_id", tenantId)
				.is("deleted_at", null)
				.maybeSingle<DbObraRow>();
			data = fallback.data;
			error = fallback.error;

			if (error && error.code === "42703") {
				const legacy = await supabase
					.from("obras")
					.select(LEGACY_BASE_COLUMNS)
					.eq("id", obraId)
					.eq("tenant_id", tenantId)
					.is("deleted_at", null)
					.maybeSingle<DbObraRow>();
				data = legacy.data;
				error = legacy.error;
			}
		}

		if (error) {
			console.warn("[excel/obra-detail-data] failed to prefetch obra", {
				code: error.code,
				message: error.message,
			});
		}

		return {
			obra: data && !error ? (mapDbRowToObra(data) as Obra) : null,
			mainTableColumnsConfig: sanitizeColumns(
				(configResult.data as { columns?: unknown } | null)?.columns ?? [],
			),
		};
	} catch (error) {
		console.warn("[excel/obra-detail-data] unexpected prefetch error", error);
		return EMPTY_RESULT;
	}
}
