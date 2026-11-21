"use client";

import {
	ColumnDef as TanStackColumnDef,
	useReactTable,
	VisibilityState,
} from "@tanstack/react-table";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import type { FormTableContextValue } from "./context";
import { FormTableProvider, useFormTable as useFormTableContext } from "./context";
import { FormTableContent } from "./form-table-content";
import { FormTableLayout } from "./form-table-layout";
import { FormTablePagination } from "./form-table-pagination";
import { FormTableTabs } from "./form-table-tabs";
import { FormTableToolbar } from "./form-table-toolbar";
import { readPersistedNumber, writePersistedNumber } from "./persistence";
import { useTableAccordion } from "./table-accordion";
import { useTableBulkSelection } from "./table-bulk-selection";
import { useTableColumns } from "./table-columns";
import { useTableEditing } from "./table-editing";
import { useTableExport } from "./table-export";
import { useTableFetch } from "./table-fetch";
import { useTableFilters } from "./table-filters";
import { getFormTableRowModel } from "./table-row-model";
import { useTableRowPipeline } from "./table-row-pipeline";
import { useTableSearch } from "./table-search";
import { useTableSorting } from "./table-sorting";
import { useTableTabs } from "./table-tabs";
import { shallowEqualStringArrays } from "./table-utils";
import type { FormTableConfig, FormTableRow } from "./types";

export { FormTableBulkEditBar } from "./form-table-bulk-edit";
export { FormTableContent, FormTablePagination, FormTableTabs, FormTableToolbar };

export const useFormTable = useFormTableContext;

export { requiredValidator } from "./table-utils";

type TableActivityKind = "loading" | "sorting" | "search" | "filter" | "pagination";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 250];
const DEFAULT_PAGE_SIZE = 25;
const SLOW_OPERATION_MS = 1200;

type FormTableProps<Row extends FormTableRow, Filters> = {
	config: FormTableConfig<Row, Filters>;
	className?: string;
	innerClassName?: string;
	toolbarClassName?: string;
	searchQuery?: string;
	onSearchQueryChange?: (value: string) => void;
	onSearchInputChange?: (value: string) => void;
	variant?: "page" | "embedded";
	children?: ReactNode;
};

