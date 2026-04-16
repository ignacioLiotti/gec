'use client';

import { useState, useCallback, useDeferredValue, useEffect, useMemo, useRef, useTransition, startTransition } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { useForm, useStore } from "@tanstack/react-form";
import {
	useReactTable,
	getCoreRowModel,
	ColumnDef as TanStackColumnDef,
	VisibilityState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Button } from "@/components/ui/button";
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
	snapshotValues,
	tableRowToCsv,
	copyToClipboard,
} from "./table-utils";
import { FormTableProvider, useFormTable as useFormTableContext } from "./context";
import type { FormTableContextValue } from "./context";
import { MemoizedTableRow } from "./table-body";

export const useFormTable = useFormTableContext;

export function FormTableToolbar() {
	const { config, search, filters, columns, sorting, meta, actions } = useFormTable<FormTableRow, unknown>();
	const [isFiltersOpen, setIsFiltersOpen] = useState(false);
	const isExtrasToolbar = config.toolbarMode === "extras";
	const canShowFilters = filters.enabled && typeof filters.value !== "undefined";

	const renderFiltersContent =
		isFiltersOpen && typeof filters.draft !== "undefined" && config.renderFilters
			? config.renderFilters({
				filters: filters.draft,
				onChange: (updater) => filters.setDraft((prev) => updater(prev ?? filters.draft)),
			})
			: (
				<p className="text-sm text-muted-foreground">
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
			triggerVariant={isExtrasToolbar ? "ghost" : "outline"}
			triggerClassName={
				isExtrasToolbar
					? "h-8 w-full justify-start rounded-sm px-2 py-1.5 text-sm font-normal"
					: "gap-2"
			}
		/>
	);

	return (
		<div className="flex flex-wrap items-center justify-between gap-3">
			<div className="flex flex-wrap items-center gap-2">
				{search.showInline && (
					<div className="relative ml-0.5 flex items-center gap-2 group">
						{search.isProcessing ? (
							<Loader2 className="size-4 -mr-6 absolute left-2.5 top-2.5 z-10 animate-spin text-primary" />
						) : (
							<Search className="size-4 -mr-6 absolute left-2.5 top-2.5 z-10 text-muted-foreground" />
						)}
						<Input
							type="search"
							data-testid="form-table-search"
							className="h-9 w-64 pointer-events-auto rounded-lg border-[#e8e8e8] pl-9 text-sm bg-white bg-[radial-gradient(100%_50%_at_50%_0%,#fff_0%,#fff0_100%),var(--background-85,#fafafad9)] shadow-[0_0_0_1px_#00000012,0_1px_0_0_#fff_inset,0_8px_3px_0_#0b090c03,0_5px_3px_0_#0b090c08,0_2px_2px_0_#0b090c0d,0_1px_1px_0_#0b090c0f,0_-1px_0_0_#0000001f_inset] hover:bg-accent text-foreground"
							value={search.value}
							onChange={(event) => search.onChange(event.target.value)}
							placeholder={search.placeholder}
						/>
					</div>
				)}
				{search.showInline && config.toolbarSearchEnd}
				{canShowFilters && (
					<Sheet open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
						{!isExtrasToolbar && (
							<SheetTrigger asChild>
								<Button
									type="button"
									variant={filters.activeCount > 0 ? "default" : "outline"}
									className={cn(
										"gap-2 transition-all",
										filters.activeCount > 0 && "shadow-sm"
									)}
								>
									{filters.isProcessing ? (
										<Loader2 className="h-4 w-4 animate-spin" />
									) : (
										<Filter className="h-4 w-4" />
									)}
									<span>Filtros</span>
									{filters.activeCount > 0 && (
										<span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-foreground/20 px-1.5 text-[10px] font-semibold">
											{filters.activeCount}
										</span>
									)}
								</Button>
							</SheetTrigger>
						)}
						<SheetContent
							side="right"
							className="!max-w-[420px] p-0 flex flex-col border-l-0 shadow-2xl"
						>
							{/* Header */}
							<div className="shrink-0 border-b bg-gradient-to-br from-muted/50 to-background px-6 py-5">
								<SheetHeader className="space-y-1">
									<div className="flex items-center gap-3">
										<div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
											<Filter className="h-4 w-4 text-primary" />
										</div>
										<div>
											<SheetTitle className="text-lg">Filtros avanzados</SheetTitle>
											<p className="text-xs text-muted-foreground mt-0.5">
												{filters.activeCount > 0
													? `${filters.activeCount} filtro${filters.activeCount > 1 ? 's' : ''} activo${filters.activeCount > 1 ? 's' : ''}`
													: "Refina los resultados de la tabla"
												}
											</p>
										</div>
									</div>
								</SheetHeader>
							</div>

							{/* Content */}
							<div className="flex-1 overflow-y-auto px-6 py-5">
								<div className="space-y-5">{renderFiltersContent}</div>
							</div>

							{/* Footer */}
							<div className="shrink-0 border-t bg-muted/30 px-6 py-4">
								<div className="flex items-center justify-between gap-3">
									<Button
										type="button"
										variant="ghost"

										onClick={filters.reset}
										className="text-muted-foreground hover:text-foreground"
									>
										Reiniciar filtros
									</Button>
									<Button
										type="button"
										onClick={() => {
											filters.apply();
											setIsFiltersOpen(false);
										}}

										className="px-6 shadow-sm"
									>
										Aplicar
									</Button>
								</div>
							</div>
						</SheetContent>
					</Sheet>
				)}
				{isExtrasToolbar ? (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button type="button" variant="outline" className="gap-2">
								<MoreHorizontal className="h-4 w-4" />
								Extras
							</Button>
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
											<Loader2 className="h-4 w-4 animate-spin" />
										) : (
											<Filter className="h-4 w-4" />
										)}
										<span>Filtros</span>
										{filters.activeCount > 0 && (
											<span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
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
								<Download className="h-4 w-4" />
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
			<div className="flex flex-wrap items-center gap-2 mr-[1px]">
				{meta.isBusy && meta.activityKind && (
					<div
						role="status"
						aria-live="polite"
						className={cn(
							"inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium",
							meta.isSlowOperation
								? "border-amber-300 bg-amber-50 text-amber-800"
								: "border-primary/20 bg-primary/5 text-primary"
						)}
					>
						<Loader2 className="h-3.5 w-3.5 animate-spin" />
						<span>{getTableActivityMessage(meta.activityKind, meta.isSlowOperation)}</span>
					</div>
				)}
				{!isExtrasToolbar && (
					<Button type="button" variant="outline" className="gap-2" onClick={() => void actions.exportCsv()}>
						<Download className="h-4 w-4" />
						Exportar tabla
					</Button>
				)}
				{sorting.state.columnId && (
					<Button type="button" variant="ghost" className="gap-1" onClick={sorting.clear}>
						<Minus className="h-4 w-4" />
						Limpiar orden
					</Button>
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
			className={cn("flex gap-1 shadow-dark-wrapper", className)}
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
						<span className={isActive ? "text-white" : "text-black"}>{tab.label}</span>
						<span className={cn(
							"rounded-full bg-muted px-2 py-0.5 text-xs",
							isActive
								? "bg-black/20 text-white"
								: "hover:bg-black/20 hover:text-white"
						)}>
							{tabs.counts[tab.id] ?? 0}
						</span>
					</Button>
				);
			})}
		</div>
	);
}

