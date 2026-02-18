export type RawSheet = {
	name: string;
	rawRows: unknown[][];
	headers: string[];
	headerRowIndex: number;
	dataRows: Record<string, unknown>[];
	totalRows: number;
};

export type DbColumnDef = {
	key: string;
	label: string;
	type: "text" | "numeric" | "date" | "int";
	required?: boolean;
	keywords: string[];
};

export type DbTableId = "pmc_resumen" | "pmc_items" | "curva_plan";

export type DbTableDef = {
	id: DbTableId;
	label: string;
	description: string;
	columns: DbColumnDef[];
	extractionMode?: "vertical" | "horizontal";
};

export type ColumnMapping = {
	dbColumn: string;
	excelHeader: string | null;
	confidence: number;
};

export type SheetAnalysis = {
	sheetName: string;
	targetTable: DbTableId | null;
	matchScore: number;
	mappings: ColumnMapping[];
};

export type ExtractedTable = {
	targetTableId: DbTableId;
	sourceSheetName: string;
	mappings: ColumnMapping[];
	rows: Record<string, unknown>[];
	rowCount: number;
};

export type ParseResult = {
	fileName: string;
	sheets: RawSheet[];
	analyses: SheetAnalysis[];
};
