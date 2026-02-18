import * as XLSX from "xlsx";
import type { RawSheet } from "./types";
import { analyzeSheets } from "./column-matcher";
import type { ParseResult } from "./types";

/**
 * Resolve merged cells in a worksheet by filling all cells in a merge range
 * with the value from the top-left cell.
 */
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

/**
 * Score a row as a potential header row.
 * Higher score = more likely to be a header.
 */
function scoreRow(row: unknown[]): number {
	if (!row || row.length === 0) return 0;

	let stringCells = 0;
	let numericCells = 0;
	let emptyCells = 0;
	const uniqueStrings = new Set<string>();

	for (const cell of row) {
		const val = String(cell ?? "").trim();
		if (val === "") {
			emptyCells++;
		} else if (/^[\d.,$ %()-]+$/.test(val) && val.length > 0) {
			numericCells++;
		} else {
			stringCells++;
			uniqueStrings.add(val.toLowerCase());
		}
	}

	const total = row.length;
	if (total === 0) return 0;

	// Minimum 3 string cells to be considered a header
	if (stringCells < 3) return 0;

	// Penalize heavily if all string cells are identical (merged cell artifact)
	if (uniqueStrings.size === 1 && stringCells > 2) return 0;

	// Headers have many UNIQUE string cells and few numeric cells
	const uniqueRatio = uniqueStrings.size / total;
	const numericPenalty = numericCells / total;
	const emptyPenalty = emptyCells / total;

	return uniqueRatio * 100 - numericPenalty * 50 - emptyPenalty * 20 + uniqueStrings.size * 3;
}

/**
 * Detect the header row(s) in raw rows.
 * Handles multi-row headers by joining two consecutive high-scoring rows.
 */
function detectHeaderRow(rawRows: unknown[][]): {
	headers: string[];
	headerRowIndex: number;
} {
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
		// Fallback: use first non-empty row
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

	const primaryRow = rawRows[bestIdx];
	const prevRow = bestIdx > 0 ? rawRows[bestIdx - 1] : null;
	const nextRow = rawRows[bestIdx + 1];

	// Determine if this is a multi-row header.
	// Check BOTH the row above (group headers) and the row below (sub-headers).
	// The "top" row is the group row, the "bottom" row has the detail headers.
	let topRow: unknown[] | null = null;
	let botRow: unknown[] | null = null;
	let dataStartIdx = bestIdx;

	const prevScore = prevRow ? scoreRow(prevRow) : 0;
	const nextScore = nextRow ? scoreRow(nextRow) : 0;

	if (prevScore > 0 && prevScore >= bestScore * 0.2) {
		// Row above looks like a group-header row → best row is the sub-header
		topRow = prevRow;
		botRow = primaryRow;
		dataStartIdx = bestIdx;
	} else if (nextScore > bestScore * 0.4) {
		// Row below looks like a sub-header row → best row is the group-header
		topRow = primaryRow;
		botRow = nextRow;
		dataStartIdx = bestIdx + 1;
	}

	if (topRow && botRow) {
		// Forward-fill the top row: propagate non-empty values into
		// subsequent empty cells (handles merged group headers like
		// "AVANCE FISICO" spanning multiple sub-columns)
		const maxLen = Math.max(topRow.length, botRow.length);
		const filledTop: string[] = [];
		let lastNonEmpty = "";
		for (let c = 0; c < maxLen; c++) {
			const val = String(topRow[c] ?? "").trim();
			if (val) lastNonEmpty = val;
			filledTop.push(lastNonEmpty);
		}

		// Join the two rows to form compound headers
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

		// Deduplicate any remaining identical headers by appending index
		const seen = new Map<string, number>();
		for (let i = 0; i < compound.length; i++) {
			const h = compound[i];
			if (!h) continue;
			const count = seen.get(h) ?? 0;
			seen.set(h, count + 1);
			if (count > 0) {
				compound[i] = `${h} (${count + 1})`;
			}
		}

		return { headers: compound, headerRowIndex: dataStartIdx };
	}

	return {
		headers: primaryRow.map((c) => String(c ?? "").trim()),
		headerRowIndex: bestIdx,
	};
}

/**
 * Convert raw rows (after header) into keyed objects.
 * Filters out empty rows and section-header rows.
 */
function rowsToObjects(
	rawRows: unknown[][],
	headers: string[],
	headerRowIndex: number
): Record<string, unknown>[] {
	const results: Record<string, unknown>[] = [];

	for (let i = headerRowIndex + 1; i < rawRows.length; i++) {
		const row = rawRows[i];
		if (!row) continue;

		// Skip fully empty rows
		const nonEmpty = row.filter((c) => String(c ?? "").trim() !== "");
		if (nonEmpty.length === 0) continue;

		const obj: Record<string, unknown> = {};
		for (let c = 0; c < headers.length; c++) {
			const header = headers[c];
			if (header) {
				obj[header] = row[c] ?? null;
			}
		}
		results.push(obj);
	}

	return results;
}

/**
 * Parse a single worksheet into a RawSheet.
 */
function parseSheet(ws: XLSX.WorkSheet, name: string): RawSheet {
	resolveMergedCells(ws);

	const rawRows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
		header: 1,
		raw: false,
		defval: "",
	});

	const { headers, headerRowIndex } = detectHeaderRow(rawRows);
	const dataRows = rowsToObjects(rawRows, headers, headerRowIndex);

	return {
		name,
		rawRows,
		headers,
		headerRowIndex,
		dataRows,
		totalRows: rawRows.length,
	};
}

/**
 * Main entry point: parse an Excel File into a ParseResult.
 */
export async function parseExcelFile(file: File): Promise<ParseResult> {
	const buffer = await file.arrayBuffer();
	const wb = XLSX.read(buffer, {
		type: "array",
		cellDates: true,
		sheetStubs: true,
	});

	const sheets: RawSheet[] = wb.SheetNames.map((name) => {
		const ws = wb.Sheets[name];
		return parseSheet(ws, name);
	}).filter((s) => s.totalRows > 1); // Skip empty sheets

	const analyses = analyzeSheets(sheets);

	return {
		fileName: file.name,
		sheets,
		analyses,
	};
}
