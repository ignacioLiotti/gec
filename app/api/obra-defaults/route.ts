import { createClient } from "@/utils/supabase/server";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";
import { applyDefaultFolderToExistingObras } from "@/lib/obra-defaults/apply-default-folder";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { normalizeFolderName, normalizeFolderPath, normalizeFieldKey, ensureTablaDataType } from "@/lib/tablas";
import { ACTIVE_TENANT_COOKIE } from "@/lib/tenant-selection";

type DataInputMethod = 'ocr' | 'manual' | 'both';
type ExtractionRowMode = "single" | "multiple";

type DefaultFolder = {
	id: string;
	name: string;
	path: string;
	position: number;
	// Data folder fields
	isOcr?: boolean;
	dataInputMethod?: DataInputMethod;
	spreadsheetTemplate?: "auto" | "certificado" | null;
	ocrTemplateId?: string | null;
	ocrTemplateName?: string | null;
	manualEntryEnabled?: boolean;
	hasNestedData?: boolean;
	documentTypes?: string[];
	extractionInstructions?: string | null;
	extractionRowMode?: ExtractionRowMode;
	extractionMaxRows?: number | null;
	columns?: Array<{
		id?: string;
		fieldKey: string;
		label: string;
		dataType: string;
		required?: boolean;
		ocrScope?: string;
		description?: string | null;
		aliases?: string[];
		examples?: string[];
		excelKeywords?: string[];
	}>;
	extractedTables?: ExtractedTableConfig[];
};

type ExtractedTableConfig = {
	id: string;
	name: string;
	rowMode: ExtractionRowMode;
	maxRows: number | null;
	dataInputMethod: DataInputMethod;
	spreadsheetTemplate?: "auto" | "certificado" | null;
	ocrTemplateId?: string | null;
	ocrTemplateName?: string | null;
	manualEntryEnabled?: boolean;
	hasNestedData?: boolean;
	documentTypes?: string[];
	extractionInstructions?: string | null;
	columns?: DefaultFolder["columns"];
};

type QuickAction = {
	id: string;
	name: string;
	description: string | null;
	folderPaths: string[];
	position: number;
	obraId?: string | null;
};

type DefaultColumnInput = {
	id?: string;
	label?: string;
	fieldKey?: string;
	dataType?: string;
	required?: boolean;
	ocrScope?: string;
	description?: string | null;
	aliases?: string[];
	examples?: string[];
	excelKeywords?: string[];
	position?: number;
};

type PersistedDefaultColumn = {
	id: string;
	field_key: string;
	label: string;
	data_type: ReturnType<typeof ensureTablaDataType>;
	required: boolean;
	position: number;
	config: Record<string, unknown>;
};

type OcrTemplateColumn = {
	label?: string;
	fieldKey?: string;
	dataType?: string;
	ocrScope?: string;
	description?: string;
	aliases?: string[];
	examples?: string[];
	excelKeywords?: string[];
};

type QuickActionRow = {
	id: string;
	name: string;
	description: string | null;
	folder_paths: string[] | null;
	position: number | null;
	obra_id?: string | null;
};

type QuickActionInsertPayload = {
	tenant_id: string;
	name: string;
	description: string | null;
	folder_paths: string[];
	position: number;
	obra_id?: string | null;
};

function normalizeRowMode(value: unknown): ExtractionRowMode {
	return value === "multiple" ? "multiple" : "single";
}

function normalizePositiveInt(value: unknown): number | null {
	const parsed = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
	return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
}

function normalizeStringArray(value: unknown): string[] {
	return Array.isArray(value)
		? value
				.filter((item): item is string => typeof item === "string")
				.map((item) => item.trim())
				.filter(Boolean)
		: [];
}

function normalizeDataInputMethod(value: unknown): DataInputMethod {
	return value === "ocr" || value === "manual" || value === "both" ? value : "both";
}

function normalizeSpreadsheetTemplate(value: unknown): "auto" | "certificado" | null {
	if (typeof value !== "string") return null;
	return value.trim() === "certificado" ? "certificado" : value.trim() ? "auto" : null;
}

function buildLegacyExtractedTable(params: {
	id: string;
	name: string;
	settings: Record<string, unknown>;
	ocrTemplateId: string | null;
	ocrTemplateName: string | null;
	columns: NonNullable<DefaultFolder["columns"]>;
}): ExtractedTableConfig {
	const { id, name, settings, ocrTemplateId, ocrTemplateName, columns } = params;
	return {
		id,
		name,
		rowMode: normalizeRowMode(settings.extractionRowMode),
		maxRows:
			normalizeRowMode(settings.extractionRowMode) === "multiple"
				? normalizePositiveInt(settings.extractionMaxRows)
				: 1,
		dataInputMethod: normalizeDataInputMethod(settings.dataInputMethod),
		spreadsheetTemplate: normalizeSpreadsheetTemplate(settings.spreadsheetTemplate),
		ocrTemplateId,
		ocrTemplateName,
		manualEntryEnabled:
			typeof settings.manualEntryEnabled === "boolean"
				? settings.manualEntryEnabled
				: normalizeDataInputMethod(settings.dataInputMethod) !== "ocr",
		hasNestedData: Boolean(settings.hasNestedData),
		documentTypes: normalizeStringArray(settings.extractionDocumentTypes),
		extractionInstructions:
			typeof settings.extractionInstructions === "string"
				? settings.extractionInstructions
				: null,
		columns,
	};
}

