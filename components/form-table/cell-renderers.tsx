import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
	findClosestMainTableSelectOption,
	getMainTableSelectOptionId,
	resolveMainTableSelectOption,
	type MainTableSelectOption,
} from "@/lib/main-table-select";
import { parseFlexibleDateValue, parseLocalizedNumber, toNumericValue } from "@/lib/tablas";
import { cn } from "@/lib/utils";
import {
	AlertTriangle,
	Ban,
	Bell,
	Bookmark,
	Calendar as CalendarIcon,
	Check,
	ChevronDown,
	Circle,
	Clock3,
	ExternalLink,
	FileText,
	Flag,
	Info,
	Link2,
	Package,
	Pause,
	Play,
	Shield,
	Star,
	Truck,
	User,
	Wrench,
	X,
} from "lucide-react";
import { type ReactNode } from "react";
import { escapeRegExp, formatDateSafe } from "./table-utils";
import type { ColumnDef, FormTableRow } from "./types";

import { LocalInput, LocalTextarea } from "./cell-buffered-inputs";
import { DateCellEditor } from "./cell-date-editor";
import type { EditableCellValue } from "./types";
export type { EditableCellValue } from "./types";
export type EditableContentArgs<Row extends FormTableRow> = {
	column: ColumnDef<Row>;
	row: Row;
	rowId: string;
	value: EditableCellValue;
	setValue: (value: unknown) => void;
	handleBlur: () => void;
	highlightQuery: string;
	isBulkEditing?: boolean;
};

// Intl formatter construction is expensive (~50-100µs); these are shared across
// every cell render, so cache them at module level keyed by their options.
const numberFormatterCache = new Map<string, Intl.NumberFormat>();
function getNumberFormatter(locale: string, options?: Intl.NumberFormatOptions) {
	const key = `${locale}|${options ? JSON.stringify(options) : ""}`;
	let formatter = numberFormatterCache.get(key);
	if (!formatter) {
		formatter = new Intl.NumberFormat(locale, options);
		numberFormatterCache.set(key, formatter);
	}
	return formatter;
}

const dateFormatterCache = new Map<string, Intl.DateTimeFormat>();
function getDateFormatter(locale: string, options?: Intl.DateTimeFormatOptions) {
	const key = `${locale}|${options ? JSON.stringify(options) : ""}`;
	let formatter = dateFormatterCache.get(key);
	if (!formatter) {
		formatter = new Intl.DateTimeFormat(locale, options);
		dateFormatterCache.set(key, formatter);
	}
	return formatter;
}

let lastHighlightQuery: string | null = null;
let lastHighlightRegex: RegExp | null = null;
function getHighlightRegex(query: string) {
	if (query !== lastHighlightQuery) {
		lastHighlightQuery = query;
		lastHighlightRegex = new RegExp(`(${escapeRegExp(query)})`, "ig");
	}
	return lastHighlightRegex!;
}

