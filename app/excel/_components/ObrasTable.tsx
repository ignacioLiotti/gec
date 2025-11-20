'use client';

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { ColGroup, ColumnResizer } from "@/components/ui/column-resizer";
import { InBodyStates } from "./InBodyStates";
import { CustomInput } from "./CustomInput";
import { Input } from "@/components/ui/input";
import { AnimatePresence, motion } from "framer-motion";

type AnyFormApi = {
  Field: any;
  setFieldValue: (...args: any[]) => any;
};

export interface ObrasTableProps {
  formApi: any;
  field: any;
  tableId: string;
  visible: Array<{ index: number }>;
  isLoading: boolean;
  isRefreshing: boolean;
  tableError: string | null;
  onRetry: () => void;
  isHidden: (i: number) => boolean;
  pinnedColumns: number[];
  isPinned: (colIndex: number) => boolean;
  togglePinColumn: (colIndex: number) => void;
  orderBy: string;
  orderDir: "asc" | "desc";
  setOrderBy: (s: string) => void;
  setOrderDir: (d: "asc" | "desc") => void;
  setSortByColumn: (n: number) => void;
  resizeMode: "balanced" | "fixed";
  query: string;
  copyToClipboard: (text: string) => Promise<void> | void;
  obraToCsv: (obra: any) => string;
  FIELD_BY_INDEX: string[];
  COLUMN_TO_DB: Record<number, string>;
  highlightText: (text: string, q: string) => string;
  headerGroupBgClass?: string;
  emptyText: string;
  onFilterByEntidad?: (ent: string) => void;
}