function normalizeExtractedTables(
	value: unknown,
	fallback: ExtractedTableConfig,
): ExtractedTableConfig[] {
	if (!Array.isArray(value) || value.length === 0) {
		return [fallback];
	}

	const normalized = value
		.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
		.map((item, index) => {
			const name =
				typeof item.name === "string" && item.name.trim().length > 0
					? item.name.trim()
					: index === 0
						? fallback.name
						: `Tabla ${index + 1}`;
			const rowMode = normalizeRowMode(item.rowMode);
			const maxRows = rowMode === "multiple" ? normalizePositiveInt(item.maxRows) : 1;
			const columns = (Array.isArray(item.columns)
				? (item.columns as DefaultColumnInput[])
				: index === 0
					? (fallback.columns ?? [])
					: []
			).map((column, columnIndex) => ({
				id: typeof column.id === "string" ? column.id : undefined,
				fieldKey:
					typeof column.fieldKey === "string" && column.fieldKey.trim().length > 0
						? normalizeFieldKey(column.fieldKey)
						: normalizeFieldKey(column.label ?? `campo_${columnIndex + 1}`),
				label:
					typeof column.label === "string" && column.label.trim().length > 0
						? column.label.trim()
						: `Columna ${columnIndex + 1}`,
				dataType: ensureTablaDataType(column.dataType),
				required: Boolean(column.required),
				ocrScope: typeof column.ocrScope === "string" ? column.ocrScope : undefined,
				description:
					typeof column.description === "string" ? column.description : null,
				aliases: normalizeStringArray(column.aliases),
				examples: normalizeStringArray(column.examples),
				excelKeywords: normalizeStringArray(column.excelKeywords),
			}));
			return {
				id:
					typeof item.id === "string" && item.id.trim().length > 0
						? item.id.trim()
						: `${fallback.id}-${index + 1}`,
				name,
				rowMode,
				maxRows,
				dataInputMethod: normalizeDataInputMethod(item.dataInputMethod),
				spreadsheetTemplate: normalizeSpreadsheetTemplate(item.spreadsheetTemplate),
				ocrTemplateId:
					typeof item.ocrTemplateId === "string" && item.ocrTemplateId.trim().length > 0
						? item.ocrTemplateId.trim()
						: null,
				ocrTemplateName:
					typeof item.ocrTemplateName === "string" && item.ocrTemplateName.trim().length > 0
						? item.ocrTemplateName.trim()
						: null,
				manualEntryEnabled:
					typeof item.manualEntryEnabled === "boolean"
						? item.manualEntryEnabled
						: normalizeDataInputMethod(item.dataInputMethod) !== "ocr",
				hasNestedData: Boolean(item.hasNestedData),
				documentTypes: normalizeStringArray(item.documentTypes),
				extractionInstructions:
					typeof item.extractionInstructions === "string" &&
					item.extractionInstructions.trim().length > 0
						? item.extractionInstructions.trim()
						: null,
				columns,
			};
		});

	return normalized.length > 0 ? normalized : [fallback];
}

function isMissingQuickActionsTableError(error: unknown): boolean {
	if (!error || typeof error !== "object") return false;
	const maybe = error as { code?: string; message?: string };
	if (maybe.code !== "PGRST205") return false;
	return (maybe.message ?? "").includes("obra_default_quick_actions");
}

function isMissingQuickActionObraScopeColumn(error: unknown): boolean {
	if (!error || typeof error !== "object") return false;
	const maybe = error as { code?: string; message?: string };
	return maybe.code === "42703" || (maybe.message ?? "").includes("obra_id");
}

function normalizeDefaultColumnInput(
	column: DefaultColumnInput,
	index: number,
	hasNestedData: boolean
) {
	const label =
		typeof column.label === "string" && column.label.trim()
			? column.label.trim()
			: `Columna ${index + 1}`;
	const fieldKey = normalizeFieldKey(
		typeof column.fieldKey === "string" && column.fieldKey.trim()
			? column.fieldKey
			: label
	);
	const config: Record<string, unknown> = {};
	const aliases = Array.isArray(column.aliases)
		? column.aliases
				.filter((value): value is string => typeof value === "string")
				.map((value) => value.trim())
				.filter(Boolean)
		: [];
	const examples = Array.isArray(column.examples)
		? column.examples
				.filter((value): value is string => typeof value === "string")
				.map((value) => value.trim())
				.filter(Boolean)
		: [];
	const excelKeywords = Array.isArray(column.excelKeywords)
		? column.excelKeywords
				.filter((value): value is string => typeof value === "string")
				.map((value) => value.trim())
				.filter(Boolean)
		: [];
	if (hasNestedData && typeof column.ocrScope === "string" && column.ocrScope) {
		config.ocrScope = column.ocrScope;
	}
	if (typeof column.description === "string" && column.description.trim()) {
		config.ocrDescription = column.description.trim();
	}
	if (aliases.length > 0) {
		config.aliases = aliases;
	}
	if (examples.length > 0) {
		config.examples = examples;
	}
	if (excelKeywords.length > 0) {
		config.excelKeywords = excelKeywords;
	}
	return {
		id: typeof column.id === "string" && column.id ? column.id : undefined,
		label,
		field_key: fieldKey,
		data_type: ensureTablaDataType(column.dataType),
		required: Boolean(column.required),
		position: typeof column.position === "number" ? column.position : index,
		config,
	};
}

function toResponseDefaultColumn(column: PersistedDefaultColumn) {
	return {
		id: column.id,
		fieldKey: column.field_key,
		label: column.label,
		dataType: column.data_type,
		required: Boolean(column.required),
		ocrScope: (column.config as Record<string, unknown> | null)?.ocrScope as
			| string
			| undefined,
		aliases: Array.isArray((column.config as Record<string, unknown> | null)?.aliases)
			? (((column.config as Record<string, unknown>).aliases as unknown[]).filter(
					(value): value is string => typeof value === "string" && value.trim().length > 0
				))
			: [],
		examples: Array.isArray((column.config as Record<string, unknown> | null)?.examples)
			? (((column.config as Record<string, unknown>).examples as unknown[]).filter(
					(value): value is string => typeof value === "string" && value.trim().length > 0
				))
			: [],
		excelKeywords: Array.isArray((column.config as Record<string, unknown> | null)?.excelKeywords)
			? (((column.config as Record<string, unknown>).excelKeywords as unknown[]).filter(
					(value): value is string => typeof value === "string" && value.trim().length > 0
				))
			: [],
		description:
			((column.config as Record<string, unknown> | null)?.ocrDescription as
				| string
				| null
				| undefined) ?? null,
	};
}