function HighlightedText({ text, query }: { text: string; query: string }) {
	if (!query) return <>{text}</>;
	const parts = text.split(getHighlightRegex(query));
	const queryLower = query.toLowerCase();
	return (
		<>
			{parts.map((part, idx) =>
				part.toLowerCase() === queryLower ? (
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

function checkedLabel(value: boolean) {
	return value ? "Activo" : "Inactivo";
}

function formatNumericInputDisplay(value: EditableCellValue): string {
	if (value == null || value === "") return "";
	const parsed = parseLocalizedNumber(value);
	return parsed == null ? String(value) : getNumberFormatter("es-AR").format(parsed);
}

function formatCurrencyInputDisplay(value: EditableCellValue): string {
	if (value == null || value === "") return "";
	const parsed = parseLocalizedNumber(value);
	if (parsed == null) return String(value);
	return getNumberFormatter("es-AR", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(parsed);
}

const SELECT_BADGE_CLASS_BY_COLOR: Record<string, string> = {
	slate: "border-slate-300 bg-slate-100 text-slate-800 py-1",
	blue: "border-blue-300 bg-blue-100 text-blue-800 py-1",
	green: "border-emerald-300 bg-emerald-100 text-emerald-800 py-1",
	amber: "border-amber-300 bg-amber-100 text-amber-800 py-1",
	red: "border-red-300 bg-red-100 text-red-800 py-1",
	violet: "border-violet-300 bg-violet-100 text-violet-800 py-1",
};

const SELECT_ICON_BY_NAME = {
	dot: Circle,
	check: Check,
	clock: Clock3,
	alert: AlertTriangle,
	x: X,
	pause: Pause,
	play: Play,
	flag: Flag,
	star: Star,
	bookmark: Bookmark,
	bell: Bell,
	wrench: Wrench,
	shield: Shield,
	info: Info,
	ban: Ban,
	package: Package,
	truck: Truck,
	calendar: CalendarIcon,
	user: User,
	file: FileText,
	link: Link2,
} as const;

function renderSelectOptionBadge(option: MainTableSelectOption, highlightQuery: string) {
	const IconComponent = option.icon ? SELECT_ICON_BY_NAME[option.icon] : null;
	return (
		<Badge
			variant="outline"
			leadingIcon={IconComponent ? <IconComponent className="size-3" /> : null}
			className={cn(
				"min-w-0 max-w-full",
				option.color ? SELECT_BADGE_CLASS_BY_COLOR[option.color] : null
			)}
		>
			<HighlightedText text={option.text} query={highlightQuery} />
		</Badge>
	);
}

export function renderReadOnlyValue<Row extends FormTableRow>(
	value: unknown,
	row: Row,
	column: ColumnDef<Row>,
	highlightQuery: string
) {
	const customRenderer = column.cellConfig?.renderReadOnly;
	if (typeof customRenderer === "function") {
		return customRenderer({ value, row, highlightQuery });
	}
	const cellType = column.cellType || "text";
	const config = column.cellConfig || {};

	switch (cellType) {
		case "number": {
			const amount = toNumericValue(value);
			return (
				<span className="font-mono tabular-nums ">
					{amount == null ? String(value ?? "-") : getNumberFormatter("es-AR").format(amount)}
				</span>
			);
		}
		case "currency": {
			const amount = toNumericValue(value) ?? 0;
			const formatted = getNumberFormatter(config.currencyLocale || "es-AR", {
				style: "currency",
				currency: config.currencyCode || "USD",
				currencyDisplay: "narrowSymbol",
			}).format(amount);
			return <span className="font-mono tabular-nums">{formatted}</span>;
		}
		case "date": {
			if (!value) return <span>-</span>;
			const date = parseFlexibleDateValue(value);
			if (!date) return <span>{String(value)}</span>;
			if (config.dateFormat === "custom" && config.customDateFormat) {
				return <span>{formatDateSafe(date, config.customDateFormat)}</span>;
			}
			const options: Intl.DateTimeFormatOptions | undefined =
				config.dateFormat === "short"
					? { day: "numeric", month: "numeric", year: "numeric" }
					: config.dateFormat === "long"
						? { dateStyle: "long" }
						: config.dateFormat === "medium"
							? { dateStyle: "medium" }
							: undefined;
			return <span>{getDateFormatter("es-AR", options).format(date)}</span>;
		}
		case "boolean":
		case "checkbox":
		case "toggle": {
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
		case "tags": {
			const tagsStr = String(value || "");
			if (!tagsStr) return <span>-</span>;
			const tags = config.tagSeparator
				? tagsStr
						.split(config.tagSeparator)
						.map((t) => t.trim())
						.filter(Boolean)
				: [tagsStr];
			return (
				<div className="flex flex-wrap gap-1">
					{tags.map((tag) => (
						<Badge key={tag} variant={config.tagVariant || "secondary"}>
							<HighlightedText text={tag} query={highlightQuery} />
						</Badge>
					))}
				</div>
			);
		}
		case "link": {
			const text = String(value || "");
			if (!text) return <span>-</span>;
			const href = typeof config.href === "function" ? config.href(row) : config.href || text;
			return (
				<a
					href={href}
					target={config.target || "_blank"}
					rel={config.target === "_blank" ? "noopener noreferrer" : undefined}
					className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline"
				>
					<HighlightedText text={text} query={highlightQuery} />
					{config.target === "_blank" && <ExternalLink className="size-3" />}
				</a>
			);
		}
		case "avatar": {
			const text = String(value || "");
			const fallback =
				typeof config.avatarFallback === "function"
					? config.avatarFallback(row)
					: config.avatarFallback || text.substring(0, 2).toUpperCase();
			return (
				<Avatar className="size-8">
					<AvatarImage src={text} alt={fallback} />
					<AvatarFallback>{fallback}</AvatarFallback>
				</Avatar>
			);
		}
		case "image": {
			const src = String(value || "");
			if (!src) return <span>-</span>;
			return <img src={src} alt="Vista previa" className="size-10 object-cover rounded" />;
		}
		case "badge": {
			const text = String(value || "");
			if (!text) return <span>-</span>;
			if (config.badgeMap?.[text]) {
				const mapped = config.badgeMap[text];
				return (
					<Badge variant={mapped.variant as React.ComponentProps<typeof Badge>["variant"]}>
						{mapped.label}
					</Badge>
				);
			}
			return (
				<Badge variant={config.badgeVariant || "default"}>
					<HighlightedText text={text} query={highlightQuery} />
				</Badge>
			);
		}
		case "select": {
			const text = String(value || "").trim();
			if (!text) return <span>-</span>;
			const selectOptions = config.selectOptions ?? [];
			const matched = resolveMainTableSelectOption(
				text,
				selectOptions,
				config.selectName ?? column.id
			);
			if (matched) {
				return renderSelectOptionBadge(matched, highlightQuery);
			}
			return (
				<Badge variant="outline">
					<HighlightedText text={text} query={highlightQuery} />
				</Badge>
			);
		}
		case "text-icon": {
			const text = String(value || "");
			if (!text) return <span>-</span>;
			const iconName =
				typeof config.iconName === "function" ? config.iconName(row) : config.iconName;
			return (
				<div
					className={cn(
						"inline-flex items-center gap-2",
						config.iconPosition === "right" ? "flex-row-reverse" : ""
					)}
				>
					{iconName && (
						<span className={cn("text-muted-foreground", config.iconClassName)}>{iconName}</span>
					)}
					<span>
						<HighlightedText text={text} query={highlightQuery} />
					</span>
				</div>
			);
		}
		default:
			return (
				<span className="absolute top-0 pt-3">
					<HighlightedText text={String(value || "-")} query={highlightQuery} />
				</span>
			);
	}
}

export function renderEditableContent<Row extends FormTableRow>({
	column,
	row,
	rowId,
	value,
	setValue,
	handleBlur,
	highlightQuery,
	isBulkEditing = false,
}: EditableContentArgs<Row>): ReactNode {
	const cellType = column.cellType || "text";
	const config = column.cellConfig || {};
	const inputDataProps = {
		"data-testid": `cell-input-${rowId}-${String(column.field)}`,
		"data-row-id": rowId,
		"data-field": String(column.field),
	};
	const hiddenInputClass =
		"w-full h-full rounded-none border-none absolute top-0 left-0 children-input-hidden focus-visible:ring-[0px] focus-visible:ring-offset-0 focus-visible:outline-none focus-visible:shadow-none ";
	const floatingTextareaClass =
		"w-full h-full rounded-none border-none absolute top-0 left-0 children-input-hidden resize-none bg-transparent px-2 py-2 leading-snug pointer-events-auto focus:relative focus:top-auto focus:left-auto focus:z-[1] focus:h-auto focus:max-h-40 focus:field-sizing-content overflow-hidden group-data-[state=closed]:focus:overflow-auto focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 ";
	const withReadOnlyLayer = (editor: ReactNode) => (
		<>
			{editor}
			<div className="children-input-shown pointer-events-none absolute inset-0 flex h-full w-full items-center">
				{renderReadOnlyValue(value, row, column, highlightQuery)}
			</div>
		</>
	);

	switch (cellType) {
		case "currency":
			return withReadOnlyLayer(
				<LocalInput
					type="text"
					inputMode="decimal"
					className={hiddenInputClass}
					{...inputDataProps}
					value={value ?? ""}
					onChange={setValue}
					onBlur={handleBlur}
					transformOnBlur={(val) => {
						const parsed = parseLocalizedNumber(val);
						return parsed == null ? null : Number(parsed.toFixed(2));
					}}
					formatDisplayValue={formatCurrencyInputDisplay}
					column={column}
					row={row}
					cellType="currency"
					syncOnChange={config.syncOnChange}
					forceSyncOnChange={isBulkEditing}
					placeholder="0.00"
					required={column.required}
				/>
			);
		case "number":
			return withReadOnlyLayer(
				<LocalInput
					type="text"
					inputMode="decimal"
					pattern="[0-9.,\\-]*"
					className={hiddenInputClass}
					{...inputDataProps}
					value={value ?? ""}
					onChange={setValue}
					onBlur={handleBlur}
					transformOnBlur={(val) => {
						const parsed = parseLocalizedNumber(val);
						return parsed == null ? null : parsed;
					}}
					formatDisplayValue={formatNumericInputDisplay}
					column={column}
					row={row}
					cellType="number"
					syncOnChange={config.syncOnChange}
					forceSyncOnChange={isBulkEditing}
					required={column.required}
				/>
			);
		case "date":
			return withReadOnlyLayer(
				<DateCellEditor
					value={value ?? ""}
					setValue={setValue}
					handleBlur={handleBlur}
					required={column.required}
					inputProps={inputDataProps}
					column={column}
					row={row}
					forceSyncOnChange={isBulkEditing}
				/>
			);
		case "boolean":
		case "checkbox":
			return withReadOnlyLayer(
				<div className="children-input-hidden absolute inset-0 flex h-full w-full items-center justify-center gap-2">
					<Checkbox
						checked={Boolean(value)}
						onCheckedChange={(checked) => {
							setValue(Boolean(checked));
							config.onToggle?.(Boolean(checked), row);
						}}
					/>
					<span className="text-xs text-muted-foreground">{Boolean(value) ? "S\u00ed" : "No"}</span>
				</div>
			);
		case "toggle":
			return withReadOnlyLayer(
				<div className="children-input-hidden absolute inset-0 flex h-full w-full items-center justify-center gap-2">
					<Switch
						checked={Boolean(value)}
						onCheckedChange={(checked) => {
							setValue(checked);
							config.onToggle?.(checked, row);
						}}
					/>
					<span className="text-xs text-muted-foreground">{checkedLabel(Boolean(value))}</span>
				</div>
			);
		case "tags":
			return withReadOnlyLayer(
				<LocalInput
					value={String(value ?? "")}
					className={hiddenInputClass}
					{...inputDataProps}
					onChange={setValue}
					onBlur={handleBlur}
					column={column}
					row={row}
					cellType="tags"
					syncOnChange={config.syncOnChange}
					forceSyncOnChange={isBulkEditing}
					placeholder="Ej: diseño, arquitectura"
				/>
			);
		case "link":
			return withReadOnlyLayer(
				<LocalInput
					className={hiddenInputClass}
					{...inputDataProps}
					value={String(value ?? "")}
					onChange={setValue}
					onBlur={handleBlur}
					column={column}
					row={row}
					cellType="link"
					syncOnChange={config.syncOnChange}
					forceSyncOnChange={isBulkEditing}
					placeholder="https://..."
					required={column.required}
				/>
			);
		case "avatar":
			return withReadOnlyLayer(
				<LocalInput
					{...inputDataProps}
					value={String(value ?? "")}
					onChange={setValue}
					onBlur={handleBlur}
					column={column}
					row={row}
					cellType="avatar"
					syncOnChange={config.syncOnChange}
					forceSyncOnChange={isBulkEditing}
					placeholder="https://..."
					className={hiddenInputClass}
				/>
			);
		case "image":
			return withReadOnlyLayer(
				<LocalInput
					{...inputDataProps}
					value={String(value ?? "")}
					onChange={setValue}
					onBlur={handleBlur}
					column={column}
					row={row}
					cellType="image"
					syncOnChange={config.syncOnChange}
					forceSyncOnChange={isBulkEditing}
					placeholder="https://..."
					className={hiddenInputClass}
				/>
			);
		case "select": {
			const selectOptions = config.selectOptions ?? [];
			const currentText = String(value ?? "").trim();
			const selectName = config.selectName ?? column.id;
			const matched = resolveMainTableSelectOption(currentText, selectOptions, selectName);
			const closest =
				currentText && !matched
					? findClosestMainTableSelectOption(currentText, selectOptions)
					: null;
			const matchedIndex = matched
				? selectOptions.findIndex((option) => option.text === matched.text)
				: -1;
			const unresolvedValue = "__current__";
			const clearValue = "__clear__";
			const resolvedValue =
				matched && matchedIndex >= 0
					? getMainTableSelectOptionId(matched, selectName, matchedIndex)
					: unresolvedValue;
			return withReadOnlyLayer(
				<div className="children-input-hidden absolute inset-0 flex h-full w-full items-center px-2">
					<div className="flex w-full items-center gap-2">
						<Select
							value={resolvedValue}
							onValueChange={(nextValue) => {
								if (nextValue === unresolvedValue) return;
								if (nextValue === clearValue) {
									setValue(null);
									handleBlur();
									return;
								}
								setValue(nextValue);
								handleBlur();
							}}
						>
							<SelectTrigger
								className={cn(
									"h-auto min-h-0 w-auto max-w-full justify-start border-0 bg-transparent p-0 text-left shadow-none outline-none hover:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 [&>svg]:hidden"
								)}
							>
								<span className="inline-flex min-w-0 max-w-full items-center gap-1.5">
									{matched ? (
										renderSelectOptionBadge(matched, highlightQuery)
									) : (
										<Badge
											variant="outline"
											leadingIcon={<Circle className="size-3" />}
											className="min-w-0 max-w-full"
										>
											{currentText || "Sin definir"}
										</Badge>
									)}
									<span
										aria-hidden="true"
										className="inline-flex size-4 shrink-0 items-center justify-center bg-transparent text-stone-500"
									>
										<ChevronDown className="size-3.5" />
									</span>
								</span>
							</SelectTrigger>
							<SelectContent className="z-[10000001]">
								{!column.required ? <SelectItem value={clearValue}>Sin definir</SelectItem> : null}
								{!matched ? (
									<SelectItem value={unresolvedValue} disabled>
										{currentText ? `Actual: ${currentText}` : "Sin definir"}
									</SelectItem>
								) : null}
								{selectOptions.map((option, optionIndex) => {
									const IconComponent = option.icon ? SELECT_ICON_BY_NAME[option.icon] : null;
									const optionId = getMainTableSelectOptionId(option, selectName, optionIndex);
									return (
										<SelectItem key={optionId} value={optionId}>
											<span className="inline-flex items-center gap-2">
												{IconComponent ? <IconComponent className="size-3" /> : null}
												<span>{option.text}</span>
											</span>
										</SelectItem>
									);
								})}
							</SelectContent>
						</Select>
						{closest ? (
							<Badge
								variant="default" className="whitespace-nowrap"
							>
								Sugerencia: {closest.option.text}
							</Badge>
						) : null}
					</div>
				</div>
			);
		}
		case "badge": {
			const input = (
				<LocalInput
					{...inputDataProps}
					value={value ?? ""}
					onChange={setValue}
					onBlur={handleBlur}
					column={column}
					row={row}
					cellType="badge"
					syncOnChange={config.syncOnChange}
					forceSyncOnChange={isBulkEditing}
					className={cn(hiddenInputClass, "z-10 bg-transparent text-right font-mono tabular-nums")}
				/>
			);

			if (typeof config.renderEditable === "function") {
				return withReadOnlyLayer(
					config.renderEditable({
						value,
						row,
						highlightQuery,
						input,
						setValue,
						handleBlur,
					})
				);
			}

			return withReadOnlyLayer(input);
		}
		case "text-icon":
			return withReadOnlyLayer(
				<LocalInput
					{...inputDataProps}
					value={value ?? ""}
					onChange={setValue}
					onBlur={handleBlur}
					column={column}
					row={row}
					cellType="text-icon"
					syncOnChange={config.syncOnChange}
					forceSyncOnChange={isBulkEditing}
					className={hiddenInputClass}
				/>
			);
		default: {
			const stringValue = value == null ? "" : String(value);
			const shouldUseExpandedTextEditor =
				stringValue.length > 80 || Number(column.width ?? 0) >= 220;
			const input = shouldUseExpandedTextEditor ? (
				<LocalTextarea
					className={floatingTextareaClass}
					{...inputDataProps}
					value={value ?? ""}
					onChange={setValue}
					onBlur={handleBlur}
					column={column}
					row={row}
					cellType="text"
					syncOnChange={config.syncOnChange}
					forceSyncOnChange={isBulkEditing}
					required={column.required}
					rows={1}
				/>
			) : (
				<LocalInput
					className={hiddenInputClass}
					{...inputDataProps}
					value={value ?? ""}
					onChange={setValue}
					onBlur={handleBlur}
					column={column}
					row={row}
					cellType="text"
					syncOnChange={config.syncOnChange}
					forceSyncOnChange={isBulkEditing}
					required={column.required}
				/>
			);

			if (typeof config.renderEditable === "function") {
				return withReadOnlyLayer(
					config.renderEditable({
						value,
						row,
						highlightQuery,
						input,
						setValue,
						handleBlur,
					})
				);
			}

			return withReadOnlyLayer(input);
		}
	}
}
