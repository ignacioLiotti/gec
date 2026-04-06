import type { SupabaseClient } from "@supabase/supabase-js";

import {
	ensureTablaDataType,
	normalizeFieldKey,
	remapTablaRowDataToSchema,
} from "@/lib/tablas";

export type TemplateColumnDefinition = {
	id?: string;
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

export type TemplateRegionDefinition = {
	id: string;
	x: number;
	y: number;
	width: number;
	height: number;
	label: string;
	description?: string;
	type: "single" | "table";
	pageNumber?: number;
	tableColumns?: string[];
};

type PersistedColumn = {
	id: string;
	field_key: string;
	label: string;
	data_type: string;
	required: boolean;
	position: number;
	config: Record<string, unknown> | null;
};

function buildTemplateColumnId(
	scope: "parent" | "item",
	regionId: string,
	index?: number,
) {
	return scope === "parent"
		? `parent:${regionId}`
		: `item:${regionId}:${index ?? 0}`;
}

function normalizeStringList(value: unknown) {
	return Array.isArray(value)
		? value
				.filter((item): item is string => typeof item === "string")
				.map((item) => item.trim())
				.filter(Boolean)
		: [];
}

export function validateTemplateRegions(value: unknown): TemplateRegionDefinition[] {
	const regions = Array.isArray(value) ? (value as TemplateRegionDefinition[]) : [];
	return regions.filter(
		(region) =>
			typeof region.id === "string" &&
			typeof region.label === "string" &&
			typeof region.x === "number" &&
			typeof region.y === "number" &&
			typeof region.width === "number" &&
			typeof region.height === "number" &&
			(region.pageNumber === undefined ||
				(typeof region.pageNumber === "number" &&
					Number.isFinite(region.pageNumber) &&
					region.pageNumber >= 1)),
	);
}

export function normalizeTemplateColumns(value: unknown): TemplateColumnDefinition[] {
	if (!Array.isArray(value)) return [];
	const normalized: TemplateColumnDefinition[] = [];

	for (const [index, column] of value.entries()) {
		if (typeof column !== "object" || column === null) continue;
		const item = column as Record<string, unknown>;
		const label =
			typeof item.label === "string" && item.label.trim().length > 0
				? item.label.trim()
				: `Columna ${index + 1}`;
		const rawFieldKey =
			typeof item.fieldKey === "string" && item.fieldKey.trim().length > 0
				? item.fieldKey
				: label;

		normalized.push({
			id:
				typeof item.id === "string" && item.id.trim().length > 0
					? item.id.trim()
					: undefined,
			fieldKey: normalizeFieldKey(rawFieldKey),
			label,
			dataType: ensureTablaDataType(
				typeof item.dataType === "string" ? item.dataType : undefined,
			),
			ocrScope: item.ocrScope === "parent" ? "parent" : "item",
			description:
				typeof item.description === "string" && item.description.trim().length > 0
					? item.description.trim()
					: undefined,
			aliases: normalizeStringList(item.aliases),
			examples: normalizeStringList(item.examples),
			excelKeywords: normalizeStringList(item.excelKeywords),
			required: Boolean(item.required),
		});
	}

	return normalized;
}

function buildPreviousTemplateColumnsByIdentity(
	regions: TemplateRegionDefinition[],
	columns: TemplateColumnDefinition[],
) {
	const previousParentColumns = columns.filter((column) => column.ocrScope === "parent");
	const previousItemColumns = columns.filter((column) => column.ocrScope !== "parent");
	const columnsByIdentity = new Map<string, TemplateColumnDefinition>();
	let parentIndex = 0;
	let itemIndex = 0;

	for (const region of regions) {
		if (region.type === "single") {
			const column = previousParentColumns[parentIndex] ?? null;
			parentIndex += 1;
			if (column) {
				columnsByIdentity.set(buildTemplateColumnId("parent", region.id), column);
			}
			continue;
		}

		const tableColumns = Array.isArray(region.tableColumns) ? region.tableColumns : [];
		for (let index = 0; index < tableColumns.length; index += 1) {
			const column = previousItemColumns[itemIndex] ?? null;
			itemIndex += 1;
			if (column) {
				columnsByIdentity.set(buildTemplateColumnId("item", region.id, index), column);
			}
		}
	}

	return columnsByIdentity;
}

export function deriveTemplateColumnsFromRegions(params: {
	regions: TemplateRegionDefinition[];
	previousTemplate?: {
		regions?: TemplateRegionDefinition[];
		columns?: TemplateColumnDefinition[];
	} | null;
}) {
	const { regions, previousTemplate } = params;
	const previousColumnsByIdentity =
		previousTemplate?.regions && previousTemplate?.columns
			? buildPreviousTemplateColumnsByIdentity(
					previousTemplate.regions,
					previousTemplate.columns,
				)
			: new Map<string, TemplateColumnDefinition>();
	const nextColumns: TemplateColumnDefinition[] = [];

	for (const region of regions) {
		const regionDescription =
			typeof region.description === "string" ? region.description.trim() : "";
		if (region.type === "single") {
			const identity = buildTemplateColumnId("parent", region.id);
			const previousColumn = previousColumnsByIdentity.get(identity);
			nextColumns.push({
				id: previousColumn?.id ?? identity,
				fieldKey:
					typeof previousColumn?.fieldKey === "string" &&
					previousColumn.fieldKey.trim().length > 0
						? previousColumn.fieldKey
						: normalizeFieldKey(region.label),
				label: region.label,
				dataType: ensureTablaDataType(previousColumn?.dataType),
				ocrScope: "parent",
				description: regionDescription || previousColumn?.description,
				aliases: previousColumn?.aliases ?? [],
				examples: previousColumn?.examples ?? [],
				excelKeywords: previousColumn?.excelKeywords ?? [],
				required: previousColumn?.required ?? false,
			});
			continue;
		}

		const tableColumns = Array.isArray(region.tableColumns) ? region.tableColumns : [];
		for (let index = 0; index < tableColumns.length; index += 1) {
			const label = tableColumns[index];
			const identity = buildTemplateColumnId("item", region.id, index);
			const previousColumn = previousColumnsByIdentity.get(identity);
			nextColumns.push({
				id: previousColumn?.id ?? identity,
				fieldKey:
					typeof previousColumn?.fieldKey === "string" &&
					previousColumn.fieldKey.trim().length > 0
						? previousColumn.fieldKey
						: normalizeFieldKey(label),
				label,
				dataType: ensureTablaDataType(previousColumn?.dataType),
				ocrScope: "item",
				description: regionDescription || previousColumn?.description,
				aliases: previousColumn?.aliases ?? [],
				examples: previousColumn?.examples ?? [],
				excelKeywords: previousColumn?.excelKeywords ?? [],
				required: previousColumn?.required ?? false,
			});
		}
	}

	return nextColumns;
}

export function hasNestedTemplateColumns(columns: TemplateColumnDefinition[]) {
	const hasParent = columns.some((column) => column.ocrScope === "parent");
	const hasItem = columns.some((column) => column.ocrScope !== "parent");
	return hasParent && hasItem;
}

function templateColumnToSettingsColumn(column: TemplateColumnDefinition) {
	return {
		id: column.id ?? column.fieldKey,
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
	if (column.id) {
		config.templateColumnId = column.id;
	}
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

function getTemplateColumnIdentity(column: TemplateColumnDefinition) {
	return typeof column.id === "string" && column.id.trim().length > 0
		? column.id.trim()
		: column.fieldKey;
}

function getPersistedTemplateColumnIdentity(column: PersistedColumn) {
	const config = (column.config ?? {}) as Record<string, unknown>;
	return typeof config.templateColumnId === "string" && config.templateColumnId.trim().length > 0
		? config.templateColumnId.trim()
		: column.field_key;
}

function buildPreviousFieldKeyByIdentity(columns: PersistedColumn[]) {
	const previousFieldKeyByIdentity = new Map<string, string>();
	for (const column of columns) {
		previousFieldKeyByIdentity.set(getPersistedTemplateColumnIdentity(column), column.field_key);
		previousFieldKeyByIdentity.set(column.field_key, column.field_key);
	}
	return previousFieldKeyByIdentity;
}

async function syncDefaultTablaColumns(
	supabase: SupabaseClient,
	defaultTablaId: string,
	columns: TemplateColumnDefinition[],
	hasNestedData: boolean,
) {
	const { data: existingColumnsData, error: existingColumnsError } = await supabase
		.from("obra_default_tabla_columns")
		.select("id, field_key, label, data_type, required, position, config")
		.eq("default_tabla_id", defaultTablaId)
		.order("position", { ascending: true });
	if (existingColumnsError) throw existingColumnsError;

	const existingColumns = (existingColumnsData ?? []) as PersistedColumn[];
	const existingByIdentity = new Map(
		existingColumns.map((column) => [getPersistedTemplateColumnIdentity(column), column]),
	);
	const existingByFieldKey = new Map(
		existingColumns.map((column) => [column.field_key, column]),
	);
	const normalizedColumns = columns.map((column, index) => {
		const existingColumn =
			existingByIdentity.get(getTemplateColumnIdentity(column)) ??
			existingByFieldKey.get(column.fieldKey) ??
			null;
		return {
			id: existingColumn?.id,
			field_key: column.fieldKey,
			label: column.label,
			data_type: ensureTablaDataType(column.dataType),
			required: Boolean(column.required),
			position: index,
			config: buildColumnConfig(column, hasNestedData),
		};
	});

	const incomingIds = new Set(
		normalizedColumns
			.map((column) => column.id)
			.filter((id): id is string => typeof id === "string"),
	);
	const removedIds = existingColumns
		.map((column) => column.id)
		.filter((id) => !incomingIds.has(id));

	for (const column of normalizedColumns.filter((item) => item.id)) {
		const { error: updateError } = await supabase
			.from("obra_default_tabla_columns")
			.update({
				field_key: column.field_key,
				label: column.label,
				data_type: column.data_type,
				required: column.required,
				position: column.position,
				config: column.config,
			})
			.eq("id", column.id as string)
			.eq("default_tabla_id", defaultTablaId);
		if (updateError) throw updateError;
	}

	const newColumns = normalizedColumns.filter((item) => !item.id);
	if (newColumns.length > 0) {
		const { error: insertError } = await supabase.from("obra_default_tabla_columns").insert(
			newColumns.map((column) => ({
				default_tabla_id: defaultTablaId,
				field_key: column.field_key,
				label: column.label,
				data_type: column.data_type,
				required: column.required,
				position: column.position,
				config: column.config,
			})),
		);
		if (insertError) throw insertError;
	}

	if (removedIds.length > 0) {
		const { error: deleteError } = await supabase
			.from("obra_default_tabla_columns")
			.delete()
			.in("id", removedIds);
		if (deleteError) throw deleteError;
	}
}

async function syncObraTablaColumns(
	supabase: SupabaseClient,
	tablaId: string,
	columns: TemplateColumnDefinition[],
	hasNestedData: boolean,
) {
	const { data: existingColumnsData, error: existingColumnsError } = await supabase
		.from("obra_tabla_columns")
		.select("id, field_key, label, data_type, required, position, config")
		.eq("tabla_id", tablaId)
		.order("position", { ascending: true });
	if (existingColumnsError) throw existingColumnsError;

	const { data: existingRows, error: existingRowsError } = await supabase
		.from("obra_tabla_rows")
		.select("id, data, source")
		.eq("tabla_id", tablaId);
	if (existingRowsError) throw existingRowsError;

	const existingColumns = (existingColumnsData ?? []) as PersistedColumn[];
	const existingByIdentity = new Map(
		existingColumns.map((column) => [getPersistedTemplateColumnIdentity(column), column]),
	);
	const existingByFieldKey = new Map(
		existingColumns.map((column) => [column.field_key, column]),
	);
	const previousFieldKeyByIdentity = buildPreviousFieldKeyByIdentity(existingColumns);
	const normalizedColumns = columns.map((column, index) => {
		const existingColumn =
			existingByIdentity.get(getTemplateColumnIdentity(column)) ??
			existingByFieldKey.get(column.fieldKey) ??
			null;
		return {
			id: existingColumn?.id,
			identity: getTemplateColumnIdentity(column),
			field_key: column.fieldKey,
			label: column.label,
			data_type: ensureTablaDataType(column.dataType),
			required: Boolean(column.required),
			position: index,
			config: buildColumnConfig(column, hasNestedData),
		};
	});

	const incomingIds = new Set(
		normalizedColumns
			.map((column) => column.id)
			.filter((id): id is string => typeof id === "string"),
	);
	const removedIds = existingColumns
		.map((column) => column.id)
		.filter((id) => !incomingIds.has(id));

	for (const column of normalizedColumns.filter((item) => item.id)) {
		const { error: updateError } = await supabase
			.from("obra_tabla_columns")
			.update({
				field_key: column.field_key,
				label: column.label,
				data_type: column.data_type,
				required: column.required,
				position: column.position,
				config: column.config,
			})
			.eq("id", column.id as string)
			.eq("tabla_id", tablaId);
		if (updateError) throw updateError;
	}

	let insertedColumns: PersistedColumn[] = [];
	const newColumns = normalizedColumns.filter((item) => !item.id);
	if (newColumns.length > 0) {
		const { data: inserted, error: insertError } = await supabase
			.from("obra_tabla_columns")
			.insert(
				newColumns.map((column) => ({
					tabla_id: tablaId,
					field_key: column.field_key,
					label: column.label,
					data_type: column.data_type,
					required: column.required,
					position: column.position,
					config: column.config,
				})),
			)
			.select("id, field_key, label, data_type, required, position, config");
		if (insertError) throw insertError;
		insertedColumns = (inserted ?? []) as PersistedColumn[];
	}
	if (columns.length === 0) {
		if (removedIds.length > 0) {
			const { error: deleteError } = await supabase
				.from("obra_tabla_columns")
				.delete()
				.in("id", removedIds);
			if (deleteError) throw deleteError;
		}
		return;
	}

	const insertedByPosition = new Map(
		insertedColumns.map((column) => [column.position, column]),
	);
	const nextColumns = normalizedColumns.map((column) => {
		if (column.id) {
			return {
				id: column.identity,
				fieldKey: column.field_key,
				dataType: column.data_type,
				config: column.config,
			};
		}
		const inserted = insertedByPosition.get(column.position);
		if (!inserted) {
			throw new Error("No se pudo persistir una columna OCR nueva");
		}
		return {
			id: column.identity,
			fieldKey: inserted.field_key as string,
			dataType: inserted.data_type as string,
			config: (inserted.config as Record<string, unknown> | null) ?? {},
		};
	});

	if (existingRows && existingRows.length > 0) {
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

	if (removedIds.length > 0) {
		const { error: deleteError } = await supabase
			.from("obra_tabla_columns")
			.delete()
			.in("id", removedIds);
		if (deleteError) throw deleteError;
	}
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
			await syncDefaultTablaColumns(
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
			await syncObraTablaColumns(
				supabase,
				tabla.id as string,
				columns,
				hasNestedData,
			);
		}
	}
}
