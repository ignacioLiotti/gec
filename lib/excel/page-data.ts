import { cookies } from "next/headers";
import type { ExcelPageMainTableColumnConfig } from "@/lib/excel/types";
import { ACTIVE_TENANT_COOKIE } from "@/lib/tenant-selection";
import { createClient } from "@/utils/supabase/server";

const BASE_COLUMNS =
  "id, n, designacion_y_ubicacion, sup_de_obra_m2, entidad_contratante, mes_basico_de_contrato, iniciacion, contrato_mas_ampliaciones, certificado_a_la_fecha, saldo_a_certificar, segun_contrato, prorrogas_acordadas, plazo_total, plazo_transc, porcentaje, updated_at, custom_data";
const LEGACY_BASE_COLUMNS =
  "id, n, designacion_y_ubicacion, sup_de_obra_m2, entidad_contratante, mes_basico_de_contrato, iniciacion, contrato_mas_ampliaciones, certificado_a_la_fecha, saldo_a_certificar, segun_contrato, prorrogas_acordadas, plazo_total, plazo_transc, porcentaje, updated_at";
const CONFIG_COLUMNS = `${BASE_COLUMNS}, on_finish_first_message, on_finish_second_message, on_finish_second_send_at`;

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

function mapDbRowToObra(row: DbObraRow) {
  return {
    id: row.id,
    n: row.n,
    designacionYUbicacion: row.designacion_y_ubicacion,
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

function sanitizeColumns(raw: unknown): ExcelPageMainTableColumnConfig[] {
  if (!Array.isArray(raw)) return [];
  const next: ExcelPageMainTableColumnConfig[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const id = typeof row.id === "string" ? row.id.trim() : "";
    const label = typeof row.label === "string" ? row.label.trim() : "";
    if (!id || !label) continue;
    const kind = row.kind === "formula" || row.kind === "custom" ? row.kind : "base";
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
      enableResize: typeof row.enableResize === "boolean" ? row.enableResize : undefined,
    });
  }
  return next;
}

async function getTenantId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, user: null, tenantId: null as string | null };
  }

  const cookieStore = await cookies();
  const preferredTenantId = cookieStore.get(ACTIVE_TENANT_COOKIE)?.value;

  let membership: { tenant_id: string | null } | null = null;

  if (preferredTenantId) {
    const preferred = await supabase
      .from("memberships")
      .select("tenant_id")
      .eq("user_id", user.id)
      .eq("tenant_id", preferredTenantId)
      .limit(1)
      .maybeSingle();
    membership = (preferred.data as { tenant_id: string | null } | null) ?? null;
  }

  if (!membership) {
    const fallback = await supabase
      .from("memberships")
      .select("tenant_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    membership = (fallback.data as { tenant_id: string | null } | null) ?? null;
  }

  return {
    supabase,
    user,
    tenantId: membership?.tenant_id ?? null,
  };
}

export async function getExcelPageInitialData() {
  const { supabase, user, tenantId } = await getTenantId();

  if (!user || !tenantId) {
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
    supabase
      .from("obras")
      .select(CONFIG_COLUMNS)
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .order("n", { ascending: true }),
  ]);

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
      (configData as { columns?: unknown } | null)?.columns ?? []
    ),
    obras: ((obrasData ?? []) as DbObraRow[]).map(mapDbRowToObra),
  };
}
