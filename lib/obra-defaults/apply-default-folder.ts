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
	defaultTablaId?: string;
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

type SpreadsheetPreset = {
	key: string;
	name: string;
	description: string;
	columns: Array<{
		field_key: string;
		label: string;
		data_type: "text" | "number" | "currency";
		position: number;
		required: boolean;
		config?: Record<string, unknown>;
	}>;
};

const CERTIFICADO_SPREADSHEET_PRESETS: SpreadsheetPreset[] = [
	{
		key: "pmc_resumen",
		name: "PMC Resumen",
		description:
			"Resumen mensual del certificado: período, monto, avance acumulado.",
		columns: [
			{
				field_key: "periodo",
				label: "Período",
				data_type: "text",
				position: 0,
				required: false,
				config: { excelKeywords: ["periodo", "mes", "month", "correspondiente"] },
			},
			{
				field_key: "nro_certificado",
				label: "N° Certificado",
				data_type: "text",
				position: 1,
				required: false,
				config: { excelKeywords: ["nro", "numero", "certificado", "cert", "n°"] },
			},
			{
				field_key: "fecha_certificacion",
				label: "Fecha Certificación",
				data_type: "text",
				position: 2,
				required: false,
				config: { excelKeywords: ["fecha", "certificacion", "date"] },
			},
			{
				field_key: "monto_certificado",
				label: "Monto Certificado",
				data_type: "currency",
				position: 3,
				required: false,
				config: { excelKeywords: ["monto", "importe", "certificado"] },
			},
			{
				field_key: "avance_fisico_acumulado_pct",
				label: "Avance Físico Acum. %",
				data_type: "number",
				position: 4,
				required: false,
				config: { excelKeywords: ["avance", "fisico", "acumulado", "%"] },
			},
			{
				field_key: "monto_acumulado",
				label: "Monto Acumulado",
				data_type: "currency",
				position: 5,
				required: false,
				config: { excelKeywords: ["monto", "acumulado", "total"] },
			},
		],
	},
	{
		key: "pmc_items",
		name: "PMC Items",
		description:
			"Desglose por rubro/item del certificado con avances e importes.",
		columns: [
			{
				field_key: "item_code",
				label: "Código Item",
				data_type: "text",
				position: 0,
				required: false,
				config: { excelKeywords: ["item", "codigo", "cod", "rubro"] },
			},
			{
				field_key: "descripcion",
				label: "Descripción",
				data_type: "text",
				position: 1,
				required: false,
				config: { excelKeywords: ["descripcion", "rubro", "concepto", "detalle"] },
			},
			{
				field_key: "incidencia_pct",
				label: "Incidencia %",
				data_type: "number",
				position: 2,
				required: false,
				config: { excelKeywords: ["incidencia", "%"] },
			},
			{
				field_key: "monto_rubro",
				label: "Monto Rubro",
				data_type: "currency",
				position: 3,
				required: false,
				config: { excelKeywords: ["total", "rubro", "monto"] },
			},
			{
				field_key: "avance_anterior_pct",
				label: "Avance Anterior %",
				data_type: "number",
				position: 4,
				required: false,
				config: { excelKeywords: ["anterior", "avance", "%"] },
			},
			{
				field_key: "avance_periodo_pct",
				label: "Avance Período %",
				data_type: "number",
				position: 5,
				required: false,
				config: { excelKeywords: ["presente", "periodo", "avance", "%"] },
			},
			{
				field_key: "avance_acumulado_pct",
				label: "Avance Acumulado %",
				data_type: "number",
				position: 6,
				required: false,
				config: { excelKeywords: ["acumulado", "avance", "%"] },
			},
			{
				field_key: "monto_anterior",
				label: "Monto Anterior $",
				data_type: "currency",
				position: 7,
				required: false,
				config: { excelKeywords: ["anterior", "cert", "importe"] },
			},
			{
				field_key: "monto_presente",
				label: "Monto Presente $",
				data_type: "currency",
				position: 8,
				required: false,
				config: { excelKeywords: ["presente", "cert", "importe"] },
			},
			{
				field_key: "monto_acumulado",
				label: "Monto Acumulado $",
				data_type: "currency",
				position: 9,
				required: false,
				config: { excelKeywords: ["total", "acumulado", "cert", "importe"] },
			},
		],
	},
	{
		key: "curva_plan",
		name: "Curva Plan",
		description:
			"Curva de inversiones con avance mensual y acumulado.",
		columns: [
			{
				field_key: "periodo",
				label: "Período",
				data_type: "text",
				position: 0,
				required: false,
				config: { excelKeywords: ["mes", "periodo", "month"] },
			},
			{
				field_key: "avance_mensual_pct",
				label: "Avance Mensual %",
				data_type: "number",
				position: 1,
				required: false,
				config: { excelKeywords: ["avance", "mensual", "%"] },
			},
			{
				field_key: "avance_acumulado_pct",
				label: "Avance Acumulado %",
				data_type: "number",
				position: 2,
				required: false,
				config: { excelKeywords: ["acumulado", "financiero", "%"] },
			},
		],
	},
];

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
			defaultTablaId: tabla.id as string,
			tablaName: tabla.name as string,
			tablaDescription: (tabla.description as string | null) ?? null,
			settings: {
				...settings,
				ocrFolder: folder.path,
				ocrTemplateId: tabla.ocr_template_id ?? (settings as any)?.ocrTemplateId,
				defaultTablaId: tabla.id as string,
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

		const spreadsheetTemplate =
			typeof bundle.settings.spreadsheetTemplate === "string"
				? bundle.settings.spreadsheetTemplate
				: "auto";
		const isCertificadoSpreadsheet = spreadsheetTemplate === "certificado";

		if (isCertificadoSpreadsheet) {
			for (const preset of CERTIFICADO_SPREADSHEET_PRESETS) {
				const presetName = `${bundle.name} · ${preset.name}`;
				const existingPresetTabla = (obraOcrTablas ?? []).find((tabla) => tabla.name === presetName);
				if (existingPresetTabla && !shouldForceSync) continue;

					const presetSettings: Record<string, unknown> = {
						...bundle.settings,
						ocrFolder: bundle.path,
						spreadsheetTemplate: "certificado",
						spreadsheetPresetKey: preset.key,
						defaultTablaId: bundle.defaultTablaId,
					};

				let presetTablaId = existingPresetTabla?.id ?? null;
				if (presetTablaId) {
					const { error: updatePresetTablaError } = await supabase
						.from("obra_tablas")
					.update({
						name: presetName,
						description: preset.description,
						source_type: "ocr",
						settings: presetSettings,
						})
						.eq("id", presetTablaId);
					if (updatePresetTablaError) {
						console.error(
							"[apply-default-folder] Error updating certificado preset tabla",
							updatePresetTablaError,
						);
						continue;
					}
					await supabase.from("obra_tabla_columns").delete().eq("tabla_id", presetTablaId);
				} else {
					const { data: createdPresetTabla, error: createPresetTablaError } = await supabase
						.from("obra_tablas")
					.insert({
						obra_id: obraId,
						name: presetName,
						description: preset.description,
						source_type: "ocr",
						settings: presetSettings,
						})
						.select("id")
						.single();
					if (createPresetTablaError || !createdPresetTabla) {
						console.error(
							"[apply-default-folder] Error creating certificado preset tabla",
							createPresetTablaError,
						);
						continue;
					}
					presetTablaId = createdPresetTabla.id;
				}

				const presetColumnsPayload = preset.columns.map((column) => ({
					tabla_id: presetTablaId,
					field_key: column.field_key,
					label: column.label,
					data_type: column.data_type,
					position: column.position,
					required: column.required,
					config: column.config ?? {},
				}));
				const { error: presetColumnsError } = await supabase
					.from("obra_tabla_columns")
					.insert(presetColumnsPayload);
				if (presetColumnsError) {
					console.error(
						"[apply-default-folder] Error creating certificado preset columns",
						presetColumnsError,
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
						settings: { ...bundle.settings, defaultTablaId: bundle.defaultTablaId },
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
						settings: { ...bundle.settings, defaultTablaId: bundle.defaultTablaId },
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
