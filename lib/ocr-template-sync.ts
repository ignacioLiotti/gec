import type { SupabaseClient } from "@supabase/supabase-js";

import {
	ensureTablaDataType,
	normalizeFieldKey,
	remapTablaRowDataToSchema,
} from "@/lib/tablas";

export type TemplateColumnDefinition = {
	fieldKey: string;
	label: string;
	dataType: string;
	ocrScope?: "parent" | "item";
	description?: string;
	aliases?: string[];
	examples?: string[];
	excelKeywords?: string[];
	required?: boolean;
};

type PersistedColumn = {
	id: string;
	field_key: string;
	data_type: string;
	config: Record<string, unknown> | null;
};

function normalizeStringList(value: unknown) {
	return Array.isArray(value)
		? value
				.filter((item): item is string => typeof item === "string")
				.map((item) => item.trim())
				.filter(Boolean)
		: [];
}

export function normalizeTemplateColumns(value: unknown): TemplateColumnDefinition[] {
	if (!Array.isArray(value)) return [];

	return value
		.map((column, index) => {
			const item =
				typeof column === "object" && column !== null
					? (column as Record<string, unknown>)
					: null;
			if (!item) return null;

			const label =
				typeof item.label === "string" && item.label.trim().length > 0
					? item.label.trim()
					: `Columna ${index + 1}`;
			const rawFieldKey =
				typeof item.fieldKey === "string" && item.fieldKey.trim().length > 0
					? item.fieldKey
					: label;
			const scope = item.ocrScope === "parent" ? "parent" : "item";

			return {
				fieldKey: normalizeFieldKey(rawFieldKey),
				label,
				dataType: ensureTablaDataType(
					typeof item.dataType === "string" ? item.dataType : undefined,
				),
				ocrScope: scope,
				description:
					typeof item.description === "string" && item.description.trim().length > 0
						? item.description.trim()
						: undefined,
				aliases: normalizeStringList(item.aliases),
				examples: normalizeStringList(item.examples),
				excelKeywords: normalizeStringList(item.excelKeywords),
				required: Boolean(item.required),
			} satisfies TemplateColumnDefinition;
		})
		.filter((column): column is TemplateColumnDefinition => Boolean(column));
}

export function hasNestedTemplateColumns(columns: TemplateColumnDefinition[]) {
	const hasParent = columns.some((column) => column.ocrScope === "parent");
	const hasItem = columns.some((column) => column.ocrScope !== "parent");
	return hasParent && hasItem;
}

function templateColumnToSettingsColumn(column: TemplateColumnDefinition) {
	return {
		fieldKey: column.fieldKey,
		label: column.label,
		dataType: column.dataType,
		required: Boolean(column.required),
		ocrScope: column.ocrScope === "parent" ? "parent" : "item",
		description: column.description ?? null,
		aliases: column.aliases ?? [],
		examples: column.examples ?? [],
		excelKeywords: column.excelKeywords ?? [],
	};
}

function buildColumnConfig(
	column: TemplateColumnDefinition,
	hasNestedData: boolean,
) {
	const config: Record<string, unknown> = {};
	if (hasNestedData) {
		config.ocrScope = column.ocrScope === "parent" ? "parent" : "item";
	}
	if (column.description) {
		config.ocrDescription = column.description;
	}
	if (column.aliases && column.aliases.length > 0) {
		config.aliases = column.aliases;
	}
	if (column.examples && column.examples.length > 0) {
		config.examples = column.examples;
	}
	if (column.excelKeywords && column.excelKeywords.length > 0) {
		config.excelKeywords = column.excelKeywords;
	}
	return config;
}

function settingsReferenceTemplate(
	settings: Record<string, unknown> | null | undefined,
	templateId: string,
) {
	if (!settings) return false;
	if (settings.ocrTemplateId === templateId) return true;
	if (!Array.isArray(settings.extractedTables)) return false;

	return settings.extractedTables.some((entry) => {
		if (typeof entry !== "object" || entry === null) return false;
		return (entry as Record<string, unknown>).ocrTemplateId === templateId;
	});
}

function syncSettingsForTemplate(params: {
	settings: Record<string, unknown> | null | undefined;
	templateId: string;
	templateName: string;
	columns: TemplateColumnDefinition[];
	hasNestedData: boolean;
}) {
	const { settings, templateId, templateName, columns, hasNestedData } = params;
	const nextSettings: Record<string, unknown> = { ...(settings ?? {}) };

	if (nextSettings.ocrTemplateId === templateId) {
		nextSettings.ocrTemplateId = templateId;
		nextSettings.hasNestedData = hasNestedData;
	}

	if (Array.isArray(nextSettings.extractedTables)) {
		nextSettings.extractedTables = nextSettings.extractedTables.map((entry) => {
			if (typeof entry !== "object" || entry === null) return entry;
			const table = { ...(entry as Record<string, unknown>) };
			if (table.ocrTemplateId !== templateId) return table;
			return {
				...table,
				ocrTemplateId: templateId,
				ocrTemplateName: templateName,
				hasNestedData,
				columns: columns.map(templateColumnToSettingsColumn),
			};
		});
	}

	return nextSettings;
}

