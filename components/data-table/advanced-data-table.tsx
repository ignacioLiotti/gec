"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import Link from "next/link";
import { Filter, MoreHorizontal, Search, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { ColGroup, ColumnResizer, balanceTableColumns } from "@/components/ui/column-resizer";
import { ColumnVisibilityMenu } from "./column-visibility-menu";
import type {
  DataTableColumn,
  DataTableFeatures,
  DataTableHeaderGroup,
  DataTableQueryState,
  DataTableRowActionContext,
  DataTableServerState,
  DataTableSortState,
  DataTableSortDirection,
} from "./types";

type RowUpdater<TData> = Partial<TData> | ((prev: TData) => TData);
type IndexedRow<TData> = { row: TData; index: number };

function readPersistedArray(key: string | null | undefined): string[] {
  if (!key || typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writePersistedArray(key: string | null | undefined, value: string[]) {
  if (!key || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

export interface AdvancedDataTableProps<TData extends Record<string, any>> {
  id: string;
  data: TData[];
  columns: DataTableColumn<TData>[];
  headerGroups?: DataTableHeaderGroup[];
  features?: DataTableFeatures<TData>;
  className?: string;
  emptyText?: string;
  getRowId?: (row: TData, index: number) => string | number;
  onRowsChange?: (rows: TData[]) => void;
  isLoading?: boolean;
  isRefreshing?: boolean;
  headerGroupBgClassName?: string;
  rowStateMode?: "internal" | "controlled";
  serverState?: DataTableServerState;
}

export function AdvancedDataTable<TData extends Record<string, any>>({
  id,
  data,
  columns,
  headerGroups,
  features,
  className,
  emptyText = "No hay datos disponibles.",
  getRowId,
  onRowsChange,
  isLoading,
  isRefreshing,
  headerGroupBgClassName = "bg-muted",
  rowStateMode = "internal",
  serverState,
}: AdvancedDataTableProps<TData>) {
  const searchConfig = features?.search;
  const tabsConfig = features?.tabs;
  const filtersConfig = features?.filters;
  const csvConfig = features?.csvImport;
  const paginationConfig = features?.pagination;
  const addRowConfig = features?.addRow;
  const appearanceConfig = features?.appearance;
  const columnVisibilityConfig = features?.columnVisibility;
  const columnPinningConfig = features?.columnPinning;
  const sortingConfig = features?.sorting;
  const columnResizingMode = features?.columnResizing?.mode ?? "fixed";
  const rowActionsConfig = features?.rowActions;
  const columnBalanceConfig = features?.columnBalance;
  const contextMenuConfig = features?.contextMenu;
  const editableConfig = features?.editable;
  const editableEnabled = editableConfig?.enabled ?? false;
  const editableColumns = React.useMemo(
    () => new Set(editableConfig?.columns ?? []),
    [editableConfig?.columns],
  );
  const allEditable = editableEnabled && (!editableConfig?.columns || editableConfig?.columns.length === 0);

  const headerContextMenuEnabled = features?.headerContextMenu?.enabled ?? true;

  const columnVisibilityEnabled = columnVisibilityConfig?.enabled ?? false;
  const columnPinningEnabled = columnPinningConfig?.enabled ?? false;

  const hideableColumns = React.useMemo(
    () =>
      new Set(
        columns.filter((column) => column.enableHide !== false).map((column) => column.id),
      ),
    [columns],
  );
  const pinnableColumns = React.useMemo(
    () =>
      new Set(
        columns.filter((column) => column.enablePin !== false).map((column) => column.id),
      ),
    [columns],
  );

  const [editingCell, setEditingCell] = React.useState<{
    rowId: string | number;
    columnId: string;
  } | null>(null);

  React.useEffect(() => {
    if (!editableEnabled) {
      setEditingCell(null);
    }
  }, [editableEnabled]);


  const isControlledRows = rowStateMode === "controlled";

  const [internalRows, setInternalRows] = React.useState<TData[]>(data);
  const rows = isControlledRows ? data : internalRows;
  const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    if (!isControlledRows) {
      setInternalRows(data);
      setHasUnsavedChanges(false);
    }
  }, [data, isControlledRows]);

  const serverMode = serverState?.enabled ?? false;
  const shouldApplyClientPipeline = !serverMode || serverState?.applyClientSideFiltering === true;

  const [internalSearch, setInternalSearch] = React.useState(searchConfig?.value ?? "");
  React.useEffect(() => {
    if (searchConfig?.value !== undefined) {
      setInternalSearch(searchConfig.value);
    }
  }, [searchConfig?.value]);
  const searchValue = searchConfig?.value ?? internalSearch;

  const tabsOptions = React.useMemo(() => tabsConfig?.options ?? [], [tabsConfig?.options]);
  const tabsEnabled = Boolean(tabsConfig?.enabled && tabsOptions.length);
  const initialTabValue = tabsEnabled
    ? tabsConfig?.defaultValue ?? tabsOptions[0]?.value
    : undefined;
  const [activeTab, setActiveTab] = React.useState<string | undefined>(initialTabValue);
  React.useEffect(() => {
    if (!tabsEnabled) {
      setActiveTab(undefined);
      return;
    }
    setActiveTab((current) => current ?? (tabsConfig?.defaultValue ?? tabsOptions[0]?.value));
  }, [tabsEnabled, tabsConfig?.defaultValue, tabsOptions]);

  const [isFiltersOpen, setIsFiltersOpen] = React.useState(filtersConfig?.defaultOpen ?? false);
  const [sortState, setSortState] = React.useState<DataTableSortState | null>(
    sortingConfig?.defaultSort ?? null,
  );
  const sortingEnabled = sortingConfig?.enabled ?? false;

  const hiddenStorageKey =
    columnVisibilityEnabled && columnVisibilityConfig?.persistKey
      ? `datatable:hidden:${columnVisibilityConfig.persistKey}`
      : null;
  const pinnedStorageKey =
    columnPinningEnabled && columnPinningConfig?.persistKey
      ? `datatable:pinned:${columnPinningConfig.persistKey}`
      : null;

  const [hiddenColumnIds, setHiddenColumnIds] = React.useState<string[]>(() =>
    readPersistedArray(hiddenStorageKey),
  );
  const [pinnedColumnIds, setPinnedColumnIds] = React.useState<string[]>(() =>
    readPersistedArray(pinnedStorageKey),
  );

  React.useEffect(() => {
    if (!columnVisibilityEnabled) return;
    writePersistedArray(hiddenStorageKey, hiddenColumnIds);
  }, [columnVisibilityEnabled, hiddenColumnIds, hiddenStorageKey]);
  React.useEffect(() => {
    if (!columnVisibilityEnabled) return;
    setHiddenColumnIds((prev) => prev.filter((id) => hideableColumns.has(id)));
  }, [columnVisibilityEnabled, hideableColumns]);

  const columnIndexMap = React.useMemo(() => {
    const map: Record<string, number> = {};
    columns.forEach((column, index) => {
      map[column.id] = index;
    });
    return map;
  }, [columns]);

  React.useEffect(() => {
    if (!columnPinningEnabled) return;
    writePersistedArray(pinnedStorageKey, pinnedColumnIds);
  }, [columnPinningEnabled, pinnedColumnIds, pinnedStorageKey]);
  React.useEffect(() => {
    if (!columnPinningEnabled) return;
    setPinnedColumnIds((prev) => {
      const next = prev.filter((id) => pinnableColumns.has(id));
      next.sort((a, b) => {
        const indexA = columnIndexMap[a] ?? Number.MAX_SAFE_INTEGER;
        const indexB = columnIndexMap[b] ?? Number.MAX_SAFE_INTEGER;
        return indexA - indexB;
      });
      return next;
    });
  }, [columnPinningEnabled, pinnableColumns, columnIndexMap]);

  const isColumnHidden = React.useCallback(
    (columnId: string) =>
      columnVisibilityEnabled &&
      hideableColumns.has(columnId) &&
      hiddenColumnIds.includes(columnId),
    [columnVisibilityEnabled, hideableColumns, hiddenColumnIds],
  );

  const isColumnPinned = React.useCallback(
    (columnId: string) =>
      columnPinningEnabled && pinnableColumns.has(columnId) && pinnedColumnIds.includes(columnId),
    [columnPinningEnabled, pinnableColumns, pinnedColumnIds],
  );

  const togglePinColumn = React.useCallback(
    (columnId: string) => {
      if (!columnPinningEnabled || !pinnableColumns.has(columnId)) return;
      setPinnedColumnIds((prev) => {
        const set = new Set(prev);
        if (set.has(columnId)) {
          set.delete(columnId);
        } else {
          set.add(columnId);
        }
        const nextPinned = Array.from(set);
        // Sort pinned columns by their original index in the columns array
        nextPinned.sort((a, b) => {
          const indexA = columnIndexMap[a] ?? Number.MAX_SAFE_INTEGER;
          const indexB = columnIndexMap[b] ?? Number.MAX_SAFE_INTEGER;
          return indexA - indexB;
        });
        return nextPinned;
      });
    },
    [columnPinningEnabled, pinnableColumns, columnIndexMap],
  );

  const setRowsAndNotify = React.useCallback(
    (updater: (prev: TData[]) => TData[]) => {
      if (isControlledRows) {
        const next = updater(rows);
        onRowsChange?.(next);
        setHasUnsavedChanges(true);
        return;
      }
      setInternalRows((prev) => {
        const next = updater(prev);
        onRowsChange?.(next);
        setHasUnsavedChanges(true);
        return next;
      });
    },
    [isControlledRows, onRowsChange, rows],
  );

  const updateRow = React.useCallback(
    (rowIndex: number, updater: RowUpdater<TData>) => {
      setRowsAndNotify((prev) => {
        const next = [...prev];
        const current = next[rowIndex];
        if (!current) return prev;
        next[rowIndex] = typeof updater === "function" ? updater(current) : { ...current, ...updater };
        return next;
      });
    },
    [setRowsAndNotify],
  );

  const duplicateRow = React.useCallback(
    (rowIndex: number) => {
      setRowsAndNotify((prev) => {
        const next = [...prev];
        const source = next[rowIndex];
        if (!source) return prev;
        next.splice(rowIndex + 1, 0, { ...source });
        return next;
      });
    },
    [setRowsAndNotify],
  );

  const deleteRow = React.useCallback(
    (rowIndex: number) => {
      setRowsAndNotify((prev) => {
        if (prev.length <= 1) return prev;
        return prev.filter((_, idx) => idx !== rowIndex);
      });
    },
    [setRowsAndNotify],
  );

  const addRow = React.useCallback(() => {
    if (!addRowConfig?.enabled || !addRowConfig?.createRow) return;
    setRowsAndNotify((prev) => [...prev, addRowConfig.createRow()]);
  }, [addRowConfig, setRowsAndNotify]);

  const [columnOffsets, setColumnOffsets] = React.useState<Record<string, number>>({});
  const tableRef = React.useRef<HTMLTableElement | null>(null);

  React.useEffect(() => {
    const table = tableRef.current;
    if (!table) return;

    const calculateOffsets = () => {
      const cols = table.querySelectorAll<HTMLTableColElement>("colgroup col");
      const offsets: Record<string, number> = {};
      let accumulator = 0;
      pinnedColumnIds.forEach((columnId) => {
        const colIndex = columnIndexMap[columnId];
        if (colIndex == null) return;
        if (isColumnHidden(columnId)) return;
        const col = cols[colIndex];
        if (!col) return;
        offsets[columnId] = accumulator;
        const width = col.offsetWidth || parseInt(col.style.width || "0", 10) || 150;
        accumulator += width;
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
  }, [columnIndexMap, pinnedColumnIds, isColumnHidden]);

  React.useEffect(() => {
    const table = tableRef.current;
    if (!table) return;
    const cols = table.querySelectorAll<HTMLTableColElement>("colgroup col");
    columns.forEach((column, index) => {
      const col = cols[index];
      if (!col) return;
      if (isColumnHidden(column.id)) {
        col.style.display = "none";
        col.style.width = "0px";
      } else {
        col.style.display = "";
      }
    });
  }, [columns, isColumnHidden]);

  const getStickyProps = React.useCallback(
    (column: DataTableColumn<TData>, baseClassName?: string) => {
      const offset = columnOffsets[column.id];
      const pinned = isColumnPinned(column.id);
      return {
        className: cn(
          baseClassName,
          pinned && offset !== undefined ? "sticky z-20 outline outline-orange-primary/60" : "",
          isColumnHidden(column.id) ? "hidden" : "",
        ),
        style: {
          left: pinned && offset !== undefined ? `${offset}px` : undefined,
        },
      };
    },
    [columnOffsets, isColumnHidden, isColumnPinned],
  );

  const getRawValue = React.useCallback(
    (row: TData, column: DataTableColumn<TData>, rowIndex: number) => {
      if (column.accessorKey) return row[column.accessorKey];
      if (column.accessorFn) return column.accessorFn(row, rowIndex);
      return undefined;
    },
    [],
  );


  const [page, setPage] = React.useState(paginationConfig?.initialPage ?? 1);
  const [pageSize, setPageSize] = React.useState(paginationConfig?.initialPageSize ?? 10);
  React.useEffect(() => {
    setPage(paginationConfig?.initialPage ?? 1);
    setPageSize(paginationConfig?.initialPageSize ?? 10);
  }, [paginationConfig?.initialPage, paginationConfig?.initialPageSize]);

  const buildQueryState = React.useCallback(
    (patch?: Partial<DataTableQueryState>) => ({
      searchValue,
      activeTab,
      sortState,
      page,
      pageSize,
      ...patch,
    }),
    [searchValue, activeTab, sortState, page, pageSize],
  );

  const emitServerQueryChange = React.useCallback(
    (patch?: Partial<DataTableQueryState>) => {
      if (!serverMode) return;
      serverState?.onQueryChange?.(buildQueryState(patch));
    },
    [serverMode, serverState, buildQueryState],
  );

  React.useEffect(() => {
    if (!serverMode) return;
    emitServerQueryChange();
  }, [serverMode, emitServerQueryChange]);

  const setSearchValue = React.useCallback(
    (next: string) => {
      searchConfig?.onChange?.(next);
      if (searchConfig?.value === undefined) {
        setInternalSearch(next);
      }
      if (serverMode) {
        setPage(1);
        emitServerQueryChange({ searchValue: next, page: 1 });
      }
    },
    [searchConfig, serverMode, emitServerQueryChange],
  );

  const applySortDirection = React.useCallback(
    (column: DataTableColumn<TData>, direction: DataTableSortDirection) => {
      if (!sortingEnabled || column.enableSort === false) return;
      const nextState: DataTableSortState = { columnId: column.id, direction };
      setSortState(nextState);
      sortingConfig?.onChange?.(nextState);
      if (serverMode) {
        emitServerQueryChange({ sortState: nextState, page: 1 });
      }
    },
    [sortingEnabled, sortingConfig, serverMode, emitServerQueryChange],
  );

  const clearSortState = React.useCallback(() => {
    setSortState(null);
    sortingConfig?.onChange?.(null);
    if (serverMode) {
      emitServerQueryChange({ sortState: null, page: 1 });
    }
  }, [sortingConfig, serverMode, emitServerQueryChange]);

  const handleSortToggle = React.useCallback(
    (column: DataTableColumn<TData>) => {
      if (!sortingEnabled || column.enableSort === false) return;
      setSortState((prev) => {
        let nextState: DataTableSortState | null;
        if (!prev || prev.columnId !== column.id) {
          nextState = { columnId: column.id, direction: "asc" };
        } else if (prev.direction === "asc") {
          nextState = { columnId: column.id, direction: "desc" };
        } else {
          nextState = null;
        }
        sortingConfig?.onChange?.(nextState);
        if (serverMode) {
          emitServerQueryChange({ sortState: nextState, page: 1 });
        }
        return nextState;
      });
    },
    [sortingEnabled, sortingConfig, serverMode, emitServerQueryChange],
  );

  const indexedRows = React.useMemo<IndexedRow<TData>[]>(
    () => rows.map((row, index) => ({ row, index })),
    [rows],
  );

  const searchFilteredRows = React.useMemo(() => {
    if (!shouldApplyClientPipeline) return indexedRows;
    if (!searchConfig?.enabled || !searchValue.trim()) return indexedRows;
    return indexedRows.filter(({ row }) => {
      if (searchConfig.filterFn) {
        return searchConfig.filterFn(row, searchValue);
      }
      return Object.values(row ?? {}).some((value) =>
        String(value ?? "").toLowerCase().includes(searchValue.toLowerCase()),
      );
    });
  }, [indexedRows, searchConfig, searchValue, shouldApplyClientPipeline]);

  const tabFilteredRows = React.useMemo(() => {
    if (!shouldApplyClientPipeline) return searchFilteredRows;
    if (!tabsEnabled || !activeTab) return searchFilteredRows;
    const currentTab = tabsOptions.find((option) => option.value === activeTab);
    if (!currentTab?.predicate) return searchFilteredRows;
    return searchFilteredRows.filter(({ row }) => currentTab.predicate?.(row));
  }, [activeTab, tabsEnabled, tabsOptions, searchFilteredRows, shouldApplyClientPipeline]);

  const sortedRows = React.useMemo(() => {
    if (!shouldApplyClientPipeline || !sortingConfig?.enabled || !sortState) return tabFilteredRows;
    const column = columns.find((col) => col.id === sortState.columnId);
    if (!column) return tabFilteredRows;
    const comparator =
      sortingConfig.comparator ??
      ((a: unknown, b: unknown) => {
        if (typeof a === "number" && typeof b === "number") {
          return a - b;
        }
        return String(a ?? "").localeCompare(String(b ?? ""), undefined, { numeric: true });
      });
    const copy = [...tabFilteredRows];
    copy.sort((a, b) => {
      const valueA = getCellPrimitiveValue(a.row, column, a.index);
      const valueB = getCellPrimitiveValue(b.row, column, b.index);
      const result = comparator(valueA, valueB, column);
      return sortState.direction === "asc" ? result : -result;
    });
    return copy;
  }, [columns, sortState, sortingConfig, tabFilteredRows, shouldApplyClientPipeline]);

  const processedRows = shouldApplyClientPipeline ? sortedRows : indexedRows;

  const paginationEnabled = paginationConfig?.enabled ?? false;
  const totalRows = shouldApplyClientPipeline
    ? processedRows.length
    : serverState?.totalRows ?? rows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));

  React.useEffect(() => {
    setPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  React.useEffect(() => {
    if (serverMode) return;
    setPage(1);
  }, [searchValue, activeTab, rows.length, serverMode]);

  const visibleRows = React.useMemo(() => {
    if (!shouldApplyClientPipeline) return processedRows;
    if (!paginationEnabled) return processedRows;
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;
    return processedRows.slice(start, start + pageSize);
  }, [processedRows, shouldApplyClientPipeline, paginationEnabled, page, pageSize, totalPages]);

  const copyToClipboard = React.useCallback(async (text: string, successMessage?: string) => {
    try {
      await navigator.clipboard.writeText(text);
      if (successMessage) {
        toast.success(successMessage);
      }
    } catch (error) {
      console.error("clipboard", error);
      toast.error("No se pudo copiar");
    }
  }, []);

  const copyColumnValues = React.useCallback(
    async (column: DataTableColumn<TData>) => {
      const values = visibleRows.map(({ row, index }) => {
        const raw = getRawValue(row, column, index);
        return raw == null ? "" : String(raw);
      });
      await copyToClipboard(values.join("\n"), "Columna copiada");
    },
    [visibleRows, getRawValue, copyToClipboard],
  );

  const copyRowValues = React.useCallback(
    async (row: TData, rowIndex: number) => {
      const csv = columns
        .map((column) => {
          const raw = getRawValue(row, column, rowIndex);
          const safe = raw == null ? "" : String(raw);
          return `"${safe.replace(/"/g, '""')}"`;
        })
        .join(";");
      await copyToClipboard(csv, "Fila copiada");
    },
    [columns, getRawValue, copyToClipboard],
  );

  const csvInputRef = React.useRef<HTMLInputElement | null>(null);
  const handleCsvInput = React.useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      if (!csvConfig?.enabled || !csvConfig.parseFile) return;
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        const imported = await csvConfig.parseFile(file);
        if (Array.isArray(imported)) {
          setRowsAndNotify(() => imported);
          csvConfig.onSuccess?.(imported);
          toast.success(`Se importaron ${imported.length} filas`);
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error("Error importando archivo");
        csvConfig.onError?.(err);
        toast.error(err.message);
      } finally {
        event.target.value = "";
      }
    },
    [csvConfig, setRowsAndNotify],
  );

  const hiddenIndices = React.useMemo(
    () =>
      hiddenColumnIds
        .filter((columnId) => hideableColumns.has(columnId))
        .map((columnId) => columnIndexMap[columnId])
        .filter((value): value is number => typeof value === "number"),
    [hiddenColumnIds, hideableColumns, columnIndexMap],
  );

  const handleBalanceColumns = React.useCallback(() => {
    if (!columnBalanceConfig?.enabled) return;
    balanceTableColumns(id, {
      hiddenCols: hiddenIndices,
      minVisibleWidth: columnBalanceConfig.minVisibleWidth,
    });
  }, [columnBalanceConfig, hiddenIndices, id]);

  const toolbarProps = React.useMemo(
    () => ({
      rows,
      filteredRows: processedRows.map(({ row }) => row),
      activeTab,
      searchValue,
    }),
    [rows, processedRows, activeTab, searchValue],
  );

  const showToolbar =
    features?.toolbar?.enabled ||
    searchConfig?.enabled ||
    columnVisibilityEnabled ||
    columnPinningEnabled ||
    filtersConfig?.enabled ||
    csvConfig?.enabled ||
    Boolean(features?.toolbar?.renderStart) ||
    Boolean(features?.toolbar?.renderEnd);

  const hasRowActions = rowActionsConfig?.enabled ?? false;
  const tableColumnsCount = columns.length + (hasRowActions ? 1 : 0);
  const showOverlay = (isRefreshing || (isLoading && visibleRows.length > 0)) ?? false;
  const containerSurfaceClass =
    appearanceConfig?.containerClassName ??
    "relative border border-border rounded-none overflow-x-auto w-full max-w-[calc(98vw-var(--sidebar-current-width))] transition-all duration-300 h-[70vh] bg-[repeating-linear-gradient(-60deg,transparent_0%,transparent_5px,var(--border)_5px,var(--border)_6px,transparent_6px)] bg-repeat";
  const tableScrollClass = appearanceConfig?.tableWrapperClassName ?? "max-h-[70vh] overflow-auto";

  const tabCounts = React.useMemo(() => {
    if (!tabsEnabled || !shouldApplyClientPipeline) return {};
    const baseRows = searchFilteredRows;
    const counts: Record<string, number> = {};
    tabsOptions.forEach((option) => {
      counts[option.value] = option.predicate
        ? baseRows.filter(({ row }) => option.predicate?.(row)).length
        : baseRows.length;
    });
    return counts;
  }, [tabsEnabled, tabsOptions, searchFilteredRows, shouldApplyClientPipeline]);

  return (
    <div className={cn("space-y-4", className)}>
      {showToolbar && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {features?.toolbar?.renderStart?.(toolbarProps)}
            {searchConfig?.enabled && (
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                  placeholder={searchConfig.placeholder ?? "Buscar..."}
                  className="w-56 pl-8"
                />
              </div>
            )}
            <ColumnVisibilityMenu
              columns={columns.map((column) => ({
                id: column.id,
                label: getHeaderLabel(column.header),
                canHide: columnVisibilityEnabled && column.enableHide !== false,
                canPin: columnPinningEnabled && column.enablePin !== false,
              }))}
              hiddenColumns={hiddenColumnIds}
              setHiddenColumns={setHiddenColumnIds}
              pinnedColumns={pinnedColumnIds}
              togglePin={togglePinColumn}
              onBalanceColumns={
                columnBalanceConfig?.enabled ? handleBalanceColumns : undefined
              }
              disabled={!columnVisibilityEnabled && !columnPinningEnabled}
            />
            {filtersConfig?.enabled && (
              <Sheet open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Filter className="h-4 w-4" />
                    Filtros
                  </Button>
                </SheetTrigger>
                <SheetContent
                  side="right"
                  className="my-auto max-h-[96vh] overflow-y-auto px-6 py-7 sm:w-[28vw] sm:max-w-[90vw]"
                >
                  <SheetHeader>
                    <SheetTitle>Filtros avanzados</SheetTitle>
                  </SheetHeader>
                  <div className="mt-6 space-y-6">
                    {filtersConfig.render({
                      rows,
                      filteredRows: sortedRows.map(({ row }) => row),
                      applyFilters: () => {
                        filtersConfig.onApply?.();
                        setIsFiltersOpen(false);
                      },
                      resetFilters: () => {
                        filtersConfig.onReset?.();
                      },
                      closeSheet: () => setIsFiltersOpen(false),
                    })}
                  </div>
                  <SheetFooter className="mt-6 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 gap-2"
                      onClick={() => {
                        filtersConfig.onReset?.();
                        setIsFiltersOpen(false);
                      }}
                    >
                      Reiniciar
                    </Button>
                    <Button
                      type="button"
                      className="flex-1 gap-2"
                      onClick={() => {
                        filtersConfig.onApply?.();
                        setIsFiltersOpen(false);
                      }}
                    >
                      Aplicar
                    </Button>
                  </SheetFooter>
                </SheetContent>
              </Sheet>
            )}
            {csvConfig?.enabled && (
              <>
                <input
                  ref={csvInputRef}
                  type="file"
                  className="hidden"
                  accept={csvConfig.accept ?? ".csv,text/csv"}
                  onChange={handleCsvInput}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => csvInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4" />
                  {csvConfig.label ?? "Importar CSV"}
                </Button>
              </>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {features?.toolbar?.renderEnd?.(toolbarProps)}
          </div>
        </div>
      )}

      {tabsEnabled && tabsOptions.length > 0 && (
        <Tabs
          value={activeTab ?? tabsOptions[0]?.value}
          onValueChange={(value) => {
            setActiveTab(value);
            setPage(1);
            if (serverMode) {
              emitServerQueryChange({ activeTab: value, page: 1 });
            }
          }}
          className="w-full"
        >
          <TabsList>
            {tabsOptions.map((option) => (
              <TabsTrigger key={option.value} value={option.value} className="gap-2">
                <span>{option.label}</span>
                {option.badge !== false && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                    {tabCounts[option.value] ?? 0}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      <div className={containerSurfaceClass}>
        <AnimatePresence>
          {showOverlay && (
            <motion.div
              key="datatable-overlay"
              className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-background/70 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <p className="text-sm font-medium text-primary">Cargando datos...</p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className={tableScrollClass}>
          <table ref={tableRef} data-table-id={id} className="w-full table-fixed text-sm">
            <ColGroup tableId={id} columns={tableColumnsCount} mode={columnResizingMode} />
            <thead className="sticky top-0 z-30 bg-sidebar">
              {renderHeaderRows({
                tableId: id,
                columns,
                headerGroups,
                columnIndexMap,
                getStickyProps,
                handleSortToggle,
                sortState,
                sortingEnabled,
                hasRowActions,
                columnResizingMode,
                headerGroupBgClassName,
                isColumnHidden,
                columnPinningEnabled,
                togglePinColumn,
                onExplicitSort: applySortDirection,
                onClearSort: clearSortState,
                headerContextMenuEnabled,
                isColumnPinned,
              })}
            </thead>
            <tbody className="bg-white">
              {visibleRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={tableColumnsCount}
                    className="px-6 py-12 text-center text-sm text-muted-foreground"
                  >
                    {emptyText}
                  </td>
                </tr>
              ) : (
                visibleRows.map(({ row, index: originalIndex }, visualIndex) => {
                  const rowKey = String(getRowId?.(row, originalIndex) ?? originalIndex);
                  const baseRow = (
                    <tr
                      className={cn(
                        "border-b transition-colors duration-150 group",
                      )}
                    >
                      {columns.map((column) => {
                        const isEditable =
                          editableEnabled && (allEditable || editableColumns.has(column.id));

                        const rowId = getRowId?.(row, originalIndex) ?? originalIndex;
                        const isEditing =
                          editingCell?.rowId === rowId && editingCell?.columnId === column.id;

                        const rendered = getCellValue({
                          row,
                          column,
                          rowIndex: originalIndex,
                          isEditable,
                          isEditing,
                          onEditStart: () => {
                            if (isEditable) setEditingCell({ rowId, columnId: column.id });
                          },
                          onEditEnd: () => setEditingCell(null),
                          updateCell: (next) => {
                            if (column.accessorKey) {
                              const newValue = typeof next === "function" ? next(row[column.accessorKey] as any) : next;
                              updateRow(originalIndex, {
                                [column.accessorKey]: newValue,
                              } as Partial<TData>);
                              editableConfig?.onRowUpdate?.({
                                ...row,
                                [column.accessorKey]: newValue,
                              } as TData, originalIndex);
                            }
                          },
                          updateRowAtIndex: (updater) => updateRow(originalIndex, updater),
                        });
                        const rawValue = getRawValue(row, column, originalIndex);
                        const cellContext = {
                          row,
                          rowIndex: originalIndex,
                          column,
                          value: rawValue,
                          updateCell: (value: unknown) => {
                            if (column.accessorKey) {
                              updateRow(originalIndex, {
                                [column.accessorKey]: value,
                              } as Partial<TData>);
                            }
                          },
                          updateRow: (next: RowUpdater<TData>) => updateRow(originalIndex, next),
                        };
                        const showCopyValue = contextMenuConfig?.copyValue !== false;
                        const showCopyColumn = contextMenuConfig?.copyColumn !== false;
                        const showCopyRow = contextMenuConfig?.copyRow !== false;
                        const showClear = Boolean(column.onClear);
                        const hasDefaultMenu =
                          contextMenuConfig?.enabled &&
                          (showCopyValue || showCopyColumn || showCopyRow || showClear);
                        const customMenu = column.contextMenuItems?.(cellContext);
                        const globalMenu = contextMenuConfig?.renderCellMenu?.(cellContext);
                        const hasCustomMenu = Boolean(customMenu) || Boolean(globalMenu);

                        const baseContent = (
                          rendered
                        );

                        const cellWithMenu =
                          contextMenuConfig?.enabled && (hasDefaultMenu || hasCustomMenu) ? (
                            <ContextMenu>
                              <ContextMenuTrigger asChild>{baseContent}</ContextMenuTrigger>
                              <ContextMenuContent className="w-56">
                                {hasDefaultMenu && (
                                  <>
                                    {showCopyValue && (
                                      <ContextMenuItem
                                        onClick={() =>
                                          copyToClipboard(
                                            rawValue == null ? "" : String(rawValue),
                                            "Valor copiado",
                                          )
                                        }
                                      >
                                        Copiar valor
                                      </ContextMenuItem>
                                    )}
                                    {showClear && (
                                      <ContextMenuItem onClick={() => column.onClear?.(cellContext)}>
                                        Limpiar valor
                                      </ContextMenuItem>
                                    )}
                                    {showCopyColumn && (
                                      <ContextMenuItem onClick={() => copyColumnValues(column)}>
                                        Copiar columna (página)
                                      </ContextMenuItem>
                                    )}
                                    {showCopyRow && (
                                      <ContextMenuItem
                                        onClick={() => copyRowValues(row, originalIndex)}
                                      >
                                        Copiar fila (CSV)
                                      </ContextMenuItem>
                                    )}
                                  </>
                                )}
                                {hasDefaultMenu && hasCustomMenu && <ContextMenuSeparator />}
                                {customMenu}
                                {globalMenu}
                              </ContextMenuContent>
                            </ContextMenu>
                          ) : (
                            baseContent
                          );

                        const baseClassName = cn(
                          "px-2 pl-4 py-4 outline outline-border border-border relative group-hover:bg-[hsl(50,17%,95%)]",
                          column.className,
                          visualIndex % 2 === 0 ? "bg-white" : "bg-[hsl(50,17%,98%)]",
                          column.align === "right" && "text-right",
                          column.align === "center" && "text-center",
                        );

                        return (
                          <td
                            key={column.id}
                            {...getStickyProps(column, baseClassName)}
                          >
                            {cellWithMenu}
                          </td>
                        );
                      })}
                      {hasRowActions && (
                        <td className={cn("pl-4 py-2 outline outline-border border-border relative group-hover:bg-[hsl(50,17%,95%)]", visualIndex % 2 === 0 ? "bg-white" : "bg-[hsl(50,17%,98%)]")}>
                          <RowActionsCell
                            row={row}
                            rowIndex={originalIndex}
                            config={rowActionsConfig}
                            duplicateRow={duplicateRow}
                            deleteRow={deleteRow}
                          />
                        </td>
                      )}
                    </tr>
                  );

                  const rowContext: DataTableRowActionContext<TData> = {
                    row,
                    rowIndex: originalIndex,
                    duplicateRow: () => duplicateRow(originalIndex),
                    deleteRow: () => deleteRow(originalIndex),
                  };

                  const defaultRowMenu =
                    rowActionsConfig?.enabled === true ? (
                      <>
                        <ContextMenuItem onClick={rowContext.duplicateRow}>
                          Duplicar fila
                        </ContextMenuItem>
                        <ContextMenuItem onClick={rowContext.deleteRow}>
                          Eliminar fila
                        </ContextMenuItem>
                      </>
                    ) : null;

                  const customRowMenu = rowActionsConfig?.renderContextMenu?.(rowContext);
                  const enableRowCopy =
                    contextMenuConfig?.enabled !== false &&
                    contextMenuConfig?.copyRow !== false;

                  const hasRowMenu =
                    Boolean(defaultRowMenu) || Boolean(customRowMenu) || enableRowCopy;

                  if (!hasRowMenu) {
                    return React.cloneElement(baseRow, { key: rowKey });
                  }

                  return (
                    <ContextMenu key={rowKey}>
                      <ContextMenuTrigger asChild>{baseRow}</ContextMenuTrigger>
                      <ContextMenuContent className="w-56">
                        {defaultRowMenu}
                        {defaultRowMenu && (customRowMenu || enableRowCopy) && (
                          <ContextMenuSeparator />
                        )}
                        {customRowMenu}
                        {customRowMenu && enableRowCopy && <ContextMenuSeparator />}
                        {enableRowCopy && (
                          <ContextMenuItem onClick={() => copyRowValues(row, originalIndex)}>
                            Copiar fila (CSV)
                          </ContextMenuItem>
                        )}
                      </ContextMenuContent>
                    </ContextMenu>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {addRowConfig?.enabled && (
            <Button type="button" variant="outline" size="sm" className="gap-2" onClick={addRow}>
              Agregar fila
            </Button>
          )}
          {editableEnabled && editableConfig?.onSave && (
            <Button
              type="button"
              size="sm"
              className="gap-2"
              disabled={!hasUnsavedChanges || isSaving || isLoading}
              onClick={async () => {
                try {
                  setIsSaving(true);
                  await editableConfig.onSave?.(rows);
                  setHasUnsavedChanges(false);
                  toast.success("Cambios guardados");
                } catch (error) {
                  console.error(error);
                  toast.error("Error al guardar cambios");
                } finally {
                  setIsSaving(false);
                }
              }}
            >
              {isSaving ? "Guardando..." : "Guardar cambios"}
            </Button>
          )}
        </div>

        {paginationEnabled && (
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Filas por página</span>
              <select
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm transition-colors hover:bg-muted/50 focus:outline-none"
                value={pageSize}
                onChange={(event) => {
                  const nextSize = Number(event.target.value);
                  setPageSize(nextSize);
                  setPage(1);
                  if (serverMode) {
                    emitServerQueryChange({ pageSize: nextSize, page: 1 });
                  }
                }}
              >
                {(paginationConfig?.pageSizeOptions ?? [10, 25, 50, 100]).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                Página{" "}
                <span className="font-medium text-foreground">{Math.min(page, totalPages)}</span>{" "}
                de{" "}
                <span className="font-medium text-foreground">{totalPages}</span>
              </span>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (page <= 1) return;
                    const nextPage = Math.max(1, page - 1);
                    setPage(nextPage);
                    if (serverMode) {
                      emitServerQueryChange({ page: nextPage });
                    }
                  }}
                  disabled={page <= 1}
                >
                  ←
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (page >= totalPages) return;
                    const nextPage = Math.min(totalPages, page + 1);
                    setPage(nextPage);
                    if (serverMode) {
                      emitServerQueryChange({ page: nextPage });
                    }
                  }}
                  disabled={page >= totalPages}
                >
                  →
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function getHeaderLabel(node: React.ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  return "Columna";
}

function getCellPrimitiveValue<TData extends Record<string, any>>(
  row: TData,
  column: DataTableColumn<TData>,
  rowIndex: number,
) {
  if (column.accessorFn) return column.accessorFn(row, rowIndex);
  if (column.accessorKey) return row[column.accessorKey];
  return "";
}

type GetCellValueArgs<TData extends Record<string, any>> = {
  row: TData;
  column: DataTableColumn<TData>;
  rowIndex: number;
  updateCell: (value: unknown) => void;
  updateRowAtIndex: (updater: RowUpdater<TData>) => void;
  isEditable?: boolean;
  isEditing?: boolean;
  onEditStart?: () => void;
  onEditEnd?: () => void;
};

function EditableCell({
  value,
  onCommit,
  onCancel,
  className,
}: {
  value: unknown;
  onCommit: (value: unknown) => void;
  onCancel: () => void;
  className?: string;
}) {
  const [localValue, setLocalValue] = React.useState(value);

  React.useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const onBlur = () => {
    if (localValue !== value) {
      onCommit(localValue);
    }
    // Revert on blur to avoid committing implicitly
    // setLocalValue(value);
    onCancel();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (localValue !== value) {
        onCommit(localValue);
      }
      onCancel();
    } else if (e.key === "Escape") {
      setLocalValue(value);
      onCancel();
    }
  };

  return (
    <Input
      autoFocus
      className={className}
      value={localValue ? String(localValue) : ""}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
    />
  );
}

function getCellValue<TData extends Record<string, any>>({
  row,
  column,
  rowIndex,
  updateCell,
  updateRowAtIndex,
  isEditable,
  isEditing,
  onEditStart,
  onEditEnd,
}: GetCellValueArgs<TData>) {
  let content: React.ReactNode = null;
  const value = column.accessorKey ? row[column.accessorKey] : undefined;

  if (isEditing && column.accessorKey) {
    return (
      <EditableCell
        value={value}
        onCommit={updateCell}
        onCancel={() => onEditEnd?.()}
        className="h-full w-full absolute top-0 left-0 px-2 py-1 rounded-none focus-visible:outline-orange-primary border-none z-10 focus-visible:ring-2 focus-visible:ring-offset-0"
      />
    );
  }

  if (column.renderCell) {
    content = column.renderCell({
      row,
      rowIndex,
      column,
      value,
      updateCell,
      updateRow: (next) => {
        if (typeof next === "function") {
          updateRowAtIndex(next as RowUpdater<TData>);
        } else {
          updateRowAtIndex((prev) => ({ ...prev, ...(next as Partial<TData>) }));
        }
      },
    });
  } else if (column.accessorFn) {
    content = column.accessorFn(row, rowIndex) as React.ReactNode;
  } else if (column.accessorKey) {
    content = value ?? "";
  }

  const cellContent = (
    <div
      className={cn(
        "min-h-[20px] w-full absolute top-0 left-0 h-full flex items-center justify-start overflow-hidden",
        isEditable && "cursor-pointer hover:bg-muted/50 rounded px-1"
      )}
      onClick={isEditable ? onEditStart : undefined}
      title={isEditable ? "Click para editar" : undefined}
    >
      {content}
    </div>
  );

  if (column.href) {
    const href = column.href(row, rowIndex);
    if (href) {
      return (
        <Link
          href={href}
          target={column.target}
          className="text-primary transition hover:underline underline-offset-2"
        >
          {cellContent}
        </Link>
      );
    }
  }

  return cellContent;
}

function RowActionsCell<TData extends Record<string, any>>({
  row,
  rowIndex,
  config,
  duplicateRow,
  deleteRow,
}: {
  row: TData;
  rowIndex: number;
  config?: DataTableFeatures<TData>["rowActions"];
  duplicateRow: (index: number) => void;
  deleteRow: (index: number) => void;
}) {
  if (!config?.enabled) return null;
  const context: DataTableRowActionContext<TData> = {
    row,
    rowIndex,
    duplicateRow: () => duplicateRow(rowIndex),
    deleteRow: () => deleteRow(rowIndex),
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {config.renderMenu ? (
          config.renderMenu(context)
        ) : (
          <>
            <DropdownMenuItem onClick={context.duplicateRow}>Duplicar fila</DropdownMenuItem>
            <DropdownMenuItem onClick={context.deleteRow}>Eliminar fila</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type HeaderRowsProps<TData extends Record<string, any>> = {
  tableId: string;
  columns: DataTableColumn<TData>[];
  headerGroups?: DataTableHeaderGroup[];
  columnIndexMap: Record<string, number>;
  getStickyProps: (column: DataTableColumn<TData>, baseClass?: string) => {
    className?: string;
    style?: React.CSSProperties;
  };
  handleSortToggle: (column: DataTableColumn<TData>) => void;
  sortState: DataTableSortState | null;
  sortingEnabled: boolean;
  hasRowActions: boolean;
  columnResizingMode: "balanced" | "fixed";
  headerGroupBgClassName: string;
  isColumnHidden: (columnId: string) => boolean;
  columnPinningEnabled: boolean;
  togglePinColumn: (columnId: string) => void;
  isColumnPinned: (columnId: string) => boolean;
  onExplicitSort: (column: DataTableColumn<TData>, direction: DataTableSortDirection) => void;
  onClearSort: () => void;
  headerContextMenuEnabled: boolean;
};

function renderHeaderRows<TData extends Record<string, any>>({
  tableId,
  columns,
  headerGroups,
  columnIndexMap,
  getStickyProps,
  handleSortToggle,
  sortState,
  sortingEnabled,
  hasRowActions,
  columnResizingMode,
  headerGroupBgClassName,
  isColumnHidden,
  columnPinningEnabled,
  togglePinColumn,
  isColumnPinned,
  onExplicitSort,
  onClearSort,
  headerContextMenuEnabled,
}: HeaderRowsProps<TData>) {
  const groupByColumnId = new Map<string, DataTableHeaderGroup>();
  headerGroups?.forEach((group) => {
    group.columns.forEach((columnId) => {
      groupByColumnId.set(columnId, group);
    });
  });

  const renderHeaderCell = (
    column: DataTableColumn<TData>,
    options?: { rowSpan?: number },
  ) => {
    const colIndex = columnIndexMap[column.id];
    if (colIndex == null) return null;
    const sortable = sortingEnabled && column.enableSort !== false;
    const pinnable = columnPinningEnabled && column.enablePin !== false;
    const showContextMenu = headerContextMenuEnabled && (sortable || pinnable);
    const pinned = isColumnPinned(column.id);

    const buttonContent = (
      <button
        type="button"
        className="flex w-full h-full  px-4 py-3  absolute top-0 left-0 items-center justify-between gap-2 text-left cursor-pointer"
        onClick={() => handleSortToggle(column)}
      >
        <span className="group-hover/header-cell:text-orange-primary">{column.header}</span>
        {sortState?.columnId === column.id && (
          <span className="group-hover/header-cell:text-orange-primary">{sortState.direction === "asc" ? "▲" : "▼"}</span>
        )}
      </button>
    );

    const headerButton = showContextMenu ? (
      <ContextMenu>
        <ContextMenuTrigger asChild>{buttonContent}</ContextMenuTrigger>
        <ContextMenuContent className="w-56">
          {sortable && (
            <>
              <ContextMenuItem onClick={() => onExplicitSort(column, "asc")}>
                Orden ascendente
              </ContextMenuItem>
              <ContextMenuItem onClick={() => onExplicitSort(column, "desc")}>
                Orden descendente
              </ContextMenuItem>
              {sortState?.columnId === column.id && (
                <ContextMenuItem onClick={onClearSort}>Quitar orden</ContextMenuItem>
              )}
            </>
          )}
          {sortable && pinnable && <ContextMenuSeparator />}
          {pinnable && (
            <ContextMenuItem onClick={() => togglePinColumn(column.id)}>
              {pinned ? "Desfijar columna" : "Fijar columna"}
            </ContextMenuItem>
          )}
        </ContextMenuContent>
      </ContextMenu>
    ) : (
      buttonContent
    );

    const baseClassName = cn(
      "relative px-4 py-4 text-left text-xs font-semibold uppercase outline outline-border bg-sidebar group/header-cell cursor-pointer",
      column.headerClassName,
    );

    return (
      <th
        key={column.id}
        rowSpan={options?.rowSpan}
        {...getStickyProps(column, baseClassName)}
      >
        {headerButton}
        <ColumnResizer tableId={tableId} colIndex={colIndex} mode={columnResizingMode} />
      </th>
    );
  };

  if (!headerGroups?.length) {
    return (
      <tr>
        {columns.map((column) => renderHeaderCell(column))}
        {hasRowActions && (
          <th className="px-4 py-3 text-right text-xs font-semibold uppercase">
            Acciones
            <ColumnResizer
              tableId={tableId}
              colIndex={columns.length}
              mode={columnResizingMode}
            />
          </th>
        )}
      </tr>
    );
  }

  const emittedGroups = new Set<string>();

  return (
    <>
      <tr>
        {columns.map((column) => {
          const group = groupByColumnId.get(column.id);
          if (!group) {
            return renderHeaderCell(column, { rowSpan: 2 });
          }
          if (emittedGroups.has(group.id)) return null;
          emittedGroups.add(group.id);
          const visibleColumns = group.columns.filter((columnId) => !isColumnHidden(columnId));
          if (visibleColumns.length === 0) return null;
          return (
            <th
              key={`group-${group.id}`}
              colSpan={visibleColumns.length}
              className={cn(
                "px-4 py-2 text-center text-xs font-semibold uppercase outline outline-border",
                headerGroupBgClassName,
                group.className,
              )}
            >
              {group.label}
            </th>
          );
        })}
        {hasRowActions && (
          <th
            rowSpan={2}
            className="px-4 py-3 text-right text-xs font-semibold uppercase"
          >
            Acciones
            <ColumnResizer
              tableId={tableId}
              colIndex={columns.length}
              mode={columnResizingMode}
            />
          </th>
        )}
      </tr>
      <tr>
        {columns.map((column) => {
          if (!groupByColumnId.has(column.id)) return null;
          return renderHeaderCell(column);
        })}
      </tr>
    </>
  );
}


