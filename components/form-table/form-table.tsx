'use client';

import { useState, useCallback, useEffect, useMemo, useRef, useTransition, startTransition } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, ReactNode } from "react";
import { useForm, useStore } from "@tanstack/react-form";
import {
	useReactTable,
	getCoreRowModel,
	ColumnDef as TanStackColumnDef,
	VisibilityState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Button, ExpandableLightButton, LightButton } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
	TooltipProvider,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ColumnResizer, balanceTableColumns } from "@/components/ui/column-resizer";
import { ColumnVisibilityMenu } from "@/components/data-table/column-visibility-menu";
import {
	Filter,
	ArrowUp,
	ArrowDown,
	ArrowUpDown,
	Minus,
	Loader2,
	ChevronLeft,
	ChevronRight,
	Download,
	Search,
	MoreHorizontal,
	Plus,
	RotateCcw,
	Save,
	Check,
	Undo2,
	X,
} from "lucide-react";
import type {
	ColumnField,
	ColumnDef,
	FormFieldComponent,
	FormTableConfig,
	FormTableRow,
	FormValues,
	HeaderGroup,
	SortState,
	TabFilterOption,
	ServerPaginationMeta,
} from "./types";
import {
	createRowFromColumns,
	defaultSearchMatcher,
	defaultSortByField,
	getClearedValue,
	shallowEqualValues,
	snapshotValues,
	tableRowToCsv,
	valuesToCsvRow,
	copyToClipboard,
} from "./table-utils";
import { FormTableProvider, useFormTable as useFormTableContext } from "./context";
import type { FormTableContextValue } from "./context";
import { MemoizedTableRow } from "./table-body";

export const useFormTable = useFormTableContext;

const DEFAULT_ROW_NUMBER_COLUMN_WIDTH = 42;
const SEARCH_COMMIT_DEBOUNCE_MS = 220;

function getSpreadsheetColumnLabel(index: number) {
	let label = "";
	let current = index + 1;
	while (current > 0) {
		const remainder = (current - 1) % 26;
		label = String.fromCharCode(65 + remainder) + label;
		current = Math.floor((current - 1) / 26);
	}
	return label;
}

function shouldUseSpreadsheetChrome<Row extends FormTableRow, Filters>(config: FormTableConfig<Row, Filters>) {
	return (
		config.showRowNumbers === true ||
		(config.showRowNumbers !== false &&
			(config.tableId.startsWith("ocr-orders-") ||
				config.tableId.startsWith("ocr-doc-") ||
				config.tableId.startsWith("documents-new-ocr-")))
	);
}

const FORM_TABLE_FLOATING_INTERACTION_SELECTOR = [
	'[data-slot="select-content"]',
	'[data-slot="context-menu-content"]',
	'[data-slot="context-menu-sub-content"]',
	'[data-slot="dropdown-menu-content"]',
	'[data-slot="dropdown-menu-sub-content"]',
	'[data-slot="popover-content"]',
	'[data-radix-popper-content-wrapper]',
].join(", ");

function getElementFromEventTarget(target: EventTarget | null) {
	if (target instanceof Element) return target;
	if (target instanceof Node) return target.parentElement;
	return null;
}

export function FormTableToolbar({ className }: { className?: string }) {
	const { config, search, filters, columns, sorting, pagination, actions } = useFormTable<FormTableRow, unknown>();
	const [isFiltersOpen, setIsFiltersOpen] = useState(false);
	const isExtrasToolbar = config.toolbarMode === "extras";
	const isSpreadsheetChrome = shouldUseSpreadsheetChrome(config);
	const canShowFilters = filters.enabled && typeof filters.value !== "undefined";
	const rowCountText =
		pagination.totalRowCount > 0 && pagination.visibleRowCount !== pagination.totalRowCount
			? `${pagination.visibleRowCount}/${pagination.totalRowCount} filas`
			: `${pagination.visibleRowCount} filas`;

	const renderFiltersContent =
		isFiltersOpen && typeof filters.draft !== "undefined" && config.renderFilters
			? config.renderFilters({
				filters: filters.draft,
				onChange: (updater) => filters.setDraft((prev) => updater(prev ?? filters.draft)),
			})
			: (
				<p className="text-sm text-content-muted">
					No hay filtros configurados para esta vista.
				</p>
			);

	const columnVisibilityMenu = (
		<ColumnVisibilityMenu
			columns={columns.list.map((column) => ({
				id: column.id,
				label: column.label,
				canHide: column.enableHide !== false,
				canPin: column.enablePin !== false,
			}))}
			hiddenColumns={columns.hiddenIds}
			setHiddenColumns={columns.setHiddenIds}
			pinnedColumns={columns.pinnedIds}
			togglePin={columns.togglePin}
			onBalanceColumns={columns.handleBalance}
			disabled={false}
			triggerVariant={isExtrasToolbar ? "secondary" : "default"}
			triggerClassName={
				cn(
					"h-8 min-w-8 px-2",
					isExtrasToolbar
						? "h-8 w-full justify-start rounded-sm px-2 py-1.5 text-sm font-normal"
						: isSpreadsheetChrome && "text-xs"
				)
			}
		/>
	);

	return (
		<div className={cn("flex flex-wrap items-center justify-between gap-2 z-20", isSpreadsheetChrome && "gap-2", className)}>
			<div className="flex flex-wrap items-center gap-2">
				{search.showInline && (
					<div className="group relative ml-0.5 flex items-center gap-2">
						{search.isProcessing ? (
							<Loader2 className="absolute left-4 top-1/2 z-10 size-5 -translate-y-1/2 animate-spin text-content" />
						) : (
							<Search className="absolute left-4 top-1/2 z-10 size-4 -translate-y-1/2 text-content" />
						)}
						<Input
							type="search"
							data-testid="form-table-search"
							className={cn(
								"pointer-events-auto w-[360px] bg-surface pl-9 pr-[68px] text-sm font-medium text-content bg-[linear-gradient(to_bottom,rgb(255_255_255/0),rgb(255_255_255/0))]! border border-stroke-soft shadow-[0_1px_0_rgba(255,255,255,1),inset_0_1px_1px_rgba(15,23,22,0.08)] placeholder:text-content-muted focus-visible:ring-2 focus-visible:ring-orange-primary/20 [&::-webkit-search-cancel-button]:hidden",
								isSpreadsheetChrome
									? "sm:w-[360px]"
									: "sm:w-64 md:w-[360px]"
							)}
							value={search.value}
							onChange={(event) => search.onChange(event.target.value)}
							placeholder={search.placeholder}
						/>
						{/* <LightButton
							aria-hidden="true"
							className="absolute right-3 top-1/2 h-6 -translate-y-1/2  px-2.5 text-sm font-medium leading-none text-content-muted"
						>
							Ctrl + D
						</LightButton> */}
					</div>
				)}
				{isSpreadsheetChrome && (
					<span className="inline-flex h-8 items-center rounded-md border border-stroke-soft bg-surface-recessed px-2.5 text-[11px] font-semibold text-content-muted shadow-recessed">
						{search.isProcessing ? "Buscando..." : rowCountText}
					</span>
				)}
				{search.showInline && config.toolbarSearchEnd}
				{canShowFilters && (
					<Sheet open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
						{!isExtrasToolbar && (
							<SheetTrigger asChild>
								<ExpandableLightButton
									type="button"
									label="Filtros"
									variant={filters.activeCount > 0 ? "primary" : "default"}
									className="h-8 min-w-8 px-2"
								>
									{filters.isProcessing ? (
										<Loader2 className="size-4 animate-spin" />
									) : (
										<Filter className="size-4" />
									)}
									{filters.activeCount > 0 && (
										<span className="ml-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-foreground/20 px-1.5 text-[10px] font-semibold">
											{filters.activeCount}
										</span>
									)}
								</ExpandableLightButton>
							</SheetTrigger>
						)}
						<SheetContent
							side="right"
							className="flex !max-w-[420px] flex-col border-l border-stroke-soft bg-surface p-0 shadow-dropdown"
						>
							<div className="shrink-0 border-b border-stroke-soft bg-surface px-6 py-5">
								<SheetHeader className="space-y-1">
									<div className="flex items-center gap-3">
										<div className="flex size-9 items-center justify-center rounded-md border border-stroke-soft bg-surface-recessed text-content-muted">
											<Filter className="size-4" />
										</div>
										<div>
											<SheetTitle className="text-lg">Filtros avanzados</SheetTitle>
											<p className="mt-0.5 text-xs text-content-secondary">
												{filters.activeCount > 0
													? `${filters.activeCount} filtro${filters.activeCount > 1 ? 's' : ''} activo${filters.activeCount > 1 ? 's' : ''}`
													: "Refina los resultados de la tabla"
												}
											</p>
										</div>
									</div>
								</SheetHeader>
							</div>

							<div className="flex-1 overflow-y-auto px-6 py-5">
								<div className="space-y-5">{renderFiltersContent}</div>
							</div>

							<div className="shrink-0 border-t border-stroke-soft bg-surface-recessed px-6 py-4">
								<div className="flex items-center justify-between gap-3">
									<LightButton
										type="button"
										variant="default"
										onClick={filters.reset}
										className="gap-1.5 px-3 py-3"
									>
										<RotateCcw className="size-4" />
										Reiniciar filtros
									</LightButton>
									<LightButton
										type="button"
										variant="primarySolid"
										onClick={() => {
											filters.apply();
											setIsFiltersOpen(false);
										}}
										className="gap-1.5 px-3 py-3"
									>
										<Check className="size-4" />
										Aplicar
									</LightButton>
								</div>
							</div>
						</SheetContent>
					</Sheet>
				)}
				{isExtrasToolbar ? (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<ExpandableLightButton
								type="button"
								label="Extras"
								variant="default"
								className="h-8 min-w-8 px-2"
							>
								<MoreHorizontal className="size-4" />
							</ExpandableLightButton>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="start" className="w-[320px]">
							{canShowFilters && (
								<>
									<DropdownMenuItem
										onSelect={(event) => {
											event.preventDefault();
											setIsFiltersOpen(true);
										}}
										className="gap-2"
									>
										{filters.isProcessing ? (
											<Loader2 className="size-4 animate-spin" />
										) : (
											<Filter className="size-4" />
										)}
										<span>Filtros</span>
										{filters.activeCount > 0 && (
											<span className="ml-auto rounded-full bg-orange-primary/10 px-2 py-0.5 text-[10px] font-semibold text-orange-primary">
												{filters.activeCount}
											</span>
										)}
									</DropdownMenuItem>
									<DropdownMenuSeparator />
								</>
							)}
							<div className="">{columnVisibilityMenu}</div>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								onSelect={(event) => {
									event.preventDefault();
									void actions.exportCsv();
								}}
								className="gap-2"
							>
								<Download className="size-4" />
								Exportar tabla
							</DropdownMenuItem>
							{config.toolbarActions && (
								<>
									<DropdownMenuSeparator />
									<div className="">{config.toolbarActions}</div>
								</>
							)}
						</DropdownMenuContent>
					</DropdownMenu>
				) : (
					<>
						{columnVisibilityMenu}
						{config.toolbarActions}
					</>
				)}
			</div>
			<div className="flex flex-wrap items-center gap-2 ">
				{!isExtrasToolbar && (
					<ExpandableLightButton
						type="button"
						label={isSpreadsheetChrome ? "Exportar" : "Exportar tabla"}
						variant="default"
						className={cn("h-8 min-w-8 px-2", isSpreadsheetChrome && "text-xs")}
						onClick={() => void actions.exportCsv()}
					>
						<Download className="size-4" />
					</ExpandableLightButton>
				)}
				{sorting.state.columnId && (
					<ExpandableLightButton
						type="button"
						label="Limpiar orden"
						variant="default"
						className={cn("h-8 min-w-8 px-2", isSpreadsheetChrome && "text-xs")}
						onClick={sorting.clear}
					>
						<Minus className="size-4" />
					</ExpandableLightButton>
				)}
			</div>
		</div>
	);
}

export function FormTableTabs({ className }: { className?: string }) {
	const { tabs, pagination } = useFormTable<FormTableRow, unknown>();
	if (!tabs.enabled || tabs.items.length === 0) {
		return null;
	}

	const handleTabChange = (value: string) => {
		tabs.setActiveTab(value);
		pagination.setPage(1);
	};

	return (
		<div
			role="tablist"
			aria-label="Filtros de tabla"
			className={cn("flex gap-1 rounded-md border border-stroke-soft bg-surface-recessed p-0.5", className)}
		>
			{tabs.items.map((tab) => {
				const isActive = tabs.activeTab === tab.id;
				return (
					<Button
						key={tab.id}
						type="button"
						role="tab"
						aria-selected={isActive}
						onClick={() => handleTabChange(tab.id)}
						variant={isActive ? "default" : "secondary"}

						className="gap-2"
					>
						<span>{tab.label}</span>
						<span className={cn(
							"rounded-full px-2 py-0.5 text-xs",
							isActive
								? "bg-black/20 text-white"
								: "bg-surface-recessed text-content-muted"
						)}>
							{tabs.counts[tab.id] ?? 0}
						</span>
					</Button>
				);
			})}
		</div>
	);
}

function coerceBulkEditValue<Row extends FormTableRow>(column: ColumnDef<Row>, rawValue: string) {
	const cellType = column.cellType ?? "text";
	if (cellType === "number" || cellType === "currency") {
		if (rawValue.trim() === "") return null;
		const normalized = rawValue.replace(/\./g, "").replace(",", ".");
		const parsed = Number(normalized);
		return Number.isFinite(parsed) ? parsed : rawValue;
	}
	if (cellType === "boolean" || cellType === "checkbox" || cellType === "toggle") {
		return rawValue === "true";
	}
	return rawValue;
}