async function syncDefaultTablaColumns(
	supabase: Awaited<ReturnType<typeof createClient>>,
	defaultTablaId: string,
	rawColumns: DefaultColumnInput[],
	hasNestedData: boolean
) {
	const draftColumns = rawColumns.map((column, index) =>
		normalizeDefaultColumnInput(column, index, hasNestedData)
	);
	const uniqueFieldKeys = new Set(draftColumns.map((col) => col.field_key));
	if (uniqueFieldKeys.size !== draftColumns.length) {
		throw new Error("Las columnas deben tener fieldKey único");
	}

	const { data: existingColumnsData, error: existingColumnsError } = await supabase
		.from("obra_default_tabla_columns")
		.select("id, field_key, label, data_type, required, position, config")
		.eq("default_tabla_id", defaultTablaId)
		.order("position", { ascending: true });
	if (existingColumnsError) throw existingColumnsError;

	const existingColumns = (existingColumnsData ?? []) as PersistedDefaultColumn[];
	const existingById = new Map(existingColumns.map((column) => [column.id, column]));
	const existingByFieldKey = new Map(
		existingColumns.map((column) => [column.field_key, column])
	);

	const normalizedColumns = draftColumns.map((column) => {
		if (column.id && existingById.has(column.id)) {
			return column;
		}
		const matchByFieldKey = existingByFieldKey.get(column.field_key);
		if (matchByFieldKey) {
			return {
				...column,
				id: matchByFieldKey.id,
			};
		}
		return {
			...column,
			id: undefined,
		};
	});

	const incomingIds = new Set(
		normalizedColumns
			.map((column) => column.id)
			.filter((id): id is string => typeof id === "string")
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

	let insertedColumns: PersistedDefaultColumn[] = [];
	const newColumns = normalizedColumns.filter((item) => !item.id);
	if (newColumns.length > 0) {
		const { data: inserted, error: insertError } = await supabase
			.from("obra_default_tabla_columns")
			.insert(
				newColumns.map((column) => ({
					default_tabla_id: defaultTablaId,
					field_key: column.field_key,
					label: column.label,
					data_type: column.data_type,
					required: column.required,
					position: column.position,
					config: column.config,
				}))
			)
			.select("id, field_key, label, data_type, required, position, config");
		if (insertError) throw insertError;
		insertedColumns = (inserted ?? []) as PersistedDefaultColumn[];
	}

	if (removedIds.length > 0) {
		const { error: deleteError } = await supabase
			.from("obra_default_tabla_columns")
			.delete()
			.in("id", removedIds);
		if (deleteError) throw deleteError;
	}

	const insertedByPosition = new Map(
		insertedColumns.map((column) => [column.position, column])
	);
	return normalizedColumns.map((column) => {
		if (column.id) {
			return toResponseDefaultColumn({
				id: column.id,
				field_key: column.field_key,
				label: column.label,
				data_type: column.data_type,
				required: column.required,
				position: column.position,
				config: column.config,
			});
		}
		const inserted = insertedByPosition.get(column.position);
		if (!inserted) {
			throw new Error("No se pudo persistir una columna nueva");
		}
		return toResponseDefaultColumn(inserted);
	});
}

async function getAuthContext() {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return { supabase, user: null, tenantId: null };
	}

	// Check for preferred tenant from cookie (same logic as obras API)
	const cookieStore = await cookies();
	const preferredTenantId = cookieStore.get(ACTIVE_TENANT_COOKIE)?.value;

	let membership = null;

	if (preferredTenantId) {
		const preferredResult = await supabase
			.from("memberships")
			.select("tenant_id")
			.eq("user_id", user.id)
			.eq("tenant_id", preferredTenantId)
			.limit(1)
			.maybeSingle();

		membership = preferredResult.data ?? null;
	}

	// Fallback to oldest membership if no preferred tenant
	if (!membership) {
		const fallbackResult = await supabase
			.from("memberships")
			.select("tenant_id")
			.eq("user_id", user.id)
			.order("created_at", { ascending: true })
			.limit(1)
			.maybeSingle();

		membership = fallbackResult.data ?? null;
	}

	return { supabase, user, tenantId: membership?.tenant_id ?? null };
}

async function enqueueAndApplyDefaultFolderSync(params: {
	supabase: Awaited<ReturnType<typeof createClient>>;
	tenantId: string;
	folderId: string;
	forceSync?: boolean;
	previousPath?: string | null;
	logContext: string;
}) {
	const { supabase, tenantId, folderId, forceSync, previousPath, logContext } = params;
	const payload: {
		folderId: string;
		forceSync?: boolean;
		previousPath?: string;
	} = { folderId };

	if (forceSync === true) {
		payload.forceSync = true;
	}

	if (typeof previousPath === "string" && previousPath.trim().length > 0) {
		payload.previousPath = previousPath.trim();
	}

	const { error: jobError } = await supabase.from("background_jobs").insert({
		tenant_id: tenantId,
		type: "apply_default_folder",
		payload,
	});

	if (jobError) {
		console.error(`[${logContext}] job enqueue error:`, jobError);
	}

	try {
		const admin = createSupabaseAdminClient();
		const result = await applyDefaultFolderToExistingObras(admin, {
			tenantId,
			folderId,
			forceSync,
			previousPath: payload.previousPath,
		});

		if (!result.ok) {
			console.warn(`[${logContext}] immediate folder sync skipped:`, result);
		}
	} catch (error) {
		console.error(`[${logContext}] immediate folder sync error:`, error);
	}
}

