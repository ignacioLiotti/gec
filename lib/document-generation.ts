import {
	coerceValueForType,
	evaluateTablaFormula,
	normalizeFolderPath,
	type TablaColumnDataType,
} from "@/lib/tablas";

export const DOCUMENT_TYPES = [
	"PURCHASE_ORDER",
	"INVOICE",
	"CERTIFICATE",
	"DELIVERY_NOTE",
	"QUOTE_REQUEST",
	"ACT",
	"CUSTOM",
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const GENERATED_DOCUMENT_STATUSES = [
	"DRAFT",
	"READY_TO_GENERATE",
	"GENERATED",
	"UNDER_REVIEW",
	"APPROVED",
	"REJECTED",
	"CANCELLED",
] as const;

export type GeneratedDocumentStatus =
	(typeof GENERATED_DOCUMENT_STATUSES)[number];

export type TemplateFieldType =
	| "text"
	| "number"
	| "date"
	| "select"
	| "textarea"
	| "money"
	| "table"
	| "work_reference"
	| "supplier_reference";

export type TemplateFieldSource = "folder" | "extra";
export type TemplateSelectMode = "strict" | "creatable";
export type TemplateOptionSource = "manual" | "tenant_users";
export type TemplateAutoPopulate =
	| "none"
	| "selected_context_id"
	| "selected_context_label"
	| "document_type"
	| "next_sequence_number"
	| "today";

export type TemplateField = {
	key: string;
	label: string;
	type: TemplateFieldType;
	required: boolean;
	source?: TemplateFieldSource;
	description?: string | null;
	defaultValue?: unknown;
	options?: TemplateSelectOption[];
	selectMode?: TemplateSelectMode;
	optionSource?: TemplateOptionSource;
	optionUnitTargetKey?: string | null;
	extractionFieldKey?: string | null;
	autoPopulate?: TemplateAutoPopulate;
	repeatableGroup?: string | null;
	repeatableGroupLabel?: string | null;
	columns?: TemplateField[];
};

export type TemplateSelectOption = {
	label: string;
	value: string;
	unit?: string | null;
};

export type TemplateSchema = {
	fields: TemplateField[];
	documentNumberFieldKey?: string | null;
	fileNamePattern?: string | null;
};

export type ValidationError = {
	key: string;
	message: string;
};

export type DocumentTemplateSummary = {
	id: string;
	key: string;
	name: string;
	description: string | null;
	documentType: DocumentType;
	targetFolderPath: string | null;
	version: number;
	status: string;
	isSystem: boolean;
	tenantScoped: boolean;
	schema: TemplateSchema;
	contentHtml: string;
};

export type FolderFieldSuggestion = {
	fieldKey: string;
	label: string;
	dataType: string;
	required: boolean;
	description: string | null;
};

export type FolderGenerationConfig = {
	path: string;
	name: string;
	allowedDocumentTypes: DocumentType[];
	defaultDocumentType: DocumentType | null;
};

export type ExtractionTableColumn = {
	fieldKey: string;
	dataType: TablaColumnDataType;
	config?: Record<string, unknown> | null;
};

export const GENERATED_DOCUMENT_STATUS_LABELS: Record<string, string> = {
	DRAFT: "Borrador",
	READY_TO_GENERATE: "Listo para generar",
	GENERATED: "Esperando revision",
	UNDER_REVIEW: "Esperando revision",
	APPROVED: "Aprobado",
	REJECTED: "Rechazado",
	CANCELLED: "Cancelado",
};

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
	PURCHASE_ORDER: "Orden de compra",
	INVOICE: "Factura interna",
	CERTIFICATE: "Certificado",
	DELIVERY_NOTE: "Remito",
	QUOTE_REQUEST: "Solicitud de cotizacion",
	ACT: "Acta",
	CUSTOM: "Documento custom",
};

export function isDocumentType(value: unknown): value is DocumentType {
	return (
		typeof value === "string" && DOCUMENT_TYPES.includes(value as DocumentType)
	);
}

export function normalizeDocumentType(value: unknown): DocumentType | null {
	return isDocumentType(value) ? value : null;
}

