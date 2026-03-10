import * as XLSX from "xlsx";

export interface SheetData {
  name: string;
  data: (string | number | boolean | null)[][];
  rowCount: number;
  colCount: number;
}

export interface ParsedWorkbook {
  fileName: string;
  sheets: SheetData[];
}

export function formatCellRef(col: number, row: number): string {
  return `${colToLetter(col)}${row + 1}`;
}

export function colToLetter(col: number): string {
  let letter = "";
  let temp = col;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
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

export function parseWorkbook(data: ArrayBuffer): ParsedWorkbook {
  const wb = XLSX.read(data, { type: "array" });
  const sheets: SheetData[] = wb.SheetNames.map((name) => {
    const ws = wb.Sheets[name];
    resolveMergedCells(ws);
    const ref = ws["!ref"];
    if (!ref) return { name, data: [], rowCount: 0, colCount: 0 };
    const range = XLSX.utils.decode_range(ref);
    const rowCount = range.e.r + 1;
    const colCount = range.e.c + 1;
    const sheetData: (string | number | boolean | null)[][] = [];
    for (let r = 0; r <= range.e.r; r++) {
      const row: (string | number | boolean | null)[] = [];
      for (let c = 0; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = ws[addr];
        row.push(cell ? (cell.v ?? null) : null);
      }
      sheetData.push(row);
    }
    return { name, data: sheetData, rowCount, colCount };
  });
  return { fileName: "", sheets };
}

