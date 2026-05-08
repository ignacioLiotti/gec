/**
 * Obra Query Functions
 * 
 * Centralized data fetching functions for obra-related data.
 * These are used with React Query for caching and data management.
 */

import type { Obra } from "@/app/excel/schema";
import type {
  Certificate,
  MaterialOrder,
  MaterialItem,
  ObraRole,
  ObraUser,
  ObraUserRole,
  FlujoAction,
} from "@/app/excel/[obraId]/tabs/types";
import type { OcrFolderLink } from "@/app/excel/[obraId]/tabs/file-manager/types";

// =============================================================================
// Types
// =============================================================================

export type MemoriaNote = {
  id: string;
  text: string;
  createdAt: string;
  userId: string;
  userName: string | null;
};

export type DataFlowSuggestion = {
  id: string;
  field_id: string;
  result_label: string;
  old_value: unknown;
  suggested_value: unknown;
  formatted_value: string | null;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
};

export type DerivedCertificadosNotice = {
  sourceLabel: string | null;
  updatedFieldKeys: Array<"certificadoALaFecha" | "saldoACertificar" | "porcentaje">;
  updatedFieldLabels: string[];
  recommendedValues: Partial<Record<DerivedCertificadosField, number>>;
  blockedFieldKeys: Array<"saldoACertificar" | "porcentaje">;
  blockedFieldLabels: string[];
  warningMessage: string | null;
};

export type DerivedCertificadosField =
  | "certificadoALaFecha"
  | "saldoACertificar"
  | "porcentaje";

export type PendingDoc = {
  id: string;
  name: string;
  poliza: string;
  dueMode: "fixed" | "after_completion";
  dueDate: string;
  offsetDays: number;
  done: boolean;
};

export type ReportFinding = {
  id: string;
  rule_key: string;
  severity: "info" | "warn" | "critical";
  title: string;
  message: string | null;
  created_at: string;
};

export type TablaRowRecord = {
  id: string;
  data: Record<string, unknown>;
  created_at?: string;
};

export type GeneralReportCurvePoint = {
  label: string;
  planPct: number | null;
  realPct: number | null;
  sortOrder: number;
  periodKey?: string | null;
};

export type GeneralTabReportsData = {
  findings: ReportFinding[];
  curve: {
    points: GeneralReportCurvePoint[];
    planTableName: string;
    resumenTableName: string;
  } | null;
};

export type MacroTableListItem = {
  id: string;
  name: string;
};

export type MacroTableColumnItem = {
  id: string;
  label: string;
  sourceFieldKey?: string | null;
};

export type MacroTableRowItem = {
  id: string;
  _obraId?: unknown;
  [key: string]: unknown;
};

// =============================================================================
// Query Keys Factory
// =============================================================================

export const obraQueryKeys = {
  all: ["obra"] as const,
  detail: (obraId: string) => ["obra", "detail", obraId] as const,
  dataFlowSuggestions: (obraId: string) => ["obra", "data-flow-suggestions", obraId] as const,
  memoriaNotes: (obraId: string) => ["obra", "memoria", obraId] as const,
  materialOrders: (obraId: string) => ["obra", "materials", obraId] as const,
  certificates: (obraId: string) => ["obra", "certificates", obraId] as const,
  ocrLinks: (obraId: string) => ["obra", "ocr-links", obraId] as const,
  recipients: (obraId: string) => ["obra", "recipients", obraId] as const,
  flujoActions: (obraId: string) => ["obra", "flujo-actions", obraId] as const,
  pendingDocs: (obraId: string) => ["obra", "pending-docs", obraId] as const,
  reports: (obraId: string) => ["obra", "reports", obraId] as const,
  macroTables: () => ["macro-tables"] as const,
  macroTableRows: (tableId: string, obraId?: string) => 
    ["macro-tables", tableId, "rows", obraId] as const,
};

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Normalize string for search (remove diacritics, lowercase)
 * Used for efficient filtering without repeated normalization
 */
