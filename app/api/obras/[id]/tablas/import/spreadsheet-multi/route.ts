import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import * as XLSX from "xlsx";

import { createClient } from "@/utils/supabase/server";
import {
  coerceValueForType,
  ensureTablaDataType,
  normalizeFieldKey,
} from "@/lib/tablas";

type RouteContext = { params: Promise<{ id: string }> };

type TablaColumn = {
  id: string;
  tablaId: string;
  fieldKey: string;
  label: string;
  dataType: ReturnType<typeof ensureTablaDataType>;
  required: boolean;
  config: Record<string, unknown>;
};

type TablaMeta = {
  id: string;
  name: string;
  settings: Record<string, unknown>;
};

type RawSheet = {
  name: string;
  headers: string[];
  rawRows: unknown[][];
  dataRows: Record<string, unknown>[];
};

type CertTemplateTableId = "pmc_resumen" | "pmc_items" | "curva_plan";
type CertTemplateColumnDef = {
  key: string;
  label: string;
  type: "text" | "numeric" | "date" | "int";
  keywords: string[];
};
type CertTemplateTableDef = {
  id: CertTemplateTableId;
  label: string;
  extractionMode?: "vertical" | "horizontal";
  columns: CertTemplateColumnDef[];
};

const CERT_TEMPLATE_TABLE_DEFS: CertTemplateTableDef[] = [
  {
    id: "pmc_resumen",
    label: "PMC Resumen",
    columns: [
      { key: "periodo", label: "Período", type: "text", keywords: ["periodo", "mes", "month", "correspondiente"] },
      { key: "nro_certificado", label: "N° Certificado", type: "int", keywords: ["nro", "numero", "certificado", "cert", "n°"] },
      { key: "fecha_certificacion", label: "Fecha Certificación", type: "date", keywords: ["fecha", "certificacion", "date"] },
      { key: "monto_certificado", label: "Monto Certificado", type: "numeric", keywords: ["monto", "importe", "certificado", "pres", "presente", "cert"] },
      { key: "avance_fisico_acumulado_pct", label: "Avance Físico Acum. %", type: "numeric", keywords: ["avance", "fisico", "acumulado", "acum", "pct", "%"] },
      { key: "monto_acumulado", label: "Monto Acumulado", type: "numeric", keywords: ["monto", "acumulado", "total", "cert"] },
    ],
  },
  {
    id: "pmc_items",
    label: "PMC Items",
    columns: [
      { key: "item_code", label: "Código Item", type: "text", keywords: ["item", "codigo", "cod", "rubro"] },
      { key: "descripcion", label: "Descripción", type: "text", keywords: ["descripcion", "rubro", "concepto", "detalle"] },
      { key: "incidencia_pct", label: "Incidencia %", type: "numeric", keywords: ["incidencia", "incd", "inc", "%"] },
      { key: "monto_rubro", label: "Monto Rubro", type: "numeric", keywords: ["total", "rubro", "$", "monto"] },
      { key: "avance_anterior_pct", label: "Avance Anterior %", type: "numeric", keywords: ["anterior", "ant", "avance", "prev", "%"] },
      { key: "avance_periodo_pct", label: "Avance Período %", type: "numeric", keywords: ["presente", "periodo", "avance", "mes", "%"] },
      { key: "avance_acumulado_pct", label: "Avance Acumulado %", type: "numeric", keywords: ["acumulado", "acum", "avance", "total", "%"] },
      { key: "monto_anterior", label: "Monto Anterior $", type: "numeric", keywords: ["anterior", "ant", "cert", "importe", "$"] },
      { key: "monto_presente", label: "Monto Presente $", type: "numeric", keywords: ["presente", "pres", "cert", "importe", "$"] },
      { key: "monto_acumulado", label: "Monto Acumulado $", type: "numeric", keywords: ["total", "acumulado", "cert", "importe", "$"] },
    ],
  },
  {
    id: "curva_plan",
    label: "Curva Plan",
    extractionMode: "horizontal",
    columns: [
      { key: "periodo", label: "Período", type: "text", keywords: ["mes", "periodo", "month"] },
      { key: "avance_mensual_pct", label: "Avance Mensual %", type: "numeric", keywords: ["avance", "mensual", "%"] },
      { key: "avance_acumulado_pct", label: "Avance Acumulado %", type: "numeric", keywords: ["acumulado", "financiero", "%"] },
    ],
  },
];

