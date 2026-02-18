import type {
	DbTableDef,
	DbTableId,
	DbColumnDef,
	ColumnMapping,
	SheetAnalysis,
	RawSheet,
	ExtractedTable,
} from "./types";

// ─── DB Table Definitions ────────────────────────────────────────────

export const DB_TABLE_DEFS: DbTableDef[] = [
	{
		id: "pmc_resumen",
		label: "PMC Resumen",
		description:
			"Resumen mensual del certificado: período, monto, avance acumulado.",
		columns: [
			{
				key: "periodo",
				label: "Período",
				type: "text",
				keywords: ["periodo", "mes", "month", "correspondiente"],
			},
			{
				key: "nro_certificado",
				label: "N° Certificado",
				type: "int",
				keywords: ["nro", "numero", "certificado", "cert", "n°"],
			},
			{
				key: "fecha_certificacion",
				label: "Fecha Certificación",
				type: "date",
				keywords: ["fecha", "certificacion", "date"],
			},
			{
				key: "monto_certificado",
				label: "Monto Certificado",
				type: "numeric",
				keywords: [
					"monto",
					"importe",
					"certificado",
					"pres",
					"presente",
					"cert",
				],
			},
			{
				key: "avance_fisico_acumulado_pct",
				label: "Avance Físico Acum. %",
				type: "numeric",
				keywords: ["avance", "fisico", "acumulado", "acum", "pct", "%"],
			},
			{
				key: "monto_acumulado",
				label: "Monto Acumulado",
				type: "numeric",
				keywords: ["monto", "acumulado", "total", "cert"],
			},
		],
	},
	{
		id: "pmc_items",
		label: "PMC Items",
		description:
			"Desglose por rubro/item del certificado con avances e importes.",
		columns: [
			{
				key: "item_code",
				label: "Código Item",
				type: "text",
				keywords: ["item", "codigo", "cod", "rubro"],
			},
			{
				key: "descripcion",
				label: "Descripción",
				type: "text",
				keywords: ["descripcion", "rubro", "concepto", "detalle"],
			},
			{
				key: "incidencia_pct",
				label: "Incidencia %",
				type: "numeric",
				keywords: ["incidencia", "incd", "inc", "%"],
			},
			{
				key: "monto_rubro",
				label: "Monto Rubro",
				type: "numeric",
				keywords: ["total", "rubro", "$", "monto"],
			},
			{
				key: "avance_anterior_pct",
				label: "Avance Anterior %",
				type: "numeric",
				keywords: ["anterior", "ant", "avance", "prev", "%"],
			},
			{
				key: "avance_periodo_pct",
				label: "Avance Período %",
				type: "numeric",
				keywords: ["presente", "periodo", "avance", "mes", "%"],
			},
			{
				key: "avance_acumulado_pct",
				label: "Avance Acumulado %",
				type: "numeric",
				keywords: ["acumulado", "acum", "avance", "total", "%"],
			},
			{
				key: "monto_anterior",
				label: "Monto Anterior $",
				type: "numeric",
				keywords: ["anterior", "ant", "cert", "importe", "$"],
			},
			{
				key: "monto_presente",
				label: "Monto Presente $",
				type: "numeric",
				keywords: ["presente", "pres", "cert", "importe", "$"],
			},
			{
				key: "monto_acumulado",
				label: "Monto Acumulado $",
				type: "numeric",
				keywords: ["total", "acumulado", "cert", "importe", "$"],
			},
		],
	},
	{
		id: "curva_plan",
		label: "Curva Plan",
		description:
			"Curva de inversiones con avance mensual y acumulado (extracción horizontal desde fila AVANCE MENSUAL).",
		extractionMode: "horizontal",
		columns: [
			{
				key: "periodo",
				label: "Período",
				type: "text",
				keywords: ["mes", "periodo", "month"],
			},
			{
				key: "avance_mensual_pct",
				label: "Avance Mensual %",
				type: "numeric",
				keywords: ["avance", "mensual", "%"],
			},
			{
				key: "avance_acumulado_pct",
				label: "Avance Acumulado %",
				type: "numeric",
				keywords: ["acumulado", "financiero", "%"],
			},
		],
	},
];

// ─── Normalization ───────────────────────────────────────────────────

