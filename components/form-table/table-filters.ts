import { useCallback, useMemo, useState, useTransition } from "react";
import type { FormTableConfig, FormTableRow } from "./types";

export function useTableFilters<Row extends FormTableRow, Filters>(
	config: FormTableConfig<Row, Filters>,
	onApply: () => void
) {
	const hasFilters = typeof config.createFilters === "function";
	const [filters, setFilters] = useState<Filters | undefined>(() => config.createFilters?.());
	const [filtersDraft, setFiltersDraft] = useState<Filters | undefined>(() =>
		config.createFilters?.()
	);
	const [isFilterTransitioning, startFilterTransition] = useTransition();
	const [previousTableId, setPreviousTableId] = useState(config.tableId);
	const createFilters = config.createFilters;
	const appliedFiltersKey = useMemo(() => JSON.stringify(filters ?? null), [filters]);
	const activeFilterCount =
		config.countActiveFilters && filters !== undefined ? config.countActiveFilters(filters) : 0;

	const resetFilters = useCallback(() => {
		const initial = createFilters?.();
		if (initial === undefined) return;
		setFilters(initial);
		setFiltersDraft(initial);
	}, [createFilters]);

	if (previousTableId !== config.tableId) {
		setPreviousTableId(config.tableId);
		const initial = createFilters?.();
		if (initial !== undefined) {
			setFilters(initial);
			setFiltersDraft(initial);
		}
	}

	const handleApplyAdvancedFilters = useCallback(() => {
		if (!hasFilters || filtersDraft === undefined) return;
		onApply();
		startFilterTransition(() => setFilters(filtersDraft));
	}, [filtersDraft, hasFilters, onApply]);
	const handleResetAdvancedFilters = useCallback(() => {
		if (!hasFilters) return;
		onApply();
		startFilterTransition(resetFilters);
	}, [hasFilters, onApply, resetFilters]);

	return {
		hasFilters,
		filters,
		filtersDraft,
		setFiltersDraftValue: setFiltersDraft,
		appliedFiltersKey,
		activeFilterCount,
		isFilterTransitioning,
		handleApplyAdvancedFilters,
		handleResetAdvancedFilters,
		resetFilters,
	};
}
