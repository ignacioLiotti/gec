import type { ExcelPageMainTableColumnConfig } from "@/lib/excel/types";
import { sanitizeMainTableSelectOptions } from "@/lib/main-table-select";
import {
	hasDemoCapability,
	resolveRequestAccessContext,
} from "@/lib/demo-session";

const BASE_COLUMNS =
	"id, n, designacion_y_ubicacion, sup_de_obra_m2, entidad_contratante, mes_basico_de_contrato, iniciacion, contrato_mas_ampliaciones, certificado_a_la_fecha, saldo_a_certificar, segun_contrato, prorrogas_acordadas, plazo_total, plazo_transc, porcentaje, updated_at, custom_data";
const LEGACY_BASE_COLUMNS =
	"id, n, designacion_y_ubicacion, sup_de_obra_m2, entidad_contratante, mes_basico_de_contrato, iniciacion, contrato_mas_ampliaciones, certificado_a_la_fecha, saldo_a_certificar, segun_contrato, prorrogas_acordadas, plazo_total, plazo_transc, porcentaje, updated_at";
const CONFIG_COLUMNS = `${BASE_COLUMNS}, on_finish_first_message, on_finish_second_message, on_finish_second_send_at`;
const PREVIEW_COLUMNS = "id, n, designacion_y_ubicacion";

type DbObraRow = {
	id: string;
	n: number;
	designacion_y_ubicacion: string;
	sup_de_obra_m2: number | string;
	entidad_contratante: string;
	mes_basico_de_contrato: string;
	iniciacion: string;
	contrato_mas_ampliaciones: number | string;
	certificado_a_la_fecha: number | string;
	saldo_a_certificar: number | string;
	segun_contrato: number | string;
	prorrogas_acordadas: number | string;
	plazo_total: number | string;
	plazo_transc: number | string;
	porcentaje: number | string;
	updated_at?: string | null;
	custom_data?: Record<string, unknown> | null;
	on_finish_first_message?: string | null;
	on_finish_second_message?: string | null;
	on_finish_second_send_at?: string | null;
};

type DbObraPreviewRow = {
	id: string;
	n: number;
	designacion_y_ubicacion: string;
};

function mapDbRowToObra(row: DbObraRow) {
	return {
		id: row.id,
		n: row.n,
		designacionYUbicacion: row.designacion_y_ubicacion,
		__isPartial: false,
		supDeObraM2: Number(row.sup_de_obra_m2) || 0,
		entidadContratante: row.entidad_contratante,
		mesBasicoDeContrato: row.mes_basico_de_contrato,
		iniciacion: row.iniciacion,
		contratoMasAmpliaciones: Number(row.contrato_mas_ampliaciones) || 0,
		certificadoALaFecha: Number(row.certificado_a_la_fecha) || 0,
		saldoACertificar: Number(row.saldo_a_certificar) || 0,
		segunContrato: Number(row.segun_contrato) || 0,
		prorrogasAcordadas: Number(row.prorrogas_acordadas) || 0,
		plazoTotal: Number(row.plazo_total) || 0,
		plazoTransc: Number(row.plazo_transc) || 0,
		porcentaje: Number(row.porcentaje) || 0,
		updatedAt: row.updated_at ?? null,
		customData:
			row.custom_data &&
			typeof row.custom_data === "object" &&
			!Array.isArray(row.custom_data)
				? row.custom_data
				: {},
		onFinishFirstMessage: row.on_finish_first_message ?? null,
		onFinishSecondMessage: row.on_finish_second_message ?? null,
		onFinishSecondSendAt: row.on_finish_second_send_at ?? null,
	};
}

function mapDbPreviewRowToObra(row: DbObraPreviewRow) {
	return {
		id: row.id,
		n: row.n,
		designacionYUbicacion: row.designacion_y_ubicacion,
		__isPartial: true,
	};
}