export function FormTableBulkEditBar() {
	const { config, bulkSelection } = useFormTable<FormTableRow, unknown>();
	const [draft, setDraft] = useState({ selectionKey: "", value: "" });
	const selectedColumn = bulkSelection.selectedColumn;
	const isReadOnly = config.readOnly === true;

	if (isReadOnly || !selectedColumn || bulkSelection.count < 2) {
		return null;
	}

	const cellType = selectedColumn.cellType ?? "text";
	const selectOptions = selectedColumn.cellConfig?.selectOptions ?? [];
	const canUseSelect = cellType === "select" && selectOptions.length > 0;
	const isBoolean =
		cellType === "boolean" || cellType === "checkbox" || cellType === "toggle";
	const selectionKey = `${selectedColumn.id}:${bulkSelection.selectedRowIds.join(",")}`;
	const value = draft.selectionKey === selectionKey ? draft.value : "";
	const setValue = (nextValue: string) => setDraft({ selectionKey, value: nextValue });

	const apply = () => {
		bulkSelection.applyValue(coerceBulkEditValue(selectedColumn, value));
		setDraft({ selectionKey: "", value: "" });
	};

	return (
		<div className="flex flex-wrap items-center gap-2 rounded-md border border-accent-border bg-accent-soft px-3 py-2 text-sm text-orange-primary shadow-card">
			<span className="font-medium">
				{bulkSelection.count} celdas seleccionadas en {selectedColumn.label}
			</span>
			{canUseSelect ? (
				<Select value={value} onValueChange={setValue}>
					<SelectTrigger size="sm" className="w-[220px]">
						<SelectValue placeholder="Elegir valor" />
					</SelectTrigger>
					<SelectContent>
						{selectOptions.map((option) => (
							<SelectItem key={option.text} value={option.text}>
								{option.text}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			) : isBoolean ? (
				<Select value={value} onValueChange={setValue}>
					<SelectTrigger size="sm" className="w-[160px]">
						<SelectValue placeholder="Elegir valor" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="true">Si</SelectItem>
						<SelectItem value="false">No</SelectItem>
					</SelectContent>
				</Select>
			) : (
				<Input
					value={value}
					onChange={(event) => setValue(event.target.value)}
					placeholder="Valor para aplicar"
					type={cellType === "date" ? "date" : "text"}
					className="h-8 w-[220px]"
				/>
			)}
			<LightButton
				type="button"
				size="sm"
				variant="primarySolid"
				onClick={apply}
				disabled={value === ""}
				className="h-8 gap-1 px-2"
			>
				<Check className="size-3.5" />
				Aplicar
			</LightButton>
			<LightButton
				type="button"
				size="sm"
				variant="default"
				onClick={bulkSelection.clear}
				className="h-8 min-w-8 px-2"
				aria-label="Limpiar seleccion"
			>
				<X className="size-4" />
			</LightButton>
		</div>
	);
}

export function FormTableContent({ className, innerClassName, tableHeight }: { className?: string, innerClassName?: string, tableHeight?: string }) {
	const {
		tableId,
		config,
		columns,
		rows,
		bulkSelection,
		meta,
		pagination,
		sorting,
	} = useFormTable<FormTableRow, unknown>();
	const { externalRefreshVersion } = meta;
	const rowClassName = config.rowClassName as
		| ((row: FormTableRow, rowIndex: number) => string | undefined)
		| undefined;
	const rowElementClassName = config.rowElementClassName as
		| ((row: FormTableRow, rowIndex: number) => string | undefined)
		| undefined;
	const rowColorInfo = config.rowColorInfo as
		| ((row: FormTableRow, rowIndex: number) => import("./types").RowColorInfo | undefined)
		| undefined;
	const rowOverlayBadges = config.rowOverlayBadges as
		| ((
			row: FormTableRow,
			rowIndex: number
		) => Array<{ id: string; label: string; tone?: "amber" | "red" | "green" | "blue" }>)
		| undefined;

	const columnDefs = columns.list;
	const { tableRef, colRefs, colWidths, columnOffsets, isColumnHidden, getStickyProps, columnIndexMap, columnsById, groupedColumnLookup, enableResizing, hiddenIds, pinnedIds } = columns;
	const hiddenColumnIdsKey = useMemo(() => hiddenIds.join(","), [hiddenIds]);
	const bulkSelectedRowIdsSet = useMemo(
		() => new Set(bulkSelection.selectedRowIds),
		[bulkSelection.selectedRowIds]
	);
	const {
		table,
		FieldComponent,
		highlightQuery,
		editMode,
		editOnHover,
		activeCell,
		setActiveCell,
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
		handleCommitCellValue,
		setCellValue,
		updateRow,
		handleCopyCell,
		handleCopyColumn,
		handleCopyRow,
		visibleDataColumnCount,
	} = rows;
	const accordionAlwaysOpen = Boolean(accordionRowConfig?.alwaysOpen);
	const isReadOnly = config.readOnly === true;
	const showRowNumbers = shouldUseSpreadsheetChrome(config);
	const rowNumberColumnWidth = config.rowNumberColumnWidth ?? DEFAULT_ROW_NUMBER_COLUMN_WIDTH;
	const showActionsColumn = config.showActionsColumn !== false;
	const actionsColumnPosition = config.actionsColumnPosition ?? "end";
	const actionsColumnWidth = config.actionsColumnWidth ?? 140;
	const actionsColumnLabel = config.actionsColumnLabel === undefined ? "Acciones" : config.actionsColumnLabel;
	const headerCellClassName = config.headerCellClassName;
	const tableLayoutClassName = config.tableLayout === "auto" ? "table-auto" : "table-fixed";
	const dataColumnIndexOffset = (showRowNumbers ? 1 : 0) + (showActionsColumn && actionsColumnPosition === "start" ? 1 : 0);
	const visibleColumnDefs = showRowNumbers ? columnDefs.filter((column) => !isColumnHidden(column.id)) : [];
	// Rows only consume sticky left offsets, so the key that busts row memoization
	// tracks exactly those — resizing unpinned columns no longer re-renders rows
	// (their widths are applied through <col> elements).
	const stickyStateKey = useMemo(() => {
		if (pinnedIds.length === 0) return "none";
		const offsetKey = pinnedIds
			.map((columnId) => `${columnId}:${columnOffsets[columnId] ?? "?"}`)
			.join(",");
		return `${pinnedIds.join(",")}::${offsetKey}`;
	}, [pinnedIds, columnOffsets]);
	const canDeleteRows = !isReadOnly && config.allowDeleteRows !== false;
	const { serverError, activityKind, isBusy, isSlowOperation } = meta;
	const { isServerPaging, isFetching } = pagination;
	const {
		state: sortState,
		isProcessing: isSortProcessing,
		pendingColumnId: pendingSortColumnId,
		toggle: toggleSort,
		applyDirection,
		clear: clearSort,
	} = sorting;
	const scrollParentRef = useRef<HTMLDivElement | null>(null);
	const tableRows = table.getRowModel().rows;
	const shouldVirtualize =
		config.enableRowVirtualization === true &&
		!hasAccordionRows &&
		tableRows.length > 24;
	const virtualizedRowEstimate = config.virtualizationEstimateSize ?? 58;
	const rowVirtualizer = useVirtualizer({
		count: shouldVirtualize ? tableRows.length : 0,
		getScrollElement: () => scrollParentRef.current,
		estimateSize: () => virtualizedRowEstimate,
		overscan: config.virtualizationOverscan ?? 5,
	});
	const virtualRows = shouldVirtualize ? rowVirtualizer.getVirtualItems() : [];
	const paddingTop = shouldVirtualize && virtualRows.length > 0 ? virtualRows[0]!.start : 0;
	const paddingBottom =
		shouldVirtualize && virtualRows.length > 0
			? rowVirtualizer.getTotalSize() - virtualRows[virtualRows.length - 1]!.end
			: 0;
	const rowIds = useMemo(() => tableRows.map((row) => row.original.id), [tableRows]);
	const rowIdSet = useMemo(() => new Set(rowIds), [rowIds]);
	const rowIndexById = useMemo(() => {
		const map = new Map<string, number>();
		rowIds.forEach((rowId, index) => {
			map.set(rowId, index);
		});
		return map;
	}, [rowIds]);
	const [hoveredCell, setHoveredCell] = useState<{ rowId: string; columnId: string } | null>(null);
	useEffect(() => {
		if (editMode !== "active-cell" || isReadOnly) {
			setHoveredCell(null);
		}
	}, [editMode, isReadOnly]);
	useEffect(() => {
		if (!hoveredCell) return;
		if (!rowIdSet.has(hoveredCell.rowId)) {
			setHoveredCell(null);
		}
	}, [hoveredCell, rowIdSet]);
	const visibleColumnIds = useMemo(
		() => columnDefs.filter((column) => !isColumnHidden(column.id)).map((column) => column.id),
		[columnDefs, isColumnHidden]
	);
	const focusCellControl = useCallback((rowId: string, columnId: string) => {
		if (typeof window === "undefined") return;
		const tableElement = tableRef.current;
		if (!tableElement) return;

		const locateCell = () =>
			tableElement.querySelector<HTMLElement>(
				`td[data-form-table-cell="true"][data-row-id="${escapeSelectorAttributeValue(rowId)}"][data-column-id="${escapeSelectorAttributeValue(columnId)}"]`
			);
		const attemptFocus = () => {
			const cell = locateCell();
			if (!cell) return false;
			cell.scrollIntoView({ block: "nearest", inline: "nearest" });
			const control = cell.querySelector<HTMLElement>(
				'input:not([type="hidden"]), textarea, select, button, [role="combobox"], [role="switch"], [role="checkbox"], [contenteditable="true"]'
			);
			if (control) {
				try {
					control.focus({ preventScroll: true });
				} catch {
					control.focus();
				}
				return true;
			}
			const passiveCell = cell.querySelector<HTMLElement>('[data-form-table-passive-cell="true"]');
			if (passiveCell) {
				try {
					passiveCell.focus({ preventScroll: true });
				} catch {
					passiveCell.focus();
				}
				return "passive";
			}
			cell.tabIndex = -1;
			try {
				cell.focus({ preventScroll: true });
			} catch {
				cell.focus();
			}
			return "cell";
		};
		const firstAttempt = attemptFocus();
		if (firstAttempt === true || firstAttempt === "cell") return;
		if (firstAttempt === "passive") {
			window.requestAnimationFrame(() => {
				window.requestAnimationFrame(() => {
					void attemptFocus();
				});
			});
			return;
		}
		window.requestAnimationFrame(() => {
			const secondAttempt = attemptFocus();
			if (secondAttempt) return;
			window.requestAnimationFrame(() => {
				void attemptFocus();
			});
		});
	}, [tableRef]);
	const handleArrowNavigation = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
		const key = event.key;
		if (
			key !== "ArrowUp" &&
			key !== "ArrowDown" &&
			key !== "ArrowLeft" &&
			key !== "ArrowRight"
		) {
			return;
		}
		if (editMode !== "active-cell") return;
		if (event.altKey || event.metaKey || event.ctrlKey || event.shiftKey) return;
		if (rowIds.length === 0 || visibleColumnIds.length === 0) return;

		const target = event.target as HTMLElement | null;
		if (!target) return;
		if (target.closest('[data-form-table-ignore-arrow-navigation="true"]')) return;
		const currentCellElement = target.closest<HTMLElement>('td[data-form-table-cell="true"]');
		const currentRowId = activeCell?.rowId ?? currentCellElement?.dataset.rowId ?? rowIds[0];
		const currentColumnId = activeCell?.columnId ?? currentCellElement?.dataset.columnId ?? visibleColumnIds[0];
		let nextRowIndex = rowIndexById.get(currentRowId) ?? -1;
		let nextColumnIndex = visibleColumnIds.indexOf(currentColumnId);
		if (nextRowIndex < 0) nextRowIndex = 0;
		if (nextColumnIndex < 0) nextColumnIndex = 0;

		switch (key) {
			case "ArrowUp":
				nextRowIndex = Math.max(0, nextRowIndex - 1);
				break;
			case "ArrowDown":
				nextRowIndex = Math.min(rowIds.length - 1, nextRowIndex + 1);
				break;
			case "ArrowLeft":
				nextColumnIndex = Math.max(0, nextColumnIndex - 1);
				break;
			case "ArrowRight":
				nextColumnIndex = Math.min(visibleColumnIds.length - 1, nextColumnIndex + 1);
				break;
		}

		const nextCell = {
			rowId: rowIds[nextRowIndex]!,
			columnId: visibleColumnIds[nextColumnIndex]!,
		};
		if (shouldVirtualize) {
			rowVirtualizer.scrollToIndex(nextRowIndex, { align: "auto" });
		}

		event.preventDefault();
		event.stopPropagation();
		setActiveCell(nextCell);
		focusCellControl(nextCell.rowId, nextCell.columnId);
	}, [
		activeCell,
		editMode,
		focusCellControl,
		rowIds,
		rowIndexById,
		rowVirtualizer,
		setActiveCell,
		shouldVirtualize,
		visibleColumnIds,
	]);
	const handleClearHoveredCell = useCallback(() => {
		setHoveredCell(null);
	}, []);
	useEffect(() => {
		if (!activeCell) return;
		if (typeof document === "undefined") return;

		const shouldKeepActiveCell = (target: EventTarget | null) => {
			const element = getElementFromEventTarget(target);
			if (!element) return false;
			if (element.closest(FORM_TABLE_FLOATING_INTERACTION_SELECTOR)) return true;

			const cell = element.closest<HTMLElement>('td[data-form-table-cell="true"]');
			return Boolean(cell && tableRef.current?.contains(cell));
		};

		const clearActiveCellIfOutside = (event: PointerEvent) => {
			if (shouldKeepActiveCell(event.target)) return;
			setActiveCell(null);
		};

		document.addEventListener("pointerdown", clearActiveCellIfOutside, true);

		return () => {
			document.removeEventListener("pointerdown", clearActiveCellIfOutside, true);
		};
	}, [activeCell, setActiveCell, tableRef]);
	const pendingBulkSelectionRef = useRef<{
		rowId: string;
		column: ColumnDef<FormTableRow>;
		startX: number;
		startY: number;
	} | null>(null);
	const shouldIgnoreBulkSelectionStart = useCallback((event: ReactMouseEvent<HTMLElement>) => {
		const target = event.target as HTMLElement | null;
		return Boolean(
			target?.closest(
				'button, a, [role="combobox"], [role="switch"], [role="checkbox"], [data-column-resizer="true"]'
			)
		);
	}, []);
	const handleBulkSelectionMouseDown = useCallback((event: ReactMouseEvent<HTMLElement>, rowId: string, column: ColumnDef<FormTableRow>) => {
		if (event.button !== 0 || isReadOnly) return;
		if (shouldIgnoreBulkSelectionStart(event)) return;
		pendingBulkSelectionRef.current = {
			rowId,
			column,
			startX: event.clientX,
			startY: event.clientY,
		};
	}, [isReadOnly, shouldIgnoreBulkSelectionStart]);
	const handleBulkSelectionMouseEnter = useCallback((event: ReactMouseEvent<HTMLElement>, rowId: string, column: ColumnDef<FormTableRow>) => {
		if (event.buttons !== 1) {
			pendingBulkSelectionRef.current = null;
			if (bulkSelection.isDragging) {
				bulkSelection.endDrag();
			}
			return;
		}
		if (bulkSelection.isDragging) {
			event.preventDefault();
			bulkSelection.extendDrag(rowId, column);
			return;
		}
		const pending = pendingBulkSelectionRef.current;
		if (!pending) return;
		if (pending.column.id !== column.id) {
			pendingBulkSelectionRef.current = null;
			return;
		}
		const deltaX = event.clientX - pending.startX;
		const deltaY = event.clientY - pending.startY;
		const hasIntentionalDrag =
			Math.hypot(deltaX, deltaY) >= BULK_SELECTION_DRAG_THRESHOLD_PX &&
			rowId !== pending.rowId;
		if (!hasIntentionalDrag) return;
		event.preventDefault();
		bulkSelection.beginDrag(pending.rowId, pending.column);
		bulkSelection.extendDrag(rowId, column);
	}, [bulkSelection]);
	const handleBulkSelectionMouseUp = useCallback(() => {
		pendingBulkSelectionRef.current = null;
		if (!bulkSelection.isDragging) return;
		bulkSelection.endDrag();
	}, [bulkSelection]);
	useEffect(() => {
		if (!bulkSelection.isDragging && !pendingBulkSelectionRef.current) return;
		const handleWindowMouseUp = () => {
			pendingBulkSelectionRef.current = null;
			if (bulkSelection.isDragging) {
				bulkSelection.endDrag();
			}
		};
		window.addEventListener("mouseup", handleWindowMouseUp);
		return () => {
			window.removeEventListener("mouseup", handleWindowMouseUp);
		};
	}, [bulkSelection]);

	return (
		<>
			{serverError && (
				<div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
					{serverError}
				</div>
			)}
			<div className={cn("relative w-full flex-1 overflow-x-auto rounded-none bg-card", className)}>
				{isServerPaging && isFetching && tableRows.length === 0 && (
					<div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-surface/80 backdrop-blur-sm">
						<Loader2 className="size-6 animate-spin text-primary" />
						<p className="text-sm font-medium text-content-muted">Sincronizando con el servidor...</p>
					</div>
				)}
				{isBusy && activityKind && tableRows.length > 0 && (
					<div className="pointer-events-none absolute right-3 top-3 z-40">
						<div
							role="status"
							aria-live="polite"
							className={cn(
								"inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium shadow-sm",
								isSlowOperation
									? "border-amber-300 bg-amber-50 text-amber-800"
									: "border-accent-border bg-surface/90 text-orange-primary"
							)}
						>
							<Loader2 className="size-3.5 animate-spin" />
							<span>{getTableActivityMessage(activityKind, isSlowOperation)}</span>
						</div>
					</div>
				)}
				<div
					ref={scrollParentRef}
					onPointerLeave={handleClearHoveredCell}
					onKeyDownCapture={handleArrowNavigation}
					className={cn("h-full overflow-y-auto bg-card scrollbar", bulkSelection.isDragging && "select-none cursor-crosshair", innerClassName)}>
					<table ref={tableRef} data-table-id={tableId} className={cn("w-full max-w-full border-separate border-spacing-0 text-[13px] relative", tableLayoutClassName, tableHeight)}>
						<colgroup className="max-w-full overflow-hidden">
							{showRowNumbers && (
								<col
									style={{
										width: `${rowNumberColumnWidth}px`,
										minWidth: `${rowNumberColumnWidth}px`,
										maxWidth: `${rowNumberColumnWidth}px`,
									}}
								/>
							)}
							{showActionsColumn && actionsColumnPosition === "start" && (
								<col
									style={{
										width: `${actionsColumnWidth}px`,
										minWidth: `${actionsColumnWidth}px`,
										maxWidth: `${actionsColumnWidth}px`,
									}}
								/>
							)}
							{columnDefs.map((column, index) => (
								<col
									key={column.id}
									ref={(el) => {
										colRefs.current[index + dataColumnIndexOffset] = el;
									}}
									style={{
										width: `${colWidths[index + dataColumnIndexOffset] ?? DEFAULT_COL_WIDTH}px`,
										display: isColumnHidden(column.id) ? "none" : undefined,
									}}
								/>
							))}
							{showActionsColumn && actionsColumnPosition === "end" && (
								<col
									style={{
										width: `${actionsColumnWidth}px`,
										minWidth: `${actionsColumnWidth}px`,
										maxWidth: `${actionsColumnWidth}px`,
									}}
								/>
							)}
						</colgroup>
						<thead className="sticky top-0 z-[101] bg-surface-muted">
							{showRowNumbers ? (
								<tr>
									<th
										className="sticky left-0 z-[130] h-10 border-b border-r border-stroke-soft bg-surface-muted px-2 text-center text-[10px] font-bold uppercase tracking-wide text-content-disabled"
										style={{
											width: rowNumberColumnWidth,
											minWidth: rowNumberColumnWidth,
											maxWidth: rowNumberColumnWidth,
										}}
									>
										#
									</th>
									{showActionsColumn && actionsColumnPosition === "start" && (
										<th
											className={cn("relative h-10 border-b border-r border-stroke-soft bg-surface-muted p-0 text-center text-[10px] font-bold uppercase tracking-[0.08em] text-content-secondary", headerCellClassName)}
											style={{
												width: actionsColumnWidth,
												minWidth: actionsColumnWidth,
												maxWidth: actionsColumnWidth,
											}}
										>
											<div className="absolute inset-0 flex items-center justify-center gap-2 px-2 py-2">
												{actionsColumnLabel === null ? null : <span>{actionsColumnLabel}</span>}
											</div>
										</th>
									)}
									{visibleColumnDefs.map((column) => {
										const isSortable = column.enableSort !== false;
										return (
											<th
												key={`sheet-label-${column.id}`}
												{...getStickyProps(
													column.id,
													cn("relative h-10 border-b border-r border-stroke-soft bg-surface-muted px-3 py-0 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-content-secondary", headerCellClassName)
												)}
											>
												<div className="absolute inset-0 flex items-center justify-between gap-2 px-3 py-2">
													{isSortable ? (
														<ContextMenu>
															<ContextMenuTrigger asChild>
																<button
																	type="button"
																	onClick={() => toggleSort(column.id)}
																	className="flex w-full items-center justify-between gap-2 text-left"
																>
																	<span className="truncate">{column.label}</span>
																	<span className="flex items-center gap-2 text-content-muted">
																		{isSortProcessing &&
																			(sortState.columnId === column.id || pendingSortColumnId === column.id) && (
																				<Loader2 className="size-3.5 animate-spin text-primary" />
																			)}
																		{sortState.columnId === column.id ? (
																			sortState.direction === "asc" ? (
																				<ArrowUp className="size-3.5" />
																			) : (
																				<ArrowDown className="size-3.5" />
																			)
																		) : (
																			<ArrowUpDown className="size-3.5" />
																		)}
																	</span>
																</button>
															</ContextMenuTrigger>
															<ContextMenuContent>
																<ContextMenuItem onClick={() => applyDirection(column.id, "asc")}>
																	Orden ascendente
																</ContextMenuItem>
																<ContextMenuItem onClick={() => applyDirection(column.id, "desc")}>
																	Orden descendente
																</ContextMenuItem>
																<ContextMenuItem onClick={clearSort}>
																	Quitar orden
																</ContextMenuItem>
															</ContextMenuContent>
														</ContextMenu>
													) : (
														<span className="flex w-full items-center justify-between gap-2 text-left text-content-muted">
															<span className="truncate">{column.label}</span>
														</span>
													)}
												</div>
												{enableResizing && column.enableResize !== false && (
													<ColumnResizer tableId={tableId} colIndex={columnIndexMap[column.id] + dataColumnIndexOffset} mode="fixed" />
												)}
											</th>
										);
									})}
									{showActionsColumn && actionsColumnPosition === "end" && (
										<th
											className={cn("relative h-10 border-b border-stroke-soft bg-surface-muted p-0 text-right text-[10px] font-bold uppercase tracking-[0.08em] text-content-secondary", headerCellClassName)}
											style={{
												width: actionsColumnWidth,
												minWidth: actionsColumnWidth,
												maxWidth: actionsColumnWidth,
											}}
										>
											<div className="absolute inset-0 flex items-center justify-end gap-2 px-3 py-2">
												<span className={actionsColumnLabel === null ? "sr-only" : undefined}>
													{actionsColumnLabel ?? "Acciones"}
												</span>
											</div>
											{enableResizing && (
												<ColumnResizer tableId={tableId} colIndex={columnDefs.length + dataColumnIndexOffset} mode="fixed" />
											)}
										</th>
									)}
								</tr>
							) : (
								<>
									<tr>
										{(() => {
											const emittedGroups = new Set<string>();
											return (
												<>
													{showRowNumbers && (
														<th
															rowSpan={2}
															className="sticky left-0 z-[130] h-9 border-b border-r border-stroke-soft bg-surface-muted px-2 text-center text-[10px] font-bold uppercase tracking-wide text-content-disabled"
															style={{
																width: rowNumberColumnWidth,
																minWidth: rowNumberColumnWidth,
																maxWidth: rowNumberColumnWidth,
															}}
														>
															#
														</th>
													)}
													{showActionsColumn && actionsColumnPosition === "start" && (
														<th
															rowSpan={2}
															className={cn("relative h-9 whitespace-nowrap border-b border-r border-stroke-soft bg-surface-muted p-0 text-center text-[10px] font-bold uppercase tracking-[0.12em] text-content-secondary", headerCellClassName)}
															style={{
																width: actionsColumnWidth,
																minWidth: actionsColumnWidth,
																maxWidth: actionsColumnWidth,
															}}
														>
															<div className="absolute left-0 top-0 flex h-full w-full items-center justify-center gap-2 px-2 py-2">
																{actionsColumnLabel === null ? null : <span>{actionsColumnLabel}</span>}
															</div>
														</th>
													)}
													{columnDefs.map((column, visibleColumnIndex) => {
														if (isColumnHidden(column.id)) return null;
														const group = groupedColumnLookup.get(column.id);
														if (!group) {
															const isSortable = column.enableSort !== false;
															return (
																<th
																	key={`no-group-${column.id}`}
																	rowSpan={2}
																	{...getStickyProps(
																		column.id,
																		cn("relative h-9 border-b border-r border-stroke-soft bg-surface-muted px-3 py-0 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-content-secondary", headerCellClassName)
																	)}
																>
																	<div className="absolute left-0 top-0 flex h-full w-full items-center justify-between gap-2 px-3 py-2">
																		{isSortable ? (
																			<ContextMenu>
																				<ContextMenuTrigger asChild>
																					<button
																						type="button"
																						onClick={() => toggleSort(column.id)}
																						className="flex w-full items-center justify-between gap-2 text-left"
																					>
																						<span className="flex min-w-0 items-center gap-2">
																							{showRowNumbers && (
																								<span className="grid size-4 shrink-0 place-items-center rounded border border-stroke-soft bg-card text-[9px] font-bold text-content-disabled shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
																									{getSpreadsheetColumnLabel(visibleColumnIndex)}
																								</span>
																							)}
																							<span className="truncate">{column.label.toUpperCase()}</span>
																						</span>
																						<span className="flex items-center gap-2 text-content-muted">
																							{isSortProcessing &&
																								(sortState.columnId === column.id || pendingSortColumnId === column.id) && (
																									<Loader2 className="size-3.5 animate-spin text-primary" />
																								)}
																							{sortState.columnId === column.id ? (
																								sortState.direction === "asc" ? (
																									<ArrowUp className="size-3.5" />
																								) : (
																									<ArrowDown className="size-3.5" />
																								)
																							) : (
																								<ArrowUpDown className="size-3.5" />
																							)}
																						</span>
																					</button>
																				</ContextMenuTrigger>
																				<ContextMenuContent>
																					<ContextMenuItem onClick={() => applyDirection(column.id, "asc")}>
																						Orden ascendente
																					</ContextMenuItem>
																					<ContextMenuItem onClick={() => applyDirection(column.id, "desc")}>
																						Orden descendente
																					</ContextMenuItem>
																					<ContextMenuItem onClick={clearSort}>
																						Quitar orden
																					</ContextMenuItem>
																				</ContextMenuContent>
																			</ContextMenu>
																		) : (
																			<span className="flex w-full items-center justify-between gap-2 text-left text-content-muted">
																				<span className="flex min-w-0 items-center gap-2">
																					{showRowNumbers && (
																						<span className="grid size-4 shrink-0 place-items-center rounded border border-stroke-soft bg-card text-[9px] font-bold text-content-disabled shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
																							{getSpreadsheetColumnLabel(visibleColumnIndex)}
																						</span>
																					)}
																					<span className="truncate">{column.label}</span>
																				</span>
																			</span>
																		)}
																	</div>
																	{enableResizing && column.enableResize !== false && (
																		<ColumnResizer tableId={tableId} colIndex={columnIndexMap[column.id] + dataColumnIndexOffset} mode="fixed" />
																	)}
																</th>
															);
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
																	"border-b border-r border-stroke-soft bg-surface-muted px-4 py-2 text-center text-[10px] font-bold uppercase tracking-[0.12em] text-content-secondary",
																	headerCellClassName,
																	group.className
																)}
															>
																{group.label}
															</th>
														);
													})}
													{showActionsColumn && actionsColumnPosition === "end" && (
														<th
															rowSpan={2}
															className={cn("relative h-9 border-b border-stroke-soft bg-surface-muted p-0 text-right text-[10px] font-bold uppercase tracking-[0.12em] text-content-secondary", headerCellClassName)}
															style={{
																width: actionsColumnWidth,
																minWidth: actionsColumnWidth,
																maxWidth: actionsColumnWidth,
															}}
														>
															<div className="absolute left-0 top-0 flex h-full w-full items-center justify-end gap-2 px-3 py-2">
																<span className={actionsColumnLabel === null ? "sr-only" : undefined}>
																	{actionsColumnLabel ?? "Acciones"}
																</span>
															</div>
															{enableResizing && (
																<ColumnResizer tableId={tableId} colIndex={columnDefs.length + dataColumnIndexOffset} mode="fixed" />
															)}
														</th>
													)}
												</>
											);
										})()}
									</tr>
									<tr>
										{columnDefs.map((column, colIndex) => {
											if (isColumnHidden(column.id)) return null;
											if (!groupedColumnLookup.has(column.id)) return null;

											const baseClassName = cn(
												"relative h-9 border-b border-r border-stroke-soft bg-surface-muted px-3 py-0 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-content-secondary",
												headerCellClassName
											);
											const isSortable = column.enableSort !== false;

											return (
												<th key={column.id} {...getStickyProps(column.id, baseClassName)}>
													<div className="absolute left-0 top-0 flex h-full w-full items-center justify-between gap-2 px-3 py-2">
														{isSortable ? (
															<ContextMenu>
																<ContextMenuTrigger asChild>
																	<button
																		type="button"
																		onClick={() => toggleSort(column.id)}
																		className="flex w-full items-center justify-between gap-2 text-left"
																	>
																		<span className="flex min-w-0 items-center gap-2">
																			{showRowNumbers && (
																				<span className="grid size-4 shrink-0 place-items-center rounded border border-stroke-soft bg-card text-[9px] font-bold text-content-disabled shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
																					{getSpreadsheetColumnLabel(colIndex)}
																				</span>
																			)}
																			<span className="truncate">{column.label}</span>
																		</span>
																		<span className="text-content-muted">
																			{isSortProcessing &&
																				(sortState.columnId === column.id || pendingSortColumnId === column.id) && (
																					<Loader2 className="mr-1 inline size-3.5 animate-spin text-primary" />
																				)}
																			{sortState.columnId === column.id ? (
																				sortState.direction === "asc" ? (
																					<ArrowUp className="inline size-3.5" />
																				) : (
																					<ArrowDown className="inline size-3.5" />
																				)
																			) : (
																				<ArrowUpDown className="size-3.5" />
																			)}
																		</span>
																	</button>
																</ContextMenuTrigger>
																<ContextMenuContent>
																	<ContextMenuItem onClick={() => applyDirection(column.id, "asc")}>
																		Orden ascendente
																	</ContextMenuItem>
																	<ContextMenuItem onClick={() => applyDirection(column.id, "desc")}>
																		Orden descendente
																	</ContextMenuItem>
																	<ContextMenuItem onClick={clearSort}>
																		Quitar orden
																	</ContextMenuItem>
																</ContextMenuContent>
															</ContextMenu>
														) : (
															<span className="flex w-full items-center justify-between gap-2 text-left text-content-muted">
																<span className="flex min-w-0 items-center gap-2">
																	{showRowNumbers && (
																		<span className="grid size-4 shrink-0 place-items-center rounded border border-stroke-soft bg-card text-[9px] font-bold text-content-disabled shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
																			{getSpreadsheetColumnLabel(colIndex)}
																		</span>
																	)}
																	<span className="truncate">{column.label}</span>
																</span>
															</span>
														)}
													</div>
													{enableResizing && column.enableResize !== false && (
														<ColumnResizer tableId={tableId} colIndex={colIndex + dataColumnIndexOffset} mode="fixed" />
													)}
												</th>
											);
										})}
									</tr>
								</>
							)}
						</thead>
						<tbody className="bg-card">
							{tableRows.length === 0 ? (
								<tr>
									<td
										colSpan={visibleDataColumnCount + (showActionsColumn ? 1 : 0) + (showRowNumbers ? 1 : 0)}
										className="px-6 py-12 text-center text-sm text-content-muted"
									>
										{config.emptyStateMessage ??
											"No encontramos filas que coincidan con tu búsqueda o filtros. Ajusta los criterios o agrega una nueva fila vacía para comenzar."}
									</td>
								</tr>
							) : shouldVirtualize ? (
								<>
									{paddingTop > 0 && (
										<tr>
											<td
												colSpan={visibleDataColumnCount + (showActionsColumn ? 1 : 0) + (showRowNumbers ? 1 : 0)}
												style={{ height: `${paddingTop}px` }}
											/>
										</tr>
									)}
									{virtualRows.map((virtualRow) => {
										const row = tableRows[virtualRow.index];
										const rowId = row.original.id;
										const { dirty: rowIsDirty, cellIdsKey: dirtyCellIds } = getRowDirtyState(rowId);
										return (
											<MemoizedTableRow
												key={rowId}
												row={row}
												rowIndex={virtualRow.index}
												externalRefreshVersion={externalRefreshVersion}
												hoveredCell={hoveredCell}
												setHoveredCell={setHoveredCell}
												columnsById={columnsById}
												rowClassName={rowClassName}
												rowElementClassName={rowElementClassName}
												rowColorInfo={rowColorInfo}
												rowOverlayBadges={rowOverlayBadges}
												FieldComponent={FieldComponent}
												tableReadOnly={isReadOnly}
												highlightQuery={highlightQuery}
												editMode={editMode}
												editOnHover={editOnHover}
												activeCell={activeCell}
												setActiveCell={setActiveCell}
												onCommitCellValue={handleCommitCellValue}
												hasInitialSnapshot={hasInitialRow(rowId)}
												accordionRowConfig={accordionRowConfig}
												accordionAlwaysOpen={accordionAlwaysOpen}
												isExpanded={isRowExpanded(rowId)}
												isRowDirty={rowIsDirty}
												dirtyCellIds={dirtyCellIds}
												hiddenColumnIdsKey={hiddenColumnIdsKey}
												stickyStateKey={stickyStateKey}
												showRowNumbers={showRowNumbers}
												rowNumberColumnWidth={rowNumberColumnWidth}
												showActionsColumn={showActionsColumn}
												actionsColumnPosition={actionsColumnPosition}
												actionsColumnWidth={actionsColumnWidth}
												canDeleteRows={canDeleteRows}
												isCellDirty={isCellDirty}
												bulkSelectedColumnId={bulkSelection.selectedColumn?.id ?? null}
												bulkSelectedCount={bulkSelection.count}
												isRowBulkSelected={bulkSelectedRowIdsSet.has(rowId)}
												onBulkSelectionStart={handleBulkSelectionMouseDown}
												onBulkSelectionExtend={handleBulkSelectionMouseEnter}
												onBulkSelectionEnd={handleBulkSelectionMouseUp}
												getStickyProps={getStickyProps}
												onToggleAccordion={toggleAccordionRow}
												onDelete={handleDelete}
												onClearCell={handleClearCell}
												onRestoreCell={handleRestoreCell}
												onSetCellValue={setCellValue}
												onUpdateRow={updateRow}
												onCopyCell={handleCopyCell}
												onCopyColumn={handleCopyColumn}
												onCopyRow={handleCopyRow}
												measureElement={rowVirtualizer.measureElement}
											/>
										);
									})}
									{paddingBottom > 0 && (
										<tr>
											<td
												colSpan={visibleDataColumnCount + (showActionsColumn ? 1 : 0) + (showRowNumbers ? 1 : 0)}
												style={{ height: `${paddingBottom}px` }}
											/>
										</tr>
									)}
								</>
							) : (
								// Non-virtualized rendering for small datasets
								tableRows.map((row, rowIndex) => {
									const rowId = row.original.id;
									const { dirty: rowIsDirty, cellIdsKey: dirtyCellIds } = getRowDirtyState(rowId);
									return (
										<MemoizedTableRow
											key={rowId}
											row={row}
											rowIndex={rowIndex}
											externalRefreshVersion={externalRefreshVersion}
											hoveredCell={hoveredCell}
											setHoveredCell={setHoveredCell}
											columnsById={columnsById}
											rowClassName={rowClassName}
											rowElementClassName={rowElementClassName}
											rowColorInfo={rowColorInfo}
											rowOverlayBadges={rowOverlayBadges}
											FieldComponent={FieldComponent}
											tableReadOnly={isReadOnly}
											highlightQuery={highlightQuery}
											editMode={editMode}
											editOnHover={editOnHover}
											activeCell={activeCell}
											setActiveCell={setActiveCell}
											onCommitCellValue={handleCommitCellValue}
											hasInitialSnapshot={hasInitialRow(rowId)}
											accordionRowConfig={accordionRowConfig}
											accordionAlwaysOpen={accordionAlwaysOpen}
											isExpanded={isRowExpanded(rowId)}
											isRowDirty={rowIsDirty}
											dirtyCellIds={dirtyCellIds}
											hiddenColumnIdsKey={hiddenColumnIdsKey}
											stickyStateKey={stickyStateKey}
											showRowNumbers={showRowNumbers}
											rowNumberColumnWidth={rowNumberColumnWidth}
											showActionsColumn={showActionsColumn}
											actionsColumnPosition={actionsColumnPosition}
											actionsColumnWidth={actionsColumnWidth}
											canDeleteRows={canDeleteRows}
											isCellDirty={isCellDirty}
											bulkSelectedColumnId={bulkSelection.selectedColumn?.id ?? null}
											bulkSelectedCount={bulkSelection.count}
											isRowBulkSelected={bulkSelectedRowIdsSet.has(rowId)}
											onBulkSelectionStart={handleBulkSelectionMouseDown}
											onBulkSelectionExtend={handleBulkSelectionMouseEnter}
											onBulkSelectionEnd={handleBulkSelectionMouseUp}
											getStickyProps={getStickyProps}
											onToggleAccordion={toggleAccordionRow}
											onDelete={handleDelete}
											onClearCell={handleClearCell}
											onRestoreCell={handleRestoreCell}
											onSetCellValue={setCellValue}
											onUpdateRow={updateRow}
											onCopyCell={handleCopyCell}
											onCopyColumn={handleCopyColumn}
											onCopyRow={handleCopyRow}
										/>
									);
								})
							)}
						</tbody>

					</table>
				</div>
			</div>
		</>
	);
}

