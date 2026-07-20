// Shared contract for the "configurar desde un ejemplo" flow:
// the analyze-sample route returns a SampleAnalysis, and the wizard
// converts the user-reviewed proposal into the ImportedDefinition JSON
// that the folder editor already knows how to apply.

export type SampleFieldConfidence = "alta" | "media" | "baja";

export type SampleAnalysisDataType =
	| "text"
	| "number"
	| "currency"
	| "date"
	| "boolean";

export type SampleAnalysisField = {
	fieldKey: string;
	label: string;
	dataType: SampleAnalysisDataType;
	/** Actual value read from the sample document, so the user reviews data, not schemas. */
	sampleValue: string | null;
	confidence: SampleFieldConfidence;
	/** One-line business meaning, used as extraction hint. */
	meaning: string;
	aliases: string[];
};

export type SampleAnalysisTable = {
	label: string;
	description: string;
	columns: SampleAnalysisField[];
	/** First rows read from the sample, keyed by column fieldKey. */
	sampleRows: Array<Record<string, string>>;
	totalRowsSeen: number;
};

export type SampleDocumentFormat =
	| "pdf_texto"
	| "escaneo"
	| "foto"
	| "planilla";

export type SampleAnalysis = {
	document: {
		/** Ej: "certificado mensual de obra". Also the folder-name suggestion. */
		family: string;
		summary: string;
		format: SampleDocumentFormat;
		legibility: SampleFieldConfidence;
		pageCount: number;
		sheets: Array<{ name: string; hasData: boolean; summary: string }>;
		layoutHint: "formulario_fijo" | "variable";
	};
	fields: SampleAnalysisField[];
	tables: SampleAnalysisTable[];
	suggestedInstructions: string[];
	warnings: string[];
};

export type SampleAnswers = {
	/** How documents will arrive over time. */
	arrival?: "digital" | "fotos";
	/** Whether the layout is stable across documents. */
	layout?: "fijo" | "variable";
	/** For multi-sheet spreadsheets: fixed sheet vs search by content. */
	sheets?: "fija" | "buscar";
};

export function answersToInstructions(answers: SampleAnswers): string[] {
	const lines: string[] = [];
	if (answers.arrival === "fotos") {
		lines.push(
			"Los documentos pueden llegar como fotos o escaneos: tolerar inclinación, sombras y baja calidad de imagen.",
		);
	}
	if (answers.layout === "variable") {
		lines.push(
			"El formato puede variar según quién emite el documento: no asumir posiciones fijas, buscar cada dato por su significado y sus etiquetas.",
		);
	}
	if (answers.sheets === "buscar") {
		lines.push(
			"En planillas con varias hojas, la información puede estar en cualquier hoja: elegir la hoja cuyo contenido coincida con los campos pedidos.",
		);
	}
	return lines;
}

export type BuildDefinitionOptions = {
	/** fieldKeys of header fields the user kept selected. */
	selectedFieldKeys: string[];
	/** label of each table the user kept, with the selected column fieldKeys. */
	selectedTables: Array<{ label: string; columnFieldKeys: string[] }>;
	answers: SampleAnswers;
};

/**
 * Converts a reviewed SampleAnalysis into the ImportedDefinition shape that
 * `importDefinitionToFolderConfig` (folder editor) already consumes.
 */
export function buildImportedDefinitionFromAnalysis(
	analysis: SampleAnalysis,
	options: BuildDefinitionOptions,
) {
	const selectedFieldKeySet = new Set(options.selectedFieldKeys);
	const fields = analysis.fields
		.filter((field) => selectedFieldKeySet.has(field.fieldKey))
		.map((field) => ({
			field_key: field.fieldKey,
			label: field.label,
			business_meaning: field.meaning,
			data_type: field.dataType,
			aliases: field.aliases,
			example_values: field.sampleValue ? [field.sampleValue] : [],
		}));

	const table_sections = options.selectedTables
		.map((selection) => {
			const table = analysis.tables.find(
				(candidate) => candidate.label === selection.label,
			);
			if (!table) return null;
			const columnKeySet = new Set(selection.columnFieldKeys);
			const columns = table.columns
				.filter((column) => columnKeySet.has(column.fieldKey))
				.map((column) => ({
					field_key: column.fieldKey,
					label: column.label,
					business_meaning: column.meaning,
					data_type: column.dataType,
					aliases: column.aliases,
					example_values: table.sampleRows
						.map((row) => row[column.fieldKey])
						.filter(
							(value): value is string =>
								typeof value === "string" && value.trim().length > 0,
						)
						.slice(0, 3),
				}));
			if (columns.length === 0) return null;
			return {
				label: table.label,
				description: table.description,
				columns,
			};
		})
		.filter(
			(section): section is NonNullable<typeof section> => section !== null,
		);

	const global_extraction_instructions = [
		...analysis.suggestedInstructions,
		...answersToInstructions(options.answers),
	];

	return {
		document_family: analysis.document.family,
		document_summary: analysis.document.summary,
		fields,
		table_sections,
		global_extraction_instructions,
		review_warnings: analysis.warnings,
	};
}
