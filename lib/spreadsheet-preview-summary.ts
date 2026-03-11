export type SpreadsheetPreviewSectionType =
  | "pmc_resumen"
  | "pmc_items"
  | "curva_plan"
  | "generic";

export type SpreadsheetPreviewStatus = "ready" | "review" | "empty";

export type SpreadsheetPreviewInsight = {
  sectionType: SpreadsheetPreviewSectionType;
  status: SpreadsheetPreviewStatus;
  statusReason: string | null;
  includedByDefault: boolean;
  sampleColumns: string[];
  sampleRows: Record<string, unknown>[];
  keyFieldCoverage: Record<string, boolean>;
  sourceLabel: string;
  warnings: string[];
};

export type SpreadsheetPreviewSummary = {
  totalSections: number;
  readySections: number;
  reviewSections: number;
  emptySections: number;
  totalRows: number;
  canImportAll: boolean;
};

type PreviewInsightInput = {
  sectionType: SpreadsheetPreviewSectionType;
  inserted: number;
  sheetName: string | null;
  previewRows: Record<string, unknown>[];
  mappings?: Array<{ dbColumn: string; label: string; excelHeader: string | null }>;
};

function buildSourceLabel(
  sectionType: SpreadsheetPreviewSectionType,
  sheetName: string | null
): string {
  if (!sheetName) return "Hoja de origen no detectada";

  if (sectionType === "curva_plan") {
    return "Hoja de origen: Plan de trab. y curv";
  }

  return `Hoja de origen: ${sheetName}`;
}

const SECTION_META: Record<
  SpreadsheetPreviewSectionType,
  { description: string; sampleColumns: string[]; maxRows: number; sortOrder: number }
> = {
  pmc_resumen: {
    description: "Resumen del certificado",
    sampleColumns: [
      "periodo",
      "nro_certificado",
      "fecha_certificacion",
      "monto_certificado",
      "avance_fisico_acumulado_pct",
      "monto_acumulado",
    ],
    maxRows: 1,
    sortOrder: 0,
  },
  pmc_items: {
    description: "Detalle por items",
    sampleColumns: [
      "item_code",
      "descripcion",
      "monto_rubro",
      "avance_acumulado_pct",
    ],
    maxRows: 3,
    sortOrder: 1,
  },
  curva_plan: {
    description: "Curva mensual",
    sampleColumns: [
      "periodo",
      "avance_mensual_pct",
      "avance_acumulado_pct",
    ],
    maxRows: 4,
    sortOrder: 2,
  },
  generic: {
    description: "Datos detectados",
    sampleColumns: [],
    maxRows: 3,
    sortOrder: 3,
  },
};

function isFilled(value: unknown): boolean {
  if (value == null) return false;
  const text = String(value).trim();
  return text.length > 0 && text !== "-";
}