export function normalizeForSearch(v: string): string {
  return v.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/**
 * Normalize macro table name for comparison
 */
export function normalizeMacroTableName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Check if a macro table name indicates it's a "Certificado Contable" table
 */
export function isCertificadoContableMacroTable(name: string): boolean {
  const normalized = normalizeMacroTableName(name);
  return (
    normalized === "certificado contable" ||
    normalized === "certificados contable" ||
    (normalized.includes("certificado") && normalized.includes("contable"))
  );
}

// =============================================================================
// Query Functions
// =============================================================================

/**
 * Fetch obra detail by ID
 */
export async function fetchObraDetail(obraId: string): Promise<Obra> {
  const response = await fetch(`/api/obras/${obraId}`);
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.error ?? "No se pudo cargar la obra");
  }
  const data = await response.json();
  return data.obra as Obra;
}

/**
 * Fetch data flow suggestions for an obra
 */
export async function fetchDataFlowSuggestions(obraId: string): Promise<DataFlowSuggestion[]> {
  const response = await fetch(`/api/obras/${obraId}/data-flow-suggestions`);
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.error ?? "No se pudieron cargar las solicitudes de data-flow");
  }
  const data = await response.json().catch(() => ({}));
  return Array.isArray(data?.suggestions) ? (data.suggestions as DataFlowSuggestion[]) : [];
}

/**
 * Fetch memoria notes for an obra
 */
export async function fetchMemoriaNotes(obraId: string): Promise<MemoriaNote[]> {
  const res = await fetch(`/api/obras/${obraId}/memoria`);
  if (!res.ok) return [];
  const out = await res.json();
  const items = Array.isArray(out?.notes) ? out.notes : [];
  return items.map((n: Record<string, unknown>) => ({
    id: String(n.id),
    text: String(n.text ?? ""),
    createdAt: String(n.createdAt ?? n.created_at ?? ""),
    userId: String(n.userId ?? n.user_id ?? ""),
    userName: typeof n.userName === "string" ? n.userName : (n.user_name as string | null) ?? null,
  }));
}

/**
 * Fetch material orders for an obra
 * Pre-normalizes searchable fields for efficient filtering
 */
export async function fetchMaterialOrders(obraId: string): Promise<MaterialOrder[]> {
  const res = await fetch(`/api/obras/${obraId}/materials`);
  if (!res.ok) return [];
  const data = await res.json();
  const orders = (data?.orders || []) as Array<Record<string, unknown>>;
  
  return orders.map((o) => {
    const nroOrden = String(o.nroOrden || o.id);
    const fecha = String(o.fecha || "");
    const solicitante = String(o.solicitante || "");
    const proveedor = String(o.proveedor || "");
    const items = (o.items || []) as Array<Record<string, unknown>>;
    
    return {
      id: String(o.id),
      nroOrden,
      fecha,
      solicitante,
      proveedor,
      docPath: o.docPath as string | undefined,
      docBucket: o.docBucket as string | undefined,
      // Pre-normalized for efficient filtering
      _nroOrdenNorm: normalizeForSearch(nroOrden),
      _fechaNorm: normalizeForSearch(fecha),
      _solicitanteNorm: normalizeForSearch(solicitante),
      _proveedorNorm: normalizeForSearch(proveedor),
      items: items.map((it, idx) => {
        const unidad = String(it.unidad || "");
        const material = String(it.material || "");
        return {
          id: `${o.id}-i-${idx}`,
          cantidad: Number(it.cantidad || 0),
          unidad,
          material,
          precioUnitario: Number(it.precioUnitario || 0),
          // Pre-normalized for efficient filtering
          _unidadNorm: normalizeForSearch(unidad),
          _materialNorm: normalizeForSearch(material),
        } as MaterialItem;
      }),
    } as MaterialOrder;
  });
}

/**
 * Fetch certificates for an obra
 */
export async function fetchCertificates(obraId: string): Promise<{ certificates: Certificate[]; total: number }> {
  const response = await fetch(`/api/obras/${obraId}/certificates`);
  if (!response.ok) {
    throw new Error("Failed to load certificates");
  }
  const data = await response.json();
  return { certificates: data.certificates || [], total: data.total || 0 };
}

