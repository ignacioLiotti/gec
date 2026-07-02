'use client';

import { CalendarDays, DollarSign, Hash, ListFilter, ToggleLeft, Type } from "lucide-react";
import {
	BooleanConditionFilter,
	DateConditionFilter,
	EnumConditionFilter,
	FilterSection,
	NumberConditionFilter,
	TextConditionFilter,
	createDateFilterValue,
	createEnumFilterValue,
	createNumberFilterValue,
	createTextFilterValue,
	type BooleanFilterCondition,
	type DateFilterCondition,
	type DateFilterValue,
	type EnumFilterOption,
	type EnumFilterValue,
	type NumberFilterValue,
	type TextFilterValue,
} from "@/components/form-table/filter-components";
import type { CellType, ColumnDef, ColumnFilterType, FormTableRow } from "@/components/form-table/types";
import { getMainTableSelectOptionId, resolveMainTableSelectOption } from "@/lib/main-table-select";

export type AutoColumnFilterValue =
	| { type: "text"; value: TextFilterValue }
	| { type: "number"; value: NumberFilterValue }
	| { type: "date"; value: DateFilterValue }
	| { type: "boolean"; value: BooleanFilterCondition }
	| { type: "enum"; value: EnumFilterValue };

export type AutoColumnFilters = Record<string, AutoColumnFilterValue>;

type AutoFilterColumn<Row extends FormTableRow> = {
	column: ColumnDef<Row>;
	type: ColumnFilterType;
};

type AutoColumnFiltersRendererProps<Row extends FormTableRow> = {
	columns: ColumnDef<Row>[];
	filters: AutoColumnFilters;
	onChange: (updater: (prev: AutoColumnFilters) => AutoColumnFilters) => void;
};

const RELATIVE_DATE_CONDITIONS = new Set<DateFilterCondition>([
	"today",
	"this_week",
	"this_month",
	"this_year",
	"last_7_days",
	"last_30_days",
	"next_7_days",
	"next_30_days",
	"overdue",
	"not_overdue",
	"empty",
	"not_empty",
]);

const inferColumnFilterType = (cellType: CellType | undefined): ColumnFilterType | null => {
	switch (cellType) {
		case "number":
		case "currency":
			return "number";
		case "date":
			return "date";
		case "boolean":
		case "checkbox":
		case "toggle":
			return "boolean";
		case "select":
			return "enum";
		case "avatar":
		case "image":
		case "icon":
			return null;
		case "badge":
		case "link":
		case "tags":
		case "text-icon":
		case "text":
		case undefined:
		default:
			return "text";
	}
};

const resolveColumnFilterType = <Row extends FormTableRow>(
	column: ColumnDef<Row>
): ColumnFilterType | null => {
	if (column.filterType === false) return null;
	if (column.filterType) return column.filterType;
	return inferColumnFilterType(column.cellType);
};

const getAutoFilterColumns = <Row extends FormTableRow>(
	columns: ColumnDef<Row>[]
): AutoFilterColumn<Row>[] =>
	columns
		.map((column) => {
			const type = resolveColumnFilterType(column);
			return type ? { column, type } : null;
		})
		.filter((entry): entry is AutoFilterColumn<Row> => entry !== null);

const createFilterValue = (type: ColumnFilterType): AutoColumnFilterValue => {
	switch (type) {
		case "number":
			return { type, value: createNumberFilterValue("between") };
		case "date":
			return { type, value: createDateFilterValue("between") };
		case "boolean":
			return { type, value: "all" };
		case "enum":
			return { type, value: createEnumFilterValue("include") };
		case "text":
		default:
			return { type: "text", value: createTextFilterValue("contains") };
	}
};

export function createAutoColumnFilters<Row extends FormTableRow>(
	columns: ColumnDef<Row>[]
): AutoColumnFilters {
	return Object.fromEntries(
		getAutoFilterColumns(columns).map(({ column, type }) => [
			column.id,
			createFilterValue(type),
		])
	);
}

const normalizeText = (value: unknown) =>
	String(value ?? "")
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLowerCase();

