import { LightButton } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDateAsDmy, formatDateAsIso, parseFlexibleDateValue } from "@/lib/tablas";
import { cn } from "@/lib/utils";
import { es } from "date-fns/locale";
import { CalendarDays } from "lucide-react";
import { useMemo, useState } from "react";
import { resolveCellSuggestion } from "./cell-suggestions";
import type { ColumnDef, FormTableRow } from "./types";

import { buildSuggestionKey, CellSuggestionPrompt } from "./cell-suggestion-prompt";
import type { EditableCellValue } from "./types";
export function DateCellEditor<Row extends FormTableRow>({
	value,
	setValue,
	handleBlur,
	required,
	inputProps,
	column,
	row,
	forceSyncOnChange = false,
}: {
	value: EditableCellValue;
	setValue: (value: unknown) => void;
	handleBlur: () => void;
	required?: boolean;
	inputProps?: Record<string, string>;
	column: ColumnDef<Row>;
	row: Row;
	forceSyncOnChange?: boolean;
}) {
	const [open, setOpen] = useState(false);
	const selectedDate = parseFlexibleDateValue(value ?? null);
	const externalTypedValue = useMemo(() => {
		if (forceSyncOnChange) return "";
		if (!value) return "";
		return selectedDate ? formatDateAsDmy(selectedDate) : String(value);
	}, [forceSyncOnChange, value, selectedDate]);
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
		<div className="children-input-hidden absolute inset-0 flex h-full w-full items-center gap-1 px-2">
			<Input
				type="text"
				inputMode="numeric"
				placeholder="dd/mm/aaaa"
				{...inputProps}
				value={typedValue}
				onChange={(event) => {
					const nextValue = event.target.value;
					setDraftValue(nextValue);
					if (ignoredSuggestionKey) {
						setIgnoredSuggestionKey(null);
					}
					if (forceSyncOnChange) {
						setValue(nextValue);
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
					const parsed = parseFlexibleDateValue(nextRaw);
					setDraftValue(null);
					const nextValue = parsed ? formatDateAsIso(parsed) : nextRaw;
					// Avoid false-dirty: the DB may store dates in a different format
					// (e.g. "2025-05-01T03:00:00+00:00" or "1/5/2025"). Normalise both
					// sides to ISO and skip setValue when the date hasn't actually changed.
					const currentParsed = parseFlexibleDateValue(value ?? null);
					const currentNormalized = currentParsed
						? formatDateAsIso(currentParsed)
						: value != null
							? String(value)
							: null;
					if (nextValue !== currentNormalized) {
						setValue(nextValue);
					}
					handleBlur();
				}}
				className={cn(
					"h-full min-w-0 basis-0 flex-1 rounded-none border-0 bg-transparent pl-1 shadow-none focus-visible:border-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:shadow-none",
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
					<LightButton
						type="button"
						variant="default"
						size="icon-sm"
						aria-label="Abrir calendario"
						className="shrink-0 bg-white text-content [--btn-shadow:var(--shadow-light-button)] hover:bg-accent-soft hover:text-orange-primary hover:[--btn-ring:hsl(var(--orange-primary)_/_0.32)] focus-visible:bg-accent-soft focus-visible:text-orange-primary focus-visible:ring-2 focus-visible:ring-orange-primary/35 focus-visible:ring-offset-0"
					>
						<CalendarDays className="size-4 shrink-0" />
					</LightButton>
				</PopoverTrigger>
				<PopoverContent
					className="w-auto overflow-hidden rounded-xl border-stroke-soft bg-surface p-0 shadow-dropdown"
					align="start"
				>
					<Calendar
						locale={es}
						mode="single"
						selected={selectedDate ?? undefined}
						defaultMonth={selectedDate ?? new Date()}
						onSelect={(date) => {
							if (!date) return;
							setValue(formatDateAsIso(date));
							setDraftValue(null);
							handleBlur();
							setOpen(false);
						}}
						captionLayout="dropdown"
					/>
					<div className="flex items-center justify-between border-t border-stroke-soft bg-surface-muted/60 px-3 py-2">
						<LightButton
							type="button"
							variant="default"
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
						</LightButton>
						<LightButton type="button" variant="primarySolid" onClick={() => setOpen(false)}>
							Cerrar
						</LightButton>
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
