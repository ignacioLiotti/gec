import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuTrigger,
	ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
	ColumnDef,
	FormFieldComponent,
	FormTableRow,
} from "./types";
import { escapeRegExp, formatDateSafe } from "./table-utils";

type EditableCellValue = string | number | readonly string[] | null | undefined;

type EditableContentArgs<Row extends FormTableRow> = {
	column: ColumnDef<Row>;
	row: Row;
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
		case "number":
			return (
				<span className="font-mono tabular-nums">
					{typeof value === "number" ? value.toLocaleString() : String(value ?? "-")}
				</span>
			);
		case "currency": {
			const amount =
				typeof value === "number"
					? value
					: Number.parseFloat(String(value ?? 0)) || 0;
			const formatted = new Intl.NumberFormat(config.currencyLocale || "es-AR", {
				style: "currency",
				currency: config.currencyCode || "USD",
			}).format(amount);
			return <span className="font-mono tabular-nums">{formatted}</span>;
		}
		case "date": {
			if (!value) return <span>-</span>;
			const date = new Date(String(value));
			if (Number.isNaN(date.getTime())) return <span>-</span>;
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
				return <Badge variant={mapped.variant as any}>{mapped.label}</Badge>;
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
				<span>
					<HighlightedText text={String(value || "-")} query={highlightQuery} />
				</span>
			);
	}
}

function renderEditableContent<Row extends FormTableRow>({
	column,
	row,
	value,
	setValue,
	handleBlur,
	highlightQuery,
}: EditableContentArgs<Row>): ReactNode {
	const cellType = column.cellType || "text";
	const config = column.cellConfig || {};

	switch (cellType) {
		case "currency":
			return (
				<Input
					type="number"
					step="0.01"
					className="w-full h-full rounded-none border-none focus-visible:ring-orange-primary/40 absolute top-0 left-0 focus-visible:ring-offset-1 children-input-hidden"
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
		case "number":
			return (
				<Input
					type="number"
					className="w-full h-full rounded-none border-none focus-visible:ring-orange-primary/40 absolute top-0 left-0 focus-visible:ring-offset-1 children-input-hidden"
					value={value ?? ""}
					onChange={(event) => {
						const next = event.target.value;
						setValue(next === "" ? null : Number(next));
					}}
					onBlur={handleBlur}
					required={column.required}
				/>
			);
		case "date":
			return (
				<Input
					type="date"
					className="w-full h-full rounded-none border-none focus-visible:ring-orange-primary/40 absolute top-0 left-0 focus-visible:ring-offset-1 children-input-hidden"
					value={value ?? ""}
					onChange={(event) => setValue(event.target.value)}
					onBlur={handleBlur}
					required={column.required}
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
		case "tags": {
			const tagsStr = String(value ?? "");
			const tags = tagsStr
				? (config.tagSeparator
					? tagsStr.split(config.tagSeparator).map((t) => t.trim()).filter(Boolean)
					: [tagsStr])
				: [];
			return (
				<div className="space-y-1 w-full h-full">
					<Input
						value={tagsStr}
						className="w-full h-full rounded-none border-none focus-visible:ring-orange-primary/40 absolute top-0 left-0 focus-visible:ring-offset-1 focus-visible:opacity-100 opacity-0 peer children-input-hidden"
						onChange={(event) => setValue(event.target.value)}
						onBlur={handleBlur}
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
					<Input
						className="w-full h-full rounded-none border-none focus-visible:ring-orange-primary/40 absolute top-0 left-0 focus-visible:ring-offset-1 peer opacity-0 focus-visible:opacity-100 children-input-hidden"
						value={text}
						onChange={(event) => setValue(event.target.value)}
						onBlur={handleBlur}
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
					<Input
						value={text}
						onChange={(event) => setValue(event.target.value)}
						onBlur={handleBlur}
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
					<Input
						value={src}
						onChange={(event) => setValue(event.target.value)}
						onBlur={handleBlur}
						placeholder="https://..."
					/>
				</div>
			);
		}
		case "badge":
			return (
				<div className="space-y-1">
					<Input
						value={value ?? ""}
						onChange={(event) => setValue(event.target.value)}
						onBlur={handleBlur}
						className="w-full h-full rounded-none border-none focus-visible:ring-orange-primary/40 absolute top-0 left-0 focus-visible:ring-offset-1 peer opacity-0 focus-visible:opacity-100 children-input-hidden"
					/>
					<div className="peer-focus:opacity-0 opacity-100 p-3 children-input-shown">
						{renderReadOnlyValue(value, row, column, highlightQuery)}
					</div>
				</div>
			);
		case "text-icon":
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
					className="w-full h-full rounded-none border-none focus-visible:ring-orange-primary/40 absolute top-0 left-0 focus-visible:ring-offset-1 children-input-hidden"
					value={value ?? ""}
					onChange={(event) => setValue(event.target.value)}
					onBlur={handleBlur}
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
							"transition-colors absolute top-0 left-0 w-full h-full",
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
