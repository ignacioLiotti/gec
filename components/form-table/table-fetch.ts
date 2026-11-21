"use client";

import { useEffect, useRef, useState } from "react";
import type { FormTableConfig, FormTableRow, ServerPaginationMeta, SortState } from "./types";

import { hasSameRowIdentity } from "./table-utils";

export function useTableFetch<Row extends FormTableRow, Filters>({
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
}: {
	config: FormTableConfig<Row, Filters>;
	page: number;
	pageSize: number;
	activeTab: string | null;
	effectiveSortState: SortState;
	searchRequestKey: string;
	appliedFiltersKey: string;
	filters: Filters | undefined;
	rowOrder: string[];
	setFormRows: (rows: Row[]) => void;
	setServerError: (error: string | null) => void;
}) {
	const TABLE_ID = config.tableId;
	const isDev = process.env.NODE_ENV !== "production";
	const fetchRowsFn = config.fetchRows ?? null;
	const createFilters = config.createFilters;
	const useServerDataMode = config.serverSideData === true && Boolean(fetchRowsFn);
	const [externalRefreshVersion, setExternalRefreshVersion] = useState(0);
	const [isServerPaging, setIsServerPaging] = useState(Boolean(fetchRowsFn));
	const useClientPagination = !isServerPaging;
	const [isFetchingServerRows, setIsFetchingServerRows] = useState(false);
	const fetchRunIdRef = useRef(0);
	const [serverMeta, setServerMeta] = useState<ServerPaginationMeta>({
		page: 1,
		limit: pageSize,
		total: 0,
		totalPages: 1,
		hasNextPage: false,
		hasPreviousPage: false,
	});
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
				const filtersForRequest = (filters ?? createFilters?.()) as Filters;
				const result = await fetchRowsFn({
					page,
					limit: pageSize,
					filters: filtersForRequest,
					search: searchRequestKey,
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
		filters,
		createFilters,
		setServerError,
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

	return {
		isServerPaging,
		useClientPagination,
		isFetchingServerRows,
		serverMeta,
		externalRefreshVersion,
	};
}