function isNumericLike(value: unknown): boolean {
  if (!isFilled(value)) return false;
  const text = String(value).trim();
  const normalized = text.replace(/[$%\s]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const number = Number.parseFloat(normalized);
  return Number.isFinite(number);
}

function isDateLike(value: unknown): boolean {
  if (!isFilled(value)) return false;
  const text = String(value).trim();
  if (/\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/.test(text)) return true;
  return !Number.isNaN(Date.parse(text));
}

function isCertificateNumberLike(value: unknown): boolean {
  if (!isFilled(value)) return false;
  const text = String(value).trim();
  if (text.includes("$") || text.includes("%")) return false;
  return /\d/.test(text);
}

function getFieldFillRatio(rows: Record<string, unknown>[], fieldKey: string): number {
  if (rows.length === 0) return 0;
  const filled = rows.filter((row) => isFilled(row[fieldKey])).length;
  return filled / rows.length;
}

function projectRows(rows: Record<string, unknown>[], columns: string[], maxRows: number) {
  return rows.slice(0, maxRows).map((row) =>
    Object.fromEntries(columns.map((column) => [column, row[column] ?? null]))
  );
}

function buildGenericSampleColumns(
  rows: Record<string, unknown>[],
  mappings?: Array<{ dbColumn: string; label: string; excelHeader: string | null }>
): string[] {
  if (mappings && mappings.length > 0) {
    const mappedColumns = mappings
      .filter((mapping) => rows.some((row) => isFilled(row[mapping.dbColumn])))
      .map((mapping) => mapping.dbColumn);
    if (mappedColumns.length > 0) return mappedColumns.slice(0, 4);
  }

  const firstRow = rows[0] ?? {};
  return Object.keys(firstRow)
    .filter((key) => !key.startsWith("__doc"))
    .slice(0, 4);
}

function buildStatusForResumen(rows: Record<string, unknown>[]) {
  if (rows.length === 0) {
    return {
      status: "empty" as const,
      warnings: ["No encontramos un resumen util para importar."],
    };
  }

  const row = rows[0] ?? {};
  const coverage = {
    periodo: isFilled(row.periodo),
    nro_certificado: isCertificateNumberLike(row.nro_certificado),
    fecha_certificacion: isDateLike(row.fecha_certificacion),
    monto_certificado: isNumericLike(row.monto_certificado),
    avance_fisico_acumulado_pct: isNumericLike(row.avance_fisico_acumulado_pct),
    monto_acumulado: isNumericLike(row.monto_acumulado),
  };

  const warnings: string[] = [];
  const filledCount = Object.values(coverage).filter(Boolean).length;
  if (!coverage.nro_certificado) warnings.push("No encontramos el N° de certificado.");
  if (!coverage.monto_certificado) warnings.push("No encontramos el monto certificado.");
  if (!coverage.periodo && !coverage.fecha_certificacion) {
    warnings.push("La fila resumen parece incompleta.");
  }
  if (filledCount <= 2) {
    warnings.push("Se detecto un resumen, pero conviene revisarlo.");
  }

  return {
    status: warnings.length > 0 ? ("review" as const) : ("ready" as const),
    warnings,
    coverage,
  };
}

function buildStatusForItems(rows: Record<string, unknown>[]) {
  if (rows.length === 0) {
    return {
      status: "empty" as const,
      warnings: ["No encontramos items utiles para importar."],
    };
  }

  const coverage = {
    item_code: getFieldFillRatio(rows, "item_code") >= 0.4,
    descripcion: getFieldFillRatio(rows, "descripcion") >= 0.6,
    monto_rubro: getFieldFillRatio(rows, "monto_rubro") >= 0.6,
    avance_acumulado_pct: getFieldFillRatio(rows, "avance_acumulado_pct") >= 0.4,
  };

  const warnings: string[] = [];
  if (!coverage.descripcion || !coverage.monto_rubro) {
    warnings.push("Se detectaron filas, pero faltan columnas clave.");
  }
  if (!coverage.item_code && !coverage.descripcion) {
    warnings.push("Los items parecen incompletos.");
  }
  if (warnings.length === 0 && rows.length <= 1) {
    warnings.push("La tabla encontrada no coincide del todo con el detalle esperado.");
  }

  return {
    status: warnings.length > 0 ? ("review" as const) : ("ready" as const),
    warnings,
    coverage,
  };
}

function buildStatusForCurva(rows: Record<string, unknown>[]) {
  if (rows.length === 0) {
    return {
      status: "empty" as const,
      warnings: ["No encontramos la curva mensual esperada."],
    };
  }

  const coverage = {
    periodo: getFieldFillRatio(rows, "periodo") >= 0.8,
    avance_mensual_pct:
      rows.length > 0 &&
      rows.filter((row) => isNumericLike(row.avance_mensual_pct)).length / rows.length >= 0.6,
    avance_acumulado_pct:
      rows.length > 0 &&
      rows.filter((row) => isNumericLike(row.avance_acumulado_pct)).length / rows.length >= 0.6,
  };

  const warnings: string[] = [];
  if (!coverage.avance_mensual_pct) warnings.push("Se detectaron meses, pero faltan avances.");
  if (!coverage.avance_acumulado_pct) warnings.push("Conviene revisar la extraccion horizontal.");

  return {
    status: warnings.length > 0 ? ("review" as const) : ("ready" as const),
    warnings,
    coverage,
  };
}

function buildGenericStatus(
  rows: Record<string, unknown>[],
  mappings?: Array<{ dbColumn: string; label: string; excelHeader: string | null }>
) {
  if (rows.length === 0) {
    return {
      status: "empty" as const,
      warnings: ["No se detectaron datos utiles."],
      coverage: {} as Record<string, boolean>,
    };
  }

  const mappedCount = mappings?.filter((mapping) => mapping.excelHeader).length ?? 0;
  const totalCount = mappings?.length ?? 0;
  const warnings =
    totalCount > 0 && mappedCount < Math.max(1, Math.ceil(totalCount * 0.5))
      ? ["Se detectaron datos, pero conviene revisarlos."]
      : [];

  return {
    status: warnings.length > 0 ? ("review" as const) : ("ready" as const),
    warnings,
    coverage: {} as Record<string, boolean>,
  };
}

export function resolveSpreadsheetSectionType(params: {
  certTableId?: string | null;
  tablaName?: string | null;
  fieldKeys?: string[];
}): SpreadsheetPreviewSectionType {
  const certTableId = params.certTableId?.trim();
  if (
    certTableId === "pmc_resumen" ||
    certTableId === "pmc_items" ||
    certTableId === "curva_plan"
  ) {
    return certTableId;
  }

  const keys = new Set(params.fieldKeys ?? []);
  if (
    keys.has("periodo") &&
    keys.has("monto_certificado") &&
    keys.has("avance_fisico_acumulado_pct")
  ) {
    return "pmc_resumen";
  }
  if (keys.has("item_code") && keys.has("descripcion") && keys.has("monto_rubro")) {
    return "pmc_items";
  }
  if (
    keys.has("periodo") &&
    keys.has("avance_mensual_pct") &&
    keys.has("avance_acumulado_pct")
  ) {
    return "curva_plan";
  }

  const normalizedName = (params.tablaName ?? "").toLowerCase();
  if (normalizedName.includes("curva")) return "curva_plan";
  if (normalizedName.includes("item")) return "pmc_items";
  if (normalizedName.includes("resumen")) return "pmc_resumen";
  return "generic";
}

export function getSpreadsheetSectionDescription(sectionType: SpreadsheetPreviewSectionType) {
  return SECTION_META[sectionType].description;
}

export function getSpreadsheetSectionSortOrder(sectionType: SpreadsheetPreviewSectionType) {
  return SECTION_META[sectionType].sortOrder;
}

export function buildSpreadsheetPreviewInsight(
  input: PreviewInsightInput
): SpreadsheetPreviewInsight {
  const { sectionType, inserted, sheetName, previewRows, mappings } = input;

  const statusResult =
    sectionType === "pmc_resumen"
      ? buildStatusForResumen(previewRows)
      : sectionType === "pmc_items"
        ? buildStatusForItems(previewRows)
        : sectionType === "curva_plan"
          ? buildStatusForCurva(previewRows)
          : buildGenericStatus(previewRows, mappings);

  const sampleColumns =
    sectionType === "generic"
      ? buildGenericSampleColumns(previewRows, mappings)
      : SECTION_META[sectionType].sampleColumns;
  const sampleRows = projectRows(
    previewRows,
    sampleColumns,
    SECTION_META[sectionType].maxRows
  );
  const status = inserted === 0 ? "empty" : statusResult.status;
  const warnings = inserted === 0 ? statusResult.warnings.slice(0, 1) : statusResult.warnings;

  return {
    sectionType,
    status,
    statusReason: warnings[0] ?? null,
    includedByDefault: status !== "empty",
    sampleColumns,
    sampleRows,
    keyFieldCoverage: statusResult.coverage ?? {},
    sourceLabel: buildSourceLabel(sectionType, sheetName),
    warnings,
  };
}

export function buildSpreadsheetPreviewSummary(
  tables: Array<{ status?: SpreadsheetPreviewStatus; inserted?: number; includedByDefault?: boolean }>
): SpreadsheetPreviewSummary {
  const totalSections = tables.length;
  const readySections = tables.filter((table) => table.status === "ready").length;
  const reviewSections = tables.filter((table) => table.status === "review").length;
  const emptySections = tables.filter((table) => table.status === "empty").length;
  const totalRows = tables.reduce((sum, table) => sum + (table.inserted ?? 0), 0);
  const canImportAll = tables.some(
    (table) => table.includedByDefault !== false && (table.inserted ?? 0) > 0
  );

  return {
    totalSections,
    readySections,
    reviewSections,
    emptySections,
    totalRows,
    canImportAll,
  };
}