function normalize(input: string): string {
  return input
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreRow(row: unknown[]): number {
  if (!row || row.length === 0) return 0;
  let stringCells = 0;
  let numericCells = 0;
  let emptyCells = 0;
  const uniqueStrings = new Set<string>();
  for (const cell of row) {
    const val = String(cell ?? "").trim();
    if (!val) {
      emptyCells++;
    } else if (/^[\d.,$ %()-]+$/.test(val)) {
      numericCells++;
    } else {
      stringCells++;
      uniqueStrings.add(val.toLowerCase());
    }
  }
  const total = row.length || 1;
  if (stringCells < 3) return 0;
  if (uniqueStrings.size === 1 && stringCells > 2) return 0;
  const uniqueRatio = uniqueStrings.size / total;
  const numericPenalty = numericCells / total;
  const emptyPenalty = emptyCells / total;
  return uniqueRatio * 100 - numericPenalty * 50 - emptyPenalty * 20 + uniqueStrings.size * 3;
}

function resolveMergedCells(ws: XLSX.WorkSheet): void {
  const merges = ws["!merges"];
  if (!merges || merges.length === 0) return;
  for (const merge of merges) {
    const topLeftAddr = XLSX.utils.encode_cell({ r: merge.s.r, c: merge.s.c });
    const topLeftCell = ws[topLeftAddr];
    if (!topLeftCell) continue;
    for (let r = merge.s.r; r <= merge.e.r; r++) {
      for (let c = merge.s.c; c <= merge.e.c; c++) {
        if (r === merge.s.r && c === merge.s.c) continue;
        const addr = XLSX.utils.encode_cell({ r, c });
        ws[addr] = { ...topLeftCell };
      }
    }
  }
}

function detectHeaderRow(rawRows: unknown[][]) {
  const scanLimit = Math.min(rawRows.length, 25);
  let bestScore = 0;
  let bestIdx = 0;
  for (let i = 0; i < scanLimit; i++) {
    const score = scoreRow(rawRows[i]);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  if (bestScore === 0) {
    for (let i = 0; i < rawRows.length; i++) {
      if (rawRows[i]?.some((c) => String(c ?? "").trim() !== "")) {
        return {
          headers: rawRows[i].map((c) => String(c ?? "").trim()),
          headerRowIndex: i,
        };
      }
    }
    return { headers: [], headerRowIndex: 0 };
  }

  const primaryRow = rawRows[bestIdx] ?? [];
  const prevRow = bestIdx > 0 ? rawRows[bestIdx - 1] : null;
  const nextRow = rawRows[bestIdx + 1] ?? null;

  let topRow: unknown[] | null = null;
  let botRow: unknown[] | null = null;
  let dataStartIdx = bestIdx;
  const prevScore = prevRow ? scoreRow(prevRow) : 0;
  const nextScore = nextRow ? scoreRow(nextRow) : 0;

  if (prevRow && prevScore > 0 && prevScore >= bestScore * 0.2) {
    topRow = prevRow;
    botRow = primaryRow;
    dataStartIdx = bestIdx;
  } else if (nextRow && nextScore > bestScore * 0.4) {
    topRow = primaryRow;
    botRow = nextRow;
    dataStartIdx = bestIdx + 1;
  }

  if (topRow && botRow) {
    const maxLen = Math.max(topRow.length, botRow.length);
    const filledTop: string[] = [];
    let lastNonEmpty = "";
    for (let c = 0; c < maxLen; c++) {
      const val = String(topRow[c] ?? "").trim();
      if (val) lastNonEmpty = val;
      filledTop.push(lastNonEmpty);
    }
    const compound: string[] = [];
    for (let c = 0; c < maxLen; c++) {
      const top = filledTop[c];
      const bot = String(botRow[c] ?? "").trim();
      if (top && bot && top !== bot) {
        compound.push(`${top} ${bot}`);
      } else {
        compound.push(top || bot);
      }
    }
    const seen = new Map<string, number>();
    for (let i = 0; i < compound.length; i++) {
      const h = compound[i];
      if (!h) continue;
      const count = seen.get(h) ?? 0;
      seen.set(h, count + 1);
      if (count > 0) compound[i] = `${h} (${count + 1})`;
    }
    return { headers: compound, headerRowIndex: dataStartIdx };
  }

  return {
    headers: primaryRow.map((c) => String(c ?? "").trim()),
    headerRowIndex: bestIdx,
  };
}

function rowsToObjects(rawRows: unknown[][], headers: string[], headerRowIndex: number) {
  const rows: Record<string, unknown>[] = [];
  for (let i = headerRowIndex + 1; i < rawRows.length; i++) {
    const raw = rawRows[i] ?? [];
    const obj: Record<string, unknown> = {};
    let nonEmpty = 0;
    for (let c = 0; c < headers.length; c++) {
      const key = headers[c];
      if (!key) continue;
      const value = raw[c] ?? null;
      obj[key] = value;
      if (String(value ?? "").trim() !== "") nonEmpty++;
    }
    if (nonEmpty > 0) rows.push(obj);
  }
  return rows;
}

function parseCsv(text: string): RawSheet[] {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });
  const headers = parsed.meta.fields ?? [];
  const dataRows = (parsed.data ?? []).filter((row) =>
    Object.values(row || {}).some((value) => String(value ?? "").trim().length > 0)
  );
  const rawRows: unknown[][] = [
    headers,
    ...dataRows.map((row) => headers.map((h) => row[h] ?? "")),
  ];
  return [
    {
      name: "CSV",
      headers,
      rawRows,
      dataRows,
    },
  ];
}

function parseWorkbook(buffer: ArrayBuffer): RawSheet[] {
  const wb = XLSX.read(buffer, {
    type: "array",
    cellDates: true,
    sheetStubs: true,
  });
  const sheets: RawSheet[] = [];
  wb.SheetNames.forEach((name) => {
    const ws = wb.Sheets[name];
    resolveMergedCells(ws);
    const rawRows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      raw: false,
      defval: "",
    });
    const { headers, headerRowIndex } = detectHeaderRow(rawRows);
    const dataRows = rowsToObjects(rawRows, headers, headerRowIndex);
    if (headers.length > 0 && dataRows.length > 0) {
      sheets.push({ name, headers, rawRows, dataRows });
    }
  });
  return sheets;
}