const parseNumber = (value: unknown): number | null => {
	if (typeof value === "number") return Number.isFinite(value) ? value : null;
	const raw = String(value ?? "").trim();
	if (!raw) return null;
	const withoutSpaces = raw.replace(/\s/g, "");
	const normalized =
		withoutSpaces.includes(",") && withoutSpaces.lastIndexOf(",") > withoutSpaces.lastIndexOf(".")
			? withoutSpaces.replace(/\./g, "").replace(",", ".")
			: withoutSpaces.replace(/,/g, "");
	const parsed = Number(normalized.replace(/[^0-9+\-.]/g, ""));
	return Number.isFinite(parsed) ? parsed : null;
};

const parseDateAtStartOfDay = (value: unknown): number | null => {
	if (value instanceof Date) {
		if (Number.isNaN(value.getTime())) return null;
		const next = new Date(value);
		next.setHours(0, 0, 0, 0);
		return next.getTime();
	}
	const raw = String(value ?? "").trim();
	if (!raw) return null;
	const slashMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
	const normalized = slashMatch
		? `${slashMatch[3]}-${slashMatch[2].padStart(2, "0")}-${slashMatch[1].padStart(2, "0")}`
		: raw;
	const parsed = new Date(normalized);
	if (Number.isNaN(parsed.getTime())) return null;
	parsed.setHours(0, 0, 0, 0);
	return parsed.getTime();
};

const addDays = (date: Date, days: number) => {
	const next = new Date(date);
	next.setDate(next.getDate() + days);
	return next.getTime();
};

const startOfCurrentWeek = (today: Date) => {
	const next = new Date(today);
	const day = next.getDay();
	const diff = day === 0 ? -6 : 1 - day;
	next.setDate(next.getDate() + diff);
	next.setHours(0, 0, 0, 0);
	return next.getTime();
};

const endOfCurrentWeek = (today: Date) => addDays(new Date(startOfCurrentWeek(today)), 6);

const textFilterIsActive = (filter: TextFilterValue) =>
	filter.condition === "empty" ||
	filter.condition === "not_empty" ||
	filter.value.trim().length > 0;

const numberFilterIsActive = (filter: NumberFilterValue) =>
	filter.condition === "empty" ||
	filter.condition === "not_empty" ||
	(filter.condition === "between"
		? filter.min.trim().length > 0 || filter.max.trim().length > 0
		: filter.value.trim().length > 0);

const dateFilterIsActive = (filter: DateFilterValue) =>
	RELATIVE_DATE_CONDITIONS.has(filter.condition) ||
	(filter.condition === "between"
		? filter.start.trim().length > 0 || filter.end.trim().length > 0
		: filter.value.trim().length > 0);

export function isAutoColumnFilterActive(filter: AutoColumnFilterValue | undefined) {
	if (!filter) return false;
	switch (filter.type) {
		case "text":
			return textFilterIsActive(filter.value);
		case "number":
			return numberFilterIsActive(filter.value);
		case "date":
			return dateFilterIsActive(filter.value);
		case "boolean":
			return filter.value !== "all";
		case "enum":
			return filter.value.values.length > 0;
		default:
			return false;
	}
}

export function countActiveAutoColumnFilters(filters: AutoColumnFilters | undefined) {
	if (!filters) return 0;
	return Object.values(filters).reduce(
		(count, filter) => count + (isAutoColumnFilterActive(filter) ? 1 : 0),
		0
	);
}

const textMatches = (value: unknown, filter: TextFilterValue) => {
	const raw = String(value ?? "");
	const cell = normalizeText(raw);
	const needle = normalizeText(filter.value).trim();
	if (filter.condition === "empty") return raw.trim().length === 0;
	if (filter.condition === "not_empty") return raw.trim().length > 0;
	if (!needle) return true;
	if (filter.condition === "not_contains") return !cell.includes(needle);
	if (filter.condition === "equals") return cell === needle;
	if (filter.condition === "starts_with") return cell.startsWith(needle);
	if (filter.condition === "ends_with") return cell.endsWith(needle);
	return cell.includes(needle);
};

