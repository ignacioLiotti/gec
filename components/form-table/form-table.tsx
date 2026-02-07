'use client';

import { useState, useCallback, useEffect, useMemo, useRef, useTransition, startTransition } from "react";
import type { ReactNode } from "react";
import { useForm, useStore } from "@tanstack/react-form";
import {
	useReactTable,
	getCoreRowModel,
	ColumnDef as TanStackColumnDef,
	VisibilityState,
} from "@tanstack/react-table";
// Virtualization disabled - was causing scroll re-renders
// import { useVirtualizer } from "@tanstack/react-virtual";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
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
	Search as SearchIcon,
	ArrowUp,
	ArrowDown,
	ArrowUpDown,
	Minus,
	Loader2,
	ChevronLeft,
	ChevronRight,
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
	const { config, search, filters, columns, sorting } = useFormTable<FormTableRow, unknown>();
	const [isFiltersOpen, setIsFiltersOpen] = useState(false);

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

	return (
		<div className="flex flex-wrap items-center justify-between gap-3">
			<div className="flex flex-wrap items-center gap-2">
				{search.showInline && (
					<div className="relative">
						<SearchIcon className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
						<Input
							className="w-64 pl-8"
							value={search.value}
							onChange={(event) => search.onChange(event.target.value)}
							placeholder={search.placeholder}
						/>
					</div>
				)}
				{filters.enabled && typeof filters.value !== "undefined" && (
					<Sheet open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
						<SheetTrigger asChild>
							<Button
								type="button"
								variant={filters.activeCount > 0 ? "default" : "outline"}
								size="sm"
								className={cn(
									"gap-2 transition-all",
									filters.activeCount > 0 && "shadow-sm"
								)}
							>
								<Filter className="h-4 w-4" />
								<span>Filtros</span>
								{filters.activeCount > 0 && (
									<span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-foreground/20 px-1.5 text-[10px] font-semibold">
										{filters.activeCount}
									</span>
								)}
							</Button>
						</SheetTrigger>
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
										size="sm"
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
										size="sm"
										className="px-6 shadow-sm"
									>
										Aplicar
									</Button>
								</div>
							</div>
						</SheetContent>
					</Sheet>
				)}
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
				/>
				{config.toolbarActions}
			</div>
			<div className="flex flex-wrap items-center gap-2">
				{sorting.state.columnId && (
					<Button type="button" variant="ghost" size="sm" className="gap-1" onClick={sorting.clear}>
						<Minus className="h-4 w-4" />
						Limpiar orden
					</Button>
				)}
			</div>
		</div>
	);
}

export function FormTableTabs({ className }: { className?: string }) {
	const { tabs } = useFormTable<FormTableRow, unknown>();
	if (!tabs.enabled || tabs.items.length === 0) {
		return null;
	}

	return (
		<Tabs
			value={tabs.activeTab ?? tabs.items[0]?.id ?? ""}
			onValueChange={tabs.setActiveTab}
		>
			<TabsList className={cn("w-full max-w-full overflow-hidden flex-1 flex-grow gap-1", className)}>
				{tabs.items.map((tab) => (
					<TabsTrigger
						key={tab.id}
						value={tab.id}

						className="group gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground  data-[state=active]:shadow-none rounded-md"
					>
						<span>{tab.label}</span>
						<span className="rounded-full bg-muted px-2 py-0.5 text-xs group-data-[state=active]:bg-white/20 group-data-[state=active]:text-white group-hover:bg-white/20 group-hover:text-white">
							{tabs.counts[tab.id] ?? 0}
						</span>
					</TabsTrigger>
				))}
			</TabsList>
		</Tabs>
	);
}

