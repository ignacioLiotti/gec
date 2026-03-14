"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  memo,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowUpRight,
  CalendarDays,
  FileText,
  Layers,
  Loader2,
  Plus,
  Settings,
  ToggleLeft,
  Type,
} from "lucide-react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FormTable,
  FormTableContent,
  FormTablePagination,
  FormTableTabs,
  FormTableToolbar,
} from "@/components/form-table/form-table";
import {
  FilterSection,
  RangeInputGroup,
  TextFilterInput,
} from "@/components/form-table/filter-components";
import type {
  ColumnDef,
  FetchRowsArgs,
  FilterRendererProps,
} from "@/components/form-table/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  countActiveMacroFilters,
  isMacroFilterActive,
  matchesMacroFilters,
  type MacroBooleanFilter,
  type MacroTableFilters,
} from "@/lib/macro-table-filters";
import type {
  MacroTable,
  MacroTableColumn,
  MacroTableDataType,
  MacroTableRow as MacroRow,
  MacroTableSource,
} from "@/lib/macro-tables";
import { usePrefetchObra } from "@/lib/use-prefetch-obra";
import { cn } from "@/lib/utils";

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

type MacroDisplayColumn = {
  id: string;
  label: string;
  dataType: MacroTableDataType;
  columnType: "source" | "custom" | "computed";
};

const DS = {
  page: "bg-[#fafafa]",
  shell:
    "rounded-[28px] border border-[#ece7df] bg-[#f6f2eb]/75 p-2 shadow-[0_1px_0_rgba(255,255,255,0.7)_inset,0_18px_45px_rgba(15,23,42,0.06)]",
  shellInner:
    "rounded-[24px] border border-[#f3eee7] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(250,250,250,0.96)_100%)] shadow-[0_1px_0_rgba(255,255,255,0.9)_inset]",
  card:
    "rounded-[22px] border border-[#ece7df] bg-white/95 shadow-[0_1px_0_rgba(255,255,255,0.7)_inset,0_12px_32px_rgba(15,23,42,0.06)]",
};

const toolButtonClass =
  "gap-2 rounded-lg border-[#e8e1d8] bg-white px-3.5 text-[#5a5248] hover:bg-[#fcfaf7] hover:text-[#1f1a17]";

