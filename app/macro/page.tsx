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
  ArrowDown,
  ArrowUpRight,
  ArrowUp,
  ArrowUpDown,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  FileText,
  Layers,
  Loader2,
  Plus,
  Settings,
  ToggleLeft,
  Type,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  FormTable,
  FormTableContent,
  FormTablePagination,
  FormTableToolbar,
} from "@/components/form-table/form-table";
import {
  BooleanConditionFilter,
  DateConditionFilter,
  EnumConditionFilter,
  FilterSection,
  NumberConditionFilter,
  TextConditionFilter,
  createDateFilterValue,
  createEnumFilterValue,
  createNumberFilterValue,
  createTextFilterValue,
  type DateFilterValue,
  type EnumFilterOption,
  type EnumFilterValue,
  type NumberFilterValue,
  type TextFilterValue,
} from "@/components/form-table/filter-components";
import type {
  ColumnDef,
  FetchRowsArgs,
  FilterRendererProps,
  FormTableConfig,
  FormTableCsvExport,
} from "@/components/form-table/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DemoPageTour } from "@/components/demo-tours/demo-page-tour";
import {
  countActiveMacroFilters,
  isMacroFilterActive,
  matchesMacroFilters,
  matchesMacroSearch,
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
import {
  resolveMainTableSelectOption,
  sanitizeMainTableSelectOptions,
} from "@/lib/main-table-select";

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

type MainTableColumnConfig = {
  id: string;
  label: string;
  cellType?: string;
  selectOptions?: unknown;
};

type MacroTableRowData = MacroRow & {
  _macroAccordionGroup?: boolean;
  _macroAccordionGroupColumnId?: string;
  _macroAccordionGroupValue?: string;
  _macroAccordionGroupCount?: number;
  _macroAccordionRows?: MacroRow[];
  [key: string]: unknown;
};

type MacroDisplayColumn = {
  id: string;
  label: string;
  dataType: MacroTableDataType;
  columnType: "source" | "custom" | "computed";
  sourceFieldKey?: string | null;
  config?: Record<string, unknown>;
};

type MacroAccordionPlacement = "table" | "accordion" | "both";
type MacroAccordionSort = {
  columnId: string;
  direction: "asc" | "desc";
} | null;
type MacroAccordionCellDraft = {
  sourceRowId: string;
  columnId: string;
  value: unknown;
};

function getMacroAccordionCellDraftKey(rowId: string, columnId: string) {
  return `${rowId}::${columnId}`;
}

type InsurancePolicyPreviewRow = {
  rowNumber: number;
  obraId: string | null;
  obraLabel: string;
  policyNumber: string;
  section: string;
  coveragePeriod: string;
  endDate: string | null;
  errors: string[];
};

function getActiveMacroFilters(filters: MacroTableFilters | undefined): MacroTableFilters {
  if (!filters) return {};

  return Object.entries(filters).reduce<MacroTableFilters>((acc, [columnId, filter]) => {
    if (isMacroFilterActive(filter)) {
      acc[columnId] = filter;
    }
    return acc;
  }, {});
}

function buildMacroAccordionCsvExport({
  rows,
  tableColumns,
  detailColumns,
  fileName,
}: {
  rows: MacroTableRowData[];
  tableColumns: MacroDisplayColumn[];
  detailColumns: MacroDisplayColumn[];
  fileName: string;
}): FormTableCsvExport {
  const effectiveDetailColumns = detailColumns.length > 0 ? detailColumns : tableColumns;
  const columns = [
    "Nivel",
    ...tableColumns.map((column) => column.label),
    ...effectiveDetailColumns.map((column) => column.label),
  ];
  const emptyTableValues = tableColumns.map(() => "");
  const emptyDetailValues = effectiveDetailColumns.map(() => "");

  return {
    fileName,
    columns,
    rows: rows.flatMap((row) => {
      const tableValues = tableColumns.map((column) =>
        formatMacroAccordionValue(row[column.id], column)
      );
      const childRows = Array.isArray(row._macroAccordionRows) && row._macroAccordionRows.length > 0
        ? row._macroAccordionRows
        : effectiveDetailColumns.length > 0
          ? [row]
          : [];

      return [
        ["Acordeon", ...tableValues, ...emptyDetailValues],
        ...childRows.map((childRow) => [
          "- item",
          ...emptyTableValues,
          ...effectiveDetailColumns.map((column) =>
            formatMacroAccordionValue(childRow[column.id], column)
          ),
        ]),
      ];
    }),
  };
}

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
): "text" | "number" | "currency" | "checkbox" | "date" | "select" {
  switch (dataType) {
    case "number":
      return "number";
    case "currency":
      return "currency";
    case "boolean":
      return "checkbox";
    case "date":
      return "date";
    case "select":
      return "select";
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
      className="group inline-flex h-full w-full items-center gap-2 px-1 py-1 font-semibold text-foreground hover:text-primary"
      onMouseEnter={() => prefetchObra(obraId)}
    >
      <span className="inline-flex size-5 min-h-5 min-w-5 items-center justify-center rounded-md border border-stone-200 bg-white text-muted-foreground shadow-sm group-hover:border-orange-primary/40 group-hover:text-primary">
        <ArrowUpRight className="size-3" />
      </span>
      <TruncatedTextWithTooltip text={text} />
    </Link>
  );
});

function isMacroColumnManuallyEditable(column: MacroDisplayColumn) {
  if (column.columnType === "custom") return true;
  const allowManualEdit = column.config?.allowManualEdit;
  return allowManualEdit === true || allowManualEdit === "true" || allowManualEdit === 1;
}

