import type { MacroTableColumn, MacroTableDataType, MacroTableRow } from "@/lib/macro-tables";
import { toNumericValue } from "@/lib/tablas";

type MacroFilterableColumn = Pick<MacroTableColumn, "id" | "dataType">;

export type MacroBooleanFilter = "all" | "true" | "false";

export type MacroColumnFilter = {
  value?: string;
  min?: string;
  max?: string;
  from?: string;
  to?: string;
  state?: MacroBooleanFilter;
};

export type MacroTableFilters = Record<string, MacroColumnFilter>;

const normalizeText = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

const isDateWithinRange = (
  value: unknown,
  from: string | undefined,
  to: string | undefined
) => {
  if (!from && !to) return true;
  if (!value) return false;

  const valueTime = new Date(String(value)).getTime();
  if (Number.isNaN(valueTime)) return false;

  if (from) {
    const fromTime = new Date(from).getTime();
    if (!Number.isNaN(fromTime) && valueTime < fromTime) return false;
  }

  if (to) {
    const toTime = new Date(to).getTime();
    if (!Number.isNaN(toTime) && valueTime > toTime) return false;
  }

  return true;
};

const isNumberWithinRange = (
  value: unknown,
  min: string | undefined,
  max: string | undefined
) => {
  if (!min && !max) return true;
  const numericValue = toNumericValue(value);
  if (numericValue == null) return false;

  const minValue = toNumericValue(min);
  const maxValue = toNumericValue(max);

  if (min && minValue != null && numericValue < minValue) return false;
  if (max && maxValue != null && numericValue > maxValue) return false;
  return true;
};

export function isMacroFilterActive(filter: MacroColumnFilter | undefined) {
  if (!filter) return false;
  return Boolean(
    filter.value?.trim() ||
      filter.min?.trim() ||
      filter.max?.trim() ||
      filter.from?.trim() ||
      filter.to?.trim() ||
      (filter.state && filter.state !== "all")
  );
}

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
      return isNumberWithinRange(value, filter?.min, filter?.max);
    case "date":
      return isDateWithinRange(value, filter?.from, filter?.to);
    case "boolean": {
      const state = filter?.state ?? "all";
      if (state === "all") return true;
      const boolValue = Boolean(value);
      return state === "true" ? boolValue : !boolValue;
    }
    case "text":
    default:
      return normalizeText(value).includes(normalizeText(filter?.value ?? ""));
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