export function FormTable<Row extends FormTableRow, Filters>({
	config,
	className,
	innerClassName,
	toolbarClassName,
	searchQuery,
	onSearchQueryChange,
	onSearchInputChange,
	variant = "page",
	children,
}: FormTableProps<Row, Filters>) {
	const TABLE_ID = config.tableId;
	const paginationDisabled = config.disablePagination === true;
	const fetchRowsFn = config.fetchRows ?? null;
	const useServerDataMode = config.serverSideData === true && Boolean(fetchRowsFn);
	const isEmbedded = variant === "embedded";
	const isReadOnly = config.readOnly === true;
	const edits = useTableEditing(config);
	const addRow = edits.addRow;
	const {
		FieldComponent,
		setFormFieldValue,
		rowOrder,
		rows,
		setFormRows,
		hasInitialRow,
		isCellDirty,
		getRowDirtyState,
		hasUnsavedChanges,
		isSaving,
		serverError,
		setServerError,
		handleClearCell,
		handleRestoreCell,
		setCellValue,
		updateRow,
		handleDelete,
		handleSave,
		handleDiscardChanges,
	} = edits;
	const [activeCell, setActiveCell] = useState<{ rowId: string; columnId: string } | null>(null);
	const updateActiveCell = useCallback((cell: { rowId: string; columnId: string } | null) => {
		setActiveCell((current) => {
			if (current?.rowId === cell?.rowId && current?.columnId === cell?.columnId) {
				return current;
			}
			return cell;
		});
	}, []);
	const [page, setPage] = useState(1);
	const pageSizeOptions = config.pageSizeOptions ?? PAGE_SIZE_OPTIONS;
	const lockedPageSize = config.lockedPageSize;
	const initialPageSize =
		typeof lockedPageSize === "number"
			? lockedPageSize
			: (config.defaultPageSize ?? DEFAULT_PAGE_SIZE);
	const [pageSize, setPageSizeState] = useState(initialPageSize);
	useEffect(() => {
		if (lockedPageSize) return;
		const persistedPageSize = readPersistedNumber(`${TABLE_ID}:pageSize`);
		if (!persistedPageSize) return;
		if (!pageSizeOptions.includes(persistedPageSize)) return;
		setPageSizeState((prev) => (prev === persistedPageSize ? prev : persistedPageSize));
	}, [TABLE_ID, lockedPageSize, pageSizeOptions]);
	useEffect(() => {
		if (lockedPageSize && pageSize !== lockedPageSize) {
			setPageSizeState(lockedPageSize);
		}
	}, [lockedPageSize, pageSize]);
	useEffect(() => {
		if (!lockedPageSize) {
			writePersistedNumber(`${TABLE_ID}:pageSize`, pageSize);
		}
	}, [TABLE_ID, lockedPageSize, pageSize]);
	const paginationOptions = useMemo(
		() => (lockedPageSize ? [lockedPageSize] : pageSizeOptions),
		[lockedPageSize, pageSizeOptions]
	);
	// Track if a page size change is in progress (for showing loading state)
	const [isPageSizeTransitioning, startPageSizeTransition] = useTransition();
	const [activeActivityKind, setActiveActivityKind] = useState<TableActivityKind | null>(null);
	const [activityRunId, setActivityRunId] = useState(0);
	const [isSlowOperation, setIsSlowOperation] = useState(false);
	const markActivityStart = useCallback((kind: TableActivityKind) => {
		setActiveActivityKind(kind);
		setActivityRunId((prev) => prev + 1);
	}, []);
	const handleSetPageSize = useCallback(
		(size: number) => {
			if (lockedPageSize) return;
			markActivityStart("pagination");
			startPageSizeTransition(() => {
				setPageSizeState(size);
				setPage(1);
			});
		},
		[lockedPageSize, markActivityStart]
	);
	const columnState = useTableColumns(config);
	const {
		hiddenIds: hiddenColumnIds,
		setHiddenIds: setHiddenColumnIds,
		columnsById,
		isColumnHidden,
	} = columnState;
	const columns = config.columns;
	const { tabFilters, hasTabFilters, activeTab, setActiveTab } = useTableTabs(config);
	const searchPlaceholder = config.searchPlaceholder ?? "Buscar...";
	const showInlineSearch = config.showInlineSearch !== false;

	const onSearchCommit = useCallback(() => markActivityStart("search"), [markActivityStart]);
	const {
		searchInputValue,
		searchRequestKey,
		isSearchInputLag,
		isSearchTransitioning,
		handleSearchInputChange,
	} = useTableSearch({
		searchQuery,
		onSearchQueryChange,
		onSearchInputChange,
		onCommit: onSearchCommit,
	});
	const onSort = useCallback(() => {
		updateActiveCell(null);
		markActivityStart("sorting");
	}, [updateActiveCell, markActivityStart]);
	const lockedSort = config.lockedSort ?? null;
	const {
		effectiveSortState,
		isSortTransitioning,
		pendingSortColumnId,
		toggleSort,
		applySortDirection,
		clearSort,
		resetSort,
	} = useTableSorting(lockedSort, onSort);
	const onApplyFilters = useCallback(() => markActivityStart("filter"), [markActivityStart]);
	const {
		hasFilters,
		filters,
		filtersDraft,
		setFiltersDraftValue,
		appliedFiltersKey,
		activeFilterCount,
		isFilterTransitioning,
		handleApplyAdvancedFilters,
		handleResetAdvancedFilters,
		resetFilters,
	} = useTableFilters(config, onApplyFilters);
	const {
		isServerPaging,
		useClientPagination,
		isFetchingServerRows,
		serverMeta,
		externalRefreshVersion,
	} = useTableFetch({
		config,
		page,
		pageSize,
		activeTab,
		effectiveSortState,
		searchRequestKey,
		appliedFiltersKey,
		filters,
		rowOrder,
		setFormRows,
		setServerError,
	});
	const isServerSortingFetch = isFetchingServerRows && activeActivityKind === "sorting";
	const isServerSearchFetch = isFetchingServerRows && activeActivityKind === "search";
	const isServerFilterFetch = isFetchingServerRows && activeActivityKind === "filter";
	const isSearchProcessing = isSearchTransitioning || isSearchInputLag || isServerSearchFetch;
	const isSortProcessing = isSortTransitioning || isServerSortingFetch;
	const isFilterProcessing = isFilterTransitioning || isServerFilterFetch;
	const isBusy =
		isFetchingServerRows ||
		isPageSizeTransitioning ||
		isSearchProcessing ||
		isSortProcessing ||
		isFilterProcessing;
	const activityKind: TableActivityKind | null = isBusy
		? (activeActivityKind ??
			(isSearchProcessing
				? "search"
				: isFilterProcessing
					? "filter"
					: isSortProcessing
						? "sorting"
						: isPageSizeTransitioning
							? "pagination"
							: isFetchingServerRows
								? "loading"
								: "loading"))
		: null;

	useEffect(() => {
		if (isBusy) return;
		setActiveActivityKind((prev) => (prev === null ? prev : null));
		setIsSlowOperation(false);
	}, [isBusy]);

	useEffect(() => {
		if (!isBusy || !activityKind) return;
		setIsSlowOperation(false);
		const timeoutId = window.setTimeout(() => {
			setIsSlowOperation(true);
		}, SLOW_OPERATION_MS);
		return () => {
			window.clearTimeout(timeoutId);
		};
	}, [activityKind, activityRunId, isBusy]);
	const { hasAccordionRows, accordionRowConfig, isRowExpanded, toggleAccordionRow } =
		useTableAccordion(config.accordionRow, rowOrder, rows);

	const serverRequestIdentity = `${searchRequestKey}::${appliedFiltersKey}::${activeTab ?? "all"}::${effectiveSortState.columnId ?? "none"}::${effectiveSortState.direction}`;
	const previousServerRequestIdentityRef = useRef<string | null>(null);
	useEffect(() => {
		if (!fetchRowsFn) {
			previousServerRequestIdentityRef.current = null;
			return;
		}
		const previousIdentity = previousServerRequestIdentityRef.current;
		previousServerRequestIdentityRef.current = serverRequestIdentity;
		if (previousIdentity === null || previousIdentity === serverRequestIdentity) return;
		setPage(1);
	}, [fetchRowsFn, serverRequestIdentity]);

	useEffect(() => {
		if (!activeCell) return;
		if (!rowOrder.includes(activeCell.rowId)) {
			updateActiveCell(null);
		}
	}, [activeCell, rowOrder, updateActiveCell]);

	const { sortedRows, tabCounts, highlightQuery } = useTableRowPipeline({
		rows,
		searchRequestKey,
		columns,
		applyFilters: config.applyFilters,
		filters,
		tabFilters,
		hasTabFilters,
		activeTab,
		enableClientSort: config.enableClientSort,
		effectiveSortState,
		useServerDataMode,
	});
	const clientTotalPages = useMemo(() => {
		if (paginationDisabled) return 1;
		if (sortedRows.length === 0) return 1;
		return Math.max(1, Math.ceil(sortedRows.length / pageSize));
	}, [paginationDisabled, sortedRows.length, pageSize]);

	useEffect(() => {
		if (!useClientPagination) return;
		if (page > clientTotalPages) {
			setPage(clientTotalPages);
		}
	}, [clientTotalPages, page, useClientPagination]);

	// Detect if server returned more rows than requested (server doesn't support pagination)
	const serverReturnedAllRows =
		!useServerDataMode && fetchRowsFn && sortedRows.length > pageSize && serverMeta.totalPages <= 1;

	const processedRows = useMemo(() => {
		if (paginationDisabled) {
			return sortedRows;
		}
		if (useServerDataMode) {
			return sortedRows;
		}
		// Client-side pagination when no fetchRowsFn OR when server returned all rows at once
		if (!fetchRowsFn || serverReturnedAllRows) {
			const start = (page - 1) * pageSize;
			return sortedRows.slice(start, start + pageSize);
		}
		return sortedRows;
	}, [
		paginationDisabled,
		page,
		pageSize,
		sortedRows,
		fetchRowsFn,
		serverReturnedAllRows,
		useServerDataMode,
	]);

	const {
		bulkSelection,
		selectedColumn,
		clearBulkSelection,
		isBulkCellSelected,
		beginBulkSelectionDrag,
		extendBulkSelectionDrag,
		endBulkSelectionDrag,
		commitBulkCellValue,
		applyBulkSelectionValue,
	} = useTableBulkSelection({
		processedRows,
		columnsById,
		isReadOnly,
		activeCell,
		updateActiveCell,
		setFormFieldValue,
	});
	// Use client pagination values when server returned all rows at once
	const useClientPaginationValues =
		!useServerDataMode && (useClientPagination || serverReturnedAllRows);

	const datasetTotalCount = paginationDisabled
		? sortedRows.length
		: useClientPaginationValues
			? sortedRows.length
			: serverMeta.total || sortedRows.length;

	const totalPages = paginationDisabled
		? 1
		: useClientPaginationValues
			? clientTotalPages
			: serverMeta.totalPages || 1;

	const hasNextPage = paginationDisabled
		? false
		: useClientPaginationValues
			? page < clientTotalPages
			: serverMeta.hasNextPage;
	const hasPreviousPage = paginationDisabled
		? false
		: useClientPaginationValues
			? page > 1
			: serverMeta.hasPreviousPage;

	const totalRowCount = datasetTotalCount;
	const visibleRowCount = processedRows.length;

	const editMode = config.editMode ?? "always";
	const editOnHover = config.editOnHover ?? false;
	// TanStack Table column definitions (static)
	const tableColumns = useMemo<TanStackColumnDef<Row>[]>(() => {
		return columns.map((col) => ({
			id: col.id,
			accessorKey: col.field,
			header: col.label,
			cell: (info) => info.getValue() ?? "",
		}));
	}, [columns]);

	// TanStack Table column visibility state
	const columnVisibility = useMemo<VisibilityState>(() => {
		const state: VisibilityState = {};
		hiddenColumnIds.forEach((id) => {
			state[id] = false;
		});
		return state;
	}, [hiddenColumnIds]);

	// TanStack Table instance
	const getRowId = useCallback((row: Row) => row.id, []);
	const table = useReactTable({
		data: processedRows,
		columns: tableColumns,
		getCoreRowModel: getFormTableRowModel(),
		getRowId,
		state: {
			columnVisibility,
		},
		onColumnVisibilityChange: (updater) => {
			const newVisibility = typeof updater === "function" ? updater(columnVisibility) : updater;
			const hidden = Object.keys(newVisibility).filter((key) => !newVisibility[key]);
			setHiddenColumnIds((prev) => (shallowEqualStringArrays(prev, hidden) ? prev : hidden));
		},
		enableColumnResizing: false, // We handle resizing manually
		columnResizeMode: "onChange",
	});
	const visibleDataColumnCount = table.getVisibleLeafColumns().length;

	const handleAddRow = useCallback(() => {
		if (isReadOnly) return;
		addRow();
		if (config.revealNewRowOnAdd) {
			if (searchInputValue.trim().length > 0) {
				handleSearchInputChange("");
			}
			resetFilters();
			if (!lockedSort && effectiveSortState.columnId) {
				resetSort();
			}
			if (hasTabFilters && activeTab !== "all" && tabFilters.some((tab) => tab.id === "all")) {
				setActiveTab("all");
			}
		}
		setPage(1);
		toast.success("Fila vacía agregada");
	}, [
		activeTab,
		addRow,
		resetFilters,
		resetSort,
		setActiveTab,
		config,
		effectiveSortState.columnId,
		handleSearchInputChange,
		hasTabFilters,
		isReadOnly,
		lockedSort,
		searchInputValue,
		tabFilters,
	]);

	const { handleCopyCell, handleCopyColumn, handleCopyRow, handleExportCsv } = useTableExport({
		config,
		rows,
		sortedRows,
		processedRows,
		hiddenColumnIds,
		isColumnHidden,
		searchRequestKey,
		filters,
		activeTab,
		effectiveSortState,
	});
	const contextValue: FormTableContextValue<Row, Filters> = {
		config,
		tableId: TABLE_ID,
		search: {
			value: searchInputValue,
			placeholder: searchPlaceholder,
			showInline: showInlineSearch,
			isProcessing: isSearchProcessing,
			onChange: handleSearchInputChange,
		},
		filters: {
			enabled: hasFilters,
			value: filters,
			draft: filtersDraft,
			setDraft: setFiltersDraftValue,
			activeCount: activeFilterCount,
			isProcessing: isFilterProcessing,
			reset: handleResetAdvancedFilters,
			apply: handleApplyAdvancedFilters,
		},
		columns: columnState,
		sorting: {
			state: effectiveSortState,
			isProcessing: isSortProcessing,
			pendingColumnId: pendingSortColumnId,
			toggle: toggleSort,
			applyDirection: applySortDirection,
			clear: clearSort,
		},
		tabs: {
			enabled: hasTabFilters,
			items: tabFilters,
			activeTab,
			setActiveTab,
			counts: tabCounts,
		},
		pagination: {
			page,
			setPage,
			pageSize,
			setPageSize: handleSetPageSize,
			lockedPageSize,
			hasNextPage,
			hasPreviousPage,
			totalPages,
			totalRowCount,
			visibleRowCount,
			datasetTotalCount,
			options: paginationOptions,
			isServerPaging,
			isFetching: isFetchingServerRows,
			isTransitioning: isPageSizeTransitioning,
		},
		meta: {
			hasUnsavedChanges,
			isSaving,
			serverError,
			variant,
			isEmbedded,
			externalRefreshVersion,
			isBusy,
			isSlowOperation,
			activityKind,
		},
		rows: {
			table,
			currentRows: rows,
			FieldComponent,
			highlightQuery,
			editMode,
			editOnHover,
			activeCell,
			setActiveCell: updateActiveCell,
			getRowDirtyState,
			isCellDirty,
			hasInitialRow,
			hasAccordionRows,
			accordionRowConfig,
			isRowExpanded,
			toggleAccordionRow,
			handleDelete,
			handleClearCell,
			handleRestoreCell,
			handleCommitCellValue: commitBulkCellValue,
			setCellValue,
			updateRow,
			handleCopyCell,
			handleCopyColumn,
			handleCopyRow,
			visibleDataColumnCount,
		},
		bulkSelection: {
			selectedColumn,
			selectedRowIds: bulkSelection.rowIds,
			count: bulkSelection.rowIds.length,
			isDragging: bulkSelection.isDragging,
			isCellSelected: isBulkCellSelected,
			beginDrag: beginBulkSelectionDrag,
			extendDrag: extendBulkSelectionDrag,
			endDrag: endBulkSelectionDrag,
			clear: clearBulkSelection,
			applyValue: applyBulkSelectionValue,
		},
		actions: {
			save: handleSave,
			discard: handleDiscardChanges,
			addRow: handleAddRow,
			exportCsv: handleExportCsv,
		},
	};
	return (
		<FormTableProvider value={contextValue}>
			{children ?? (
				<FormTableLayout
					className={className}
					innerClassName={innerClassName}
					toolbarClassName={toolbarClassName}
				/>
			)}
		</FormTableProvider>
	);
}
