import { useState, useRef, useCallback, useMemo, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuTrigger,
	ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { CalendarDays, ExternalLink, Sparkles } from "lucide-react";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
	formatDateAsIso,
	parseFlexibleDateValue,
	parseLocalizedNumber,
	toNumericValue,
} from "@/lib/tablas";
import type {
	CellSuggestion,
	ColumnDef,
	FormFieldComponent,
	FormTableRow,
} from "./types";
import { resolveCellSuggestion } from "./cell-suggestions";
import { escapeRegExp, formatDateSafe } from "./table-utils";

export type EditableCellValue = string | number | readonly string[] | null | undefined;
type FieldRenderState = {
	state: {
		value: unknown;
		meta?: {
			errors?: unknown[];
		};
	};
	handleChange: (value: unknown) => void;
	handleBlur: () => void;
};

function toIsoDateOnly(date: Date): string {
	return formatDateAsIso(date);
}

function parseDateValue(value: unknown): Date | null {
	return parseFlexibleDateValue(value);
}

function normalizeDateInputValue(value: EditableCellValue): string {
	if (value == null) return "";
	const parsed = parseDateValue(value);
	if (!parsed) return "";
	return toIsoDateOnly(parsed);
}

function buildSuggestionKey<Row extends FormTableRow>(
	suggestion: CellSuggestion<Row> | null
) {
	if (!suggestion) return null;
	return `${suggestion.kind}:${suggestion.sourceInput}:${suggestion.suggestedDisplayValue}`;
}

function CellSuggestionPrompt<Row extends FormTableRow>({
	suggestion,
	onApply,
	onIgnore,
	className,
}: {
	suggestion: CellSuggestion<Row> | null;
	onApply: () => void;
	onIgnore: () => void;
	className?: string;
}) {
	const [open, setOpen] = useState(false);

	if (!suggestion) return null;

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant="outline"
					size="sm"
					onPointerDown={(event) => {
						event.preventDefault();
						event.stopPropagation();
					}}
					onClick={(event) => {
						event.preventDefault();
						event.stopPropagation();
						setOpen((prev) => !prev);
					}}
					className={cn(
						"pointer-events-auto relative z-20 h-6 rounded-full border-orange-200 bg-orange-50 px-2 text-[10px] font-semibold uppercase tracking-wide text-orange-700 shadow-sm hover:bg-orange-100",
						className
					)}
				>
					<Sparkles className="mr-1 h-3 w-3" />
					Sugerencia
				</Button>
			</PopoverTrigger>
			<PopoverContent align="end" side="bottom" className="w-72 p-0">
				<div className="border-b bg-orange-50/70 px-4 py-3">
					<p className="text-[11px] font-semibold uppercase tracking-wide text-orange-700">
						Sugerencia automática
					</p>
					<p className="mt-1 text-sm font-medium text-foreground">
						{suggestion.suggestedDisplayValue}
					</p>
				</div>
				<div className="space-y-3 px-4 py-3 text-sm">
					<p className="text-muted-foreground">{suggestion.description}</p>
					<div className="rounded-lg border bg-muted/30 px-3 py-2">
						<p className="text-[11px] uppercase tracking-wide text-muted-foreground">
							Valor detectado
						</p>
						<p className="mt-1 font-medium text-foreground">{suggestion.sourceInput}</p>
					</div>
					<div className="flex items-center justify-end gap-2">
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onPointerDown={(event) => {
								event.preventDefault();
								event.stopPropagation();
							}}
							onClick={(event) => {
								event.preventDefault();
								event.stopPropagation();
								onIgnore();
								setOpen(false);
							}}
						>
							Ignorar
						</Button>
						<Button
							type="button"
							size="sm"
							onPointerDown={(event) => {
								event.preventDefault();
								event.stopPropagation();
							}}
							onClick={(event) => {
								event.preventDefault();
								event.stopPropagation();
								onApply();
								setOpen(false);
							}}
						>
							Aplicar
						</Button>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);
}