export async function GET(request: Request) {
	const { supabase, user, tenantId } = await getAuthContext();

	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	if (!tenantId) {
		return NextResponse.json({ folders: [], quickActions: [] });
	}

	try {
		const { searchParams } = new URL(request.url);
		const obraIdParam = searchParams.get("obraId");
		const obraId =
			typeof obraIdParam === "string" && obraIdParam.trim()
				? obraIdParam.trim()
				: null;

		// Fetch folders
		const { data: folders, error: foldersError } = await supabase
			.from("obra_default_folders")
			.select("id, name, path, position")
			.eq("tenant_id", tenantId)
			.order("position", { ascending: true });

		if (foldersError) {
			console.error("[obra-defaults:get] folders error:", foldersError);
			throw foldersError;
		}

		// Fetch tablas to find OCR tablas linked to folders
		const { data: tablas, error: tablasError } = await supabase
			.from("obra_default_tablas")
			.select("id, name, source_type, linked_folder_path, settings, ocr_template_id")
			.eq("tenant_id", tenantId)
			.eq("source_type", "ocr");

		if (tablasError) {
			console.error("[obra-defaults:get] tablas error:", tablasError);
		}

		// Fetch OCR templates for names
		const templateIds = (tablas ?? []).flatMap((tabla) => {
			const settings = (tabla.settings as Record<string, unknown>) ?? {};
			const nestedIds = Array.isArray(settings.extractedTables)
				? (settings.extractedTables as Array<Record<string, unknown>>)
						.map((item) =>
							typeof item?.ocrTemplateId === "string" ? item.ocrTemplateId : null
						)
						.filter((value): value is string => typeof value === "string" && value.length > 0)
				: [];
			return [
				typeof tabla.ocr_template_id === "string" ? tabla.ocr_template_id : null,
				...nestedIds,
			].filter((value): value is string => typeof value === "string" && value.length > 0);
		});

		const templatesMap = new Map<string, string>();
		if (templateIds.length > 0) {
			const { data: templates } = await supabase
				.from("ocr_templates")
				.select("id, name")
				.in("id", templateIds);

			if (templates) {
				templates.forEach(t => templatesMap.set(t.id, t.name));
			}
		}

			// Fetch columns for OCR tablas
			const tablaIds = (tablas ?? []).map(t => t.id);
			const columnsMap = new Map<string, Array<{
				id?: string;
				fieldKey: string;
				label: string;
				dataType: string;
				required?: boolean;
				ocrScope?: string;
				description?: string | null;
				aliases?: string[];
				examples?: string[];
				excelKeywords?: string[];
			}>>();

		if (tablaIds.length > 0) {
			const { data: columns } = await supabase
				.from("obra_default_tabla_columns")
				.select("id, default_tabla_id, field_key, label, data_type, required, config")
				.in("default_tabla_id", tablaIds)
				.order("position", { ascending: true });

			if (columns) {
				columns.forEach(col => {
					const config = (col.config ?? {}) as Record<string, unknown>;
					const existing = columnsMap.get(col.default_tabla_id) ?? [];
					existing.push({
						id: col.id,
						fieldKey: col.field_key,
						label: col.label,
						dataType: col.data_type,
						required: Boolean(col.required),
						ocrScope:
							typeof config.ocrScope === "string" ? config.ocrScope : undefined,
						description:
							typeof config.ocrDescription === "string"
								? config.ocrDescription
								: null,
						aliases: Array.isArray(config.aliases)
							? (config.aliases as unknown[]).filter(
									(value): value is string =>
										typeof value === "string" && value.trim().length > 0
								)
							: [],
						examples: Array.isArray(config.examples)
							? (config.examples as unknown[]).filter(
									(value): value is string =>
										typeof value === "string" && value.trim().length > 0
								)
							: [],
						excelKeywords: Array.isArray(config.excelKeywords)
							? (config.excelKeywords as unknown[]).filter(
									(value): value is string =>
										typeof value === "string" && value.trim().length > 0
								)
							: [],
					});
					columnsMap.set(col.default_tabla_id, existing);
				});
			}
		}

		// Create a map of folder path -> linked tabla
		type TablaType = NonNullable<typeof tablas>[number];
		const tablaByFolderPath = new Map<string, TablaType>();
		(tablas ?? []).forEach(tabla => {
			if (tabla.linked_folder_path) {
				tablaByFolderPath.set(tabla.linked_folder_path, tabla);
			}
		});

		// Enrich folders with data folder info
		const enrichedFolders: DefaultFolder[] = (folders ?? []).map(folder => {
			const linkedTabla = tablaByFolderPath.get(folder.path);
			if (!linkedTabla) {
				return folder;
			}

			const settings = (linkedTabla.settings as Record<string, unknown>) ?? {};
			const rawDataInputMethod = settings.dataInputMethod;
			const dataInputMethod: DataInputMethod =
				rawDataInputMethod === 'ocr' || rawDataInputMethod === 'manual' || rawDataInputMethod === 'both'
					? rawDataInputMethod
					: 'both';
			const columns = columnsMap.get(linkedTabla.id) ?? [];
			const legacyTable = buildLegacyExtractedTable({
				id: linkedTabla.id,
				name:
					typeof linkedTabla.name === "string" && linkedTabla.name.trim().length > 0
						? linkedTabla.name
						: folder.name,
				settings,
				ocrTemplateId: linkedTabla.ocr_template_id ?? null,
				ocrTemplateName: linkedTabla.ocr_template_id
					? templatesMap.get(linkedTabla.ocr_template_id) ?? null
					: null,
				columns,
			});
			const extractedTables = normalizeExtractedTables(
				settings.extractedTables,
				legacyTable,
			).map((table) => ({
				...table,
				ocrTemplateName:
					table.ocrTemplateId && templatesMap.has(table.ocrTemplateId)
						? templatesMap.get(table.ocrTemplateId) ?? null
						: table.ocrTemplateName ?? null,
			}));

			return {
				...folder,
				isOcr: true,
				dataInputMethod,
				spreadsheetTemplate:
					typeof settings.spreadsheetTemplate === "string"
						? ((settings.spreadsheetTemplate === "certificado" ? "certificado" : "auto") as
								| "auto"
								| "certificado")
						: null,
				ocrTemplateId: linkedTabla.ocr_template_id,
				ocrTemplateName: linkedTabla.ocr_template_id
					? templatesMap.get(linkedTabla.ocr_template_id)
						: null,
				manualEntryEnabled:
					typeof settings.manualEntryEnabled === "boolean"
						? settings.manualEntryEnabled
						: dataInputMethod !== "ocr",
				hasNestedData: Boolean(settings.hasNestedData),
				documentTypes: Array.isArray(settings.extractionDocumentTypes)
					? (settings.extractionDocumentTypes as unknown[]).filter(
							(value): value is string =>
								typeof value === "string" && value.trim().length > 0
					  )
					: [],
				extractionInstructions:
					typeof settings.extractionInstructions === "string"
						? settings.extractionInstructions
						: null,
				extractionRowMode: normalizeRowMode(settings.extractionRowMode),
				extractionMaxRows:
					normalizeRowMode(settings.extractionRowMode) === "multiple"
						? normalizePositiveInt(settings.extractionMaxRows)
						: 1,
				columns,
				extractedTables,
			};
		});

			const quickActionsQuery = supabase
				.from("obra_default_quick_actions")
				.select("id, name, description, folder_paths, position, obra_id")
				.eq("tenant_id", tenantId)
				.order("position", { ascending: true });
			if (obraId) {
				quickActionsQuery.or(`obra_id.is.null,obra_id.eq.${obraId}`);
			} else {
				quickActionsQuery.is("obra_id", null);
			}
			const quickActionsResult = await quickActionsQuery;
			let quickActions = (quickActionsResult.data ?? null) as QuickActionRow[] | null;
			let quickActionsError = quickActionsResult.error;
			if (quickActionsError && isMissingQuickActionObraScopeColumn(quickActionsError)) {
				// Backward compatibility: environments without migration 0081 still have global quick actions.
				const fallback = await supabase
					.from("obra_default_quick_actions")
					.select("id, name, description, folder_paths, position")
					.eq("tenant_id", tenantId)
					.order("position", { ascending: true });
				quickActions = (fallback.data ?? null) as QuickActionRow[] | null;
				quickActionsError = fallback.error;
			}

			if (quickActionsError) {
				if (isMissingQuickActionsTableError(quickActionsError)) {
					console.warn(
						"[obra-defaults:get] quick actions table missing (migration not applied), returning empty list"
					);
					return NextResponse.json({
						folders: enrichedFolders,
						quickActions: [],
					});
				}
				console.error("[obra-defaults:get] quick actions error:", quickActionsError);
				throw quickActionsError;
			}

		return NextResponse.json({
			folders: enrichedFolders,
				quickActions: (quickActions ?? []).map((action): QuickAction => ({
				id: action.id,
				name: action.name,
				description: action.description,
				folderPaths: action.folder_paths ?? [],
				position: action.position ?? 0,
				obraId: action.obra_id ?? null,
			})),
		});
	} catch (error) {
		console.error("[obra-defaults:get]", error);
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Error loading defaults" },
			{ status: 500 }
		);
	}
}

