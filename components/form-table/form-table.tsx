'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import type { ReactNode } from "react";
import { useForm, useStore } from "@tanstack/react-form";
import type { AnyFormState } from "@tanstack/form-core";
import {
	useReactTable,
	getCoreRowModel,
	ColumnDef as TanStackColumnDef,
	flexRender,
	VisibilityState,
} from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Sheet,
	SheetContent,
	SheetFooter,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuTrigger,
	ContextMenuSeparator,
} from "@/components/ui/context-menu";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ColumnResizer, balanceTableColumns } from "@/components/ui/column-resizer";
import { ColumnVisibilityMenu } from "@/components/data-table/column-visibility-menu";
import { format as formatDate } from "date-fns";
import {
	ExternalLink,
	Filter,
	Search as SearchIcon,
	ArrowUp,
	ArrowDown,
	ArrowUpDown,
	Minus,
	Loader2,
	ChevronLeft,
	ChevronRight,
} from "lucide-react";

export type FormTableRow = {
	id: string;
	[key: string]: unknown;
};

type ColumnField<Row extends FormTableRow> = Extract<keyof Omit<Row, "id">, string>;

type FormValues<Row extends FormTableRow> = {
	rowOrder: string[];
	rowsById: Record<string, Row>;
};

type FormFieldComponent<Row extends FormTableRow> = (props: {
	name: string;
	children: (field: any) => ReactNode;
	validators?: FieldValidators;
}) => ReactNode;

type RenderCellArgs<Row extends FormTableRow> = {
	column: ColumnDef<Row>;
	row: Row;
	rowId: string;
	FieldComponent: FormFieldComponent<Row>;
	highlightQuery: string;
	isCellDirty: boolean;
	isRowDirty: boolean;
	onCopyCell: (value: unknown) => void;
	onCopyColumn: () => void;
	onCopyRow: () => void;
	onClearValue?: () => void;
	onRestoreValue?: () => void;
	canRestore?: boolean;
	customMenuItems?: ColumnDef<Row>["cellMenuItems"];
};

type SortState = {
	columnId: string | null;
	direction: "asc" | "desc";
};

type ServerPaginationMeta = {
	page: number;
	limit: number;
	total: number;
	totalPages: number;
	hasNextPage: boolean;
	hasPreviousPage: boolean;
};

type CellType =
	| 'text'
	| 'number'
	| 'currency'
	| 'date'
	| 'boolean'
	| 'checkbox'
	| 'toggle'
	| 'tags'
	| 'link'
	| 'avatar'
	| 'image'
	| 'icon'
	| 'text-icon'
	| 'badge';

type CellConfig<Row extends FormTableRow> = {
	// Boolean/Checkbox/Toggle
	onToggle?: (value: boolean, row: Row) => void;

	// Currency
	currencyCode?: string;
	currencyLocale?: string;

	// Date
	dateFormat?: 'short' | 'medium' | 'long' | 'custom';
	customDateFormat?: string;

	// Tags
	tagVariant?: 'default' | 'secondary' | 'outline' | 'destructive';
	tagSeparator?: string; // How to split string into tags (e.g., ",")

	// Link
	href?: string | ((row: Row) => string);
	target?: '_blank' | '_self';

	// Avatar
	avatarFallback?: string | ((row: Row) => string);

	// Icon
	iconName?: string | ((row: Row) => string);
	iconClassName?: string;

	// Text + Icon
	iconPosition?: 'left' | 'right';

	// Badge
	badgeVariant?: 'default' | 'secondary' | 'outline' | 'destructive';
	badgeMap?: Record<string, { label: string; variant: string }>;
};

type FieldValidators = {
	onChange?: (value: unknown) => string | undefined;
	onBlur?: (value: unknown) => string | undefined;
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
	columns: string[]; // column IDs in this group
	className?: string;
};

export type TabFilterOption<Row extends FormTableRow> = {
	id: string;
	label: string;
	predicate?: (row: Row) => boolean;
	showBadge?: boolean;
};

type FilterRendererProps<Filters> = {
	filters: Filters;
	onChange: (updater: (prev: Filters) => Filters) => void;
};

type FetchRowsArgs<Filters> = {
	page: number;
	limit: number;
	filters: Filters;
	search?: string;
};

type FetchRowsResult<Row extends FormTableRow> = {
	rows: Row[];
	pagination?: Partial<ServerPaginationMeta>;
};

type SaveRowsArgs<Row extends FormTableRow> = {
	rows: Row[];
	dirtyRows: Row[];
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
	createFilters: () => Filters;
	renderFilters?: (props: FilterRendererProps<Filters>) => ReactNode;
	applyFilters?: (row: Row, filters: Filters) => boolean;
	countActiveFilters?: (filters: Filters) => number;
	defaultRows?: Row[];
	fetchRows?: (args: FetchRowsArgs<Filters>) => Promise<FetchRowsResult<Row>>;
	createRow?: () => Row;
	onSave?: (args: SaveRowsArgs<Row>) => Promise<void>;
	emptyStateMessage?: string;
};

const DEFAULT_COL_WIDTH = 160;
const PAGE_SIZE_OPTIONS = [5, 10, 20, 50];
const DEFAULT_PAGE_SIZE = 10;

function createRowFromColumns<Row extends FormTableRow>(columns: ColumnDef<Row>[]): Row {
	const hasCrypto =
		typeof crypto !== "undefined" && typeof crypto.randomUUID === "function";
	const row: FormTableRow = {
		id: hasCrypto ? crypto.randomUUID() : `row-${Date.now()}-${Math.random()}`,
	};
	columns.forEach((column) => {
		if (column.field) {
			const defaultValue = column.defaultValue;
			if (typeof defaultValue !== "undefined") {
				(row as any)[column.field] = defaultValue;
			} else {
				switch (column.cellType) {
					case "boolean":
					case "checkbox":
					case "toggle":
						(row as any)[column.field] = false;
						break;
					case "currency":
					case "number":
						(row as any)[column.field] = 0;
						break;
					default:
						(row as any)[column.field] = "";
				}
			}
		}
	});
	return row as Row;
}

function isValueEmpty(value: unknown) {
	if (value == null) return true;
	if (typeof value === "string") return value.trim() === "";
	return false;
}

function defaultSearchMatcher(value: unknown, query: string) {
	if (!query) return true;
	if (value == null) return false;
	if (typeof value === "string") {
		return value.toLowerCase().includes(query);
	}
	return String(value).toLowerCase().includes(query);
}

export function requiredValidator(label: string) {
	return (value: unknown) => (isValueEmpty(value) ? `${label} es obligatorio` : undefined);
}

function shallowEqualValues(a: unknown, b: unknown) {
	if (typeof a === "number" && typeof b === "number") {
		if (Number.isNaN(a) && Number.isNaN(b)) return true;
	}
	return a === b;
}

function getClearedValue<Row extends FormTableRow>(column: ColumnDef<Row>) {
	switch (column.cellType) {
		case "boolean":
		case "checkbox":
		case "toggle":
			return false;
		case "number":
		case "currency":
			return null;
		default:
			return "";
	}
}

function escapeRegExp(value: string) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function HighlightedText({ text, query }: { text: string; query: string }) {
	if (!query) return <>{text}</>;
	const regex = new RegExp(`(${escapeRegExp(query)})`, "ig");
	const parts = text.split(regex);
	return (
		<>
			{parts.map((part, idx) =>
				part.toLowerCase() === query.toLowerCase() ? (
					<mark key={`${part}-${idx}`} className="bg-yellow-200 px-0.5">
						{part}
					</mark>
				) : (
					<span key={`${part}-${idx}`}>{part}</span>
				)
			)}
		</>
	);
}

function defaultSortByField<Row extends FormTableRow>(field: ColumnField<Row>) {
	return (a: Row, b: Row) => {
		const valueA = a[field];
		const valueB = b[field];
		if (typeof valueA === "number" && typeof valueB === "number") {
			return valueA - valueB;
		}
		return String(valueA ?? "").localeCompare(String(valueB ?? ""), "es", {
			sensitivity: "base",
			numeric: true,
		});
	};
}