const numberMatches = (value: unknown, filter: NumberFilterValue) => {
	const numericValue = parseNumber(value);
	if (filter.condition === "empty") return numericValue == null;
	if (filter.condition === "not_empty") return numericValue != null;
	if (numericValue == null) return false;
	const single = parseNumber(filter.value);
	const min = parseNumber(filter.min);
	const max = parseNumber(filter.max);
	if (filter.condition === "equals") return single == null ? true : numericValue === single;
	if (filter.condition === "gt") return single == null ? true : numericValue > single;
	if (filter.condition === "gte") return single == null ? true : numericValue >= single;
	if (filter.condition === "lt") return single == null ? true : numericValue < single;
	if (filter.condition === "lte") return single == null ? true : numericValue <= single;
	if (min != null && numericValue < min) return false;
	if (max != null && numericValue > max) return false;
	return true;
};

const dateMatches = (value: unknown, filter: DateFilterValue) => {
	const cell = parseDateAtStartOfDay(value);
	const todayDate = new Date();
	todayDate.setHours(0, 0, 0, 0);
	const today = todayDate.getTime();
	if (filter.condition === "empty") return cell == null;
	if (filter.condition === "not_empty") return cell != null;
	if (cell == null) return false;

	const single = parseDateAtStartOfDay(filter.value);
	const start = parseDateAtStartOfDay(filter.start);
	const end = parseDateAtStartOfDay(filter.end);
	const cellDate = new Date(cell);

	if (filter.condition === "equals") return single == null ? true : cell === single;
	if (filter.condition === "before") return single == null ? true : cell < single;
	if (filter.condition === "after") return single == null ? true : cell > single;
	if (filter.condition === "from_until_today") return single == null ? cell <= today : cell >= single && cell <= today;
	if (filter.condition === "until") return single == null ? true : cell <= single;
	if (filter.condition === "today") return cell === today;
	if (filter.condition === "this_week") return cell >= startOfCurrentWeek(todayDate) && cell <= endOfCurrentWeek(todayDate);
	if (filter.condition === "this_month") return cellDate.getFullYear() === todayDate.getFullYear() && cellDate.getMonth() === todayDate.getMonth();
	if (filter.condition === "this_year") return cellDate.getFullYear() === todayDate.getFullYear();
	if (filter.condition === "last_7_days") return cell >= addDays(todayDate, -7) && cell <= today;
	if (filter.condition === "last_30_days") return cell >= addDays(todayDate, -30) && cell <= today;
	if (filter.condition === "next_7_days") return cell >= today && cell <= addDays(todayDate, 7);
	if (filter.condition === "next_30_days") return cell >= today && cell <= addDays(todayDate, 30);
	if (filter.condition === "overdue") return cell < today;
	if (filter.condition === "not_overdue") return cell >= today;
	if (start != null && cell < start) return false;
	if (end != null && cell > end) return false;
	return true;
};

const booleanMatches = (value: unknown, filter: BooleanFilterCondition) => {
	if (filter === "all") return true;
	const boolValue =
		typeof value === "boolean"
			? value
			: ["true", "1", "si", "yes"].includes(String(value ?? "").trim().toLowerCase());
	return filter === "yes" ? boolValue : !boolValue;
};

const normalizedToken = (value: unknown) => normalizeText(value).trim();

const enumMatches = <Row extends FormTableRow>(
	value: unknown,
	filter: EnumFilterValue,
	column: ColumnDef<Row>
) => {
	if (filter.values.length === 0) return true;
	const selectOptions = column.cellConfig?.selectOptions ?? [];
	const selectName = column.cellConfig?.selectName ?? column.id;
	const resolvedOption = resolveMainTableSelectOption(value, selectOptions, selectName);
	const cellTokens = new Set<string>();
	const addCellToken = (candidate: unknown) => {
		const token = normalizedToken(candidate);
		if (token) cellTokens.add(token);
	};

	addCellToken(value);
	addCellToken(resolvedOption?.text);

	for (let index = 0; index < selectOptions.length; index += 1) {
		const option = selectOptions[index];
		const optionId = getMainTableSelectOptionId(option, selectName, index);
		if (cellTokens.has(normalizedToken(option.text)) || cellTokens.has(normalizedToken(optionId))) {
			addCellToken(option.text);
			addCellToken(optionId);
		}
	}

	const matches = filter.values.some((candidate) => cellTokens.has(normalizedToken(candidate)));
	return filter.mode === "exclude" ? !matches : matches;
};

