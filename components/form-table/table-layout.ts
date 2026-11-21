import type { FormTableConfig, FormTableRow } from "./types";
export const DEFAULT_COL_WIDTH = 160;
export const DEFAULT_ROW_NUMBER_COLUMN_WIDTH = 42;
export function shouldUseSpreadsheetChrome<Row extends FormTableRow, Filters>(
	config: FormTableConfig<Row, Filters>
) {
	return (
		config.showRowNumbers === true ||
		(config.showRowNumbers !== false &&
			(config.tableId.startsWith("ocr-orders-") ||
				config.tableId.startsWith("ocr-doc-") ||
				config.tableId.startsWith("documents-new-ocr-")))
	);
}