function normalizeEditableCellValue(value: unknown, dataType: MacroTableDataType) {
  if (dataType === "boolean") {
    return value === true || value === "true" || value === 1;
  }
  return value == null ? "" : String(value);
}

function getMacroSelectName(column: MacroDisplayColumn) {
  if (column.columnType === "source" && column.sourceFieldKey?.startsWith("obra.")) {
    return column.sourceFieldKey.slice("obra.".length);
  }
  return column.id;
}

function focusMacroAccordionCell(table: HTMLTableElement, rowIndex: number, columnIndex: number) {
  const nextCell = table.querySelector<HTMLElement>(
    `[data-macro-accordion-cell][data-row-index="${rowIndex}"][data-column-index="${columnIndex}"]`
  );
  if (!nextCell) return;
  const focusTarget =
    nextCell.querySelector<HTMLElement>(
      'input:not([type="hidden"]), textarea, select, button, [contenteditable="true"]'
    ) ?? nextCell;
  focusTarget.focus({ preventScroll: true });
}

function handleMacroAccordionKeyDown(event: React.KeyboardEvent<HTMLTableElement>) {
  if (
    event.key !== "ArrowUp" &&
    event.key !== "ArrowDown" &&
    event.key !== "ArrowLeft" &&
    event.key !== "ArrowRight"
  ) {
    return;
  }
  if (event.altKey || event.metaKey || event.ctrlKey || event.shiftKey) return;

  const cell = (event.target as HTMLElement | null)?.closest<HTMLElement>(
    "[data-macro-accordion-cell]"
  );
  if (!cell) return;

  const table = event.currentTarget;
  const rowIndex = Number(cell.dataset.rowIndex ?? 0);
  const columnIndex = Number(cell.dataset.columnIndex ?? 0);
  const rowCount = Number(table.dataset.rowCount ?? 0);
  const columnCount = Number(table.dataset.columnCount ?? 0);
  let nextRowIndex = rowIndex;
  let nextColumnIndex = columnIndex;

  if (event.key === "ArrowUp") nextRowIndex = Math.max(0, rowIndex - 1);
  if (event.key === "ArrowDown") nextRowIndex = Math.min(rowCount - 1, rowIndex + 1);
  if (event.key === "ArrowLeft") nextColumnIndex = Math.max(0, columnIndex - 1);
  if (event.key === "ArrowRight") nextColumnIndex = Math.min(columnCount - 1, columnIndex + 1);
  if (nextRowIndex === rowIndex && nextColumnIndex === columnIndex) return;

  event.preventDefault();
  event.stopPropagation();
  focusMacroAccordionCell(table, nextRowIndex, nextColumnIndex);
}

function MacroAccordionCell(props: {
  row: MacroRow;
  column: MacroDisplayColumn;
  editable: boolean;
  value?: unknown;
  onChangeValue?: (value: unknown) => void;
  onSave: (args: { rowId: string; columnId: string; value: unknown }) => Promise<void>;
}) {
  const {
    row,
    column,
    editable,
    onChangeValue,
    onSave,
  } = props;
  const rawValue = "value" in props ? props.value : row[column.id];
  const [value, setValue] = useState(() =>
    normalizeEditableCellValue(rawValue, column.dataType)
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setValue(normalizeEditableCellValue(rawValue, column.dataType));
  }, [column.dataType, rawValue]);

  const commit = useCallback(
    async (nextValue: unknown = value) => {
      if (onChangeValue) return;
      const normalizedOriginal = normalizeEditableCellValue(rawValue, column.dataType);
      if (String(nextValue) === String(normalizedOriginal)) return;
      setIsSaving(true);
      try {
        await onSave({
          rowId: row.id,
          columnId: column.id,
          value: nextValue,
        });
      } finally {
        setIsSaving(false);
      }
    },
    [column.dataType, column.id, onChangeValue, onSave, rawValue, row.id, value]
  );

  if (!editable) {
    return <>{formatMacroAccordionValue(rawValue, column)}</>;
  }

  if (column.dataType === "boolean") {
    const checked = value === true;
    return (
      <input
        type="checkbox"
        checked={checked}
        disabled={isSaving}
        onChange={(event) => {
          const nextValue = event.currentTarget.checked;
          setValue(nextValue);
          if (onChangeValue) {
            onChangeValue(nextValue);
          } else {
            void commit(nextValue);
          }
        }}
        className="size-4 rounded border-stone-300"
      />
    );
  }

  return (
    <Input
      type={column.dataType === "date" ? "date" : "text"}
      value={String(value)}
      disabled={isSaving}
      onChange={(event) => {
        const nextValue = event.currentTarget.value;
        setValue(nextValue);
        onChangeValue?.(nextValue);
      }}
      onBlur={() => {
        if (!onChangeValue) void commit();
      }}
      className="h-8 min-w-36 bg-white"
    />
  );
}

function getMacroAccordionSortValue(row: MacroRow, column: MacroDisplayColumn) {
  const value = row[column.id];
  if (value === null || typeof value === "undefined" || value === "") return null;

  if (column.dataType === "select") {
    const matched = resolveMainTableSelectOption(
      value,
      sanitizeMainTableSelectOptions(column.config?.selectOptions),
      getMacroSelectName(column)
    );
    return matched?.text ?? String(value);
  }

  if (column.dataType === "number" || column.dataType === "currency") {
    const numeric = typeof value === "number" ? value : Number(value);
    return Number.isFinite(numeric) ? numeric : String(value);
  }

  if (column.dataType === "date") {
    const time = new Date(String(value)).getTime();
    return Number.isFinite(time) ? time : String(value);
  }

  if (column.dataType === "boolean") {
    return value === true || value === "true" || value === 1 ? 1 : 0;
  }

  return String(value);
}

