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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DemoPageTour } from "@/components/demo-tours/demo-page-tour";
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
import { macroOverviewTour } from "@/lib/demo-tours/screen-tour-flows";
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
  config?: Record<string, unknown>;
};

const toolButtonClass =
  "gap-2 rounded-lg border-[#e8e1d8] bg-white px-3.5 text-[#5a5248] hover:bg-[#fcfaf7] hover:text-[#1f1a17]";

function NotchTail({
  side = "right",
  className = "",
}: {
  side?: "left" | "right";
  className?: string;
}) {
  return (
    <svg
      width="60"
      height="42"
      viewBox="0 0 60 42"
      preserveAspectRatio="none"
      aria-hidden="true"
      className={[
        "pointer-events-none absolute bottom-[-1px] h-[42px] w-[60px]",
        side === "right" ? "right-[-59px]" : "left-[-59px] scale-x-[-1]",
        className,
      ].join(" ")}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M0 1H7.0783C14.772 1 21.7836 5.41324 25.111 12.3501L33.8889 30.6498C37.2164 37.5868 44.228 42 51.9217 42H60H0V1Z"
        className="fill-[var(--notch-bg)]"
      />
      <path
        d="M0 1H7.0783C14.772 1 21.7836 5.41324 25.111 12.3501L33.8889 30.6498C37.2164 37.5868 44.228 42 51.9217 42H60"
        className="fill-none stroke-[var(--notch-stroke)]"
        strokeWidth="1"
      />
    </svg>
  );
}

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
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const columns = macroTable.columns ?? [];
  const hasObraColumn = columns.some(
    (column) =>
      column.columnType === "computed" &&
      column.label.toLowerCase().includes("obra")
  );
  const displayColumns = useMemo<MacroDisplayColumn[]>(() => {
    const next = columns.map((column) => ({
      id: column.id,
      label: column.label,
      dataType: column.dataType,
      columnType: column.columnType,
      config: column.config ?? {},
    }));

    if (!hasObraColumn) {
      next.unshift({
        id: "_obraName",
        label: "Obra",
        dataType: "text",
        columnType: "computed",
        config: {},
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
  const isManuallyEditableColumn = useCallback((column: MacroDisplayColumn) => {
    if (column.columnType === "custom") return true;
    const allowManualEdit = column.config?.allowManualEdit;
    return allowManualEdit === true || allowManualEdit === "true" || allowManualEdit === 1;
  }, []);

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
      const editableColumnIds = new Set(
        cols
          .filter((column) => {
            if (column.columnType === "custom") return true;
            const allowManualEdit = column.config?.allowManualEdit;
            return (
              allowManualEdit === true ||
              allowManualEdit === "true" ||
              allowManualEdit === 1
            );
          })
          .map((column) => column.id)
      );
      const customValues: Array<{
        sourceRowId: string;
        columnId: string;
        value: unknown;
      }> = [];

      for (const row of dirtyRows) {
        for (const colId of editableColumnIds) {
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
      const isEditable = isManuallyEditableColumn(column);
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
    };
  }, [
    displayColumns,
    fetchRows,
    isManuallyEditableColumn,
    isObraRedirectColumn,
    macroTable.description,
    macroTable.id,
    macroTable.name,
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
    <FormTable config={config}>
      <div className="relative ">
        <div className="flex w-full flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div
            data-wizard-target="macro-page-toolbar"
            className="relative flex items-center gap-2 rounded-xl border border-[#09090b1f] bg-card p-2 pb-0 xl:-ml-[1px] xl:rounded-r-none xl:rounded-b-none xl:border-r-0 xl:border-b-0"
            style={
              {
                "--notch-bg": "white",
                "--notch-stroke": "rgb(231 229 228)",
              } as React.CSSProperties
            }
          >
            <FormTableToolbar />
            <NotchTail
              side="right"
              className="z-10 mb-[1px] hidden h-[45px] xl:!block"
            />
          </div>
          <div
            className="relative flex items-center gap-2 rounded-xl border border-[#09090b1f] bg-card p-2 pb-0 
            xl:-mr-[1px] xl:justify-end xl:rounded-l-none xl:rounded-b-none xl:border-l-0 xl:border-b-0 z-10 -mb-[4px]"
            style={
              {
                "--notch-bg": "white",
                "--notch-stroke": "rgb(231 229 228)",
              } as React.CSSProperties
            }
          >
            <NotchTail side="left" className="hidden h-[41px] mb-[1px] xl:!block" />
            <DemoPageTour
              flow={macroOverviewTour}
              buttonClassName="gap-2 rounded-lg border-[#e8e1d8] bg-white px-3.5 text-[#5a5248] hover:bg-[#fcfaf7] hover:text-[#1f1a17]"
            />
            <Button
              variant="outline"
              size="sm"
              className={toolButtonClass}
              data-wizard-target="macro-generar-reporte"
              onClick={() => {
                const isTourActive = searchParams.get("tour") === "macro-overview";
                const dest = `/macro/${macroTable.id}/reporte${isTourActive ? "?tour=macro-report" : ""}`;
                router.push(dest);
              }}
            >
              <FileText className="h-4 w-4" />
              Generar reporte
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
            <Button
              size="sm"
              className="gap-2 rounded-lg bg-[#1f1a17] text-white hover:bg-[#2b241f]"
              onClick={() => router.push("/admin/macro-tables/new")}
            >
              <Plus className="h-4 w-4" />
              Nueva macro tabla
            </Button>
          </div>
        </div>
        <div
          data-wizard-target="macro-page-table"
          className="flex flex-col gap-4 rounded-xl bg-card p-2.5 pt-3.5 shadow-card xl:rounded-t-none"
        >
          <FormTableContent className="md:max-w-[calc(98vw-var(--sidebar-current-width))] my-0 overflow-hidden rounded-lg shadow-card" />
          <Separator className="bg-border" />
          <FormTablePagination />
        </div>
      </div>
    </FormTable>
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
    <Tabs
      value={selectedId ?? macroTables[0].id}
      onValueChange={handleTabChange}
      className="relative p-4 md:p-8 max-w-[calc(100vw-var(--sidebar-current-width))] overflow-hidden"
    >
      <div className="relative">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div data-wizard-target="macro-page-header">
            <h1 className="text-3xl font-semibold tracking-tight text-[#1a1a1a] sm:text-4xl">
              Panel de macrotablas
            </h1>
            <p className="mt-1 text-sm text-[#999]">
              Filtra, busca y actualiza tus macrotablas desde una vista unificada.
            </p>
          </div>
          <div data-wizard-target="macro-page-tabs">
            <TabsList className={cn("flex justify-start rounded-lg p-1 h-11")}>
              {macroTables.map((macroTable) => (
                <TabsTrigger key={macroTable.id} value={macroTable.id} className="px-4">
                  {macroTable.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </div>
        {macroTables.map((macroTable) => (
          <TabsContent
            key={macroTable.id}
            value={macroTable.id}
            className={cn("m-0!important", macroTable.id === selectedId ? "block" : "hidden")}
            forceMount
          >
            <div className={macroTable.id === selectedId ? "" : "hidden"}>
              {mountedTabs.has(macroTable.id) ? (
                <MacroTablePanel macroTable={macroTable} />
              ) : null}
            </div>
          </TabsContent>
        ))}
      </div>
    </Tabs>
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
