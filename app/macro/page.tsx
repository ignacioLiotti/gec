"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Layers, FileText, Settings, Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
  FormTable,
  FormTableContent,
  FormTablePagination,
  FormTableTabs,
  FormTableToolbar,
} from "@/components/form-table/form-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  MacroTable,
  MacroTableColumn,
  MacroTableRow as MacroRow,
  MacroTableSource,
  MacroTableDataType,
} from "@/lib/macro-tables";

type MacroTableWithDetails = MacroTable & {
  sources: (MacroTableSource & {
    obraTabla?: {
      id: string;
      name: string;
      obraId: string;
      obraName: string;
    };
  })[];
  columns: MacroTableColumn[];
};

type MacroTableRowData = MacroRow & {
  [key: string]: unknown;
};

const ROWS_CACHE_TTL = 5 * 60 * 1000;
const rowsCache = new Map<
  string,
  Map<number, { data: { rows: MacroTableRowData[]; pagination: unknown }; timestamp: number }>
>();

function mapDataTypeToCell(dataType: string): "text" | "number" | "currency" | "checkbox" | "date" {
  switch (dataType) {
    case "number":
      return "number";
    case "currency":
      return "currency";
    case "boolean":
      return "checkbox";
    case "date":
      return "date";
    default:
      return "text";
  }
}

function MacroTablePanel({ macroTable }: { macroTable: MacroTableWithDetails }) {
  const router = useRouter();
  const [columns, setColumns] = useState<MacroTableColumn[]>(macroTable.columns ?? []);

  useEffect(() => {
    setColumns(macroTable.columns ?? []);
  }, [macroTable]);

  const config = useMemo(() => {
    if (columns.length === 0) return null;

    const columnDefs = columns.map((col) => {
      const isEditable = col.columnType === "custom";
      const cellType = mapDataTypeToCell(col.dataType);

      return {
        id: col.id,
        label: col.label,
        field: col.id as any,
        editable: isEditable,
        cellType,
        cellConfig: cellType === "currency"
          ? { currencyCode: "ARS", currencyLocale: "es-AR" }
          : undefined,
        enableHide: true,
        enablePin: true,
      };
    });

    const hasObraColumn = columns.some(
      (c) => c.columnType === "computed" && c.label.toLowerCase().includes("obra"),
    );

    if (!hasObraColumn) {
      columnDefs.unshift({
        id: "_obraName",
        label: "Obra",
        field: "_obraName" as any,
        editable: false,
        cellType: "text",
        cellConfig: undefined,
        enableHide: false,
        enablePin: false,
      });
    }

    const fetchRows = async ({ page, limit }: { page: number; limit: number }) => {
      let tableCache = rowsCache.get(macroTable.id);
      if (!tableCache) {
        tableCache = new Map();
        rowsCache.set(macroTable.id, tableCache);
      }
      const cached = tableCache.get(page);
      if (cached && Date.now() - cached.timestamp < ROWS_CACHE_TTL) {
        return cached.data;
      }
      const res = await fetch(`/api/macro-tables/${macroTable.id}/rows?page=${page}&limit=${limit}`);
      if (!res.ok) throw new Error("Failed to fetch rows");
      const data = await res.json();
      const rows: MacroTableRowData[] = (data.rows ?? []).map((row: MacroRow) => ({
        ...row,
        id: row.id,
        _sourceTablaId: row._sourceTablaId,
        _sourceTablaName: row._sourceTablaName,
        _obraId: row._obraId,
        _obraName: row._obraName,
      }));
      const payload = {
        rows,
        pagination: data.pagination,
      };
      tableCache.set(page, { data: payload, timestamp: Date.now() });
      return payload;
    };

    const onSave = async ({ dirtyRows }: { dirtyRows: MacroTableRowData[] }) => {
      const customColumnIds = new Set(
        columns.filter((c) => c.columnType === "custom").map((c) => c.id),
      );
      const customValues: Array<{ sourceRowId: string; columnId: string; value: unknown }> = [];

      for (const row of dirtyRows) {
        for (const colId of customColumnIds) {
          customValues.push({
            sourceRowId: row.id,
            columnId: colId,
            value: row[colId],
          });
        }
      }

      if (customValues.length === 0) return;

      const res = await fetch(`/api/macro-tables/${macroTable.id}/rows`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customValues }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Error guardando cambios");
      }
      rowsCache.delete(macroTable.id);
    };

    return {
      tableId: `macro-table-${macroTable.id}`,
      title: macroTable.name,
      description: macroTable.description ?? "Vista agregada de múltiples tablas",
      enableColumnResizing: true,
      columns: columnDefs,
      fetchRows,
      onSave,
      searchPlaceholder: "Buscar en macro tabla...",
      lockedPageSize: 10,
      emptyStateMessage: "No hay datos disponibles en las tablas fuente.",
      showInlineSearch: true,
      showActionsColumn: false,
      allowAddRows: false,
    };
  }, [columns, macroTable]);

  if (!config) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-muted-foreground">Esta macro tabla no tiene columnas configuradas.</p>
      </div>
    );
  }

  return (
    <FormTable config={config}>
      <div className="space-y-1 px-2 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2 relative">
          <FormTableToolbar />
          <div className="flex items-center gap-2 ">
            <Button
              variant="ghost"
              size="sm"
              className="gap-2"
              onClick={() => router.push(`/macro/${macroTable.id}/reporte`)}
            >
              <FileText className="h-4 w-4" />
              Reportes
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-2"
              onClick={() => router.push(`/admin/macro-tables/${macroTable.id}`)}
            >
              <Settings className="h-4 w-4" />
              Configurar
            </Button>
          </div>
        </div>
        <FormTableTabs />
        <FormTableContent className="md:max-w-[calc(95vw-var(--sidebar-current-width))]" />
        <FormTablePagination />
      </div>
    </FormTable>
  );
}

