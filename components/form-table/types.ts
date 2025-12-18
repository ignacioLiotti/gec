import type { ReactNode } from "react";

export type FormTableRow = {
	id: string;
	[key: string]: unknown;
};

export type ColumnField<Row extends FormTableRow> = Extract<keyof Omit<Row, "id">, string>;

export type FormValues<Row extends FormTableRow> = {
	rowOrder: string[];
	rowsById: Record<string, Row>;
};

export type FieldValidators = {
	onChange?: (value: unknown) => string | undefined;
	onBlur?: (value: unknown) => string | undefined;
};

export type FormFieldComponent<Row extends FormTableRow> = (props: {
	name: string;
	children: (field: any) => ReactNode;
	validators?: FieldValidators;
}) => ReactNode;

export type CellType =
	| "text"
	| "number"
	| "currency"
	| "date"
	| "boolean"
	| "checkbox"
	| "toggle"
	| "tags"
	| "link"
	| "avatar"
	| "image"
	| "icon"
	| "text-icon"
	| "badge";

export type CellConfig<Row extends FormTableRow> = {
	onToggle?: (value: boolean, row: Row) => void;
	currencyCode?: string;
	currencyLocale?: string;
	dateFormat?: "short" | "medium" | "long" | "custom";
	customDateFormat?: string;
	tagVariant?: "default" | "secondary" | "outline" | "destructive";
	tagSeparator?: string;
	href?: string | ((row: Row) => string);
	target?: "_blank" | "_self";
	avatarFallback?: string | ((row: Row) => string);
	iconName?: string | ((row: Row) => string);
	iconClassName?: string;
	iconPosition?: "left" | "right";
	badgeVariant?: "default" | "secondary" | "outline" | "destructive";
	badgeMap?: Record<string, { label: string; variant: string }>;
	renderReadOnly?: (args: { value: unknown; row: Row; highlightQuery: string }) => ReactNode;
};

export type AccordionRowConfig<Row extends FormTableRow> = {
	renderContent: (row: Row) => ReactNode;
	renderTrigger?: (args: { row: Row; isOpen: boolean; toggle: () => void }) => ReactNode;
	triggerLabel?: string;
	defaultOpen?: (row: Row) => boolean;
	contentClassName?: string;
	alwaysOpen?: boolean;
};

export type ColumnDef<Row extends FormTableRow> = {
	id: string;
	label: string;
	field: ColumnField<Row>;
	required?: boolean;
	enableHide?: boolean;
	enablePin?: boolean;
	editable?: boolean;
	cellType?: CellType;
	cellConfig?: CellConfig<Row>;
	sortFn?: (a: Row, b: Row) => number;
	searchFn?: (row: Row, query: string) => boolean;
	validators?: FieldValidators;
	cellMenuItems?: Array<{
		id: string;
		label: string;
		onSelect?: (row: Row) => void;
	}>;
	defaultValue?: unknown;
};

export type HeaderGroup = {
	id: string;
	label: string;
	columns: string[];
	className?: string;
};

export type TabFilterOption<Row extends FormTableRow> = {
	id: string;
	label: string;
	predicate?: (row: Row) => boolean;
	showBadge?: boolean;
};

export type FilterRendererProps<Filters> = {
	filters: Filters;
	onChange: (updater: (prev: Filters) => Filters) => void;
};

export type FetchRowsArgs<Filters> = {
	page: number;
	limit: number;
	filters: Filters;
	search?: string;
};

export type FetchRowsResult<Row extends FormTableRow> = {
	rows: Row[];
	pagination?: Partial<ServerPaginationMeta>;
};

export type SaveRowsArgs<Row extends FormTableRow> = {
	rows: Row[];
	dirtyRows: Row[];
	deletedRowIds: string[];
};

export type SortState = {
	columnId: string | null;
	direction: "asc" | "desc";
};

export type ServerPaginationMeta = {
	page: number;
	limit: number;
	total: number;
	totalPages: number;
	hasNextPage: boolean;
	hasPreviousPage: boolean;
};

export type FormTableConfig<Row extends FormTableRow, Filters> = {
	tableId: string;
	title: string;
	description?: string;
	columns: ColumnDef<Row>[];
	headerGroups?: HeaderGroup[];
	tabFilters?: TabFilterOption<Row>[];
	searchPlaceholder?: string;
	defaultPageSize?: number;
	pageSizeOptions?: number[];
	lockedPageSize?: number;
	createFilters?: () => Filters;
	renderFilters?: (props: FilterRendererProps<Filters>) => ReactNode;
	applyFilters?: (row: Row, filters: Filters) => boolean;
	countActiveFilters?: (filters: Filters) => number;
	defaultRows?: Row[];
	fetchRows?: (args: FetchRowsArgs<Filters>) => Promise<FetchRowsResult<Row>>;
	createRow?: () => Row;
	onSave?: (args: SaveRowsArgs<Row>) => Promise<void>;
	emptyStateMessage?: string;
	accordionRow?: AccordionRowConfig<Row>;
	showInlineSearch?: boolean;
	enableColumnResizing?: boolean;
	/** Whether to show the actions column (delete button, accordion toggle). Defaults to true. */
	showActionsColumn?: boolean;
	/** Controls whether the default toolbar should show the "Agregar fila" button. Defaults to true. */
	allowAddRows?: boolean;
};







