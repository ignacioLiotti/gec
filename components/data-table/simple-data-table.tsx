"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { ColGroup, ColumnResizer, balanceTableColumns } from "@/components/ui/column-resizer";
import { ColumnVisibilityMenu } from "./column-visibility-menu";
import type {
	DataTableColumn,
	DataTableFeatures,
} from "./types";

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

export interface SimpleDataTableProps<TData extends Record<string, any>> {
	id: string;
	data: TData[];
	columns: DataTableColumn<TData>[];
	features?: DataTableFeatures<TData>;
	className?: string;
	emptyText?: string;
	getRowId?: (row: TData, index: number) => string | number;
}

export function SimpleDataTable<TData extends Record<string, any>>({
	id,
	data,
	columns,
	features,
	className,
	emptyText = "No hay datos disponibles.",
	getRowId,
}: SimpleDataTableProps<TData>) {
	const columnVisibilityConfig = features?.columnVisibility;
	const columnPinningConfig = features?.columnPinning;
	const columnResizingConfig = features?.columnResizing;
	const columnBalanceConfig = features?.columnBalance;

	const columnVisibilityEnabled = columnVisibilityConfig?.enabled ?? false;
	const columnPinningEnabled = columnPinningConfig?.enabled ?? false;
	const columnResizingEnabled = columnResizingConfig?.enabled ?? false;
	const columnResizingMode = columnResizingConfig?.mode ?? "fixed";

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

	const columnIndexMap = React.useMemo(() => {
		const map: Record<string, number> = {};
		columns.forEach((column, index) => {
			map[column.id] = index;
		});
		return map;
	}, [columns]);

	// Persist hidden columns
	React.useEffect(() => {
		if (!columnVisibilityEnabled) return;
		writePersistedArray(hiddenStorageKey, hiddenColumnIds);
	}, [columnVisibilityEnabled, hiddenColumnIds, hiddenStorageKey]);

	// Clean up hidden columns that no longer exist
	React.useEffect(() => {
		if (!columnVisibilityEnabled) return;
		setHiddenColumnIds((prev) => prev.filter((id) => hideableColumns.has(id)));
	}, [columnVisibilityEnabled, hideableColumns]);

	// Persist pinned columns
	React.useEffect(() => {
		if (!columnPinningEnabled) return;
		writePersistedArray(pinnedStorageKey, pinnedColumnIds);
	}, [columnPinningEnabled, pinnedColumnIds, pinnedStorageKey]);

	// Clean up and sort pinned columns
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

	const tableRef = React.useRef<HTMLTableElement | null>(null);
	const [columnOffsets, setColumnOffsets] = React.useState<Record<string, number>>({});

	// Calculate offsets for pinned columns
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

	// Apply hidden state to columns
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

	const getCellValue = React.useCallback(
		(row: TData, column: DataTableColumn<TData>, rowIndex: number) => {
			const value = column.accessorKey ? row[column.accessorKey] : undefined;

			if (column.renderCell) {
				return column.renderCell({
					row,
					rowIndex,
					column,
					value,
				});
			}

			if (column.accessorFn) {
				return column.accessorFn(row, rowIndex) as React.ReactNode;
			}

			if (column.accessorKey) {
				return value ?? "";
			}

			return null;
		},
		[],
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

	const showToolbar =
		columnVisibilityEnabled || columnPinningEnabled || columnBalanceConfig?.enabled;

	return (
		<div className={cn("space-y-4", className)}>
			{showToolbar && (
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div className="flex flex-wrap items-center gap-2">
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
					</div>
				</div>
			)}

			<div className="relative border border-border rounded-lg overflow-x-auto w-full bg-white">
				<div className="max-h-[70vh] overflow-auto">
					<table ref={tableRef} data-table-id={id} className="w-full table-fixed text-sm">
						<ColGroup tableId={id} columns={columns.length} mode={columnResizingMode} />
						<thead className="sticky top-0 z-30 bg-sidebar">
							<tr>
								{columns.map((column, colIndex) => {
									const baseClassName = cn(
										"relative px-4 py-4 text-left text-xs font-semibold uppercase outline outline-border bg-sidebar",
										column.headerClassName,
									);

									return (
										<th key={column.id} {...getStickyProps(column, baseClassName)}>
											<div className="flex w-full h-full px-4 py-3 absolute top-0 left-0 items-center justify-between gap-2">
												<span>{column.header}</span>
											</div>
											{columnResizingEnabled && column.enableResize !== false && (
												<ColumnResizer
													tableId={id}
													colIndex={colIndex}
													mode={columnResizingMode}
												/>
											)}
										</th>
									);
								})}
							</tr>
						</thead>
						<tbody className="bg-white">
							{data.length === 0 ? (
								<tr>
									<td
										colSpan={columns.length}
										className="px-6 py-12 text-center text-sm text-muted-foreground"
									>
										{emptyText}
									</td>
								</tr>
							) : (
								data.map((row, rowIndex) => {
									const rowKey = String(getRowId?.(row, rowIndex) ?? rowIndex);
									return (
										<tr
											key={rowKey}
											className={cn(
												"border-b transition-colors duration-150 group",
												rowIndex % 2 === 0 ? "bg-white" : "bg-[hsl(50,17%,98%)]",
											)}
										>
											{columns.map((column) => {
												const baseClassName = cn(
													"px-2 pl-4 py-4 outline outline-border border-border relative group-hover:bg-[hsl(50,17%,95%)]",
													column.className,
													rowIndex % 2 === 0 ? "bg-white" : "bg-[hsl(50,17%,98%)]",
													column.align === "right" && "text-right",
													column.align === "center" && "text-center",
												);

												return (
													<td key={column.id} {...getStickyProps(column, baseClassName)}>
														<div className="min-h-[20px] w-full">
															{getCellValue(row, column, rowIndex)}
														</div>
													</td>
												);
											})}
										</tr>
									);
								})
							)}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
}

function getHeaderLabel(node: React.ReactNode): string {
	if (typeof node === "string") return node;
	if (typeof node === "number") return String(node);
	return "Columna";
}