export default function MacroTablesPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mountedTabs, setMountedTabs] = useState<Set<string>>(new Set());

  const macroTablesQuery = useQuery<MacroTableWithDetails[]>({
    queryKey: ["macro-tables"],
    queryFn: async () => {
      const res = await fetch("/api/macro-tables");
      if (!res.ok) throw new Error("Failed to load macro tables");
      const data = await res.json();
      return data.macroTables ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const macroTables = macroTablesQuery.data ?? [];

  useEffect(() => {
    if (macroTables.length === 0) return;
    const queryMacroId = searchParams.get("macroId");
    if (queryMacroId && macroTables.some((mt) => mt.id === queryMacroId)) {
      setSelectedId((prev) => (prev === queryMacroId ? prev : queryMacroId));
    } else if (!selectedId) {
      setSelectedId(macroTables[0].id);
    }
  }, [macroTables, searchParams, selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    setMountedTabs((prev) => {
      if (prev.has(selectedId)) return prev;
      const next = new Set(prev);
      next.add(selectedId);
      return next;
    });
  }, [selectedId]);

  const handleTabChange = (value: string) => {
    setSelectedId(value);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("macroId", value);
      window.history.replaceState(null, "", `${url.pathname}?${url.searchParams.toString()}`);
    } else {
      router.replace(`/macro?macroId=${value}`);
    }
  };

  if (macroTablesQuery.isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (macroTablesQuery.isError) {
    return (
      <div className="flex flex-col items-center justify-center p-12 gap-4 text-center text-muted-foreground">
        <Layers className="h-12 w-12 opacity-30" />
        <p>Error cargando macro tablas.</p>
        <Button variant="outline" onClick={() => macroTablesQuery.refetch()}>
          Reintentar
        </Button>
      </div>
    );
  }

  // useEffect(() => {
  //   if (!macroTablesQuery.isLoading && macroTables.length === 0) {
  //     router.push("/admin/macro-tables/new");
  //   }
  // }, [macroTablesQuery.isLoading, macroTables.length, router]);

  if (macroTables.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 gap-4 text-center">
        <Layers className="h-12 w-12 text-muted-foreground opacity-30" />
        <div>
          <h2 className="text-lg font-semibold">No hay macro tablas</h2>
          <p className="text-muted-foreground">Creá una macro tabla para agregar datos de múltiples fuentes.</p>
        </div>
        <Button onClick={() => router.push("/admin/macro-tables/new")} className="gap-2">
          <Plus className="h-4 w-4" />
          Nueva macro tabla
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 pt-2 gap-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Macro tablas</h1>
          {/* <p className="text-muted-foreground">
            Seleccioná una macro tabla para visualizar y editar sus datos.
          </p> */}
        </div>
        <Button onClick={() => router.push("/admin/macro-tables/new")} className="gap-2">
          <Plus className="h-4 w-4" />
          Nueva macro tabla
        </Button>
      </div>

      <Tabs value={selectedId ?? macroTables[0].id} onValueChange={handleTabChange} className=" pt-2">
        <TabsList className="flex gap-4 items-start justify-start border-none p-0 bg-transparent max-w-fit p-2 h-full">
          {macroTables.map((macro) => (
            <TabsTrigger
              key={macro.id}
              value={macro.id}
              className={cn(
                "flex items-center gap-2 rounded-none border px-4 py-2 text-sm font-medium ",
                selectedId === macro.id ? "border-border bg-sidebar outline-8 outline-sidebar shadow-[0px_1px_0px_8px_var(--sidebar),0px_0px_0px_9px_var(--border)]! translate-y-[-1px]" : "border-border bg-sidebar",
              )}
            >
              <Layers className="h-4 w-4" />
              <span className="truncate max-w-[160px]">{macro.name}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {macroTables.map((macro) => (
          <TabsContent key={macro.id} value={macro.id} className={cn("mt-0 pt-0 bg-sidebar shadow-[0px_0px_0px_1px_var(--border)]! ", macro.id === selectedId ? "block" : "hidden")} forceMount>
            <div className={selectedId === macro.id ? "" : "hidden"}>
              {mountedTabs.has(macro.id) ? <MacroTablePanel macroTable={macro} /> : null}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
