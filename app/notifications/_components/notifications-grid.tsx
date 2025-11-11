"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { DataGrid } from "@/components/data-grid/data-grid";
import { DataGridKeyboardShortcuts } from "@/components/data-grid/data-grid-keyboard-shortcuts";
import { DataGridSortMenu } from "@/components/data-grid/data-grid-sort-menu";
import { DataGridRowHeightMenu } from "@/components/data-grid/data-grid-row-height-menu";
import { DataGridViewMenu } from "@/components/data-grid/data-grid-view-menu";
import { useDataGrid } from "@/hooks/use-data-grid";
import { autoFitColumns } from "@/lib/data-table";

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

export function NotificationsGrid({
  rows,
  markRead,
  deleteNotification,
}: {
  rows: NotificationRow[];
  markRead: (fd: FormData) => Promise<void>;
  deleteNotification: (fd: FormData) => Promise<void>;
}) {
  const [data, setData] = React.useState<NotificationRow[]>(rows);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [gridHeight, setGridHeight] = React.useState<number>(600);

  React.useEffect(() => {
    function computeHeight() {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const viewportH = document.documentElement.clientHeight || window.innerHeight;
      const margins = 24; // bottom padding/margins buffer
      const h = Math.max(320, Math.floor(viewportH - rect.top - margins));
      setGridHeight(h);
    }
    computeHeight();
    const onResize = () => computeHeight();
    window.addEventListener("resize", onResize);
    const ro = new ResizeObserver(computeHeight);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => {
      window.removeEventListener("resize", onResize);
      ro.disconnect();
    };
  }, []);

  const columns = React.useMemo<any[]>(
    () => [
      {
        id: "title",
        accessorKey: "title",
        header: "Título",
        meta: {
          label: "Título",
          cell: { variant: "short-text" },
        },
        cell: ({ row }: any) => {
          const r = row.original as NotificationRow;
          const isUnread = !r.read_at;
          return (
            <div className="flex items-start gap-2">
              {isUnread && (
                <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" title="No leída" />
              )}
              <div className="flex flex-col min-w-0">
                <div className={`font-medium truncate ${isUnread ? 'text-foreground' : 'text-foreground/70'}`}>
                  {r.title}
                </div>
                <div className="text-xs text-foreground/60 truncate">{r.type}</div>
              </div>
            </div>
          );
        },
      },
      {
        id: "body",
        accessorKey: "body",
        header: "Detalle",
        meta: {
          label: "Detalle",
          cell: { variant: "long-text" },
        },
      },
      {
        id: "created_at",
        accessorKey: "created_at",
        header: "Fecha",
        meta: {
          label: "Fecha",
          cell: { variant: "date" },
        },
        cell: ({ row }: any) => {
          const r = row.original as NotificationRow;
          const date = new Date(r.created_at);
          const now = new Date();
          const diffMs = now.getTime() - date.getTime();
          const diffMins = Math.floor(diffMs / 60000);
          const diffHours = Math.floor(diffMs / 3600000);
          const diffDays = Math.floor(diffMs / 86400000);

          let timeStr = "";
          if (diffMins < 1) {
            timeStr = "Ahora";
          } else if (diffMins < 60) {
            timeStr = `${diffMins}m`;
          } else if (diffHours < 24) {
            timeStr = `${diffHours}h`;
          } else if (diffDays < 7) {
            timeStr = `${diffDays}d`;
          } else {
            timeStr = date.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
          }

          return (
            <span className="text-xs text-foreground/70" title={date.toLocaleString("es-ES")}>
              {timeStr}
            </span>
          );
        },
      },
      {
        id: "actions",
        header: "Acciones",
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }: any) => {
          const r = row.original as NotificationRow;
          return (
            <div className="flex items-center justify-end gap-1.5">
              {r.action_url ? (
                <Button variant="ghost" size="sm" asChild>
                  <a href={r.action_url || undefined} className="text-xs">
                    <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Abrir
                  </a>
                </Button>
              ) : null}
              {!r.read_at ? (
                <form action={markRead}>
                  <input type="hidden" name="id" value={r.id} />
                  <Button variant="ghost" size="sm" className="text-xs">
                    <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Marcar
                  </Button>
                </form>
              ) : null}
              <form action={deleteNotification}>
                <input type="hidden" name="id" value={r.id} />
                <Button variant="ghost" size="sm" type="submit" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </Button>
              </form>
            </div>
          );
        },
      },
    ],
    [markRead, deleteNotification]
  );

  const { table, ...dataGridProps } = useDataGrid<NotificationRow>({
    data,
    columns,
    onDataChange: setData,
    enableSearch: true,
    autoFocus: true,
    rowHeight: "auto",
  });

  React.useEffect(() => {
    // Auto-fit columns to content on mount and when data length changes
    autoFitColumns(table);
    // Re-run on data length changes (cheap heuristic)
  }, [table, data.length]);

  return (
    <div ref={containerRef} className="flex flex-col gap-4 h-full min-h-0">
      <div className="flex items-center gap-2 self-end">
        <DataGridSortMenu table={table} />
        <DataGridRowHeightMenu table={table} />
        <DataGridViewMenu table={table} />
      </div>
      <DataGridKeyboardShortcuts enableSearch={!!dataGridProps.searchState} />
      <DataGrid table={table} height={gridHeight} {...dataGridProps} />
    </div>
  );
}