function compareMacroAccordionValues(
  left: ReturnType<typeof getMacroAccordionSortValue>,
  right: ReturnType<typeof getMacroAccordionSortValue>,
  direction: "asc" | "desc"
) {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;

  let result = 0;
  if (typeof left === "number" && typeof right === "number") {
    result = left - right;
  } else {
    result = String(left).localeCompare(String(right), "es-AR", {
      numeric: true,
      sensitivity: "base",
    });
  }

  return direction === "asc" ? result : -result;
}

function MacroAccordionDetailTable({
  rows,
  columns,
  isEditableColumn,
  drafts,
  onChangeCell,
  onSaveCell,
}: {
  rows: MacroRow[];
  columns: MacroDisplayColumn[];
  isEditableColumn: (column: MacroDisplayColumn) => boolean;
  drafts?: Record<string, MacroAccordionCellDraft>;
  onChangeCell?: (args: {
    row: MacroRow;
    column: MacroDisplayColumn;
    value: unknown;
  }) => void;
  onSaveCell: (args: { rowId: string; columnId: string; value: unknown }) => Promise<void>;
}) {
  const [sort, setSort] = useState<MacroAccordionSort>(null);
  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    const column = columns.find((item) => item.id === sort.columnId);
    if (!column) return rows;
    return rows
      .map((row, index) => ({ row, index }))
      .sort((left, right) => {
        const comparison = compareMacroAccordionValues(
          getMacroAccordionSortValue(left.row, column),
          getMacroAccordionSortValue(right.row, column),
          sort.direction
        );
        return comparison === 0 ? left.index - right.index : comparison;
      })
      .map((item) => item.row);
  }, [columns, rows, sort]);

  const toggleSort = useCallback((columnId: string) => {
    setSort((current) => {
      if (!current || current.columnId !== columnId) {
        return { columnId, direction: "asc" };
      }
      if (current.direction === "asc") {
        return { columnId, direction: "desc" };
      }
      return null;
    });
  }, []);

  return (
    <div
      data-form-table-ignore-arrow-navigation="true"
      className="overflow-hidden rounded-lg border border-stone-200 bg-white"
    >
      <div className="max-h-[360px] overflow-auto">
        <table
          className="w-full min-w-max text-sm"
          data-row-count={sortedRows.length}
          data-column-count={columns.length}
          onKeyDownCapture={handleMacroAccordionKeyDown}
        >
          <thead className="sticky top-0 bg-white text-left text-[11px] font-semibold uppercase tracking-wide text-stone-500">
            <tr>
              {columns.map((column) => {
                const isSorted = sort?.columnId === column.id;
                const SortIcon = !isSorted
                  ? ArrowUpDown
                  : sort.direction === "asc"
                    ? ArrowUp
                    : ArrowDown;
                return (
                  <th
                    key={column.id}
                    className="border-b border-stone-200 px-3 py-2"
                    aria-sort={
                      isSorted
                        ? sort.direction === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort(column.id)}
                      className={cn(
                        "inline-flex w-full items-center justify-between gap-3 text-left transition-colors hover:text-stone-900",
                        isSorted ? "text-stone-900" : "text-stone-500"
                      )}
                    >
                      <span>{column.label}</span>
                      <SortIcon className="size-3 shrink-0" />
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((childRow, rowIndex) => (
              <tr
                key={childRow.id}
                className={rowIndex % 2 === 0 ? "bg-white" : "bg-[#fafafa]"}
              >
                {columns.map((column, columnIndex) => (
                  <td
                    key={column.id}
                    data-macro-accordion-cell="true"
                    data-row-index={rowIndex}
                    data-column-index={columnIndex}
                    tabIndex={-1}
                    className="border-b border-stone-100 px-3 py-2 focus:outline focus:outline-2 focus:outline-orange-primary"
                  >
                    {(() => {
                      const draftKey = getMacroAccordionCellDraftKey(childRow.id, column.id);
                      const draft = drafts?.[draftKey];
                      const controlledProps = onChangeCell
                        ? {
                          value: draft ? draft.value : childRow[column.id],
                          onChangeValue: (value: unknown) => onChangeCell({ row: childRow, column, value }),
                        }
                        : {};
                      return (
                        <MacroAccordionCell
                          row={childRow}
                          column={column}
                          editable={isEditableColumn(column)}
                          {...controlledProps}
                          onSave={onSaveCell}
                        />
                      );
                    })()}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

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
  const resetFilter = useCallback(
    (columnId: string) => {
      onChange((prev) => ({ ...prev, [columnId]: {} }));
    },
    [onChange]
  );
  const toTextValue = (columnId: string): TextFilterValue => ({
    ...createTextFilterValue("contains"),
    condition: filters[columnId]?.textCondition ?? "contains",
    value: filters[columnId]?.value ?? "",
  });
  const toNumberValue = (columnId: string): NumberFilterValue => ({
    ...createNumberFilterValue("between"),
    condition: filters[columnId]?.numberCondition ?? "between",
    value: filters[columnId]?.value ?? "",
    min: filters[columnId]?.min ?? "",
    max: filters[columnId]?.max ?? "",
  });
  const toDateValue = (columnId: string): DateFilterValue => ({
    ...createDateFilterValue("between"),
    condition: filters[columnId]?.dateCondition ?? "between",
    value: filters[columnId]?.value ?? "",
    start: filters[columnId]?.from ?? "",
    end: filters[columnId]?.to ?? "",
  });
  const toEnumValue = (columnId: string): EnumFilterValue => ({
    ...createEnumFilterValue("include"),
    mode: filters[columnId]?.enumMode ?? "include",
    values: filters[columnId]?.values ?? [],
  });
  const getEnumOptions = (column: MacroDisplayColumn): EnumFilterOption[] =>
    sanitizeMainTableSelectOptions(column.config?.selectOptions).map((option) => ({
      value: option.text,
      label: option.text,
    }));

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
              <NumberConditionFilter
                label={column.dataType === "currency" ? "Importe" : "Valor"}
                value={toNumberValue(column.id)}
                onChange={(value) =>
                  updateFilter(column.id, {
                    numberCondition: value.condition,
                    value: value.value,
                    min: value.min,
                    max: value.max,
                  })
                }
                onClear={() => resetFilter(column.id)}
              />
            ) : null}

            {column.dataType === "date" ? (
              <DateConditionFilter
                label={column.label}
                value={toDateValue(column.id)}
                onChange={(value) =>
                  updateFilter(column.id, {
                    dateCondition: value.condition,
                    value: value.value,
                    from: value.start,
                    to: value.end,
                  })
                }
                onClear={() => resetFilter(column.id)}
              />
            ) : null}

            {column.dataType === "boolean" ? (
              <BooleanConditionFilter
                label={column.label}
                value={filter.state === "true" ? "yes" : filter.state === "false" ? "no" : "all"}
                onChange={(value) =>
                  updateFilter(column.id, {
                    state: value === "yes" ? "true" : value === "no" ? "false" : "all",
                  })
                }
                onClear={() => resetFilter(column.id)}
              />
            ) : null}

            {column.dataType === "select" ? (
              <EnumConditionFilter
                label={column.label}
                value={toEnumValue(column.id)}
                options={getEnumOptions(column)}
                onChange={(value) =>
                  updateFilter(column.id, {
                    enumMode: value.mode,
                    values: value.values,
                  })
                }
                onClear={() => resetFilter(column.id)}
              />
            ) : null}

            {column.dataType === "text" ? (
              <TextConditionFilter
                label={column.label}
                value={toTextValue(column.id)}
                onChange={(value) =>
                  updateFilter(column.id, {
                    textCondition: value.condition,
                    value: value.value,
                  })
                }
                onClear={() => resetFilter(column.id)}
                placeholder={`Filtrar ${column.label.toLowerCase()}...`}
              />
            ) : null}
          </FilterSection>
        );
      })}
    </div>
  );
}

function MacroTablePanel({
  macroTable,
  mainTableColumnById,
}: {
  macroTable: MacroTableWithDetails;
  mainTableColumnById: Map<string, MainTableColumnConfig>;
}) {
  const router = useRouter();
  const { push } = router;
  const searchParams = useSearchParams();
  const queryParams = new URLSearchParams(searchParams);
  const getSearchParam = (key: string): string | null => queryParams.get(key);
  const queryClient = useQueryClient();
  const [accordionCellDrafts, setAccordionCellDrafts] = useState<Record<string, MacroAccordionCellDraft>>({});
  const accordionCellDraftCount = Object.keys(accordionCellDrafts).length;
  const columns = useMemo(() => macroTable.columns ?? [], [macroTable.columns]);
  const displayColumns = useMemo<MacroDisplayColumn[]>(() => {
    return columns.map((column) => {
      const config = { ...(column.config ?? {}) };
      let dataType = column.dataType;
      if (column.columnType === "source" && column.sourceFieldKey?.startsWith("obra.")) {
        const mainColumnId = column.sourceFieldKey.slice("obra.".length);
        const mainColumn = mainTableColumnById.get(mainColumnId);
        const liveSelectOptions = sanitizeMainTableSelectOptions(mainColumn?.selectOptions);
        if (liveSelectOptions.length > 0 || mainColumn?.cellType === "select") {
          dataType = "select";
          config.selectOptions = liveSelectOptions;
        } else {
          delete config.selectOptions;
        }
      }
      return {
        id: column.id,
        label: column.label,
        dataType,
        columnType: column.columnType,
        sourceFieldKey: column.sourceFieldKey,
        config,
      };
    });
  }, [columns, mainTableColumnById]);
  const isObraRedirectColumn = useCallback(
    (column: MacroDisplayColumn) =>
      column.id === "_obraName" ||
      (column.columnType === "computed" &&
        column.label.toLowerCase().includes("obra")),
    []
  );
  const isManuallyEditableColumn = useCallback((column: MacroDisplayColumn) => {
    if (displayColumns.some(isMacroAccordionGroupColumn)) return false;
    return isMacroColumnManuallyEditable(column);
  }, [displayColumns]);
  const isAccordionEditableColumn = useCallback(
    (column: MacroDisplayColumn) => isMacroColumnManuallyEditable(column),
    []
  );
  const accordionGroupColumn = useMemo(
    () => displayColumns.find(isMacroAccordionGroupColumn) ?? null,
    [displayColumns]
  );
  const stageAccordionCellChange = useCallback(
    ({
      row,
      column,
      value,
    }: {
      row: MacroRow;
      column: MacroDisplayColumn;
      value: unknown;
    }) => {
      const key = getMacroAccordionCellDraftKey(row.id, column.id);
      const originalValue = normalizeEditableCellValue(row[column.id], column.dataType);
      setAccordionCellDrafts((current) => {
        const hasDraft = Object.prototype.hasOwnProperty.call(current, key);
        if (String(value) === String(originalValue)) {
          if (!hasDraft) return current;
          const next = { ...current };
          delete next[key];
          return next;
        }
        const existing = current[key];
        if (existing && String(existing.value) === String(value)) {
          return current;
        }
        return {
          ...current,
          [key]: {
            sourceRowId: row.id,
            columnId: column.id,
            value,
          },
        };
      });
    },
    []
  );
  const clearAccordionCellDrafts = useCallback(() => {
    setAccordionCellDrafts((current) =>
      Object.keys(current).length === 0 ? current : {}
    );
  }, []);

  const fetchRows = useCallback(
    async ({
      page,
      limit,
      filters,
      search,
      sort,
    }: FetchRowsArgs<MacroTableFilters>) => {
      const tableId = macroTable.id;
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });

      if (search?.trim()) {
        params.set("q", search.trim());
      }

      const activeFilters = getActiveMacroFilters(filters);
      if (countActiveMacroFilters(activeFilters) > 0) {
        params.set("filters", JSON.stringify(activeFilters));
      }

      if (accordionGroupColumn) {
        params.set("groupBy", accordionGroupColumn.id);
      }

      if (sort?.columnId) {
        params.set("sortBy", sort.columnId);
        params.set("sortDir", sort.direction);
      }

      const res = await fetch(`/api/macro-tables/${tableId}/rows?${params.toString()}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) {
        const message = data?.error ?? "Failed to fetch rows";
        throw new Error(message);
      }
      const rows: MacroTableRowData[] = (data.rows ?? []).map((row: MacroRow) => ({
        ...row,
        id: row.id,
        _sourceTablaId: row._sourceTablaId,
        _sourceTablaName: row._sourceTablaName,
        _obraId: row._obraId,
        _obraName: row._obraName,
        _businessIdentity: row._businessIdentity,
        _lineageRowKey: row._lineageRowKey,
        _extractionId: row._extractionId,
        _materializationVersion: row._materializationVersion,
        _docPath: row._docPath,
        _docFileName: row._docFileName,
        _overrideBindingStatus: row._overrideBindingStatus,
        _overrideConflictCount: row._overrideConflictCount,
        _macroAccordionGroup: row._macroAccordionGroup === true,
        _macroAccordionGroupColumnId:
          typeof row._macroAccordionGroupColumnId === "string"
            ? row._macroAccordionGroupColumnId
            : undefined,
        _macroAccordionGroupValue:
          typeof row._macroAccordionGroupValue === "string"
            ? row._macroAccordionGroupValue
            : undefined,
        _macroAccordionGroupCount:
          typeof row._macroAccordionGroupCount === "number"
            ? row._macroAccordionGroupCount
            : undefined,
        _macroAccordionRows: Array.isArray(row._macroAccordionRows)
          ? (row._macroAccordionRows as MacroRow[])
          : undefined,
      }));

      return {
        rows,
        pagination: data.pagination,
      };
    },
    [accordionGroupColumn, macroTable.id]
  );
  const fetchAllRowsForExport = useCallback(
    async ({
      filters,
      search,
      sort,
    }: {
      filters: MacroTableFilters | undefined;
      search: string | undefined;
      sort?: FetchRowsArgs<MacroTableFilters>["sort"];
    }) => {
      const limit = 200;
      const firstPage = await fetchRows({
        page: 1,
        limit,
        filters: filters ?? {},
        search,
        sort,
      });
      const allRows = [...firstPage.rows];
      const totalPages = firstPage.pagination?.totalPages ?? 1;

      for (let page = 2; page <= totalPages; page += 1) {
        const result = await fetchRows({
          page,
          limit,
          filters: filters ?? {},
          search,
          sort,
        });
        allRows.push(...result.rows);
      }

      return allRows;
    },
    [fetchRows]
  );

  const onSave = useCallback(
    async ({ dirtyRows }: { dirtyRows: MacroTableRowData[] }) => {
      const tableId = macroTable.id;
      const editableColumnIds = new Set(
        columns
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
      const addCustomValue = (value: {
        sourceRowId: string;
        columnId: string;
        value: unknown;
      }) => {
        const existingIndex = customValues.findIndex(
          (item) =>
            item.sourceRowId === value.sourceRowId &&
            item.columnId === value.columnId
        );
        if (existingIndex >= 0) {
          customValues[existingIndex] = value;
        } else {
          customValues.push(value);
        }
      };

      for (const row of dirtyRows) {
        for (const colId of editableColumnIds) {
          addCustomValue({
            sourceRowId: row.id,
            columnId: colId,
            value: row[colId],
          });
        }
      }

      Object.values(accordionCellDrafts).forEach(addCustomValue);

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
      clearAccordionCellDrafts();
    },
    [accordionCellDrafts, clearAccordionCellDrafts, columns, macroTable.id, queryClient]
  );

  const saveAccordionCell = useCallback(
    async ({
      rowId,
      columnId,
      value,
    }: {
      rowId: string;
      columnId: string;
      value: unknown;
    }) => {
      const res = await fetch(`/api/macro-tables/${macroTable.id}/rows`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customValues: [{ sourceRowId: rowId, columnId, value }],
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Error guardando cambios");
        throw new Error(data.error ?? "Error guardando cambios");
      }

      queryClient.invalidateQueries({ queryKey: ["macro-table-rows", macroTable.id] });
    },
    [macroTable.id, queryClient]
  );

  const tableColumns = useMemo(
    () => displayColumns.filter((column) => !isMacroAccordionOnlyColumn(column)),
    [displayColumns]
  );
  const accordionDetailColumns = useMemo(
    () => displayColumns.filter(isMacroAccordionDetailColumn),
    [displayColumns]
  );
  const config = useMemo<FormTableConfig<MacroTableRowData, MacroTableFilters> | null>(() => {
    if (tableColumns.length === 0) return null;

    const columnDefs: ColumnDef<MacroTableRowData>[] = tableColumns.map((column) => {
      const isEditable = isManuallyEditableColumn(column);
      const cellType = mapDataTypeToCell(column.dataType);
      const renderAsObraLink = isObraRedirectColumn(column);

      return {
        id: column.id,
        label: column.label,
        field: column.id as never,
        editable: isEditable,
        cellType,
        cellClassName: renderAsObraLink ? "bg-white group-hover:bg-white" : undefined,
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
              : cellType === "select"
                ? {
                  selectOptions: sanitizeMainTableSelectOptions(column.config?.selectOptions),
                  selectName: getMacroSelectName(column),
                }
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
      tableLayout: "auto",
      columns: columnDefs,
      dirtyFields: accordionDetailColumns
        .filter(isAccordionEditableColumn)
        .map((column) => column.id),
      fetchRows,
      serverSideData: true,
      externalUnsavedChanges: accordionCellDraftCount > 0,
      onSave,
      onDiscardChanges: clearAccordionCellDrafts,
      searchPlaceholder: "Buscar certificados, obras o estados...",
      defaultPageSize: 50,
      pageSizeOptions: [25, 50, 100],
      createFilters: () => ({}),
      renderFilters: (props: FilterRendererProps<MacroTableFilters>) => (
        <MacroFiltersContent {...props} columns={displayColumns} />
      ),
      applyFilters: (row: MacroTableRowData, filters: MacroTableFilters) =>
        matchesMacroFilters(row, displayColumns, filters),
      csvExport:
        accordionDetailColumns.length > 0 || accordionGroupColumn
          ? {
            buildExport: async ({ filters, search, sort }) => {
              const exportRows = await fetchAllRowsForExport({ filters, search, sort });
              const visibleRows = search.trim()
                ? exportRows.filter((row) =>
                  matchesMacroSearch(row, displayColumns, search) ||
                  (Array.isArray(row._macroAccordionRows) &&
                    row._macroAccordionRows.some((childRow) =>
                      matchesMacroSearch(childRow, displayColumns, search)
                    ))
                )
                : exportRows;

              return buildMacroAccordionCsvExport({
                rows: visibleRows,
                tableColumns,
                detailColumns:
                  accordionDetailColumns.length > 0 ? accordionDetailColumns : tableColumns,
                fileName: `macro-table-${macroTable.id}-accordion-all`,
              });
            },
          }
          : undefined,
      countActiveFilters: (filters: MacroTableFilters) =>
        countActiveMacroFilters(filters),
      emptyStateMessage: "No hay datos disponibles en las tablas fuente.",
      headerCellClassName: "bg-white text-stone-600",
      accordionRow:
        accordionDetailColumns.length > 0 || accordionGroupColumn
          ? {
            triggerLabel: "detalle",
            contentClassName: "bg-white",
            renderTrigger: ({
              row,
              isOpen,
              toggle,
            }: {
              row: MacroTableRowData;
              isOpen: boolean;
              toggle: () => void;
            }) => {
              const rowCount =
                typeof row._macroAccordionGroupCount === "number"
                  ? row._macroAccordionGroupCount
                  : null;

              return (
                <Button
                  type="button"
                  variant="defaultTertiary"
                  size="icon-sm"
                  aria-expanded={isOpen}
                  aria-label={isOpen ? "Cerrar detalle" : "Abrir detalle"}
                  onClick={toggle}
                  className="size-5 rounded-md"
                >
                  {isOpen ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
                  {rowCount !== null ? <span className="sr-only">{rowCount} filas</span> : null}
                </Button>
              );
            },
            renderContent: (row: MacroTableRowData, accordion) => {
              const childRows = Array.isArray(row._macroAccordionRows)
                ? row._macroAccordionRows
                : [];
              const detailColumns =
                accordionDetailColumns.length > 0 ? accordionDetailColumns : tableColumns;

              if (childRows.length > 0) {
                return (
                  <MacroAccordionDetailTable
                    rows={childRows}
                    columns={detailColumns}
                    isEditableColumn={isAccordionEditableColumn}
                    drafts={accordionCellDrafts}
                    onChangeCell={stageAccordionCellChange}
                    onSaveCell={saveAccordionCell}
                  />
                );
              }

              return (
                <div
                  data-form-table-ignore-arrow-navigation="true"
                  className="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-3"
                >
                  {detailColumns.map((column) => (
                    <div
                      key={column.id}
                      className="min-w-0 rounded-lg border border-stone-200 bg-white px-3 py-2"
                    >
                      <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-stone-500">
                        {column.label}
                      </p>
                      <p className="mt-1 break-words text-stone-900">
                        <MacroAccordionCell
                          row={row}
                          column={column}
                          editable={isAccordionEditableColumn(column)}
                          value={accordion.getValue(column.id)}
                          onChangeValue={(value) => accordion.setValue(column.id, value)}
                          onSave={saveAccordionCell}
                        />
                      </p>
                    </div>
                  ))}
                </div>
              );
            },
          }
          : undefined,
      showInlineSearch: true,
      showActionsColumn: accordionDetailColumns.length > 0 || Boolean(accordionGroupColumn),
      actionsColumnPosition: "start",
      actionsColumnWidth: 36,
      actionsColumnLabel: null,
      allowDeleteRows: false,
      allowAddRows: false,
      editMode: "active-cell",
    };
  }, [
    accordionCellDraftCount,
    accordionCellDrafts,
    accordionDetailColumns,
    accordionGroupColumn,
    clearAccordionCellDrafts,
    displayColumns,
    fetchRows,
    fetchAllRowsForExport,
    isAccordionEditableColumn,
    isManuallyEditableColumn,
    isObraRedirectColumn,
    macroTable.description,
    macroTable.id,
    macroTable.name,
    onSave,
    saveAccordionCell,
    stageAccordionCellChange,
    tableColumns,
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
                const isTourActive = getSearchParam("tour") === "macro-overview";
                const dest = `/macro/${macroTable.id}/reporte${isTourActive ? "?tour=macro-report" : ""}`;
                push(dest);
              }}
            >
              <FileText className="size-4" />
              Generar reporte
            </Button>
            <Button
              variant="outline"
              size="sm"
              className={toolButtonClass}
              onClick={() => push(`/admin/macro-tables/${macroTable.id}`)}
            >
              <Settings className="size-4" />
              Configurar
            </Button>
            <Button
              size="sm"
              className="gap-2 rounded-lg bg-[#1f1a17] text-white hover:bg-[#2b241f]"
              onClick={() => push("/admin/macro-tables/new")}
            >
              <Plus className="size-4" />
              Nueva macro tabla
            </Button>
          </div>
        </div>
        <div
          data-wizard-target="macro-page-table"
          className="flex flex-col gap-4 rounded-xl bg-card p-2.5 pr-0 pt-3.5 shadow-card xl:rounded-t-none"
        >
          <FormTableContent className="my-0 overflow-hidden rounded-lg shadow-card md:max-w-[calc(96vw-var(--sidebar-current-width))]" innerClassName="max-h-[calc(100vh-400px)]" />
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
  const { push, replace } = router;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mountedTabs, setMountedTabs] = useState<Set<string>>(new Set());
  const insuranceFileInputRef = useRef<HTMLInputElement | null>(null);
  const [insurancePreviewRows, setInsurancePreviewRows] = useState<InsurancePolicyPreviewRow[]>([]);
  const [isInsuranceImportOpen, setIsInsuranceImportOpen] = useState(false);
  const [isInsuranceImporting, setIsInsuranceImporting] = useState(false);

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

  const macroTables = useMemo(
    () => macroTablesQuery.data ?? [],
    [macroTablesQuery.data]
  );
  const mainTableColumnsQuery = useQuery<MainTableColumnConfig[]>({
    queryKey: ["main-table-config", "macro-live-source-config"],
    queryFn: async () => {
      const res = await fetch("/api/main-table-config", { cache: "no-store" });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data.columns) ? data.columns : [];
    },
    staleTime: 30 * 1000,
  });
  const mainTableColumnById = useMemo(() => {
    const map = new Map<string, MainTableColumnConfig>();
    for (const column of mainTableColumnsQuery.data ?? []) {
      if (typeof column.id === "string") map.set(column.id, column);
    }
    return map;
  }, [mainTableColumnsQuery.data]);
  const hasImportableInsurancePreviewRows = insurancePreviewRows.some((row) => row.policyNumber && row.errors.length === 0);

  const previewInsuranceImport = async (file: File) => {
    setIsInsuranceImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/insurance-policies/import", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "No se pudo leer el Excel");
      setInsurancePreviewRows(data.preview ?? []);
      setIsInsuranceImportOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo leer el Excel");
    } finally {
      setIsInsuranceImporting(false);
      if (insuranceFileInputRef.current) insuranceFileInputRef.current.value = "";
    }
  };

  const confirmInsuranceImport = async () => {
    const validRows = insurancePreviewRows.filter((row) => row.policyNumber && row.errors.length === 0);
    const response = await fetch("/api/insurance-policies/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: validRows }),
    });
    const data = await response.json();
    if (!response.ok) {
      toast.error(data.error ?? "No se pudo importar");
      return;
    }
    setIsInsuranceImportOpen(false);
    setInsurancePreviewRows([]);
    await macroTablesQuery.refetch();
    toast.success(`${data.imported ?? 0} pólizas importadas`);
  };

  useEffect(() => {
    if (macroTables.length === 0) return;
    const queryMacroId = new URLSearchParams(searchParams).get("macroId");
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
      replace(`/macro?macroId=${value}`);
    }
  };

  if (macroTablesQuery.isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (macroTablesQuery.isError) {
    return (
      <div className="flex flex-col items-center justify-center p-12 gap-4 text-center text-muted-foreground">
        <Layers className="size-12 opacity-30" />
        <p>Error cargando macro tablas.</p>
        <Button variant="outline" onClick={() => macroTablesQuery.refetch()}>
          Reintentar
        </Button>
      </div>
    );
  }

  if (macroTables.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center justify-center p-12 gap-4 text-center">
          <Layers className="size-12 text-muted-foreground opacity-30" />
          <div>
            <h2 className="text-lg font-semibold">No hay macro tablas</h2>
            <p className="text-muted-foreground">
              Importá pólizas para crear la macrotabla automáticamente o creá una manual.
            </p>
          </div>
          <input
            ref={insuranceFileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (file) void previewInsuranceImport(file);
            }}
          />
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={() => insuranceFileInputRef.current?.click()} className="gap-2" disabled={isInsuranceImporting}>
              <Upload className="size-4" />
              Importar pólizas
            </Button>
            <Button onClick={() => push("/admin/macro-tables/new")} variant="outline" className="gap-2">
              <Plus className="size-4" />
              Nueva macro tabla
            </Button>
          </div>
        </div>
        <Dialog open={isInsuranceImportOpen} onOpenChange={setIsInsuranceImportOpen}>
          <DialogContent className="max-w-5xl">
            <DialogHeader>
              <DialogTitle>Revisar importación de pólizas</DialogTitle>
            </DialogHeader>
            <div className="max-h-[520px] overflow-auto border border-stone-200">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fila</TableHead>
                    <TableHead>Obra detectada</TableHead>
                    <TableHead>Póliza</TableHead>
                    <TableHead>Sección</TableHead>
                    <TableHead>Vigencia</TableHead>
                    <TableHead>Errores</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {insurancePreviewRows.map((row) => (
                    <TableRow key={`${row.rowNumber}-${row.policyNumber}`}>
                      <TableCell>{row.rowNumber}</TableCell>
                      <TableCell>{row.obraLabel || "-"}</TableCell>
                      <TableCell>{row.policyNumber || "-"}</TableCell>
                      <TableCell>{row.section || "-"}</TableCell>
                      <TableCell>{row.coveragePeriod || row.endDate || "-"}</TableCell>
                      <TableCell className={row.errors.length ? "text-red-600" : "text-stone-500"}>
                        {row.errors.length ? row.errors.join(" ") : "OK"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsInsuranceImportOpen(false)}>Cancelar</Button>
              <Button onClick={() => void confirmInsuranceImport()} disabled={!hasImportableInsurancePreviewRows}>
                Confirmar importación
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
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
          <div className="flex flex-col gap-2 sm:items-end" data-wizard-target="macro-page-tabs">
            <div className="flex flex-wrap justify-end gap-2">
              <input
                ref={insuranceFileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  if (file) void previewInsuranceImport(file);
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={toolButtonClass}
                onClick={() => insuranceFileInputRef.current?.click()}
                disabled={isInsuranceImporting}
              >
                <Upload className="size-4" />
                Importar pólizas
              </Button>
            </div>
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
                <MacroTablePanel macroTable={macroTable} mainTableColumnById={mainTableColumnById} />
              ) : null}
            </div>
          </TabsContent>
        ))}
      </div>
      <Dialog open={isInsuranceImportOpen} onOpenChange={setIsInsuranceImportOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Revisar importación de pólizas</DialogTitle>
          </DialogHeader>
          <div className="max-h-[520px] overflow-auto border border-stone-200">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fila</TableHead>
                  <TableHead>Obra detectada</TableHead>
                  <TableHead>Póliza</TableHead>
                  <TableHead>Sección</TableHead>
                  <TableHead>Vigencia</TableHead>
                  <TableHead>Errores</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {insurancePreviewRows.map((row) => (
                  <TableRow key={`${row.rowNumber}-${row.policyNumber}`}>
                    <TableCell>{row.rowNumber}</TableCell>
                    <TableCell>{row.obraLabel || "-"}</TableCell>
                    <TableCell>{row.policyNumber || "-"}</TableCell>
                    <TableCell>{row.section || "-"}</TableCell>
                    <TableCell>{row.coveragePeriod || row.endDate || "-"}</TableCell>
                    <TableCell className={row.errors.length ? "text-red-600" : "text-stone-500"}>
                      {row.errors.length ? row.errors.join(" ") : "OK"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsInsuranceImportOpen(false)}>Cancelar</Button>
            <Button onClick={() => void confirmInsuranceImport()} disabled={!hasImportableInsurancePreviewRows}>
              Confirmar importación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Tabs>
  );
}

function getMacroAccordionPlacement(
  column: Pick<MacroDisplayColumn, "config">
): MacroAccordionPlacement {
  const placement = column.config?.macroAccordionPlacement;
  if (placement === "accordion" || placement === "both") return placement;
  return "table";
}

function isMacroAccordionDetailColumn(column: MacroDisplayColumn) {
  const placement = getMacroAccordionPlacement(column);
  return placement === "accordion" || placement === "both";
}

function isMacroAccordionOnlyColumn(column: MacroDisplayColumn) {
  return getMacroAccordionPlacement(column) === "accordion";
}

function isMacroAccordionGroupColumn(column: MacroDisplayColumn) {
  return column.config?.macroAccordionGroupBy === true;
}

function formatMacroAccordionValue(value: unknown, column: MacroDisplayColumn) {
  if (value === null || typeof value === "undefined" || value === "") return "-";
  if (column.dataType === "select") {
    const matched = resolveMainTableSelectOption(
      value,
      sanitizeMainTableSelectOptions(column.config?.selectOptions),
      getMacroSelectName(column)
    );
    if (matched) return matched.text;
  }
  if (column.dataType === "boolean") return value === true ? "Si" : "No";
  if (column.dataType === "currency") {
    const numeric = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(numeric)) {
      return new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: "ARS",
        maximumFractionDigits: 2,
      }).format(numeric);
    }
  }
  return String(value);
}

export default function MacroTablesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center p-12">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <MacroTablesPageContent />
    </Suspense>
  );
}
