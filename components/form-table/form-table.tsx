'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import type { ReactNode } from "react";
import { useForm, useStore } from "@tanstack/react-form";
import type { AnyFormState } from "@tanstack/form-core";
import {
	useReactTable,
	getCoreRowModel,
	ColumnDef as TanStackColumnDef,
	VisibilityState,
} from "@tanstack/react-table";
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
	const { search, filters, columns, sorting, meta, actions } = useFormTable<FormTableRow, unknown>();

	const renderFiltersContent =
		filters.renderContent ??
		(
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
					<Sheet open={filters.isOpen} onOpenChange={filters.setIsOpen}>
						<SheetTrigger asChild>
							<Button
								type="button"
								variant={filters.activeCount > 0 ? "default" : "outline"}
								size="sm"
								className="gap-2"
							>
								<Filter className="h-4 w-4" />
								<span>Filtros avanzados</span>
								{filters.activeCount > 0 && (
									<Badge variant="secondary" className="ml-1">
										{filters.activeCount}
									</Badge>
								)}
							</Button>
						</SheetTrigger>
						<SheetContent
							side="right"
							className="sm:w-[420px] w-[90vw] my-auto max-h-[96vh] overflow-y-auto px-6 py-7"
						>
							<SheetHeader>
								<SheetTitle>Filtros avanzados</SheetTitle>
							</SheetHeader>
							<div className="mt-6 space-y-5">{renderFiltersContent}</div>
							<SheetFooter className="mt-6 gap-2">
								<Button type="button" variant="outline" onClick={filters.reset}>
									Reiniciar
								</Button>
								<Button type="button" onClick={filters.apply}>
									Aplicar
								</Button>
							</SheetFooter>
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
			</div>
			<div className="flex flex-wrap items-center gap-2">
				{sorting.state.columnId && (
					<Button type="button" variant="ghost" size="sm" className="gap-1" onClick={sorting.clear}>
						<Minus className="h-4 w-4" />
						Limpiar orden
					</Button>
				)}
				<Button
					type="button"
					onClick={actions.save}
					disabled={!meta.hasUnsavedChanges || meta.isSaving}
					variant={meta.hasUnsavedChanges ? "default" : "outline"}
					className="gap-2"
				>
					{meta.isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
					{meta.isSaving ? "Guardando..." : "Guardar cambios"}
				</Button>
				<Button type="button" onClick={actions.addRow}>
					Agregar fila vacía
				</Button>
			</div>
		</div>
	);
}

