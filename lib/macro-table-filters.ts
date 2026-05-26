import type { MacroTableColumn, MacroTableDataType, MacroTableRow } from "@/lib/macro-tables";
import { toNumericValue } from "@/lib/tablas";

type MacroFilterableColumn = Pick<MacroTableColumn, "id" | "dataType">;

export type MacroBooleanFilter = "all" | "true" | "false";
export type MacroTextCondition =
  | "contains"
  | "not_contains"
  | "equals"
  | "starts_with"
  | "ends_with"
  | "empty"
  | "not_empty";
export type MacroNumberCondition =
  | "equals"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "between"
  | "empty"
  | "not_empty";
export type MacroDateCondition =
  | "equals"
  | "before"
  | "after"
  | "between"
  | "from_until_today"
  | "until"
  | "today"
  | "this_week"
  | "this_month"
  | "this_year"
  | "last_7_days"
  | "last_30_days"
  | "next_7_days"
  | "next_30_days"
  | "overdue"
  | "not_overdue"
  | "empty"
  | "not_empty";

export type MacroColumnFilter = {
  value?: string;
  min?: string;
  max?: string;
  from?: string;
  to?: string;
  state?: MacroBooleanFilter;
  textCondition?: MacroTextCondition;
  numberCondition?: MacroNumberCondition;
  dateCondition?: MacroDateCondition;
  enumMode?: "include" | "exclude";
  values?: string[];
};

export type MacroTableFilters = Record<string, MacroColumnFilter>;

const normalizeText = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

const parseDateAtStartOfDay = (value: unknown) => {
  if (!value) return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  next.setHours(0, 0, 0, 0);
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

export function isMacroFilterActive(filter: MacroColumnFilter | undefined) {
  if (!filter) return false;
  return Boolean(
    filter.value?.trim() ||
      filter.min?.trim() ||
      filter.max?.trim() ||
      filter.from?.trim() ||
      filter.to?.trim() ||
      (filter.state && filter.state !== "all") ||
      filter.textCondition === "empty" ||
      filter.textCondition === "not_empty" ||
      filter.numberCondition === "empty" ||
      filter.numberCondition === "not_empty" ||
      [
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
      ].includes(filter.dateCondition ?? "") ||
      (filter.values?.length ?? 0) > 0
  );
}

const matchesTextCondition = (value: unknown, filter: MacroColumnFilter | undefined) => {
  const condition = filter?.textCondition ?? "contains";
  const raw = String(value ?? "");
  const normalizedValue = normalizeText(raw);
  const normalizedNeedle = normalizeText(filter?.value ?? "").trim();
  if (condition === "empty") return raw.trim().length === 0;
  if (condition === "not_empty") return raw.trim().length > 0;
  if (!normalizedNeedle) return true;
  if (condition === "not_contains") return !normalizedValue.includes(normalizedNeedle);
  if (condition === "equals") return normalizedValue === normalizedNeedle;
  if (condition === "starts_with") return normalizedValue.startsWith(normalizedNeedle);
  if (condition === "ends_with") return normalizedValue.endsWith(normalizedNeedle);
  return normalizedValue.includes(normalizedNeedle);
};

const matchesNumberCondition = (value: unknown, filter: MacroColumnFilter | undefined) => {
  const condition = filter?.numberCondition ?? "between";
  const numericValue = toNumericValue(value);
  if (condition === "empty") return numericValue == null;
  if (condition === "not_empty") return numericValue != null;
  if (numericValue == null) return false;
  const single = toNumericValue(filter?.value);
  const min = toNumericValue(filter?.min);
  const max = toNumericValue(filter?.max);
  if (condition === "equals") return single == null ? true : numericValue === single;
  if (condition === "gt") return single == null ? true : numericValue > single;
  if (condition === "gte") return single == null ? true : numericValue >= single;
  if (condition === "lt") return single == null ? true : numericValue < single;
  if (condition === "lte") return single == null ? true : numericValue <= single;
  if (min != null && numericValue < min) return false;
  if (max != null && numericValue > max) return false;
  return true;
};

const matchesDateCondition = (value: unknown, filter: MacroColumnFilter | undefined) => {
  const condition = filter?.dateCondition ?? "between";
  const cell = parseDateAtStartOfDay(value);
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);
  const today = todayDate.getTime();
  if (condition === "empty") return cell == null;
  if (condition === "not_empty") return cell != null;
  if (cell == null) return false;

  const single = parseDateAtStartOfDay(filter?.value);
  const start = parseDateAtStartOfDay(filter?.from);
  const end = parseDateAtStartOfDay(filter?.to);
  const cellDate = new Date(cell);

  if (condition === "equals") return single == null ? true : cell === single;
  if (condition === "before") return single == null ? true : cell < single;
  if (condition === "after") return single == null ? true : cell > single;
  if (condition === "from_until_today") return single == null ? true : cell >= single && cell <= today;
  if (condition === "until") return single == null ? true : cell <= single;
  if (condition === "today") return cell === today;
  if (condition === "this_week") return cell >= startOfCurrentWeek(todayDate) && cell <= endOfCurrentWeek(todayDate);
  if (condition === "this_month") return cellDate.getFullYear() === todayDate.getFullYear() && cellDate.getMonth() === todayDate.getMonth();
  if (condition === "this_year") return cellDate.getFullYear() === todayDate.getFullYear();
  if (condition === "last_7_days") return cell >= addDays(todayDate, -7) && cell <= today;
  if (condition === "last_30_days") return cell >= addDays(todayDate, -30) && cell <= today;
  if (condition === "next_7_days") return cell >= today && cell <= addDays(todayDate, 7);
  if (condition === "next_30_days") return cell >= today && cell <= addDays(todayDate, 30);
  if (condition === "overdue") return cell < today;
  if (condition === "not_overdue") return cell >= today;
  if (start != null && cell < start) return false;
  if (end != null && cell > end) return false;
  return true;
};