const matchesFilterValue = <Row extends FormTableRow>(
	value: unknown,
	filter: AutoColumnFilterValue | undefined,
	column: ColumnDef<Row>
) => {
	if (!filter || !isAutoColumnFilterActive(filter)) return true;
	switch (filter.type) {
		case "text":
			return textMatches(value, filter.value);
		case "number":
			return numberMatches(value, filter.value);
		case "date":
			return dateMatches(value, filter.value);
		case "boolean":
			return booleanMatches(value, filter.value);
		case "enum":
			return enumMatches(value, filter.value, column);
		default:
			return true;
	}
};

export function matchesAutoColumnFilters<Row extends FormTableRow>(
	row: Row,
	columns: ColumnDef<Row>[],
	filters: AutoColumnFilters | undefined
) {
	if (!filters) return true;
	for (const { column, type } of getAutoFilterColumns(columns)) {
		const filter = filters[column.id];
		if (filter && filter.type !== type) continue;
		if (!matchesFilterValue(row[column.field], filter, column)) return false;
	}
	return true;
}

const iconForFilterType = (type: ColumnFilterType) => {
	switch (type) {
		case "number":
			return Hash;
		case "date":
			return CalendarDays;
		case "boolean":
			return ToggleLeft;
		case "enum":
			return ListFilter;
		case "text":
		default:
			return Type;
	}
};

const getEnumOptions = <Row extends FormTableRow>(column: ColumnDef<Row>): EnumFilterOption[] => {
	const options = column.cellConfig?.selectOptions ?? [];
	return options
		.map((option) => option.text.trim())
		.filter((text, index, all) => text.length > 0 && all.indexOf(text) === index)
		.map((text) => ({ value: text, label: text }));
};

const resetFilter = (type: ColumnFilterType) => createFilterValue(type);

export function renderAutoColumnFilters<Row extends FormTableRow>({
	columns,
	filters,
	onChange,
}: AutoColumnFiltersRendererProps<Row>) {
	const filterColumns = getAutoFilterColumns(columns);

	if (filterColumns.length === 0) {
		return (
			<p className="text-sm text-muted-foreground">
				No hay columnas configuradas para filtrar.
			</p>
		);
	}

	return (
		<div className="space-y-3">
			{filterColumns.map(({ column, type }) => {
				const currentFilter = filters[column.id];
				const filter = currentFilter?.type === type ? currentFilter : createFilterValue(type);
				const Icon = type === "number" && column.cellType === "currency" ? DollarSign : iconForFilterType(type);
				const activeCount = isAutoColumnFilterActive(filter) ? 1 : 0;
				const update = (next: AutoColumnFilterValue) =>
					onChange((prev) => ({ ...prev, [column.id]: next }));
				const clear = () =>
					onChange((prev) => ({ ...prev, [column.id]: resetFilter(type) }));

				return (
					<FilterSection
						key={column.id}
						title={column.label}
						icon={Icon}
						activeCount={activeCount}
						defaultOpen={activeCount > 0}
					>
						{filter.type === "number" ? (
							<NumberConditionFilter
								label={column.label}
								value={filter.value}
								onChange={(value) => update({ type: "number", value })}
								onClear={clear}
							/>
						) : null}
						{filter.type === "date" ? (
							<DateConditionFilter
								label={column.label}
								value={filter.value}
								onChange={(value) => update({ type: "date", value })}
								onClear={clear}
							/>
						) : null}
						{filter.type === "boolean" ? (
							<BooleanConditionFilter
								label={column.label}
								value={filter.value}
								onChange={(value) => update({ type: "boolean", value })}
								onClear={clear}
							/>
						) : null}
						{filter.type === "enum" ? (
							<EnumConditionFilter
								label={column.label}
								value={filter.value}
								options={getEnumOptions(column)}
								onChange={(value) => update({ type: "enum", value })}
								onClear={clear}
							/>
						) : null}
						{filter.type === "text" ? (
							<TextConditionFilter
								label={column.label}
								value={filter.value}
								onChange={(value) => update({ type: "text", value })}
								onClear={clear}
								placeholder={`Filtrar ${column.label.toLowerCase()}...`}
							/>
						) : null}
					</FilterSection>
				);
			})}
		</div>
	);
}