/**
 * Fetch OCR folder links for an obra
 */
export async function fetchOcrLinks(obraId: string): Promise<OcrFolderLink[]> {
  const response = await fetch(`/api/obras/${obraId}/tablas/ocr-links?limit=500`);
  if (!response.ok) {
    throw new Error("Failed to load OCR links");
  }
  const data = await response.json().catch(() => ({}));
  return Array.isArray(data?.links) ? (data.links as OcrFolderLink[]) : [];
}

/**
 * Fetch obra recipients (roles, users, userRoles)
 */
export async function fetchObraRecipients(obraId: string): Promise<{
  roles: ObraRole[];
  users: ObraUser[];
  userRoles: ObraUserRole[];
}> {
  const res = await fetch(`/api/obra-recipients?obraId=${obraId}`);
  if (!res.ok) return { roles: [], users: [], userRoles: [] };
  const data = await res.json();
  return {
    roles: data.roles ?? [],
    users: data.users ?? [],
    userRoles: data.userRoles ?? [],
  };
}

/**
 * Fetch flujo actions for an obra
 */
export async function fetchFlujoActions(obraId: string): Promise<FlujoAction[]> {
  const res = await fetch(`/api/flujo-actions?obraId=${obraId}`);
  if (!res.ok) throw new Error("Failed to load flujo actions");
  const data = await res.json();
  return data.actions || [];
}

/**
 * Fetch pending documents for an obra
 */
export async function fetchPendingDocs(obraId: string): Promise<PendingDoc[]> {
  const res = await fetch(`/api/obras/${obraId}/pendientes`);
  if (!res.ok) return [];
  const data = await res.json();
  const items = data?.pendientes || [];
  return items.map((p: Record<string, unknown>) => ({
    id: String(p.id),
    name: String(p.name ?? ""),
    poliza: String(p.poliza ?? ""),
    dueMode: (p.dueMode ?? "fixed") as "fixed" | "after_completion",
    dueDate: String(p.dueDate ?? ""),
    offsetDays: Number(p.offsetDays ?? 0),
    done: Boolean(p.done ?? false),
  }));
}

/**
 * Fetch macro tables list
 */
export async function fetchMacroTablesList(): Promise<MacroTableListItem[]> {
  const response = await fetch("/api/macro-tables");
  if (!response.ok) {
    throw new Error("Failed to load macro tables");
  }
  const data = await response.json();
  return Array.isArray(data?.macroTables) ? (data.macroTables as MacroTableListItem[]) : [];
}

/**
 * Fetch all rows from a macro table, handling pagination
 */
export async function fetchAllMacroTableRows(
  macroTableId: string,
  obraId?: string
): Promise<{
  columns: MacroTableColumnItem[];
  rows: MacroTableRowItem[];
}> {
  const rows: MacroTableRowItem[] = [];
  let columns: MacroTableColumnItem[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const params = new URLSearchParams({
      page: String(page),
      limit: "200",
    });
    if (obraId) {
      params.set("obraId", obraId);
    }
    const response = await fetch(
      `/api/macro-tables/${encodeURIComponent(macroTableId)}/rows?${params.toString()}`
    );
    if (!response.ok) {
      throw new Error("Failed to load macro table rows");
    }
    const data = await response.json();
    if (page === 1 && Array.isArray(data?.columns)) {
      columns = data.columns as MacroTableColumnItem[];
    }
    if (Array.isArray(data?.rows)) {
      rows.push(...(data.rows as MacroTableRowItem[]));
    }
    totalPages = Math.max(1, Number(data?.pagination?.totalPages ?? 1));
    page += 1;
  } while (page <= totalPages);

  return { columns, rows };
}

/**
 * Fetch general tab reports data for an obra
 */
export async function fetchGeneralReportsData(obraId: string): Promise<GeneralTabReportsData> {
  const res = await fetch(`/api/obras/${obraId}/reports`);
  if (!res.ok) {
    return { findings: [], curve: null };
  }
  const data = await res.json();
  return {
    findings: data.findings ?? [],
    curve: data.curve ?? null,
  };
}
