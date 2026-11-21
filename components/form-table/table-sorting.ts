import { useCallback, useState, useTransition } from "react";
import type { SortState } from "./types";

export function useTableSorting(lockedSort: SortState | null, onSort: () => void) {
	const [sortState, setSortState] = useState<SortState>(
		() => lockedSort ?? { columnId: null, direction: "asc" }
	);
	const [isSortTransitioning, startSortTransition] = useTransition();
	const [pendingSortColumnId, setPendingSortColumnId] = useState<string | null>(null);
	const effectiveSortState = lockedSort ?? sortState;

	if (
		lockedSort &&
		(sortState.columnId !== lockedSort.columnId || sortState.direction !== lockedSort.direction)
	) {
		setSortState(lockedSort);
	}

	const changeSort = useCallback(
		(columnId: string | null, updater: (current: SortState) => SortState) => {
			if (lockedSort) return;
			setPendingSortColumnId(columnId);
			onSort();
			startSortTransition(() => setSortState(updater));
		},
		[lockedSort, onSort]
	);

	const toggleSort = useCallback(
		(columnId: string) => {
			changeSort(columnId, (current) => {
				if (current.columnId !== columnId) return { columnId, direction: "asc" };
				if (current.direction === "asc") return { columnId, direction: "desc" };
				return { columnId: null, direction: "asc" };
			});
		},
		[changeSort]
	);
	const applySortDirection = useCallback(
		(columnId: string, direction: "asc" | "desc") => {
			changeSort(columnId, () => ({ columnId, direction }));
		},
		[changeSort]
	);
	const clearSort = useCallback(
		() => changeSort(null, () => ({ columnId: null, direction: "asc" })),
		[changeSort]
	);
	const resetSort = useCallback(() => {
		if (!lockedSort) setSortState({ columnId: null, direction: "asc" });
	}, [lockedSort]);

	return {
		effectiveSortState,
		isSortTransitioning,
		pendingSortColumnId,
		toggleSort,
		applySortDirection,
		clearSort,
		resetSort,
	};
}