export function normalizeTemplateSchema(value: unknown): TemplateSchema {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return { fields: [] };
	}
	const source = value as {
		fields?: unknown[];
		documentNumberFieldKey?: unknown;
		fileNamePattern?: unknown;
	};
	const rawFields = Array.isArray((value as { fields?: unknown }).fields)
		? (source.fields ?? [])
		: [];

	const fields = rawFields
		.filter(
			(field): field is Record<string, unknown> =>
				Boolean(field) && typeof field === "object" && !Array.isArray(field),
		)
		.map((field, index) => normalizeTemplateField(field, `field_${index + 1}`));

	return {
		fields,
		documentNumberFieldKey:
			typeof source.documentNumberFieldKey === "string" &&
			source.documentNumberFieldKey.trim().length > 0
				? normalizeTemplateVariableKey(source.documentNumberFieldKey)
				: null,
		fileNamePattern:
			typeof source.fileNamePattern === "string" &&
			source.fileNamePattern.trim().length > 0
				? source.fileNamePattern.trim()
				: null,
	};
}

function normalizeTemplateField(
	field: Record<string, unknown>,
	fallbackKey: string,
): TemplateField {
	const key =
		typeof field.key === "string" && field.key.trim()
			? field.key.trim()
			: fallbackKey;
	const label =
		typeof field.label === "string" && field.label.trim()
			? field.label.trim()
			: key;
	const type = normalizeFieldType(field.type);
	const repeatableGroup =
		typeof field.repeatableGroup === "string" &&
		field.repeatableGroup.trim().length > 0
			? normalizeTemplateVariableKey(field.repeatableGroup)
			: null;
	return {
		key,
		label,
		type,
		required: Boolean(field.required),
		source: normalizeFieldSource(field.source),
		description:
			typeof field.description === "string" &&
			field.description.trim().length > 0
				? field.description.trim()
				: null,
		defaultValue: field.defaultValue,
		options: Array.isArray(field.options)
			? field.options
					.filter(
						(option): option is Record<string, unknown> =>
							Boolean(option) &&
							typeof option === "object" &&
							!Array.isArray(option),
					)
					.map(normalizeTemplateSelectOption)
			: undefined,
		selectMode: normalizeSelectMode(field.selectMode),
		optionSource: normalizeOptionSource(field.optionSource),
		optionUnitTargetKey:
			typeof field.optionUnitTargetKey === "string" &&
			field.optionUnitTargetKey.trim().length > 0
				? normalizeTemplateVariableKey(field.optionUnitTargetKey)
				: null,
		extractionFieldKey:
			typeof field.extractionFieldKey === "string" &&
			field.extractionFieldKey.trim().length > 0
				? normalizeTemplateVariableKey(field.extractionFieldKey)
				: null,
		autoPopulate: normalizeAutoPopulate(field.autoPopulate),
		repeatableGroup,
		repeatableGroupLabel:
			typeof field.repeatableGroupLabel === "string" &&
			field.repeatableGroupLabel.trim().length > 0
				? field.repeatableGroupLabel.trim()
				: repeatableGroup,
		columns:
			type === "table" && Array.isArray(field.columns)
				? field.columns
						.filter(
							(column): column is Record<string, unknown> =>
								Boolean(column) &&
								typeof column === "object" &&
								!Array.isArray(column),
						)
						.map((column, index) =>
							normalizeTemplateField(column, `column_${index + 1}`),
						)
				: undefined,
	};
}

function normalizeTemplateSelectOption(
	option: Record<string, unknown>,
): TemplateSelectOption {
	const value = String(option.value ?? "").trim();
	const label =
		typeof option.label === "string" && option.label.trim()
			? option.label.trim()
			: value;
	const unit =
		typeof option.unit === "string" && option.unit.trim().length > 0
			? option.unit.trim()
			: null;
	return { label, value, unit };
}

function normalizeSelectMode(value: unknown): TemplateSelectMode | undefined {
	if (value === "strict" || value === "creatable") return value;
	return undefined;
}

function normalizeOptionSource(
	value: unknown,
): TemplateOptionSource | undefined {
	if (value === "manual" || value === "tenant_users") return value;
	return undefined;
}

