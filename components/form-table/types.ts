import type { ReactNode } from "react";
import type { MainTableSelectOption } from "@/lib/main-table-select";

export type FormTableRow = {
	id: string;
	[key: string]: unknown;
};

export type ColumnField<Row extends FormTableRow> = Extract<
	keyof Omit<Row, "id">,
	string
>;

export type FormValues<Row extends FormTableRow> = {
	rowOrder: string[];
	rowsById: Record<string, Row>;
};

export type FieldValidators = {
	onChange?: (value: unknown) => string | undefined;
	onBlur?: (value: unknown) => string | undefined;
};

export type FormFieldRenderState = {
	state: {
		value: unknown;
		meta?: {
			errors?: unknown[];
		};
	};
	handleChange: (value: unknown) => void;
	handleBlur: () => void;
};

export type FormFieldComponent<Row extends FormTableRow> = (props: {
	name: string | `rowsById.${string}.${Extract<keyof Row, string>}`;
	children: (field: FormFieldRenderState) => ReactNode;
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
	| "badge"
	| "select";

export type CellSuggestionKind =
	| "date"
	| "number"
	| "currency"
	| "math"
	| "text"
	| "select";

export type CellSuggestion<Row extends FormTableRow> = {
	kind: CellSuggestionKind;
	suggestedValue: unknown;
	suggestedDisplayValue: string;
	description: string;
	sourceInput: string;
	column: ColumnDef<Row>;
	row: Row;
};

export type CellSuggestionDetectorArgs<Row extends FormTableRow> = {
	rawValue: string;
	currentValue: unknown;
	cellType: CellType;
	column: ColumnDef<Row>;
	row: Row;
};

export type CellSuggestionDetector<Row extends FormTableRow> = (
	args: CellSuggestionDetectorArgs<Row>,
) => CellSuggestion<Row> | null;

export type CellConfig<Row extends FormTableRow> = {
	onToggle?: (value: boolean, row: Row) => void;
	syncOnChange?: boolean;
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
	selectOptions?: MainTableSelectOption[];
	suggestionDetection?: CellSuggestionKind | "auto" | false;
	suggestionDetectors?: Array<CellSuggestionDetector<Row>>;
	renderReadOnly?: (args: {
		value: unknown;
		row: Row;
		highlightQuery: string;
	}) => ReactNode;
	renderEditable?: (args: {
		value: unknown;
		row: Row;
		highlightQuery: string;
		input: ReactNode;
	}) => ReactNode;
};

export type AccordionRowConfig<Row extends FormTableRow> = {
	renderContent: (row: Row) => ReactNode;
	renderTrigger?: (args: {
		row: Row;
		isOpen: boolean;
		toggle: () => void;
	}) => ReactNode;
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
	width?: number;
	enableResize?: boolean;
	enableSort?: boolean;
	cellClassName?: string | ((row: Row) => string | undefined);
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
	activeTab?: string | null;
	sort?: SortState;
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
	title?: string;
	description?: string;
	readOnly?: boolean;
	columns: ColumnDef<Row>[];
	lockedSort?: { columnId: string; direction: "asc" | "desc" };
	toolbarActions?: ReactNode;
	/** Rendered inline after the search field when showInlineSearch is true (e.g. primary actions next to “Buscar…”). */
	toolbarSearchEnd?: ReactNode;
	/** When false, the top toolbar (search, filters, columns, export, toolbarActions) is not rendered. Defaults to true. */
	showToolbar?: boolean;
	/** Collapses filters, columns, export and toolbarActions under a single "Extras" dropdown. */
	toolbarMode?: "default" | "extras";
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
	/** When true, renders defaultRows first and still fetches the full server dataset immediately after mount. */
	fetchAfterDefaultRows?: boolean;
	fetchRows?: (args: FetchRowsArgs<Filters>) => Promise<FetchRowsResult<Row>>;
	/** When true, search, sorting and pagination are resolved by fetchRows instead of client-side pipelines. */
	serverSideData?: boolean;
	createRow?: () => Row;
	onSave?: (args: SaveRowsArgs<Row>) => Promise<void>;
	emptyStateMessage?: string;
	accordionRow?: AccordionRowConfig<Row>;
	showInlineSearch?: boolean;
	enableColumnResizing?: boolean;
	/** When true, applies client-side sorting on the currently loaded rows. Defaults to true. */
	enableClientSort?: boolean;
	/** When true, hides the footer page-size control and the "Mostrando X de Y filas" line. */
	hideFooterPaginationSummary?: boolean;
	/** Custom actions rendered next to the footer buttons (save/discard). */
	footerActions?: ReactNode;
	/** Whether to show the actions column (delete button, accordion toggle). Defaults to true. */
	showActionsColumn?: boolean;
	/** Controls whether the default toolbar should show the "Agregar fila" button. Defaults to true. */
	allowAddRows?: boolean;
	/** When true, clears view constraints (search/filters/sort/tab) after adding a row so the new row is visible immediately. */
	revealNewRowOnAdd?: boolean;
	/** Mount editable field bindings only for the active cell to reduce subscription cost. */
	editMode?: "always" | "active-cell";
	/** Virtualize row rendering when datasets are large enough. */
	enableRowVirtualization?: boolean;
	/** Extra rows rendered above and below the viewport when virtualization is enabled. Defaults to 5. */
	virtualizationOverscan?: number;
	/** Optional row class resolver to support conditional row coloring. */
	rowClassName?: (row: Row, rowIndex: number) => string | undefined;
	/** Structured row color info for rule-based coloring. Preferred over rowClassName. */
	rowColorInfo?: (row: Row, rowIndex: number) => RowColorInfo | undefined;
	/** Optional badges rendered on each row (for overlapping rule indicators, etc.). */
	rowOverlayBadges?: (
		row: Row,
		rowIndex: number,
	) => Array<{
		id: string;
		label: string;
		tone?: "amber" | "red" | "green" | "blue";
	}>;
};

export type RowColorTone = "red" | "amber" | "green" | "blue";

export type RowColorInfo = {
	tone: RowColorTone;
	previewing: boolean;
};
