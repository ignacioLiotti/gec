import { normalizeFieldKey, ensureTablaDataType } from "@/lib/tablas";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ApplyDefaultFolderParams = {
	tenantId: string;
	folderId: string;
	forceSync?: boolean;
	previousPath?: string;
};

type DefaultFolderBundle = {
	folderId: string;
	name: string;
	path: string;
	isOcr: boolean;
	tablaName?: string;
	tablaDescription?: string | null;
	settings?: Record<string, unknown>;
	ocrTemplateId?: string | null;
	hasNestedData?: boolean;
	columns?: Array<{
		label: string;
		fieldKey?: string;
		dataType?: string;
		required?: boolean;
		ocrScope?: string;
		description?: string | null;
		position?: number;
	}>;
};

async function fetchDefaultFolderBundle(
	supabase: SupabaseClient,
	params: ApplyDefaultFolderParams,
): Promise<DefaultFolderBundle | null> {
	const { data: folder, error: folderError } = await supabase
		.from("obra_default_folders")
		.select("id, name, path")
		.eq("tenant_id", params.tenantId)
		.eq("id", params.folderId)
		.maybeSingle();

	if (folderError) throw folderError;
	if (!folder) return null;

	const { data: tabla, error: tablaError } = await supabase
		.from("obra_default_tablas")
		.select(
			"id, name, description, source_type, linked_folder_path, settings, ocr_template_id",
		)
		.eq("tenant_id", params.tenantId)
		.eq("linked_folder_path", folder.path)
		.eq("source_type", "ocr")
		.maybeSingle();

	if (tablaError) throw tablaError;

	if (!tabla) {
		return {
			folderId: folder.id as string,
			name: folder.name as string,
			path: folder.path as string,
			isOcr: false,
		};
	}

	const { data: columns, error: columnsError } = await supabase
		.from("obra_default_tabla_columns")
		.select("field_key, label, data_type, required, position, config")
		.eq("default_tabla_id", tabla.id)
		.order("position", { ascending: true });

	if (columnsError) throw columnsError;

	const mappedColumns = (columns ?? []).map((col) => ({
		label: col.label as string,
		fieldKey: col.field_key as string,
		dataType: col.data_type as string,
		required: Boolean(col.required),
		position: col.position ?? 0,
		ocrScope: (col.config as any)?.ocrScope,
		description: (col.config as any)?.ocrDescription ?? null,
	}));

	let resolvedColumns = mappedColumns;
	const templateId = (tabla.ocr_template_id as string | null) ?? null;
	if (resolvedColumns.length === 0 && templateId) {
		const { data: template, error: templateError } = await supabase
			.from("ocr_templates")
			.select("columns")
			.eq("id", templateId)
			.maybeSingle();

		if (templateError) throw templateError;

		const templateColumns = Array.isArray((template as any)?.columns)
			? ((template as any).columns as Array<{
					fieldKey?: string;
					label?: string;
					dataType?: string;
					ocrScope?: string;
					description?: string;
			  }>)
			: [];

		if (templateColumns.length > 0) {
			resolvedColumns = templateColumns.map((col, index) => ({
				label: col.label ?? `Columna ${index + 1}`,
				fieldKey: normalizeFieldKey(
					col.fieldKey ?? col.label ?? `columna_${index + 1}`,
				),
				dataType: col.dataType ?? "text",
				required: false,
				position: index,
				ocrScope: col.ocrScope,
				description: col.description ?? null,
			}));
		}
	}

	const settings = (tabla.settings as Record<string, unknown>) ?? {};
	const hasNestedData = Boolean(settings.hasNestedData);

	return {
		folderId: folder.id as string,
		name: folder.name as string,
		path: folder.path as string,
		isOcr: true,
		tablaName: tabla.name as string,
		tablaDescription: (tabla.description as string | null) ?? null,
		settings: {
			...settings,
			ocrFolder: folder.path,
			ocrTemplateId: tabla.ocr_template_id ?? (settings as any)?.ocrTemplateId,
		},
		ocrTemplateId: (tabla.ocr_template_id as string | null) ?? null,
		hasNestedData,
		columns: resolvedColumns,
	};
}