function normalizeAutoPopulate(
	value: unknown,
): TemplateAutoPopulate | undefined {
	if (value === "work_id") return "selected_context_id";
	if (value === "work_label") return "selected_context_label";
	if (value === "next_document_number") return "next_sequence_number";
	if (
		value === "none" ||
		value === "selected_context_id" ||
		value === "selected_context_label" ||
		value === "document_type" ||
		value === "next_sequence_number" ||
		value === "today"
	) {
		return value;
	}
	return undefined;
}

function normalizeFieldType(value: unknown): TemplateFieldType {
	switch (value) {
		case "number":
		case "date":
		case "select":
		case "textarea":
		case "money":
		case "table":
		case "work_reference":
		case "supplier_reference":
			return value;
		default:
			return "text";
	}
}

function normalizeFieldSource(value: unknown): TemplateFieldSource | undefined {
	if (value === "folder" || value === "extra") return value;
	return undefined;
}

function normalizeTemplateVariableKey(value: string) {
	return value
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9_]+/g, "_")
		.replace(/^_+|_+$/g, "")
		.replace(/_+/g, "_");
}

export function normalizeFolderGenerationPath(value: unknown): string {
	if (typeof value !== "string") return "";
	return normalizeFolderPath(value);
}

export function validateTemplateInput(
	schema: TemplateSchema,
	inputData: Record<string, unknown>,
): ValidationError[] {
	const errors: ValidationError[] = [];
	const repeatableGroups = new Map<string, TemplateField[]>();

	for (const field of schema.fields) {
		if (field.type === "table") {
			errors.push(...validateTableField(field, inputData[field.key]));
			continue;
		}
		if (!field.repeatableGroup) {
			errors.push(
				...validateFieldValue(field, inputData[field.key], field.key),
			);
			continue;
		}
		repeatableGroups.set(field.repeatableGroup, [
			...(repeatableGroups.get(field.repeatableGroup) ?? []),
			field,
		]);
	}

	for (const [groupKey, fields] of repeatableGroups.entries()) {
		const rows = Array.isArray(inputData[groupKey]) ? inputData[groupKey] : [];
		const requiredFields = fields.filter((field) => field.required);
		if (requiredFields.length > 0 && rows.length === 0) {
			errors.push({
				key: groupKey,
				message: `${fields[0].repeatableGroupLabel ?? groupKey} requiere al menos una fila.`,
			});
		}

		rows.forEach((row, rowIndex) => {
			const rowData =
				row && typeof row === "object" && !Array.isArray(row)
					? (row as Record<string, unknown>)
					: {};
			for (const field of fields) {
				errors.push(
					...validateFieldValue(
						field,
						rowData[field.key],
						`${groupKey}.${rowIndex}.${field.key}`,
					),
				);
			}
		});
	}

	return errors;
}

function validateTableField(
	field: TemplateField,
	value: unknown,
): ValidationError[] {
	const errors: ValidationError[] = [];
	const rows = Array.isArray(value) ? value : [];
	const columns = field.columns ?? [];
	if (field.required && rows.length === 0) {
		errors.push({
			key: field.key,
			message: `${field.label} requiere al menos una fila.`,
		});
	}
	rows.forEach((row, rowIndex) => {
		const rowData =
			row && typeof row === "object" && !Array.isArray(row)
				? (row as Record<string, unknown>)
				: {};
		for (const column of columns) {
			errors.push(
				...validateFieldValue(
					column,
					rowData[column.key],
					`${field.key}.${rowIndex}.${column.key}`,
				),
			);
		}
	});
	return errors;
}