function a1ToRowCol(a1: string): { row: number; col: number } | null {
  const match = a1.trim().toUpperCase().match(/^([A-Z]+)(\d+)$/);
  if (!match) return null;
  const [, letters, digits] = match;
  let col = 0;
  for (let i = 0; i < letters.length; i++) {
    col = col * 26 + (letters.charCodeAt(i) - 64);
  }
  return { row: Number.parseInt(digits, 10) - 1, col: col - 1 };
}

function getCellByA1(sheet: RawSheet, a1: string): unknown {
  const decoded = a1ToRowCol(a1);
  if (!decoded) return null;
  const row = sheet.rawRows[decoded.row] ?? [];
  return row[decoded.col] ?? null;
}

function scoreHeaderVsColumn(header: string, column: TablaColumn): number {
  const h = normalize(header);
  if (!h) return 0;
  const label = normalize(column.label);
  const key = normalize(column.fieldKey.replace(/_/g, " "));
  if (h === label) return 1;
  if (h === key) return 0.95;

  const configKeywords = Array.isArray(column.config?.excelKeywords)
    ? (column.config.excelKeywords as unknown[]).filter((v): v is string => typeof v === "string")
    : [];
  const baseKeywords = [column.label, column.fieldKey, normalizeFieldKey(column.label)]
    .filter(Boolean);
  const keywords = [...new Set([...baseKeywords, ...configKeywords])].map((k) => normalize(k));
  if (keywords.length === 0) return 0;
  let matches = 0;
  for (const kw of keywords) {
    if (!kw) continue;
    if (h.includes(kw) || kw.includes(h)) matches++;
  }
  if (matches === 0) return 0;
  return Math.min(0.9, (matches / keywords.length) * 0.9);
}

function scoreHeaderVsCertColumn(excelHeader: string, col: CertTemplateColumnDef): number {
  const normHeader = normalize(excelHeader);
  if (!normHeader) return 0;
  const normLabel = normalize(col.label);
  const normKey = normalize(col.key.replace(/_/g, " "));
  if (normHeader === normLabel) return 1.0;
  if (normHeader === normKey) return 0.95;
  const headerWords = new Set(normHeader.split(" ").filter((w) => w.length > 1));
  const matchingKeywords = col.keywords.filter((kw) => {
    const normKw = normalize(kw);
    for (const hw of headerWords) {
      if (hw.includes(normKw) || normKw.includes(hw)) return true;
    }
    return normHeader.includes(normKw);
  });
  if (matchingKeywords.length === 0) return 0;
  const overlap = matchingKeywords.length / col.keywords.length;
  if (overlap >= 0.6) return 0.7 + overlap * 0.2;
  return overlap * 0.6;
}

function scoreSheetVsCertTable(sheet: RawSheet, table: CertTemplateTableDef): number {
  const normSheetName = normalize(sheet.name);
  let nameBonus = 0;
  if (table.id === "pmc_items") {
    if (normSheetName.includes("certif") && !normSheetName.includes("desac")) nameBonus = 0.3;
  } else if (table.id === "pmc_resumen") {
    if (normSheetName.includes("nota cert")) nameBonus = 0.3;
    if (normSheetName.includes("cert desac")) nameBonus = 0.1;
  } else if (table.id === "curva_plan") {
    if (normSheetName.includes("plan") && normSheetName.includes("curv")) nameBonus = 0.3;
  }
  const columnScores = table.columns.map((col) => {
    let best = 0;
    for (const header of sheet.headers) {
      const score = scoreHeaderVsCertColumn(header, col);
      if (score > best) best = score;
    }
    return best;
  });
  const avgColumnScore =
    columnScores.length > 0
      ? columnScores.reduce((a, b) => a + b, 0) / columnScores.length
      : 0;
  let rowBonus = 0;
  if (table.id === "pmc_resumen" && sheet.dataRows.length <= 5) rowBonus = 0.05;
  if (table.id === "pmc_items" && sheet.dataRows.length > 10) rowBonus = 0.05;
  if (table.id === "curva_plan" && sheet.dataRows.length > 5) rowBonus = 0.05;
  return Math.min(1, avgColumnScore + nameBonus + rowBonus);
}

function pickBestSheetForCertTable(sheets: RawSheet[], table: CertTemplateTableDef): RawSheet | null {
  let bestSheet: RawSheet | null = null;
  let bestScore = 0;
  for (const sheet of sheets) {
    const score = scoreSheetVsCertTable(sheet, table);
    if (score > bestScore) {
      bestScore = score;
      bestSheet = sheet;
    }
  }
  return bestScore >= 0.2 ? bestSheet : null;
}

function coerceCertValue(raw: unknown, type: "text" | "numeric" | "date" | "int"): unknown {
  if (raw === null || raw === undefined) return null;
  const str = String(raw).trim();
  if (str === "" || str === "-") return null;
  switch (type) {
    case "numeric": {
      const cleaned = str.replace(/[$\s]/g, "").replace(/,/g, "");
      const num = Number.parseFloat(cleaned);
      return Number.isFinite(num) ? num : str;
    }
    case "int": {
      const cleaned = str.replace(/[^0-9-]/g, "");
      const num = Number.parseInt(cleaned, 10);
      return Number.isFinite(num) ? num : str;
    }
    case "date":
      return str;
    default:
      return str;
  }
}