async function replaceDefaultTablaColumns(
	supabase: SupabaseClient,
	defaultTablaId: string,
	columns: TemplateColumnDefinition[],
	hasNestedData: boolean,
) {
	await supabase.from("obra_default_tabla_columns").delete().eq("default_tabla_id", defaultTablaId);

	if (columns.length === 0) return;

	const payload = columns.map((column, index) => ({
		default_tabla_id: defaultTablaId,
		field_key: column.fieldKey,
		label: column.label,
		data_type: ensureTablaDataType(column.dataType),
		required: Boolean(column.required),
		position: index,
		config: buildColumnConfig(column, hasNestedData),
	}));

	const { error } = await supabase.from("obra_default_tabla_columns").insert(payload);
	if (error) throw error;
}

async function replaceObraTablaColumns(
	supabase: SupabaseClient,
	tablaId: string,
	columns: TemplateColumnDefinition[],
	hasNestedData: boolean,
) {
	const { data: existingColumnsData, error: existingColumnsError } = await supabase
		.from("obra_tabla_columns")
		.select("id, field_key, data_type, config")
		.eq("tabla_id", tablaId)
		.order("position", { ascending: true });
	if (existingColumnsError) throw existingColumnsError;

	const { data: existingRows, error: existingRowsError } = await supabase
		.from("obra_tabla_rows")
		.select("id, data, source")
		.eq("tabla_id", tablaId);
	if (existingRowsError) throw existingRowsError;

	const existingColumns = (existingColumnsData ?? []) as PersistedColumn[];
	const previousFieldKeyByIdentity = new Map(
		existingColumns.map((column) => [column.field_key, column.field_key]),
	);

	const { error: deleteError } = await supabase
		.from("obra_tabla_columns")
		.delete()
		.eq("tabla_id", tablaId);
	if (deleteError) throw deleteError;

	if (columns.length === 0) return;

	const payload = columns.map((column, index) => ({
		tabla_id: tablaId,
		field_key: column.fieldKey,
		label: column.label,
		data_type: ensureTablaDataType(column.dataType),
		required: Boolean(column.required),
		position: index,
		config: buildColumnConfig(column, hasNestedData),
	}));

	const { data: insertedColumns, error: insertError } = await supabase
		.from("obra_tabla_columns")
		.insert(payload)
		.select("field_key, data_type, config");
	if (insertError) throw insertError;

	if (!existingRows || existingRows.length === 0) return;

	const nextColumns = (insertedColumns ?? []).map((column) => ({
		id: column.field_key as string,
		fieldKey: column.field_key as string,
		dataType: column.data_type as string,
		config: (column.config as Record<string, unknown> | null) ?? {},
	}));

	const migratedRows = existingRows.map((row) => ({
		id: row.id as string,
		tabla_id: tablaId,
		data: remapTablaRowDataToSchema({
			previousData:
				((row.data as Record<string, unknown> | null) ?? {}) as Record<string, unknown>,
			nextColumns,
			previousFieldKeyByColumnId: previousFieldKeyByIdentity,
		}),
		source: row.source ?? "manual",
	}));

	const { error: upsertError } = await supabase
		.from("obra_tabla_rows")
		.upsert(migratedRows, { onConflict: "id" });
	if (upsertError) throw upsertError;
}

export async function propagateTemplateUpdate(params: {
	supabase: SupabaseClient;
	tenantId: string;
	templateId: string;
	templateName: string;
	columns: TemplateColumnDefinition[];
}) {
	const { supabase, tenantId, templateId, templateName, columns } = params;
	const hasNestedData = hasNestedTemplateColumns(columns);

	const { data: defaultTablas, error: defaultTablasError } = await supabase
		.from("obra_default_tablas")
		.select("id, settings, ocr_template_id")
		.eq("tenant_id", tenantId)
		.eq("source_type", "ocr");
	if (defaultTablasError) throw defaultTablasError;

	for (const tabla of defaultTablas ?? []) {
		const settings = (tabla.settings as Record<string, unknown> | null) ?? {};
		const primaryMatches =
			tabla.ocr_template_id === templateId || settings.ocrTemplateId === templateId;
		if (!primaryMatches && !settingsReferenceTemplate(settings, templateId)) continue;

		const nextSettings = syncSettingsForTemplate({
			settings,
			templateId,
			templateName,
			columns,
			hasNestedData,
		});

		const { error: updateError } = await supabase
			.from("obra_default_tablas")
			.update({
				settings: nextSettings,
				ocr_template_id: primaryMatches ? templateId : tabla.ocr_template_id,
			})
			.eq("id", tabla.id as string)
			.eq("tenant_id", tenantId);
		if (updateError) throw updateError;

		if (primaryMatches) {
			await replaceDefaultTablaColumns(
				supabase,
				tabla.id as string,
				columns,
				hasNestedData,
			);
		}
	}

	const { data: obraTablas, error: obraTablasError } = await supabase
		.from("obra_tablas")
		.select("id, settings, obras!inner(tenant_id)")
		.eq("source_type", "ocr")
		.eq("obras.tenant_id", tenantId);
	if (obraTablasError) throw obraTablasError;

	for (const tabla of obraTablas ?? []) {
		const settings = (tabla.settings as Record<string, unknown> | null) ?? {};
		const primaryMatches = settings.ocrTemplateId === templateId;
		if (!primaryMatches && !settingsReferenceTemplate(settings, templateId)) continue;

		const nextSettings = syncSettingsForTemplate({
			settings,
			templateId,
			templateName,
			columns,
			hasNestedData,
		});

		const { error: updateError } = await supabase
			.from("obra_tablas")
			.update({ settings: nextSettings })
			.eq("id", tabla.id as string);
		if (updateError) throw updateError;

		if (primaryMatches) {
			await replaceObraTablaColumns(
				supabase,
				tabla.id as string,
				columns,
				hasNestedData,
			);
		}
	}
}