function validateFieldValue(
	field: TemplateField,
	value: unknown,
	errorKey: string,
): ValidationError[] {
	const normalizedValue =
		typeof value === "string" ? value.trim() : value == null ? "" : value;
	const isEmpty = normalizedValue == null || normalizedValue === "";
	if (!field.required && isEmpty) return [];
	if (field.type === "number" || field.type === "money") {
		if (isEmpty) {
			return [{ key: errorKey, message: `${field.label} es obligatorio.` }];
		}
		const parsed = Number(normalizedValue);
		if (!Number.isFinite(parsed)) {
			return [{ key: errorKey, message: `${field.label} debe ser numerico.` }];
		}
		return [];
	}
	if (
		field.type === "date" &&
		typeof normalizedValue === "string" &&
		normalizedValue.length > 0
	) {
		if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedValue)) {
			return [
				{ key: errorKey, message: `${field.label} debe ser una fecha valida.` },
			];
		}
		return [];
	}
	if (
		field.type === "select" &&
		(field.selectMode ?? "strict") === "strict" &&
		typeof normalizedValue === "string" &&
		normalizedValue.length > 0
	) {
		const validValues = new Set(
			(field.options ?? []).map((option) => option.value),
		);
		if (!validValues.has(normalizedValue)) {
			return [
				{ key: errorKey, message: `${field.label} debe elegirse de la lista.` },
			];
		}
	}
	if (isEmpty) {
		return [{ key: errorKey, message: `${field.label} es obligatorio.` }];
	}
	return [];
}

export function buildInitialInputData(
	schema: TemplateSchema,
	current: Record<string, unknown> = {},
) {
	const next: Record<string, unknown> = { ...current };
	const repeatableGroups = new Map<string, TemplateField[]>();
	for (const field of schema.fields) {
		if (field.type === "table") {
			if (!Array.isArray(next[field.key])) {
				const columns = field.columns ?? [];
				const row = Object.fromEntries(
					columns
						.filter((column) => column.defaultValue !== undefined)
						.map((column) => [column.key, column.defaultValue]),
				);
				next[field.key] = [row];
			}
			continue;
		}
		if (field.repeatableGroup) {
			repeatableGroups.set(field.repeatableGroup, [
				...(repeatableGroups.get(field.repeatableGroup) ?? []),
				field,
			]);
			continue;
		}
		if (!(field.key in next) && field.defaultValue !== undefined) {
			next[field.key] = field.defaultValue;
		}
	}
	for (const [groupKey, fields] of repeatableGroups.entries()) {
		if (Array.isArray(next[groupKey])) continue;
		const row = Object.fromEntries(
			fields
				.filter((field) => field.defaultValue !== undefined)
				.map((field) => [field.key, field.defaultValue]),
		);
		next[groupKey] = [row];
	}
	return next;
}

const TEMPLATE_FIELD_ALIAS_GROUPS = [
	[
		"nro",
		"orderNumber",
		"ordernumber",
		"numero_orden",
		"numeroorden",
		"nro_orden",
		"pedido",
	],
	["fecha_orden", "issueDate", "issuedate", "fecha"],
	["proveedor", "supplier"],
	["empresa_solicita", "requester", "solicitante"],
	["total_orden", "total", "importe_total"],
	["detail", "detalle"],
];

function hasTemplateInputValue(value: unknown) {
	if (value == null) return false;
	if (typeof value === "string") return value.trim().length > 0;
	if (Array.isArray(value)) return value.length > 0;
	return true;
}

function collectTableColumnValues(
	schema: TemplateSchema,
	inputData: Record<string, unknown>,
	columnKeys: string[],
) {
	const values: string[] = [];
	const wantedKeys = new Set(columnKeys);
	for (const field of schema.fields) {
		const rows = inputData[field.key];
		if (field.type !== "table" || !Array.isArray(rows)) continue;
		const columns = field.columns ?? [];
		const matchingColumnKeys = columns
			.map((column) => column.key)
			.filter((key) => wantedKeys.has(key));
		if (matchingColumnKeys.length === 0) continue;
		for (const row of rows) {
			if (!row || typeof row !== "object" || Array.isArray(row)) continue;
			const rowData = row as Record<string, unknown>;
			for (const key of matchingColumnKeys) {
				const value = rowData[key];
				if (hasTemplateInputValue(value)) {
					values.push(String(value).trim());
				}
			}
		}
	}
	return values;
}