export function FormTableContent({ className }: { className?: string }) {
	const {
		tableId,
		config,
		columns,
		rows,
		meta,
		pagination,
		sorting,
	} = useFormTable<FormTableRow, unknown>();

	const columnDefs = columns.list;
	const { tableRef, colRefs, colWidths, isColumnHidden, getStickyProps, columnIndexMap, columnsById, groupedColumnLookup, enableResizing } = columns;
	const {
		table,
		FieldComponent,
		highlightQuery,
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
	const showActionsColumn = config.showActionsColumn !== false;
	const { serverError } = meta;
	const { isServerPaging, isFetching } = pagination;
	const headerGroups = config.headerGroups ?? [];
	const {
		state: sortState,
		toggle: toggleSort,
		applyDirection,
		clear: clearSort,
	} = sorting;
	const scrollParentRef = useRef<HTMLDivElement | null>(null);
	const tableRows = table.getRowModel().rows;

	// Virtualization disabled for now - was causing scroll re-renders
	// TODO: Re-enable with proper isolation when needed for very large datasets
	const shouldVirtualize = false;
	const virtualRows: { index: number; start: number; end: number }[] = [];
	const paddingTop = 0;
	const paddingBottom = 0;

	return (
		<>
			{isServerPaging && serverError && (
				<div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
					{serverError}
				</div>
			)}
			<div className={cn("relative border border-border rounded-none overflow-x-auto w-full bg-white", className)}>
				{isServerPaging && isFetching && (
					<div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-background/70 backdrop-blur-sm">
						<Loader2 className="h-6 w-6 animate-spin text-primary" />
						<p className="text-sm font-medium text-muted-foreground">Sincronizando con el servidor…</p>
					</div>
				)}
				<div
					ref={scrollParentRef}
					className="max-h-[70vh] overflow-auto bg-[repeating-linear-gradient(-60deg,transparent_0%,transparent_5px,var(--border)_5px,var(--border)_6px,transparent_6px)] bg-repeat">
					<table ref={tableRef} data-table-id={tableId} className="w-full table-fixed text-sm max-w-full overflow-hidden">
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
									ref={(el) => {
										colRefs.current[columnDefs.length] = el;
									}}
									style={{
										width: `${colWidths[columnDefs.length] ?? 140}px`,
									}}
								/>
							)}
						</colgroup>
						<thead className="sticky top-0 z-30 bg-sidebar">
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
																"relative px-4 py-4 text-left text-xs font-semibold uppercase outline outline-border bg-sidebar"
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
																				<span>{column.label}</span>
																				<span className="text-muted-foreground flex items-center gap-2">
																					{sortState.columnId === column.id ? (
																						<>
																							{pagination.isFetching && (
																								<span className="relative inline-flex h-4 w-4 items-center justify-center">
																									<span className="absolute h-1 w-1 rounded-full bg-current animate-[pulse_1s_ease-in-out_infinite]" style={{ left: 2, top: 2, animationDelay: "0ms" }} />
																									<span className="absolute h-1 w-1 rounded-full bg-current animate-[pulse_1s_ease-in-out_infinite]" style={{ right: 2, top: 2, animationDelay: "120ms" }} />
																									<span className="absolute h-1 w-1 rounded-full bg-current animate-[pulse_1s_ease-in-out_infinite]" style={{ left: 2, bottom: 2, animationDelay: "240ms" }} />
																									<span className="absolute h-1 w-1 rounded-full bg-current animate-[pulse_1s_ease-in-out_infinite]" style={{ right: 2, bottom: 2, animationDelay: "360ms" }} />
																								</span>
																							)}
																							{sortState.direction === "asc" ? (
																								<ArrowUp className="h-3.5 w-3.5" />
																							) : (
																								<ArrowDown className="h-3.5 w-3.5" />
																							)}
																						</>
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
															"px-4 py-2 text-center text-xs font-semibold uppercase outline outline-border bg-sidebar-accent",
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
													className="relative px-4 py-4 text-right text-xs font-semibold uppercase outline outline-border bg-sidebar"
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
										"relative px-4 py-4 text-left text-xs font-semibold uppercase outline outline-border bg-sidebar"
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
												<ColumnResizer tableId={tableId} colIndex={colIndex} mode="fixed" />
											)}
										</th>
									);
								})}
							</tr>
						</thead>
						<tbody className="bg-white">
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
												columnsById={columnsById}
												FieldComponent={FieldComponent}
												highlightQuery={highlightQuery}
												hasInitialSnapshot={hasInitialRow(rowId)}
												hasAccordionRows={hasAccordionRows}
												accordionRowConfig={accordionRowConfig}
												accordionAlwaysOpen={accordionAlwaysOpen}
												isExpanded={isRowExpanded(rowId)}
												isRowDirty={rowIsDirty}
												dirtyCellIds={dirtyCellIds}
												showActionsColumn={showActionsColumn}
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
											columnsById={columnsById}
											FieldComponent={FieldComponent}
											highlightQuery={highlightQuery}
											hasInitialSnapshot={hasInitialRow(rowId)}
											hasAccordionRows={hasAccordionRows}
											accordionRowConfig={accordionRowConfig}
											accordionAlwaysOpen={accordionAlwaysOpen}
											isExpanded={isRowExpanded(rowId)}
											isRowDirty={rowIsDirty}
											dirtyCellIds={dirtyCellIds}
											showActionsColumn={showActionsColumn}
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
		isServerPaging,
		isFetching,
		isTransitioning,
	} = pagination;
	const pageSizeLocked = typeof lockedPageSize === "number";
	const allowAddRows = config.allowAddRows !== false;
	const isLoading = isFetching || isTransitioning;

	return (
		<>
			<div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
				<div className="flex items-center gap-2">
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
							<SelectTrigger className={cn("w-[90px]", isLoading && "opacity-50")}>
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
				</div>
				<div className="flex items-center gap-2">
					{config.footerActions}
					{allowAddRows && (
						<Button type="button" variant="outline" size="sm" onClick={actions.addRow}>
							Agregar fila vacía
						</Button>
					)}
					{meta.hasUnsavedChanges && (
						<Button
							type="button"
							onClick={actions.discard}
							disabled={!meta.hasUnsavedChanges || meta.isSaving}
							variant="destructiveSecondary"
							size="sm"
						>
							Descartar cambios
						</Button>
					)}
					<Button
						type="button"
						onClick={actions.save}
						disabled={!meta.hasUnsavedChanges || meta.isSaving}
						size="sm"
						className="gap-2"
					>
						{meta.isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
						{meta.isSaving ? "Guardando..." : "Guardar cambios"}
					</Button>
				</div>
				<div className="flex items-center gap-2">
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => startTransition(() => setPage((prev) => Math.max(1, prev - 1)))}
						disabled={!hasPreviousPage || isLoading}
						className="gap-1"
					>
						<ChevronLeft className="h-4 w-4" />
						Anterior
					</Button>
					<span className="text-xs text-muted-foreground">
						Página {page} de {totalPages}
					</span>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => startTransition(() => setPage((prev) => prev + 1))}
						disabled={!hasNextPage || isLoading}
						className="gap-1"
					>
						Siguiente
						<ChevronRight className="h-4 w-4" />
					</Button>
				</div>
			</div>

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
		</>
	);
}

