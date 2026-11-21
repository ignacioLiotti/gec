import { Input } from "@/components/ui/input";
import { formatDateAsIso, parseFlexibleDateValue } from "@/lib/tablas";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { resolveCellSuggestion } from "./cell-suggestions";
import type { ColumnDef, FormTableRow } from "./types";

import { buildSuggestionKey, CellSuggestionPrompt } from "./cell-suggestion-prompt";
import type { EditableCellValue } from "./types";
const CELL_SYNC_ON_CHANGE_DEBOUNCE_MS = 180;
const NO_PENDING_SYNC = Symbol("no-pending-sync");

function useDebouncedFormSync(syncToForm: (value: unknown) => void) {
	const syncToFormRef = useRef(syncToForm);
	const syncTimeoutRef = useRef<number | null>(null);
	const pendingValueRef = useRef<unknown | typeof NO_PENDING_SYNC>(NO_PENDING_SYNC);

	useEffect(() => {
		syncToFormRef.current = syncToForm;
	}, [syncToForm]);

	const clearPendingSync = useCallback(() => {
		if (syncTimeoutRef.current !== null) {
			window.clearTimeout(syncTimeoutRef.current);
			syncTimeoutRef.current = null;
		}
		pendingValueRef.current = NO_PENDING_SYNC;
	}, []);

	const scheduleSync = useCallback(
		(value: unknown) => {
			clearPendingSync();
			pendingValueRef.current = value;
			syncTimeoutRef.current = window.setTimeout(() => {
				syncTimeoutRef.current = null;
				const pendingValue = pendingValueRef.current;
				pendingValueRef.current = NO_PENDING_SYNC;
				if (pendingValue !== NO_PENDING_SYNC) {
					syncToFormRef.current(pendingValue);
				}
			}, CELL_SYNC_ON_CHANGE_DEBOUNCE_MS);
		},
		[clearPendingSync]
	);

	const flushSync = useCallback(
		(value: unknown) => {
			clearPendingSync();
			syncToFormRef.current(value);
		},
		[clearPendingSync]
	);

	useEffect(
		() => () => {
			if (syncTimeoutRef.current !== null) {
				window.clearTimeout(syncTimeoutRef.current);
				syncTimeoutRef.current = null;
			}
			const pendingValue = pendingValueRef.current;
			pendingValueRef.current = NO_PENDING_SYNC;
			if (pendingValue !== NO_PENDING_SYNC) {
				syncToFormRef.current(pendingValue);
			}
		},
		[]
	);

	return { clearPendingSync, flushSync, scheduleSync };
}

function normalizeDateInputValue(value: EditableCellValue): string {
	if (value == null) return "";
	const parsed = parseFlexibleDateValue(value);
	if (!parsed) return "";
	return formatDateAsIso(parsed);
}

export function LocalInput<Row extends FormTableRow>({
	value: externalValue,
	onChange: syncToForm,
	onBlur,
	transformOnBlur,
	formatDisplayValue,
	column,
	row,
	cellType,
	syncOnChange = false,
	forceSyncOnChange = false,
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
	syncOnChange?: boolean;
	forceSyncOnChange?: boolean;
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
	const displayedExternal = forceSyncOnChange ? "" : normalizedExternal;
	const [draftValue, setDraftValue] = useState<string | null>(null);
	const localValue = draftValue ?? displayedExternal;
	const [ignoredSuggestionKey, setIgnoredSuggestionKey] = useState<string | null>(null);
	const { clearPendingSync, flushSync, scheduleSync } = useDebouncedFormSync(syncToForm);

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

	const handleChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const nextValue = e.target.value;
			setDraftValue(nextValue);
			setIgnoredSuggestionKey(null);
			if (syncOnChange || forceSyncOnChange) {
				scheduleSync(nextValue);
			}
		},
		[forceSyncOnChange, scheduleSync, syncOnChange]
	);

	const handleBlur = useCallback(() => {
		const finalValue = transformOnBlur ? transformOnBlur(localValue) : localValue;
		const shouldSync = transformOnBlur
			? !Object.is(finalValue, externalValue)
			: localValue !== displayedExternal;

		if (shouldSync) {
			flushSync(finalValue);
		} else {
			clearPendingSync();
		}

		setDraftValue(null);
		onBlur?.();
	}, [
		clearPendingSync,
		externalValue,
		flushSync,
		localValue,
		onBlur,
		transformOnBlur,
		displayedExternal,
	]);

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
					setDraftValue(visibleSuggestion.suggestedDisplayValue);
					flushSync(visibleSuggestion.suggestedValue);
					setIgnoredSuggestionKey(null);
				}}
				onIgnore={() => setIgnoredSuggestionKey(suggestionKey)}
				className="absolute right-1 top-1 z-20"
			/>
		</>
	);
}

export function LocalTextarea<Row extends FormTableRow>({
	value: externalValue,
	onChange: syncToForm,
	onBlur,
	column,
	row,
	cellType,
	syncOnChange = false,
	forceSyncOnChange = false,
	className,
	...props
}: Omit<React.ComponentProps<"textarea">, "onChange" | "onBlur" | "value"> & {
	value: EditableCellValue;
	onChange: (value: unknown) => void;
	onBlur?: () => void;
	column: ColumnDef<Row>;
	row: Row;
	cellType: NonNullable<ColumnDef<Row>["cellType"]> | "text";
	syncOnChange?: boolean;
	forceSyncOnChange?: boolean;
}) {
	const normalizedExternal = externalValue == null ? "" : String(externalValue);
	const displayedExternal = forceSyncOnChange ? "" : normalizedExternal;
	const [draftValue, setDraftValue] = useState<string | null>(null);
	const localValue = draftValue ?? displayedExternal;
	const [ignoredSuggestionKey, setIgnoredSuggestionKey] = useState<string | null>(null);
	const { clearPendingSync, flushSync, scheduleSync } = useDebouncedFormSync(syncToForm);

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

	const handleChange = useCallback(
		(event: React.ChangeEvent<HTMLTextAreaElement>) => {
			const nextValue = event.target.value;
			setDraftValue(nextValue);
			setIgnoredSuggestionKey(null);
			if (syncOnChange || forceSyncOnChange) {
				scheduleSync(nextValue);
			}
		},
		[forceSyncOnChange, scheduleSync, syncOnChange]
	);

	const handleBlur = useCallback(() => {
		if (localValue !== displayedExternal) {
			flushSync(localValue);
		} else {
			clearPendingSync();
		}
		setDraftValue(null);
		onBlur?.();
	}, [clearPendingSync, displayedExternal, flushSync, localValue, onBlur]);

	return (
		<>
			<textarea
				{...props}
				value={localValue}
				onChange={handleChange}
				onBlur={handleBlur}
				className={cn(className, visibleSuggestion ? "pr-24" : undefined)}
			/>
			<CellSuggestionPrompt
				suggestion={visibleSuggestion}
				onApply={() => {
					if (!visibleSuggestion) return;
					setDraftValue(visibleSuggestion.suggestedDisplayValue);
					flushSync(visibleSuggestion.suggestedValue);
					setIgnoredSuggestionKey(null);
				}}
				onIgnore={() => setIgnoredSuggestionKey(suggestionKey)}
				className="absolute right-1 top-1 z-20"
			/>
		</>
	);
}