export function applyTemplateAliasInputData(
	schema: TemplateSchema,
	current: Record<string, unknown>,
) {
	const next: Record<string, unknown> = { ...current };
	const topLevelFieldKeys = new Set(
		schema.fields
			.filter((field) => field.type !== "table" && !field.repeatableGroup)
			.map((field) => field.key),
	);

	const copyAliasValue = (keys: string[], fallbackValue?: unknown) => {
		const sourceValue = hasTemplateInputValue(fallbackValue)
			? fallbackValue
			: keys.map((key) => next[key]).find(hasTemplateInputValue);
		if (!hasTemplateInputValue(sourceValue)) return;
		for (const key of keys) {
			if (topLevelFieldKeys.has(key) && !hasTemplateInputValue(next[key])) {
				next[key] = sourceValue;
			}
		}
	};

	for (const aliases of TEMPLATE_FIELD_ALIAS_GROUPS) {
		copyAliasValue(aliases);
	}

	const detailFromTableRows = collectTableColumnValues(schema, next, [
		"detalle",
		"detail",
	]).join("; ");
	copyAliasValue(["detail", "detalle"], detailFromTableRows);

	return next;
}

export function applyTemplateAutoInputData(
	schema: TemplateSchema,
	current: Record<string, unknown>,
	context: {
		selectedContextId?: string | null;
		selectedContextLabel?: string | null;
		documentType?: string | null;
		existingSequenceCount?: number | null;
		today?: string | null;
		workId?: string | null;
		workLabel?: string | null;
		existingDocumentCount?: number | null;
	},
) {
	const next: Record<string, unknown> = { ...current };
	const selectedContextId = context.selectedContextId ?? context.workId ?? "";
	const selectedContextLabel =
		context.selectedContextLabel ?? context.workLabel ?? "";
	const existingSequenceCount =
		context.existingSequenceCount ?? context.existingDocumentCount ?? 0;
	const today = context.today ?? new Date().toISOString().slice(0, 10);
	for (const field of schema.fields) {
		if (field.type === "table" || field.repeatableGroup) continue;
		const currentValue = next[field.key];
		if (currentValue != null && String(currentValue).trim().length > 0)
			continue;

		switch (field.autoPopulate) {
			case "selected_context_id":
				next[field.key] = selectedContextId;
				break;
			case "selected_context_label":
				next[field.key] = selectedContextLabel;
				break;
			case "document_type":
				next[field.key] = context.documentType ?? "";
				break;
			case "next_sequence_number":
				next[field.key] = String(Number(existingSequenceCount) + 1);
				break;
			case "today":
				next[field.key] = today;
				break;
			default:
				break;
		}
	}
	return next;
}

export function renderTemplateFileNamePattern(
	pattern: string | null | undefined,
	inputData: Record<string, unknown>,
	context: {
		templateName?: string | null;
		documentType?: string | null;
		workName?: string | null;
		folderPath?: string | null;
		documentNumberFieldKey?: string | null;
	} = {},
) {
	const normalizedPattern = typeof pattern === "string" ? pattern.trim() : "";
	if (!normalizedPattern) return "";
	const numberFieldKey = context.documentNumberFieldKey ?? "";
	const numberValue = numberFieldKey ? inputData[numberFieldKey] : "";
	const values: Record<string, unknown> = {
		...inputData,
		templateName: context.templateName ?? "",
		documentType: context.documentType ?? "",
		workName: context.workName ?? "",
		folderPath: context.folderPath ?? "",
		number: numberValue,
		numero: numberValue,
		nro: numberValue,
	};
	return normalizedPattern
		.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) =>
			String(values[key] ?? "").trim(),
		)
		.replace(/\s+/g, " ")
		.trim();
}

