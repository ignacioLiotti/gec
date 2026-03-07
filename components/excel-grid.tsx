"use client";

import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import type { SheetData } from "@/lib/excel-preview";
import { colToLetter } from "@/lib/excel-preview";

interface ExcelGridProps {
  sheet: SheetData;
  /** Orange: already-mapped cells (header + data rows, or single cell) */
  highlightedCells?: Set<string>;
  /** Called when user clicks a cell (enables pick mode styling) */
  onCellClick?: (col: number, row: number) => void;
}

const CELL_WIDTH = 100;
const CELL_HEIGHT = 28;
const ROW_HEADER_WIDTH = 52;
const COL_HEADER_HEIGHT = 28;
const OVERSCAN = 5;

export function ExcelGrid({
  sheet,
  highlightedCells = new Set(),
  onCellClick,
}: ExcelGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [hoveredCol, setHoveredCol] = useState<number | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerSize({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
    setScrollLeft(e.currentTarget.scrollLeft);
  }, []);

  const totalWidth = ROW_HEADER_WIDTH + sheet.colCount * CELL_WIDTH;
  const totalHeight = COL_HEADER_HEIGHT + sheet.rowCount * CELL_HEIGHT;

  const startRow = Math.max(0, Math.floor((scrollTop - COL_HEADER_HEIGHT) / CELL_HEIGHT) - OVERSCAN);
  const endRow = Math.min(sheet.rowCount - 1, Math.ceil((scrollTop + containerSize.height - COL_HEADER_HEIGHT) / CELL_HEIGHT) + OVERSCAN);
  const startCol = Math.max(0, Math.floor((scrollLeft - ROW_HEADER_WIDTH) / CELL_WIDTH) - OVERSCAN);
  const endCol = Math.min(sheet.colCount - 1, Math.ceil((scrollLeft + containerSize.width - ROW_HEADER_WIDTH) / CELL_WIDTH) + OVERSCAN);

  const colLetters = useMemo(() => {
    const letters: string[] = [];
    for (let c = startCol; c <= endCol; c++) letters.push(colToLetter(c));
    return letters;
  }, [startCol, endCol]);

  // Build a lookup set for visible highlighted cells
  const visibleHighlighted = useMemo(() => {
    if (highlightedCells.size === 0) return new Set<string>();
    const set = new Set<string>();
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        const ref = `${colToLetter(c)}${r + 1}`;
        if (highlightedCells.has(ref)) set.add(`${r}-${c}`);
      }
    }
    return set;
  }, [highlightedCells, startRow, endRow, startCol, endCol]);

  // Build highlighted column set for header styling
  const highlightedColIndices = useMemo(() => {
    const cols = new Set<number>();
    for (const ref of highlightedCells) {
      const match = ref.match(/^([A-Z]+)\d+$/);
      if (!match) continue;
      let col = 0;
      for (let i = 0; i < match[1].length; i++) col = col * 26 + (match[1].charCodeAt(i) - 64);
      cols.add(col - 1);
    }
    return cols;
  }, [highlightedCells]);

  const isPicking = onCellClick !== undefined;

  const cells: React.ReactNode[] = [];
  for (let r = startRow; r <= endRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      const value = sheet.data[r]?.[c];
      const isHighlighted = visibleHighlighted.has(`${r}-${c}`);
      const isHovered = isPicking && hoveredCol === c;

      let cellClass = "absolute flex items-center border-r border-b px-2 text-xs font-mono truncate ";
      if (isHighlighted) {
        cellClass += "bg-orange-100 border-orange-200 text-orange-900";
      } else if (isHovered) {
        cellClass += "bg-blue-50 border-blue-200 text-blue-800 cursor-crosshair";
      } else {
        cellClass += `bg-white border-gray-200 text-gray-700${isPicking ? " cursor-crosshair" : ""}`;
      }

      cells.push(
        <div
          key={`${r}-${c}`}
          className={cellClass}
          style={{ top: COL_HEADER_HEIGHT + r * CELL_HEIGHT, left: ROW_HEADER_WIDTH + c * CELL_WIDTH, width: CELL_WIDTH, height: CELL_HEIGHT }}
          title={value != null ? String(value) : ""}
          onMouseEnter={isPicking ? () => setHoveredCol(c) : undefined}
          onMouseLeave={isPicking ? () => setHoveredCol(null) : undefined}
          onClick={onCellClick ? () => onCellClick(c, r) : undefined}
        >
          {value != null ? String(value) : ""}
        </div>
      );
    }
  }

  const colHeaders: React.ReactNode[] = [];
  for (let c = startCol; c <= endCol; c++) {
    const isHighlighted = highlightedColIndices.has(c);
    const isHovered = isPicking && hoveredCol === c;
    let cls = "absolute flex items-center justify-center border-r border-b text-[11px] font-medium ";
    if (isHighlighted) cls += "bg-orange-200 border-orange-300 text-orange-800 font-semibold";
    else if (isHovered) cls += "bg-blue-100 border-blue-200 text-blue-700 font-semibold";
    else cls += "border-gray-200 bg-gray-50 text-gray-500";

    colHeaders.push(
      <div key={`ch-${c}`} className={cls} style={{ top: 0, left: ROW_HEADER_WIDTH + c * CELL_WIDTH, width: CELL_WIDTH, height: COL_HEADER_HEIGHT }} >
        {colLetters[c - startCol]}
      </div>
    );
  }

  const rowHeaders: React.ReactNode[] = [];
  for (let r = startRow; r <= endRow; r++) {
    rowHeaders.push(
      <div key={`rh-${r}`} className="absolute flex items-center justify-center border-r border-b border-gray-200 bg-gray-50 text-[11px] font-medium text-gray-500"
        style={{ top: COL_HEADER_HEIGHT + r * CELL_HEIGHT, left: 0, width: ROW_HEADER_WIDTH, height: CELL_HEIGHT }} >
        {r + 1}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative overflow-auto bg-white" style={{ height: "100%" }} onScroll={handleScroll}>
      <div style={{ width: totalWidth, height: totalHeight, position: "relative" }}>
        <div className="flex items-center justify-center border-r border-b border-gray-200 bg-gray-50"
          style={{ position: "absolute", top: scrollTop, left: scrollLeft, width: ROW_HEADER_WIDTH, height: COL_HEADER_HEIGHT, zIndex: 30 }} />
        <div style={{ position: "absolute", top: scrollTop, left: 0, width: totalWidth, height: COL_HEADER_HEIGHT, zIndex: 20, pointerEvents: "none" }}>
          {colHeaders}
        </div>
        <div style={{ position: "absolute", top: 0, left: scrollLeft, width: ROW_HEADER_WIDTH, height: totalHeight, zIndex: 20, pointerEvents: "none" }}>
          {rowHeaders}
        </div>
        {cells}
      </div>
    </div>
  );
}