function normalize(s: string): string {
	return s
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLowerCase()
		.replace(/[^a-z0-9 ]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

// ─── Scoring ─────────────────────────────────────────────────────────

function scoreHeaderVsColumn(
	excelHeader: string,
	col: DbColumnDef
): number {
	const normHeader = normalize(excelHeader);
	if (!normHeader) return 0;

	const normLabel = normalize(col.label);
	const normKey = normalize(col.key.replace(/_/g, " "));

	// Exact match on label
	if (normHeader === normLabel) return 1.0;
	// Exact match on key
	if (normHeader === normKey) return 0.95;

	// Keyword overlap
	const headerWords = new Set(normHeader.split(" ").filter((w) => w.length > 1));
	const matchingKeywords = col.keywords.filter((kw) => {
		const normKw = normalize(kw);
		// Check if any header word contains or matches the keyword
		for (const hw of headerWords) {
			if (hw.includes(normKw) || normKw.includes(hw)) return true;
		}
		// Also check if the full header contains the keyword
		return normHeader.includes(normKw);
	});

	if (matchingKeywords.length === 0) return 0;
	const overlap = matchingKeywords.length / col.keywords.length;

	// High overlap = high confidence
	if (overlap >= 0.6) return 0.7 + overlap * 0.2;
	return overlap * 0.6;
}

function scoreSheetVsTable(sheet: RawSheet, table: DbTableDef): number {
	const normSheetName = normalize(sheet.name);

	// Sheet name heuristic bonus
	let nameBonus = 0;
	if (table.id === "pmc_items") {
		if (normSheetName.includes("certif") && !normSheetName.includes("desac"))
			nameBonus = 0.3;
	} else if (table.id === "pmc_resumen") {
		if (normSheetName.includes("nota cert")) nameBonus = 0.3;
		if (normSheetName.includes("cert desac")) nameBonus = 0.1;
	} else if (table.id === "curva_plan") {
		if (
			normSheetName.includes("plan") &&
			normSheetName.includes("curv")
		)
			nameBonus = 0.3;
	}

	// Score each DB column against best matching Excel header
	const columnScores = table.columns.map((col) => {
		let bestScore = 0;
		for (const header of sheet.headers) {
			const score = scoreHeaderVsColumn(header, col);
			if (score > bestScore) bestScore = score;
		}
		return bestScore;
	});

	const avgColumnScore =
		columnScores.length > 0
			? columnScores.reduce((a, b) => a + b, 0) / columnScores.length
			: 0;

	// Row count heuristic
	let rowBonus = 0;
	if (table.id === "pmc_resumen" && sheet.dataRows.length <= 5)
		rowBonus = 0.05;
	if (table.id === "pmc_items" && sheet.dataRows.length > 10)
		rowBonus = 0.05;
	if (table.id === "curva_plan" && sheet.dataRows.length > 5)
		rowBonus = 0.05;

	return Math.min(1, avgColumnScore + nameBonus + rowBonus);
}

// ─── Mapping Builder ─────────────────────────────────────────────────

export function buildMappings(
	sheet: RawSheet,
	table: DbTableDef
): ColumnMapping[] {
	const usedHeaders = new Set<string>();

	return table.columns.map((col) => {
		let bestHeader: string | null = null;
		let bestScore = 0;

		for (const header of sheet.headers) {
			if (usedHeaders.has(header)) continue;
			const score = scoreHeaderVsColumn(header, col);
			if (score > bestScore) {
				bestScore = score;
				bestHeader = header;
			}
		}

		// Only map if confidence > threshold
		if (bestHeader && bestScore >= 0.15) {
			usedHeaders.add(bestHeader);
			return { dbColumn: col.key, excelHeader: bestHeader, confidence: bestScore };
		}

		return { dbColumn: col.key, excelHeader: null, confidence: 0 };
	});
}

// ─── Sheet Analysis ──────────────────────────────────────────────────

export function analyzeSheets(sheets: RawSheet[]): SheetAnalysis[] {
	const results: SheetAnalysis[] = [];

	// For each sheet, score against all target tables
	for (const sheet of sheets) {
		let bestTable: DbTableId | null = null;
		let bestScore = 0;

		for (const table of DB_TABLE_DEFS) {
			const score = scoreSheetVsTable(sheet, table);
			if (score > bestScore) {
				bestScore = score;
				bestTable = table.id;
			}
		}

		const mappings =
			bestTable && bestScore >= 0.2
				? buildMappings(
						sheet,
						DB_TABLE_DEFS.find((t) => t.id === bestTable)!
					)
				: [];

		results.push({
			sheetName: sheet.name,
			targetTable: bestScore >= 0.2 ? bestTable : null,
			matchScore: bestScore,
			mappings,
		});
	}

	return results;
}

// ─── Horizontal Extraction (curva_plan) ─────────────────────────────

function extractHorizontalTable(
	sheet: RawSheet,
	tableDef: DbTableDef
): ExtractedTable {
	// 1. Find month columns from headers (e.g., "MES 0", "MES 1", ...)
	const monthHeaders: { header: string; index: number }[] = [];
	for (let i = 0; i < sheet.headers.length; i++) {
		const h = sheet.headers[i];
		if (/mes\s*\d+/i.test(h)) {
			monthHeaders.push({ header: h, index: i });
		}
	}

	if (monthHeaders.length === 0) {
		return {
			targetTableId: tableDef.id,
			sourceSheetName: sheet.name,
			mappings: [],
			rows: [],
			rowCount: 0,
		};
	}

	// 2. Find the "AVANCE MENSUAL" row in dataRows
	let avanceMensualRow: Record<string, unknown> | null = null;
	for (const row of sheet.dataRows) {
		const textValues = Object.values(row)
			.map((v) => normalize(String(v ?? "")))
			.join(" ");
		if (textValues.includes("avance") && textValues.includes("mensual")) {
			avanceMensualRow = row;
			break;
		}
	}

	if (!avanceMensualRow) {
		return {
			targetTableId: tableDef.id,
			sourceSheetName: sheet.name,
			mappings: [],
			rows: [],
			rowCount: 0,
		};
	}

	// 3. Extract monthly values and compute cumulative
	const rows: Record<string, unknown>[] = [];
	let cumulative = 0;

	for (const { header } of monthHeaders) {
		const rawVal = avanceMensualRow[header];
		const parsed = parsePercentValue(rawVal);
		cumulative += parsed;
		rows.push({
			periodo: header,
			avance_mensual_pct: parsed,
			avance_acumulado_pct: Math.round(cumulative * 100) / 100,
		});
	}

	return {
		targetTableId: tableDef.id,
		sourceSheetName: sheet.name,
		mappings: tableDef.columns.map((col) => ({
			dbColumn: col.key,
			excelHeader: col.key,
			confidence: 1,
		})),
		rows,
		rowCount: rows.length,
	};
}

/** Parse a percentage value that may be "2.00%", "2,74%", "0.0274", etc. */
function parsePercentValue(raw: unknown): number {
	if (raw === null || raw === undefined) return 0;
	const hadPercent = String(raw).includes("%");
	const str = String(raw).trim().replace(/%/g, "").trim();
	if (!str) return 0;

	// Smart decimal parsing: if string has both "." and ","
	// assume last one is decimal separator
	let cleaned: string;
	const lastDot = str.lastIndexOf(".");
	const lastComma = str.lastIndexOf(",");
	if (lastComma > lastDot) {
		// Comma is decimal sep (e.g., "2,74" or "1.234,56")
		cleaned = str.replace(/\./g, "").replace(",", ".");
	} else if (lastDot > lastComma) {
		// Dot is decimal sep (e.g., "2.74" or "1,234.56")
		cleaned = str.replace(/,/g, "");
	} else {
		cleaned = str;
	}

	const num = parseFloat(cleaned);
	if (!Number.isFinite(num)) return 0;

	// If the original had "%", the value is already a percentage (e.g., 2.00)
	if (hadPercent) {
		return Math.round(num * 100) / 100;
	}

	// Otherwise it's a decimal fraction (0.02 = 2%), convert to percentage
	if (Math.abs(num) < 1 && Math.abs(num) > 0) {
		return Math.round(num * 10000) / 100;
	}
	return Math.round(num * 100) / 100;
}

// ─── Apply Mappings to Rows ──────────────────────────────────────────

export function applyMappings(
	sheet: RawSheet,
	mappings: ColumnMapping[],
	tableDef: DbTableDef
): ExtractedTable {
	// Horizontal extraction mode (curva_plan)
	if (tableDef.extractionMode === "horizontal") {
		return extractHorizontalTable(sheet, tableDef);
	}

	const activeMappings = mappings.filter((m) => m.excelHeader !== null);

	const rows = sheet.dataRows.map((excelRow) => {
		const dbRow: Record<string, unknown> = {};
		for (const mapping of activeMappings) {
			const rawValue = excelRow[mapping.excelHeader!];
			const col = tableDef.columns.find((c) => c.key === mapping.dbColumn);
			dbRow[mapping.dbColumn] = coerceValue(rawValue, col?.type ?? "text");
		}
		return dbRow;
	});

	// Filter out rows where all mapped values are empty
	const nonEmptyRows = rows.filter((row) =>
		Object.values(row).some(
			(v) => v !== null && v !== undefined && String(v).trim() !== ""
		)
	);

	return {
		targetTableId: tableDef.id,
		sourceSheetName: sheet.name,
		mappings,
		rows: nonEmptyRows,
		rowCount: nonEmptyRows.length,
	};
}

function coerceValue(
	raw: unknown,
	type: "text" | "numeric" | "date" | "int"
): unknown {
	if (raw === null || raw === undefined) return null;
	const str = String(raw).trim();
	if (str === "" || str === "-") return null;

	switch (type) {
		case "numeric": {
			// Handle $ 1,234,567.89 or $1.234.567,89
			const cleaned = str
				.replace(/[$\s]/g, "")
				.replace(/,/g, ""); // Assume US-style from xlsx
			const num = parseFloat(cleaned);
			return Number.isFinite(num) ? num : str;
		}
		case "int": {
			const cleaned = str.replace(/[^0-9-]/g, "");
			const num = parseInt(cleaned, 10);
			return Number.isFinite(num) ? num : str;
		}
		case "date":
			return str;
		default:
			return str;
	}
}