function mapDataTypeToCell(
  dataType: string
): "text" | "number" | "currency" | "checkbox" | "date" {
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

function getFilterIcon(dataType: MacroTableDataType) {
  switch (dataType) {
    case "date":
      return CalendarDays;
    case "number":
    case "currency":
      return Layers;
    case "boolean":
      return ToggleLeft;
    case "text":
    default:
      return Type;
  }
}

function BooleanFilterButtons({
  value,
  onChange,
}: {
  value: MacroBooleanFilter;
  onChange: (next: MacroBooleanFilter) => void;
}) {
  return (
    <div className="flex gap-2">
      {(["all", "true", "false"] as MacroBooleanFilter[]).map((option) => (
        <Button
          key={option}
          type="button"
          size="sm"
          variant={value === option ? "default" : "outline"}
          className="flex-1"
          onClick={() => onChange(option)}
        >
          {option === "all" ? "Todos" : option === "true" ? "Si" : "No"}
        </Button>
      ))}
    </div>
  );
}

const TruncatedTextWithTooltip = memo(function TruncatedTextWithTooltip({
  text,
}: {
  text: string;
}) {
  return (
    <span title={text} className="group-hover:underline truncate block">
      {text}
    </span>
  );
});

const MacroObraLink = memo(function MacroObraLink({
  obraId,
  text,
}: {
  obraId: string;
  text: string;
}) {
  const { prefetchObra } = usePrefetchObra();

  if (!obraId) {
    return <TruncatedTextWithTooltip text={text} />;
  }

  return (
    <Link
      href={`/excel/${obraId}`}
      className="inline-flex h-full w-full items-center gap-2 p-2 font-semibold text-foreground group hover:text-primary"
      onMouseEnter={() => prefetchObra(obraId)}
    >
      <span className="inline-flex h-4 w-4 min-h-4 min-w-4 items-center justify-center rounded shadow-card text-primary/80 group-hover:bg-orange-primary/80 group-hover:text-white">
        <ArrowUpRight className="h-3 w-3 text-muted-foreground group-hover:text-white" />
      </span>
      <TruncatedTextWithTooltip text={text} />
    </Link>
  );
});

function MacroFiltersContent({
  filters,
  onChange,
  columns,
}: FilterRendererProps<MacroTableFilters> & { columns: MacroDisplayColumn[] }) {
  const updateFilter = useCallback(
    (columnId: string, patch: Partial<MacroTableFilters[string]>) => {
      onChange((prev) => ({
        ...prev,
        [columnId]: {
          ...(prev[columnId] ?? {}),
          ...patch,
        },
      }));
    },
    [onChange]
  );

  return (
    <div className="space-y-3">
      {columns.map((column) => {
        const filter = filters[column.id] ?? {};
        const Icon = getFilterIcon(column.dataType);

        return (
          <FilterSection
            key={column.id}
            title={column.label}
            icon={Icon}
            defaultOpen={isMacroFilterActive(filter)}
            activeCount={isMacroFilterActive(filter) ? 1 : 0}
          >
            {column.dataType === "number" || column.dataType === "currency" ? (
              <RangeInputGroup
                label={column.dataType === "currency" ? "Importe" : "Valor"}
                minValue={filter.min ?? ""}
                maxValue={filter.max ?? ""}
                onMinChange={(value) => updateFilter(column.id, { min: value })}
                onMaxChange={(value) => updateFilter(column.id, { max: value })}
                minPlaceholder="Minimo"
                maxPlaceholder="Maximo"
              />
            ) : null}

            {column.dataType === "date" ? (
              <div className="space-y-2">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    Rango
                  </p>
                  <div className="flex items-center gap-2">
                    <Input
                      type="date"
                      value={filter.from ?? ""}
                      onChange={(event) =>
                        updateFilter(column.id, { from: event.target.value })
                      }
                    />
                    <span className="text-muted-foreground">a</span>
                    <Input
                      type="date"
                      value={filter.to ?? ""}
                      onChange={(event) =>
                        updateFilter(column.id, { to: event.target.value })
                      }
                    />
                  </div>
                </div>
              </div>
            ) : null}

            {column.dataType === "boolean" ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Estado
                </p>
                <BooleanFilterButtons
                  value={filter.state ?? "all"}
                  onChange={(state) => updateFilter(column.id, { state })}
                />
              </div>
            ) : null}

            {column.dataType === "text" ? (
              <TextFilterInput
                label="Contiene"
                value={filter.value ?? ""}
                onChange={(value) => updateFilter(column.id, { value })}
                placeholder={`Filtrar ${column.label.toLowerCase()}...`}
              />
            ) : null}
          </FilterSection>
        );
      })}
    </div>
  );
}