export function ObrasTable(props: ObrasTableProps) {
  const {
    formApi,
    field,
    tableId,
    visible,
    isLoading,
    tableError,
    onRetry,
    isHidden,
    pinnedColumns,
    isPinned,
    togglePinColumn,
    orderBy,
    orderDir,
    setOrderBy,
    setOrderDir,
    setSortByColumn,
    resizeMode,
    query,
    copyToClipboard,
    obraToCsv,
    FIELD_BY_INDEX,
    COLUMN_TO_DB,
    highlightText,
    headerGroupBgClass = "bg-sidebar",
    emptyText,
    onFilterByEntidad,
    isRefreshing,
  } = props;

  // Calculate sticky column offsets dynamically
  const [columnOffsets, setColumnOffsets] = React.useState<Record<number, number>>({});

  React.useEffect(() => {
    const table = document.querySelector(`table[data-table-id="${tableId}"]`);
    if (!table) return;

    const calculateOffsets = () => {
      const cols = table.querySelectorAll<HTMLTableColElement>("colgroup col");
      const offsets: Record<number, number> = {};
      let accumulator = 0;

      pinnedColumns.forEach((colIndex) => {
        if (!isHidden(colIndex)) {
          offsets[colIndex] = accumulator;
          const col = cols[colIndex];
          if (col) {
            const width = col.offsetWidth || parseInt(col.style.width) || 150;
            accumulator += width;
          }
        }
      });

      setColumnOffsets(offsets);
    };

    calculateOffsets();
    // Recalculate when columns resize
    const observer = new MutationObserver(calculateOffsets);
    const colGroup = table.querySelector("colgroup");
    if (colGroup) {
      observer.observe(colGroup, { attributes: true, childList: true, subtree: true });
    }

    // Also recalculate on window resize
    window.addEventListener("resize", calculateOffsets);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", calculateOffsets);
    };
  }, [tableId, pinnedColumns, isHidden]);

  // Helper to generate className and style for sticky columns
  const getStickyProps = React.useCallback((colIndex: number, baseClass: string = "") => {
    const pinned = isPinned(colIndex);
    const offset = columnOffsets[colIndex];

    return {
      className: cn(
        baseClass,
        pinned && offset !== undefined ? "sticky z-20 outline outline-border" : ""
      ),
      style: {
        left: pinned && offset !== undefined ? `${offset}px` : undefined,
        display: isHidden(colIndex) ? "none" : undefined,
      },
    };
  }, [isPinned, columnOffsets, isHidden]);

  const lastIndex = field.state.value.length - 1;
  const showOverlay = isRefreshing || (isLoading && visible.length > 0);

  return (
    <div className="relative border border-border rounded-none overflow-x-scroll w-full max-w-[calc(98vw-var(--sidebar-current-width))] transition-all duration-300 h-[70vh] 
        bg-[repeating-linear-gradient(-60deg,transparent_0%,transparent_5px,var(--border)_5px,var(--border)_6px,transparent_6px)] bg-repeat">
      <AnimatePresence>
        {showOverlay && (
          <motion.div
            key="obras-table-loader"
            className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-background/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <p className="text-sm font-medium text-primary">Actualizando tabla...</p>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="max-h-[70vh]">
        <table className="text-sm table-fixed w-full" data-table-id={tableId}>
          <ColGroup tableId={tableId} columns={14} mode={resizeMode} />
          <thead className="bg-muted/50 sticky top-0 z-30">
            <tr className="border-b">
              <th rowSpan={2} {...getStickyProps(0, "relative px-4 py-3 text-left text-xs font-semibold uppercase outline outline-border whitespace-normal break-words align-center bg-sidebar")}>
                <ContextMenu>
                  <ContextMenuTrigger asChild>
                    <button type="button" className="hover:underline" onClick={() => setSortByColumn(0)}>N°{orderBy === COLUMN_TO_DB[0] ? (orderDir === "asc" ? " ▲" : " ▼") : ""}</button>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="w-56">
                    <ContextMenuItem onClick={() => { setOrderBy(COLUMN_TO_DB[0]); setOrderDir("asc"); }}>Orden ascendente</ContextMenuItem>
                    <ContextMenuItem onClick={() => { setOrderBy(COLUMN_TO_DB[0]); setOrderDir("desc"); }}>Orden descendente</ContextMenuItem>
                    <ContextMenuItem onClick={() => { setOrderBy("n"); setOrderDir("asc"); }}>Quitar orden</ContextMenuItem>
                    <ContextMenuItem onClick={() => togglePinColumn(0)}>
                      {isPinned(0) ? "Desfijar columna" : "Fijar columna"}
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
                <ColumnResizer tableId={tableId} colIndex={0} />
              </th>
              <th rowSpan={2} {...getStickyProps(1, "relative px-4 py-3 text-left text-xs font-semibold uppercase outline outline-border whitespace-normal break-words align-center bg-sidebar")}>
                <ContextMenu>
                  <ContextMenuTrigger asChild>
                    <button type="button" className="hover:underline" onClick={() => setSortByColumn(1)}>DESIGNACIÓN Y UBICACIÓN{orderBy === COLUMN_TO_DB[1] ? (orderDir === "asc" ? " ▲" : " ▼") : ""}</button>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="w-56">
                    <ContextMenuItem onClick={() => { setOrderBy(COLUMN_TO_DB[1]); setOrderDir("asc"); }}>Orden ascendente</ContextMenuItem>
                    <ContextMenuItem onClick={() => { setOrderBy(COLUMN_TO_DB[1]); setOrderDir("desc"); }}>Orden descendente</ContextMenuItem>
                    <ContextMenuItem onClick={() => { setOrderBy("n"); setOrderDir("asc"); }}>Quitar orden</ContextMenuItem>
                    <ContextMenuItem onClick={() => togglePinColumn(1)}>
                      {isPinned(1) ? "Desfijar columna" : "Fijar columna"}
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
                <ColumnResizer tableId={tableId} colIndex={1} />
              </th>
              <th rowSpan={2} {...getStickyProps(2, "relative px-4 py-3 text-center text-xs font-semibold uppercase outline outline-border whitespace-normal break-words align-center bg-sidebar")}>
                <ContextMenu>
                  <ContextMenuTrigger asChild>
                    <button type="button" className="hover:underline" onClick={() => setSortByColumn(2)}>SUP. DE OBRA (M2){orderBy === COLUMN_TO_DB[2] ? (orderDir === "asc" ? " ▲" : " ▼") : ""}</button>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="w-56">
                    <ContextMenuItem onClick={() => { setOrderBy(COLUMN_TO_DB[2]); setOrderDir("asc"); }}>Orden ascendente</ContextMenuItem>
                    <ContextMenuItem onClick={() => { setOrderBy(COLUMN_TO_DB[2]); setOrderDir("desc"); }}>Orden descendente</ContextMenuItem>
                    <ContextMenuItem onClick={() => { setOrderBy("n"); setOrderDir("asc"); }}>Quitar orden</ContextMenuItem>
                    <ContextMenuItem onClick={() => togglePinColumn(2)}>
                      {isPinned(2) ? "Desfijar columna" : "Fijar columna"}
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
                <ColumnResizer tableId={tableId} colIndex={2} />
              </th>
              <th rowSpan={2} {...getStickyProps(3, "relative px-4 py-3 text-center text-xs font-semibold uppercase outline outline-border whitespace-normal break-words align-center bg-sidebar")}>
                <ContextMenu>
                  <ContextMenuTrigger asChild>
                    <button type="button" className="hover:underline" onClick={() => setSortByColumn(3)}>ENTIDAD CONTRATANTE{orderBy === COLUMN_TO_DB[3] ? (orderDir === "asc" ? " ▲" : " ▼") : ""}</button>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="w-56">
                    <ContextMenuItem onClick={() => { setOrderBy(COLUMN_TO_DB[3]); setOrderDir("asc"); }}>Orden ascendente</ContextMenuItem>
                    <ContextMenuItem onClick={() => { setOrderBy(COLUMN_TO_DB[3]); setOrderDir("desc"); }}>Orden descendente</ContextMenuItem>
                    <ContextMenuItem onClick={() => { setOrderBy("n"); setOrderDir("asc"); }}>Quitar orden</ContextMenuItem>
                    <ContextMenuItem onClick={() => togglePinColumn(3)}>
                      {isPinned(3) ? "Desfijar columna" : "Fijar columna"}
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
                <ColumnResizer tableId={tableId} colIndex={3} />
              </th>
              {(() => {
                const count = [4, 5].filter(i => !isHidden(i)).length;
                return (
                  <th colSpan={count || 1} style={{ display: count === 0 ? "none" : undefined }} className={cn("px-4 py-3 text-center text-xs font-semibold uppercase outline outline-border", headerGroupBgClass)}>FECHAS</th>
                );
              })()}
              {(() => {
                const count = [6, 7, 8].filter(i => !isHidden(i)).length;
                return (
                  <th colSpan={count || 1} style={{ display: count === 0 ? "none" : undefined }} className={cn("px-4 py-3 text-center text-xs font-semibold uppercase outline outline-border", headerGroupBgClass)}>IMPORTES (EN PESOS) A VALORES BÁSICOS</th>
                );
              })()}
              {(() => {
                const count = [9, 10, 11, 12].filter(i => !isHidden(i)).length;
                return (
                  <th colSpan={count || 1} style={{ display: count === 0 ? "none" : undefined }} className={cn("px-4 py-3 text-center text-xs font-semibold uppercase outline outline-border", headerGroupBgClass)}>PLAZOS (EN MESES)</th>
                );
              })()}
              <th rowSpan={2} {...getStickyProps(13, "relative px-4 py-3 text-center text-xs font-semibold uppercase whitespace-normal break-words align-center bg-sidebar")}>
                <ContextMenu>
                  <ContextMenuTrigger asChild>
                    <button type="button" className="hover:underline" onClick={() => setSortByColumn(13)}>%{orderBy === COLUMN_TO_DB[13] ? (orderDir === "asc" ? " ▲" : " ▼") : ""}</button>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="w-56">
                    <ContextMenuItem onClick={() => { setOrderBy(COLUMN_TO_DB[13]); setOrderDir("asc"); }}>Orden ascendente</ContextMenuItem>
                    <ContextMenuItem onClick={() => { setOrderBy(COLUMN_TO_DB[13]); setOrderDir("desc"); }}>Orden descendente</ContextMenuItem>
                    <ContextMenuItem onClick={() => { setOrderBy("n"); setOrderDir("asc"); }}>Quitar orden</ContextMenuItem>
                    <ContextMenuItem onClick={() => togglePinColumn(13)}>
                      {isPinned(13) ? "Desfijar columna" : "Fijar columna"}
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
                <ColumnResizer tableId={tableId} colIndex={13} />
              </th>
            </tr>
            <tr className="border-b">
              <th {...getStickyProps(4, "relative px-4 py-2 text-xs font-medium outline outline-border  whitespace-normal break-words align-center bg-sidebar")}>
                <ContextMenu>
                  <ContextMenuTrigger asChild>
                    <button type="button" className="hover:underline" onClick={() => setSortByColumn(4)}>MES BÁSICO DE CONTRATO{orderBy === COLUMN_TO_DB[4] ? (orderDir === "asc" ? " ▲" : " ▼") : ""}</button>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="w-56">
                    <ContextMenuItem onClick={() => { setOrderBy(COLUMN_TO_DB[4]); setOrderDir("asc"); }}>Orden ascendente</ContextMenuItem>
                    <ContextMenuItem onClick={() => { setOrderBy(COLUMN_TO_DB[4]); setOrderDir("desc"); }}>Orden descendente</ContextMenuItem>
                    <ContextMenuItem onClick={() => { setOrderBy("n"); setOrderDir("asc"); }}>Quitar orden</ContextMenuItem>
                    <ContextMenuItem onClick={() => togglePinColumn(4)}>
                      {isPinned(4) ? "Desfijar columna" : "Fijar columna"}
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
                <ColumnResizer tableId={tableId} colIndex={4} />
              </th>
              <th {...getStickyProps(5, "relative px-4 py-2 text-xs font-medium outline outline-border  whitespace-normal break-words align-center bg-sidebar")}>
                <ContextMenu>
                  <ContextMenuTrigger asChild>
                    <button type="button" className="hover:underline" onClick={() => setSortByColumn(5)}>INICIACIÓN{orderBy === COLUMN_TO_DB[5] ? (orderDir === "asc" ? " ▲" : " ▼") : ""}</button>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="w-56">
                    <ContextMenuItem onClick={() => { setOrderBy(COLUMN_TO_DB[5]); setOrderDir("asc"); }}>Orden ascendente</ContextMenuItem>
                    <ContextMenuItem onClick={() => { setOrderBy(COLUMN_TO_DB[5]); setOrderDir("desc"); }}>Orden descendente</ContextMenuItem>
                    <ContextMenuItem onClick={() => { setOrderBy("n"); setOrderDir("asc"); }}>Quitar orden</ContextMenuItem>
                    <ContextMenuItem onClick={() => togglePinColumn(5)}>
                      {isPinned(5) ? "Desfijar columna" : "Fijar columna"}
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
                <ColumnResizer tableId={tableId} colIndex={5} />
              </th>
              <th {...getStickyProps(6, "relative px-4 py-2 text-xs font-medium outline outline-border  whitespace-normal break-words align-center bg-sidebar")}>
                <ContextMenu>
                  <ContextMenuTrigger asChild>
                    <button type="button" className="hover:underline" onClick={() => setSortByColumn(6)}>CONTRATO MÁS AMPLIACIONES{orderBy === COLUMN_TO_DB[6] ? (orderDir === "asc" ? " ▲" : " ▼") : ""}</button>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="w-56">
                    <ContextMenuItem onClick={() => { setOrderBy(COLUMN_TO_DB[6]); setOrderDir("asc"); }}>Orden ascendente</ContextMenuItem>
                    <ContextMenuItem onClick={() => { setOrderBy(COLUMN_TO_DB[6]); setOrderDir("desc"); }}>Orden descendente</ContextMenuItem>
                    <ContextMenuItem onClick={() => { setOrderBy("n"); setOrderDir("asc"); }}>Quitar orden</ContextMenuItem>
                    <ContextMenuItem onClick={() => togglePinColumn(6)}>
                      {isPinned(6) ? "Desfijar columna" : "Fijar columna"}
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
                <ColumnResizer tableId={tableId} colIndex={6} />
              </th>
              <th {...getStickyProps(7, "relative px-4 py-2 text-xs font-medium outline outline-border  whitespace-normal break-words align-center bg-sidebar")}>
                <ContextMenu>
                  <ContextMenuTrigger asChild>
                    <button type="button" className="hover:underline" onClick={() => setSortByColumn(7)}>CERTIFICADO A LA FECHA{orderBy === COLUMN_TO_DB[7] ? (orderDir === "asc" ? " ▲" : " ▼") : ""}</button>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="w-56">
                    <ContextMenuItem onClick={() => { setOrderBy(COLUMN_TO_DB[7]); setOrderDir("asc"); }}>Orden ascendente</ContextMenuItem>
                    <ContextMenuItem onClick={() => { setOrderBy(COLUMN_TO_DB[7]); setOrderDir("desc"); }}>Orden descendente</ContextMenuItem>
                    <ContextMenuItem onClick={() => { setOrderBy("n"); setOrderDir("asc"); }}>Quitar orden</ContextMenuItem>
                    <ContextMenuItem onClick={() => togglePinColumn(7)}>
                      {isPinned(7) ? "Desfijar columna" : "Fijar columna"}
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
                <ColumnResizer tableId={tableId} colIndex={7} />
              </th>
              <th {...getStickyProps(8, "relative px-4 py-2 text-xs font-medium outline outline-border  whitespace-normal break-words align-center bg-sidebar")}>
                <ContextMenu>
                  <ContextMenuTrigger asChild>
                    <button type="button" className="hover:underline" onClick={() => setSortByColumn(8)}>SALDO A CERTIFICAR{orderBy === COLUMN_TO_DB[8] ? (orderDir === "asc" ? " ▲" : " ▼") : ""}</button>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="w-56">
                    <ContextMenuItem onClick={() => { setOrderBy(COLUMN_TO_DB[8]); setOrderDir("asc"); }}>Orden ascendente</ContextMenuItem>
                    <ContextMenuItem onClick={() => { setOrderBy(COLUMN_TO_DB[8]); setOrderDir("desc"); }}>Orden descendente</ContextMenuItem>
                    <ContextMenuItem onClick={() => { setOrderBy("n"); setOrderDir("asc"); }}>Quitar orden</ContextMenuItem>
                    <ContextMenuItem onClick={() => togglePinColumn(8)}>
                      {isPinned(8) ? "Desfijar columna" : "Fijar columna"}
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
                <ColumnResizer tableId={tableId} colIndex={8} />
              </th>
              <th {...getStickyProps(9, "relative px-4 py-2 text-xs font-medium outline outline-border  whitespace-normal break-words align-center bg-sidebar")}>
                <ContextMenu>
                  <ContextMenuTrigger asChild>
                    <button type="button" className="hover:underline" onClick={() => setSortByColumn(9)}>SEGÚN CONTRATO{orderBy === COLUMN_TO_DB[9] ? (orderDir === "asc" ? " ▲" : " ▼") : ""}</button>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="w-56">
                    <ContextMenuItem onClick={() => { setOrderBy(COLUMN_TO_DB[9]); setOrderDir("asc"); }}>Orden ascendente</ContextMenuItem>
                    <ContextMenuItem onClick={() => { setOrderBy(COLUMN_TO_DB[9]); setOrderDir("desc"); }}>Orden descendente</ContextMenuItem>
                    <ContextMenuItem onClick={() => { setOrderBy("n"); setOrderDir("asc"); }}>Quitar orden</ContextMenuItem>
                    <ContextMenuItem onClick={() => togglePinColumn(9)}>
                      {isPinned(9) ? "Desfijar columna" : "Fijar columna"}
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
                <ColumnResizer tableId={tableId} colIndex={9} />
              </th>
              <th {...getStickyProps(10, "relative px-4 py-2 text-xs font-medium outline outline-border  whitespace-normal break-words align-center bg-sidebar")}>
                <ContextMenu>
                  <ContextMenuTrigger asChild>
                    <button type="button" className="hover:underline" onClick={() => setSortByColumn(10)}>PRORROGAS ACORDADAS{orderBy === COLUMN_TO_DB[10] ? (orderDir === "asc" ? " ▲" : " ▼") : ""}</button>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="w-56">
                    <ContextMenuItem onClick={() => { setOrderBy(COLUMN_TO_DB[10]); setOrderDir("asc"); }}>Orden ascendente</ContextMenuItem>
                    <ContextMenuItem onClick={() => { setOrderBy(COLUMN_TO_DB[10]); setOrderDir("desc"); }}>Orden descendente</ContextMenuItem>
                    <ContextMenuItem onClick={() => { setOrderBy("n"); setOrderDir("asc"); }}>Quitar orden</ContextMenuItem>
                    <ContextMenuItem onClick={() => togglePinColumn(10)}>
                      {isPinned(10) ? "Desfijar columna" : "Fijar columna"}
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
                <ColumnResizer tableId={tableId} colIndex={10} />
              </th>
              <th {...getStickyProps(11, "relative px-4 py-2 text-xs font-medium outline outline-border  whitespace-normal break-words align-center bg-sidebar")}>
                <ContextMenu>
                  <ContextMenuTrigger asChild>
                    <button type="button" className="hover:underline" onClick={() => setSortByColumn(11)}>PLAZO TOTAL{orderBy === COLUMN_TO_DB[11] ? (orderDir === "asc" ? " ▲" : " ▼") : ""}</button>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="w-56">
                    <ContextMenuItem onClick={() => { setOrderBy(COLUMN_TO_DB[11]); setOrderDir("asc"); }}>Orden ascendente</ContextMenuItem>
                    <ContextMenuItem onClick={() => { setOrderBy(COLUMN_TO_DB[11]); setOrderDir("desc"); }}>Orden descendente</ContextMenuItem>
                    <ContextMenuItem onClick={() => { setOrderBy("n"); setOrderDir("asc"); }}>Quitar orden</ContextMenuItem>
                    <ContextMenuItem onClick={() => togglePinColumn(11)}>
                      {isPinned(11) ? "Desfijar columna" : "Fijar columna"}
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
                <ColumnResizer tableId={tableId} colIndex={11} />
              </th>
              <th {...getStickyProps(12, "relative px-4 py-2 text-xs font-medium outline outline-border  whitespace-normal break-words align-center bg-sidebar")}>
                <ContextMenu>
                  <ContextMenuTrigger asChild>
                    <button type="button" className="hover:underline" onClick={() => setSortByColumn(12)}>PLAZO TOTAL TRANSCURRIDO{orderBy === COLUMN_TO_DB[12] ? (orderDir === "asc" ? " ▲" : " ▼") : ""}</button>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="w-56">
                    <ContextMenuItem onClick={() => { setOrderBy(COLUMN_TO_DB[12]); setOrderDir("asc"); }}>Orden ascendente</ContextMenuItem>
                    <ContextMenuItem onClick={() => { setOrderBy(COLUMN_TO_DB[12]); setOrderDir("desc"); }}>Orden descendente</ContextMenuItem>
                    <ContextMenuItem onClick={() => { setOrderBy("n"); setOrderDir("asc"); }}>Quitar orden</ContextMenuItem>
                    <ContextMenuItem onClick={() => togglePinColumn(12)}>
                      {isPinned(12) ? "Desfijar columna" : "Fijar columna"}
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
                <ColumnResizer tableId={tableId} colIndex={12} />
              </th>
            </tr>
          </thead>
          <tbody>
            {(tableError || visible.length === 0) ? (
              <InBodyStates
                isLoading={isLoading}
                tableError={tableError}
                colspan={16}
                empty={visible.length === 0}
                onRetry={onRetry}
                emptyText={emptyText}
              />
            ) : (
              visible.map(({ index }, visualIndex) => (
                <React.Fragment key={index}>
                  <ContextMenu>
                    <ContextMenuTrigger asChild>
                      <tr className={cn(
                        "transition-colors duration-150 hover:bg-muted/50",
                        visualIndex % 2 === 0 ? "bg-background" : "bg-card/40",
                        index === lastIndex ? "border-b" : ""
                      )}>
                        <formApi.Field name={`detalleObras[${index}].n`}>
                          {(subField: any) => (
                            <td {...getStickyProps(0, "px-2 pl-4 py-2  outline outline-border border-border relative bg-background")}>
                              <ContextMenu>
                                <ContextMenuTrigger asChild>
                                  <div className="min-h-[18px]">{subField.state.value}</div>
                                </ContextMenuTrigger>
                                <ContextMenuContent className="w-52">
                                  <ContextMenuItem onClick={() => void copyToClipboard(String(subField.state.value ?? ""))}>Copiar valor</ContextMenuItem>
                                  <ContextMenuItem onClick={() => subField.handleChange(Number.NaN as any)}>Limpiar valor</ContextMenuItem>
                                  <ContextMenuItem onClick={() => {
                                    const colValues = visible.map(({ index: idx }) => String(field.state.value[idx]?.[FIELD_BY_INDEX[0]] ?? ""));
                                    void copyToClipboard(colValues.join("\n"));
                                  }}>Copiar columna</ContextMenuItem>
                                  <ContextMenuItem onClick={() => {
                                    const obra = field.state.value[index];
                                    if (obra) void copyToClipboard(obraToCsv(obra));
                                  }}>Copiar fila (CSV)</ContextMenuItem>
                                </ContextMenuContent>
                              </ContextMenu>
                            </td>
                          )}
                        </formApi.Field>
                        <formApi.Field name={`detalleObras[${index}].designacionYUbicacion`}>
                          {(subField: any) => (
                            <td {...getStickyProps(1, " outline outline-border border-border p-0 align-center px-2 py-2 bg-background")}>
                              <ContextMenu>
                                <ContextMenuTrigger asChild>
                                  {/* if there is no value for the name then asume its the first time it was created then make it editable */}
                                  {subField.state.value ? (
                                    <div className="min-h-[18px]">
                                      <Link href={`/excel/${field.state.value[index]?.id}`} className="cursor-pointer" dangerouslySetInnerHTML={{ __html: highlightText(String(subField.state.value ?? ""), query) }} />
                                    </div>
                                  ) : (
                                    <div className="min-h-[18px]">
                                      <Input type="text" value={subField.state.value ?? ""} onChange={(event) => subField.handleChange(event.target.value)} onBlur={subField.handleBlur} className="w-full text-sm border" />
                                    </div>
                                  )}
                                </ContextMenuTrigger>
                                <ContextMenuContent className="w-52">
                                  <ContextMenuItem onClick={() => void copyToClipboard(String(subField.state.value ?? ""))}>Copiar valor</ContextMenuItem>
                                  <ContextMenuItem onClick={() => subField.handleChange("")}>Limpiar valor</ContextMenuItem>
                                  <ContextMenuItem onClick={() => {
                                    const colValues = visible.map(({ index: idx }) => String(field.state.value[idx]?.[FIELD_BY_INDEX[1]] ?? ""));
                                    void copyToClipboard(colValues.join("\n"));
                                  }}>Copiar columna</ContextMenuItem>
                                  <ContextMenuItem onClick={() => {
                                    const obra = field.state.value[index];
                                    if (obra) void copyToClipboard(obraToCsv(obra));
                                  }}>Copiar fila (CSV)</ContextMenuItem>
                                </ContextMenuContent>
                              </ContextMenu>
                            </td>
                          )}
                        </formApi.Field>

                        <formApi.Field name={`detalleObras[${index}].supDeObraM2`}>
                          {(subField: any) => (
                            <td {...getStickyProps(2, " outline outline-border border-border p-0 relative table-cell bg-background")}>
                              <ContextMenu>
                                <ContextMenuTrigger asChild>
                                  <div className="absolute inset-0 px-2 py-2">
                                    <CustomInput type="number" value={subField.state.value} onChange={(event) => subField.handleChange(Number(event.target.value))} onBlur={subField.handleBlur} className="w-full text-sm border text-right" />
                                  </div>
                                </ContextMenuTrigger>
                                <ContextMenuContent className="w-52">
                                  <ContextMenuItem onClick={() => void copyToClipboard(String(subField.state.value ?? ""))}>Copiar valor</ContextMenuItem>
                                  <ContextMenuItem onClick={() => subField.handleChange(0 as any)}>Limpiar valor</ContextMenuItem>
                                  <ContextMenuItem onClick={() => {
                                    const colValues = visible.map(({ index: idx }) => String(field.state.value[idx]?.[FIELD_BY_INDEX[2]] ?? ""));
                                    void copyToClipboard(colValues.join("\n"));
                                  }}>Copiar columna</ContextMenuItem>
                                  <ContextMenuItem onClick={() => {
                                    const obra = field.state.value[index];
                                    if (obra) void copyToClipboard(obraToCsv(obra));
                                  }}>Copiar fila (CSV)</ContextMenuItem>
                                </ContextMenuContent>
                              </ContextMenu>
                            </td>
                          )}
                        </formApi.Field>

                        <formApi.Field name={`detalleObras[${index}].entidadContratante`}>
                          {(subField: any) => (
                            <td {...getStickyProps(3, " outline outline-border border-border p-0 relative table-cell bg-background")}>
                              <ContextMenu>
                                <ContextMenuTrigger asChild>
                                  <div className="absolute inset-0 px-2 py-2">
                                    <CustomInput type="text" value={subField.state.value ?? ""} onChange={(event) => subField.handleChange(event.target.value)} onBlur={subField.handleBlur} className="w-full text-sm border" />
                                  </div>
                                </ContextMenuTrigger>
                                <ContextMenuContent className="w-52">
                                  <ContextMenuItem onClick={() => void copyToClipboard(String(subField.state.value ?? ""))}>Copiar valor</ContextMenuItem>
                                  <ContextMenuItem onClick={() => subField.handleChange("")}>Limpiar valor</ContextMenuItem>
                                  <ContextMenuItem onClick={() => {
                                    const colValues = visible.map(({ index: idx }) => String(field.state.value[idx]?.[FIELD_BY_INDEX[3]] ?? ""));
                                    void copyToClipboard(colValues.join("\n"));
                                  }}>Copiar columna</ContextMenuItem>
                                  <ContextMenuItem onClick={() => {
                                    const obra = field.state.value[index];
                                    if (obra) void copyToClipboard(obraToCsv(obra));
                                  }}>Copiar fila (CSV)</ContextMenuItem>
                                </ContextMenuContent>
                              </ContextMenu>
                            </td>
                          )}
                        </formApi.Field>

                        <formApi.Field name={`detalleObras[${index}].mesBasicoDeContrato`}>
                          {(subField: any) => (
                            <td {...getStickyProps(4, " outline outline-border border-border p-0 relative table-cell bg-background")}>
                              <ContextMenu>
                                <ContextMenuTrigger asChild>
                                  <div className="absolute inset-0 px-2 py-2">
                                    <CustomInput type="text" value={subField.state.value ?? ""} onChange={(event) => subField.handleChange(event.target.value)} onBlur={subField.handleBlur} className="w-full text-sm border" />
                                  </div>
                                </ContextMenuTrigger>
                                <ContextMenuContent className="w-52">
                                  <ContextMenuItem onClick={() => void copyToClipboard(String(subField.state.value ?? ""))}>Copiar valor</ContextMenuItem>
                                  <ContextMenuItem onClick={() => subField.handleChange("")}>Limpiar valor</ContextMenuItem>
                                  <ContextMenuItem onClick={() => {
                                    const colValues = visible.map(({ index: idx }) => String(field.state.value[idx]?.[FIELD_BY_INDEX[4]] ?? ""));
                                    void copyToClipboard(colValues.join("\n"));
                                  }}>Copiar columna</ContextMenuItem>
                                  <ContextMenuItem onClick={() => {
                                    const obra = field.state.value[index];
                                    if (obra) void copyToClipboard(obraToCsv(obra));
                                  }}>Copiar fila (CSV)</ContextMenuItem>
                                </ContextMenuContent>
                              </ContextMenu>
                            </td>
                          )}
                        </formApi.Field>

                        <formApi.Field name={`detalleObras[${index}].iniciacion`}>
                          {(subField: any) => (
                            <td {...getStickyProps(5, " outline outline-border border-border p-0 relative table-cell bg-background")}>
                              <ContextMenu>
                                <ContextMenuTrigger asChild>
                                  <div className="absolute inset-0 px-2 py-2">
                                    <CustomInput type="text" value={subField.state.value ?? ""} onChange={(event) => subField.handleChange(event.target.value)} onBlur={subField.handleBlur} className="w-full text-sm border" />
                                  </div>
                                </ContextMenuTrigger>
                                <ContextMenuContent className="w-52">
                                  <ContextMenuItem onClick={() => void copyToClipboard(String(subField.state.value ?? ""))}>Copiar valor</ContextMenuItem>
                                  <ContextMenuItem onClick={() => subField.handleChange("")}>Limpiar valor</ContextMenuItem>
                                  <ContextMenuItem onClick={() => {
                                    const colValues = visible.map(({ index: idx }) => String(field.state.value[idx]?.[FIELD_BY_INDEX[5]] ?? ""));
                                    void copyToClipboard(colValues.join("\n"));
                                  }}>Copiar columna</ContextMenuItem>
                                  <ContextMenuItem onClick={() => {
                                    const obra = field.state.value[index];
                                    if (obra) void copyToClipboard(obraToCsv(obra));
                                  }}>Copiar fila (CSV)</ContextMenuItem>
                                </ContextMenuContent>
                              </ContextMenu>
                            </td>
                          )}
                        </formApi.Field>

                        <formApi.Field name={`detalleObras[${index}].contratoMasAmpliaciones`}>
                          {(subField: any) => (
                            <td {...getStickyProps(6, " outline outline-border border-border p-0 relative table-cell bg-background")}>
                              <ContextMenu>
                                <ContextMenuTrigger asChild>
                                  <div className="absolute inset-0 px-2 py-2">
                                    <CustomInput type="number" value={subField.state.value} onChange={(event) => subField.handleChange(Number(event.target.value))} onBlur={subField.handleBlur} className="w-full text-sm border text-right font-mono" />
                                  </div>
                                </ContextMenuTrigger>
                                <ContextMenuContent className="w-52">
                                  <ContextMenuItem onClick={() => void copyToClipboard(String(subField.state.value ?? ""))}>Copiar valor</ContextMenuItem>
                                  <ContextMenuItem onClick={() => subField.handleChange(0 as any)}>Limpiar valor</ContextMenuItem>
                                  <ContextMenuItem onClick={() => {
                                    const colValues = visible.map(({ index: idx }) => String(field.state.value[idx]?.[FIELD_BY_INDEX[6]] ?? ""));
                                    void copyToClipboard(colValues.join("\n"));
                                  }}>Copiar columna</ContextMenuItem>
                                  <ContextMenuItem onClick={() => {
                                    const obra = field.state.value[index];
                                    if (obra) void copyToClipboard(obraToCsv(obra));
                                  }}>Copiar fila (CSV)</ContextMenuItem>
                                </ContextMenuContent>
                              </ContextMenu>
                            </td>
                          )}
                        </formApi.Field>

                        <formApi.Field name={`detalleObras[${index}].certificadoALaFecha`}>
                          {(subField: any) => (
                            <td {...getStickyProps(7, " outline outline-border border-border p-0 relative table-cell bg-background")}>
                              <ContextMenu>
                                <ContextMenuTrigger asChild>
                                  <div className="absolute inset-0 px-2 py-2">
                                    <CustomInput type="number" value={subField.state.value} onChange={(event) => subField.handleChange(Number(event.target.value))} onBlur={subField.handleBlur} className="w-full text-sm border text-right font-mono" />
                                  </div>
                                </ContextMenuTrigger>
                                <ContextMenuContent className="w-52">
                                  <ContextMenuItem onClick={() => void copyToClipboard(String(subField.state.value ?? ""))}>Copiar valor</ContextMenuItem>
                                  <ContextMenuItem onClick={() => subField.handleChange(0 as any)}>Limpiar valor</ContextMenuItem>
                                  <ContextMenuItem onClick={() => {
                                    const colValues = visible.map(({ index: idx }) => String(field.state.value[idx]?.[FIELD_BY_INDEX[7]] ?? ""));
                                    void copyToClipboard(colValues.join("\n"));
                                  }}>Copiar columna</ContextMenuItem>
                                  <ContextMenuItem onClick={() => {
                                    const obra = field.state.value[index];
                                    if (obra) void copyToClipboard(obraToCsv(obra));
                                  }}>Copiar fila (CSV)</ContextMenuItem>
                                </ContextMenuContent>
                              </ContextMenu>
                            </td>
                          )}
                        </formApi.Field>

                        <formApi.Field name={`detalleObras[${index}].saldoACertificar`}>
                          {(subField: any) => (
                            <td {...getStickyProps(8, " outline outline-border border-border p-0 relative table-cell bg-background")}>
                              <ContextMenu>
                                <ContextMenuTrigger asChild>
                                  <div className="absolute inset-0 px-2 py-2">
                                    <CustomInput type="number" value={subField.state.value} onChange={(event) => subField.handleChange(Number(event.target.value))} onBlur={subField.handleBlur} className="w-full text-sm border text-right font-mono" />
                                  </div>
                                </ContextMenuTrigger>
                                <ContextMenuContent className="w-52">
                                  <ContextMenuItem onClick={() => void copyToClipboard(String(subField.state.value ?? ""))}>Copiar valor</ContextMenuItem>
                                  <ContextMenuItem onClick={() => subField.handleChange(0 as any)}>Limpiar valor</ContextMenuItem>
                                  <ContextMenuItem onClick={() => {
                                    const colValues = visible.map(({ index: idx }) => String(field.state.value[idx]?.[FIELD_BY_INDEX[8]] ?? ""));
                                    void copyToClipboard(colValues.join("\n"));
                                  }}>Copiar columna</ContextMenuItem>
                                  <ContextMenuItem onClick={() => {
                                    const obra = field.state.value[index];
                                    if (obra) void copyToClipboard(obraToCsv(obra));
                                  }}>Copiar fila (CSV)</ContextMenuItem>
                                </ContextMenuContent>
                              </ContextMenu>
                            </td>
                          )}
                        </formApi.Field>

                        <formApi.Field name={`detalleObras[${index}].segunContrato`}>
                          {(subField: any) => (<td {...getStickyProps(9, " outline outline-border border-border p-0 relative table-cell bg-background")}><CustomInput type="number" value={subField.state.value} onChange={(event) => subField.handleChange(Number(event.target.value))} onBlur={subField.handleBlur} className="absolute inset-0 px-2 py-2 text-sm border text-right" /></td>)}
                        </formApi.Field>

                        <formApi.Field name={`detalleObras[${index}].prorrogasAcordadas`}>
                          {(subField: any) => (<td {...getStickyProps(10, " outline outline-border border-border p-0 relative table-cell bg-background")}><CustomInput type="number" value={subField.state.value} onChange={(event) => subField.handleChange(Number(event.target.value))} onBlur={subField.handleBlur} className="absolute inset-0 px-2 py-2 text-sm border text-right" /></td>)}
                        </formApi.Field>

                        <formApi.Field name={`detalleObras[${index}].plazoTotal`}>
                          {(subField: any) => (<td {...getStickyProps(11, " outline outline-border border-border p-0 relative table-cell bg-background")}><CustomInput type="number" value={subField.state.value} onChange={(event) => subField.handleChange(Number(event.target.value))} onBlur={subField.handleBlur} className="absolute inset-0 px-2 py-2 text-sm	border text-right" /></td>)}
                        </formApi.Field>

                        <formApi.Field name={`detalleObras[${index}].plazoTransc`}>
                          {(subField: any) => (<td {...getStickyProps(12, " outline outline-border border-border p-0 relative table-cell bg-background")}><CustomInput type="number" value={subField.state.value} onChange={(event) => subField.handleChange(Number(event.target.value))} onBlur={subField.handleBlur} className="absolute inset-0 px-2 py-2 text-sm border text-right" /></td>)}
                        </formApi.Field>

                        <formApi.Field name={`detalleObras[${index}].porcentaje`}>
                          {(subField: any) => (
                            <td {...getStickyProps(13, " outline outline-border border-border p-0 relative table-cell bg-background")}>
                              <CustomInput type="number" step="0.01" value={subField.state.value} onChange={(event) => subField.handleChange(Number(event.target.value))} onBlur={subField.handleBlur} className="absolute inset-0 px-2 py-2 text-sm border text-right" />
                            </td>
                          )}
                        </formApi.Field>
                      </tr>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-56">
                      <ContextMenuItem onClick={() => {
                        const obra = field.state.value[index];
                        if (obra) void copyToClipboard(obraToCsv(obra));
                      }}>Copiar fila (CSV)</ContextMenuItem>
                      <ContextMenuItem onClick={() => {
                        const obra = field.state.value[index];
                        if (!obra) return;
                        const nextN = field.state.value.reduce((max: number, it: any) => Math.max(max, it.n), 0) + 1;
                        const copy = { ...obra, id: undefined, n: nextN };
                        const arr = field.state.value.slice();
                        arr.splice(index + 1, 0, copy);
                        formApi.setFieldValue("detalleObras", arr);
                      }}>Duplicar fila</ContextMenuItem>
                      <ContextMenuItem onClick={() => {
                        if (field.state.value.length <= 1) {
                          // toast available in parent; keep UX minimal here
                          return;
                        }
                        const arr = field.state.value.filter((_: any, i: number) => i !== index);
                        formApi.setFieldValue("detalleObras", arr);
                      }}>Eliminar fila</ContextMenuItem>
                      <ContextMenuItem onClick={() => {
                        const obra = field.state.value[index];
                        const ent = obra?.entidadContratante?.trim?.();
                        if (!ent) return;
                        onFilterByEntidad?.(ent);
                      }}>Filtrar por esta entidad</ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}