export function FormTableContent({ className, innerClassName, tableHeight }: { className?: string, innerClassName?: string, tableHeight?: string }) {
	const {
		tableId,
		config,
		columns,
		rows,
		meta,
		pagination,
		sorting,
		tabs,
	} = useFormTable<FormTableRow, unknown>();
	const { externalRefreshVersion } = meta;
	const rowClassName = config.rowClassName as
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
	const { tableRef, colRefs, colWidths, isColumnHidden, getStickyProps, columnIndexMap, columnsById, groupedColumnLookup, enableResizing, hiddenIds } = columns;
	const hiddenColumnIdsKey = useMemo(() => hiddenIds.join(","), [hiddenIds]);
	const {
		table,
		FieldComponent,
		highlightQuery,
		editMode,
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
		handleCopyCell,
		handleCopyColumn,
		handleCopyRow,
		visibleDataColumnCount,
	} = rows;
	const accordionAlwaysOpen = Boolean(accordionRowConfig?.alwaysOpen);
	const isReadOnly = config.readOnly === true;
	const showActionsColumn = config.showActionsColumn !== false;
	const canDeleteRows = !isReadOnly;
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
	const rowVirtualizer = useVirtualizer({
		count: shouldVirtualize ? tableRows.length : 0,
		getScrollElement: () => scrollParentRef.current,
		estimateSize: () => 58,
		overscan: config.virtualizationOverscan ?? 5,
	});
	const virtualRows = shouldVirtualize ? rowVirtualizer.getVirtualItems() : [];
	const paddingTop = shouldVirtualize && virtualRows.length > 0 ? virtualRows[0]!.start : 0;
	const paddingBottom =
		shouldVirtualize && virtualRows.length > 0
			? rowVirtualizer.getTotalSize() - virtualRows[virtualRows.length - 1]!.end
			: 0;
	const rowIds = useMemo(() => tableRows.map((row) => row.original.id), [tableRows]);
	const [hoveredCell, setHoveredCell] = useState<{ rowId: string; columnId: string } | null>(null);
	useEffect(() => {
		if (editMode !== "active-cell" || isReadOnly) {
			setHoveredCell(null);
		}
	}, [editMode, isReadOnly]);
	useEffect(() => {
		if (!hoveredCell) return;
		if (!rowIds.includes(hoveredCell.rowId)) {
			setHoveredCell(null);
		}
	}, [hoveredCell, rowIds]);
	const visibleColumnIds = useMemo(
		() => columnDefs.filter((column) => !isColumnHidden(column.id)).map((column) => column.id),
		[columnDefs, isColumnHidden]
	);
	const focusCellControl = useCallback((rowId: string, columnId: string) => {
		if (typeof window === "undefined") return;
		const tableElement = tableRef.current;
		if (!tableElement) return;

		const locateCell = () => {
			const cells = tableElement.querySelectorAll<HTMLElement>('[data-form-table-cell="true"]');
			for (const cell of cells) {
				if (cell.dataset.rowId === rowId && cell.dataset.columnId === columnId) {
					return cell;
				}
			}
			return null;
		};
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
		const currentCellElement = target.closest<HTMLElement>('td[data-form-table-cell="true"]');
		const currentRowId = activeCell?.rowId ?? currentCellElement?.dataset.rowId ?? rowIds[0];
		const currentColumnId = activeCell?.columnId ?? currentCellElement?.dataset.columnId ?? visibleColumnIds[0];
		let nextRowIndex = rowIds.indexOf(currentRowId);
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
		rowVirtualizer,
		setActiveCell,
		shouldVirtualize,
		visibleColumnIds,
	]);
	const handleClearHoveredCell = useCallback(() => {
		setHoveredCell(null);
	}, []);

	return (
		<>
			{serverError && (
				<div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
					{serverError}
				</div>
			)}
			<div className={cn("relative rounded-none overflow-x-auto w-full bg-white flex-1", className)}>
				{isServerPaging && isFetching && tableRows.length === 0 && (
					<div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-background/70 backdrop-blur-sm">
						<Loader2 className="h-6 w-6 animate-spin text-primary" />
						<p className="text-sm font-medium text-muted-foreground">Sincronizando con el servidor…</p>
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
									: "border-primary/20 bg-background/90 text-primary"
							)}
						>
							<Loader2 className="h-3.5 w-3.5 animate-spin" />
							<span>{getTableActivityMessage(activityKind, isSlowOperation)}</span>
						</div>
					</div>
				)}
				<div
					ref={scrollParentRef}
					onPointerLeave={handleClearHoveredCell}
					onKeyDownCapture={handleArrowNavigation}
					className={cn("h-full overflow-y-auto bg-[repeating-linear-gradient(-60deg,transparent_0%,transparent_5px,var(--border)_5px,var(--border)_6px,transparent_6px)] bg-repeat scrollbar", innerClassName)}>
					<table ref={tableRef} data-table-id={tableId} className={cn("w-full table-fixed text-sm max-w-full overflow-hidden", tableHeight)}>
						<colgroup className="max-w-full overflow-hidden">
							{columnDefs.map((column, index) => (
								<col
									key={column.id}
									ref={(el) => {
										colRefs.current[index] = el;
									}}
									style={{
										width: `${colWidths[index] ?? DEFAULT_COL_WIDTH}px`,
										display: isColumnHidden(column.id) ? "none" : undefined,
									}}
								/>
							))}
							{showActionsColumn && (
								<col
									style={{
										width: `${colWidths[columnDefs.length] ?? 140}px`,
									}}
								/>
							)}
						</colgroup>
						<thead className="sticky top-0 z-30 bg-back-darker">
							<tr>
								{(() => {
									const emittedGroups = new Set<string>();
									return (
										<>
											{columnDefs.map((column) => {
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
																"relative px-4 py-4 text-left text-md font-semibold uppercase outline outline-border bg-back-darker h-[55px]"
															)}
														>
															<div className="flex w-full h-full px-4 py-3 absolute top-0 left-0 items-center justify-between gap-2">
																{isSortable ? (
																	<ContextMenu>
																		<ContextMenuTrigger asChild>
																			<button
																				type="button"
																				onClick={() => toggleSort(column.id)}
																				className="flex w-full items-center justify-between gap-2 text-left"
																			>
																				<span>{column.label.toUpperCase()}</span>
																				<span className="text-muted-foreground flex items-center gap-2">
																					{isSortProcessing &&
																						(sortState.columnId === column.id || pendingSortColumnId === column.id) && (
																							<Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
																						)}
																					{sortState.columnId === column.id ? (
																						sortState.direction === "asc" ? (
																							<ArrowUp className="h-3.5 w-3.5" />
																						) : (
																							<ArrowDown className="h-3.5 w-3.5" />
																						)
																					) : (
																						<ArrowUpDown className="h-3.5 w-3.5" />
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
																	<span className="flex w-full items-center justify-between gap-2 text-left text-muted-foreground">
																		<span>{column.label}</span>
																	</span>
																)}
															</div>
															{enableResizing && column.enableResize !== false && (
																<ColumnResizer tableId={tableId} colIndex={columnIndexMap[column.id]} mode="fixed" />
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
															"px-4 py-2 text-center text-xs font-semibold uppercase outline outline-border bg-back-darker",
															group.className
														)}
													>
														{group.label}
													</th>
												);
											})}
											{showActionsColumn && (
												<th
													rowSpan={2}
													className="relative px-4 py-4 text-right text-xs font-semibold uppercase outline outline-border bg-back-darker"
												>
													<div className="flex w-full h-full px-4 py-3 absolute top-0 left-0 items-center justify-end gap-2">
														<span>Acciones</span>
													</div>
													{enableResizing && (
														<ColumnResizer tableId={tableId} colIndex={columnDefs.length} mode="fixed" />
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
										"relative px-4 py-4 text-left text-xs font-semibold uppercase outline outline-border bg-back-darker"
									);
									const isSortable = column.enableSort !== false;

									return (
										<th key={column.id} {...getStickyProps(column.id, baseClassName)}>
											<div className="flex w-full h-full px-4 py-3 absolute top-0 left-0 items-center justify-between gap-2">
												{isSortable ? (
													<ContextMenu>
														<ContextMenuTrigger asChild>
															<button
																type="button"
																onClick={() => toggleSort(column.id)}
																className="flex w-full items-center justify-between gap-2 text-left"
															>
																<span>{column.label}</span>
																<span className="text-muted-foreground">
																	{isSortProcessing &&
																		(sortState.columnId === column.id || pendingSortColumnId === column.id) && (
																			<Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin text-primary" />
																		)}
																	{sortState.columnId === column.id ? (
																		sortState.direction === "asc" ? (
																			<ArrowUp className="inline h-3.5 w-3.5" />
																		) : (
																			<ArrowDown className="inline h-3.5 w-3.5" />
																		)
																	) : (
																		<ArrowUpDown className="h-3.5 w-3.5" />
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
													<span className="flex w-full items-center justify-between gap-2 text-left text-muted-foreground">
														<span>{column.label}</span>
													</span>
												)}
											</div>
											{enableResizing && column.enableResize !== false && (
												<ColumnResizer tableId={tableId} colIndex={colIndex} mode="fixed" />
											)}
										</th>
									);
								})}
							</tr>
						</thead>
						<tbody className="bg-white" key={tabs.activeTab ?? 'all'}>
							{tableRows.length === 0 ? (
								<tr>
									<td
										colSpan={visibleDataColumnCount + (showActionsColumn ? 1 : 0)}
										className="px-6 py-12 text-center text-sm text-muted-foreground"
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
												colSpan={visibleDataColumnCount + (showActionsColumn ? 1 : 0)}
												style={{ height: `${paddingTop}px` }}
											/>
										</tr>
									)}
									{virtualRows.map((virtualRow) => {
										const row = tableRows[virtualRow.index];
										const rowId = row.original.id;
										const { dirty: rowIsDirty, cells: dirtyCells } = getRowDirtyState(rowId);
										// Create a stable string key of dirty cell IDs for memoization
										const dirtyCellIds = dirtyCells.map(c => c.id).sort().join(',');
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
												rowColorInfo={rowColorInfo}
												rowOverlayBadges={rowOverlayBadges}
												FieldComponent={FieldComponent}
												tableReadOnly={isReadOnly}
												highlightQuery={highlightQuery}
												editMode={editMode}
												activeCell={activeCell}
												setActiveCell={setActiveCell}
												hasInitialSnapshot={hasInitialRow(rowId)}
												accordionRowConfig={accordionRowConfig}
												accordionAlwaysOpen={accordionAlwaysOpen}
												isExpanded={isRowExpanded(rowId)}
												isRowDirty={rowIsDirty}
												dirtyCellIds={dirtyCellIds}
												hiddenColumnIdsKey={hiddenColumnIdsKey}
												showActionsColumn={showActionsColumn}
												canDeleteRows={canDeleteRows}
												isColumnHidden={isColumnHidden}
												isCellDirty={isCellDirty}
												getStickyProps={getStickyProps}
												onToggleAccordion={toggleAccordionRow}
												onDelete={handleDelete}
												onClearCell={handleClearCell}
												onRestoreCell={handleRestoreCell}
												onCopyCell={handleCopyCell}
												onCopyColumn={handleCopyColumn}
												onCopyRow={handleCopyRow}
											/>
										);
									})}
									{paddingBottom > 0 && (
										<tr>
											<td
												colSpan={visibleDataColumnCount + (showActionsColumn ? 1 : 0)}
												style={{ height: `${paddingBottom}px` }}
											/>
										</tr>
									)}
								</>
							) : (
								// Non-virtualized rendering for small datasets
								tableRows.map((row, rowIndex) => {
									const rowId = row.original.id;
									const { dirty: rowIsDirty, cells: dirtyCells } = getRowDirtyState(rowId);
									// Create a stable string key of dirty cell IDs for memoization
									const dirtyCellIds = dirtyCells.map(c => c.id).sort().join(',');
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
											rowColorInfo={rowColorInfo}
											rowOverlayBadges={rowOverlayBadges}
											FieldComponent={FieldComponent}
											tableReadOnly={isReadOnly}
											highlightQuery={highlightQuery}
											editMode={editMode}
											activeCell={activeCell}
											setActiveCell={setActiveCell}
											hasInitialSnapshot={hasInitialRow(rowId)}
											accordionRowConfig={accordionRowConfig}
											accordionAlwaysOpen={accordionAlwaysOpen}
											isExpanded={isRowExpanded(rowId)}
											isRowDirty={rowIsDirty}
											dirtyCellIds={dirtyCellIds}
											hiddenColumnIdsKey={hiddenColumnIdsKey}
											showActionsColumn={showActionsColumn}
											canDeleteRows={canDeleteRows}
											isColumnHidden={isColumnHidden}
											isCellDirty={isCellDirty}
											getStickyProps={getStickyProps}
											onToggleAccordion={toggleAccordionRow}
											onDelete={handleDelete}
											onClearCell={handleClearCell}
											onRestoreCell={handleRestoreCell}
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

	return (
		<div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground px-3 pb-4">
			{hideFooterPaginationSummary ? (
				(isLoading || filters.activeCount > 0) && (
					<div className="flex items-center gap-4 text-foreground">
						{isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
						{filters.activeCount > 0 && (
							<p className="text-xs text-muted-foreground">
								Filtros activos: <span className="font-medium text-foreground">{filters.activeCount}</span>
							</p>
						)}
					</div>
				)
			) : (
				<div className="flex items-center gap-2 text-foreground">
					<span>Filas por página</span>
					{pageSizeLocked ? (
						<span className="font-medium text-foreground">{pageSize}</span>
					) : (
						<Select
							value={String(pageSize)}
							onValueChange={(value) => {
								setPageSize(Number(value));
							}}
							disabled={isLoading}
						>
							<SelectTrigger className={cn("h-9 w-[90px] rounded-lg border-[#e8e8e8] bg-white", isLoading && "opacity-50")}>
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
					{isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
					<div className="flex flex-wrap items-center justify-between gap-3">
						{totalRowCount > 0 && (
							<div className="flex items-center text-sm text-muted-foreground gap-4">
								<p>
									Mostrando <span className="font-medium text-foreground">{visibleRowCount}</span> de{" "}
									<span className="font-medium text-foreground">{totalRowCount}</span> filas
								</p>
								{filters.activeCount > 0 && (
									<p className="text-xs">
										Filtros activos: <span className="font-medium text-foreground">{filters.activeCount}</span>
									</p>
								)}
							</div>
						)}
					</div>
				</div>
			)}
			<div className="flex items-center gap-2">
				{config.footerActions}
				{allowAddRows && (
					<Button type="button" variant="outline" onClick={actions.addRow} data-testid="form-table-add-row">
						Agregar fila vacía
					</Button>
				)}
				{canSave && meta.hasUnsavedChanges && (
					<Button
						type="button"
						onClick={actions.discard}
						disabled={!meta.hasUnsavedChanges || meta.isSaving}
						variant="destructiveSecondary"
						data-testid="form-table-discard"

					>
						Descartar cambios
					</Button>
				)}
				{canSave ? (
					<Button
						type="button"
						onClick={actions.save}
						disabled={!meta.hasUnsavedChanges || meta.isSaving}
						data-testid="form-table-save"

						className="gap-2"
					>
						{meta.isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
						{meta.isSaving ? "Guardando..." : "Guardar cambios"}
					</Button>
				) : null}
			</div>
			<div className="flex items-center gap-2">
				{/* <Button
					type="button"
					variant="outline"
					onClick={() => startTransition(() => setPage(1))}
					disabled={page <= 1 || isLoading}
					className="gap-1"
				>
					<ChevronsLeft className="h-4 w-4" />
					Primera
				</Button> */}
				<Button
					type="button"
					variant="default"

					onClick={() => startTransition(() => setPage((prev) => Math.max(1, prev - 1)))}
					disabled={!hasPreviousPage || isLoading}
					className="gap-1"
				>
					<ChevronLeft className="h-4 w-4" />
					Anterior
				</Button>
				<span className="min-w-[120px] text-center text-xs text-muted-foreground">
					Página {page} de {totalPages}
				</span>
				<Button
					type="button"
					variant="default"

					onClick={() => startTransition(() => setPage((prev) => prev + 1))}
					disabled={!hasNextPage || isLoading}
					className="gap-1"
				>
					Siguiente
					<ChevronRight className="h-4 w-4" />
				</Button>
				{/* <Button
					type="button"
					variant="outline"
					onClick={() => startTransition(() => setPage(totalPages))}
					disabled={page >= totalPages || isLoading}
					className="gap-1"
				>
					Ultima
					<ChevronsRight className="h-4 w-4" />
				</Button> */}
			</div>
		</div>
	);
}

import { computeCellDirty, computeRowDirty, hasUnsavedChanges as hasUnsavedChangesUtil } from "./dirty-tracking";
import {
	readPersistedArray,
	readPersistedNumber,
	writePersistedArray,
	writePersistedNumber,
} from "./persistence";

export { requiredValidator } from "./table-utils";


type TableActivityKind = "loading" | "sorting" | "search" | "filter" | "pagination";

const DEFAULT_COL_WIDTH = 160;
const PAGE_SIZE_OPTIONS = [5, 10, 20, 50];
const DEFAULT_PAGE_SIZE = 10;
const SLOW_OPERATION_MS = 1200;

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

function hasSameRowIdentity<Row extends FormTableRow>(
	nextRows: Row[] | undefined,
	currentOrder: string[],
) {
	if (!Array.isArray(nextRows)) return currentOrder.length === 0;
	if (nextRows.length !== currentOrder.length) return false;
	return nextRows.every((row, index) => row.id === currentOrder[index]);
}

// cell renderers moved to components/form-table/cell-renderers.tsx

type FormTableProps<Row extends FormTableRow, Filters> = {
	config: FormTableConfig<Row, Filters>;
	className?: string;
	innerClassName?: string;
	searchQuery?: string;
	onSearchQueryChange?: (value: string) => void;
	variant?: "page" | "embedded";
	children?: ReactNode;
};

export function FormTable<Row extends FormTableRow, Filters>({
	config,
	className,
	innerClassName,
	searchQuery,
	onSearchQueryChange,
	variant = "page",
	children,
}: FormTableProps<Row, Filters>) {
	const TABLE_ID = config.tableId;
	const isDev = process.env.NODE_ENV !== "production";
	const [externalRefreshVersion, setExternalRefreshVersion] = useState(0);
	const enableColumnResizing = config.enableColumnResizing ?? false;
	const fetchRowsFn = config.fetchRows ?? null;
	const useServerDataMode = config.serverSideData === true && Boolean(fetchRowsFn);
	const isEmbedded = variant === "embedded";
	const isReadOnly = config.readOnly === true;
	const initialSnapshot = useMemo(
		() => buildFormSnapshot(config.defaultRows),
		[config.defaultRows]
	);
	const [activeCell, setActiveCell] = useState<{ rowId: string; columnId: string } | null>(null);

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
			initialValuesRef.current = snapshotValues(nextOrder, nextMap);
		},
		[form]
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
	const paginationOptions = lockedPageSize ? [lockedPageSize] : pageSizeOptions;
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
	const searchPlaceholder = config.searchPlaceholder ?? "Buscar...";
	const showInlineSearch = config.showInlineSearch !== false;
	const hasFilters = typeof config.createFilters === "function";

	const [internalSearchValue, setInternalSearchValue] = useState("");
	const searchValue = typeof searchQuery === "string" ? searchQuery : internalSearchValue;
	const handleSearchInputChange = useCallback(
		(value: string) => {
			if (value === searchValue) return;
			markActivityStart("search");
			startSearchTransition(() => {
				if (typeof searchQuery === "string") {
					onSearchQueryChange?.(value);
				} else {
					setInternalSearchValue(value);
				}
			});
		},
		[markActivityStart, onSearchQueryChange, searchQuery, searchValue, startSearchTransition]
	);
	const deferredSearchValue = useDeferredValue(searchValue);
	const searchRequestKey = deferredSearchValue.trim();
	const isSearchInputLag = searchValue.trim() !== searchRequestKey;
	const searchRef = useRef(searchRequestKey);
	useEffect(() => {
		searchRef.current = searchRequestKey;
	}, [searchRequestKey]);
	const [activeTab, setActiveTab] = useState<string | null>(tabFilters[0]?.id ?? null);
	useEffect(() => {
		setActiveTab((current) => {
			if (current && tabFilters.some((tab) => tab.id === current)) {
				return current;
			}
			return tabFilters[0]?.id ?? null;
		});
	}, [tabFilters]);
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

	const hasInitialRow = useCallback(
		(rowId: string) => Boolean(initialValuesRef.current.rowsById[rowId]),
		[]
	);

	const rows = useMemo(() => {
		return rowOrder.map((id) => rowsById[id]).filter((row): row is Row => Boolean(row));
	}, [rowOrder, rowsById]);

	useEffect(() => {
		if (initialValuesRef.current.rowOrder.length === 0 && rowOrder.length > 0) {
			initialValuesRef.current = snapshotValues(rowOrder, rowsById);
		}
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

	const serverRequestIdentity = `${searchRequestKey}::${appliedFiltersKey}::${activeTab ?? "all"}::${sortState.columnId ?? "none"}::${sortState.direction}`;
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
			setActiveCell(null);
		}
	}, [activeCell, rowOrder]);

	useEffect(() => {
		if (!fetchRowsFn) return;
		if (
			Array.isArray(defaultRows) &&
			!hydratedServerRowsRef.current &&
			page === 1 &&
			searchRequestKey.length === 0 &&
			!fetchAfterDefaultRows
		) {
			hydratedServerRowsRef.current = true;
			return;
		}
		let isMounted = true;
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
				if (!isMounted) return;
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
				if (!isMounted) return;
				console.error("Error fetching rows", error);
				setServerError(
					error instanceof Error ? error.message : "No se pudo obtener la página solicitada"
				);
			} finally {
				if (isMounted) {
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
	]);

	useEffect(() => {
		if (fetchRowsFn) return;
		if (Array.isArray(defaultRows)) {
			const hasLocalChanges = hasUnsavedChangesUtil(
				rowOrder,
				initialValuesRef.current.rowOrder,
				rowsById,
				columns,
				initialValuesRef.current.rowsById
			);
			if (hasLocalChanges) return;
			if (hasSameRowIdentity(defaultRows, rowOrder)) return;
			setFormRows(defaultRows);
		}
	}, [fetchRowsFn, defaultRows, rowOrder, rowsById, columns, setFormRows]);

	const isCellDirty = useCallback(
		(rowId: string, column: ColumnDef<Row>) =>
			computeCellDirty(rowId, column, rowsById, initialValuesRef.current.rowsById),
		[rowsById]
	);

	const getRowDirtyState = useCallback(
		(rowId: string) =>
			computeRowDirty(rowId, rowsById, columns, initialValuesRef.current.rowsById),
		[rowsById, columns]
	);

	const hasUnsavedChanges = hasUnsavedChangesUtil(
		rowOrder,
		initialValuesRef.current.rowOrder,
		rowsById,
		columns,
		initialValuesRef.current.rowsById
	);

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
		setHiddenColumnIds(readPersistedArray(`${TABLE_ID}:hidden`));
		setPinnedColumnIds(readPersistedArray(`${TABLE_ID}:pinned`));
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

	const normalizedSearch = deferredSearchValue.trim().toLowerCase();
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
	}, [hiddenColumnIds]);

	// Persist pinned columns
	useEffect(() => {
		writePersistedArray(`${TABLE_ID}:pinned`, pinnedColumnIds);
	}, [pinnedColumnIds]);

	// Clean up and sort pinned columns
	useEffect(() => {
		setPinnedColumnIds((prev) => {
			const next = prev.filter((id) => pinnableColumns.has(id));
			next.sort((a, b) => {
				const indexA = columnIndexMap[a] ?? Number.MAX_SAFE_INTEGER;
				const indexB = columnIndexMap[b] ?? Number.MAX_SAFE_INTEGER;
				return indexA - indexB;
			});
			return next;
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
			const colEl = colRefs.current[colIndex];
			const width = colEl?.getBoundingClientRect().width || colWidths[colIndex] || DEFAULT_COL_WIDTH;
			offsets[columnId] = accumulator;
			accumulator += width;
		});
		setColumnOffsets(offsets);
	}, [pinnedColumnIds, isColumnHidden, columnIndexMap, colWidths]);

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

	useEffect(() => {
		if (!enableColumnResizing) return;
		const handleColumnResize: EventListener = () => {
			recalcPinnedOffsets();
		};
		return attachColumnResizeListener(handleColumnResize);
	}, [attachColumnResizeListener, recalcPinnedOffsets, enableColumnResizing]);

	useEffect(() => {
		if (!enableColumnResizing) return;
		const handler: EventListener = (event) => {
			const detail = (event as CustomEvent)?.detail as {
				tableId?: string;
				colIndex?: number;
				newWidth?: number;
			};
			if (!detail || detail.tableId !== TABLE_ID) return;
			const { colIndex, newWidth } = detail;
			if (typeof colIndex !== "number" || typeof newWidth !== "number") return;
			setColWidths((prev) => {
				if (prev[colIndex] === newWidth) return prev;
				return { ...prev, [colIndex]: newWidth };
			});
		};
		return attachColumnResizeListener(handler);
	}, [TABLE_ID, attachColumnResizeListener, enableColumnResizing]);

	const getStickyProps = useCallback(
		(columnId: string, baseClassName?: string) => {
			const offset = columnOffsets[columnId];
			const pinned = isColumnPinned(columnId);
			return {
				className: cn(
					baseClassName,
					pinned && offset !== undefined ? "sticky z-20 outline outline-orange-primary/60" : ""
				),
				style: {
					left: pinned && offset !== undefined ? `${offset}px` : undefined,
				},
			};
		},
		[columnOffsets, isColumnHidden, isColumnPinned]
	);

	const hiddenIndices = useMemo(
		() =>
			hiddenColumnIds
				.filter((columnId) => hideableColumns.has(columnId))
				.map((columnId) => columnIndexMap[columnId])
				.filter((value): value is number => typeof value === "number"),
		[hiddenColumnIds, hideableColumns, columnIndexMap]
	);

	const handleBalanceColumns = useCallback(() => {
		balanceTableColumns(TABLE_ID, {
			hiddenCols: hiddenIndices,
			minVisibleWidth: 100,
		});
	}, [hiddenIndices]);

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


	const toggleSort = useCallback((columnId: string) => {
		if (lockedSort) return;
		setActiveCell(null);
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
	}, [TABLE_ID, activityRunId, effectiveSortState, isDev, lockedSort, markActivityStart, setActiveCell, startSortTransition]);

	const applySortDirection = useCallback((columnId: string, direction: "asc" | "desc") => {
		if (lockedSort) return;
		setActiveCell(null);
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
	}, [TABLE_ID, activityRunId, effectiveSortState, isDev, lockedSort, markActivityStart, setActiveCell, startSortTransition]);

	const clearSort = useCallback(() => {
		if (lockedSort) return;
		setActiveCell(null);
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
	}, [TABLE_ID, activityRunId, effectiveSortState, isDev, lockedSort, markActivityStart, setActiveCell, startSortTransition]);

	const clientTotalPages = useMemo(() => {
		if (sortedRows.length === 0) return 1;
		return Math.max(1, Math.ceil(sortedRows.length / pageSize));
	}, [sortedRows.length, pageSize]);

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
		if (useServerDataMode) {
			return sortedRows;
		}
		// Client-side pagination when no fetchRowsFn OR when server returned all rows at once
		if (!fetchRowsFn || serverReturnedAllRows) {
			const start = (page - 1) * pageSize;
			return sortedRows.slice(start, start + pageSize);
		}
		return sortedRows;
	}, [page, pageSize, sortedRows, fetchRowsFn, serverReturnedAllRows, useServerDataMode]);

	const processedRowsRef = useRef<Row[]>(processedRows);
	useEffect(() => {
		processedRowsRef.current = processedRows;
	}, [processedRows]);

	// Use client pagination values when server returned all rows at once
	const useClientPaginationValues = !useServerDataMode && (useClientPagination || serverReturnedAllRows);

	const datasetTotalCount = useClientPaginationValues
		? sortedRows.length
		: serverMeta.total || sortedRows.length;

	const totalPages = useClientPaginationValues
		? clientTotalPages
		: serverMeta.totalPages || 1;

	const hasNextPage = useClientPaginationValues
		? page < clientTotalPages
		: serverMeta.hasNextPage;
	const hasPreviousPage = useClientPaginationValues
		? page > 1
		: serverMeta.hasPreviousPage;

	const totalRowCount = datasetTotalCount;
	const visibleRowCount = processedRows.length;

	const FieldComponent = form.Field as FormFieldComponent<Row>;
	const editMode = config.editMode ?? "always";
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
			setHiddenColumnIds(hidden);
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
			if (searchValue.trim().length > 0) {
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
		searchValue,
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
		const exportColumns = columns.filter((column) => !isColumnHidden(column.id));
		if (exportColumns.length === 0) {
			toast.error("No hay columnas visibles para exportar");
			return;
		}
		if (sortedRows.length === 0) {
			toast.error("No hay filas para exportar");
			return;
		}
		const separator = ";";
		const header = exportColumns
			.map((column) => `"${column.label.replace(/"/g, '""')}"`)
			.join(separator);
		const body = sortedRows.map((row) => tableRowToCsv(row, exportColumns)).join("\n");
		const csv = `\uFEFF${header}\n${body}`;
		const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = `${TABLE_ID}.csv`;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
		toast.success("Tabla exportada");
	}, [TABLE_ID, columns, isColumnHidden, sortedRows]);

	const handleSave = useCallback(async () => {
		if (isReadOnly) return;
		if (!hasUnsavedChanges) return;
		setIsSaving(true);
		setServerError(null);
		try {
			if (config.onSave) {
				const dirtyRows = rows.filter((row) =>
					computeRowDirty(row.id, rowsById, columns, initialValuesRef.current.rowsById).dirty
				);
				const deletedRowIds = initialValuesRef.current.rowOrder.filter(
					(initialId) => !rowOrder.includes(initialId)
				);
				await config.onSave({ rows, dirtyRows, deletedRowIds });
			} else {
				await new Promise((resolve) => setTimeout(resolve, 900));
			}
			initialValuesRef.current = snapshotValues(rowOrder, rowsById);
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
	}, [columns, config, hasUnsavedChanges, isReadOnly, rowOrder, rows, rowsById]);

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
		toast.info("Cambios descartados");
	}, [hasUnsavedChanges, isReadOnly, setFormFieldValue]);

	const contextValue: FormTableContextValue<Row, Filters> = {
		config,
		tableId: TABLE_ID,
		search: {
			value: searchValue,
			placeholder: searchPlaceholder,
			showInline: showInlineSearch,
			isProcessing: isSearchProcessing,
			onChange: handleSearchInputChange,
		},
		filters: {
			enabled: hasFilters,
			value: filters,
			draft: filtersDraft,
			setDraft: (updater) => setFiltersDraft((prev) => updater(prev)),
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
			handleCopyCell,
			handleCopyColumn,
			handleCopyRow,
			visibleDataColumnCount,
		},
		actions: {
			save: handleSave,
			discard: handleDiscardChanges,
			addRow: handleAddRow,
			exportCsv: handleExportCsv,
		},
	};

	const content = (
		<div
			className="space-y-4 max-w-full overflow-hidden pt-6 flex flex-col h-full gap-4"
		>
			{(config.title || config.description) ? (
				<div>
					{config.title ? <h1 className="text-xl font-bold mt-2">{config.title}</h1> : null}
					{config.description && (
						<p className="text-muted-foreground">{config.description}</p>
					)}
				</div>
			) : null}
			{(config.showToolbar ?? true) ? <FormTableToolbar /> : null}
			<FormTableTabs />
			<div className="flex-1 shadow-card mx-[1px] flex">
				<FormTableContent className={className} innerClassName={innerClassName} />
			</div>
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