function MacroTablePanel({ macroTable }: { macroTable: MacroTableWithDetails }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const columns = macroTable.columns ?? [];
  const hasObraColumn = columns.some(
    (column) =>
      column.columnType === "computed" &&
      column.label.toLowerCase().includes("obra")
  );
  const editableColumns = columns.filter((column) => column.columnType === "custom");
  const displayColumns = useMemo<MacroDisplayColumn[]>(() => {
    const next = columns.map((column) => ({
      id: column.id,
      label: column.label,
      dataType: column.dataType,
      columnType: column.columnType,
    }));

    if (!hasObraColumn) {
      next.unshift({
        id: "_obraName",
        label: "Obra",
        dataType: "text",
        columnType: "computed",
      });
    }

    return next;
  }, [columns, hasObraColumn]);
  const isObraRedirectColumn = useCallback(
    (column: MacroDisplayColumn) =>
      column.id === "_obraName" ||
      (column.columnType === "computed" &&
        column.label.toLowerCase().includes("obra")),
    []
  );

  const macroTableIdRef = useRef(macroTable.id);
  macroTableIdRef.current = macroTable.id;

  const columnsRef = useRef(columns);
  columnsRef.current = columns;

  const displayColumnsRef = useRef(displayColumns);
  displayColumnsRef.current = displayColumns;

  const fetchRows = useCallback(
    async ({
      page,
      limit,
      filters,
      search,
    }: FetchRowsArgs<MacroTableFilters>) => {
      const tableId = macroTableIdRef.current;
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });

      if (search?.trim()) {
        params.set("q", search.trim());
      }

      if (countActiveMacroFilters(filters) > 0) {
        params.set("filters", JSON.stringify(filters));
      }

      const res = await fetch(`/api/macro-tables/${tableId}/rows?${params.toString()}`, {
        cache: "no-store",
      });
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

      return {
        rows,
        pagination: data.pagination,
      };
    },
    []
  );

  const onSave = useCallback(
    async ({ dirtyRows }: { dirtyRows: MacroTableRowData[] }) => {
      const tableId = macroTableIdRef.current;
      const cols = columnsRef.current;
      const customColumnIds = new Set(
        cols.filter((column) => column.columnType === "custom").map((column) => column.id)
      );
      const customValues: Array<{
        sourceRowId: string;
        columnId: string;
        value: unknown;
      }> = [];

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

      const res = await fetch(`/api/macro-tables/${tableId}/rows`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customValues }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Error guardando cambios");
      }

      queryClient.invalidateQueries({ queryKey: ["macro-table-rows", tableId] });
    },
    [queryClient]
  );

  const config = useMemo(() => {
    if (displayColumns.length === 0) return null;

    const columnDefs: ColumnDef<MacroTableRowData>[] = displayColumns.map((column) => {
      const isEditable = column.columnType === "custom";
      const cellType = mapDataTypeToCell(column.dataType);
      const renderAsObraLink = isObraRedirectColumn(column);

      return {
        id: column.id,
        label: column.label,
        field: column.id as never,
        editable: isEditable,
        cellType,
        cellClassName:
          column.columnType === "custom"
            ? "bg-[#fff8ef] group-hover:bg-[#fff3e3] shadow-[inset_0_0_0_1px_rgba(245,158,11,0.18)]"
            : column.columnType === "computed"
              ? "bg-[#f7f4ee]"
              : undefined,
        cellConfig:
          renderAsObraLink
            ? {
                renderReadOnly: ({
                  value,
                  row,
                }: {
                  value: unknown;
                  row: MacroTableRowData;
                }) => {
                  const text = String(value ?? "");
                  if (!text) {
                    return <span className="text-muted-foreground">-</span>;
                  }

                  return <MacroObraLink obraId={String(row._obraId ?? "")} text={text} />;
                },
              }
            : cellType === "currency"
            ? { currencyCode: "ARS", currencyLocale: "es-AR" }
            : cellType === "text"
              ? {
                  renderReadOnly: ({ value }: { value: unknown }) => {
                    const text = String(value ?? "");
                    if (!text) {
                      return <span className="text-muted-foreground">-</span>;
                    }
                    return <TruncatedTextWithTooltip text={text} />;
                  },
                }
              : undefined,
        enableHide: true,
        enablePin: column.id !== "_obraName",
      };
    });

    return {
      tableId: `macro-table-${macroTable.id}`,
      title: macroTable.name,
      description:
        macroTable.description ??
        "Vista agregada de certificados contables con navegacion tipo spreadsheet.",
      enableColumnResizing: true,
      columns: columnDefs,
      fetchRows,
      onSave,
      searchPlaceholder: "Buscar certificados, obras o estados...",
      defaultPageSize: 50,
      pageSizeOptions: [25, 50, 100],
      createFilters: () =>
        displayColumns.reduce<MacroTableFilters>((acc, column) => {
          acc[column.id] = { state: "all" };
          return acc;
        }, {}),
      renderFilters: (props: FilterRendererProps<MacroTableFilters>) => (
        <MacroFiltersContent {...props} columns={displayColumns} />
      ),
      applyFilters: (row: MacroTableRowData, filters: MacroTableFilters) =>
        matchesMacroFilters(row, displayColumnsRef.current, filters),
      countActiveFilters: (filters: MacroTableFilters) =>
        countActiveMacroFilters(filters),
      emptyStateMessage: "No hay datos disponibles en las tablas fuente.",
      showInlineSearch: true,
      showActionsColumn: false,
      allowAddRows: false,
      footerActions: (
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="bg-[#f3eee7] text-[#5a5248]">
            {macroTable.sources.length} fuentes
          </Badge>
          <Badge variant="secondary" className="bg-[#fff4df] text-[#8a5a12]">
            {editableColumns.length} columnas editables
          </Badge>
        </div>
      ),
    };
  }, [
    displayColumns,
    editableColumns.length,
    fetchRows,
    isObraRedirectColumn,
    macroTable.description,
    macroTable.id,
    macroTable.name,
    macroTable.sources.length,
    onSave,
  ]);

  if (!config) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-muted-foreground">
          Esta macro tabla no tiene columnas configuradas.
        </p>
      </div>
    );
  }

  return (
    <div className={cn(DS.card, "p-3")}>
      <FormTable config={config}>
        <div className="space-y-3 px-2 py-2">
          <div className="rounded-2xl border border-[#ece7df] bg-[#fbf8f2] px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-[#ddd4c7] bg-white/80">
                  Spreadsheet
                </Badge>
                <Badge variant="outline" className="border-[#ddd4c7] bg-white/80">
                  Scroll horizontal
                </Badge>
                {editableColumns.length > 0 ? (
                  <Badge
                    variant="outline"
                    className="border-[#f4d7a7] bg-[#fff7ea] text-[#8a5a12]"
                  >
                    Edicion inline en columnas personalizadas
                  </Badge>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className={toolButtonClass}
                  onClick={() => router.push(`/macro/${macroTable.id}/reporte`)}
                >
                  <FileText className="h-4 w-4" />
                  Reportes
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className={toolButtonClass}
                  onClick={() => router.push(`/admin/macro-tables/${macroTable.id}`)}
                >
                  <Settings className="h-4 w-4" />
                  Configurar
                </Button>
              </div>
            </div>
          </div>
          <FormTableToolbar />
          <FormTableTabs />
          <FormTableContent className="md:max-w-[calc(98vw-var(--sidebar-current-width))] overflow-hidden rounded-2xl border border-[#ece7df] shadow-[0_1px_0_rgba(255,255,255,0.75)_inset,0_12px_30px_rgba(15,23,42,0.05)]" />
          <FormTablePagination />
        </div>
      </FormTable>
    </div>
  );
}

function MacroTablesPageContent() {
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
    if (queryMacroId && macroTables.some((macroTable) => macroTable.id === queryMacroId)) {
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
      window.history.replaceState(
        null,
        "",
        `${url.pathname}?${url.searchParams.toString()}`
      );
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

  if (macroTables.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 gap-4 text-center">
        <Layers className="h-12 w-12 text-muted-foreground opacity-30" />
        <div>
          <h2 className="text-lg font-semibold">No hay macro tablas</h2>
          <p className="text-muted-foreground">
            Crea una macro tabla para agregar datos de multiples fuentes.
          </p>
        </div>
        <Button onClick={() => router.push("/admin/macro-tables/new")} className="gap-2">
          <Plus className="h-4 w-4" />
          Nueva macro tabla
        </Button>
      </div>
    );
  }

  return (
    <div className={cn(DS.page, "min-h-full p-4 pt-2")}>
      <div className={DS.shell}>
        <div className={cn(DS.shellInner, "space-y-4 p-4")}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-[#201b16]">
                Macro tablas
              </h1>
              <p className="mt-1 text-sm text-[#6b6258]">
                Visualizacion consolidada de certificados contables con una experiencia mas cercana a la vista Excel.
              </p>
            </div>
            <Button
              onClick={() => router.push("/admin/macro-tables/new")}
              className="gap-2 rounded-xl"
            >
              <Plus className="h-4 w-4" />
              Nueva macro tabla
            </Button>
          </div>

          <Tabs
            value={selectedId ?? macroTables[0].id}
            onValueChange={handleTabChange}
            className="pt-1"
          >
            <TabsList className="h-auto flex-wrap items-start justify-start gap-2 rounded-2xl border border-[#ece7df] bg-white/80 p-2 shadow-[0_1px_0_rgba(255,255,255,0.75)_inset]">
              {macroTables.map((macroTable) => (
                <TabsTrigger
                  key={macroTable.id}
                  value={macroTable.id}
                  className={cn(
                    "flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium text-[#5a5248] data-[state=active]:text-[#1f1a17]",
                    selectedId === macroTable.id
                      ? "border-[#d7d0c3] bg-[#fbf8f2] shadow-[0_1px_0_rgba(255,255,255,0.8)_inset,0_8px_20px_rgba(15,23,42,0.05)]"
                      : "border-transparent bg-transparent hover:border-[#ece7df] hover:bg-white"
                  )}
                >
                  <Layers className="h-4 w-4" />
                  <span className="truncate max-w-[180px]">{macroTable.name}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            {macroTables.map((macroTable) => (
              <TabsContent
                key={macroTable.id}
                value={macroTable.id}
                className={cn("mt-4", macroTable.id === selectedId ? "block" : "hidden")}
                forceMount
              >
                <div className={macroTable.id === selectedId ? "" : "hidden"}>
                  {mountedTabs.has(macroTable.id) ? (
                    <MacroTablePanel macroTable={macroTable} />
                  ) : null}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </div>
    </div>
  );
}

export default function MacroTablesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <MacroTablesPageContent />
    </Suspense>
  );
}