const matchesEnumCondition = (value: unknown, filter: MacroColumnFilter | undefined) => {
  const values = filter?.values ?? [];
  if (values.length === 0) return true;
  const normalizedValue = normalizeText(value).trim();
  const matches = values.some((candidate) => normalizeText(candidate).trim() === normalizedValue);
  return filter?.enumMode === "exclude" ? !matches : matches;
};

export function countActiveMacroFilters(filters: MacroTableFilters | undefined) {
  if (!filters) return 0;
  return Object.values(filters).reduce(
    (count, filter) => count + (isMacroFilterActive(filter) ? 1 : 0),
    0
  );
}

export function matchesMacroColumnFilter(
  value: unknown,
  dataType: MacroTableDataType,
  filter: MacroColumnFilter | undefined
) {
  if (!isMacroFilterActive(filter)) return true;

  switch (dataType) {
    case "number":
    case "currency":
      return matchesNumberCondition(value, filter);
    case "date":
      return matchesDateCondition(value, filter);
    case "boolean": {
      const state = filter?.state ?? "all";
      if (state === "all") return true;
      const boolValue = Boolean(value);
      return state === "true" ? boolValue : !boolValue;
    }
    case "select":
      return matchesEnumCondition(value, filter);
    case "text":
    default:
      return matchesTextCondition(value, filter);
  }
}

export function matchesMacroFilters(
  row: MacroTableRow,
  columns: MacroFilterableColumn[],
  filters: MacroTableFilters | undefined
) {
  if (!filters) return true;

  for (const column of columns) {
    const filter = filters[column.id];
    if (!matchesMacroColumnFilter(row[column.id], column.dataType, filter)) {
      return false;
    }
  }

  return true;
}

export function matchesMacroSearch(
  row: MacroTableRow,
  columns: MacroFilterableColumn[],
  query: string | undefined
) {
  const normalizedQuery = normalizeText(query ?? "");
  if (!normalizedQuery) return true;

  const searchableValues = [
    row._obraName,
    row._sourceTablaName,
    ...columns.map((column) => row[column.id]),
  ];

  return searchableValues.some((value) =>
    normalizeText(value).includes(normalizedQuery)
  );
}