function snapshotValues<Row extends FormTableRow>(
	rowOrder: string[],
	rowsById: Record<string, Row>
): FormValues<Row> {
	return {
		rowOrder: [...rowOrder],
		rowsById: rowOrder.reduce<Record<string, Row>>((acc, id) => {
			const row = rowsById[id];
			if (row) {
				acc[id] = { ...row };
			}
			return acc;
		}, {}),
	};
}

function tableRowToCsv<Row extends FormTableRow>(row: Row, cols: ColumnDef<Row>[]) {
	const values = cols.map((col) => {
		const raw = row[col.field];
		if (typeof raw === "boolean") {
			return raw ? "true" : "false";
		}
		return raw ?? "";
	});
	return values
		.map((value) => {
			const safe = String(value ?? "");
			return `"${safe.replace(/"/g, '""')}"`;
		})
		.join(";");
}

async function copyToClipboard(text: string) {
	if (typeof navigator === "undefined" || !navigator.clipboard) {
		console.warn("Clipboard API not available");
		return false;
	}
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch (error) {
		console.error("copyToClipboard error", error);
		return false;
	}
}

function readPersistedArray(key: string): string[] {
	if (typeof window === "undefined") return [];
	try {
		const raw = window.localStorage.getItem(key);
		const parsed = raw ? (JSON.parse(raw) as string[]) : [];
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

function writePersistedArray(key: string, value: string[]) {
	if (typeof window === "undefined") return;
	try {
		window.localStorage.setItem(key, JSON.stringify(value));
	} catch {
		// ignore
	}
}

// Cell renderer function
function renderReadOnlyValue<Row extends FormTableRow>(
	value: unknown,
	row: Row,
	column: ColumnDef<Row>,
	highlightQuery: string
): ReactNode {
	const cellType = column.cellType || 'text';
	const config = column.cellConfig || {};

	switch (cellType) {
		case 'number':
			return (
				<span className="font-mono tabular-nums">
					{typeof value === 'number' ? value.toLocaleString() : String(value ?? '-')}
				</span>
			);
		case 'currency': {
			const amount =
				typeof value === 'number'
					? value
					: Number.parseFloat(String(value ?? 0)) || 0;
			const formatted = new Intl.NumberFormat(config.currencyLocale || 'es-AR', {
				style: 'currency',
				currency: config.currencyCode || 'USD',
			}).format(amount);
			return <span className="font-mono tabular-nums">{formatted}</span>;
		}
		case 'date': {
			if (!value) return <span>-</span>;
			const date = new Date(String(value));
			if (Number.isNaN(date.getTime())) return <span>-</span>;
			if (config.dateFormat === 'custom' && config.customDateFormat) {
				try {
					return <span>{formatDate(date, config.customDateFormat)}</span>;
				} catch {
					return <span>{date.toISOString().slice(0, 10)}</span>;
				}
			}
			const options: Intl.DateTimeFormatOptions =
				config.dateFormat === 'short'
					? { dateStyle: 'short' }
					: config.dateFormat === 'long'
						? { dateStyle: 'long' }
						: { dateStyle: 'medium' };
			return <span>{date.toLocaleDateString('es-AR', options)}</span>;
		}
		case 'boolean':
		case 'checkbox':
		case 'toggle': {
			const boolValue = Boolean(value);
			return (
				<span
					className={cn(
						"inline-flex items-center gap-1",
						boolValue ? "text-green-600" : "text-gray-400"
					)}
				>
					{boolValue ? "●" : "○"}
					<span className="text-xs">{boolValue ? "Sí" : "No"}</span>
				</span>
			);
		}
		case 'tags': {
			const tagsStr = String(value || '');
			if (!tagsStr) return <span>-</span>;
			const tags = config.tagSeparator
				? tagsStr.split(config.tagSeparator).map((t) => t.trim()).filter(Boolean)
				: [tagsStr];
			return (
				<div className="flex flex-wrap gap-1">
					{tags.map((tag) => (
						<Badge key={tag} variant={config.tagVariant || 'secondary'}>
							<HighlightedText text={tag} query={highlightQuery} />
						</Badge>
					))}
				</div>
			);
		}
		case 'link': {
			const text = String(value || '');
			if (!text) return <span>-</span>;
			const href =
				typeof config.href === 'function'
					? config.href(row)
					: config.href || text;
			return (
				<a
					href={href}
					target={config.target || '_blank'}
					rel={config.target === '_blank' ? 'noopener noreferrer' : undefined}
					className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline"
				>
					<HighlightedText text={text} query={highlightQuery} />
					{config.target === '_blank' && <ExternalLink className="w-3 h-3" />}
				</a>
			);
		}
		case 'avatar': {
			const text = String(value || '');
			const fallback =
				typeof config.avatarFallback === 'function'
					? config.avatarFallback(row)
					: config.avatarFallback || text.substring(0, 2).toUpperCase();
			return (
				<Avatar className="w-8 h-8">
					<AvatarImage src={text} alt={fallback} />
					<AvatarFallback>{fallback}</AvatarFallback>
				</Avatar>
			);
		}
		case 'image': {
			const src = String(value || '');
			if (!src) return <span>-</span>;
			return (
				<img
					src={src}
					alt="Vista previa"
					className="w-10 h-10 object-cover rounded"
				/>
			);
		}
		case 'badge': {
			const text = String(value || '');
			if (!text) return <span>-</span>;
			if (config.badgeMap?.[text]) {
				const mapped = config.badgeMap[text];
				return <Badge variant={mapped.variant as any}>{mapped.label}</Badge>;
			}
			return (
				<Badge variant={config.badgeVariant || 'default'}>
					<HighlightedText text={text} query={highlightQuery} />
				</Badge>
			);
		}
		case 'text-icon': {
			const text = String(value || '');
			if (!text) return <span>-</span>;
			const iconName =
				typeof config.iconName === 'function'
					? config.iconName(row)
					: config.iconName;
			return (
				<div
					className={cn(
						"inline-flex items-center gap-2",
						config.iconPosition === 'right' ? 'flex-row-reverse' : ''
					)}
				>
					{iconName && (
						<span className={cn("text-muted-foreground", config.iconClassName)}>
							{iconName}
						</span>
					)}
					<span>
						<HighlightedText text={text} query={highlightQuery} />
					</span>
				</div>
			);
		}
		default:
			return (
				<span>
					<HighlightedText text={String(value || '-')} query={highlightQuery} />
				</span>
			);
	}
}

type EditableCellValue = string | number | readonly string[] | null | undefined;

type EditableContentArgs<Row extends FormTableRow> = {
	column: ColumnDef<Row>;
	row: Row;
	value: EditableCellValue;
	setValue: (value: unknown) => void;
	handleBlur: () => void;
	highlightQuery: string;
};

function renderEditableContent<Row extends FormTableRow>({
	column,
	row,
	value,
	setValue,
	handleBlur,
	highlightQuery,
}: EditableContentArgs<Row>): ReactNode {
	const cellType = column.cellType || 'text';
	const config = column.cellConfig || {};

	switch (cellType) {
		case 'currency': {
			const formatted =
				value == null || value === ""
					? "-"
					: new Intl.NumberFormat(config.currencyLocale || 'es-AR', {
						style: 'currency',
						currency: config.currencyCode || 'USD',
					}).format(Number(value) || 0);
			return (
				<Input
					type="number"
					step="0.01"
					className="w-full h-full rounded-none border-none focus-visible:ring-orange-primary/40 z-100 absolute top-0 left-0 focus-visible:ring-offset-1 children-input-hidden"
					value={value ?? ""}
					onChange={(event) => {
						const next = event.target.value;
						setValue(next === "" ? null : Number(next));
					}}
					onBlur={handleBlur}
					placeholder="0.00"
					required={column.required}
				/>
			);
		}
		case 'number':
			return (
				<Input
					type="number"
					className="w-full h-full rounded-none border-none focus-visible:ring-orange-primary/40 z-100 absolute top-0 left-0 focus-visible:ring-offset-1 children-input-hidden"
					value={value ?? ""}
					onChange={(event) => {
						const next = event.target.value;
						setValue(next === "" ? null : Number(next));
					}}
					onBlur={handleBlur}
					required={column.required}
				/>
			);
		case 'date':
			return (
				<Input
					type="date"
					className="w-full h-full rounded-none border-none focus-visible:ring-orange-primary/40 z-100 absolute top-0 left-0 focus-visible:ring-offset-1 children-input-hidden"
					value={value ?? ""}
					onChange={(event) => setValue(event.target.value)}
					onBlur={handleBlur}
					required={column.required}
				/>
			);
		case 'boolean':
		case 'checkbox':
			return (
				<div className="flex items-center gap-2 w-full h-full justify-center ">
					<Checkbox
						checked={Boolean(value)}
						onCheckedChange={(checked) => {
							setValue(Boolean(checked));
							config.onToggle?.(Boolean(checked), row);
						}}
					/>
					<span className="text-xs text-muted-foreground">
						{Boolean(value) ? 'Sí' : 'No'}
					</span>
				</div>
			);
		case 'toggle':
			return (
				<div className="flex items-center gap-2 children-input-shown">
					<Switch
						checked={Boolean(value)}
						onCheckedChange={(checked) => {
							setValue(checked);
							config.onToggle?.(checked, row);
						}}
					/>
					<span className="text-xs text-muted-foreground">
						{checkedLabel(Boolean(value))}
					</span>
				</div>
			);
		case 'tags': {
			const tagsStr = String(value ?? '');
			const tags = tagsStr
				? (config.tagSeparator
					? tagsStr.split(config.tagSeparator).map((t) => t.trim()).filter(Boolean)
					: [tagsStr])
				: [];
			return (
				<div className="space-y-1 w-full h-full">
					<Input
						value={tagsStr}
						className="w-full h-full rounded-none border-none focus-visible:ring-orange-primary/40 z-100 absolute top-0 left-0 focus-visible:ring-offset-1 focus-visible:opacity-100 opacity-0 peer children-input-hidden"
						onChange={(event) => setValue(event.target.value)}
						onBlur={handleBlur}
						placeholder="Ej: diseño, arquitectura"
					/>
					{tags.length > 0 && (
						<div className="flex flex-wrap gap-1 w-full h-full peer-focus:opacity-0 opacity-100 p-3 ">
							{tags.map((tag) => (
								<Badge key={tag} variant={config.tagVariant || 'secondary'} className="max-h-6 children-input-shown">
									<HighlightedText text={tag} query={highlightQuery} />
								</Badge>
							))}
						</div>
					)}
				</div>
			);
		}
		case 'link': {
			const text = String(value ?? '');
			const href =
				typeof config.href === 'function'
					? config.href(row)
					: text || config.href || '#';
			return (
				<div className="space-y-1 overflow-hidden">
					<Input
						className="w-full h-full rounded-none border-none focus-visible:ring-orange-primary/40 z-100 absolute top-0 left-0 focus-visible:ring-offset-1 peer opacity-0 focus-visible:opacity-100 children-input-hidden "
						value={text}
						onChange={(event) => setValue(event.target.value)}
						onBlur={handleBlur}
						placeholder="https://..."
						required={column.required}
					/>
					{text && (
						<a
							href={href}
							target={config.target || '_blank'}
							rel={config.target === '_blank' ? 'noopener noreferrer' : undefined}
							className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline w-full h-full justify-center peer-focus:opacity-0 opacity-100 p-3 absolute top-0 left-0 overflow-hidden  ring-offset-0 z-10 children-input-shown"
						>
							<HighlightedText text={text} query={highlightQuery} />
							<ExternalLink className="w-3 h-3" />
						</a>
					)}
				</div>
			);
		}
		case 'avatar': {
			const text = String(value ?? '');
			const fallback =
				typeof config.avatarFallback === 'function'
					? config.avatarFallback(row)
					: config.avatarFallback || text.substring(0, 2).toUpperCase();
			return (
				<div className="flex items-center gap-3">
					<Avatar className="w-8 h-8 shrink-0">
						<AvatarImage src={text} alt={fallback} />
						<AvatarFallback>{fallback}</AvatarFallback>
					</Avatar>
					<Input
						value={text}
						onChange={(event) => setValue(event.target.value)}
						onBlur={handleBlur}
						placeholder="https://..."
					/>
				</div>
			);
		}
		case 'image': {
			const src = String(value ?? '');
			return (
				<div className="flex items-center gap-3">
					<div className="h-10 w-10 overflow-hidden rounded border bg-muted">
						{src ? (
							<img src={src} alt="Vista previa" className="h-full w-full object-cover" />
						) : (
							<span className="text-[10px] text-muted-foreground block text-center leading-10">
								Sin imagen
							</span>
						)}
					</div>
					<Input
						value={src}
						onChange={(event) => setValue(event.target.value)}
						onBlur={handleBlur}
						placeholder="https://..."
					/>
				</div>
			);
		}
		case 'badge':
			return (
				<div className="space-y-1">
					<Input
						value={value ?? ""}
						onChange={(event) => setValue(event.target.value)}
						onBlur={handleBlur}
						className="w-full h-full rounded-none border-none focus-visible:ring-orange-primary/40 z-100 absolute top-0 left-0 focus-visible:ring-offset-1 peer opacity-0 focus-visible:opacity-100 children-input-hidden"
					/>
					<div className="peer-focus:opacity-0 opacity-100 p-3 children-input-shown">{renderReadOnlyValue(value, row, column, highlightQuery)}</div>
				</div>
			);
		case 'text-icon':
			return (
				<div className="space-y-1 children-input-hidden">
					<Input
						value={value ?? ""}
						onChange={(event) => setValue(event.target.value)}
						onBlur={handleBlur}
					/>
					<div>{renderReadOnlyValue(value, row, column, highlightQuery)}</div>
				</div>
			);
		default:
			return (
				<Input
					className="w-full h-full rounded-none border-none focus-visible:ring-orange-primary/40 z-100 absolute top-0 left-0 focus-visible:ring-offset-1 children-input-hidden"
					value={value ?? ""}
					onChange={(event) => setValue(event.target.value)}
					onBlur={handleBlur}
					required={column.required}
				/>
			);
	}
}

function renderCellByType<Row extends FormTableRow>({
	column,
	row,
	rowId,
	FieldComponent,
	highlightQuery,
	isCellDirty,
	isRowDirty,
	onCopyCell,
	onCopyColumn,
	onCopyRow,
	onClearValue,
	onRestoreValue,
	canRestore,
	customMenuItems,
}: RenderCellArgs<Row>): ReactNode {
	const fieldPath = `rowsById.${rowId}.${column.field}` as const;
	const editable = column.editable !== false;
	const validators = column.validators;

	return (
		<FieldComponent name={fieldPath} validators={validators}>
			{(field: any) => {
				const fieldValue = field.state.value;
				const setValue = (value: unknown) => field.handleChange(value);
				const errorMessage = field.state.meta?.errors?.[0];
				const content = editable
					? renderEditableContent({
						column,
						row,
						value: fieldValue as EditableCellValue,
						setValue,
						handleBlur: field.handleBlur,
						highlightQuery,
					})
					: renderReadOnlyValue(fieldValue, row, column, highlightQuery);

				const body = (
					<div
						className={cn(
							"transition-colors absolute top-0 left-0 w-full h-full ",
							isRowDirty
								? "outline outline-amber-500/50 bg-amber-50/60 shadow-sm"
								: "",
							isCellDirty
								? "outline outline-amber-600/50  bg-[repeating-linear-gradient(-60deg,transparent_0%,transparent_5px,var(--color-amber-200)_5px,var(--color-amber-200)_6px,transparent_6px)] bg-repeat"
								: ""
						)}
					>
						{content}
						{editable && errorMessage && (
							<p className="text-xs text-destructive">{errorMessage}</p>
						)}
					</div>
				);

				return (
					<ContextMenu>
						<ContextMenuTrigger className="[&[data-state=open]_.children-input-hidden]:ring-2 [&[data-state=open]_.children-input-hidden]:ring-orange-primary/40 [&[data-state=open]_.children-input-shown]:opacity-0 [&[data-state=open]_.children-input-hidden]:opacity-100">
							<>{body}</>
						</ContextMenuTrigger>
						<ContextMenuContent className="w-56 z-[10000000]">
							{canRestore && onRestoreValue && (
								<>
									<ContextMenuItem onClick={onRestoreValue} className="bg-amber-100/50  rounded-none ">
										Restaurar valor previo
									</ContextMenuItem>
									<ContextMenuSeparator />
								</>
							)}
							<ContextMenuItem onClick={() => onCopyCell(fieldValue)}>
								Copiar valor
							</ContextMenuItem>
							<ContextMenuItem onClick={onCopyColumn}>Copiar columna</ContextMenuItem>
							<ContextMenuItem onClick={onCopyRow}>Copiar fila (CSV)</ContextMenuItem>
							{editable && (
								<ContextMenuItem onClick={onClearValue}>
									Limpiar valor
								</ContextMenuItem>
							)}
							{customMenuItems && customMenuItems.length > 0 && (
								<>
									<ContextMenuSeparator />
									{customMenuItems.map((item) => (
										<ContextMenuItem
											key={item.id}
											onClick={() => item.onSelect?.(row)}
										>
											{item.label}
										</ContextMenuItem>
									))}
								</>
							)}
						</ContextMenuContent>
					</ContextMenu>
				);
			}}
		</FieldComponent>
	);
}
function checkedLabel(value: boolean) {
	return value ? "Activo" : "Inactivo";
}

type FormTableProps<Row extends FormTableRow, Filters> = {
	config: FormTableConfig<Row, Filters>;
};

export function FormTable<Row extends FormTableRow, Filters>({
	config,
}: FormTableProps<Row, Filters>) {
	const TABLE_ID = config.tableId;

	// TanStack Form setup
	const form = useForm<
		FormValues<Row>,
		undefined,
		undefined,
		undefined,
		undefined,
		undefined,
		undefined,
		undefined,
		undefined,
		undefined,
		undefined,
		undefined
	>({
		defaultValues: {
			rowOrder: [],
			rowsById: {},
		},
	});
	const setFormFieldValue = form.setFieldValue as (path: string, updater: any) => void;

	const rowOrderSelector = useCallback<(state: AnyFormState) => string[]>(
		(state) => (state.values?.rowOrder as string[]) ?? [],
		[]
	);
	const rowsByIdSelector = useCallback<(state: AnyFormState) => Record<string, Row>>(
		(state) => (state.values?.rowsById as Record<string, Row>) ?? {},
		[]
	);

	const rowOrder = useStore(form.store, rowOrderSelector);
	const rowsById = useStore(form.store, rowsByIdSelector);
	const [isSaving, setIsSaving] = useState(false);
	const [page, setPage] = useState(1);
	const initialPageSize = config.defaultPageSize ?? DEFAULT_PAGE_SIZE;
	const [pageSize, setPageSize] = useState(initialPageSize);
	const [isServerPaging, setIsServerPaging] = useState(Boolean(config.fetchRows));
	const [isFetchingServerRows, setIsFetchingServerRows] = useState(false);
	const [serverError, setServerError] = useState<string | null>(null);
	const [serverMeta, setServerMeta] = useState<ServerPaginationMeta>({
		page: 1,
		limit: initialPageSize,
		total: 0,
		totalPages: 1,
		hasNextPage: false,
		hasPreviousPage: false,
	});
	const initialValuesRef = useRef<FormValues<Row>>({ rowOrder: [], rowsById: {} });
	const columns = config.columns;
	const headerGroups = config.headerGroups ?? [];
	const tabFilters = config.tabFilters ?? [{ id: "all", label: "Todas" }];
	const searchPlaceholder = config.searchPlaceholder ?? "Buscar...";

	const [searchValue, setSearchValue] = useState("");
	const searchRef = useRef(searchValue.trim());
	useEffect(() => {
		searchRef.current = searchValue.trim();
	}, [searchValue]);
	const [activeTab, setActiveTab] = useState<string>(tabFilters[0]?.id ?? "all");
	useEffect(() => {
		setActiveTab(tabFilters[0]?.id ?? "all");
	}, [tabFilters]);
	const [isFiltersOpen, setIsFiltersOpen] = useState(false);
	const createFilters = useCallback(() => config.createFilters(), [config]);
	const [filters, setFilters] = useState<Filters>(() => createFilters());
	const [filtersDraft, setFiltersDraft] = useState<Filters>(() => createFilters());
	const filtersRef = useRef(filters);
	useEffect(() => {
		filtersRef.current = filters;
	}, [filters]);
	useEffect(() => {
		const initialFilters = createFilters();
		setFilters(initialFilters);
		setFiltersDraft(initialFilters);
	}, [createFilters]);
	useEffect(() => {
		if (!isFiltersOpen) return;
		setFiltersDraft(filters);
	}, [isFiltersOpen, filters]);
	const [sortState, setSortState] = useState<SortState>({ columnId: null, direction: "asc" });
	const [colWidths, setColWidths] = useState<Record<number, number>>({});
	const colRefs = useRef<(HTMLTableColElement | null)[]>([]);

	const setFormRows = useCallback(
		(nextRows: Row[]) => {
			const nextOrder = nextRows.map((row) => row.id);
			const nextMap = nextRows.reduce<Record<string, Row>>((acc, row) => {
				acc[row.id] = { ...row };
				return acc;
			}, {});
			setFormFieldValue("rowOrder", nextOrder);
			setFormFieldValue("rowsById", nextMap);
			initialValuesRef.current = snapshotValues(nextOrder, nextMap);
		},
		[form]
	);

	const rows = useMemo(() => {
		return rowOrder.map((id) => rowsById[id]).filter((row): row is Row => Boolean(row));
	}, [rowOrder, rowsById]);

	useEffect(() => {
		if (initialValuesRef.current.rowOrder.length === 0 && rowOrder.length > 0) {
			initialValuesRef.current = snapshotValues(rowOrder, rowsById);
		}
	}, [rowOrder, rowsById]);

	useEffect(() => {
		const fetchRows = config.fetchRows;
		if (!fetchRows) return;
		setIsServerPaging(true);
		let isMounted = true;
		const run = async () => {
			setIsFetchingServerRows(true);
			setServerError(null);
			try {
				const result = await fetchRows({
					page,
					limit: pageSize,
					filters: filtersRef.current,
					search: searchRef.current,
				});
				if (!isMounted) return;
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
				if (!isMounted) return;
				console.error("Error fetching rows", error);
				setServerError(
					error instanceof Error ? error.message : "No se pudo obtener la página solicitada"
				);
			} finally {
				if (isMounted) {
					setIsFetchingServerRows(false);
				}
			}
		};
		void run();
		return () => {
			isMounted = false;
		};
	}, [config, page, pageSize, setFormRows]);

	useEffect(() => {
		if (config.fetchRows) return;
		setIsServerPaging(false);
		if (config.defaultRows) {
			setFormRows(config.defaultRows);
		}
	}, [config, setFormRows]);

	const getInitialRow = useCallback(
		(rowId: string) => initialValuesRef.current.rowsById[rowId],
		[]
	);

	const getInitialCellValue = useCallback(
		(rowId: string, column: ColumnDef<Row>) =>
			initialValuesRef.current.rowsById[rowId]?.[column.field],
		[]
	);

	const isCellDirty = useCallback(
		(rowId: string, column: ColumnDef<Row>) => {
			const initialRow = getInitialRow(rowId);
			const currentRow = rowsById[rowId];
			if (!currentRow) return false;
			if (!initialRow) return true;
			const field = column.field;
			const currentValue = currentRow[field];
			const initialValue = initialRow[field];
			return !shallowEqualValues(currentValue, initialValue);
		},
		[getInitialRow, rowsById]
	);

	const isRowDirty = useCallback(
		(rowId: string) => {
			//make it return true if any cell is dirty and then an array of the dirty cells 
			const initialRow = getInitialRow(rowId);
			const currentRow = rowsById[rowId];
			const dirtyCells: ColumnDef<Row>[] = [];
			if (!currentRow) return { dirty: false, cells: [] };
			if (!initialRow) return { dirty: true, cells: [] };
			for (const column of columns) {
				if (column.field && column.field !== ("id" as any)) {
					if (!shallowEqualValues(currentRow[column.field], initialRow[column.field])) {
						dirtyCells.push(column);
					}
				}
			}
			return { dirty: dirtyCells.length > 0, cells: dirtyCells };
		},
		[getInitialRow, rowsById, columns]
	);

	const hasUnsavedChanges = useMemo(
		() => rowOrder.some((rowId) => isRowDirty(rowId).dirty ?? false),
		[rowOrder, isRowDirty]
	);

	useEffect(() => {
		if (typeof window === "undefined") return;
		try {
			const stored = localStorage.getItem(`resizable-cols:${TABLE_ID}`);
			if (stored) {
				const parsed = JSON.parse(stored) as Record<number, number>;
				setColWidths(parsed);
			}
		} catch {
			// ignore
		}
	}, [TABLE_ID]);

	// Column management state
	const [hiddenColumnIds, setHiddenColumnIds] = useState<string[]>(() =>
		readPersistedArray(`${TABLE_ID}:hidden`)
	);
	const [pinnedColumnIds, setPinnedColumnIds] = useState<string[]>(() =>
		readPersistedArray(`${TABLE_ID}:pinned`)
	);
	const [columnOffsets, setColumnOffsets] = useState<Record<string, number>>({});
	const tableRef = useRef<HTMLTableElement | null>(null);

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

	const normalizedSearch = searchValue.trim().toLowerCase();
	const highlightQuery = normalizedSearch;

	const matchesGlobalSearch = useCallback(
		(row: Row) => {
			if (!normalizedSearch) return true;
			return columns.some((column) => {
				if (column.searchFn) {
					return column.searchFn(row, normalizedSearch);
				}
				const rawValue = row[column.field];
				return defaultSearchMatcher(rawValue, normalizedSearch);
			});
		},
		[normalizedSearch, columns]
	);

	const searchFilteredRows = useMemo(
		() => rows.filter((row) => matchesGlobalSearch(row)),
		[rows, matchesGlobalSearch]
	);

	const advancedFilteredRows = useMemo(() => {
		const applyFilters = config.applyFilters;
		if (!applyFilters) return searchFilteredRows;
		return searchFilteredRows.filter((row) => applyFilters(row, filters));
	}, [searchFilteredRows, config, filters]);

	const tabCounts = useMemo(() => {
		const counts: Record<string, number> = {};
		tabFilters.forEach((tab) => {
			counts[tab.id] = tab.predicate
				? advancedFilteredRows.filter(tab.predicate).length
				: advancedFilteredRows.length;
		});
		return counts;
	}, [advancedFilteredRows, tabFilters]);

	const tabFilteredRows = useMemo(() => {
		const currentTab = tabFilters.find((tab) => tab.id === activeTab);
		if (!currentTab?.predicate) {
			return advancedFilteredRows;
		}
		return advancedFilteredRows.filter(currentTab.predicate);
	}, [advancedFilteredRows, activeTab, tabFilters]);

	const sortedRows = useMemo(() => {
		if (!sortState.columnId) return tabFilteredRows;
		const column = columns.find((col) => col.id === sortState.columnId);
		if (!column) return tabFilteredRows;
		const comparator = column.sortFn ?? defaultSortByField<Row>(column.field);
		const sorted = [...tabFilteredRows].sort((a, b) => comparator(a, b));
		return sortState.direction === "asc" ? sorted : sorted.reverse();
	}, [tabFilteredRows, sortState]);

	const activeFilterCount = useMemo(() => {
		if (!config.countActiveFilters) return 0;
		return config.countActiveFilters(filters);
	}, [config, filters]);

	// Persist hidden columns
	useEffect(() => {
		writePersistedArray(`${TABLE_ID}:hidden`, hiddenColumnIds);
	}, [hiddenColumnIds]);

	// Persist pinned columns
	useEffect(() => {
		writePersistedArray(`${TABLE_ID}:pinned`, pinnedColumnIds);
	}, [pinnedColumnIds]);

	// Clean up and sort pinned columns
	useEffect(() => {
		setPinnedColumnIds((prev) => {
			const next = prev.filter((id) => pinnableColumns.has(id));
			next.sort((a, b) => {
				const indexA = columnIndexMap[a] ?? Number.MAX_SAFE_INTEGER;
				const indexB = columnIndexMap[b] ?? Number.MAX_SAFE_INTEGER;
				return indexA - indexB;
			});
			return next;
		});
	}, [pinnableColumns, columnIndexMap]);

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
			const colEl = colRefs.current[colIndex];
			const width = colEl?.getBoundingClientRect().width || colWidths[colIndex] || DEFAULT_COL_WIDTH;
			offsets[columnId] = accumulator;
			accumulator += width;
		});
		setColumnOffsets(offsets);
	}, [pinnedColumnIds, isColumnHidden, columnIndexMap, colWidths]);

	useEffect(() => {
		recalcPinnedOffsets();
	}, [recalcPinnedOffsets]);

	useEffect(() => {
		const handleResize = () => recalcPinnedOffsets();
		window.addEventListener("resize", handleResize);
		const table = tableRef.current;
		const handleColumnResize = () => recalcPinnedOffsets();
		if (table) {
			table.addEventListener("columnResized", handleColumnResize as EventListener);
		}
		return () => {
			window.removeEventListener("resize", handleResize);
			if (table) {
				table.removeEventListener("columnResized", handleColumnResize as EventListener);
			}
		};
	}, [recalcPinnedOffsets]);

	useEffect(() => {
		const table = tableRef.current;
		if (!table) return;
		const handler = (event: Event) => {
			const detail = (event as CustomEvent)?.detail as {
				tableId?: string;
				colIndex?: number;
				newWidth?: number;
			};
			if (!detail || detail.tableId !== TABLE_ID) return;
			const { colIndex, newWidth } = detail;
			if (typeof colIndex !== "number" || typeof newWidth !== "number") return;
			setColWidths((prev) => {
				if (prev[colIndex] === newWidth) return prev;
				return { ...prev, [colIndex]: newWidth };
			});
		};
		table.addEventListener("columnResized", handler as EventListener);
		return () => {
			table.removeEventListener("columnResized", handler as EventListener);
		};
	}, [TABLE_ID]);

	const getStickyProps = useCallback(
		(columnId: string, baseClassName?: string) => {
			const offset = columnOffsets[columnId];
			const pinned = isColumnPinned(columnId);
			return {
				className: cn(
					baseClassName,
					pinned && offset !== undefined ? "sticky z-20 outline outline-orange-primary/60" : ""
				),
				style: {
					left: pinned && offset !== undefined ? `${offset}px` : undefined,
				},
			};
		},
		[columnOffsets, isColumnHidden, isColumnPinned]
	);

	const hiddenIndices = useMemo(
		() =>
			hiddenColumnIds
				.filter((columnId) => hideableColumns.has(columnId))
				.map((columnId) => columnIndexMap[columnId])
				.filter((value): value is number => typeof value === "number"),
		[hiddenColumnIds, hideableColumns, columnIndexMap]
	);

	const handleBalanceColumns = useCallback(() => {
		balanceTableColumns(TABLE_ID, {
			hiddenCols: hiddenIndices,
			minVisibleWidth: 100,
		});
	}, [hiddenIndices]);

	const handleApplyAdvancedFilters = useCallback(() => {
		setFilters(filtersDraft);
		setIsFiltersOpen(false);
	}, [filtersDraft]);

	const handleResetAdvancedFilters = useCallback(() => {
		const initial = createFilters();
		setFilters(initial);
		setFiltersDraft(initial);
	}, [createFilters]);

	const renderFilters = config.renderFilters
		? config.renderFilters({
			filters: filtersDraft,
			onChange: (updater) => setFiltersDraft((prev) => updater(prev)),
		})
		: null;

	const toggleSort = useCallback((columnId: string) => {
		setSortState((prev) => {
			if (prev.columnId !== columnId) {
				return { columnId, direction: "asc" };
			}
			if (prev.direction === "asc") {
				return { columnId, direction: "desc" };
			}
			return { columnId: null, direction: "asc" };
		});
	}, []);

	const applySortDirection = useCallback((columnId: string, direction: "asc" | "desc") => {
		setSortState({ columnId, direction });
	}, []);

	const clearSort = useCallback(() => {
		setSortState({ columnId: null, direction: "asc" });
	}, []);

	const clientTotalPages = useMemo(() => {
		if (sortedRows.length === 0) return 1;
		return Math.max(1, Math.ceil(sortedRows.length / pageSize));
	}, [sortedRows.length, pageSize]);

	useEffect(() => {
		if (!isServerPaging && page > clientTotalPages) {
			setPage(clientTotalPages);
		}
	}, [clientTotalPages, isServerPaging, page]);

	const processedRows = useMemo(() => {
		if (isServerPaging) {
			return sortedRows;
		}
		const start = (page - 1) * pageSize;
		return sortedRows.slice(start, start + pageSize);
	}, [isServerPaging, page, pageSize, sortedRows]);

	const processedRowsRef = useRef<Row[]>(processedRows);
	useEffect(() => {
		processedRowsRef.current = processedRows;
	}, [processedRows]);

	const datasetTotalCount = isServerPaging
		? serverMeta.total || processedRows.length
		: sortedRows.length;

	const totalPages = isServerPaging
		? serverMeta.totalPages || 1
		: clientTotalPages;

	const hasNextPage = isServerPaging
		? serverMeta.hasNextPage
		: page < clientTotalPages;
	const hasPreviousPage = isServerPaging
		? serverMeta.hasPreviousPage
		: page > 1;

	const totalRowCount = datasetTotalCount;
	const visibleRowCount = processedRows.length;

	const FieldComponent = form.Field as FormFieldComponent<Row>;

	const handleClearCell = useCallback(
		(rowId: string, column: ColumnDef<Row>) => {
			if (column.editable === false) return;
			const clearedValue = getClearedValue(column);
			setFormFieldValue(`rowsById.${rowId}.${column.field}` as const, () => clearedValue as Row[ColumnField<Row>]);
		},
		[form]
	);

	const handleRestoreCell = useCallback(
		(rowId: string, column: ColumnDef<Row>) => {
			const initialRow = initialValuesRef.current.rowsById[rowId];
			if (!initialRow) return;
			const initialValue = initialRow[column.field];
			setFormFieldValue(`rowsById.${rowId}.${column.field}` as const, () => initialValue as Row[ColumnField<Row>]);
		},
		[form]
	);

	const handleCopyCell = useCallback(async (value: unknown) => {
		const success = await copyToClipboard(value == null ? "" : String(value));
		toast[success ? "success" : "error"](
			success ? "Valor copiado al portapapeles" : "No se pudo copiar"
		);
	}, []);

	const handleCopyColumn = useCallback(async (column: ColumnDef<Row>) => {
		const snapshot = processedRowsRef.current;
		const values = snapshot.map((row) => row[column.field] ?? "").join("\n");
		const success = await copyToClipboard(values);
		toast[success ? "success" : "error"](
			success ? "Columna copiada" : "No se pudo copiar la columna"
		);
	}, []);

	const handleCopyRow = useCallback(async (row: Row) => {
		const success = await copyToClipboard(tableRowToCsv(row, columns));
		toast[success ? "success" : "error"](
			success ? "Fila copiada en CSV" : "No se pudo copiar la fila"
		);
	}, [columns]);

	// TanStack Table column definitions (static)
	const tableColumns = useMemo<TanStackColumnDef<Row>[]>(() => {
		return columns.map((col) => ({
			id: col.id,
			accessorKey: col.field,
			header: col.label,
			cell: (info) => info.getValue() ?? "",
		}));
	}, [columns]);

	// TanStack Table column visibility state
	const columnVisibility = useMemo<VisibilityState>(() => {
		const state: VisibilityState = {};
		hiddenColumnIds.forEach((id) => {
			state[id] = false;
		});
		return state;
	}, [hiddenColumnIds]);

	// TanStack Table instance
	const table = useReactTable({
		data: processedRows,
		columns: tableColumns,
		getCoreRowModel: getCoreRowModel(),
		getRowId: (row) => row.id,
		state: {
			columnVisibility,
		},
		onColumnVisibilityChange: (updater) => {
			const newVisibility = typeof updater === 'function' ? updater(columnVisibility) : updater;
			const hidden = Object.keys(newVisibility).filter((key) => !newVisibility[key]);
			setHiddenColumnIds(hidden);
		},
		enableColumnResizing: false, // We handle resizing manually
		columnResizeMode: 'onChange',
	});

	const handleAddRow = useCallback(() => {
		const newRow = config.createRow ? config.createRow() : createRowFromColumns(columns);
		setFormFieldValue("rowOrder", (prev: string[] = []) => [...prev, newRow.id]);
		setFormFieldValue("rowsById", (prev: Record<string, Row> = {}) => ({
			...prev,
			[newRow.id]: newRow,
		}));
		toast.success("Fila vacía agregada");
	}, [columns, config, form]);

	const handleDelete = useCallback((id: string) => {
		setFormFieldValue("rowOrder", (prev: string[] = []) => prev.filter((rowId) => rowId !== id));
		setFormFieldValue("rowsById", (prev: Record<string, Row> = {}) => {
			if (!(id in prev)) return prev;
			const next = { ...prev };
			delete next[id];
			return next;
		});
		toast.success("Fila eliminada");
	}, [form]);

	const handleSave = useCallback(async () => {
		if (!hasUnsavedChanges) return;
		setIsSaving(true);
		try {
			if (config.onSave) {
				const dirtyRows = rows.filter((row) => isRowDirty(row.id).dirty);
				await config.onSave({ rows, dirtyRows });
			} else {
				await new Promise((resolve) => setTimeout(resolve, 900));
			}
			initialValuesRef.current = snapshotValues(rowOrder, rowsById);
			toast.success("Cambios guardados correctamente");
		} catch (error) {
			console.error("Error saving rows", error);
			toast.error("No se pudieron guardar los cambios");
		} finally {
			setIsSaving(false);
		}
	}, [config, hasUnsavedChanges, isRowDirty, rowOrder, rows, rowsById]);

	return (
		<TooltipProvider delayDuration={200}>
			<div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
				<div className="container mx-auto px-4 py-8 md:max-w-[calc(98vw-var(--sidebar-current-width))]">
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						className="space-y-2"
					>
						<div>
							<h1 className="text-3xl font-bold">{config.title}</h1>
							{config.description && (
								<p className="text-muted-foreground">{config.description}</p>
							)}
						</div>

						{/* <div className="rounded-lg border bg-card p-6 space-y-4">
							<h2 className="text-xl font-semibold">Características Disponibles:</h2>
							<ul className="space-y-2 text-sm grid grid-cols-1 md:grid-cols-2 gap-3">
							<li className="flex items-start gap-2">
								<span className="text-blue-600">⚡</span>
								<span><strong>TanStack Table:</strong> Gestión reactiva de tabla y columnas</span>
							</li>
							<li className="flex items-start gap-2">
								<span className="text-blue-600">⚡</span>
								<span><strong>TanStack Form:</strong> Estado de formulario con validación</span>
							</li>
							<li className="flex items-start gap-2">
								<span className="text-purple-600">🎨</span>
								<span><strong>Cell Types:</strong> 14 tipos de celdas (text, number, currency, date, boolean, checkbox, toggle, tags, link, avatar, image, icon, badge, text-icon)</span>
							</li>
							<li className="flex items-start gap-2">
								<span className="text-green-600">✓</span>
								<span><strong>Encabezados Agrupados:</strong> Múltiples niveles de encabezados</span>
							</li>
							<li className="flex items-start gap-2">
								<span className="text-green-600">✓</span>
								<span><strong>Visibilidad:</strong> TanStack column visibility integrada</span>
							</li>
							<li className="flex items-start gap-2">
								<span className="text-green-600">✓</span>
								<span><strong>Fijado:</strong> Fija columnas (ícono pin) para scroll horizontal</span>
							</li>
							<li className="flex items-start gap-2">
								<span className="text-green-600">✓</span>
								<span><strong>Redimensionar:</strong> Arrastra bordes de encabezados</span>
							</li>
							<li className="flex items-start gap-2">
								<span className="text-green-600">✓</span>
								<span><strong>Auto-ajuste:</strong> Doble click en borde para ajustar contenido</span>
							</li>
							<li className="flex items-start gap-2">
								<span className="text-green-600">✓</span>
								<span><strong>Rebalancear:</strong> Distribuye espacio equitativamente</span>
							</li>
							<li className="flex items-start gap-2">
								<span className="text-green-600">✓</span>
								<span><strong>Persistencia:</strong> Preferencias guardadas en localStorage</span>
							</li>
						</ul>
					</div> */}

						{/* Toolbar with Column Management */}
						<div className="flex flex-wrap items-center justify-between gap-3">
							<div className="flex flex-wrap items-center gap-2">
								<div className="relative">
									<SearchIcon className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
									<Input
										className="w-64 pl-8"
										value={searchValue}
										onChange={(event) => setSearchValue(event.target.value)}
										placeholder={searchPlaceholder}
									/>
								</div>
								<Sheet open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
									<SheetTrigger asChild>
										<Button
											type="button"
											variant={activeFilterCount > 0 ? "default" : "outline"}
											size="sm"
											className="gap-2"
										>
											<Filter className="h-4 w-4" />
											<span>Filtros avanzados</span>
											{activeFilterCount > 0 && (
												<Badge variant="secondary" className="ml-1">
													{activeFilterCount}
												</Badge>
											)}
										</Button>
									</SheetTrigger>
									<SheetContent
										side="right"
										className="sm:w-[420px] w-[90vw] my-auto max-h-[96vh] overflow-y-auto px-6 py-7"
									>
										<SheetHeader>
											<SheetTitle>Filtros avanzados</SheetTitle>
										</SheetHeader>
										<div className="mt-6 space-y-5">
											{renderFilters ?? (
												<p className="text-sm text-muted-foreground">
													No hay filtros configurados para esta vista.
												</p>
											)}
										</div>
										<SheetFooter className="mt-6 gap-2">
											<Button type="button" variant="outline" onClick={handleResetAdvancedFilters}>
												Reiniciar
											</Button>
											<Button type="button" onClick={handleApplyAdvancedFilters}>
												Aplicar
											</Button>
										</SheetFooter>
									</SheetContent>
								</Sheet>
								<ColumnVisibilityMenu
									columns={columns.map((column) => ({
										id: column.id,
										label: column.label,
										canHide: column.enableHide !== false,
										canPin: column.enablePin !== false,
									}))}
									hiddenColumns={hiddenColumnIds}
									setHiddenColumns={setHiddenColumnIds}
									pinnedColumns={pinnedColumnIds}
									togglePin={togglePinColumn}
									onBalanceColumns={handleBalanceColumns}
									disabled={false}
								/>
							</div>
							<div className="flex flex-wrap items-center gap-2">
								{sortState.columnId && (
									<Button type="button" variant="ghost" size="sm" className="gap-1" onClick={clearSort}>
										<Minus className="h-4 w-4" />
										Limpiar orden
									</Button>
								)}
								<Button
									type="button"
									onClick={handleSave}
									disabled={!hasUnsavedChanges || isSaving}
									variant={hasUnsavedChanges ? "default" : "outline"}
									className="gap-2"
								>
									{isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
									{isSaving ? "Guardando..." : "Guardar cambios"}
								</Button>
								<Button type="button" onClick={handleAddRow}>
									Agregar fila vacía
								</Button>
							</div>
						</div>

						{isServerPaging && serverError && (
							<div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
								{serverError}
							</div>
						)}

						<Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
							<TabsList>
								{tabFilters.map((tab) => (
									<TabsTrigger key={tab.id} value={tab.id} className="gap-2">
										<span>{tab.label}</span>
										<span className="rounded-full bg-muted px-2 py-0.5 text-xs">
											{tabCounts[tab.id] ?? 0}
										</span>
									</TabsTrigger>
								))}
							</TabsList>
						</Tabs>

						{/* Table */}
						<div className="relative border border-border rounded-lg overflow-x-auto w-full bg-white">
							{isServerPaging && isFetchingServerRows && (
								<div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-background/70 backdrop-blur-sm">
									<Loader2 className="h-6 w-6 animate-spin text-primary" />
									<p className="text-sm font-medium text-muted-foreground">Sincronizando con el servidor…</p>
								</div>
							)}
							<div className="max-h-[70vh] overflow-auto bg-[repeating-linear-gradient(-60deg,transparent_0%,transparent_5px,var(--border)_5px,var(--border)_6px,transparent_6px)] bg-repeat min-h-[70vh]">
								<table ref={tableRef} data-table-id={TABLE_ID} className="w-full table-fixed text-sm">
									<colgroup>
										{columns.map((column, index) => (
											// eslint-disable-next-line jsx-a11y/aria-role
											<col
												key={column.id}
												ref={(el) => {
													colRefs.current[index] = el;
												}}
												style={{
													width: `${colWidths[index] ?? DEFAULT_COL_WIDTH}px`,
													display: isColumnHidden(column.id) ? "none" : undefined,
												}}
											/>
										))}
										<col
											ref={(el) => {
												colRefs.current[columns.length] = el;
											}}
											style={{
												width: `${colWidths[columns.length] ?? 140}px`,
											}}
										/>
									</colgroup>
									<thead className="sticky top-0 z-30 bg-sidebar">
										{/* Header Groups Row */}
										<tr>
											{(() => {
												const emittedGroups = new Set<string>();
												return (
													<>
														{columns.map((column) => {
															if (isColumnHidden(column.id)) return null;
															const group = groupedColumnLookup.get(column.id);
															if (!group) {
																return (
																	<th
																		key={`no-group-${column.id}`}
																		rowSpan={2}
																		{...getStickyProps(
																			column.id,
																			"relative px-4 py-4 text-left text-xs font-semibold uppercase outline outline-border bg-sidebar"
																		)}
																	>
																		<div className="flex w-full h-full px-4 py-3 absolute top-0 left-0 items-center justify-between gap-2">
																			<ContextMenu>
																				<ContextMenuTrigger asChild>
																					<button
																						type="button"
																						onClick={() => toggleSort(column.id)}
																						className="flex w-full items-center justify-between gap-2 text-left"
																					>
																						<span>{column.label}</span>
																						<span className="text-muted-foreground">
																							{sortState.columnId === column.id ? (
																								sortState.direction === "asc" ? (
																									<ArrowUp className="h-3.5 w-3.5" />
																								) : (
																									<ArrowDown className="h-3.5 w-3.5" />
																								)
																							) : (
																								<ArrowUpDown className="h-3.5 w-3.5" />
																							)}
																						</span>
																					</button>
																				</ContextMenuTrigger>
																				<ContextMenuContent>
																					<ContextMenuItem onClick={() => applySortDirection(column.id, "asc")}>
																						Orden ascendente
																					</ContextMenuItem>
																					<ContextMenuItem onClick={() => applySortDirection(column.id, "desc")}>
																						Orden descendente
																					</ContextMenuItem>
																					<ContextMenuItem onClick={clearSort}>
																						Quitar orden
																					</ContextMenuItem>
																				</ContextMenuContent>
																			</ContextMenu>
																		</div>
																		<ColumnResizer
																			tableId={TABLE_ID}
																			colIndex={columnIndexMap[column.id]}
																			mode="fixed"
																		/>
																	</th>
																);
															}

															if (emittedGroups.has(group.id)) return null;
															emittedGroups.add(group.id);
															const visibleColumns = group.columns.filter(
																(columnId) => !isColumnHidden(columnId)
															);
															if (visibleColumns.length === 0) return null;

															return (
																<th
																	key={`group-${group.id}`}
																	colSpan={visibleColumns.length}
																	className={cn(
																		"px-4 py-2 text-center text-xs font-semibold uppercase outline outline-border bg-sidebar-accent",
																		group.className
																	)}
																>
																	{group.label}
																</th>
															);
														})}
														<th
															rowSpan={2}
															className="relative px-4 py-4 text-right text-xs font-semibold uppercase outline outline-border bg-sidebar"
														>
															<div className="flex w-full h-full px-4 py-3 absolute top-0 left-0 items-center justify-end gap-2">
																<span>Acciones</span>
															</div>
															<ColumnResizer
																tableId={TABLE_ID}
																colIndex={columns.length}
																mode="fixed"
															/>
														</th>
													</>
												);
											})()}
										</tr>

										{/* Individual Column Headers Row */}
										<tr>
											{columns.map((column, colIndex) => {
												if (isColumnHidden(column.id)) return null;
												if (!groupedColumnLookup.has(column.id)) return null;

												const baseClassName = cn(
													"relative px-4 py-4 text-left text-xs font-semibold uppercase outline outline-border bg-sidebar"
												);

												return (
													<th key={column.id} {...getStickyProps(column.id, baseClassName)}>
														<div className="flex w-full h-full px-4 py-3 absolute top-0 left-0 items-center justify-between gap-2">
															<ContextMenu>
																<ContextMenuTrigger asChild>
																	<button
																		type="button"
																		onClick={() => toggleSort(column.id)}
																		className="flex w-full items-center justify-between gap-2 text-left"
																	>
																		<span>{column.label}</span>
																		<span className="text-muted-foreground">
																			{sortState.columnId === column.id ? (
																				sortState.direction === "asc" ? (
																					<ArrowUp className="h-3.5 w-3.5" />
																				) : (
																					<ArrowDown className="h-3.5 w-3.5" />
																				)
																			) : (
																				<ArrowUpDown className="h-3.5 w-3.5" />
																			)}
																		</span>
																	</button>
																</ContextMenuTrigger>
																<ContextMenuContent>
																	<ContextMenuItem onClick={() => applySortDirection(column.id, "asc")}>
																		Orden ascendente
																	</ContextMenuItem>
																	<ContextMenuItem onClick={() => applySortDirection(column.id, "desc")}>
																		Orden descendente
																	</ContextMenuItem>
																	<ContextMenuItem onClick={clearSort}>
																		Quitar orden
																	</ContextMenuItem>
																</ContextMenuContent>
															</ContextMenu>
														</div>
														<ColumnResizer tableId={TABLE_ID} colIndex={colIndex} mode="fixed" />
													</th>
												);
											})}
										</tr>
									</thead>
									<tbody className="bg-white">
										{table.getRowModel().rows.length === 0 ? (
											<tr>
												<td
													colSpan={columns.length + 1}
													className="px-6 py-12 text-center text-sm text-muted-foreground"
												>
													No encontramos filas que coincidan con tu búsqueda o filtros. Ajusta los criterios o agrega una nueva fila vacía para comenzar.
												</td>
											</tr>
										) : (
											table.getRowModel().rows.map((row, rowIndex) => {
												const { dirty, cells } = isRowDirty(row.original.id);
												const dirtyCellIds = new Set(cells.map((cell) => cell.id));
												const hasInitialRow = Boolean(initialValuesRef.current.rowsById[row.original.id]);
												return (
													<tr
														key={row.original.id}
														className={cn(
															"border-b transition-colors duration-150 group relative",
															rowIndex % 2 === 0 ? "bg-white" : "bg-[hsl(50,17%,98%)]",
															dirty ? "bg-amber-50/60 group/row-dirty" : ""
														)}
													>
														{row.getVisibleCells().map((cell) => {
															const columnId = cell.column.id;
															const columnMeta = columnsById[columnId];
															if (!columnMeta) return null;
															const cellDirty =
																dirtyCellIds.has(columnId) || isCellDirty(row.original.id, columnMeta);
															const baseClassName = cn(
																"outline outline-border border-border relative group-hover:bg-[hsl(50,17%,95%)]",
																rowIndex % 2 === 0 ? "bg-white" : "bg-[hsl(50,17%,98%)]"
															);
															return (
																<td key={cell.id} {...getStickyProps(columnId, baseClassName)}>
																	{renderCellByType({
																		column: columnMeta,
																		row: row.original,
																		rowId: row.original.id,
																		FieldComponent,
																		highlightQuery,
																		isCellDirty: cellDirty,
																		isRowDirty: dirty,
																		onCopyCell: handleCopyCell,
																		onCopyColumn: () => handleCopyColumn(columnMeta),
																		onCopyRow: () => handleCopyRow(row.original),
																		onClearValue:
																			columnMeta.editable === false
																				? undefined
																				: () => handleClearCell(row.original.id, columnMeta),
																		onRestoreValue:
																			cellDirty && hasInitialRow
																				? () => handleRestoreCell(row.original.id, columnMeta)
																				: undefined,
																		canRestore: cellDirty && hasInitialRow,
																		customMenuItems: columnMeta.cellMenuItems,
																	})}
																</td>
															);
														})}
														<td
															className={cn(
																"px-4 py-3 text-right outline outline-border border-border group-hover:bg-[hsl(50,17%,95%)] space-y-2",
																rowIndex % 2 === 0 ? "bg-white" : "bg-[hsl(50,17%,98%)]"
															)}
														>
															{dirty && (
																<Tooltip>
																	<TooltipTrigger asChild>
																		<div className="text-[10px] uppercase tracking-wide absolute p-0 h-5 text-transparent group-hover/row-dirty:text-primary group-hover/row-dirty:px-2 group-hover/row-dirty:py-1 group-hover/row-dirty:max-h-5 group-hover/row-dirty:-top-5 max-h-2 top-0 left-0 z-[100] bg-amber-500/50 group-hover/row-dirty:rounded-t-sm group-hover/row-dirty:rounded-b-none rounded-b-sm transition-all duration-150">
																			Sin guardar
																		</div>
																	</TooltipTrigger>
																	<TooltipContent>
																		Los cambios de esta fila aún no han sido guardados. <br /><br /> Ha modificado las columnas:
																		<ul>
																			{cells.map((cell) => <li key={cell.id}><Badge variant="secondary" className="text-[10px] uppercase tracking-wide">{cell.label}</Badge></li>)}
																		</ul>
																	</TooltipContent>
																</Tooltip>
															)}
															<Button
																type="button"
																variant="ghost"
																size="sm"
																onClick={() => handleDelete(row.original.id)}
																className="text-destructive hover:text-destructive"
															>
																Eliminar
															</Button>
														</td>
													</tr>
												);
											})
										)}
									</tbody>
								</table>
							</div>
						</div>

						<div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
							<div className="flex items-center gap-2">
								<span>Filas por página</span>
								<Select
									value={String(pageSize)}
									onValueChange={(value) => {
										setPageSize(Number(value));
										setPage(1);
									}}
								>
									<SelectTrigger className="w-[90px]">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{PAGE_SIZE_OPTIONS.map((size) => (
											<SelectItem key={size} value={String(size)}>
												{size}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="flex items-center gap-2">
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() => setPage((prev) => Math.max(1, prev - 1))}
									disabled={!hasPreviousPage || (isServerPaging && isFetchingServerRows)}
									className="gap-1"
								>
									<ChevronLeft className="h-4 w-4" />
									Anterior
								</Button>
								<span className="text-xs text-muted-foreground">
									Página {page} de {totalPages}
								</span>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() => setPage((prev) => prev + 1)}
									disabled={!hasNextPage || (isServerPaging && isFetchingServerRows)}
									className="gap-1"
								>
									Siguiente
									<ChevronRight className="h-4 w-4" />
								</Button>
							</div>
						</div>

						{totalRowCount > 0 && (
							<div className="flex justify-between items-center text-sm text-muted-foreground">
								<p>
									Mostrando <span className="font-medium text-foreground">{visibleRowCount}</span> de{" "}
									<span className="font-medium text-foreground">{totalRowCount}</span> filas
								</p>
								{activeFilterCount > 0 && (
									<p className="text-xs">
										Filtros activos: <span className="font-medium text-foreground">{activeFilterCount}</span>
									</p>
								)}
							</div>
						)}
					</motion.div>
				</div>
			</div>
		</TooltipProvider>
	);
}
