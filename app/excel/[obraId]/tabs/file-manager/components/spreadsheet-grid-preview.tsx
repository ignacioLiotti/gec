"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { Loader2, Crosshair } from "lucide-react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import { parseWorkbook, formatCellRef, type SheetData } from "@/lib/excel-preview";
import { ExcelGrid } from "@/components/excel-grid";

interface SpreadsheetGridPreviewProps {
  bucket: string;
  storagePath: string;
  selectedSheetName: string | null;
  /** Headers of columns already mapped — highlighted in orange */
  mappedExcelHeaders?: string[];
  /** Label of the DB column currently being picked */
  activeMappingLabel?: string | null;
  /** Called with the header text of the column the user clicked */
  onColumnSelect?: (header: string) => void;
  /**
   * Maps excel header string → 0-based column index.
   * Comes from availableSheets[selected].headers — used to resolve compound
   * multi-row headers (e.g. "AVANCE FISICO ANT. %") that never appear in a
   * single cell, bypassing the need to scan for them in the raw sheet data.
   */
  headerToColMap?: Record<string, number>;
  /**
   * Number of data rows the server extracted for this table.
   * > 1  → column highlight (header cell + all data cells below)
   * <= 1 → single-cell highlight (first data cell after the header zone)
   */
  expectedRowCount?: number;
  /**
   * How the server extracted data.
   * "pmc_resumen" → use fixedCellRefs directly
   * "curva_plan"  → scan for "avance mensual" row and highlight its cells
   * undefined     → default vertical column approach
   */
  extractionMode?: "pmc_resumen" | "curva_plan";
  /**
   * pmc_resumen only: fieldKey → A1 cell ref (e.g. "J185").
   * These cells are highlighted directly without any column scanning.
   */
  fixedCellRefs?: Record<string, string>;
}

/**
 * Normalize a cell value string for fuzzy matching:
 * trim, collapse internal whitespace, lowercase.
 */
