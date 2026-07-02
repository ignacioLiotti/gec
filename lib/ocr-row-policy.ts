type RowMode = "multiple" | "single";

function parseMaxRows(value: unknown) {
	const parsed =
		typeof value === "number"
			? Math.floor(value)
			: Number.parseInt(String(value ?? ""), 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function applyOcrExtractionRowPolicy(
	items: Record<string, unknown>[],
	settings: Record<string, unknown> | null | undefined,
	options?: {
		hasItemColumns?: boolean;
	},
) {
	const maxRows = parseMaxRows(settings?.extractionMaxRows);
	if (settings?.ocrProfile === "materials") {
		return maxRows ? items.slice(0, maxRows) : items;
	}

	const explicitRowMode =
		settings?.extractionRowMode === "multiple" || settings?.extractionRowMode === "single"
			? (settings.extractionRowMode as RowMode)
			: null;
	const inferredRowMode: RowMode =
		settings?.spreadsheetPresetKey === "pmc_items" || options?.hasItemColumns
			? "multiple"
			: "single";
	const rowMode = explicitRowMode ?? inferredRowMode;

	if (rowMode === "single") {
		// Legacy OCR folder defaults stored single+maxRows=1 even for item tables.
		// When the extraction already produced multiple items, keep them instead
		// of silently dropping every row after the first.
		if (options?.hasItemColumns && maxRows === 1 && items.length > 1) {
			return items;
		}
		return items.length > 0 ? [items[0]] : [];
	}

	// Backward compatibility: some OCR item-table presets were saved as
	// rowMode="multiple" but extractionMaxRows=1, which collapses all items.
	// For item tables, treat that legacy value as "no limit".
	if (options?.hasItemColumns && maxRows === 1) {
		return items;
	}

	return maxRows ? items.slice(0, maxRows) : items;
}