function DateCellEditor<Row extends FormTableRow>({
	value,
	setValue,
	handleBlur,
	required,
	inputProps,
	column,
	row,
}: {
	value: EditableCellValue;
	setValue: (value: unknown) => void;
	handleBlur: () => void;
	required?: boolean;
	inputProps?: Record<string, string>;
	column: ColumnDef<Row>;
	row: Row;
}) {
	const [open, setOpen] = useState(false);
	const selectedDate = parseDateValue(value ?? null);
	const externalTypedValue = useMemo(() => {
		if (!value) return "";
		return selectedDate ? selectedDate.toLocaleDateString("es-AR") : String(value);
	}, [value, selectedDate]);
	const [draftValue, setDraftValue] = useState<string | null>(null);
	const typedValue = draftValue ?? externalTypedValue;

	const [ignoredSuggestionKey, setIgnoredSuggestionKey] = useState<string | null>(null);
	const suggestion = useMemo(
		() =>
			resolveCellSuggestion({
				rawValue: typedValue,
				currentValue: value,
				cellType: "date",
				column,
				row,
			}),
		[typedValue, value, column, row]
	);
	const suggestionKey = buildSuggestionKey(suggestion);
	const visibleSuggestion =
		suggestionKey && suggestionKey === ignoredSuggestionKey ? null : suggestion;

	return (
		<div className="w-full h-full absolute top-0 left-0 flex items-center gap-1 px-2 children-input-hidden relative">
			<Input
				type="text"
				inputMode="numeric"
				placeholder="dd/mm/aaaa"
				{...inputProps}
				value={typedValue}
				onChange={(event) => {
					setDraftValue(event.target.value);
					if (ignoredSuggestionKey) {
						setIgnoredSuggestionKey(null);
					}
				}}
				onBlur={() => {
					const nextRaw = typedValue.trim();
					if (!nextRaw) {
						if (!required) {
							setValue(null);
						}
						setDraftValue(null);
						handleBlur();
						return;
					}
					const parsed = parseDateValue(nextRaw);
					setDraftValue(null);
					setValue(parsed ? toIsoDateOnly(parsed) : nextRaw);
					handleBlur();
				}}
				className={cn(
					"w-full h-full rounded-none border-none focus-visible:ring-orange-primary/40 focus-visible:ring-offset-1 pl-1",
					visibleSuggestion ? "pr-24" : "pr-0"
				)}
			/>
			<CellSuggestionPrompt
				suggestion={visibleSuggestion}
				onApply={() => {
					if (!visibleSuggestion) return;
					setDraftValue(visibleSuggestion.suggestedDisplayValue);
					setValue(visibleSuggestion.suggestedValue);
					setIgnoredSuggestionKey(null);
				}}
				onIgnore={() => setIgnoredSuggestionKey(suggestionKey)}
				className="absolute right-9 top-1"
			/>
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger asChild>
					<Button
						type="button"
						variant="ghost"
						className={cn(
							"h-full rounded-none border-none px-0 has-[>svg]:px-1 py-1 font-normal shrink-0"
						)}
					>
						<CalendarDays className="h-4 w-4 shrink-0 opacity-70" />
					</Button>
				</PopoverTrigger>
				<PopoverContent className="w-auto p-0" align="start">
					<Calendar
						locale={es}
						mode="single"
						selected={selectedDate ?? undefined}
						defaultMonth={selectedDate ?? new Date()}
						onSelect={(date) => {
							if (!date) return;
							setValue(toIsoDateOnly(date));
							setDraftValue(null);
							handleBlur();
							setOpen(false);
						}}
						captionLayout="dropdown"
					/>
					<div className="flex items-center justify-between border-t px-3 py-2">
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={() => {
								if (!required) {
									setValue(null);
									setDraftValue(null);
									handleBlur();
								}
								setOpen(false);
							}}
							disabled={required}
						>
							Limpiar
						</Button>
						<Button type="button" size="sm" onClick={() => setOpen(false)}>
							Cerrar
						</Button>
					</div>
				</PopoverContent>
			</Popover>
		</div>
	);
}

