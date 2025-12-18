import type { ReactNode } from "react";

export type ReportColumnType = "text" | "number" | "currency" | "boolean" | "date" | "custom";

export type AggregationType = "none" | "sum" | "count" | "count-checked" | "average";

export type ReportColumn<Row> = {
	id: string;
	label: string;
	/** Function to extract the value from a row */
	accessor: (row: Row) => unknown;
	type: ReportColumnType;
	/** Text alignment */
	align?: "left" | "center" | "right";
	/** Custom render function for the cell value */
	render?: (value: unknown, row: Row) => ReactNode;
	/** Default aggregation type for this column */
	defaultAggregation?: AggregationType;
	/** Whether this column can be used for grouping */
	groupable?: boolean;
	/** Width hint (e.g., "150px", "20%") */
	width?: string;
};

export type ReportGroupByOption<Row> = {
	id: string;
	label: string;
	/** Function to extract the group key from a row */
	groupBy: (row: Row) => string;
};

export type ReportFilterField<Filters> = {
	id: keyof Filters;
	label: string;
	type: "text" | "number" | "date" | "select" | "boolean-toggle";
	placeholder?: string;
	options?: { value: string; label: string }[];
};

export type ReportConfig<Row, Filters = Record<string, unknown>> = {
	id: string;
	title: string;
	description?: string;
	columns: ReportColumn<Row>[];
	/** Available grouping options */
	groupByOptions?: ReportGroupByOption<Row>[];
	/** Filter field definitions */
	filterFields?: ReportFilterField<Filters>[];
	/** Initial/default filters */
	defaultFilters?: () => Filters;
	/** Function to fetch data */
	fetchData: (filters: Filters) => Promise<Row[]>;
	/** Function to get unique ID from a row */
	getRowId: (row: Row) => string;
	/** Currency locale for currency columns */
	currencyLocale?: string;
	/** Currency code for currency columns */
	currencyCode?: string;
};

export type ReportState = {
	companyName: string;
	description: string;
	date: string;
	viewMode: "full" | string; // "full" or a groupBy option id
	hiddenColumnIds: string[];
	sortColumnId: string | null;
	sortDirection: "asc" | "desc";
	aggregations: Record<string, AggregationType>;
};