export function FormTablePagination() {
	const { config, pagination, filters, meta, actions } = useFormTable<FormTableRow, unknown>();
	const {
		page,
		setPage,
		pageSize,
		setPageSize,
		lockedPageSize,
		hasNextPage,
		hasPreviousPage,
		totalPages,
		options,
		totalRowCount,
		visibleRowCount,
		isFetching,
		isTransitioning,
	} = pagination;
	const pageSizeLocked = typeof lockedPageSize === "number";
	const isReadOnly = config.readOnly === true;
	const allowAddRows = !isReadOnly && config.allowAddRows !== false;
	const canSave = !isReadOnly && typeof config.onSave === "function";
	const isLoading = isFetching || isTransitioning;
	const hideFooterPaginationSummary = config.hideFooterPaginationSummary === true;
	const paginationDisabled = config.disablePagination === true;

	return (
		<div className="flex flex-wrap items-center justify-between gap-3 px-3 pb-4 text-sm text-content-secondary">
			{paginationDisabled ? (
				(isLoading || filters.activeCount > 0) && (
					<div className="flex items-center gap-4 text-content">
						{isLoading && <Loader2 className="size-4 animate-spin text-content-muted" />}
						{filters.activeCount > 0 && (
							<p className="text-xs text-content-muted">
								Filtros activos: <span className="font-medium text-content">{filters.activeCount}</span>
							</p>
						)}
					</div>
				)
			) : hideFooterPaginationSummary ? (
				(isLoading || filters.activeCount > 0) && (
					<div className="flex items-center gap-4 text-content">
						{isLoading && <Loader2 className="size-4 animate-spin text-content-muted" />}
						{filters.activeCount > 0 && (
							<p className="text-xs text-content-muted">
								Filtros activos: <span className="font-medium text-content">{filters.activeCount}</span>
							</p>
						)}
					</div>
				)
			) : (
				<div className="flex flex-wrap items-center gap-2 text-content">
					<div className="inline-flex items-center gap-2  px-2 py-1">
						<span className="pl-1 text-xs font-medium text-content-muted">
							Filas por página
						</span>
						{pageSizeLocked ? (
							<span className="rounded-full bg-surface-recessed px-3 py-1.5 text-xs font-semibold text-content shadow-recessed">
								{pageSize}
							</span>
						) : (
							<Select
								value={String(pageSize)}
								onValueChange={(value) => {
									setPageSize(Number(value));
								}}
								disabled={isLoading}
							>
								<SelectTrigger
									className={cn(
										"h-6 w-[74px] rounded-md  px-3 text-xs font-semibold text-content shadow-recessed hover:bg-surface-muted  [&>svg]:size-3.5 [&>svg]:text-content-muted",
										isLoading && "opacity-50"
									)}
								>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{options.map((size) => (
										<SelectItem key={size} value={String(size)}>
											{size}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						)}
					</div>
					{isLoading && <Loader2 className="size-4 animate-spin text-content-muted" />}
					{/* <div className="flex flex-wrap items-center justify-between gap-3">
						{totalRowCount > 0 && (
							<div className="flex items-center gap-4 text-sm text-content-secondary">
								<p className="rounded-full bg-surface-recessed px-3 py-1.5 text-xs text-content-muted shadow-recessed">
									Mostrando <span className="font-medium text-content">{visibleRowCount}</span> de{" "}
									<span className="font-medium text-content">{totalRowCount}</span> filas
								</p>
								{filters.activeCount > 0 && (
									<p className="text-xs">
										Filtros activos: <span className="font-medium text-content">{filters.activeCount}</span>
									</p>
								)}
							</div>
						)}
					</div> */}
				</div>
			)}
			<div className="flex items-center gap-2">
				{config.footerActions}
				{allowAddRows && (
					<LightButton
						type="button"
						variant="primary"
						onClick={actions.addRow}
						data-testid="form-table-add-row"
						className="gap-1.5 px-3 py-4"
					>
						<Plus className="size-4" />
						Agregar fila vacia
					</LightButton>
				)}
				{canSave && meta.hasUnsavedChanges && (
					<LightButton
						type="button"
						onClick={actions.discard}
						disabled={!meta.hasUnsavedChanges || meta.isSaving}
						variant="destructive"
						data-testid="form-table-discard"
						className="gap-1.5 px-3 py-4"
					>
						<Undo2 className="size-4" />
						Descartar cambios
					</LightButton>
				)}
				{canSave ? (
					<LightButton
						type="button"
						onClick={actions.save}
						disabled={!meta.hasUnsavedChanges || meta.isSaving}
						data-testid="form-table-save"
						variant="primarySolid"
						className="gap-1.5 px-3 py-4"
					>
						{meta.isSaving ? (
							<Loader2 className="size-4 animate-spin" />
						) : (
							<Save className="size-4" />
						)}
						{meta.isSaving ? "Guardando..." : "Guardar cambios"}
					</LightButton>
				) : null}
			</div>
			{!paginationDisabled ? (
				<div className="flex items-center gap-1">
					{/* <Button
					type="button"
					variant="outline"
					onClick={() => startTransition(() => setPage(1))}
					disabled={page <= 1 || isLoading}
					className="gap-1"
				>
					<ChevronsLeft className="size-4" />
					Primera
				</Button> */}
					<LightButton
						type="button"
						variant="default"
						onClick={() => startTransition(() => setPage((prev) => Math.max(1, prev - 1)))}
						disabled={!hasPreviousPage || isLoading}
						aria-label="Anterior"
						className="py-4"
					>
						<ChevronLeft className="size-4" />
					</LightButton>
					<span className="min-w-[88px] text-center text-xs text-content-muted">
						Página {page} de {totalPages}
					</span>
					<LightButton
						type="button"
						variant="default"
						onClick={() => startTransition(() => setPage((prev) => prev + 1))}
						disabled={!hasNextPage || isLoading}
						aria-label="Siguiente"
						className="py-4"
					>
						<ChevronRight className="size-4" />
					</LightButton>
					{/* <Button
					type="button"
					variant="outline"
					onClick={() => startTransition(() => setPage(totalPages))}
					disabled={page >= totalPages || isLoading}
					className="gap-1"
				>
					Ultima
					<ChevronsRight className="size-4" />
				</Button> */}
				</div>
			) : null}
		</div>
	);
}

import {
	readPersistedArray,
	readPersistedNumber,
	writePersistedArray,
	writePersistedNumber,
} from "./persistence";

export { requiredValidator } from "./table-utils";


type TableActivityKind = "loading" | "sorting" | "search" | "filter" | "pagination";

type BulkCellSelection = {
	columnId: string | null;
	rowIds: string[];
	anchorRowId: string | null;
	isDragging: boolean;
};

const DEFAULT_COL_WIDTH = 160;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 250];
const DEFAULT_PAGE_SIZE = 25;
const SLOW_OPERATION_MS = 1200;
const BULK_SELECTION_DRAG_THRESHOLD_PX = 8;

function escapeSelectorAttributeValue(value: string) {
	return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function shallowEqualStringArrays(a: string[], b: string[]) {
	if (a === b) return true;
	if (a.length !== b.length) return false;
	for (let i = 0; i < a.length; i += 1) {
		if (a[i] !== b[i]) return false;
	}
	return true;
}

function getTableActivityMessage(kind: TableActivityKind, isSlow: boolean) {
	if (!isSlow) {
		switch (kind) {
			case "sorting":
				return "Ordenando...";
			case "search":
				return "Filtrando por busqueda...";
			case "filter":
				return "Aplicando filtros...";
			case "pagination":
				return "Actualizando pagina...";
			case "loading":
			default:
				return "Cargando datos...";
		}
	}

	switch (kind) {
		case "sorting":
			return "Ordenando... esto esta tardando un poco mas de lo normal";
		case "search":
			return "Buscando... esto esta tardando un poco mas de lo normal";
		case "filter":
			return "Aplicando filtros... esto puede tomar unos segundos";
		case "pagination":
			return "Cambiando pagina... estamos procesando el resultado";
		case "loading":
		default:
			return "Cargando datos... la respuesta del servidor viene lenta";
	}
}

function buildFormSnapshot<Row extends FormTableRow>(rows: Row[] | undefined) {
	const safeRows = Array.isArray(rows) ? rows : [];
	const rowOrder = safeRows.map((row) => row.id);
	const rowsById = safeRows.reduce<Record<string, Row>>((acc, row) => {
		acc[row.id] = { ...row };
		return acc;
	}, {});
	return { rowOrder, rowsById };
}

type RowDirtyCacheEntry<Row extends FormTableRow> = {
	row: Row;
	initialRow: Row | undefined;
	dirty: boolean;
	cellDirtyIds: Set<string>;
	dirtyCells: ColumnDef<Row>[];
	dirtyCellIdsKey: string;
};

function buildDirtyIndex<Row extends FormTableRow>(
	rowOrder: string[],
	initialRowOrder: string[],
	rowsById: Record<string, Row>,
	columns: ColumnDef<Row>[],
	initialRowsById: Record<string, Row>,
	dirtyFields: ColumnField<Row>[] = [],
	cache?: Map<string, RowDirtyCacheEntry<Row>>
) {
	let hasChanges = rowOrder.length !== initialRowOrder.length;
	if (!hasChanges) {
		for (let index = 0; index < rowOrder.length; index += 1) {
			if (rowOrder[index] !== initialRowOrder[index]) {
				hasChanges = true;
				break;
			}
		}
	}

	const rowDirtyById: Record<string, boolean> = {};
	const cellDirtyByRowId: Record<string, Set<string>> = {};
	const dirtyCellsByRowId: Record<string, ColumnDef<Row>[]> = {};
	const dirtyCellIdsByRowId: Record<string, string> = {};

	for (const rowId of rowOrder) {
		const currentRow = rowsById[rowId];
		if (!currentRow) continue;

		const initialRow = initialRowsById[rowId];
		// Rows are updated immutably, so identity equality of both the current and
		// baseline row objects means the cached diff is still valid. This keeps the
		// per-keystroke cost at one row diff instead of rows × columns.
		const cached = cache?.get(rowId);
		let entry: RowDirtyCacheEntry<Row>;
		if (cached && cached.row === currentRow && cached.initialRow === initialRow) {
			entry = cached;
		} else if (!initialRow) {
			const allColumnIds = columns.map((column) => column.id);
			entry = {
				row: currentRow,
				initialRow,
				dirty: true,
				cellDirtyIds: new Set(allColumnIds),
				dirtyCells: [],
				dirtyCellIdsKey: allColumnIds.join(","),
			};
			cache?.set(rowId, entry);
		} else {
			const dirtyCells: ColumnDef<Row>[] = [];
			const dirtyCellIds = new Set<string>();
			let hasExtraDirtyField = false;
			const columnFields = new Set<ColumnField<Row>>();
			for (const column of columns) {
				if (String(column.field) === "id") continue;
				columnFields.add(column.field);
				if (!shallowEqualValues(currentRow[column.field], initialRow[column.field])) {
					dirtyCells.push(column);
					dirtyCellIds.add(column.id);
				}
			}
			for (const field of dirtyFields) {
				if (String(field) === "id" || columnFields.has(field)) continue;
				if (!shallowEqualValues(currentRow[field], initialRow[field])) {
					hasExtraDirtyField = true;
					break;
				}
			}
			entry = {
				row: currentRow,
				initialRow,
				dirty: dirtyCells.length > 0 || hasExtraDirtyField,
				cellDirtyIds: dirtyCellIds,
				dirtyCells,
				dirtyCellIdsKey: dirtyCells.map((column) => column.id).join(","),
			};
			cache?.set(rowId, entry);
		}

		if (entry.dirty) {
			rowDirtyById[rowId] = true;
			cellDirtyByRowId[rowId] = entry.cellDirtyIds;
			dirtyCellsByRowId[rowId] = entry.dirtyCells;
			dirtyCellIdsByRowId[rowId] = entry.dirtyCellIdsKey;
			hasChanges = true;
		}
	}

	if (cache && cache.size > rowOrder.length) {
		for (const cachedRowId of cache.keys()) {
			if (!rowsById[cachedRowId]) {
				cache.delete(cachedRowId);
			}
		}
	}

	return {
		hasChanges,
		rowDirtyById,
		cellDirtyByRowId,
		dirtyCellsByRowId,
		dirtyCellIdsByRowId,
	};
}

function hasSameRowIdentity<Row extends FormTableRow>(
	nextRows: Row[] | undefined,
	currentOrder: string[],
) {
	if (!Array.isArray(nextRows)) return currentOrder.length === 0;
	if (nextRows.length !== currentOrder.length) return false;
	return nextRows.every((row, index) => row.id === currentOrder[index]);
}

function resolveActiveTabId<Row extends FormTableRow>(
	tabFilters: TabFilterOption<Row>[],
	...preferredTabIds: Array<string | null | undefined>
) {
	for (const tabId of preferredTabIds) {
		if (tabId && tabFilters.some((tab) => tab.id === tabId)) {
			return tabId;
		}
	}
	return tabFilters[0]?.id ?? null;
}

function readPersistedActiveTab(storageKey: string) {
	if (typeof window === "undefined") return null;
	try {
		const raw = window.localStorage.getItem(storageKey);
		if (!raw) return null;
		try {
			const parsed = JSON.parse(raw) as unknown;
			return typeof parsed === "string" ? parsed : null;
		} catch {
			return raw;
		}
	} catch {
		return null;
	}
}

function writePersistedActiveTab(storageKey: string, activeTab: string) {
	if (typeof window === "undefined") return;
	try {
		window.localStorage.setItem(storageKey, JSON.stringify(activeTab));
	} catch {
		// Ignore storage write failures.
	}
}
// cell renderers moved to components/form-table/cell-renderers.tsx

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
	const isDev = process.env.NODE_ENV !== "production";
	const [externalRefreshVersion, setExternalRefreshVersion] = useState(0);
	const enableColumnResizing = config.enableColumnResizing ?? false;
	const paginationDisabled = config.disablePagination === true;
	const fetchRowsFn = config.fetchRows ?? null;
	const useServerDataMode = config.serverSideData === true && Boolean(fetchRowsFn);
	const isEmbedded = variant === "embedded";
	const isReadOnly = config.readOnly === true;
	const showRowNumbers = shouldUseSpreadsheetChrome(config);
	const rowNumberColumnWidth = config.rowNumberColumnWidth ?? DEFAULT_ROW_NUMBER_COLUMN_WIDTH;
	const actionsColumnWidth = config.actionsColumnWidth ?? 140;
	const dataColumnIndexOffset =
		(showRowNumbers ? 1 : 0) +
		(config.showActionsColumn !== false && config.actionsColumnPosition === "start" ? 1 : 0);
	const stickyLeadingOffset =
		(showRowNumbers ? rowNumberColumnWidth : 0) +
		(config.showActionsColumn !== false && config.actionsColumnPosition === "start" ? actionsColumnWidth : 0);
	const initialSnapshot = useMemo(
		() => buildFormSnapshot(config.defaultRows),
		[config.defaultRows]
	);
	const [dirtyBaseline, setDirtyBaseline] = useState<FormValues<Row>>(() =>
		snapshotValues(initialSnapshot.rowOrder, initialSnapshot.rowsById)
	);
	const [activeCell, setActiveCell] = useState<{ rowId: string; columnId: string } | null>(null);
	const updateActiveCell = useCallback((cell: { rowId: string; columnId: string } | null) => {
		setActiveCell((current) => {
			if (
				current?.rowId === cell?.rowId &&
				current?.columnId === cell?.columnId
			) {
				return current;
			}
			return cell;
		});
	}, []);
	const [bulkSelection, setBulkSelection] = useState<BulkCellSelection>({
		columnId: null,
		rowIds: [],
		anchorRowId: null,
		isDragging: false,
	});
	const bulkEditClearedKeyRef = useRef<string | null>(null);

	// TanStack Form setup
	const form = useForm<
		FormValues<Row>,
		undefined,
		undefined,
		undefined,
		undefined,
		undefined,
		undefined,
		undefined,
		undefined,
		undefined,
		undefined,
		undefined
	>({
		defaultValues: {
			rowOrder: initialSnapshot.rowOrder,
			rowsById: initialSnapshot.rowsById,
		},
	});
	const setFormFieldValue = form.setFieldValue as (path: string, updater: unknown) => void;
	type FormStateType = typeof form.store.state;

	const rowOrderSelector = useCallback<(state: FormStateType) => string[]>(
		(state) => (state.values?.rowOrder as string[]) ?? [],
		[]
	);
	const rowsByIdSelector = useCallback<(state: FormStateType) => Record<string, Row>>(
		(state) => (state.values?.rowsById as Record<string, Row>) ?? {},
		[]
	);

	const rowOrder = useStore(form.store, rowOrderSelector);
	const rowsById = useStore(form.store, rowsByIdSelector);
	const setFormRows = useCallback(
		(nextRows: Row[]) => {
			const nextOrder = nextRows.map((row) => row.id);
			const nextMap = nextRows.reduce<Record<string, Row>>((acc, row) => {
				acc[row.id] = { ...row };
				return acc;
			}, {});
			setFormFieldValue("rowOrder", nextOrder);
			setFormFieldValue("rowsById", nextMap);
			const snapshot = snapshotValues(nextOrder, nextMap);
			initialValuesRef.current = snapshot;
			setDirtyBaseline(snapshot);
		},
		[setFormFieldValue]
	);
	const [isSaving, setIsSaving] = useState(false);
	const [page, setPage] = useState(1);
	const pageSizeOptions = config.pageSizeOptions ?? PAGE_SIZE_OPTIONS;
	const lockedPageSize = config.lockedPageSize;
	const initialPageSize =
		typeof lockedPageSize === "number"
			? lockedPageSize
			: config.defaultPageSize ?? DEFAULT_PAGE_SIZE;
	const [pageSize, setPageSizeState] = useState(initialPageSize);
	useEffect(() => {
		if (lockedPageSize) return;
		const persistedPageSize = readPersistedNumber(`${TABLE_ID}:pageSize`);
		if (!persistedPageSize) return;
		if (!pageSizeOptions.includes(persistedPageSize)) return;
		setPageSizeState((prev) =>
			prev === persistedPageSize ? prev : persistedPageSize
		);
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
	const [isSearchTransitioning, startSearchTransition] = useTransition();
	const [isSortTransitioning, startSortTransition] = useTransition();
	const [isFilterTransitioning, startFilterTransition] = useTransition();
	const [activeActivityKind, setActiveActivityKind] = useState<TableActivityKind | null>(null);
	const [activityRunId, setActivityRunId] = useState(0);
	const [isSlowOperation, setIsSlowOperation] = useState(false);
	const [pendingSortColumnId, setPendingSortColumnId] = useState<string | null>(null);
	const sortStartRef = useRef<{ runId: number; columnId: string | null; startedAt: number } | null>(null);
	const markActivityStart = useCallback((kind: TableActivityKind) => {
		setActiveActivityKind(kind);
		setActivityRunId((prev) => prev + 1);
	}, []);
	const handleSetPageSize = useCallback((size: number) => {
		if (lockedPageSize) return;
		markActivityStart("pagination");
		startPageSizeTransition(() => {
			setPageSizeState(size);
			setPage(1);
		});
	}, [lockedPageSize, markActivityStart]);
	const [isServerPaging, setIsServerPaging] = useState(Boolean(fetchRowsFn));
	const useClientPagination = !isServerPaging;
	const [isFetchingServerRows, setIsFetchingServerRows] = useState(false);
	const fetchRunIdRef = useRef(0);
	const [serverError, setServerError] = useState<string | null>(null);
	const [serverMeta, setServerMeta] = useState<ServerPaginationMeta>({
		page: 1,
		limit: initialPageSize,
		total: 0,
		totalPages: 1,
		hasNextPage: false,
		hasPreviousPage: false,
	});
	const initialValuesRef = useRef<FormValues<Row>>(snapshotValues(initialSnapshot.rowOrder, initialSnapshot.rowsById));
	const columns = config.columns;
	const headerGroups = useMemo(() => config.headerGroups ?? [], [config.headerGroups]);
	const defaultRows = config.defaultRows;
	const fetchAfterDefaultRows = config.fetchAfterDefaultRows === true;
	const hydratedServerRowsRef = useRef(false);

	useEffect(() => {
		if (!fetchRowsFn || !Array.isArray(defaultRows)) return;
		if (defaultRows.length === 0) return;
		if (hasSameRowIdentity(defaultRows, rowOrder)) return;
		setFormRows(defaultRows);
		setServerMeta((prev) => ({
			page: 1,
			limit: prev.limit || pageSize,
			total: defaultRows.length,
			totalPages: 1,
			hasNextPage: false,
			hasPreviousPage: false,
		}));
	}, [defaultRows, fetchRowsFn, pageSize, rowOrder, setFormRows]);

	useEffect(() => {
		const handleExternalRefresh = (event: Event) => {
			const detail = (event as CustomEvent<{ tableId?: string }>).detail;
			if (detail?.tableId && detail.tableId !== TABLE_ID) return;
			setExternalRefreshVersion((prev) => prev + 1);
		};
		if (typeof window === "undefined") return;
		window.addEventListener("form-table:refresh", handleExternalRefresh);
		return () => {
			window.removeEventListener("form-table:refresh", handleExternalRefresh);
		};
	}, [TABLE_ID]);

	useEffect(() => {
		setIsServerPaging(Boolean(fetchRowsFn));
	}, [fetchRowsFn]);
	const defaultTabFilters = useMemo<TabFilterOption<Row>[]>(() => [{ id: "all", label: "Todas" }], []);
	const tabFilters = Array.isArray(config.tabFilters) ? config.tabFilters : defaultTabFilters;
	const hasTabFilters = Array.isArray(config.tabFilters) && tabFilters.length > 0;
	const defaultActiveTab = useMemo(
		() => resolveActiveTabId(tabFilters, config.defaultActiveTab),
		[config.defaultActiveTab, tabFilters]
	);
	const activeTabStorageKey = config.activeTabStorageKey ?? null;
	const searchPlaceholder = config.searchPlaceholder ?? "Buscar...";
	const showInlineSearch = config.showInlineSearch !== false;
	const hasFilters = typeof config.createFilters === "function";

	const controlledSearchValue = typeof searchQuery === "string" ? searchQuery : null;
	const isSearchControlled = controlledSearchValue !== null;
	const initialSearchValue = controlledSearchValue ?? "";
	const [searchInputValue, setSearchInputValue] = useState(initialSearchValue);
	const [searchValue, setSearchValue] = useState(initialSearchValue);
	const previousControlledSearchValueRef = useRef<string | null>(controlledSearchValue);
	const pendingEmittedSearchQueriesRef = useRef<Set<string>>(new Set());
	useEffect(() => {
		if (controlledSearchValue === null) {
			previousControlledSearchValueRef.current = null;
			pendingEmittedSearchQueriesRef.current.clear();
			return;
		}
		if (previousControlledSearchValueRef.current === controlledSearchValue) return;
		previousControlledSearchValueRef.current = controlledSearchValue;
		// A prop change that matches a value this table just emitted is the
		// parent echoing our own commit back. Adopting it would clobber
		// keystrokes typed while the parent was still re-rendering.
		if (pendingEmittedSearchQueriesRef.current.has(controlledSearchValue)) {
			pendingEmittedSearchQueriesRef.current.delete(controlledSearchValue);
			return;
		}
		pendingEmittedSearchQueriesRef.current.clear();
		setSearchInputValue(controlledSearchValue);
		setSearchValue(controlledSearchValue);
	}, [controlledSearchValue]);
	const handleSearchInputChange = useCallback(
		(value: string) => {
			if (value === searchInputValue) return;
			setSearchInputValue(value);
			onSearchInputChange?.(value);
		},
		[onSearchInputChange, searchInputValue]
	);
	useEffect(() => {
		if (searchInputValue === searchValue) return;
		const timeoutId = window.setTimeout(() => {
			markActivityStart("search");
			startSearchTransition(() => {
				setSearchValue(searchInputValue);
				if (isSearchControlled) {
					pendingEmittedSearchQueriesRef.current.add(searchInputValue);
					onSearchQueryChange?.(searchInputValue);
				}
			});
		}, SEARCH_COMMIT_DEBOUNCE_MS);
		return () => {
			window.clearTimeout(timeoutId);
		};
	}, [
		isSearchControlled,
		markActivityStart,
		onSearchQueryChange,
		searchInputValue,
		searchValue,
		startSearchTransition,
	]);
	const searchRequestKey = searchValue.trim();
	const isSearchInputLag = searchInputValue.trim() !== searchRequestKey;
	const searchRef = useRef(searchRequestKey);
	useEffect(() => {
		searchRef.current = searchRequestKey;
	}, [searchRequestKey]);
	const [activeTab, setActiveTab] = useState<string | null>(defaultActiveTab);
	const [restoredActiveTabStorageKey, setRestoredActiveTabStorageKey] = useState<string | null>(
		() => (activeTabStorageKey ? null : "")
	);
	const activeTabStorageReady = !activeTabStorageKey || restoredActiveTabStorageKey === activeTabStorageKey;
	useEffect(() => {
		setActiveTab((current) => {
			if (!activeTabStorageKey) {
				return resolveActiveTabId(tabFilters, current, defaultActiveTab);
			}

			const storedActiveTab = readPersistedActiveTab(activeTabStorageKey);
			return resolveActiveTabId(tabFilters, storedActiveTab, current, defaultActiveTab);
		});
		setRestoredActiveTabStorageKey(activeTabStorageKey ?? "");
	}, [activeTabStorageKey, defaultActiveTab, tabFilters]);
	useEffect(() => {
		if (!activeTabStorageKey || !activeTabStorageReady || !activeTab) return;
		if (!tabFilters.some((tab) => tab.id === activeTab)) return;
		writePersistedActiveTab(activeTabStorageKey, activeTab);
	}, [activeTab, activeTabStorageKey, activeTabStorageReady, tabFilters]);
	const createFiltersRef = useRef(config.createFilters);
	createFiltersRef.current = config.createFilters;
	const [filters, setFilters] = useState<Filters | undefined>(() => config.createFilters?.());
	const [filtersDraft, setFiltersDraft] = useState<Filters | undefined>(() => config.createFilters?.());
	const filtersRef = useRef<Filters | undefined>(filters);
	useEffect(() => {
		filtersRef.current = filters;
	}, [filters]);
	const appliedFiltersKey = useMemo(() => JSON.stringify(filters ?? null), [filters]);
	// Reset filters when the table identity changes
	const prevTableIdRef = useRef(TABLE_ID);
	useEffect(() => {
		if (prevTableIdRef.current === TABLE_ID) return;
		prevTableIdRef.current = TABLE_ID;
		if (!hasFilters) return;
		const initialFilters = createFiltersRef.current?.();
		if (typeof initialFilters === "undefined") return;
		setFilters(initialFilters);
		setFiltersDraft(initialFilters);
	}, [TABLE_ID, hasFilters]);
	// Keep filters draft in sync with applied filters
	useEffect(() => {
		if (!filters) return;
		setFiltersDraft((prev) => (prev === filters ? prev : filters));
	}, [filters]);
	const lockedSort = config.lockedSort ?? null;
	const [sortState, setSortState] = useState<SortState>(() =>
		lockedSort ?? { columnId: null, direction: "asc" }
	);
	const effectiveSortState = lockedSort ?? sortState;
	useEffect(() => {
		if (!lockedSort) return;
		setSortState((prev) =>
			prev.columnId === lockedSort.columnId && prev.direction === lockedSort.direction
				? prev
				: lockedSort
		);
	}, [lockedSort]);
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
		? activeActivityKind ??
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
							: "loading")
		: null;

	const prevSortProcessingRef = useRef(false);
	useEffect(() => {
		if (!isDev) return;
		const wasProcessing = prevSortProcessingRef.current;
		if (!wasProcessing && isSortProcessing) {
			console.log("[FormTable][Sort] PROCESSING START", {
				tableId: TABLE_ID,
				runId: activityRunId,
				columnId: pendingSortColumnId ?? effectiveSortState.columnId,
				sortState: effectiveSortState,
				ts: new Date().toISOString(),
			});
		}
		if (wasProcessing && !isSortProcessing) {
			const start = sortStartRef.current;
			console.log("[FormTable][Sort] PROCESSING FINISH", {
				tableId: TABLE_ID,
				runId: start?.runId ?? activityRunId,
				columnId: start?.columnId ?? effectiveSortState.columnId,
				finalSortState: effectiveSortState,
				durationMs: start ? Date.now() - start.startedAt : undefined,
				ts: new Date().toISOString(),
			});
		}
		prevSortProcessingRef.current = isSortProcessing;
	}, [TABLE_ID, activityRunId, effectiveSortState, isDev, isSortProcessing, pendingSortColumnId]);

	useEffect(() => {
		if (isBusy) return;
		setActiveActivityKind((prev) => (prev === null ? prev : null));
		setIsSlowOperation(false);
		setPendingSortColumnId(null);
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
	const [colWidths, setColWidths] = useState<Record<number, number>>(() => {
		const initialWidths: Record<number, number> = {};
		config.columns.forEach((col, index) => {
			if (col.width) {
				initialWidths[index] = col.width;
			}
		});
		return initialWidths;
	});
	const colRefs = useRef<(HTMLTableColElement | null)[]>([]);
	const accordionRowConfig = config.accordionRow;
	const hasAccordionRows = Boolean(accordionRowConfig);
	const accordionAlwaysOpen = Boolean(accordionRowConfig?.alwaysOpen);
	const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(() => new Set());
	const autoExpandedRowsRef = useRef<Set<string>>(new Set());
	const previousAccordionAutoOpenKeyRef = useRef<string | number | null | undefined>(
		accordionRowConfig?.autoOpenKey,
	);

	const hasInitialRow = useCallback(
		(rowId: string) => Boolean(initialValuesRef.current.rowsById[rowId]),
		[]
	);

	const rows = useMemo(() => {
		return rowOrder.map((id) => rowsById[id]).filter((row): row is Row => Boolean(row));
	}, [rowOrder, rowsById]);

	useEffect(() => {
		if (hasAccordionRows) return;
		autoExpandedRowsRef.current.clear();
		setExpandedRowIds((prev) => {
			if (prev.size === 0) return prev;
			return new Set();
		});
	}, [hasAccordionRows]);

	useEffect(() => {
		if (!hasAccordionRows || accordionAlwaysOpen) return;
		const allowed = new Set(rowOrder);
		setExpandedRowIds((prev) => {
			let changed = false;
			const next = new Set<string>();
			prev.forEach((id) => {
				if (allowed.has(id)) {
					next.add(id);
				} else {
					changed = true;
				}
			});
			if (!changed && next.size === prev.size) return prev;
			return next;
		});
	}, [accordionAlwaysOpen, rowOrder, hasAccordionRows]);

	useEffect(() => {
		if (!hasAccordionRows || accordionAlwaysOpen) return;
		const allowed = new Set(rowOrder);
		autoExpandedRowsRef.current.forEach((id) => {
			if (!allowed.has(id)) {
				autoExpandedRowsRef.current.delete(id);
			}
		});
	}, [accordionAlwaysOpen, rowOrder, hasAccordionRows]);

	useEffect(() => {
		if (!hasAccordionRows || accordionAlwaysOpen) return;
		const autoOpenKey = accordionRowConfig?.autoOpenKey;
		if (previousAccordionAutoOpenKeyRef.current !== autoOpenKey) {
			previousAccordionAutoOpenKeyRef.current = autoOpenKey;
			autoExpandedRowsRef.current.clear();
		}
		const defaultOpen = accordionRowConfig?.defaultOpen;
		if (!defaultOpen) return;
		setExpandedRowIds((prev) => {
			let changed = false;
			const next = new Set(prev);
			rows.forEach((row) => {
				if (autoExpandedRowsRef.current.has(row.id)) return;
				if (defaultOpen(row)) {
					next.add(row.id);
					autoExpandedRowsRef.current.add(row.id);
					changed = true;
				}
			});
			return changed ? next : prev;
		});
	}, [accordionAlwaysOpen, rows, accordionRowConfig, hasAccordionRows]);

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

	useEffect(() => {
		if (!fetchRowsFn) return;
		if (
			Array.isArray(defaultRows) &&
			defaultRows.length > 0 &&
			!hydratedServerRowsRef.current &&
			page === 1 &&
			searchRequestKey.length === 0 &&
			!fetchAfterDefaultRows
		) {
			hydratedServerRowsRef.current = true;
			return;
		}
		let isMounted = true;
		const fetchRunId = fetchRunIdRef.current + 1;
		fetchRunIdRef.current = fetchRunId;
		const run = async () => {
			setIsFetchingServerRows(true);
			setServerError(null);
			try {
				const filtersForRequest = (filtersRef.current ?? createFiltersRef.current?.()) as Filters;
				const result = await fetchRowsFn({
					page,
					limit: pageSize,
					filters: filtersForRequest,
					search: searchRef.current,
					activeTab,
					sort: effectiveSortState,
				});
				if (!isMounted || fetchRunId !== fetchRunIdRef.current) return;
				if (
					isDev &&
					!useServerDataMode &&
					result.pagination &&
					(result.pagination.totalPages ?? 1) > 1
				) {
					console.warn(
						`[FormTable] ${TABLE_ID} returned paginated rows from fetchRows without serverSideData=true. Local sort/filter/export may only see the loaded page.`
					);
				}
				setFormRows(result.rows);
				const pagination = result.pagination;
				setServerMeta({
					page: pagination?.page ?? page,
					limit: pagination?.limit ?? pageSize,
					total: pagination?.total ?? result.rows.length,
					totalPages: pagination?.totalPages ?? 1,
					hasNextPage: pagination?.hasNextPage ?? false,
					hasPreviousPage: pagination?.hasPreviousPage ?? false,
				});
			} catch (error) {
				if (!isMounted || fetchRunId !== fetchRunIdRef.current) return;
				console.error("Error fetching rows", error);
				setServerError(
					error instanceof Error ? error.message : "No se pudo obtener la página solicitada"
				);
			} finally {
				if (isMounted && fetchRunId === fetchRunIdRef.current) {
					setIsFetchingServerRows(false);
				}
			}
		};
		void run();
		return () => {
			isMounted = false;
		};
	}, [
		activeTab,
		appliedFiltersKey,
		defaultRows,
		effectiveSortState,
		externalRefreshVersion,
		fetchAfterDefaultRows,
		fetchRowsFn,
		page,
		pageSize,
		setFormRows,
		searchRequestKey,
		TABLE_ID,
		isDev,
		useServerDataMode,
	]);

	const dirtyRowCacheRef = useRef<{
		columns: ColumnDef<Row>[] | null;
		dirtyFieldsKey: string;
		map: Map<string, RowDirtyCacheEntry<Row>>;
	}>({ columns: null, dirtyFieldsKey: "", map: new Map() });
	const dirtyFields = useMemo(() => config.dirtyFields ?? [], [config.dirtyFields]);
	const dirtyFieldsKey = dirtyFields.join(",");
	const dirtyIndex = useMemo(() => {
		const cache = dirtyRowCacheRef.current;
		if (cache.columns !== columns || cache.dirtyFieldsKey !== dirtyFieldsKey) {
			cache.columns = columns;
			cache.dirtyFieldsKey = dirtyFieldsKey;
			cache.map.clear();
		}
		return buildDirtyIndex(
			rowOrder,
			dirtyBaseline.rowOrder,
			rowsById,
			columns,
			dirtyBaseline.rowsById,
			dirtyFields,
			cache.map
		);
	}, [rowOrder, rowsById, columns, dirtyBaseline, dirtyFields, dirtyFieldsKey]);

	useEffect(() => {
		if (fetchRowsFn) return;
		if (Array.isArray(defaultRows)) {
			if (dirtyIndex.hasChanges) return;
			if (hasSameRowIdentity(defaultRows, rowOrder)) return;
			setFormRows(defaultRows);
		}
	}, [fetchRowsFn, defaultRows, rowOrder, dirtyIndex.hasChanges, setFormRows]);

	const isCellDirty = useCallback(
		(rowId: string, column: ColumnDef<Row>) =>
			Boolean(dirtyIndex.cellDirtyByRowId[rowId]?.has(column.id)),
		[dirtyIndex]
	);

	const getRowDirtyState = useCallback(
		(rowId: string) => ({
			dirty: Boolean(dirtyIndex.rowDirtyById[rowId]),
			cells: dirtyIndex.dirtyCellsByRowId[rowId] ?? [],
			cellIdsKey: dirtyIndex.dirtyCellIdsByRowId[rowId] ?? "",
		}),
		[dirtyIndex]
	);

	const hasUnsavedChanges =
		dirtyIndex.hasChanges || config.externalUnsavedChanges === true;

	useEffect(() => {
		if (!enableColumnResizing || typeof window === "undefined") return;
		try {
			const stored = localStorage.getItem(`resizable-cols:${TABLE_ID}`);
			if (stored) {
				const parsed = JSON.parse(stored) as Record<number, number>;
				setColWidths(parsed);
			}
		} catch {
			// ignore
		}
	}, [TABLE_ID, enableColumnResizing]);

	// Column management state
	const [hiddenColumnIds, setHiddenColumnIds] = useState<string[]>([]);
	const [pinnedColumnIds, setPinnedColumnIds] = useState<string[]>([]);
	const [columnOffsets, setColumnOffsets] = useState<Record<string, number>>({});
	useEffect(() => {
		const persistedHidden = readPersistedArray(`${TABLE_ID}:hidden`);
		const persistedPinned = readPersistedArray(`${TABLE_ID}:pinned`);
		setHiddenColumnIds((prev) =>
			shallowEqualStringArrays(prev, persistedHidden) ? prev : persistedHidden
		);
		setPinnedColumnIds((prev) =>
			shallowEqualStringArrays(prev, persistedPinned) ? prev : persistedPinned
		);
	}, [TABLE_ID]);
	const tableRef = useRef<HTMLTableElement | null>(null);
	const attachColumnResizeListener = useCallback(
		(listener: EventListener) => {
			const table = tableRef.current;
			if (!table) {
				return () => { };
			}
			table.addEventListener("columnResized", listener);
			return () => {
				table.removeEventListener("columnResized", listener);
			};
		},
		[tableRef]
	);

	const columnIndexMap = useMemo(() => {
		const map: Record<string, number> = {};
		columns.forEach((column, index) => {
			map[column.id] = index;
		});
		return map;
	}, [columns]);

	const columnsById = useMemo(() => {
		const map: Record<string, ColumnDef<Row>> = {};
		columns.forEach((column) => {
			map[column.id] = column;
		});
		return map;
	}, [columns]);

	const groupedColumnLookup = useMemo(() => {
		const map = new Map<string, HeaderGroup>();
		headerGroups.forEach((group) => {
			group.columns.forEach((columnId) => {
				map.set(columnId, group);
			});
		});
		return map;
	}, [headerGroups]);

	const hideableColumns = useMemo(
		() => new Set(columns.filter((col) => col.enableHide !== false).map((col) => col.id)),
		[columns]
	);

	const pinnableColumns = useMemo(
		() => new Set(columns.filter((col) => col.enablePin !== false).map((col) => col.id)),
		[columns]
	);

	const normalizedSearch = searchRequestKey.toLowerCase();
	const highlightQuery = normalizedSearch;

	const { baseFilteredRows, tabCounts } = useMemo(() => {
		if (useServerDataMode) {
			const counts: Record<string, number> = {};
			for (const tab of tabFilters) {
				if (tab.predicate) {
					let count = 0;
					for (const row of rows) {
						if (tab.predicate(row)) count++;
					}
					counts[tab.id] = count;
				} else {
					counts[tab.id] = rows.length;
				}
			}
			return { baseFilteredRows: rows, tabCounts: counts };
		}

		const applyFilters = config.applyFilters;
		const hasAdvancedFilters = applyFilters && typeof filters !== "undefined";

		const filtered: Row[] = [];
		for (const row of rows) {
			if (normalizedSearch) {
				const matchesSearch = columns.some((column) => {
					if (column.searchFn) {
						return column.searchFn(row, normalizedSearch);
					}
					const rawValue = row[column.field];
					return defaultSearchMatcher(rawValue, normalizedSearch);
				});
				if (!matchesSearch) continue;
			}

			if (hasAdvancedFilters && !applyFilters(row, filters)) continue;

			filtered.push(row);
		}

		const counts: Record<string, number> = {};
		for (const tab of tabFilters) {
			if (tab.predicate) {
				let count = 0;
				for (const row of filtered) {
					if (tab.predicate(row)) count++;
				}
				counts[tab.id] = count;
			} else {
				counts[tab.id] = filtered.length;
			}
		}

		return { baseFilteredRows: filtered, tabCounts: counts };
	}, [rows, normalizedSearch, columns, config.applyFilters, filters, tabFilters, useServerDataMode]);

	// Apply the selected tab filter synchronously to avoid one-render lag.
	const tabFilteredRows = useMemo(() => {
		if (!hasTabFilters || !activeTab) {
			return baseFilteredRows;
		}
		const currentTab = tabFilters.find((tab) => tab.id === activeTab);
		if (!currentTab?.predicate) {
			return baseFilteredRows;
		}
		return baseFilteredRows.filter(currentTab.predicate);
	}, [baseFilteredRows, activeTab, tabFilters, hasTabFilters]);


	const enableClientSort = config.enableClientSort !== false;
	const sortedRows = useMemo(() => {
		if (useServerDataMode || !enableClientSort || !effectiveSortState.columnId) return tabFilteredRows;
		const column = columns.find((col) => col.id === effectiveSortState.columnId);
		if (!column) return tabFilteredRows;
		const comparator = column.sortFn ?? defaultSortByField<Row>(column.field);
		const sorted = [...tabFilteredRows].sort((a, b) => comparator(a, b));
		return effectiveSortState.direction === "asc" ? sorted : sorted.reverse();
	}, [tabFilteredRows, effectiveSortState, enableClientSort, columns, useServerDataMode]);

	const activeFilterCount = useMemo(() => {
		if (!config.countActiveFilters || typeof filters === "undefined") return 0;
		return config.countActiveFilters(filters);
	}, [config, filters]);

	// Persist hidden columns
	useEffect(() => {
		writePersistedArray(`${TABLE_ID}:hidden`, hiddenColumnIds);
	}, [TABLE_ID, hiddenColumnIds]);

	// Persist pinned columns
	useEffect(() => {
		writePersistedArray(`${TABLE_ID}:pinned`, pinnedColumnIds);
	}, [TABLE_ID, pinnedColumnIds]);

	// Clean up and sort pinned columns
	useEffect(() => {
		setPinnedColumnIds((prev) => {
			const next = prev.filter((id) => pinnableColumns.has(id));
			next.sort((a, b) => {
				const indexA = columnIndexMap[a] ?? Number.MAX_SAFE_INTEGER;
				const indexB = columnIndexMap[b] ?? Number.MAX_SAFE_INTEGER;
				return indexA - indexB;
			});
			return shallowEqualStringArrays(prev, next) ? prev : next;
		});
	}, [pinnableColumns, columnIndexMap]);

	const isColumnHidden = useCallback(
		(columnId: string) => hideableColumns.has(columnId) && hiddenColumnIds.includes(columnId),
		[hideableColumns, hiddenColumnIds]
	);

	const isColumnPinned = useCallback(
		(columnId: string) => pinnableColumns.has(columnId) && pinnedColumnIds.includes(columnId),
		[pinnableColumns, pinnedColumnIds]
	);

	const togglePinColumn = useCallback(
		(columnId: string) => {
			if (!pinnableColumns.has(columnId)) return;
			setPinnedColumnIds((prev) => {
				const set = new Set(prev);
				if (set.has(columnId)) {
					set.delete(columnId);
				} else {
					set.add(columnId);
				}
				const nextPinned = Array.from(set);
				nextPinned.sort((a, b) => {
					const indexA = columnIndexMap[a] ?? Number.MAX_SAFE_INTEGER;
					const indexB = columnIndexMap[b] ?? Number.MAX_SAFE_INTEGER;
					return indexA - indexB;
				});
				return nextPinned;
			});
		},
		[pinnableColumns, columnIndexMap]
	);

	const recalcPinnedOffsets = useCallback(() => {
		const offsets: Record<string, number> = {};
		let accumulator = 0;
		pinnedColumnIds.forEach((columnId) => {
			if (isColumnHidden(columnId)) return;
			const colIndex = columnIndexMap[columnId];
			if (colIndex == null) return;
			const physicalColIndex = colIndex + dataColumnIndexOffset;
			const colEl = colRefs.current[physicalColIndex];
			const width = colEl?.getBoundingClientRect().width || colWidths[physicalColIndex] || DEFAULT_COL_WIDTH;
			offsets[columnId] = accumulator;
			accumulator += width;
		});
		setColumnOffsets((prev) => {
			const prevKeys = Object.keys(prev);
			const nextKeys = Object.keys(offsets);
			if (
				prevKeys.length === nextKeys.length &&
				nextKeys.every((key) => prev[key] === offsets[key])
			) {
				return prev;
			}
			return offsets;
		});
	}, [pinnedColumnIds, isColumnHidden, columnIndexMap, colWidths, dataColumnIndexOffset]);

	useEffect(() => {
		recalcPinnedOffsets();
	}, [recalcPinnedOffsets]);

	useEffect(() => {
		const handleResize = () => recalcPinnedOffsets();
		window.addEventListener("resize", handleResize);
		return () => {
			window.removeEventListener("resize", handleResize);
		};
	}, [recalcPinnedOffsets]);

	// Resize events fire per mousemove; coalesce state updates to one per frame so
	// dragging a resizer doesn't re-render the table on every event.
	useEffect(() => {
		if (!enableColumnResizing) return;
		let frame: number | null = null;
		const handleColumnResize: EventListener = () => {
			if (frame !== null) return;
			frame = window.requestAnimationFrame(() => {
				frame = null;
				recalcPinnedOffsets();
			});
		};
		const detach = attachColumnResizeListener(handleColumnResize);
		return () => {
			if (frame !== null) window.cancelAnimationFrame(frame);
			detach();
		};
	}, [attachColumnResizeListener, recalcPinnedOffsets, enableColumnResizing]);

	useEffect(() => {
		if (!enableColumnResizing) return;
		let frame: number | null = null;
		const pendingWidths = new Map<number, number>();
		const handler: EventListener = (event) => {
			const detail = (event as CustomEvent)?.detail as {
				tableId?: string;
				colIndex?: number;
				newWidth?: number;
			};
			if (!detail || detail.tableId !== TABLE_ID) return;
			const { colIndex, newWidth } = detail;
			if (typeof colIndex !== "number" || typeof newWidth !== "number") return;
			pendingWidths.set(colIndex, newWidth);
			if (frame !== null) return;
			frame = window.requestAnimationFrame(() => {
				frame = null;
				const entries = Array.from(pendingWidths.entries());
				pendingWidths.clear();
				setColWidths((prev) => {
					let changed = false;
					const next = { ...prev };
					for (const [index, width] of entries) {
						if (next[index] !== width) {
							next[index] = width;
							changed = true;
						}
					}
					return changed ? next : prev;
				});
			});
		};
		const detach = attachColumnResizeListener(handler);
		return () => {
			if (frame !== null) window.cancelAnimationFrame(frame);
			detach();
		};
	}, [TABLE_ID, attachColumnResizeListener, enableColumnResizing]);

	const getStickyProps = useCallback(
		(columnId: string, baseClassName?: string) => {
			const offset = columnOffsets[columnId];
			const pinned = isColumnPinned(columnId);
			return {
				className: cn(
					baseClassName,
					pinned && offset !== undefined ? "sticky z-20 shadow-[1px_0_0_0_hsl(var(--border))]" : ""
				),
				style: {
					left: pinned && offset !== undefined ? `${stickyLeadingOffset + offset}px` : undefined,
				},
			};
		},
		[columnOffsets, isColumnPinned, stickyLeadingOffset]
	);

	const hiddenIndices = useMemo(
		() =>
			hiddenColumnIds
				.filter((columnId) => hideableColumns.has(columnId))
				.map((columnId) => columnIndexMap[columnId])
				.filter((value): value is number => typeof value === "number")
				.map((value) => value + dataColumnIndexOffset),
		[hiddenColumnIds, hideableColumns, columnIndexMap, dataColumnIndexOffset]
	);

	const handleBalanceColumns = useCallback(() => {
		balanceTableColumns(TABLE_ID, {
			hiddenCols: hiddenIndices,
			minVisibleWidth: 100,
		});
	}, [TABLE_ID, hiddenIndices]);

	const handleApplyAdvancedFilters = useCallback(() => {
		if (!hasFilters || typeof filtersDraft === "undefined") return;
		markActivityStart("filter");
		startFilterTransition(() => {
			setFilters(filtersDraft);
		});
	}, [filtersDraft, hasFilters, markActivityStart, startFilterTransition]);

	const handleResetAdvancedFilters = useCallback(() => {
		if (!hasFilters) return;
		const initial = createFiltersRef.current?.();
		if (typeof initial === "undefined") return;
		markActivityStart("filter");
		startFilterTransition(() => {
			setFilters(initial);
			setFiltersDraft(initial);
		});
	}, [hasFilters, markActivityStart, startFilterTransition]);
	const setFiltersDraftValue = useCallback(
		(updater: (prev: Filters | undefined) => Filters | undefined) => {
			setFiltersDraft((prev) => updater(prev));
		},
		[]
	);


	const toggleSort = useCallback((columnId: string) => {
		if (lockedSort) return;
		updateActiveCell(null);
		if (isDev) {
			console.log("[FormTable][Sort] HEADER CLICK", {
				tableId: TABLE_ID,
				action: "toggleSort",
				columnId,
				currentSortState: effectiveSortState,
				ts: new Date().toISOString(),
			});
		}
		setPendingSortColumnId(columnId);
		markActivityStart("sorting");
		sortStartRef.current = {
			runId: activityRunId + 1,
			columnId,
			startedAt: Date.now(),
		};
		startSortTransition(() => {
			setSortState((prev) => {
				if (prev.columnId !== columnId) {
					return { columnId, direction: "asc" };
				}
				if (prev.direction === "asc") {
					return { columnId, direction: "desc" };
				}
				return { columnId: null, direction: "asc" };
			});
		});
	}, [TABLE_ID, activityRunId, effectiveSortState, isDev, lockedSort, markActivityStart, startSortTransition, updateActiveCell]);

	const applySortDirection = useCallback((columnId: string, direction: "asc" | "desc") => {
		if (lockedSort) return;
		updateActiveCell(null);
		if (isDev) {
			console.log("[FormTable][Sort] HEADER MENU CLICK", {
				tableId: TABLE_ID,
				action: "applySortDirection",
				columnId,
				direction,
				currentSortState: effectiveSortState,
				ts: new Date().toISOString(),
			});
		}
		setPendingSortColumnId(columnId);
		markActivityStart("sorting");
		sortStartRef.current = {
			runId: activityRunId + 1,
			columnId,
			startedAt: Date.now(),
		};
		startSortTransition(() => {
			setSortState({ columnId, direction });
		});
	}, [TABLE_ID, activityRunId, effectiveSortState, isDev, lockedSort, markActivityStart, startSortTransition, updateActiveCell]);

	const clearSort = useCallback(() => {
		if (lockedSort) return;
		updateActiveCell(null);
		if (isDev) {
			console.log("[FormTable][Sort] CLEAR CLICK", {
				tableId: TABLE_ID,
				action: "clearSort",
				currentSortState: effectiveSortState,
				ts: new Date().toISOString(),
			});
		}
		setPendingSortColumnId(null);
		markActivityStart("sorting");
		sortStartRef.current = {
			runId: activityRunId + 1,
			columnId: null,
			startedAt: Date.now(),
		};
		startSortTransition(() => {
			setSortState({ columnId: null, direction: "asc" });
		});
	}, [TABLE_ID, activityRunId, effectiveSortState, isDev, lockedSort, markActivityStart, startSortTransition, updateActiveCell]);

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
	}, [paginationDisabled, page, pageSize, sortedRows, fetchRowsFn, serverReturnedAllRows, useServerDataMode]);

	const processedRowsRef = useRef<Row[]>(processedRows);
	const processedRowIds = useMemo(() => processedRows.map((row) => row.id), [processedRows]);
	const processedRowIndexById = useMemo(() => {
		const map = new Map<string, number>();
		processedRowIds.forEach((rowId, index) => {
			map.set(rowId, index);
		});
		return map;
	}, [processedRowIds]);
	const processedRowIdsRef = useRef<string[]>(processedRowIds);
	const processedRowIndexByIdRef = useRef<Map<string, number>>(processedRowIndexById);
	useEffect(() => {
		processedRowsRef.current = processedRows;
		processedRowIdsRef.current = processedRowIds;
		processedRowIndexByIdRef.current = processedRowIndexById;
	}, [processedRows, processedRowIds, processedRowIndexById]);
	const selectedColumn = bulkSelection.columnId
		? columnsById[bulkSelection.columnId] ?? null
		: null;
	const selectedRowIdsSet = useMemo(
		() => new Set(bulkSelection.rowIds),
		[bulkSelection.rowIds]
	);
	const clearBulkSelection = useCallback(() => {
		bulkEditClearedKeyRef.current = null;
		setBulkSelection({
			columnId: null,
			rowIds: [],
			anchorRowId: null,
			isDragging: false,
		});
	}, []);
	const isBulkCellSelected = useCallback(
		(rowId: string, columnId: string) =>
			bulkSelection.columnId === columnId && selectedRowIdsSet.has(rowId),
		[bulkSelection.columnId, selectedRowIdsSet]
	);
	const resolveVisibleRowRange = useCallback((anchorRowId: string, currentRowId: string) => {
		const visibleRowIds = processedRowIdsRef.current;
		const indexById = processedRowIndexByIdRef.current;
		const anchorIndex = indexById.get(anchorRowId) ?? -1;
		const currentIndex = indexById.get(currentRowId) ?? -1;
		if (anchorIndex < 0 || currentIndex < 0) {
			return [anchorRowId, currentRowId].filter(Boolean);
		}
		const start = Math.min(anchorIndex, currentIndex);
		const end = Math.max(anchorIndex, currentIndex);
		return visibleRowIds.slice(start, end + 1);
	}, []);
	const beginBulkSelectionDrag = useCallback(
		(rowId: string, column: ColumnDef<Row>) => {
			if (isReadOnly || column.editable === false) return;
			bulkEditClearedKeyRef.current = null;
			updateActiveCell({ rowId, columnId: column.id });
			setBulkSelection({
				columnId: column.id,
				rowIds: [rowId],
				anchorRowId: rowId,
				isDragging: true,
			});
		},
		[isReadOnly, updateActiveCell]
	);
	const extendBulkSelectionDrag = useCallback(
		(rowId: string, column: ColumnDef<Row>) => {
			if (isReadOnly || column.editable === false) return;
			setBulkSelection((prev) => {
				if (!prev.isDragging || prev.columnId !== column.id || !prev.anchorRowId) {
					return prev;
				}
				const rowIds = resolveVisibleRowRange(prev.anchorRowId, rowId);
				return shallowEqualStringArrays(prev.rowIds, rowIds) ? prev : { ...prev, rowIds };
			});
		},
		[isReadOnly, resolveVisibleRowRange]
	);
	const endBulkSelectionDrag = useCallback(() => {
		setBulkSelection((prev) =>
			prev.isDragging ? { ...prev, isDragging: false } : prev
		);
	}, []);
	useEffect(() => {
		if (!bulkSelection.columnId || bulkSelection.isDragging) return;
		if (
			!activeCell ||
			activeCell.columnId !== bulkSelection.columnId ||
			!bulkSelection.rowIds.includes(activeCell.rowId)
		) {
			clearBulkSelection();
		}
	}, [
		activeCell,
		bulkSelection.columnId,
		bulkSelection.isDragging,
		bulkSelection.rowIds,
		clearBulkSelection,
	]);
	const commitBulkCellValue = useCallback(
		(rowId: string, column: ColumnDef<Row>, value: unknown) => {
			if (isReadOnly || column.editable === false) return false;
			if (bulkSelection.columnId !== column.id || bulkSelection.rowIds.length < 2) {
				return false;
			}
			if (!bulkSelection.rowIds.includes(rowId)) return false;

			const selectedIds = bulkSelection.rowIds;
			const bulkEditKey = `${column.id}:${selectedIds.join(",")}`;
			const shouldMarkCleared = bulkEditClearedKeyRef.current !== bulkEditKey;
			setFormFieldValue("rowsById", (prev: Record<string, Row> = {}) => {
				let changed = false;
				const next = { ...prev };
				selectedIds.forEach((selectedRowId) => {
					const row = next[selectedRowId];
					if (!row) return;
					next[selectedRowId] = {
						...row,
						[column.field]: value,
					};
					changed = true;
				});
				return changed ? next : prev;
			});
			if (shouldMarkCleared) {
				bulkEditClearedKeyRef.current = bulkEditKey;
			}
			return true;
		},
		[
			bulkSelection.columnId,
			bulkSelection.rowIds,
			isReadOnly,
			setFormFieldValue,
		]
	);
	const applyBulkSelectionValue = useCallback(
		(value: unknown) => {
			if (isReadOnly || !selectedColumn || selectedColumn.editable === false) return;
			const selectedIds = bulkSelection.rowIds;
			if (selectedIds.length === 0) return;
			setFormFieldValue("rowsById", (prev: Record<string, Row> = {}) => {
				let changed = false;
				const next = { ...prev };
				selectedIds.forEach((rowId) => {
					const row = next[rowId];
					if (!row) return;
					next[rowId] = {
						...row,
						[selectedColumn.field]: value,
					};
					changed = true;
				});
				return changed ? next : prev;
			});
			toast.success(`${selectedIds.length} celdas actualizadas`);
			clearBulkSelection();
		},
		[
			bulkSelection.rowIds,
			clearBulkSelection,
			isReadOnly,
			selectedColumn,
			setFormFieldValue,
		]
	);

	// Use client pagination values when server returned all rows at once
	const useClientPaginationValues = !useServerDataMode && (useClientPagination || serverReturnedAllRows);

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

	const FieldComponent = form.Field as FormFieldComponent<Row>;
	const editMode = config.editMode ?? "always";
	const editOnHover = config.editOnHover ?? false;
	const isRowExpanded = useCallback(
		(rowId: string) => (accordionAlwaysOpen ? true : expandedRowIds.has(rowId)),
		[accordionAlwaysOpen, expandedRowIds]
	);
	const toggleAccordionRow = useCallback(
		(rowId: string) => {
			if (!hasAccordionRows || accordionAlwaysOpen) return;
			setExpandedRowIds((prev) => {
				const next = new Set(prev);
				if (next.has(rowId)) {
					next.delete(rowId);
				} else {
					next.add(rowId);
				}
				return next;
			});
		},
		[accordionAlwaysOpen, hasAccordionRows]
	);

	const handleClearCell = useCallback(
		(rowId: string, column: ColumnDef<Row>) => {
			if (isReadOnly) return;
			if (column.editable === false) return;
			const clearedValue = getClearedValue(column);
			setFormFieldValue(`rowsById.${rowId}.${column.field}` as const, () => clearedValue as Row[ColumnField<Row>]);
		},
		[isReadOnly, setFormFieldValue]
	);

	const handleRestoreCell = useCallback(
		(rowId: string, column: ColumnDef<Row>) => {
			if (isReadOnly) return;
			const initialRow = initialValuesRef.current.rowsById[rowId];
			if (!initialRow) return;
			const initialValue = initialRow[column.field];
			setFormFieldValue(`rowsById.${rowId}.${column.field}` as const, () => initialValue as Row[ColumnField<Row>]);
		},
		[isReadOnly, setFormFieldValue]
	);

	const setCellValue = useCallback(
		(rowId: string, field: ColumnField<Row>, value: unknown) => {
			if (isReadOnly) return;
			setFormFieldValue(`rowsById.${rowId}.${field}` as const, () => value);
		},
		[isReadOnly, setFormFieldValue]
	);

	const updateRow = useCallback(
		(rowId: string, updater: (row: Row) => Row) => {
			if (isReadOnly) return;
			setFormFieldValue("rowsById", (prev: Record<string, Row> = {}) => {
				const currentRow = prev[rowId];
				if (!currentRow) return prev;
				const nextRow = updater(currentRow);
				if (nextRow === currentRow) return prev;
				return {
					...prev,
					[rowId]: nextRow,
				};
			});
		},
		[isReadOnly, setFormFieldValue]
	);

	const handleCopyCell = useCallback(async (value: unknown) => {
		const success = await copyToClipboard(value == null ? "" : String(value));
		toast[success ? "success" : "error"](
			success ? "Valor copiado al portapapeles" : "No se pudo copiar"
		);
	}, []);

	const handleCopyColumn = useCallback(async (column: ColumnDef<Row>) => {
		const snapshot = processedRowsRef.current;
		const values = snapshot.map((row) => row[column.field] ?? "").join("\n");
		const success = await copyToClipboard(values);
		toast[success ? "success" : "error"](
			success ? "Columna copiada" : "No se pudo copiar la columna"
		);
	}, []);

	const handleCopyRow = useCallback(async (row: Row) => {
		const success = await copyToClipboard(tableRowToCsv(row, columns));
		toast[success ? "success" : "error"](
			success ? "Fila copiada en CSV" : "No se pudo copiar la fila"
		);
	}, [columns]);

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
	const table = useReactTable({
		data: processedRows,
		columns: tableColumns,
		getCoreRowModel: getCoreRowModel(),
		getRowId: (row) => row.id,
		state: {
			columnVisibility,
		},
		onColumnVisibilityChange: (updater) => {
			const newVisibility = typeof updater === 'function' ? updater(columnVisibility) : updater;
			const hidden = Object.keys(newVisibility).filter((key) => !newVisibility[key]);
			setHiddenColumnIds((prev) =>
				shallowEqualStringArrays(prev, hidden) ? prev : hidden
			);
		},
		enableColumnResizing: false, // We handle resizing manually
		columnResizeMode: 'onChange',
	});
	const visibleDataColumnCount = table.getVisibleLeafColumns().length;

	const handleAddRow = useCallback(() => {
		if (isReadOnly) return;
		const newRow = config.createRow ? config.createRow() : createRowFromColumns(columns);
		setFormFieldValue("rowOrder", (prev: string[] = []) => [newRow.id, ...(prev ?? [])]);
		setFormFieldValue("rowsById", (prev: Record<string, Row> = {}) => ({
			...prev,
			[newRow.id]: newRow,
		}));
		if (config.revealNewRowOnAdd) {
			if (searchInputValue.trim().length > 0) {
				handleSearchInputChange("");
			}
			if (hasFilters) {
				const initialFilters = createFiltersRef.current?.();
				if (typeof initialFilters !== "undefined") {
					setFilters(initialFilters);
					setFiltersDraft(initialFilters);
				}
			}
			if (!lockedSort && effectiveSortState.columnId) {
				setSortState({ columnId: null, direction: "asc" });
			}
			if (hasTabFilters && activeTab !== "all" && tabFilters.some((tab) => tab.id === "all")) {
				setActiveTab("all");
			}
		}
		setPage(1);
		toast.success("Fila vacía agregada");
	}, [
		activeTab,
		columns,
		config,
		effectiveSortState.columnId,
		handleSearchInputChange,
		hasFilters,
		hasTabFilters,
		isReadOnly,
		lockedSort,
		searchInputValue,
		setFormFieldValue,
		tabFilters,
	]);

	const handleDelete = useCallback((id: string) => {
		if (isReadOnly) return;
		setFormFieldValue("rowOrder", (prev: string[] = []) => prev.filter((rowId) => rowId !== id));
		setFormFieldValue("rowsById", (prev: Record<string, Row> = {}) => {
			if (!(id in prev)) return prev;
			const next = { ...prev };
			delete next[id];
			return next;
		});
		// toast.success("Fila eliminada");
	}, [isReadOnly, setFormFieldValue]);

	const handleExportCsv = useCallback(async () => {
		try {
			const exportColumns = columns.filter((column) => !isColumnHidden(column.id));
			if (exportColumns.length === 0) {
				toast.error("No hay columnas visibles para exportar");
				return;
			}
			const customExport = config.csvExport?.buildExport
				? await config.csvExport.buildExport({
					tableId: TABLE_ID,
					rows,
					sortedRows,
					visibleColumns: exportColumns,
					allColumns: columns,
					hiddenColumnIds,
					search: searchRequestKey,
					filters,
					activeTab,
					sort: effectiveSortState,
				})
				: null;
			const exportRowCount = customExport ? customExport.rows.length : sortedRows.length;
			if (exportRowCount === 0) {
				toast.error("No hay filas para exportar");
				return;
			}
			const separator = ";";
			const header = customExport
				? valuesToCsvRow(customExport.columns)
				: exportColumns
					.map((column) => `"${column.label.replace(/"/g, '""')}"`)
					.join(separator);
			const body = customExport
				? customExport.rows.map((row) => valuesToCsvRow(row)).join("\n")
				: sortedRows.map((row) => tableRowToCsv(row, exportColumns)).join("\n");
			const csv = `\uFEFF${header}\n${body}`;
			const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
			const url = URL.createObjectURL(blob);
			const link = document.createElement("a");
			link.href = url;
			link.download = `${customExport?.fileName ?? TABLE_ID}.csv`;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			URL.revokeObjectURL(url);
			toast.success("Tabla exportada");
		} catch (error) {
			console.error("Error exporting table", error);
			toast.error(error instanceof Error ? error.message : "No se pudo exportar la tabla");
		}
	}, [
		TABLE_ID,
		activeTab,
		columns,
		config.csvExport,
		effectiveSortState,
		filters,
		hiddenColumnIds,
		isColumnHidden,
		rows,
		searchRequestKey,
		sortedRows,
	]);

	const handleSave = useCallback(async () => {
		if (isReadOnly) return;
		if (!hasUnsavedChanges) return;
		setIsSaving(true);
		setServerError(null);
		try {
			if (config.onSave) {
				const dirtyRows = rows.filter((row) => dirtyIndex.rowDirtyById[row.id]);
				const deletedRowIds = initialValuesRef.current.rowOrder.filter(
					(initialId) => !rowOrder.includes(initialId)
				);
				await config.onSave({ rows, dirtyRows, deletedRowIds });
			} else {
				await new Promise((resolve) => setTimeout(resolve, 900));
			}
			const snapshot = snapshotValues(rowOrder, rowsById);
			initialValuesRef.current = snapshot;
			setDirtyBaseline(snapshot);
			toast.success("Cambios guardados correctamente");
		} catch (error) {
			const errorMessage =
				error instanceof Error && error.message
					? error.message
					: "No se pudieron guardar los cambios";
			setServerError(errorMessage);
			toast.error(errorMessage);
		} finally {
			setIsSaving(false);
		}
	}, [config, dirtyIndex, hasUnsavedChanges, isReadOnly, rowOrder, rows, rowsById]);

	const handleDiscardChanges = useCallback(() => {
		if (isReadOnly) return;
		if (!hasUnsavedChanges) return;
		const snapshot = snapshotValues(initialValuesRef.current.rowOrder, initialValuesRef.current.rowsById);
		setFormFieldValue("rowOrder", snapshot.rowOrder);
		setFormFieldValue("rowsById", snapshot.rowsById);
		setExpandedRowIds((prev) => {
			const allowed = new Set(snapshot.rowOrder);
			let changed = false;
			const next = new Set<string>();
			prev.forEach((id) => {
				if (allowed.has(id)) {
					next.add(id);
				} else {
					changed = true;
				}
			});
			return changed ? next : prev;
		});
		config.onDiscardChanges?.();
		toast.info("Cambios descartados");
	}, [config, hasUnsavedChanges, isReadOnly, setFormFieldValue]);

	const contextValue = useMemo<FormTableContextValue<Row, Filters>>(() => ({
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
		columns: {
			list: columns,
			hiddenIds: hiddenColumnIds,
			setHiddenIds: setHiddenColumnIds,
			pinnedIds: pinnedColumnIds,
			togglePin: togglePinColumn,
			handleBalance: handleBalanceColumns,
			columnIndexMap,
			columnsById,
			groupedColumnLookup,
			isColumnHidden,
			isColumnPinned,
			getStickyProps,
			tableRef,
			colRefs,
			colWidths,
			columnOffsets,
			enableResizing: enableColumnResizing,
		},
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
	}), [
		TABLE_ID,
		activeCell,
		activeFilterCount,
		activeTab,
		activityKind,
		accordionRowConfig,
		applySortDirection,
		bulkSelection.isDragging,
		bulkSelection.rowIds,
		clearBulkSelection,
		colWidths,
		columnOffsets,
		colRefs,
		columnIndexMap,
		columns,
		columnsById,
		config,
		datasetTotalCount,
		editMode,
		editOnHover,
		enableColumnResizing,
		effectiveSortState,
		externalRefreshVersion,
		FieldComponent,
		filters,
		filtersDraft,
		getRowDirtyState,
		getStickyProps,
		groupedColumnLookup,
		handleAddRow,
		handleApplyAdvancedFilters,
		handleBalanceColumns,
		handleClearCell,
		handleCopyCell,
		handleCopyColumn,
		handleCopyRow,
		handleDelete,
		handleDiscardChanges,
		handleExportCsv,
		handleResetAdvancedFilters,
		handleRestoreCell,
		handleSave,
		handleSearchInputChange,
		handleSetPageSize,
		setCellValue,
		updateRow,
		hasAccordionRows,
		hasFilters,
		hasInitialRow,
		hasNextPage,
		hasPreviousPage,
		hasTabFilters,
		hasUnsavedChanges,
		hiddenColumnIds,
		highlightQuery,
		isBusy,
		isCellDirty,
		isColumnHidden,
		isColumnPinned,
		isEmbedded,
		isFetchingServerRows,
		isFilterProcessing,
		isPageSizeTransitioning,
		isRowExpanded,
		isSaving,
		isSearchProcessing,
		isServerPaging,
		isSlowOperation,
		isSortProcessing,
		lockedPageSize,
		page,
		pageSize,
		paginationOptions,
		pendingSortColumnId,
		pinnedColumnIds,
		rows,
		selectedColumn,
		setFiltersDraftValue,
		showInlineSearch,
		searchPlaceholder,
		searchInputValue,
		serverError,
		table,
		tableRef,
		tabCounts,
		tabFilters,
		toggleAccordionRow,
		togglePinColumn,
		toggleSort,
		totalPages,
		totalRowCount,
		updateActiveCell,
		variant,
		visibleDataColumnCount,
		visibleRowCount,
		isBulkCellSelected,
		beginBulkSelectionDrag,
		extendBulkSelectionDrag,
		endBulkSelectionDrag,
		applyBulkSelectionValue,
		commitBulkCellValue,
		clearSort,
	]);

	const tableSurface = showRowNumbers ? (
		<div className="mx-[1px] flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-card mt-[1px] shadow-[0_1px_0_0_#fff_inset,0_-1px_0_0_#0000001f_inset,0_0_0_1px_#00000024,0_2px_2px_0_#0b090c0d,0_1px_1px_0_#0b090c0f,0_5px_8px_-7px_#0b090c08]">
			{(config.showToolbar ?? true) ? (
				<div className={cn("border-b border-stroke-soft bg-surface px-3 py-2.5", toolbarClassName)}>
					<FormTableToolbar />
				</div>
			) : null}
			<FormTableTabs className="mx-3 mt-3" />
			<div className="flex min-h-0 flex-1">
				<FormTableContent className={className} innerClassName={innerClassName} />
			</div>
		</div>
	) : (
		<>
			{(config.showToolbar ?? true) ? <FormTableToolbar /> : null}
			<FormTableTabs />
			<div className="flex-1 shadow-card mx-[1px] flex">
				<FormTableContent className={className} innerClassName={innerClassName} />
			</div>
		</>
	);

	const content = (
		<div
			className={cn(
				"max-w-full overflow-hidden flex flex-col h-full",
				showRowNumbers
					? "gap-3"
					: isEmbedded
						? "gap-3 px-3 py-3"
						: "space-y-4 gap-4 pt-6"
			)}
		>
			{(config.title || config.description) ? (
				<div>
					{config.title ? <h1 className="text-xl font-bold mt-2">{config.title}</h1> : null}
					{config.description && (
						<p className="text-content-secondary">{config.description}</p>
					)}
				</div>
			) : null}
			{tableSurface}
			<FormTablePagination />
		</div>
	);
	const wrappedContent = isEmbedded ? (
		content
	) : (
		<>
			{content}
		</>
	);

	const defaultLayout = <TooltipProvider delayDuration={200}>{wrappedContent}</TooltipProvider>;

	return (
		<FormTableProvider value={contextValue}>
			{children ?? defaultLayout}
		</FormTableProvider>
	);
}
