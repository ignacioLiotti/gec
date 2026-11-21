import { useMemo } from "react";
import { defaultSearchMatcher, defaultSortByField } from "./table-utils";
import type { ColumnDef, FormTableRow, SortState, TabFilterOption } from "./types";

type FilterOptions<Row extends FormTableRow, Filters> = {
	columns: ColumnDef<Row>[];
	searchRequestKey: string;
	applyFilters?: (row: Row, filters: Filters) => boolean;
	filters: Filters | undefined;
	tabFilters: TabFilterOption<Row>[];
	useServerDataMode: boolean;
};

/** A query owns this cache; changing its predicates creates a new evaluator. */
export function createRowFilter<Row extends FormTableRow, Filters>({
	columns,
	searchRequestKey,
	applyFilters,
	filters,
	tabFilters,
	useServerDataMode,
}: FilterOptions<Row, Filters>) {
	const query = searchRequestKey.toLowerCase();
	const cache = new WeakMap<Row, { matches: boolean; tabIds: Set<string> }>();
	return (row: Row) => {
		const cached = cache.get(row);
		if (cached) return cached;
		const matches =
			useServerDataMode ||
			((!query ||
				columns.some((column) =>
					column.searchFn
						? column.searchFn(row, query)
						: defaultSearchMatcher(row[column.field], query)
				)) &&
				(!applyFilters || filters === undefined || applyFilters(row, filters)));
		const tabIds = new Set<string>();
		if (matches) {
			for (const tab of tabFilters) {
				if (!tab.predicate || tab.predicate(row)) tabIds.add(tab.id);
			}
		}
		const result = { matches, tabIds };
		cache.set(row, result);
		return result;
	};
}

export function useTableRowPipeline<Row extends FormTableRow, Filters>({
	rows,
	searchRequestKey,
	columns,
	applyFilters,
	filters,
	tabFilters,
	hasTabFilters,
	activeTab,
	enableClientSort = true,
	effectiveSortState,
	useServerDataMode,
}: FilterOptions<Row, Filters> & {
	rows: Row[];
	hasTabFilters: boolean;
	activeTab: string | null;
	enableClientSort?: boolean;
	effectiveSortState: SortState;
}) {
	const evaluateRow = useMemo(
		() =>
			createRowFilter({
				columns,
				searchRequestKey,
				applyFilters,
				filters,
				tabFilters,
				useServerDataMode,
			}),
		[columns, searchRequestKey, applyFilters, filters, tabFilters, useServerDataMode]
	);

	const { filteredRows, tabCounts } = useMemo(() => {
		const counts = Object.fromEntries(tabFilters.map((tab) => [tab.id, 0]));
		const filtered: Row[] = [];
		const selectedTab = hasTabFilters ? tabFilters.find((tab) => tab.id === activeTab) : undefined;
		for (const row of rows) {
			const result = evaluateRow(row);
			if (!result.matches) continue;
			for (const tabId of result.tabIds) counts[tabId]++;
			if (!selectedTab?.predicate || result.tabIds.has(selectedTab.id)) filtered.push(row);
		}
		return { filteredRows: filtered, tabCounts: counts };
	}, [rows, evaluateRow, tabFilters, hasTabFilters, activeTab]);

	const sortedRows = useMemo(() => {
		if (useServerDataMode || !enableClientSort || !effectiveSortState.columnId) return filteredRows;
		const column = columns.find((column) => column.id === effectiveSortState.columnId);
		if (!column) return filteredRows;
		const compare = column.sortFn ?? defaultSortByField<Row>(column.field);
		const sorted = [...filteredRows].sort(compare);
		return effectiveSortState.direction === "asc" ? sorted : sorted.reverse();
	}, [filteredRows, effectiveSortState, enableClientSort, columns, useServerDataMode]);

	return { sortedRows, tabCounts, highlightQuery: searchRequestKey.toLowerCase() };
}
