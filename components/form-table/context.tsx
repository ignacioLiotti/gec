import { createContext, useContext } from "react";
import type { CSSProperties, Dispatch, ReactNode, SetStateAction } from "react";
import type { Table } from "@tanstack/react-table";
import type {
	AccordionRowConfig,
	ColumnDef,
	FormFieldComponent,
	FormTableConfig,
	FormTableRow,
	SortState,
	TabFilterOption,
	HeaderGroup,
} from "./types";

export type FormTableSearchState = {
	value: string;
	placeholder?: string;
	showInline: boolean;
	onChange: (value: string) => void;
};

export type FormTableFiltersState<Filters> = {
	enabled: boolean;
	value?: Filters;
	draft?: Filters;
	isOpen: boolean;
	setIsOpen: (open: boolean) => void;
	setDraft: (updater: (prev: Filters | undefined) => Filters | undefined) => void;
	renderContent: ReactNode;
	activeCount: number;
	reset: () => void;
	apply: () => void;
};

export type FormTableColumnsState<Row extends FormTableRow> = {
	list: ColumnDef<Row>[];
	hiddenIds: string[];
	setHiddenIds: Dispatch<SetStateAction<string[]>>;
	pinnedIds: string[];
	togglePin: (columnId: string) => void;
	handleBalance: () => void;
	columnIndexMap: Record<string, number>;
	columnsById: Record<string, ColumnDef<Row>>;
	groupedColumnLookup: Map<string, HeaderGroup>;
	isColumnHidden: (columnId: string) => boolean;
	isColumnPinned: (columnId: string) => boolean;
	getStickyProps: (columnId: string, baseClassName?: string) => {
		className: string;
		style?: CSSProperties;
	};
	tableRef: React.MutableRefObject<HTMLTableElement | null>;
	colRefs: React.MutableRefObject<(HTMLTableColElement | null)[]>;
	colWidths: Record<number, number>;
	enableResizing: boolean;
};

export type FormTableSortingState = {
	state: SortState;
	toggle: (columnId: string) => void;
	applyDirection: (columnId: string, direction: "asc" | "desc") => void;
	clear: () => void;
};

export type FormTableTabsState<Row extends FormTableRow> = {
	enabled: boolean;
	items: TabFilterOption<Row>[];
	activeTab: string | null;
	setActiveTab: (value: string) => void;
	counts: Record<string, number>;
};

export type FormTablePaginationState = {
	page: number;
	setPage: Dispatch<SetStateAction<number>>;
	pageSize: number;
	setPageSize: (size: number) => void;
	lockedPageSize?: number;
	hasNextPage: boolean;
	hasPreviousPage: boolean;
	totalPages: number;
	totalRowCount: number;
	visibleRowCount: number;
	datasetTotalCount: number;
	options: number[];
	isServerPaging: boolean;
	isFetching: boolean;
	isTransitioning: boolean;
};

export type FormTableMetaState = {
	hasUnsavedChanges: boolean;
	isSaving: boolean;
	serverError: string | null;
	variant: "page" | "embedded";
	isEmbedded: boolean;
};

export type FormTableRowState<Row extends FormTableRow> = {
	table: Table<Row>;
	FieldComponent: FormFieldComponent<Row>;
	highlightQuery: string;
	getRowDirtyState: (rowId: string) => { dirty: boolean; cells: ColumnDef<Row>[] };
	isCellDirty: (rowId: string, column: ColumnDef<Row>) => boolean;
	hasInitialRow: (rowId: string) => boolean;
	hasAccordionRows: boolean;
	accordionRowConfig?: AccordionRowConfig<Row>;
	isRowExpanded: (rowId: string) => boolean;
	toggleAccordionRow: (rowId: string) => void;
	handleDelete: (rowId: string) => void;
	handleClearCell: (rowId: string, column: ColumnDef<Row>) => void;
	handleRestoreCell: (rowId: string, column: ColumnDef<Row>) => void;
	handleCopyCell: (value: unknown) => Promise<void>;
	handleCopyColumn: (column: ColumnDef<Row>) => Promise<void>;
	handleCopyRow: (row: Row) => Promise<void>;
	visibleDataColumnCount: number;
};

export type FormTableActions = {
	save: () => Promise<void>;
	discard: () => void;
	addRow: () => void;
};

export type FormTableContextValue<Row extends FormTableRow, Filters> = {
	config: FormTableConfig<Row, Filters>;
	tableId: string;
	search: FormTableSearchState;
	filters: FormTableFiltersState<Filters>;
	columns: FormTableColumnsState<Row>;
	sorting: FormTableSortingState;
	tabs: FormTableTabsState<Row>;
	pagination: FormTablePaginationState;
	meta: FormTableMetaState;
	rows: FormTableRowState<Row>;
	actions: FormTableActions;
};

const FormTableContext = createContext<FormTableContextValue<FormTableRow, unknown> | null>(null);

export function FormTableProvider<Row extends FormTableRow, Filters>({
	value,
	children,
}: {
	value: FormTableContextValue<Row, Filters>;
	children: ReactNode;
}) {
	return <FormTableContext.Provider value={value as unknown as FormTableContextValue<FormTableRow, unknown>}>{children}</FormTableContext.Provider>;
}

export function useFormTable<Row extends FormTableRow, Filters>() {
	const ctx = useContext(FormTableContext);
	if (!ctx) {
		throw new Error("useFormTable must be used within a FormTableProvider");
	}
	return ctx as unknown as FormTableContextValue<Row, Filters>;
}