export async function POST(request: Request) {
	const { supabase, user, tenantId } = await getAuthContext();

	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	if (!tenantId) {
		return NextResponse.json(
			{ error: "No tenant found for user" },
			{ status: 400 }
		);
	}

	try {
		const body = await request.json().catch(() => ({}));
		const type = body.type as "folder" | "quick-action";

		if (type === "folder") {
			const rawName = typeof body.name === "string" ? body.name.trim() : "";
			if (!rawName) {
				return NextResponse.json({ error: "Folder name required" }, { status: 400 });
			}
			const rawParentPath =
				typeof body.parentPath === "string" ? body.parentPath.trim() : "";
			const parentPath = normalizeFolderPath(rawParentPath);

			const normalizedName = normalizeFolderName(rawName);
			const path = parentPath ? `${parentPath}/${normalizedName}` : normalizedName;
			if (!normalizedName || !path) {
				return NextResponse.json({ error: "Invalid folder name" }, { status: 400 });
			}

			// Get max position for folders
			const { data: existingFolders } = await supabase
				.from("obra_default_folders")
				.select("position")
				.eq("tenant_id", tenantId)
				.order("position", { ascending: false })
				.limit(1);

			const nextFolderPosition = (existingFolders?.[0]?.position ?? -1) + 1;

			// Create the folder
			const { data: folder, error: folderError } = await supabase
				.from("obra_default_folders")
				.insert({
					tenant_id: tenantId,
					name: rawName,
					path,
					position: nextFolderPosition,
				})
				.select("id, name, path, position")
				.single();

			if (folderError) throw folderError;

			// Check if this is an OCR folder
			const isOcr = body.isOcr === true;

			if (!isOcr) {
				await enqueueAndApplyDefaultFolderSync({
					supabase,
					tenantId,
					folderId: folder.id,
					logContext: "obra-defaults:post",
				});
				return NextResponse.json({ folder });
			}

			// OCR folder - create linked tabla
			const ocrTemplateId = typeof body.ocrTemplateId === "string" && body.ocrTemplateId.trim()
				? body.ocrTemplateId.trim()
				: null;
			const hasNestedData = body.hasNestedData === true;
			const rawColumns: Array<{
				id?: string;
				label: string;
				fieldKey?: string;
				dataType?: string;
				required?: boolean;
				ocrScope?: string;
				description?: string | null;
				aliases?: string[];
				examples?: string[];
				excelKeywords?: string[];
				position?: number;
			}> = Array.isArray(body.columns) ? body.columns : [];

			let resolvedColumns = rawColumns;
			if (resolvedColumns.length === 0 && ocrTemplateId) {
				const { data: template, error: templateError } = await supabase
					.from("ocr_templates")
					.select("columns")
					.eq("id", ocrTemplateId)
					.maybeSingle();

				if (templateError) {
					console.error("[obra-defaults:post] template columns error:", templateError);
				} else {
					const templateColumnsValue = (template as { columns?: unknown } | null)?.columns;
					const templateColumns = Array.isArray(templateColumnsValue)
						? (templateColumnsValue as OcrTemplateColumn[])
						: [];
					if (templateColumns.length > 0) {
						resolvedColumns = templateColumns.map((col, index) => ({
							label: col.label ?? `Columna ${index + 1}`,
							fieldKey: col.fieldKey,
							dataType: col.dataType ?? "text",
							required: false,
							ocrScope: col.ocrScope,
							description: col.description ?? null,
							aliases: col.aliases ?? [],
							examples: col.examples ?? [],
							excelKeywords: col.excelKeywords ?? [],
							position: index,
						}));
					}
				}
			}

			const legacyFallback = buildLegacyExtractedTable({
				id: path,
				name: rawName,
				settings: {
					dataInputMethod: body.dataInputMethod,
					spreadsheetTemplate: body.spreadsheetTemplate,
					manualEntryEnabled: body.manualEntryEnabled,
					hasNestedData,
					extractionDocumentTypes: body.documentTypes,
					extractionInstructions: body.extractionInstructions,
					extractionRowMode: body.extractionRowMode,
					extractionMaxRows: body.extractionMaxRows,
				},
				ocrTemplateId,
				ocrTemplateName: null,
				columns: resolvedColumns.map((column) => ({
					id: column.id,
					fieldKey:
						typeof column.fieldKey === "string" ? column.fieldKey : normalizeFieldKey(column.label ?? "campo"),
					label: column.label ?? "Campo",
					dataType: column.dataType ?? "text",
					required: Boolean(column.required),
					ocrScope: column.ocrScope,
					description: column.description ?? null,
					aliases: column.aliases ?? [],
					examples: column.examples ?? [],
					excelKeywords: column.excelKeywords ?? [],
				})),
			});
			const extractedTables = normalizeExtractedTables(body.extractedTables, legacyFallback);
			const primaryTable = extractedTables[0];
			const primaryOcrTemplateId = primaryTable.ocrTemplateId ?? ocrTemplateId;
			const dataInputMethod = primaryTable.dataInputMethod;
			const spreadsheetTemplate = primaryTable.spreadsheetTemplate ?? "auto";
			const documentTypes = primaryTable.documentTypes ?? [];
			const extractionInstructions = primaryTable.extractionInstructions ?? null;
			const extractionRowMode = primaryTable.rowMode;
			const extractionMaxRows = primaryTable.maxRows;
			resolvedColumns = (primaryTable.columns ?? []).map((column) => ({
				id: column.id,
				label: column.label ?? "Campo",
				fieldKey: column.fieldKey,
				dataType: column.dataType,
				required: Boolean(column.required),
				ocrScope: column.ocrScope,
				description: column.description ?? null,
				aliases: column.aliases ?? [],
				examples: column.examples ?? [],
				excelKeywords: column.excelKeywords ?? [],
			}));

			// Build settings
			const effectiveHasNestedData = Boolean(primaryTable.hasNestedData);
			const settings: Record<string, unknown> = {
				ocrFolder: path,
				hasNestedData: effectiveHasNestedData,
				dataInputMethod,
				spreadsheetTemplate,
				manualEntryEnabled:
					typeof primaryTable.manualEntryEnabled === "boolean"
						? primaryTable.manualEntryEnabled
						: dataInputMethod !== "ocr",
				extractionRowMode,
				extractionMaxRows,
				extractedTables,
			};
			if (primaryOcrTemplateId) {
				settings.ocrTemplateId = primaryOcrTemplateId;
			}
			if (documentTypes.length > 0) {
				settings.extractionDocumentTypes = documentTypes;
			}
			if (extractionInstructions) {
				settings.extractionInstructions = extractionInstructions;
			}

			// Get max position for tablas
			const { data: existingTablas } = await supabase
				.from("obra_default_tablas")
				.select("position")
				.eq("tenant_id", tenantId)
				.order("position", { ascending: false })
				.limit(1);

			const nextTablaPosition = (existingTablas?.[0]?.position ?? -1) + 1;

			// Create the tabla
			const { data: tabla, error: tablaError } = await supabase
				.from("obra_default_tablas")
				.insert({
					tenant_id: tenantId,
					name: rawName,
					description: null,
					source_type: "ocr",
					linked_folder_path: path,
					settings,
					position: nextTablaPosition,
					ocr_template_id: primaryOcrTemplateId,
				})
				.select("id, name, ocr_template_id")
				.single();

			if (tablaError) {
				// Rollback folder creation
				await supabase.from("obra_default_folders").delete().eq("id", folder.id);
				throw tablaError;
			}

			// Create columns
			let insertedColumns: Array<{
				id?: string;
				fieldKey: string;
				label: string;
				dataType: string;
				required?: boolean;
				ocrScope?: string;
				description?: string | null;
				aliases?: string[];
				examples?: string[];
				excelKeywords?: string[];
			}> = [];

			console.log("[obra-defaults:post] Creating columns for default tabla:", {
				tablaId: tabla.id,
				rawColumnsCount: rawColumns.length,
				rawColumns: rawColumns.map(c => ({ label: c.label, fieldKey: c.fieldKey })),
			});

			if (resolvedColumns.length > 0) {
				insertedColumns = await syncDefaultTablaColumns(
					supabase,
					tabla.id,
					resolvedColumns,
					effectiveHasNestedData
				);
			} else {
				console.warn("[obra-defaults:post] No columns provided for OCR folder - this will cause issues!");
			}

			// Get template name if applicable
			let ocrTemplateName: string | null = null;
			if (primaryOcrTemplateId) {
				const { data: template } = await supabase
					.from("ocr_templates")
					.select("name")
					.eq("id", primaryOcrTemplateId)
					.single();
				ocrTemplateName = template?.name ?? null;
			}

				const enrichedFolder: DefaultFolder = {
					...folder,
					isOcr: true,
					dataInputMethod,
					spreadsheetTemplate,
					ocrTemplateId: primaryOcrTemplateId,
					ocrTemplateName,
					hasNestedData: effectiveHasNestedData,
					documentTypes,
					extractionInstructions,
					extractionRowMode,
					extractionMaxRows,
					columns: insertedColumns,
					extractedTables,
				};

			await enqueueAndApplyDefaultFolderSync({
				supabase,
				tenantId,
				folderId: folder.id,
				logContext: "obra-defaults:post",
			});

			return NextResponse.json({ folder: enrichedFolder });
		}

		if (type === "quick-action") {
			const rawName = typeof body.name === "string" ? body.name.trim() : "";
			if (!rawName) {
				return NextResponse.json({ error: "Action name required" }, { status: 400 });
			}

			const folderPaths = Array.isArray(body.folderPaths)
				? body.folderPaths.filter((path: unknown) => typeof path === "string" && path.trim())
				: [];

			if (folderPaths.length === 0) {
				return NextResponse.json({ error: "At least one folder required" }, { status: 400 });
			}

			const description = typeof body.description === "string" ? body.description.trim() : null;
			const obraId =
				typeof body.obraId === "string" && body.obraId.trim()
					? body.obraId.trim()
					: null;

			if (obraId) {
				const { data: obra, error: obraError } = await supabase
					.from("obras")
					.select("id")
					.eq("tenant_id", tenantId)
					.eq("id", obraId)
					.is("deleted_at", null)
					.maybeSingle();
				if (obraError) throw obraError;
				if (!obra) {
					return NextResponse.json(
						{ error: "La obra indicada no existe o no pertenece al tenant activo." },
						{ status: 400 }
					);
				}
			}

				const supportsObraScopeProbe = await supabase
					.from("obra_default_quick_actions")
					.select("obra_id")
					.eq("tenant_id", tenantId)
					.limit(1);
				const supportsObraScope = !(
					supportsObraScopeProbe.error &&
					isMissingQuickActionObraScopeColumn(supportsObraScopeProbe.error)
				);

				if (obraId && !supportsObraScope) {
					return NextResponse.json(
						{
							error:
								"Quick actions por obra no disponibles aún: falta aplicar la migración 0081_obra_quick_actions_scope.sql",
						},
						{ status: 503 }
					);
				}

				const existingActionsQuery = supabase
					.from("obra_default_quick_actions")
					.select("position")
					.eq("tenant_id", tenantId)
					.order("position", { ascending: false })
					.limit(1);
				if (obraId) {
					existingActionsQuery.eq("obra_id", obraId);
				} else {
					if (supportsObraScope) {
						existingActionsQuery.is("obra_id", null);
					}
				}
				const { data: existingActions, error: existingActionsError } =
					await existingActionsQuery;
				if (existingActionsError) {
					if (isMissingQuickActionsTableError(existingActionsError)) {
						return NextResponse.json(
							{ error: "Quick actions unavailable: missing database migration 0070_obra_quick_actions.sql" },
							{ status: 503 }
						);
					}
					throw existingActionsError;
				}

			const nextPosition = (existingActions?.[0]?.position ?? -1) + 1;

				const quickActionInsertPayload: QuickActionInsertPayload = {
					tenant_id: tenantId,
					name: rawName,
					description,
					folder_paths: folderPaths,
					position: nextPosition,
				};
				if (supportsObraScope) {
					quickActionInsertPayload.obra_id = obraId;
				}

				const { data: quickAction, error: quickActionError } = await supabase
					.from("obra_default_quick_actions")
					.insert(quickActionInsertPayload)
					.select("id, name, description, folder_paths, position, obra_id")
					.single();

				if (quickActionError) {
					if (isMissingQuickActionsTableError(quickActionError)) {
						return NextResponse.json(
							{ error: "Quick actions unavailable: missing database migration 0070_obra_quick_actions.sql" },
							{ status: 503 }
						);
					}
					throw quickActionError;
				}

			return NextResponse.json({
				quickAction: {
					id: quickAction.id,
					name: quickAction.name,
					description: quickAction.description,
					folderPaths: quickAction.folder_paths ?? [],
					position: quickAction.position ?? 0,
					obraId: quickAction.obra_id ?? null,
				} as QuickAction,
			});
		}

		return NextResponse.json({ error: "Invalid type" }, { status: 400 });
	} catch (error) {
		console.error("[obra-defaults:post]", error);
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Error creating default" },
			{ status: 500 }
		);
	}
}