import { computeCellDirty, computeRowDirty, hasUnsavedChanges as hasUnsavedChangesUtil } from "./dirty-tracking";
import { readPersistedArray, writePersistedArray } from "./persistence";

export { requiredValidator } from "./table-utils";


const DEFAULT_COL_WIDTH = 160;
const PAGE_SIZE_OPTIONS = [5, 10, 20, 50];
const DEFAULT_PAGE_SIZE = 10;

// cell renderers moved to components/form-table/cell-renderers.tsx

type FormTableProps<Row extends FormTableRow, Filters> = {
	config: FormTableConfig<Row, Filters>;
	className?: string;
	searchQuery?: string;
	onSearchQueryChange?: (value: string) => void;
	variant?: "page" | "embedded";
	children?: ReactNode;
};

export function FormTable<Row extends FormTableRow, Filters>({
	config,
	className,
	searchQuery,
	onSearchQueryChange,
	variant = "page",
	children,
}: FormTableProps<Row, Filters>) {
	const TABLE_ID = config.tableId;
	const enableColumnResizing = config.enableColumnResizing ?? false;
	const fetchRowsFn = config.fetchRows ?? null;
	const isEmbedded = variant === "embedded";

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
			rowOrder: [],
			rowsById: {},
		},
	});
	const setFormFieldValue = form.setFieldValue as (path: string, updater: any) => void;
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
	const initialPageSize = config.defaultPageSize ?? DEFAULT_PAGE_SIZE;
	const pageSizeOptions = config.pageSizeOptions ?? PAGE_SIZE_OPTIONS;
	const lockedPageSize = config.lockedPageSize;
	const [pageSize, setPageSizeState] = useState(initialPageSize);
	useEffect(() => {
		if (lockedPageSize && pageSize !== lockedPageSize) {
			setPageSizeState(lockedPageSize);
		}
	}, [lockedPageSize, pageSize]);
	const paginationOptions = lockedPageSize ? [lockedPageSize] : pageSizeOptions;
	// Track if a page size change is in progress (for showing loading state)
	const [isPageSizeTransitioning, startPageSizeTransition] = useTransition();
	const handleSetPageSize = useCallback((size: number) => {
		if (lockedPageSize) return;
		// Use startTransition to make the re-render non-blocking
		startPageSizeTransition(() => {
			setPageSizeState(size);
			setPage(1);
		});
		if (fetchRowsFn) {
			void fetchRowsFn({ page: 1, limit: size, filters: filtersRef.current as Filters, search: searchRef.current }).then((result) => {
				const fetchedRows = result.rows ?? [];
				startTransition(() => {
					setFormRows(fetchedRows as Row[]);
					setServerMeta((prev) => ({
						page: 1,
						limit: size,
						total: result.pagination?.total ?? prev.total,
						totalPages: result.pagination?.totalPages ?? prev.totalPages,
						hasNextPage: result.pagination?.hasNextPage ?? prev.hasNextPage,
						hasPreviousPage: result.pagination?.hasPreviousPage ?? prev.hasPreviousPage,
					}));
				});
				setIsFetchingServerRows(false);
			});
		}
	}, [lockedPageSize, fetchRowsFn, setFormRows]);
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
	const initialValuesRef = useRef<FormValues<Row>>({ rowOrder: [], rowsById: {} });
	const columns = config.columns;
	const headerGroups = config.headerGroups ?? [];
	const defaultRows = config.defaultRows;

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
			if (typeof searchQuery === "string") {
				onSearchQueryChange?.(value);
			} else {
				setInternalSearchValue(value);
			}
		},
		[onSearchQueryChange, searchQuery]
	);
	const searchRef = useRef(searchValue.trim());
	useEffect(() => {
		searchRef.current = searchValue.trim();
	}, [searchValue]);
	const [activeTab, setActiveTab] = useState<string | null>(tabFilters[0]?.id ?? null);
	useEffect(() => {
		setActiveTab(tabFilters[0]?.id ?? null);
	}, [tabFilters]);
	const createFiltersRef = useRef(config.createFilters);
	createFiltersRef.current = config.createFilters;
	const [filters, setFilters] = useState<Filters | undefined>(() => config.createFilters?.());
	const [filtersDraft, setFiltersDraft] = useState<Filters | undefined>(() => config.createFilters?.());
	const filtersRef = useRef<Filters | undefined>(filters);
	useEffect(() => {
		filtersRef.current = filters;
	}, [filters]);
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
	const [sortState, setSortState] = useState<SortState>({ columnId: null, direction: "asc" });
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

	useEffect(() => {
		if (!fetchRowsFn) return;
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
	}, [fetchRowsFn, page, pageSize, setFormRows]);

	useEffect(() => {
		if (fetchRowsFn) return;
		if (defaultRows) {
			setFormRows(defaultRows);
		}
	}, [fetchRowsFn, defaultRows, setFormRows]);

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

	const hasUnsavedChanges = useMemo(
		() => hasUnsavedChangesUtil(rowOrder, rowsById, columns, initialValuesRef.current.rowsById),
		[rowOrder, rowsById, columns]
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
	const [hiddenColumnIds, setHiddenColumnIds] = useState<string[]>(() =>
		readPersistedArray(`${TABLE_ID}:hidden`)
	);
	const [pinnedColumnIds, setPinnedColumnIds] = useState<string[]>(() =>
		readPersistedArray(`${TABLE_ID}:pinned`)
	);
	const [columnOffsets, setColumnOffsets] = useState<Record<string, number>>({});
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

	const normalizedSearch = searchValue.trim().toLowerCase();
	const highlightQuery = normalizedSearch;

	// Combined filtering pipeline - single pass through rows for search + advanced filters
	// Returns both the filtered rows (before tab filter) and tab counts in one computation
	const { baseFilteredRows, tabCounts } = useMemo(() => {
		const applyFilters = config.applyFilters;
		const hasAdvancedFilters = applyFilters && typeof filters !== "undefined";

		// Single pass: apply search + advanced filters together
		const filtered: Row[] = [];
		for (const row of rows) {
			// Search filter
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

			// Advanced filter
			if (hasAdvancedFilters && !applyFilters(row, filters)) continue;

			filtered.push(row);
		}

		// Compute tab counts from the filtered rows (single iteration)
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
	}, [rows, normalizedSearch, columns, config.applyFilters, filters, tabFilters]);

	// Apply tab filter (uses baseFilteredRows from above)
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
		if (!enableClientSort || !sortState.columnId) return tabFilteredRows;
		const column = columns.find((col) => col.id === sortState.columnId);
		if (!column) return tabFilteredRows;
		const comparator = column.sortFn ?? defaultSortByField<Row>(column.field);
		const sorted = [...tabFilteredRows].sort((a, b) => comparator(a, b));
		return sortState.direction === "asc" ? sorted : sorted.reverse();
	}, [tabFilteredRows, sortState, enableClientSort, columns]);

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
		setFilters(filtersDraft);
	}, [filtersDraft, hasFilters]);

	const handleResetAdvancedFilters = useCallback(() => {
		if (!hasFilters) return;
		const initial = createFiltersRef.current?.();
		if (typeof initial === "undefined") return;
		setFilters(initial);
		setFiltersDraft(initial);
	}, [hasFilters]);


	const toggleSort = useCallback((columnId: string) => {
		setSortState((prev) => {
			if (prev.columnId !== columnId) {
				return { columnId, direction: "asc" };
			}
			if (prev.direction === "asc") {
				return { columnId, direction: "desc" };
			}
			return { columnId: null, direction: "asc" };
		});
	}, []);

	const applySortDirection = useCallback((columnId: string, direction: "asc" | "desc") => {
		setSortState({ columnId, direction });
	}, []);

	const clearSort = useCallback(() => {
		setSortState({ columnId: null, direction: "asc" });
	}, []);

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
	const serverReturnedAllRows = fetchRowsFn && sortedRows.length > pageSize && serverMeta.totalPages <= 1;

	const processedRows = useMemo(() => {
		// Client-side pagination when no fetchRowsFn OR when server returned all rows at once
		if (!fetchRowsFn || serverReturnedAllRows) {
			const start = (page - 1) * pageSize;
			return sortedRows.slice(start, start + pageSize);
		}
		return sortedRows;
	}, [page, pageSize, sortedRows, fetchRowsFn, serverReturnedAllRows]);

	const processedRowsRef = useRef<Row[]>(processedRows);
	useEffect(() => {
		processedRowsRef.current = processedRows;
	}, [processedRows]);

	// Use client pagination values when server returned all rows at once
	const useClientPaginationValues = useClientPagination || serverReturnedAllRows;

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
			if (column.editable === false) return;
			const clearedValue = getClearedValue(column);
			setFormFieldValue(`rowsById.${rowId}.${column.field}` as const, () => clearedValue as Row[ColumnField<Row>]);
		},
		[setFormFieldValue]
	);

	const handleRestoreCell = useCallback(
		(rowId: string, column: ColumnDef<Row>) => {
			const initialRow = initialValuesRef.current.rowsById[rowId];
			if (!initialRow) return;
			const initialValue = initialRow[column.field];
			setFormFieldValue(`rowsById.${rowId}.${column.field}` as const, () => initialValue as Row[ColumnField<Row>]);
		},
		[setFormFieldValue]
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
		const newRow = config.createRow ? config.createRow() : createRowFromColumns(columns);
		setFormFieldValue("rowOrder", (prev: string[] = []) => [newRow.id, ...(prev ?? [])]);
		setFormFieldValue("rowsById", (prev: Record<string, Row> = {}) => ({
			...prev,
			[newRow.id]: newRow,
		}));
		setPage(1);
		toast.success("Fila vacía agregada");
	}, [columns, config, setFormFieldValue]);

	const handleDelete = useCallback((id: string) => {
		setFormFieldValue("rowOrder", (prev: string[] = []) => prev.filter((rowId) => rowId !== id));
		setFormFieldValue("rowsById", (prev: Record<string, Row> = {}) => {
			if (!(id in prev)) return prev;
			const next = { ...prev };
			delete next[id];
			return next;
		});
		toast.success("Fila eliminada");
	}, [setFormFieldValue]);

	const handleSave = useCallback(async () => {
		if (!hasUnsavedChanges) return;
		setIsSaving(true);
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
			console.error("Error saving rows", error);
			toast.error("No se pudieron guardar los cambios");
		} finally {
			setIsSaving(false);
		}
	}, [columns, config, hasUnsavedChanges, rowOrder, rows, rowsById]);

	const handleDiscardChanges = useCallback(() => {
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
	}, [hasUnsavedChanges, setFormFieldValue]);

	const contextValue: FormTableContextValue<Row, Filters> = {
		config,
		tableId: TABLE_ID,
		search: {
			value: searchValue,
			placeholder: searchPlaceholder,
			showInline: showInlineSearch,
			onChange: handleSearchInputChange,
		},
		filters: {
			enabled: hasFilters,
			value: filters,
			draft: filtersDraft,
			setDraft: (updater) => setFiltersDraft((prev) => updater(prev)),
			activeCount: activeFilterCount,
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
			state: sortState,
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
		},
		rows: {
			table,
			FieldComponent,
			highlightQuery,
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
		},
	};

	const content = (
		<div
			className="space-y-4 max-w-full overflow-hidden"
		>
			<div>
				<h1 className="text-xl font-bold mt-2">{config.title}</h1>
				{config.description && (
					<p className="text-muted-foreground">{config.description}</p>
				)}
			</div>
			<FormTableToolbar />
			<FormTableTabs />
			<FormTableContent className={className} />
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