export function FormTableTabs() {
	const { tabs } = useFormTable<FormTableRow, unknown>();
	if (!tabs.enabled || tabs.items.length === 0) {
		return null;
	}

	return (
		<Tabs
			value={tabs.activeTab ?? tabs.items[0]?.id ?? ""}
			onValueChange={tabs.setActiveTab}
			className="w-full max-w-full overflow-hidden"
		>
			<TabsList>
				{tabs.items.map((tab) => (
					<TabsTrigger key={tab.id} value={tab.id} className="gap-2">
						<span>{tab.label}</span>
						<span className="rounded-full bg-muted px-2 py-0.5 text-xs">
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
	const { tableRef, colRefs, colWidths, isColumnHidden, getStickyProps, columnIndexMap, columnsById, groupedColumnLookup } = columns;
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
	const { serverError } = meta;
	const { isServerPaging, isFetching } = pagination;
	const headerGroups = config.headerGroups ?? [];
	const {
		state: sortState,
		toggle: toggleSort,
		applyDirection,
		clear: clearSort,
	} = sorting;

	return (
		<>
			{isServerPaging && serverError && (
				<div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
					{serverError}
				</div>
			)}
			<div className={cn("relative border border-border rounded-lg overflow-x-auto w-full bg-white", className)}>
				{isServerPaging && isFetching && (
					<div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-background/70 backdrop-blur-sm">
						<Loader2 className="h-6 w-6 animate-spin text-primary" />
						<p className="text-sm font-medium text-muted-foreground">Sincronizando con el servidor…</p>
					</div>
				)}
				<div className="max-h-[70vh] overflow-auto bg-[repeating-linear-gradient(-60deg,transparent_0%,transparent_5px,var(--border)_5px,var(--border)_6px,transparent_6px)] bg-repeat min-h-[70vh]">
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
							<col
								ref={(el) => {
									colRefs.current[columnDefs.length] = el;
								}}
								style={{
									width: `${colWidths[columnDefs.length] ?? 140}px`,
								}}
							/>
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
															</div>
															<ColumnResizer tableId={tableId} colIndex={columnIndexMap[column.id]} mode="fixed" />
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
											<th
												rowSpan={2}
												className="relative px-4 py-4 text-right text-xs font-semibold uppercase outline outline-border bg-sidebar"
											>
												<div className="flex w-full h-full px-4 py-3 absolute top-0 left-0 items-center justify-end gap-2">
													<span>Acciones</span>
												</div>
												<ColumnResizer tableId={tableId} colIndex={columnDefs.length} mode="fixed" />
											</th>
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

									return (
										<th key={column.id} {...getStickyProps(column.id, baseClassName)}>
											<div className="flex w-full h-full px-4 py-3 absolute top-0 left-0 items-center justify-between gap-2">
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
											</div>
											<ColumnResizer tableId={tableId} colIndex={colIndex} mode="fixed" />
										</th>
									);
								})}
							</tr>
						</thead>
						<tbody className="bg-white">
							{table.getRowModel().rows.length === 0 ? (
								<tr>
									<td
										colSpan={visibleDataColumnCount + 1}
										className="px-6 py-12 text-center text-sm text-muted-foreground"
									>
										{config.emptyStateMessage ??
											"No encontramos filas que coincidan con tu búsqueda o filtros. Ajusta los criterios o agrega una nueva fila vacía para comenzar."}
									</td>
								</tr>
							) : (
								table.getRowModel().rows.map((row, rowIndex) => (
									<MemoizedTableRow
										key={row.original.id}
										row={row}
										rowIndex={rowIndex}
										columnsById={columnsById}
										FieldComponent={FieldComponent}
										highlightQuery={highlightQuery}
										hasInitialSnapshot={hasInitialRow(row.original.id)}
										hasAccordionRows={hasAccordionRows}
										accordionRowConfig={accordionRowConfig}
										accordionAlwaysOpen={accordionAlwaysOpen}
										isExpanded={hasAccordionRows ? isRowExpanded(row.original.id) : false}
										getStickyProps={getStickyProps}
										onToggleAccordion={toggleAccordionRow}
										onDelete={handleDelete}
										onClearCell={handleClearCell}
										onRestoreCell={handleRestoreCell}
										onCopyCell={handleCopyCell}
										onCopyColumn={handleCopyColumn}
										onCopyRow={handleCopyRow}
									/>
								))
							)}
						</tbody>
					</table>
				</div>
			</div>
		</>
	);
}

export function FormTablePagination() {
	const { pagination, filters } = useFormTable<FormTableRow, unknown>();
	const {
		page,
		setPage,
		pageSize,
		setPageSize,
		hasNextPage,
		hasPreviousPage,
		totalPages,
		options,
		totalRowCount,
		visibleRowCount,
		isServerPaging,
		isFetching,
	} = pagination;

	return (
		<>
			<div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
				<div className="flex items-center gap-2">
					<span>Filas por página</span>
					<Select
						value={String(pageSize)}
						onValueChange={(value) => {
							setPageSize(Number(value));
						}}
					>
						<SelectTrigger className="w-[90px]">
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
				</div>
				<div className="flex items-center gap-2">
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => setPage((prev) => Math.max(1, prev - 1))}
						disabled={!hasPreviousPage || (isServerPaging && isFetching)}
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
						onClick={() => setPage((prev) => prev + 1)}
						disabled={!hasNextPage || (isServerPaging && isFetching)}
						className="gap-1"
					>
						Siguiente
						<ChevronRight className="h-4 w-4" />
					</Button>
				</div>
			</div>

			{totalRowCount > 0 && (
				<div className="flex justify-between items-center text-sm text-muted-foreground">
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

	const rowOrderSelector = useCallback<(state: AnyFormState) => string[]>(
		(state) => (state.values?.rowOrder as string[]) ?? [],
		[]
	);
	const rowsByIdSelector = useCallback<(state: AnyFormState) => Record<string, Row>>(
		(state) => (state.values?.rowsById as Record<string, Row>) ?? {},
		[]
	);

	const rowOrder = useStore(form.store, rowOrderSelector);
	const rowsById = useStore(form.store, rowsByIdSelector);
	const [isSaving, setIsSaving] = useState(false);
	const [page, setPage] = useState(1);
	const initialPageSize = config.defaultPageSize ?? DEFAULT_PAGE_SIZE;
	const [pageSize, setPageSize] = useState(initialPageSize);
	const [isServerPaging, setIsServerPaging] = useState(Boolean(config.fetchRows));
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
	const fetchRowsFn = config.fetchRows;
	const defaultRows = config.defaultRows;

	useEffect(() => {
		setIsServerPaging(Boolean(fetchRowsFn));
	}, [fetchRowsFn]);
	const defaultTabFilters: TabFilterOption<Row>[] = [{ id: "all", label: "Todas" }];
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
	const [isFiltersOpen, setIsFiltersOpen] = useState(false);
	const createFilters = useCallback(() => config.createFilters?.(), [config]);
	const [filters, setFilters] = useState<Filters | undefined>(() => createFilters());
	const [filtersDraft, setFiltersDraft] = useState<Filters | undefined>(() => createFilters());
	const filtersRef = useRef<Filters | undefined>(filters);
	useEffect(() => {
		filtersRef.current = filters;
	}, [filters]);
	useEffect(() => {
		if (!hasFilters) return;
		const initialFilters = createFilters();
		if (typeof initialFilters === "undefined") return;
		setFilters(initialFilters);
		setFiltersDraft(initialFilters);
	}, [createFilters, hasFilters]);
	useEffect(() => {
		if (!isFiltersOpen || !filters) return;
		setFiltersDraft(filters);
	}, [isFiltersOpen, filters]);
	const [sortState, setSortState] = useState<SortState>({ columnId: null, direction: "asc" });
	const [colWidths, setColWidths] = useState<Record<number, number>>({});
	const colRefs = useRef<(HTMLTableColElement | null)[]>([]);
	const accordionRowConfig = config.accordionRow;
	const hasAccordionRows = Boolean(accordionRowConfig);
	const accordionAlwaysOpen = Boolean(accordionRowConfig?.alwaysOpen);
	const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(() => new Set());
	const autoExpandedRowsRef = useRef<Set<string>>(new Set());

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
				const filtersForRequest = (filtersRef.current ?? createFilters()) as Filters;
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
	}, [fetchRowsFn, page, pageSize, setFormRows, createFilters]);

	useEffect(() => {
		if (fetchRowsFn) return;
		if (defaultRows) {
			setFormRows(defaultRows);
		}
	}, [fetchRowsFn, defaultRows, setFormRows]);

	const isCellDirty = (rowId: string, column: ColumnDef<Row>) =>
		computeCellDirty(rowId, column, rowsById, initialValuesRef.current.rowsById);

	const getRowDirtyState = (rowId: string) =>
		computeRowDirty(rowId, rowsById, columns, initialValuesRef.current.rowsById);

	const hasUnsavedChanges = useMemo(
		() => hasUnsavedChangesUtil(rowOrder, rowsById, columns, initialValuesRef.current.rowsById),
		[rowOrder, rowsById, columns]
	);

	useEffect(() => {
		if (typeof window === "undefined") return;
		try {
			const stored = localStorage.getItem(`resizable-cols:${TABLE_ID}`);
			if (stored) {
				const parsed = JSON.parse(stored) as Record<number, number>;
				setColWidths(parsed);
			}
		} catch {
			// ignore
		}
	}, [TABLE_ID]);

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

	const matchesGlobalSearch = useCallback(
		(row: Row) => {
			if (!normalizedSearch) return true;
			return columns.some((column) => {
				if (column.searchFn) {
					return column.searchFn(row, normalizedSearch);
				}
				const rawValue = row[column.field];
				return defaultSearchMatcher(rawValue, normalizedSearch);
			});
		},
		[normalizedSearch, columns]
	);

	const searchFilteredRows = useMemo(
		() => rows.filter((row) => matchesGlobalSearch(row)),
		[rows, matchesGlobalSearch]
	);

	const advancedFilteredRows = useMemo(() => {
		const applyFilters = config.applyFilters;
		if (!applyFilters || typeof filters === "undefined") return searchFilteredRows;
		return searchFilteredRows.filter((row) => applyFilters(row, filters));
	}, [searchFilteredRows, config, filters]);

	const tabCounts = useMemo(() => {
		const counts: Record<string, number> = {};
		tabFilters.forEach((tab) => {
			counts[tab.id] = tab.predicate
				? advancedFilteredRows.filter(tab.predicate).length
				: advancedFilteredRows.length;
		});
		return counts;
	}, [advancedFilteredRows, tabFilters]);

	const tabFilteredRows = useMemo(() => {
		if (!hasTabFilters || !activeTab) {
			return advancedFilteredRows;
		}
		const currentTab = tabFilters.find((tab) => tab.id === activeTab);
		if (!currentTab?.predicate) {
			return advancedFilteredRows;
		}
		return advancedFilteredRows.filter(currentTab.predicate);
	}, [advancedFilteredRows, activeTab, tabFilters, hasTabFilters]);

	const sortedRows = useMemo(() => {
		if (!sortState.columnId) return tabFilteredRows;
		const column = columns.find((col) => col.id === sortState.columnId);
		if (!column) return tabFilteredRows;
		const comparator = column.sortFn ?? defaultSortByField<Row>(column.field);
		const sorted = [...tabFilteredRows].sort((a, b) => comparator(a, b));
		return sortState.direction === "asc" ? sorted : sorted.reverse();
	}, [tabFilteredRows, sortState]);

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
		const handleColumnResize: EventListener = () => {
			recalcPinnedOffsets();
		};
		return attachColumnResizeListener(handleColumnResize);
	}, [attachColumnResizeListener, recalcPinnedOffsets]);

	useEffect(() => {
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
	}, [TABLE_ID, attachColumnResizeListener]);

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
		setIsFiltersOpen(false);
	}, [filtersDraft, hasFilters]);

	const handleResetAdvancedFilters = useCallback(() => {
		if (!hasFilters) return;
		const initial = createFilters();
		if (typeof initial === "undefined") return;
		setFilters(initial);
		setFiltersDraft(initial);
	}, [createFilters, hasFilters]);

	const renderFiltersContent =
		typeof filtersDraft !== "undefined" && config.renderFilters
			? config.renderFilters({
				filters: filtersDraft,
				onChange: (updater) => setFiltersDraft((prev) => updater(prev ?? filtersDraft)),
			})
			: null;

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
		if (page > clientTotalPages) {
			setPage(clientTotalPages);
		}
	}, [clientTotalPages, page]);

	// Detect if server returned more rows than requested (server doesn't support pagination)
	const serverReturnedAllRows = isServerPaging && sortedRows.length > pageSize;

	// Use client-side pagination if server returned all rows
	const useClientPagination = !isServerPaging || serverReturnedAllRows;

	const processedRows = useMemo(() => {
		const start = (page - 1) * pageSize;
		return sortedRows.slice(start, start + pageSize);
	}, [page, pageSize, sortedRows]);

	const processedRowsRef = useRef<Row[]>(processedRows);
	useEffect(() => {
		processedRowsRef.current = processedRows;
	}, [processedRows]);

	const datasetTotalCount = useClientPagination
		? sortedRows.length
		: serverMeta.total || sortedRows.length;

	const totalPages = useClientPagination
		? clientTotalPages
		: serverMeta.totalPages || 1;

	const hasNextPage = useClientPagination
		? page < clientTotalPages
		: serverMeta.hasNextPage;
	const hasPreviousPage = useClientPagination
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
		[form]
	);

	const handleRestoreCell = useCallback(
		(rowId: string, column: ColumnDef<Row>) => {
			const initialRow = initialValuesRef.current.rowsById[rowId];
			if (!initialRow) return;
			const initialValue = initialRow[column.field];
			setFormFieldValue(`rowsById.${rowId}.${column.field}` as const, () => initialValue as Row[ColumnField<Row>]);
		},
		[form]
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
	}, [columns, config, form, setFormFieldValue, setPage]);

	const handleDelete = useCallback((id: string) => {
		setFormFieldValue("rowOrder", (prev: string[] = []) => prev.filter((rowId) => rowId !== id));
		setFormFieldValue("rowsById", (prev: Record<string, Row> = {}) => {
			if (!(id in prev)) return prev;
			const next = { ...prev };
			delete next[id];
			return next;
		});
		toast.success("Fila eliminada");
	}, [form]);

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
			isOpen: isFiltersOpen,
			setIsOpen: setIsFiltersOpen,
			setDraft: (updater) => setFiltersDraft((prev) => updater(prev)),
			renderContent: renderFiltersContent,
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
			setPageSize: (size: number) => {
				setPageSize(size);
				setPage(1);
			},
			hasNextPage,
			hasPreviousPage,
			totalPages,
			totalRowCount,
			visibleRowCount,
			datasetTotalCount,
			options: PAGE_SIZE_OPTIONS,
			isServerPaging,
			isFetching: isFetchingServerRows,
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
			addRow: handleAddRow,
		},
	};

	const content = (
		<div
			className="space-y-4 max-w-full overflow-hidden"
		>
			<div>
				<h1 className="text-3xl font-bold">{config.title}</h1>
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