export async function PUT(request: Request) {
	const { supabase, user, tenantId } = await getAuthContext();

	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	if (!tenantId) {
		return NextResponse.json(
			{ error: "No tenant found for user" },
			{ status: 400 }
		);
	}

	try {
		const body = await request.json().catch(() => ({}));
		const type = body.type as "folder" | "quick-action";
		if (type !== "folder") {
			return NextResponse.json({ error: "Invalid type" }, { status: 400 });
		}

		const id = typeof body.id === "string" ? body.id : "";
		if (!id) {
			return NextResponse.json({ error: "Folder ID required" }, { status: 400 });
		}

		const rawName = typeof body.name === "string" ? body.name.trim() : "";
		if (!rawName) {
			return NextResponse.json({ error: "Folder name required" }, { status: 400 });
		}
		const rawParentPath =
			typeof body.parentPath === "string" ? body.parentPath.trim() : "";
		const parentPath = normalizeFolderPath(rawParentPath);

		const normalizedName = normalizeFolderName(rawName);
		const path = parentPath ? `${parentPath}/${normalizedName}` : normalizedName;
		if (!normalizedName || !path) {
			return NextResponse.json({ error: "Invalid folder name" }, { status: 400 });
		}

		const { data: existingFolder, error: existingFolderError } = await supabase
			.from("obra_default_folders")
			.select("id, path, position")
			.eq("id", id)
			.eq("tenant_id", tenantId)
			.maybeSingle();

		if (existingFolderError) {
			throw existingFolderError;
		}

		if (!existingFolder) {
			return NextResponse.json({ error: "Folder not found" }, { status: 404 });
		}

		const { data: updatedFolder, error: updateFolderError } = await supabase
			.from("obra_default_folders")
			.update({
				name: rawName,
				path,
			})
			.eq("id", id)
			.eq("tenant_id", tenantId)
			.select("id, name, path, position")
			.single();

		if (updateFolderError) throw updateFolderError;

		const isOcr = body.isOcr === true;

		if (!isOcr) {
			const linkedPaths = Array.from(new Set([existingFolder.path, path].filter(Boolean)));
			if (linkedPaths.length > 0) {
				await supabase
					.from("obra_default_tablas")
					.delete()
					.eq("tenant_id", tenantId)
					.in("linked_folder_path", linkedPaths);
			}

			await enqueueAndApplyDefaultFolderSync({
				supabase,
				tenantId,
				folderId: updatedFolder.id,
				forceSync: true,
				previousPath: existingFolder.path,
				logContext: "obra-defaults:put",
			});

			return NextResponse.json({ folder: updatedFolder });
		}

		const ocrTemplateId = typeof body.ocrTemplateId === "string" && body.ocrTemplateId.trim()
			? body.ocrTemplateId.trim()
			: null;
		const hasNestedData = body.hasNestedData === true;
		const rawColumns: DefaultColumnInput[] = Array.isArray(body.columns)
			? body.columns
			: [];

		let resolvedColumns = rawColumns;
		if (resolvedColumns.length === 0 && ocrTemplateId) {
			const { data: template, error: templateError } = await supabase
				.from("ocr_templates")
				.select("columns")
				.eq("id", ocrTemplateId)
				.maybeSingle();

			if (templateError) {
				console.error("[obra-defaults:put] template columns error:", templateError);
			} else {
				const templateColumnsValue = (template as { columns?: unknown } | null)?.columns;
				const templateColumns = Array.isArray(templateColumnsValue)
					? (templateColumnsValue as OcrTemplateColumn[])
					: [];

				if (templateColumns.length > 0) {
					resolvedColumns = templateColumns.map((col, index) => ({
						label: col.label ?? `Columna ${index + 1}`,
						fieldKey: col.fieldKey,
						dataType: col.dataType ?? "text",
						required: false,
						ocrScope: col.ocrScope,
						description: col.description ?? null,
						aliases: col.aliases ?? [],
						examples: col.examples ?? [],
						excelKeywords: col.excelKeywords ?? [],
						position: index,
					}));
				}
			}
		}

			const legacyFallback = buildLegacyExtractedTable({
				id: path,
				name: rawName,
				settings: {
					dataInputMethod: body.dataInputMethod,
					spreadsheetTemplate: body.spreadsheetTemplate,
					manualEntryEnabled: body.manualEntryEnabled,
					hasNestedData,
					extractionDocumentTypes: body.documentTypes,
				extractionInstructions: body.extractionInstructions,
				extractionRowMode: body.extractionRowMode,
				extractionMaxRows: body.extractionMaxRows,
			},
			ocrTemplateId,
			ocrTemplateName: null,
			columns: resolvedColumns.map((column) => ({
				id: column.id,
				fieldKey:
					typeof column.fieldKey === "string" ? column.fieldKey : normalizeFieldKey(column.label ?? "campo"),
				label: column.label ?? "Campo",
				dataType: column.dataType ?? "text",
				required: Boolean(column.required),
				ocrScope: column.ocrScope,
				description: column.description ?? null,
				aliases: column.aliases ?? [],
				examples: column.examples ?? [],
				excelKeywords: column.excelKeywords ?? [],
			})),
		});
		const extractedTables = normalizeExtractedTables(body.extractedTables, legacyFallback);
		const primaryTable = extractedTables[0];
		const primaryOcrTemplateId = primaryTable.ocrTemplateId ?? ocrTemplateId;
		const dataInputMethod = primaryTable.dataInputMethod;
		const spreadsheetTemplate = primaryTable.spreadsheetTemplate ?? "auto";
		const documentTypes = primaryTable.documentTypes ?? [];
		const extractionInstructions = primaryTable.extractionInstructions ?? null;
		const extractionRowMode = primaryTable.rowMode;
		const extractionMaxRows = primaryTable.maxRows;
		resolvedColumns = (primaryTable.columns ?? []).map((column) => ({
			id: column.id,
			label: column.label ?? "Campo",
			fieldKey: column.fieldKey,
			dataType: column.dataType,
			required: Boolean(column.required),
			ocrScope: column.ocrScope,
			description: column.description ?? null,
			aliases: column.aliases ?? [],
			examples: column.examples ?? [],
			excelKeywords: column.excelKeywords ?? [],
		}));

		const effectiveHasNestedData = Boolean(primaryTable.hasNestedData);
		const settings: Record<string, unknown> = {
			ocrFolder: path,
			hasNestedData: effectiveHasNestedData,
			dataInputMethod,
			spreadsheetTemplate,
			manualEntryEnabled:
				typeof primaryTable.manualEntryEnabled === "boolean"
					? primaryTable.manualEntryEnabled
					: dataInputMethod !== "ocr",
			extractionRowMode,
			extractionMaxRows,
			extractedTables,
		};
		if (primaryOcrTemplateId) {
			settings.ocrTemplateId = primaryOcrTemplateId;
		}
		if (documentTypes.length > 0) {
			settings.extractionDocumentTypes = documentTypes;
		}
		if (extractionInstructions) {
			settings.extractionInstructions = extractionInstructions;
		}

		const linkedPaths = Array.from(new Set([existingFolder.path, path].filter(Boolean)));
		const { data: existingTabla, error: existingTablaError } = await supabase
			.from("obra_default_tablas")
			.select("id, position")
			.eq("tenant_id", tenantId)
			.eq("source_type", "ocr")
			.in("linked_folder_path", linkedPaths)
			.order("position", { ascending: true })
			.limit(1)
			.maybeSingle();

		if (existingTablaError) throw existingTablaError;

		let tablaId = existingTabla?.id ?? null;
		if (tablaId) {
			const { error: updateTablaError } = await supabase
				.from("obra_default_tablas")
				.update({
					name: rawName,
					description: null,
					source_type: "ocr",
					linked_folder_path: path,
					settings,
					ocr_template_id: primaryOcrTemplateId,
				})
				.eq("id", tablaId)
				.eq("tenant_id", tenantId);

			if (updateTablaError) throw updateTablaError;

		} else {
			const { data: existingTablas } = await supabase
				.from("obra_default_tablas")
				.select("position")
				.eq("tenant_id", tenantId)
				.order("position", { ascending: false })
				.limit(1);
			const nextTablaPosition = (existingTablas?.[0]?.position ?? -1) + 1;

			const { data: tabla, error: tablaError } = await supabase
				.from("obra_default_tablas")
				.insert({
					tenant_id: tenantId,
					name: rawName,
					description: null,
					source_type: "ocr",
					linked_folder_path: path,
					settings,
					position: nextTablaPosition,
					ocr_template_id: primaryOcrTemplateId,
				})
				.select("id")
				.single();

			if (tablaError || !tabla) throw tablaError ?? new Error("Failed to create default tabla");
			tablaId = tabla.id;
		}

		let insertedColumns: Array<{
			id?: string;
			fieldKey: string;
			label: string;
			dataType: string;
			required?: boolean;
			ocrScope?: string;
			description?: string | null;
			aliases?: string[];
			examples?: string[];
			excelKeywords?: string[];
		}> = [];

		if (tablaId && resolvedColumns.length > 0) {
			insertedColumns = await syncDefaultTablaColumns(
				supabase,
				tablaId,
				resolvedColumns,
				effectiveHasNestedData
			);
		}

		let ocrTemplateName: string | null = null;
		if (primaryOcrTemplateId) {
			const { data: template } = await supabase
				.from("ocr_templates")
				.select("name")
				.eq("id", primaryOcrTemplateId)
				.maybeSingle();
			ocrTemplateName = template?.name ?? null;
		}

		const enrichedFolder: DefaultFolder = {
			...updatedFolder,
			isOcr: true,
			dataInputMethod,
			spreadsheetTemplate,
			ocrTemplateId: primaryOcrTemplateId,
			ocrTemplateName,
			hasNestedData: effectiveHasNestedData,
			documentTypes,
			extractionInstructions,
			extractionRowMode,
			extractionMaxRows,
			columns: insertedColumns,
			extractedTables,
		};

		await enqueueAndApplyDefaultFolderSync({
			supabase,
			tenantId,
			folderId: updatedFolder.id,
			forceSync: true,
			previousPath: existingFolder.path,
			logContext: "obra-defaults:put",
		});

		return NextResponse.json({ folder: enrichedFolder });
	} catch (error) {
		console.error("[obra-defaults:put]", error);
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Error updating default" },
			{ status: 500 }
		);
	}
}

