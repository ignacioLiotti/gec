import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { ACTIVE_TENANT_COOKIE } from "@/lib/tenant-selection";
import type { MainTableColumnConfig } from "@/components/form-table/configs/obras-detalle";

async function getTenantContext() {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) return { supabase, user: null, tenantId: null, role: null };

	const cookieStore = await cookies();
	const preferredTenantId = cookieStore.get(ACTIVE_TENANT_COOKIE)?.value ?? null;

	let membership: { tenant_id: string | null; role: string | null } | null = null;

	if (preferredTenantId) {
		const preferred = await supabase
			.from("memberships")
			.select("tenant_id, role")
			.eq("user_id", user.id)
			.eq("tenant_id", preferredTenantId)
			.limit(1)
			.maybeSingle();
		membership =
			(preferred.data as { tenant_id: string | null; role: string | null } | null) ??
			null;
	}

	if (!membership) {
		const fallback = await supabase
			.from("memberships")
			.select("tenant_id, role")
			.eq("user_id", user.id)
			.order("created_at", { ascending: true })
			.limit(1)
			.maybeSingle();
		membership =
			(fallback.data as { tenant_id: string | null; role: string | null } | null) ??
			null;
	}

	return {
		supabase,
		user,
		tenantId: membership?.tenant_id ?? null,
		role: membership?.role ?? null,
	};
}

function sanitizeColumns(raw: unknown): MainTableColumnConfig[] {
	if (!Array.isArray(raw)) return [];
	const next: MainTableColumnConfig[] = [];
	for (const item of raw) {
		if (!item || typeof item !== "object") continue;
		const row = item as Record<string, unknown>;
		const id = typeof row.id === "string" ? row.id.trim() : "";
		const label = typeof row.label === "string" ? row.label.trim() : "";
		if (!id || !label) continue;
		const kind =
			row.kind === "formula" || row.kind === "custom"
				? row.kind
				: "base";
		next.push({
			id,
			kind,
			label,
			enabled: row.enabled !== false,
			width:
				typeof row.width === "number" && Number.isFinite(row.width)
					? Math.max(60, Math.min(600, Math.round(row.width)))
					: undefined,
			baseColumnId:
				typeof row.baseColumnId === "string" ? row.baseColumnId.trim() : undefined,
			formula: typeof row.formula === "string" ? row.formula.trim() : undefined,
			formulaFormat:
				row.formulaFormat === "currency" || row.formulaFormat === "number"
					? row.formulaFormat
					: undefined,
			cellType:
				row.cellType === "text" ||
				row.cellType === "number" ||
				row.cellType === "currency" ||
				row.cellType === "date" ||
				row.cellType === "boolean" ||
				row.cellType === "checkbox" ||
				row.cellType === "toggle" ||
				row.cellType === "tags" ||
				row.cellType === "link" ||
				row.cellType === "avatar" ||
				row.cellType === "image" ||
				row.cellType === "icon" ||
				row.cellType === "text-icon" ||
				row.cellType === "badge"
					? row.cellType
					: undefined,
			required: typeof row.required === "boolean" ? row.required : undefined,
			editable: typeof row.editable === "boolean" ? row.editable : undefined,
			enableHide: typeof row.enableHide === "boolean" ? row.enableHide : undefined,
			enablePin: typeof row.enablePin === "boolean" ? row.enablePin : undefined,
			enableSort: typeof row.enableSort === "boolean" ? row.enableSort : undefined,
			enableResize:
				typeof row.enableResize === "boolean" ? row.enableResize : undefined,
		});
	}
	return next;
}

export async function GET() {
	const { supabase, user, tenantId } = await getTenantContext();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	if (!tenantId) return NextResponse.json({ columns: [] });

	const { data, error } = await supabase
		.from("tenant_main_table_configs")
		.select("columns")
		.eq("tenant_id", tenantId)
		.maybeSingle();

	if (error) {
		console.error("[main-table-config:get] error", error);
		return NextResponse.json({ error: "No se pudo leer la configuración" }, { status: 500 });
	}

	return NextResponse.json({
		columns: sanitizeColumns((data as { columns?: unknown } | null)?.columns ?? []),
	});
}

export async function PUT(request: Request) {
	const { supabase, user, tenantId, role } = await getTenantContext();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	if (!tenantId) return NextResponse.json({ error: "Tenant no encontrado" }, { status: 400 });

	const isAdmin = role === "owner" || role === "admin";
	if (!isAdmin) {
		return NextResponse.json({ error: "No autorizado para editar configuración" }, { status: 403 });
	}

	const body = await request.json().catch(() => ({}));
	const columns = sanitizeColumns((body as { columns?: unknown })?.columns ?? []);

	const { error } = await supabase.from("tenant_main_table_configs").upsert(
		{
			tenant_id: tenantId,
			columns,
			updated_by: user.id,
		},
		{ onConflict: "tenant_id" }
	);

	if (error) {
		console.error("[main-table-config:put] error", error);
		return NextResponse.json({ error: "No se pudo guardar la configuración" }, { status: 500 });
	}

	return NextResponse.json({ ok: true, columns });
}
