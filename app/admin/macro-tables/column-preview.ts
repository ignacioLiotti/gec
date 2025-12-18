import type { MacroTableColumnType, MacroTableDataType } from "@/lib/macro-tables";

const PREVIEW_VALUES: Record<MacroTableDataType, [string, string, string]> = {
  text: ["Proveedor Sol", "Proveedor Luna", "Proveedor Río"],
  number: ["120", "98", "65"],
  currency: ["$ 1.250.000", "$ 980.500", "$ 654.000"],
  boolean: ["Sí", "No", "Sí"],
  date: ["12/01/2025", "18/01/2025", "26/01/2025"],
};

const CUSTOM_VALUES: [string, string, string] = [
  "Dato editable 1",
  "Dato editable 2",
  "Dato editable 3",
];

const COMPUTED_VALUES: [string, string, string] = [
  "Obra Norte",
  "Obra Centro",
  "Obra Sur",
];

export const PREVIEW_ROW_INDICES = [0, 1, 2] as const;

export function isBlurredPreviewRow(rowIndex: number): boolean {
  return rowIndex === 0 || rowIndex === PREVIEW_ROW_INDICES.length - 1;
}

export function getColumnPreviewValue(
  columnType: MacroTableColumnType,
  dataType: MacroTableDataType,
  rowIndex: number,
): string {
  if (columnType === "computed") {
    return COMPUTED_VALUES[rowIndex] ?? COMPUTED_VALUES[0];
  }

  if (columnType === "custom") {
    return CUSTOM_VALUES[rowIndex] ?? CUSTOM_VALUES[0];
  }

  const values = PREVIEW_VALUES[dataType] ?? PREVIEW_VALUES.text;
  return values[rowIndex] ?? values[0];
}