export async function DELETE(request: Request) {
	const { supabase, user, tenantId } = await getAuthContext();

	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	if (!tenantId) {
		return NextResponse.json({ error: "No tenant found" }, { status: 400 });
	}

	try {
		const body = await request.json().catch(() => ({}));
		const type = body.type as "folder" | "quick-action";
		const id = typeof body.id === "string" ? body.id : null;

		if (!id) {
			return NextResponse.json({ error: "ID required" }, { status: 400 });
		}

			if (type === "folder") {
				// First get the folder to find its path
				const { data: folder } = await supabase
					.from("obra_default_folders")
					.select("path")
				.eq("id", id)
				.eq("tenant_id", tenantId)
				.single();

				let linkedDefaultTablaIds: string[] = [];
				if (folder) {
					const { data: linkedTablas } = await supabase
						.from("obra_default_tablas")
						.select("id")
						.eq("tenant_id", tenantId)
						.eq("linked_folder_path", folder.path);
					linkedDefaultTablaIds = (linkedTablas ?? [])
						.map((row) => (row as { id?: string }).id)
						.filter((rowId): rowId is string => typeof rowId === "string" && rowId.length > 0);

					// Delete any linked tabla (cascade will delete columns)
					await supabase
						.from("obra_default_tablas")
						.delete()
						.eq("tenant_id", tenantId)
						.eq("linked_folder_path", folder.path);
				}

			// Delete the folder
			const { error } = await supabase
				.from("obra_default_folders")
				.delete()
				.eq("id", id)
				.eq("tenant_id", tenantId);

				if (error) throw error;

				if (folder?.path) {
					const { error: jobError } = await supabase.from("background_jobs").insert({
						tenant_id: tenantId,
						type: "remove_default_folder",
						payload: {
							folderPath: folder.path,
							defaultTablaIds: linkedDefaultTablaIds,
						},
					});
					if (jobError) {
						console.error("[obra-defaults:delete] job enqueue error:", jobError);
					}
				}
				} else if (type === "quick-action") {
				const { error } = await supabase
					.from("obra_default_quick_actions")
					.delete()
					.eq("id", id)
					.eq("tenant_id", tenantId);

				if (error) {
					if (isMissingQuickActionsTableError(error)) {
						return NextResponse.json(
							{ error: "Quick actions unavailable: missing database migration 0070_obra_quick_actions.sql" },
							{ status: 503 }
						);
					}
					throw error;
				}
			} else {
			return NextResponse.json({ error: "Invalid type" }, { status: 400 });
		}

		return NextResponse.json({ ok: true });
	} catch (error) {
		console.error("[obra-defaults:delete]", error);
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Error deleting default" },
			{ status: 500 }
		);
	}
}