/**
 * LocalInput: A buffered input that manages local state during typing
 * and only syncs to the form on blur. This prevents cascading re-renders
 * on every keystroke.
 */
function LocalInput<Row extends FormTableRow>({
	value: externalValue,
	onChange: syncToForm,
	onBlur,
	transformOnBlur,
	formatDisplayValue,
	column,
	row,
	cellType,
	...props
}: Omit<React.ComponentProps<typeof Input>, "onChange" | "onBlur" | "value"> & {
	value: EditableCellValue;
	onChange: (value: unknown) => void;
	onBlur?: () => void;
	transformOnBlur?: (value: string) => unknown;
	formatDisplayValue?: (value: EditableCellValue) => string;
	column: ColumnDef<Row>;
	row: Row;
	cellType: NonNullable<ColumnDef<Row>["cellType"]> | "text";
}) {
	// Convert external value to string for the input
	const normalizedExternal =
		props.type === "date"
			? normalizeDateInputValue(externalValue)
			: formatDisplayValue
				? formatDisplayValue(externalValue)
				: externalValue == null
					? ""
					: String(externalValue);
	const [draftValue, setDraftValue] = useState<string | null>(null);
	const localValue = draftValue ?? normalizedExternal;
	const isTypingRef = useRef(false);
	const [ignoredSuggestionKey, setIgnoredSuggestionKey] = useState<string | null>(null);

	const suggestion = useMemo(
		() =>
			resolveCellSuggestion({
				rawValue: localValue,
				currentValue: externalValue,
				cellType,
				column,
				row,
			}),
		[localValue, externalValue, cellType, column, row]
	);
	const suggestionKey = buildSuggestionKey(suggestion);
	const visibleSuggestion =
		suggestionKey && suggestionKey === ignoredSuggestionKey ? null : suggestion;

	const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
		isTypingRef.current = true;
		setDraftValue(e.target.value);
		setIgnoredSuggestionKey(null);
	}, []);

	const handleBlur = useCallback(() => {
		isTypingRef.current = false;
		const finalValue = transformOnBlur ? transformOnBlur(localValue) : localValue;
		const shouldSync = transformOnBlur
			? !Object.is(finalValue, externalValue)
			: localValue !== normalizedExternal;

		if (shouldSync) {
			syncToForm(finalValue);
		}

		setDraftValue(null);
		onBlur?.();
	}, [localValue, syncToForm, onBlur, transformOnBlur, normalizedExternal, externalValue]);

	return (
		<>
			<Input
				{...props}
				value={localValue}
				onChange={handleChange}
				onBlur={handleBlur}
				className={cn(props.className, visibleSuggestion ? "pr-24" : undefined)}
			/>
			<CellSuggestionPrompt
				suggestion={visibleSuggestion}
				onApply={() => {
					if (!visibleSuggestion) return;
					isTypingRef.current = false;
					setDraftValue(visibleSuggestion.suggestedDisplayValue);
					syncToForm(visibleSuggestion.suggestedValue);
					setIgnoredSuggestionKey(null);
				}}
				onIgnore={() => setIgnoredSuggestionKey(suggestionKey)}
				className="absolute right-1 top-1 z-20"
			/>
		</>
	);
}

export type EditableContentArgs<Row extends FormTableRow> = {
	column: ColumnDef<Row>;
	row: Row;
	rowId: string;
	value: EditableCellValue;
	setValue: (value: unknown) => void;
	handleBlur: () => void;
	highlightQuery: string;
};

