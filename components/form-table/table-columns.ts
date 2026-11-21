"use client";

import { balanceTableColumns } from "@/components/ui/column-resizer";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ColumnDef, FormTableConfig, FormTableRow, HeaderGroup } from "./types";

import { readPersistedArray, writePersistedArray } from "./persistence";
import {
	DEFAULT_COL_WIDTH,
	DEFAULT_ROW_NUMBER_COLUMN_WIDTH,
	shouldUseSpreadsheetChrome,
} from "./table-layout";
import { shallowEqualStringArrays } from "./table-utils";

import type { FormTableColumnsState } from "./context";
export function useTableColumns<Row extends FormTableRow, Filters>(
	config: FormTableConfig<Row, Filters>
): FormTableColumnsState<Row> {
	const TABLE_ID = config.tableId;
	const columns = config.columns;
	const headerGroups = useMemo(() => config.headerGroups ?? [], [config.headerGroups]);
	const enableColumnResizing = config.enableColumnResizing ?? false;
	const showRowNumbers = shouldUseSpreadsheetChrome(config);
	const rowNumberColumnWidth = config.rowNumberColumnWidth ?? DEFAULT_ROW_NUMBER_COLUMN_WIDTH;
	const actionsColumnWidth = config.actionsColumnWidth ?? 140;
	const actionsAtStart =
		config.showActionsColumn !== false && config.actionsColumnPosition === "start";
	const dataColumnIndexOffset = Number(showRowNumbers) + Number(actionsAtStart);
	const stickyLeadingOffset =
		(showRowNumbers ? rowNumberColumnWidth : 0) + (actionsAtStart ? actionsColumnWidth : 0);
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
	useEffect(() => {
		if (!enableColumnResizing || typeof window === "undefined") return;
		try {
			const stored = localStorage.getItem(`resizable-cols:${TABLE_ID}`);
			if (stored) {
				const parsed = JSON.parse(stored) as Record<number, number>;
				// eslint-disable-next-line react-hooks/set-state-in-effect -- Restore measured widths from browser storage after hydration.
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
		// eslint-disable-next-line react-hooks/set-state-in-effect -- Restore browser preferences after hydration, preserving the server's initial markup.
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
				return () => {};
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

	// Persist hidden columns
	useEffect(() => {
		writePersistedArray(`${TABLE_ID}:hidden`, hiddenColumnIds);
	}, [TABLE_ID, hiddenColumnIds]);

	// Persist pinned columns
	useEffect(() => {
		writePersistedArray(`${TABLE_ID}:pinned`, pinnedColumnIds);
	}, [TABLE_ID, pinnedColumnIds]);

	const validPinnedIds = useMemo(
		() =>
			pinnedColumnIds
				.filter((id) => pinnableColumns.has(id))
				.sort((a, b) => columnIndexMap[a] - columnIndexMap[b]),
		[pinnedColumnIds, pinnableColumns, columnIndexMap]
	);
	if (!shallowEqualStringArrays(pinnedColumnIds, validPinnedIds))
		setPinnedColumnIds(validPinnedIds);

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
			const width =
				colEl?.getBoundingClientRect().width || colWidths[physicalColIndex] || DEFAULT_COL_WIDTH;
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
		// eslint-disable-next-line react-hooks/set-state-in-effect -- Sticky offsets depend on measured DOM widths after the columns mount.
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

	return {
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
	};
}