export function escapeHtml(value: unknown): string {
	return String(value ?? "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

const OC_TEMPLATE_FONT_SCALE_STYLE = `
<style data-document-generation-oc-font-scale>
  .oc {
    --oc-font-size: var(--document-oc-font-size, var(--document-template-font-size, 9px)) !important;
    font-size: var(--oc-font-size) !important;
  }

  @media print {
    .oc {
      --oc-font-size: var(--document-oc-print-font-size, var(--document-oc-font-size, var(--document-template-font-size, 9px))) !important;
      font-size: var(--oc-font-size) !important;
    }
  }
</style>`;

function usesOcTemplateWrapper(templateHtml: string) {
	return /\bclass\s*=\s*["'][^"']*\boc\b[^"']*["']/i.test(templateHtml);
}

function applyDocumentTemplateOverrides(
	templateHtml: string,
	renderedHtml: string,
) {
	if (!usesOcTemplateWrapper(templateHtml)) return renderedHtml;
	return `${renderedHtml}${OC_TEMPLATE_FONT_SCALE_STYLE}`;
}

export function renderDocumentHtml(
	templateHtml: string,
	inputData: Record<string, unknown>,
	extraData: Record<string, unknown> = {},
): string {
	const scope = {
		...Object.fromEntries(
			Object.entries(inputData).map(([key, value]) => [
				key,
				formatTemplateValue(value),
			]),
		),
		...Object.fromEntries(
			Object.entries(extraData).map(([key, value]) => [
				key,
				formatTemplateValue(value),
			]),
		),
	};

	const renderedRepeatables = templateHtml.replace(
		/\{\{#\s*([a-zA-Z0-9_]+)\s*\}\}([\s\S]*?)\{\{\/\s*\1\s*\}\}/g,
		(_, groupKey: string, block: string) => {
			const rows = Array.isArray(inputData[groupKey])
				? inputData[groupKey]
				: [];
			return rows
				.map((row) => {
					const rowScope =
						row && typeof row === "object" && !Array.isArray(row)
							? Object.fromEntries(
									Object.entries(row).map(([key, value]) => [
										key,
										formatTemplateValue(value),
									]),
								)
							: {};
					return block.replace(
						/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
						(_rowMatch: string, token: string) => {
							return escapeHtml(rowScope[token] ?? scope[token] ?? "");
						},
					);
				})
				.join("");
		},
	);

	const renderedHtml = renderedRepeatables.replace(
		/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
		(_, token: string) => {
			return escapeHtml(scope[token] ?? "");
		},
	);
	return applyDocumentTemplateOverrides(templateHtml, renderedHtml);
}

export function appendApprovalSignatureHtml(
	html: string,
	signature: {
		dataUrl: string;
		signerLabel?: string | null;
		signedAt?: string | null;
	},
) {
	const signerLabel = escapeHtml(signature.signerLabel ?? "Aprobado");
	const signedAt = escapeHtml(signature.signedAt ?? "");
	return `${html}
<section data-document-approval-signature style="margin:32px 40px 24px auto; width:220px; text-align:center; font-family: Arial, sans-serif; color:#1f2937;">
  <img src="${escapeHtml(signature.dataUrl)}" alt="Firma digital" style="display:block; max-width:190px; max-height:82px; object-fit:contain; margin:0 auto 8px;" />
  <div style="border-top:1px solid #374151; padding-top:6px; font-size:12px; line-height:1.35;">
    <strong>${signerLabel}</strong>
    ${signedAt ? `<br /><span style="color:#6b7280;">${signedAt}</span>` : ""}
  </div>
</section>`;
}

function formatTemplateValue(value: unknown): string {
	if (value == null) return "";
	if (Array.isArray(value)) {
		return value.map((entry) => formatTemplateValue(entry)).join(", ");
	}
	if (typeof value === "object") {
		return JSON.stringify(value);
	}
	return String(value);
}

export function sanitizeGeneratedFileName(base: string) {
	const normalized = base
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-zA-Z0-9._ -]/g, "-")
		.replace(/-+/g, "-")
		.replace(/\s+/g, " ")
		.trim();
	return normalized || `documento-${Date.now()}.pdf`;
}

export function withNumericSuffix(fileName: string, attempt: number) {
	if (attempt <= 1) return fileName;
	const dotIndex = fileName.lastIndexOf(".");
	if (dotIndex <= 0) return `${fileName} (${attempt})`;
	return `${fileName.slice(0, dotIndex)} (${attempt})${fileName.slice(dotIndex)}`;
}

export function buildDocumentGenerationExtractionRows(params: {
	schema: TemplateSchema;
	inputData: Record<string, unknown>;
	columns: ExtractionTableColumn[];
	documentMeta: {
		bucket: string;
		path: string;
		fileName: string;
	};
}) {
	const { schema, inputData, columns, documentMeta } = params;
	if (columns.length === 0) return [] as Array<Record<string, unknown>>;

	const targetFieldKeys = new Set(columns.map((column) => column.fieldKey));
	const extractionBindings = buildExtractionFieldBindings(schema);
	const candidateRows = collectCandidateRows(schema, inputData).sort(
		(left, right) =>
			getCandidateOverlap(right.rows, targetFieldKeys, extractionBindings) -
			getCandidateOverlap(left.rows, targetFieldKeys, extractionBindings),
	);
	const bestCandidate = candidateRows[0];
	const hasScopedColumns = columns.some((column) => {
		const scope = column.config?.ocrScope;
		return scope === "parent" || scope === "item";
	});
	const shouldUseCandidateRows =
		Boolean(bestCandidate) &&
		bestCandidate.rows.length > 0 &&
		(hasScopedColumns ||
			getCandidateOverlap(
				bestCandidate.rows,
				targetFieldKeys,
				extractionBindings,
			) > 0);

	const rowSources = shouldUseCandidateRows
		? (bestCandidate?.rows ?? [])
		: [null];

	return rowSources.map((rowSource) => {
		const normalized = buildExtractionRow(
			columns,
			inputData,
			rowSource,
			extractionBindings,
		);
		normalized.__docBucket = documentMeta.bucket;
		normalized.__docPath = documentMeta.path;
		normalized.__docFileName = documentMeta.fileName;
		return applyFormulaColumns(normalized, columns);
	});
}

function collectCandidateRows(
	schema: TemplateSchema,
	inputData: Record<string, unknown>,
) {
	const candidates: Array<{
		key: string;
		rows: Array<Record<string, unknown>>;
	}> = [];
	const repeatableGroups = new Set<string>();

	for (const field of schema.fields) {
		if (field.type === "table") {
			const rows = normalizeRowArray(inputData[field.key]);
			if (rows.length > 0) {
				candidates.push({ key: field.key, rows });
			}
			continue;
		}
		if (field.repeatableGroup && !repeatableGroups.has(field.repeatableGroup)) {
			repeatableGroups.add(field.repeatableGroup);
			const rows = normalizeRowArray(inputData[field.repeatableGroup]);
			if (rows.length > 0) {
				candidates.push({ key: field.repeatableGroup, rows });
			}
		}
	}

	return candidates;
}

function normalizeRowArray(value: unknown) {
	if (!Array.isArray(value)) return [] as Array<Record<string, unknown>>;
	return value
		.filter(
			(row): row is Record<string, unknown> =>
				Boolean(row) && typeof row === "object" && !Array.isArray(row),
		)
		.map((row) => ({ ...row }));
}

function getCandidateOverlap(
	rows: Array<Record<string, unknown>>,
	targetFieldKeys: Set<string>,
	extractionBindings: Map<string, string[]>,
) {
	return rows.reduce((best, row) => {
		const rowKeys = new Set(
			Object.keys(row).flatMap((key) =>
				getExtractionFieldAliases(key, extractionBindings),
			),
		);
		const overlap = Array.from(targetFieldKeys).filter((key) =>
			getExtractionFieldAliases(key, extractionBindings).some((alias) =>
				rowKeys.has(alias),
			),
		).length;
		return Math.max(best, overlap);
	}, 0);
}

function buildExtractionFieldBindings(schema: TemplateSchema) {
	const bindings = new Map<string, string[]>();
	const register = (
		extractionFieldKey: string | null | undefined,
		templateFieldKey: string,
	) => {
		const normalizedExtractionKey = normalizeExtractionFieldKey(
			extractionFieldKey || templateFieldKey,
		);
		const normalizedTemplateKey = normalizeExtractionFieldKey(templateFieldKey);
		const current = bindings.get(normalizedExtractionKey) ?? [];
		bindings.set(
			normalizedExtractionKey,
			Array.from(new Set([...current, normalizedTemplateKey])),
		);
	};

	for (const field of schema.fields) {
		if (field.type === "table") {
			for (const column of field.columns ?? []) {
				register(column.extractionFieldKey, column.key);
			}
			continue;
		}
		register(field.extractionFieldKey, field.key);
	}

	return bindings;
}

const EXTRACTION_FIELD_ALIAS_GROUPS = [
	[
		"nro",
		"numero",
		"numero_orden",
		"numeroorden",
		"nro_orden",
		"ordernumber",
		"order_number",
		"pedido",
	],
	["fecha_orden", "fecha", "issuedate", "issue_date"],
	["empresa_solicita", "solicitante", "requester"],
	["gestor_compra", "gestor", "gestor_pedido", "gestor_del_pedido"],
	["obra_destino", "obra", "work", "workname", "work_name"],
	["proveedor", "supplier"],
	["fecha_entrega", "entrega", "delivery_date"],
	["forma_pago", "pago", "forma_de_pago"],
	["observaciones", "observacion", "notas", "notes"],
	["nro_factura_remito", "factura_remito", "nro_remito", "nro_factura"],
	["retira", "retira_nombre", "retira_persona"],
	[
		"detalle",
		"detail",
		"detalle_descriptivo",
		"descripcion",
		"descripcion_item",
	],
	["total_orden", "total", "importe_total"],
	["total_a_pagar", "importe_a_pagar", "pagar"],
	["precio_unitario", "precio_unit", "unit_price"],
	["precio_total", "total_item", "line_total"],
	["recargo_porcentaje", "recargo_pct", "porcentaje_recargo"],
	["bonificacion_porcentaje", "bonificacion_pct", "porcentaje_bonificacion"],
];

function normalizeExtractionFieldKey(value: string) {
	return value
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, "_")
		.replace(/^_+|_+$/g, "")
		.replace(/_+/g, "_");
}

function getExtractionFieldAliases(
	fieldKey: string,
	extractionBindings?: Map<string, string[]>,
) {
	const normalizedKey = normalizeExtractionFieldKey(fieldKey);
	const aliases = new Set([fieldKey, normalizedKey]);
	for (const boundKey of extractionBindings?.get(normalizedKey) ?? []) {
		aliases.add(boundKey);
	}
	for (const [extractionKey, boundKeys] of extractionBindings?.entries() ??
		[]) {
		if (boundKeys.includes(normalizedKey)) {
			aliases.add(extractionKey);
		}
	}
	for (const group of EXTRACTION_FIELD_ALIAS_GROUPS) {
		const normalizedGroup = group.map(normalizeExtractionFieldKey);
		if (normalizedGroup.includes(normalizedKey)) {
			for (const alias of normalizedGroup) aliases.add(alias);
		}
	}
	return Array.from(aliases);
}

function findValueByExtractionAliases(
	source: Record<string, unknown>,
	fieldKey: string,
	extractionBindings: Map<string, string[]>,
) {
	if (Object.prototype.hasOwnProperty.call(source, fieldKey)) {
		return source[fieldKey];
	}
	const sourceByNormalizedKey = new Map(
		Object.entries(source).map(([key, value]) => [
			normalizeExtractionFieldKey(key),
			value,
		]),
	);
	for (const alias of getExtractionFieldAliases(fieldKey, extractionBindings)) {
		if (sourceByNormalizedKey.has(normalizeExtractionFieldKey(alias))) {
			return sourceByNormalizedKey.get(normalizeExtractionFieldKey(alias));
		}
	}
	return undefined;
}

function buildExtractionRow(
	columns: ExtractionTableColumn[],
	inputData: Record<string, unknown>,
	rowSource: Record<string, unknown> | null,
	extractionBindings: Map<string, string[]>,
) {
	const rowData: Record<string, unknown> = {};

	for (const column of columns) {
		const value =
			(rowSource
				? findValueByExtractionAliases(
						rowSource,
						column.fieldKey,
						extractionBindings,
					)
				: undefined) ??
			findValueByExtractionAliases(
				inputData,
				column.fieldKey,
				extractionBindings,
			);
		rowData[column.fieldKey] = coerceValueForType(column.dataType, value);
	}

	return rowData;
}

function applyFormulaColumns(
	rowData: Record<string, unknown>,
	columns: ExtractionTableColumn[],
) {
	const nextRow = { ...rowData };
	for (const column of columns) {
		const formula =
			column.config && typeof column.config.formula === "string"
				? column.config.formula.trim()
				: "";
		if (!formula) continue;
		const computed = evaluateTablaFormula(formula, nextRow);
		nextRow[column.fieldKey] = coerceValueForType(column.dataType, computed);
	}
	return nextRow;
}