function getProfileKeywords(profile: string | null, column: TablaColumn): string[] {
  if (profile !== "certificado") return [];
  const label = normalize(column.label);
  const key = normalize(column.fieldKey.replace(/_/g, " "));
  const joined = `${label} ${key}`;
  const candidates: string[] = [];

  if (joined.includes("nro") || joined.includes("numero")) {
    candidates.push("nro", "numero", "certificado", "n°", "n");
  }
  if (joined.includes("fecha")) {
    candidates.push("fecha", "certificacion", "emision", "date");
  }
  if (joined.includes("obra") || joined.includes("proyecto")) {
    candidates.push("obra", "proyecto");
  }
  if (joined.includes("proveedor")) {
    candidates.push("proveedor");
  }
  if (joined.includes("encargado") || joined.includes("solicitante")) {
    candidates.push("encargado", "solicitante", "pedido");
  }
  if (joined.includes("total") || joined.includes("monto") || joined.includes("importe")) {
    candidates.push("total", "monto", "importe", "certificado", "acumulado");
  }
  if (joined.includes("cantidad")) {
    candidates.push("cantidad", "cant");
  }
  if (joined.includes("unidad")) {
    candidates.push("unidad", "u");
  }
  if (joined.includes("descripcion") || joined.includes("detalle") || joined.includes("material")) {
    candidates.push("descripcion", "detalle", "material", "rubro");
  }
  if (joined.includes("precio")) {
    candidates.push("precio", "unitario", "importe");
  }

  return candidates;
}

function scoreHeaderVsColumnWithProfile(
  header: string,
  column: TablaColumn,
  profile: string | null
) {
  let score = scoreHeaderVsColumn(header, column);
  if (!profile) return score;
  const normalizedHeader = normalize(header);
  const profileKeywords = getProfileKeywords(profile, column);
  if (profileKeywords.length > 0) {
    const boosted = profileKeywords.some((kw) => {
      const n = normalize(kw);
      return normalizedHeader.includes(n) || n.includes(normalizedHeader);
    });
    if (boosted) {
      score = Math.min(1, score + 0.2);
    }
  }
  return score;
}

function pickBestSheetForTable(
  sheets: RawSheet[],
  columns: TablaColumn[],
  profile: string | null
): RawSheet | null {
  let bestSheet: RawSheet | null = null;
  let bestScore = 0;
  for (const sheet of sheets) {
    if (!sheet.headers.length) continue;
    const scores = columns.map((col) => {
      let max = 0;
      sheet.headers.forEach((header) => {
        max = Math.max(max, scoreHeaderVsColumnWithProfile(header, col, profile));
      });
      return max;
    });
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    if (avg > bestScore) {
      bestScore = avg;
      bestSheet = sheet;
    }
  }
  const threshold = profile === "certificado" ? 0.08 : 0.15;
  return bestScore >= threshold ? bestSheet : null;
}

function buildMappings(sheet: RawSheet, columns: TablaColumn[], profile: string | null) {
  const usedHeaders = new Set<string>();
  return columns.map((column) => {
    let bestHeader: string | null = null;
    let bestScore = 0;
    for (const header of sheet.headers) {
      if (usedHeaders.has(header)) continue;
      const score = scoreHeaderVsColumnWithProfile(header, column, profile);
      if (score > bestScore) {
        bestScore = score;
        bestHeader = header;
      }
    }
    const threshold = profile === "certificado" ? 0.08 : 0.15;
    if (bestHeader && bestScore >= threshold) {
      usedHeaders.add(bestHeader);
      return { column, excelHeader: bestHeader };
    }
    return { column, excelHeader: null as string | null };
  });
}

function parsePercentValue(raw: unknown): number {
  if (raw === null || raw === undefined) return 0;
  const hadPercent = String(raw).includes("%");
  const str = String(raw).trim().replace(/%/g, "").trim();
  if (!str) return 0;

  let cleaned: string;
  const lastDot = str.lastIndexOf(".");
  const lastComma = str.lastIndexOf(",");
  if (lastComma > lastDot) {
    cleaned = str.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > lastComma) {
    cleaned = str.replace(/,/g, "");
  } else {
    cleaned = str;
  }

  const num = Number.parseFloat(cleaned);
  if (!Number.isFinite(num)) return 0;
  if (hadPercent) return Math.round(num * 100) / 100;
  if (Math.abs(num) < 1 && Math.abs(num) > 0) return Math.round(num * 10000) / 100;
  return Math.round(num * 100) / 100;
}

function isCurvaPlanTable(columns: TablaColumn[], tablaName: string, profile: string | null): boolean {
  if (profile !== "certificado") return false;
  const keys = new Set(columns.map((c) => c.fieldKey));
  const hasCoreFields =
    keys.has("periodo") &&
    keys.has("avance_mensual_pct") &&
    keys.has("avance_acumulado_pct");
  if (hasCoreFields) return true;
  return normalize(tablaName).includes("curva plan");
}