function normalize(val: unknown): string {
  return String(val ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Highlight cells using a known column index.
 *
 * - Scans the first 25 rows of that column to find the last non-empty cell
 *   in the "header zone" (lastHeaderRow).
 * - isColumnMode=true  → highlights lastHeaderRow cell + all non-empty data cells below.
 * - isColumnMode=false → highlights only the first non-empty data cell after
 *   the header zone (single-cell mode for summary tables like PMC Resumen).
 */
function getHighlightedCellsForColIndex(
  sheet: SheetData,
  colIndex: number,
  isColumnMode: boolean,
): Set<string> {
  const cells = new Set<string>();
  if (colIndex < 0 || colIndex >= sheet.colCount) return cells;

  const HEADER_ZONE = 25;

  // Find the last non-empty cell in the header zone for this column
  let lastHeaderRow = -1;
  for (let r = 0; r < Math.min(sheet.rowCount, HEADER_ZONE); r++) {
    const val = sheet.data[r]?.[colIndex];
    if (val !== null && val !== undefined && val !== "") lastHeaderRow = r;
  }

  if (lastHeaderRow === -1) return cells;

  if (isColumnMode) {
    // Column mode: header cell + every non-empty data cell below
    cells.add(formatCellRef(colIndex, lastHeaderRow));
    for (let r = lastHeaderRow + 1; r < sheet.rowCount; r++) {
      const val = sheet.data[r]?.[colIndex];
      if (val !== null && val !== undefined && val !== "") {
        cells.add(formatCellRef(colIndex, r));
      }
    }
  } else {
    // Single-cell mode: first non-empty cell after the header zone
    for (let r = lastHeaderRow + 1; r < sheet.rowCount; r++) {
      const val = sheet.data[r]?.[colIndex];
      if (val !== null && val !== undefined && val !== "") {
        cells.add(formatCellRef(colIndex, r));
        break;
      }
    }
    // Fallback: if no data after header zone, highlight the header cell itself
    if (cells.size === 0) {
      cells.add(formatCellRef(colIndex, lastHeaderRow));
    }
  }

  return cells;
}

/**
 * For a given header string, find the cells to highlight in the sheet.
 *
 * Primary path (when colIndex is provided): uses column-index-based highlighting —
 * immune to compound multi-row header strings that don't appear in any single cell.
 *
 * Fallback path: scans the first 30 rows looking for a fuzzy exact match.
 */
function getHighlightedCellsForHeader(
  sheet: SheetData,
  excelHeader: string,
  colIndex?: number,
  isColumnMode?: boolean,
): Set<string> {
  // Primary: use column index when available
  if (colIndex !== undefined) {
    return getHighlightedCellsForColIndex(sheet, colIndex, isColumnMode ?? true);
  }

  // Fallback: fuzzy scan
  const cells = new Set<string>();
  if (!excelHeader.trim()) return cells;

  const target = normalize(excelHeader);

  for (let r = 0; r < Math.min(sheet.rowCount, 30); r++) {
    for (let c = 0; c < sheet.colCount; c++) {
      const val = sheet.data[r]?.[c];
      if (val === null || val === undefined || val === "") continue;
      if (normalize(val) !== target) continue;

      // Found the cell at (r, c). Decide: column or single?
      let dataBelowCount = 0;
      for (let dr = r + 1; dr <= Math.min(r + 6, sheet.rowCount - 1); dr++) {
        const v = sheet.data[dr]?.[c];
        if (v !== null && v !== undefined && v !== "") dataBelowCount++;
      }

      if (dataBelowCount >= 2) {
        cells.add(formatCellRef(c, r));
        for (let dr = r + 1; dr < sheet.rowCount; dr++) {
          const v = sheet.data[dr]?.[c];
          if (v !== null && v !== undefined && v !== "") {
            cells.add(formatCellRef(c, dr));
          }
        }
      } else {
        cells.add(formatCellRef(c, r));
      }

      return cells;
    }
  }

  return cells;
}

/**
 * Curva Plan is extracted horizontally: values live in the "Avance Mensual %"
 * row at each month column.  Scan all rows for one whose concatenated text
 * contains "avance" and "mensual", then highlight every non-empty cell in it.
 */
function getHighlightedCellsForCurvaPlan(sheet: SheetData): Set<string> {
  const cells = new Set<string>();
  for (let r = 0; r < sheet.rowCount; r++) {
    const rowText = (sheet.data[r] ?? [])
      .map((v) => normalize(String(v ?? "")))
      .join(" ");
    if (rowText.includes("avance") && rowText.includes("mensual")) {
      for (let c = 0; c < sheet.colCount; c++) {
        const val = sheet.data[r]?.[c];
        if (val !== null && val !== undefined && val !== "") {
          cells.add(formatCellRef(c, r));
        }
      }
      return cells;
    }
  }
  return cells;
}

/**
 * Scan column `col` from the top; return the first non-empty string value
 * (used to identify what "header" the user clicked in pick mode).
 */
function findColumnHeader(sheet: SheetData, col: number): string | null {
  for (let r = 0; r < Math.min(sheet.rowCount, 30); r++) {
    const val = sheet.data[r]?.[col];
    if (val !== null && val !== undefined && val !== "") return String(val).trim();
  }
  return null;
}

export function SpreadsheetGridPreview({
  bucket,
  storagePath,
  selectedSheetName,
  mappedExcelHeaders = [],
  activeMappingLabel = null,
  onColumnSelect,
  headerToColMap,
  expectedRowCount,
  extractionMode,
  fixedCellRefs,
}: SpreadsheetGridPreviewProps) {
  const [sheets, setSheets] = useState<SheetData[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  // Module-level cache keyed by storagePath so remounts don't re-download
  const cacheRef = useRef<Map<string, SheetData[]>>(new Map());

  useEffect(() => {
    const cached = cacheRef.current.get(storagePath);
    if (cached) {
      setSheets(cached);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setSheets(null);

    const supabase = createSupabaseBrowserClient();
    supabase.storage
      .from(bucket)
      .download(storagePath)
      .then(({ data, error: dlErr }) => {
        if (cancelled) return;
        if (dlErr || !data) {
          setError(dlErr?.message ?? "Error al descargar el archivo.");
          setIsLoading(false);
          return;
        }
        return data.arrayBuffer();
      })
      .then((buffer) => {
        if (cancelled || !buffer) return;
        try {
          const wb = parseWorkbook(buffer);
          cacheRef.current.set(storagePath, wb.sheets);
          setSheets(wb.sheets);
        } catch {
          setError("Error al parsear el archivo.");
        }
        setIsLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Error inesperado.");
        setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [bucket, storagePath]);

  const sheet = useMemo(() => {
    if (!sheets) return null;
    if (!selectedSheetName) return sheets[0] ?? null;
    return sheets.find((s) => s.name === selectedSheetName) ?? sheets[0] ?? null;
  }, [sheets, selectedSheetName]);

  /** Orange highlighted cells — recomputed when sheet, mapped headers, or column map changes */
  const highlightedCells = useMemo(() => {
    if (!sheet) return new Set<string>();

    // PMC Resumen: data lives at fixed A1 cell refs — highlight those directly
    if (extractionMode === "pmc_resumen" && fixedCellRefs) {
      const cells = new Set<string>();
      for (const ref of Object.values(fixedCellRefs)) {
        if (ref) cells.add(ref.toUpperCase());
      }
      return cells;
    }

    // Curva Plan: data is in the "Avance Mensual" horizontal row
    if (extractionMode === "curva_plan") {
      return getHighlightedCellsForCurvaPlan(sheet);
    }

    // Default: vertical column approach
    const isColumnMode = (expectedRowCount ?? 0) > 1;
    const combined = new Set<string>();
    for (const header of mappedExcelHeaders) {
      if (!header) continue;
      const colIndex = headerToColMap?.[header];
      const cells = getHighlightedCellsForHeader(sheet, header, colIndex, isColumnMode);
      cells.forEach((c) => combined.add(c));
    }
    return combined;
  }, [sheet, mappedExcelHeaders, headerToColMap, expectedRowCount, extractionMode, fixedCellRefs]);

  const isPicking = activeMappingLabel !== null && onColumnSelect !== undefined;

  function handleCellClick(col: number) {
    if (!sheet || !onColumnSelect) return;
    const header = findColumnHeader(sheet, col);
    if (header) onColumnSelect(header);
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        Cargando hoja…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-destructive px-4 text-center">
        {error}
      </div>
    );
  }

  if (!sheet) return null;

  return (
    <div className="flex h-full flex-col">
      {isPicking && (
        <div className="flex shrink-0 items-center gap-2 border-b bg-blue-50 px-3 py-1.5">
          <Crosshair className="size-3.5 text-blue-600 shrink-0" />
          <p className="text-xs text-blue-700">
            Hacé clic en una columna para asignar a{" "}
            <span className="font-semibold">{activeMappingLabel}</span>
          </p>
        </div>
      )}
      <div className="flex-1 overflow-hidden min-h-0">
        <ExcelGrid
          sheet={sheet}
          highlightedCells={highlightedCells}
          onCellClick={isPicking ? (col) => handleCellClick(col) : undefined}
        />
      </div>
    </div>
  );
}