function sanitizeColumns(raw: unknown): ExcelPageMainTableColumnConfig[] {
	if (!Array.isArray(raw)) return [];
	const next: ExcelPageMainTableColumnConfig[] = [];
	for (const item of raw) {
		if (!item || typeof item !== "object") continue;
		const row = item as Record<string, unknown>;
		const id = typeof row.id === "string" ? row.id.trim() : "";
		const label = typeof row.label === "string" ? row.label.trim() : "";
		if (!id || !label) continue;
		const kind =
			row.kind === "formula" || row.kind === "custom" ? row.kind : "base";
		const sanitizedCellType =
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
			row.cellType === "badge" ||
			row.cellType === "select"
				? row.cellType
				: undefined;
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
				typeof row.baseColumnId === "string"
					? row.baseColumnId.trim()
					: undefined,
			formula:
				typeof row.formula === "string" ? row.formula.trim() : undefined,
			formulaFormat:
				row.formulaFormat === "currency" || row.formulaFormat === "number"
					? row.formulaFormat
					: undefined,
			cellType: sanitizedCellType,
			selectOptions:
				sanitizedCellType === "select"
					? sanitizeMainTableSelectOptions(row.selectOptions)
					: undefined,
			required:
				typeof row.required === "boolean" ? row.required : undefined,
			editable:
				typeof row.editable === "boolean" ? row.editable : undefined,
			enableHide:
				typeof row.enableHide === "boolean" ? row.enableHide : undefined,
			enablePin:
				typeof row.enablePin === "boolean" ? row.enablePin : undefined,
			enableSort:
				typeof row.enableSort === "boolean" ? row.enableSort : undefined,
			enableResize:
				typeof row.enableResize === "boolean" ? row.enableResize : undefined,
			enableSuggestions:
				typeof row.enableSuggestions === "boolean"
					? row.enableSuggestions
					: undefined,
		});
	}
	return next;
}

async function getTenantId() {
	const access = await resolveRequestAccessContext();
	return {
		supabase: access.supabase,
		user: access.user,
		tenantId: access.tenantId,
		actorType: access.actorType,
	};
}

export async function getExcelPageInitialData(options?: {
	previewOnly?: boolean;
}) {
	const access = await resolveRequestAccessContext();
	const { supabase, user, tenantId, actorType } = access;
	const previewOnly = options?.previewOnly === true;

	if ((!user && actorType !== "demo") || !tenantId) {
		return {
			mainTableColumnsConfig: [] as ExcelPageMainTableColumnConfig[],
			obras: [],
		};
	}
	if (actorType === "demo" && !hasDemoCapability(access.demoSession, "excel")) {
		return {
			mainTableColumnsConfig: [] as ExcelPageMainTableColumnConfig[],
			obras: [],
		};
	}

	const [{ data: configData }, obrasResult] = await Promise.all([
		supabase
			.from("tenant_main_table_configs")
			.select("columns")
			.eq("tenant_id", tenantId)
			.maybeSingle(),
		previewOnly
			? supabase
				.from("obras")
				.select(PREVIEW_COLUMNS)
				.eq("tenant_id", tenantId)
				.is("deleted_at", null)
				.order("n", { ascending: true })
			: supabase
				.from("obras")
				.select(CONFIG_COLUMNS)
				.eq("tenant_id", tenantId)
				.is("deleted_at", null)
				.order("n", { ascending: true }),
	]);

	if (previewOnly) {
		if (obrasResult.error) {
			console.error("[excel/page-data] failed to fetch obra preview", obrasResult.error);
		}

		return {
			mainTableColumnsConfig: sanitizeColumns(
				(configData as { columns?: unknown } | null)?.columns ?? [],
			),
			obras: (((obrasResult.data as DbObraPreviewRow[] | null) ?? []) as DbObraPreviewRow[]).map(
				mapDbPreviewRowToObra,
			),
		};
	}

	let obrasData = (obrasResult.data as DbObraRow[] | null) ?? null;
	let obrasError = obrasResult.error;

	if (obrasError && obrasError.code === "42703") {
		const fallbackBase = await supabase
			.from("obras")
			.select(BASE_COLUMNS)
			.eq("tenant_id", tenantId)
			.is("deleted_at", null)
			.order("n", { ascending: true });

		obrasData = (fallbackBase.data as DbObraRow[] | null) ?? null;
		obrasError = fallbackBase.error;

		if (obrasError && obrasError.code === "42703") {
			const fallbackLegacy = await supabase
				.from("obras")
				.select(LEGACY_BASE_COLUMNS)
				.eq("tenant_id", tenantId)
				.is("deleted_at", null)
				.order("n", { ascending: true });

			obrasData = (fallbackLegacy.data as DbObraRow[] | null) ?? null;
			obrasError = fallbackLegacy.error;
		}
	}

	if (obrasError) {
		console.error("[excel/page-data] failed to fetch obras", obrasError);
	}

	return {
		mainTableColumnsConfig: sanitizeColumns(
			(configData as { columns?: unknown } | null)?.columns ?? [],
		),
		obras: ((obrasData ?? []) as DbObraRow[]).map(mapDbRowToObra),
	};
}