export type RenderCellArgs<Row extends FormTableRow> = {
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

function checkedLabel(value: boolean) {
	return value ? "Activo" : "Inactivo";
}

function formatNumericInputDisplay(value: EditableCellValue): string {
	if (value == null || value === "") return "";
	const parsed = parseLocalizedNumber(value);
	return parsed == null ? String(value) : parsed.toLocaleString("es-AR");
}

function formatCurrencyInputDisplay(value: EditableCellValue): string {
	if (value == null || value === "") return "";
	const parsed = parseLocalizedNumber(value);
	if (parsed == null) return String(value);
	return new Intl.NumberFormat("es-AR", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(parsed);
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
					{amount == null ? String(value ?? "-") : amount.toLocaleString("es-AR")}
				</span>
			);
		}
		case "currency": {
			const amount = toNumericValue(value) ?? 0;
			const formatted = new Intl.NumberFormat(config.currencyLocale || "es-AR", {
				style: "currency",
				currency: config.currencyCode || "USD",
			}).format(amount);
			return <span className="font-mono tabular-nums">{formatted}</span>;
		}
		case "date": {
			if (!value) return <span>-</span>;
			const date = parseDateValue(value);
			if (!date) return <span>-</span>;
			if (config.dateFormat === "custom" && config.customDateFormat) {
				return <span>{formatDateSafe(date, config.customDateFormat)}</span>;
			}
			const options: Intl.DateTimeFormatOptions =
				config.dateFormat === "short"
					? { dateStyle: "short" }
					: config.dateFormat === "long"
						? { dateStyle: "long" }
						: { dateStyle: "medium" };
			return <span>{date.toLocaleDateString("es-AR", options)}</span>;
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
				? tagsStr.split(config.tagSeparator).map((t) => t.trim()).filter(Boolean)
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
			const href =
				typeof config.href === "function"
					? config.href(row)
					: config.href || text;
			return (
				<a
					href={href}
					target={config.target || "_blank"}
					rel={config.target === "_blank" ? "noopener noreferrer" : undefined}
					className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline"
				>
					<HighlightedText text={text} query={highlightQuery} />
					{config.target === "_blank" && <ExternalLink className="w-3 h-3" />}
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
				<Avatar className="w-8 h-8">
					<AvatarImage src={text} alt={fallback} />
					<AvatarFallback>{fallback}</AvatarFallback>
				</Avatar>
			);
		}
		case "image": {
			const src = String(value || "");
			if (!src) return <span>-</span>;
			return (
				<img
					src={src}
					alt="Vista previa"
					className="w-10 h-10 object-cover rounded"
				/>
			);
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
		case "text-icon": {
			const text = String(value || "");
			if (!text) return <span>-</span>;
			const iconName =
				typeof config.iconName === "function"
					? config.iconName(row)
					: config.iconName;
			return (
				<div
					className={cn(
						"inline-flex items-center gap-2",
						config.iconPosition === "right" ? "flex-row-reverse" : ""
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
				<span
					className={cn(
						"w-full h-full rounded-none border-none focus-visible:ring-orange-primary/40 absolute top-0 left-0 focus-visible:ring-offset-1 children-input-hidden text-center flex items-center justify-center"
					)}
				>
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
}: EditableContentArgs<Row>): ReactNode {
	const cellType = column.cellType || "text";
	const config = column.cellConfig || {};
	const inputDataProps = {
		"data-testid": `cell-input-${rowId}-${String(column.field)}`,
		"data-row-id": rowId,
		"data-field": String(column.field),
	};

	switch (cellType) {
		case "currency":
			return (
				<LocalInput
					type="text"
					inputMode="decimal"
					className="w-full h-full rounded-none border-none focus-visible:ring-orange-primary/40 absolute top-0 left-0 focus-visible:ring-offset-1 children-input-hidden"
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
					placeholder="0.00"
					required={column.required}
				/>
			);
		case "number":
			return (
				<LocalInput
					type="text"
					inputMode="decimal"
					pattern="[0-9.,\\-]*"
					className="w-full h-full rounded-none border-none focus-visible:ring-orange-primary/40 absolute top-0 left-0 focus-visible:ring-offset-1 children-input-hidden "
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
					required={column.required}
				/>
			);
		case "date":
			return (
				<DateCellEditor
					value={value ?? ""}
					setValue={setValue}
					handleBlur={handleBlur}
					required={column.required}
					inputProps={inputDataProps}
					column={column}
					row={row}
				/>
			);
		case "boolean":
		case "checkbox":
			return (
				<div className="flex items-center gap-2 w-full h-full justify-center">
					<Checkbox
						checked={Boolean(value)}
						onCheckedChange={(checked) => {
							setValue(Boolean(checked));
							config.onToggle?.(Boolean(checked), row);
						}}
					/>
					<span className="text-xs text-muted-foreground">
						{Boolean(value) ? "Sí" : "No"}
					</span>
				</div>
			);
		case "toggle":
			return (
				<div className="flex items-center gap-2 children-input-shown justify-center h-full">
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
		case "tags": {
			const tagsStr = String(value ?? "");
			const tags = tagsStr
				? (config.tagSeparator
					? tagsStr.split(config.tagSeparator).map((t) => t.trim()).filter(Boolean)
					: [tagsStr])
				: [];
			return (
				<div className="space-y-1 w-full h-full">
					<LocalInput
						value={tagsStr}
						className="w-full h-full rounded-none border-none focus-visible:ring-orange-primary/40 absolute top-0 left-0 focus-visible:ring-offset-1 focus-visible:opacity-100 opacity-0 peer children-input-hidden"
						{...inputDataProps}
						onChange={setValue}
						onBlur={handleBlur}
						column={column}
						row={row}
						cellType="tags"
						placeholder="Ej: diseño, arquitectura"
					/>
					{tags.length > 0 && (
						<div className="flex flex-wrap gap-1 w-full h-full peer-focus:opacity-0 opacity-100 p-3">
							{tags.map((tag) => (
								<Badge key={tag} variant={config.tagVariant || "secondary"} className="max-h-6 children-input-shown">
									<HighlightedText text={tag} query={highlightQuery} />
								</Badge>
							))}
						</div>
					)}
				</div>
			);
		}
		case "link": {
			const text = String(value ?? "");
			const href =
				typeof config.href === "function"
					? config.href(row)
					: text || config.href || "#";
			return (
				<div className="space-y-1 overflow-hidden">
					<LocalInput
						className="w-full h-full rounded-none border-none focus-visible:ring-orange-primary/40 absolute top-0 left-0 focus-visible:ring-offset-1 peer opacity-0 focus-visible:opacity-100 children-input-hidden"
						{...inputDataProps}
						value={text}
						onChange={setValue}
						onBlur={handleBlur}
						column={column}
						row={row}
						cellType="link"
						placeholder="https://..."
						required={column.required}
					/>
					{text && (
						<a
							href={href}
							target={config.target || "_blank"}
							rel={config.target === "_blank" ? "noopener noreferrer" : undefined}
							className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline w-full h-full justify-center peer-focus:opacity-0 opacity-100 p-3 absolute top-0 left-0 overflow-hidden ring-offset-0 children-input-shown"
						>
							<HighlightedText text={text} query={highlightQuery} />
							<ExternalLink className="w-3 h-3" />
						</a>
					)}
				</div>
			);
		}
		case "avatar": {
			const text = String(value ?? "");
			const fallback =
				typeof config.avatarFallback === "function"
					? config.avatarFallback(row)
					: config.avatarFallback || text.substring(0, 2).toUpperCase();
			return (
				<div className="flex items-center gap-3">
					<Avatar className="w-8 h-8 shrink-0">
						<AvatarImage src={text} alt={fallback} />
						<AvatarFallback>{fallback}</AvatarFallback>
					</Avatar>
					<LocalInput
						{...inputDataProps}
						value={text}
						onChange={setValue}
						onBlur={handleBlur}
						column={column}
						row={row}
						cellType="avatar"
						placeholder="https://..."
					/>
				</div>
			);
		}
		case "image": {
			const src = String(value ?? "");
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
					<LocalInput
						{...inputDataProps}
						value={src}
						onChange={setValue}
						onBlur={handleBlur}
						column={column}
						row={row}
						cellType="image"
						placeholder="https://..."
					/>
				</div>
			);
		}
		case "badge":
			{
				const input = (
					<LocalInput
						{...inputDataProps}
						value={value ?? ""}
						onChange={setValue}
						onBlur={handleBlur}
						column={column}
						row={row}
						cellType="badge"
						className="z-10 w-full h-full rounded-none border-none bg-transparent text-right font-mono tabular-nums focus-visible:ring-orange-primary/40 absolute top-0 left-0 focus-visible:ring-offset-1 peer opacity-0 focus-visible:opacity-100 children-input-hidden"
					/>
				);

				if (typeof config.renderEditable === "function") {
					return config.renderEditable({
						value,
						row,
						highlightQuery,
						input,
					});
				}

				return (
					<div className="space-y-1">
						{input}
						<div className="opacity-100 p-3 children-input-shown">
							{renderReadOnlyValue(value, row, column, highlightQuery)}
						</div>
					</div>
				);
			}
		case "text-icon":
			return (
				<div className="space-y-1 children-input-hidden">
					<LocalInput
						{...inputDataProps}
						value={value ?? ""}
						onChange={setValue}
						onBlur={handleBlur}
						column={column}
						row={row}
						cellType="text-icon"
					/>
					<div>{renderReadOnlyValue(value, row, column, highlightQuery)}</div>
				</div>
			);
		default:
			return (
				<LocalInput
					className="w-full h-full rounded-none border-none focus-visible:ring-orange-primary/40 absolute top-0 left-0 focus-visible:ring-offset-1 children-input-hidden"
					{...inputDataProps}
					value={value ?? ""}
					onChange={setValue}
					onBlur={handleBlur}
					column={column}
					row={row}
					cellType="text"
					required={column.required}
				/>
			);
	}
}

export function renderCellByType<Row extends FormTableRow>({
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
			{(field: FieldRenderState) => {
				const fieldValue = field.state.value;
				const setValue = (value: unknown) => field.handleChange(value);
				const firstError = field.state.meta?.errors?.[0];
				const errorMessage =
					typeof firstError === "string" ? firstError : firstError != null ? String(firstError) : null;
				const content = editable
					? renderEditableContent({
						column,
						row,
						rowId,
						value: fieldValue as EditableCellValue,
						setValue,
						handleBlur: field.handleBlur,
						highlightQuery,
					})
					: renderReadOnlyValue(fieldValue, row, column, highlightQuery);

				const body = (
					<div
						className={cn(
							"absolute top-0 left-0 w-full h-full",
							isRowDirty ? "outline outline-amber-500/50 bg-amber-50/60 shadow-sm" : "",
							isCellDirty
								? "outline outline-amber-600/50 bg-[repeating-linear-gradient(-60deg,transparent_0%,transparent_5px,var(--color-amber-200)_5px,var(--color-amber-200)_6px,transparent_6px)] bg-repeat"
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
									<ContextMenuItem onClick={onRestoreValue} className="bg-amber-100/50 rounded-none">
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
							{editable && onClearValue && (
								<ContextMenuItem onClick={onClearValue}>
									Limpiar valor
								</ContextMenuItem>
							)}
							{customMenuItems && customMenuItems.length > 0 && (
								<>
									<ContextMenuSeparator />
									{customMenuItems.map((item) => (
										<ContextMenuItem key={item.id} onClick={() => item.onSelect?.(row)}>
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