export async function applyDefaultFolderToExistingObras(
	supabase: SupabaseClient,
	params: ApplyDefaultFolderParams,
) {
	const bundle = await fetchDefaultFolderBundle(supabase, params);
	if (!bundle) return { ok: false, reason: "folder_not_found" } as const;

	const { data: obras, error: obrasError } = await supabase
		.from("obras")
		.select("id")
		.eq("tenant_id", params.tenantId);

	if (obrasError) throw obrasError;

	const shouldForceSync = params.forceSync === true;
	const previousPath =
		typeof params.previousPath === "string" && params.previousPath.trim()
			? params.previousPath.trim()
			: null;

	for (const obra of obras ?? []) {
		const obraId = obra.id as string;
		try {
			const keepPath = `${obraId}/${bundle.path}/.keep`;
			await supabase.storage
				.from("obra-documents")
				.upload(keepPath, new Blob([""], { type: "text/plain" }), {
					upsert: true,
				});
		} catch (error) {
			console.error(
				"[apply-default-folder] Error creating folder",
				bundle.path,
				obraId,
				error,
			);
		}

		const { data: obraOcrTablas, error: obraOcrTablasError } = await supabase
			.from("obra_tablas")
			.select("id, name, settings")
			.eq("obra_id", obraId)
			.eq("source_type", "ocr");

		if (obraOcrTablasError) {
			console.error(
				"[apply-default-folder] Error loading existing obra tablas",
				obraOcrTablasError,
			);
			continue;
		}

		const matchingTabla = (obraOcrTablas ?? []).find((tabla) => {
			const settings = (tabla.settings as Record<string, unknown>) ?? {};
			const tablaFolder = typeof settings.ocrFolder === "string" ? settings.ocrFolder : null;
			if (tablaFolder === bundle.path) return true;
			if (previousPath && tablaFolder === previousPath) return true;
			return bundle.tablaName ? tabla.name === bundle.tablaName : false;
		});

		if (!bundle.isOcr || !bundle.tablaName || !bundle.settings) {
			if (matchingTabla) {
				const { error: deleteTablaError } = await supabase
					.from("obra_tablas")
					.delete()
					.eq("id", matchingTabla.id);
				if (deleteTablaError) {
					console.error(
						"[apply-default-folder] Error deleting existing tabla on non-data folder",
						deleteTablaError,
					);
				}
			}
			continue;
		}

		let tablaId = matchingTabla?.id ?? null;
		if (tablaId && !shouldForceSync) {
			const { data: existingColumns, error: existingColumnsError } = await supabase
				.from("obra_tabla_columns")
				.select("id")
				.eq("tabla_id", tablaId)
				.limit(1);

			if (existingColumnsError) {
				console.error(
					"[apply-default-folder] Error checking existing columns",
					existingColumnsError,
				);
				continue;
			}

			if (existingColumns && existingColumns.length > 0) {
				continue;
			}
		}

		if (tablaId) {
			const { error: updateTablaError } = await supabase
				.from("obra_tablas")
				.update({
					name: bundle.tablaName,
					description: bundle.tablaDescription ?? null,
					source_type: "ocr",
					settings: bundle.settings,
				})
				.eq("id", tablaId);

			if (updateTablaError) {
				console.error(
					"[apply-default-folder] Error updating existing tabla",
					updateTablaError,
				);
				continue;
			}

			const { error: deleteColumnsError } = await supabase
				.from("obra_tabla_columns")
				.delete()
				.eq("tabla_id", tablaId);
			if (deleteColumnsError) {
				console.error(
					"[apply-default-folder] Error deleting previous columns",
					deleteColumnsError,
				);
				continue;
			}
		} else {
			const { data: tabla, error: tablaError } = await supabase
				.from("obra_tablas")
				.insert({
					obra_id: obraId,
					name: bundle.tablaName,
					description: bundle.tablaDescription ?? null,
					source_type: "ocr",
					settings: bundle.settings,
				})
				.select("id")
				.single();

			if (tablaError) {
				console.error(
					"[apply-default-folder] Error creating tabla",
					tablaError,
				);
				continue;
			}
			tablaId = tabla?.id ?? null;
		}

		if (!tablaId) continue;

		const rawColumns = bundle.columns ?? [];
		if (rawColumns.length === 0) continue;

		const columnsPayload = rawColumns.map((col, index) => {
			const config: Record<string, unknown> = {};
			if (bundle.hasNestedData && col.ocrScope) {
				config.ocrScope = col.ocrScope;
			}
			if (col.description) {
				config.ocrDescription = col.description;
			}
			return {
				tabla_id: tablaId,
				field_key: normalizeFieldKey(col.fieldKey || col.label),
				label: col.label,
				data_type: ensureTablaDataType(col.dataType),
				position: col.position ?? index,
				required: Boolean(col.required),
				config,
			};
		});

		const { error: columnsError } = await supabase
			.from("obra_tabla_columns")
			.insert(columnsPayload);

		if (columnsError) {
			console.error(
				"[apply-default-folder] Error creating columns",
				columnsError,
			);
		}
	}

	return { ok: true } as const;
}