function extractCurvaPlanRows(params: {
  sheet: RawSheet;
  columns: TablaColumn[];
  tablaId: string;
  docMeta: { bucket: string; path: string; fileName: string } | null;
}) {
  const { sheet, columns, tablaId, docMeta } = params;
  const periodoField =
    columns.find((c) => c.fieldKey === "periodo") ??
    columns.find((c) => normalize(c.label).includes("periodo")) ??
    null;
  const mensualField =
    columns.find((c) => c.fieldKey === "avance_mensual_pct") ??
    columns.find((c) => normalize(c.label).includes("mensual")) ??
    null;
  const acumuladoField =
    columns.find((c) => c.fieldKey === "avance_acumulado_pct") ??
    columns.find((c) => normalize(c.label).includes("acumulado")) ??
    null;
  if (!periodoField || !mensualField || !acumuladoField) return [] as Array<{ tabla_id: string; data: Record<string, unknown>; source: string }>;

  const monthHeaders = sheet.headers.filter((header) => /mes\s*\d+/i.test(header));
  if (monthHeaders.length === 0) return [] as Array<{ tabla_id: string; data: Record<string, unknown>; source: string }>;

  let avanceMensualRow: Record<string, unknown> | null = null;
  for (const row of sheet.dataRows) {
    const text = Object.values(row)
      .map((value) => normalize(String(value ?? "")))
      .join(" ");
    if (text.includes("avance") && text.includes("mensual")) {
      avanceMensualRow = row;
      break;
    }
  }
  if (!avanceMensualRow) return [] as Array<{ tabla_id: string; data: Record<string, unknown>; source: string }>;

  const rows: Array<{ tabla_id: string; data: Record<string, unknown>; source: string }> = [];
  let cumulative = 0;
  for (const monthHeader of monthHeaders) {
    const monthly = parsePercentValue(avanceMensualRow[monthHeader]);
    cumulative += monthly;
    const data: Record<string, unknown> = {
      [periodoField.fieldKey]: monthHeader,
      [mensualField.fieldKey]: monthly,
      [acumuladoField.fieldKey]: Math.round(cumulative * 100) / 100,
    };
    if (docMeta) {
      data.__docBucket = docMeta.bucket;
      data.__docPath = docMeta.path;
      data.__docFileName = docMeta.fileName;
    }
    rows.push({
      tabla_id: tablaId,
      data,
      source: "spreadsheet",
    });
  }
  return rows;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { id: obraId } = await context.params;
  if (!obraId) {
    return NextResponse.json({ error: "Parámetros incompletos" }, { status: 400 });
  }
  try {
    const supabase = await createClient();
    const form = await request.formData();
    const url = new URL(request.url);
    const previewMode =
      url.searchParams.get("preview") === "1" ||
      url.searchParams.get("preview") === "true";
    const rawTablaIds = form.get("tablaIds");
    const rawSheetAssignments = form.get("sheetAssignments");
    const rawColumnMappings = form.get("columnMappings");
    const rawManualValues = form.get("manualValues");
    const tablaIds = (() => {
      if (typeof rawTablaIds !== "string") return [] as string[];
      try {
        const parsed = JSON.parse(rawTablaIds);
        return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
      } catch {
        return [] as string[];
      }
    })();
    if (tablaIds.length === 0) {
      return NextResponse.json({ error: "No se enviaron tablas para importar." }, { status: 400 });
    }
    const sheetAssignments = (() => {
      if (typeof rawSheetAssignments !== "string") return {} as Record<string, string | null>;
      try {
        const parsed = JSON.parse(rawSheetAssignments);
        return parsed && typeof parsed === "object"
          ? (parsed as Record<string, string | null>)
          : ({} as Record<string, string | null>);
      } catch {
        return {} as Record<string, string | null>;
      }
    })();
    const columnMappings = (() => {
      if (typeof rawColumnMappings !== "string") return {} as Record<string, Record<string, string | null>>;
      try {
        const parsed = JSON.parse(rawColumnMappings);
        return parsed && typeof parsed === "object"
          ? (parsed as Record<string, Record<string, string | null>>)
          : ({} as Record<string, Record<string, string | null>>);
      } catch {
        return {} as Record<string, Record<string, string | null>>;
      }
    })();
    const manualValues = (() => {
      if (typeof rawManualValues !== "string") return {} as Record<string, Record<string, string>>;
      try {
        const parsed = JSON.parse(rawManualValues);
        return parsed && typeof parsed === "object"
          ? (parsed as Record<string, Record<string, string>>)
          : ({} as Record<string, Record<string, string>>);
      } catch {
        return {} as Record<string, Record<string, string>>;
      }
    })();

    const fileEntry = form.get("file");
    const file = fileEntry instanceof File ? fileEntry : null;
    const existingBucket = form.get("existingBucket");
    const existingPath = form.get("existingPath");
    const existingFileName = form.get("existingFileName");

    let sourceName = file?.name ?? "";
    let sheets: RawSheet[] = [];
    let docMeta: { bucket: string; path: string; fileName: string } | null = null;

    if (file) {
      const ext = file.name.toLowerCase().split(".").pop() ?? "";
      sourceName = file.name;
      if (ext === "csv") {
        sheets = parseCsv(await file.text());
      } else if (ext === "xlsx" || ext === "xls") {
        sheets = parseWorkbook(await file.arrayBuffer());
      } else {
        return NextResponse.json({ error: "Solo se soportan CSV/XLSX/XLS." }, { status: 400 });
      }
      if (typeof existingBucket === "string" && typeof existingPath === "string") {
        docMeta = {
          bucket: existingBucket,
          path: existingPath,
          fileName:
            typeof existingFileName === "string" && existingFileName.trim().length > 0
              ? existingFileName
              : sourceName,
        };
      }
    } else if (typeof existingBucket === "string" && typeof existingPath === "string") {
      const { data: blob, error: downloadError } = await supabase.storage
        .from(existingBucket)
        .download(existingPath);
      if (downloadError) {
        return NextResponse.json({ error: `No se pudo descargar el archivo: ${downloadError.message}` }, { status: 400 });
      }
      sourceName =
        typeof existingFileName === "string" && existingFileName.trim().length > 0
          ? existingFileName
          : existingPath.split("/").pop() ?? "archivo";
      const ext = sourceName.toLowerCase().split(".").pop() ?? "";
      if (ext === "csv") {
        sheets = parseCsv(await blob.text());
      } else if (ext === "xlsx" || ext === "xls") {
        sheets = parseWorkbook(await blob.arrayBuffer());
      } else {
        return NextResponse.json({ error: "El archivo no es CSV/XLSX/XLS." }, { status: 400 });
      }
      docMeta = { bucket: existingBucket, path: existingPath, fileName: sourceName };
    } else {
      return NextResponse.json({ error: "Se requiere archivo o referencia existente." }, { status: 400 });
    }

    if (sheets.length === 0) {
      return NextResponse.json({ error: "No se encontraron hojas o filas válidas." }, { status: 400 });
    }

    const { data: columnsData, error: columnsError } = await supabase
      .from("obra_tabla_columns")
      .select("id, tabla_id, field_key, label, data_type, required, config, position")
      .in("tabla_id", tablaIds)
      .order("position", { ascending: true });
    if (columnsError) throw columnsError;

    const { data: tablasData, error: tablasError } = await supabase
      .from("obra_tablas")
      .select("id, name, settings")
      .in("id", tablaIds)
      .eq("obra_id", obraId);
    if (tablasError) throw tablasError;
    const tablaMetaById = new Map<string, TablaMeta>();
    (tablasData ?? []).forEach((tabla) => {
      tablaMetaById.set(tabla.id as string, {
        id: tabla.id as string,
        name: (tabla.name as string) ?? "Tabla",
        settings: ((tabla.settings as Record<string, unknown>) ?? {}) as Record<string, unknown>,
      });
    });

    const columnsByTabla = new Map<string, TablaColumn[]>();
    (columnsData ?? []).forEach((col) => {
      const tablaId = col.tabla_id as string;
      const bucket = columnsByTabla.get(tablaId) ?? [];
      bucket.push({
        id: col.id as string,
        tablaId,
        fieldKey: col.field_key as string,
        label: col.label as string,
        dataType: ensureTablaDataType(col.data_type as string | undefined),
        required: Boolean(col.required),
        config: (col.config as Record<string, unknown>) ?? {},
      });
      columnsByTabla.set(tablaId, bucket);
    });

    const perTable: Array<{
      tablaId: string;
      tablaName: string;
      inserted: number;
      sheetName: string | null;
      mappings?: Array<{
        dbColumn: string;
        label: string;
        excelHeader: string | null;
        confidence: number;
        manualValue?: string;
      }>;
      previewRows?: Record<string, unknown>[];
      availableSheets?: Array<{
        name: string;
        headers: string[];
        rowCount: number;
      }>;
    }> = [];

    const uniqueTablaIds = [...new Set(tablaIds)];

    for (const tablaId of uniqueTablaIds) {
      const columns = columnsByTabla.get(tablaId) ?? [];
      const tablaMeta = tablaMetaById.get(tablaId);
      const profile =
        typeof tablaMeta?.settings?.spreadsheetTemplate === "string"
          ? (tablaMeta.settings.spreadsheetTemplate as string)
          : null;
      const certTableId: CertTemplateTableId | null = (() => {
        if (profile !== "certificado") return null;
        const keys = new Set(columns.map((c) => c.fieldKey));
        if (keys.has("periodo") && keys.has("monto_certificado") && keys.has("avance_fisico_acumulado_pct")) {
          return "pmc_resumen";
        }
        if (keys.has("item_code") && keys.has("descripcion") && keys.has("monto_rubro")) {
          return "pmc_items";
        }
        if (keys.has("periodo") && keys.has("avance_mensual_pct") && keys.has("avance_acumulado_pct")) {
          return "curva_plan";
        }
        const normalizedName = normalize(tablaMeta?.name ?? "");
        if (normalizedName.includes("curva")) return "curva_plan";
        if (normalizedName.includes("items")) return "pmc_items";
        if (normalizedName.includes("resumen")) return "pmc_resumen";
        return null;
      })();
      const certTableDef = certTableId
        ? CERT_TEMPLATE_TABLE_DEFS.find((def) => def.id === certTableId) ?? null
        : null;
      if (columns.length === 0) {
        perTable.push({
          tablaId,
          tablaName: tablaMeta?.name ?? "Tabla",
          inserted: 0,
          sheetName: null,
        });
        continue;
      }
      const assignedSheetName = sheetAssignments[tablaId];
      const assignedSheet =
        typeof assignedSheetName === "string" && assignedSheetName.trim().length > 0
          ? sheets.find((sheet) => sheet.name === assignedSheetName.trim()) ?? null
          : null;
      const bestSheet =
        assignedSheet ??
        (certTableDef ? pickBestSheetForCertTable(sheets, certTableDef) : pickBestSheetForTable(sheets, columns, profile));
      if (!bestSheet) {
        perTable.push({
          tablaId,
          tablaName: tablaMeta?.name ?? "Tabla",
          inserted: 0,
          sheetName: null,
        });
        continue;
      }

      const explicitMappingForTabla = columnMappings[tablaId];
      const certMappingsByKey = new Map<string, { excelHeader: string | null; confidence: number }>();
      if (!explicitMappingForTabla && certTableDef) {
        const usedHeaders = new Set<string>();
        for (const colDef of certTableDef.columns) {
          let bestHeader: string | null = null;
          let bestScore = 0;
          for (const header of bestSheet.headers) {
            if (usedHeaders.has(header)) continue;
            const score = scoreHeaderVsCertColumn(header, colDef);
            if (score > bestScore) {
              bestScore = score;
              bestHeader = header;
            }
          }
          if (bestHeader && bestScore >= 0.15) {
            usedHeaders.add(bestHeader);
            certMappingsByKey.set(colDef.key, { excelHeader: bestHeader, confidence: bestScore });
          } else {
            certMappingsByKey.set(colDef.key, { excelHeader: null, confidence: 0 });
          }
        }
      }
      const mappings =
        explicitMappingForTabla && typeof explicitMappingForTabla === "object"
          ? columns.map((column) => {
              const selectedHeader = explicitMappingForTabla[column.fieldKey];
              const isValid =
                typeof selectedHeader === "string" &&
                selectedHeader.length > 0 &&
                bestSheet.headers.includes(selectedHeader);
              const manualValue =
                typeof manualValues?.[tablaId]?.[column.fieldKey] === "string"
                  ? manualValues[tablaId][column.fieldKey]
                  : "";
              return {
                column,
                excelHeader: isValid ? selectedHeader : null,
                confidence: isValid ? 1 : 0,
                manualValue,
              };
            })
          : certTableDef
            ? columns.map((column) => {
              const candidate = certMappingsByKey.get(column.fieldKey);
              const manualValue =
                typeof manualValues?.[tablaId]?.[column.fieldKey] === "string"
                  ? manualValues[tablaId][column.fieldKey]
                  : "";
              return {
                column,
                excelHeader: candidate?.excelHeader ?? null,
                confidence: candidate?.confidence ?? 0,
                manualValue,
              };
            })
            : buildMappings(bestSheet, columns, profile).map((mapping) => ({
                ...mapping,
                confidence: mapping.excelHeader ? 1 : 0,
                manualValue:
                  typeof manualValues?.[tablaId]?.[mapping.column.fieldKey] === "string"
                    ? manualValues[tablaId][mapping.column.fieldKey]
                    : "",
              }));
      const parentColumns = columns.filter((c) => (c.config?.ocrScope as string | undefined) === "parent");
      const itemColumns = columns.filter((c) => (c.config?.ocrScope as string | undefined) !== "parent");

      let extractedRows =
        certTableDef?.id === "pmc_resumen"
          ? (() => {
              const fixedRefs: Record<string, string> = {
                periodo: "A17",
                nro_certificado: "",
                fecha_certificacion: "A15",
                monto_certificado: "E197",
                avance_fisico_acumulado_pct: "J185",
                monto_acumulado: "P185",
              };
              const data: Record<string, unknown> = {};
              for (const map of mappings) {
                const fieldKey = map.column.fieldKey;
                const manual = typeof map.manualValue === "string" ? map.manualValue.trim() : "";
                if (manual.length > 0) {
                  data[fieldKey] = certTableDef
                    ? coerceCertValue(
                        manual,
                        certTableDef.columns.find((c) => c.key === fieldKey)?.type ?? "text"
                      )
                    : coerceValueForType(map.column.dataType, manual);
                  continue;
                }
                const fixedRef = fixedRefs[fieldKey];
                let rawValue: unknown = fixedRef ? getCellByA1(bestSheet, fixedRef) : null;
                if ((rawValue == null || String(rawValue).trim() === "") && map.excelHeader) {
                  const firstWithHeader = bestSheet.dataRows.find((row) => {
                    const v = row[map.excelHeader as string];
                    return v != null && String(v).trim() !== "";
                  });
                  rawValue = firstWithHeader ? firstWithHeader[map.excelHeader] : null;
                }
                data[fieldKey] =
                  rawValue == null || String(rawValue).trim() === ""
                    ? null
                    : certTableDef
                      ? coerceCertValue(
                          rawValue,
                          certTableDef.columns.find((c) => c.key === fieldKey)?.type ?? "text"
                        )
                      : coerceValueForType(map.column.dataType, rawValue);
              }
              if (docMeta) {
                data.__docBucket = docMeta.bucket;
                data.__docPath = docMeta.path;
                data.__docFileName = docMeta.fileName;
              }
              const hasAnyValue = Object.entries(data).some(
                ([key, value]) =>
                  !key.startsWith("__doc") &&
                  value != null &&
                  String(value).trim().length > 0
              );
              return hasAnyValue
                ? [{ tabla_id: tablaId, data, source: "spreadsheet" }]
                : [];
            })()
          : certTableDef?.id === "curva_plan"
        ? extractCurvaPlanRows({
            sheet: bestSheet,
            columns,
            tablaId,
            docMeta,
          })
        : bestSheet.dataRows
            .map((sourceRow) => {
              const data: Record<string, unknown> = {};
              for (const map of mappings) {
                const manual = typeof map.manualValue === "string" ? map.manualValue.trim() : "";
                const rawValue = map.excelHeader
                  ? sourceRow[map.excelHeader]
                  : (manual.length > 0 ? manual : null);
                if (rawValue == null || String(rawValue).trim() === "") continue;
                data[map.column.fieldKey] =
                  certTableDef
                    ? coerceCertValue(
                        rawValue,
                        certTableDef.columns.find((c) => c.key === map.column.fieldKey)?.type ?? "text"
                      )
                    : coerceValueForType(map.column.dataType, rawValue);
              }
              if (docMeta) {
                data.__docBucket = docMeta.bucket;
                data.__docPath = docMeta.path;
                data.__docFileName = docMeta.fileName;
              }
              return { tabla_id: tablaId, data, source: "spreadsheet" };
            })
            .filter((row) =>
              Object.entries(row.data).some(
                ([key, value]) =>
                  !key.startsWith("__doc") &&
                  value != null &&
                  String(value).trim().length > 0
              )
            );

      if (extractedRows.length === 0 && certTableDef?.id !== "curva_plan") {
        // Fallback: direct normalized header->fieldKey/label matching without confidence threshold.
        extractedRows = bestSheet.dataRows
          .map((sourceRow) => {
            const data: Record<string, unknown> = {};
            columns.forEach((column) => {
              const targetKeys = [
                normalize(column.fieldKey),
                normalize(column.label),
                normalize(normalizeFieldKey(column.label)),
              ];
              const sourceHeader = Object.keys(sourceRow).find((header) => {
                const nh = normalize(header);
                return targetKeys.some((tk) => tk && (nh === tk || nh.includes(tk) || tk.includes(nh)));
              });
              if (!sourceHeader) return;
                const raw = sourceRow[sourceHeader];
                data[column.fieldKey] =
                  raw == null || String(raw).trim() === ""
                    ? null
                    : certTableDef
                      ? coerceCertValue(
                          raw,
                          certTableDef.columns.find((c) => c.key === column.fieldKey)?.type ?? "text"
                        )
                      : coerceValueForType(column.dataType, raw);
            });
            if (docMeta) {
              data.__docBucket = docMeta.bucket;
              data.__docPath = docMeta.path;
              data.__docFileName = docMeta.fileName;
            }
            return { tabla_id: tablaId, data, source: "spreadsheet" };
          })
          .filter((row) =>
            Object.entries(row.data).some(
              ([key, value]) =>
                !key.startsWith("__doc") &&
                value != null &&
                String(value).trim().length > 0
            )
          );
      }

      if (itemColumns.length === 0 && parentColumns.length > 0) {
        // For document-level tables, keep only the richest matched row.
        if (extractedRows.length > 1) {
          extractedRows.sort((a, b) => {
            const countValues = (row: typeof a) =>
              Object.entries(row.data).filter(
                ([key, value]) =>
                  !key.startsWith("__doc") &&
                  value != null &&
                  String(value).trim().length > 0
              ).length;
            return countValues(b) - countValues(a);
          });
        }
        extractedRows = extractedRows.length > 0 ? [extractedRows[0]] : [];
      }

      if (previewMode) {
        const mappedPreview = mappings.map((map) => ({
          dbColumn: map.column.fieldKey,
          label: map.column.label,
          excelHeader: map.excelHeader,
          confidence: map.confidence ?? (map.excelHeader ? 1 : 0),
          manualValue: typeof map.manualValue === "string" ? map.manualValue : "",
        }));
        perTable.push({
          tablaId,
          tablaName: tablaMeta?.name ?? "Tabla",
          inserted: extractedRows.length,
          sheetName: bestSheet.name,
          mappings: mappedPreview,
          previewRows: extractedRows.slice(0, 40).map((row) => row.data),
          availableSheets: sheets.map((sheet) => ({
            name: sheet.name,
            headers: sheet.headers,
            rowCount: sheet.dataRows.length,
          })),
        });
        continue;
      }

      if (docMeta?.path) {
        await supabase
          .from("obra_tabla_rows")
          .delete()
          .eq("tabla_id", tablaId)
          .contains("data", { __docPath: docMeta.path });
      }

      if (extractedRows.length > 0) {
        const { error: insertError } = await supabase.from("obra_tabla_rows").insert(extractedRows);
        if (insertError) throw insertError;
      }

      if (docMeta) {
        await supabase.from("ocr_document_processing").upsert(
          {
            tabla_id: tablaId,
            obra_id: obraId,
            source_bucket: docMeta.bucket,
            source_path: docMeta.path,
            source_file_name: docMeta.fileName,
            status: "completed",
            rows_extracted: extractedRows.length,
            processed_at: new Date().toISOString(),
          },
          { onConflict: "tabla_id,source_path" }
        );
      }

      perTable.push({
        tablaId,
        tablaName: tablaMeta?.name ?? "Tabla",
        inserted: extractedRows.length,
        sheetName: bestSheet.name,
      });
    }

    return NextResponse.json({
      ok: true,
      preview: previewMode,
      sourceName,
      inserted: perTable.reduce((acc, row) => acc + row.inserted, 0),
      perTable,
    });
  } catch (error) {
    console.error("[tablas:spreadsheet-multi]", error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
