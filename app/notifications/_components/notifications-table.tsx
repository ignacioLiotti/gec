"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { ColGroup, ColumnResizer } from "@/components/ui/column-resizer";

type NotificationRow = {
  id: string;
  title: string;
  body: string | null;
  type: string;
  action_url: string | null;
  created_at: string;
  read_at: string | null;
  data: any;
};

interface NotificationsTableProps {
  rows: NotificationRow[];
  markRead: (fd: FormData) => Promise<void>;
  deleteNotification: (fd: FormData) => Promise<void>;
}

export function NotificationsTable({
  rows,
  markRead,
  deleteNotification,
}: NotificationsTableProps) {
  const tableId = "notifications-table";
  const [data, setData] = React.useState<NotificationRow[]>(rows);
  const [hiddenCols, setHiddenCols] = React.useState<number[]>([]);
  const [pinnedColumns, setPinnedColumns] = React.useState<number[]>([]);
  const [orderBy, setOrderBy] = React.useState<string>("created_at");
  const [orderDir, setOrderDir] = React.useState<"asc" | "desc">("desc");
  const [resizeMode, setResizeMode] = React.useState<"balanced" | "fixed">("balanced");

  React.useEffect(() => {
    setData(rows);
  }, [rows]);

  const isHidden = React.useCallback((colIndex: number) => hiddenCols.includes(colIndex), [hiddenCols]);
  const isPinned = React.useCallback((colIndex: number) => pinnedColumns.includes(colIndex), [pinnedColumns]);

  const togglePinColumn = React.useCallback((colIndex: number) => {
    setPinnedColumns((prev) => {
      const set = new Set(prev);
      if (set.has(colIndex)) {
        set.delete(colIndex);
      } else {
        set.add(colIndex);
      }
      return Array.from(set).sort((a, b) => a - b);
    });
  }, []);

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
    const observer = new MutationObserver(calculateOffsets);
    const colGroup = table.querySelector("colgroup");
    if (colGroup) {
      observer.observe(colGroup, { attributes: true, childList: true, subtree: true });
    }
    window.addEventListener("resize", calculateOffsets);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", calculateOffsets);
    };
  }, [tableId, pinnedColumns, isHidden]);

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

  const setSortByColumn = (colIndex: number) => {
    const columnMap: Record<number, string> = {
      0: "title",
      1: "body",
      2: "type",
      3: "created_at",
    };
    const column = columnMap[colIndex];
    if (!column) return;

    if (orderBy === column) {
      setOrderDir(orderDir === "asc" ? "desc" : "asc");
    } else {
      setOrderBy(column);
      setOrderDir("asc");
    }
  };

  // Sort data
  const sortedData = React.useMemo(() => {
    const sorted = [...data];
    sorted.sort((a, b) => {
      let aVal: any = a[orderBy as keyof NotificationRow];
      let bVal: any = b[orderBy as keyof NotificationRow];

      if (aVal === null || aVal === undefined) aVal = "";
      if (bVal === null || bVal === undefined) bVal = "";

      if (typeof aVal === "string") aVal = aVal.toLowerCase();
      if (typeof bVal === "string") bVal = bVal.toLowerCase();

      if (aVal < bVal) return orderDir === "asc" ? -1 : 1;
      if (aVal > bVal) return orderDir === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [data, orderBy, orderDir]);

  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Ahora";
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  };

  const COLUMN_TO_DB: Record<number, string> = {
    0: "title",
    1: "body",
    2: "type",
    3: "created_at",
  };

  return (
    <div className="border border-border rounded-xl overflow-hidden shadow-sm w-full">
      <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
        <table className="text-sm table-fixed w-full" data-table-id={tableId}>
          <ColGroup tableId={tableId} columns={5} mode={resizeMode} />
          <thead className="bg-muted/50 sticky top-0 z-30">
            <tr className="border-b">
              <th {...getStickyProps(0, "relative px-4 py-3 text-left text-xs font-semibold uppercase outline outline-border whitespace-normal break-words align-center bg-sidebar")}>
                <ContextMenu>
                  <ContextMenuTrigger asChild>
                    <button type="button" className="hover:underline" onClick={() => setSortByColumn(0)}>
                      Título{orderBy === COLUMN_TO_DB[0] ? (orderDir === "asc" ? " ▲" : " ▼") : ""}
                    </button>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="w-56">
                    <ContextMenuItem onClick={() => { setOrderBy(COLUMN_TO_DB[0]); setOrderDir("asc"); }}>Orden ascendente</ContextMenuItem>
                    <ContextMenuItem onClick={() => { setOrderBy(COLUMN_TO_DB[0]); setOrderDir("desc"); }}>Orden descendente</ContextMenuItem>
                    <ContextMenuItem onClick={() => togglePinColumn(0)}>
                      {isPinned(0) ? "Desfijar columna" : "Fijar columna"}
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
                <ColumnResizer tableId={tableId} colIndex={0} />
              </th>
              <th {...getStickyProps(1, "relative px-4 py-3 text-left text-xs font-semibold uppercase outline outline-border whitespace-normal break-words align-center bg-sidebar")}>
                <ContextMenu>
                  <ContextMenuTrigger asChild>
                    <button type="button" className="hover:underline" onClick={() => setSortByColumn(1)}>
                      Detalle{orderBy === COLUMN_TO_DB[1] ? (orderDir === "asc" ? " ▲" : " ▼") : ""}
                    </button>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="w-56">
                    <ContextMenuItem onClick={() => { setOrderBy(COLUMN_TO_DB[1]); setOrderDir("asc"); }}>Orden ascendente</ContextMenuItem>
                    <ContextMenuItem onClick={() => { setOrderBy(COLUMN_TO_DB[1]); setOrderDir("desc"); }}>Orden descendente</ContextMenuItem>
                    <ContextMenuItem onClick={() => togglePinColumn(1)}>
                      {isPinned(1) ? "Desfijar columna" : "Fijar columna"}
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
                <ColumnResizer tableId={tableId} colIndex={1} />
              </th>
              <th {...getStickyProps(2, "relative px-4 py-3 text-left text-xs font-semibold uppercase outline outline-border whitespace-normal break-words align-center bg-sidebar")}>
                <ContextMenu>
                  <ContextMenuTrigger asChild>
                    <button type="button" className="hover:underline" onClick={() => setSortByColumn(2)}>
                      Tipo{orderBy === COLUMN_TO_DB[2] ? (orderDir === "asc" ? " ▲" : " ▼") : ""}
                    </button>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="w-56">
                    <ContextMenuItem onClick={() => { setOrderBy(COLUMN_TO_DB[2]); setOrderDir("asc"); }}>Orden ascendente</ContextMenuItem>
                    <ContextMenuItem onClick={() => { setOrderBy(COLUMN_TO_DB[2]); setOrderDir("desc"); }}>Orden descendente</ContextMenuItem>
                    <ContextMenuItem onClick={() => togglePinColumn(2)}>
                      {isPinned(2) ? "Desfijar columna" : "Fijar columna"}
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
                <ColumnResizer tableId={tableId} colIndex={2} />
              </th>
              <th {...getStickyProps(3, "relative px-4 py-3 text-left text-xs font-semibold uppercase outline outline-border whitespace-normal break-words align-center bg-sidebar")}>
                <ContextMenu>
                  <ContextMenuTrigger asChild>
                    <button type="button" className="hover:underline" onClick={() => setSortByColumn(3)}>
                      Fecha{orderBy === COLUMN_TO_DB[3] ? (orderDir === "asc" ? " ▲" : " ▼") : ""}
                    </button>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="w-56">
                    <ContextMenuItem onClick={() => { setOrderBy(COLUMN_TO_DB[3]); setOrderDir("asc"); }}>Orden ascendente</ContextMenuItem>
                    <ContextMenuItem onClick={() => { setOrderBy(COLUMN_TO_DB[3]); setOrderDir("desc"); }}>Orden descendente</ContextMenuItem>
                    <ContextMenuItem onClick={() => togglePinColumn(3)}>
                      {isPinned(3) ? "Desfijar columna" : "Fijar columna"}
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
                <ColumnResizer tableId={tableId} colIndex={3} />
              </th>
              <th {...getStickyProps(4, "relative px-4 py-3 text-right text-xs font-semibold uppercase outline outline-border whitespace-normal break-words align-center bg-sidebar")}>
                <ContextMenu>
                  <ContextMenuTrigger asChild>
                    <button type="button" className="hover:underline">
                      Acciones
                    </button>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="w-56">
                    <ContextMenuItem onClick={() => togglePinColumn(4)}>
                      {isPinned(4) ? "Desfijar columna" : "Fijar columna"}
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
                <ColumnResizer tableId={tableId} colIndex={4} />
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedData.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-16 text-center border-t border-border">
                  <p className="text-sm text-muted-foreground">No hay notificaciones</p>
                </td>
              </tr>
            ) : (
              sortedData.map((row) => {
                const isUnread = !row.read_at;
                return (
                  <tr key={row.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                    <td {...getStickyProps(0, "px-4 py-2 outline outline-border border-border bg-background")}>
                      <div className="flex items-start gap-2">
                        {isUnread && (
                          <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" title="No leída" />
                        )}
                        <div className="flex flex-col min-w-0">
                          <div className={`font-medium truncate ${isUnread ? 'text-foreground' : 'text-foreground/70'}`}>
                            {row.title}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td {...getStickyProps(1, "px-4 py-2 outline outline-border border-border bg-background")}>
                      <div className="text-sm text-foreground/80 line-clamp-2">
                        {row.body || "-"}
                      </div>
                    </td>
                    <td {...getStickyProps(2, "px-4 py-2 outline outline-border border-border bg-background")}>
                      <span className="text-xs text-foreground/60">{row.type}</span>
                    </td>
                    <td {...getStickyProps(3, "px-4 py-2 outline outline-border border-border bg-background")}>
                      <span className="text-xs text-foreground/70" title={new Date(row.created_at).toLocaleString("es-ES")}>
                        {formatRelativeTime(row.created_at)}
                      </span>
                    </td>
                    <td {...getStickyProps(4, "px-4 py-2 outline outline-border border-border bg-background")}>
                      <div className="flex items-center justify-end gap-1.5">
                        {row.action_url ? (
                          <Button variant="ghost" size="sm" asChild>
                            <a href={row.action_url || undefined} className="text-xs">
                              <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                              Abrir
                            </a>
                          </Button>
                        ) : null}
                        {!row.read_at ? (
                          <form action={markRead}>
                            <input type="hidden" name="id" value={row.id} />
                            <Button variant="ghost" size="sm" className="text-xs">
                              <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Marcar
                            </Button>
                          </form>
                        ) : null}
                        <form action={deleteNotification}>
                          <input type="hidden" name="id" value={row.id} />
                          <Button variant="ghost" size="sm" type="submit" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </Button>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
