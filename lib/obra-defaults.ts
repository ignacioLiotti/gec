type SupabaseClient = {
	from: (table: string) => any;
	storage: {
		from: (bucket: string) => any;
	};
};

type DefaultFolder = {
	id: string;
	name: string;
	path: string;
	position: number;
};

type DefaultTabla = {
	id: string;
	name: string;
	description?: string | null;
	source_type: string;
	linked_folder_path?: string | null;
	settings?: Record<string, unknown> | null;
	position?: number | null;
	ocr_template_id?: string | null;
};

type DefaultColumn = {
	default_tabla_id: string;
	field_key: string;
	label: string;
	data_type: string;
	position: number;
	required: boolean;
	config: Record<string, unknown> | null;
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

export type ApplyDefaultsResult = {
	success: boolean;
	foldersApplied: number;
	tablasApplied: number;
	error?: string;
};

/**
 * Apply default folders to a newly created obra.
 * This should be called after an obra is successfully created.
 */
export async function applyObraDefaults(
	supabase: SupabaseClient,
	obraId: string,
	tenantId: string
): Promise<ApplyDefaultsResult> {
	try {
		// Fetch default folders
		const { data: defaultFolders, error: foldersError } = await supabase
			.from("obra_default_folders")
			.select("id, name, path, position")
			.eq("tenant_id", tenantId)
			.order("position", { ascending: true });

		if (foldersError) throw foldersError;

		const folderPaths = (defaultFolders as DefaultFolder[] | null)?.map((folder) => folder.path) ?? [];
		console.info("[apply-obra-defaults] Found default folders:", {
			tenantId,
			obraId,
			count: defaultFolders?.length ?? 0,
			folders: folderPaths,
		});

		// Fetch default OCR tablas that should be created alongside folders
		const { data: defaultTablas, error: tablasError } = await supabase
			.from("obra_default_tablas")
			.select(
				"id, name, description, source_type, linked_folder_path, settings, position, ocr_template_id"
			)
			.eq("tenant_id", tenantId)
			.eq("source_type", "ocr")
			.order("position", { ascending: true });

		if (tablasError) {
			console.error("[apply-obra-defaults] Error fetching default tablas:", tablasError);
		}

		// Fetch columns for OCR tablas
		const defaultTablaIds = (defaultTablas ?? []).map((tabla: DefaultTabla) => tabla.id);
		const columnsByTabla = new Map<string, DefaultColumn[]>();

		if (defaultTablaIds.length > 0) {
			const { data: defaultColumns, error: columnsError } = await supabase
				.from("obra_default_tabla_columns")
				.select("default_tabla_id, field_key, label, data_type, position, required, config")
				.in("default_tabla_id", defaultTablaIds)
				.order("position", { ascending: true });

			if (columnsError) {
				console.error("[apply-obra-defaults] Error fetching default columns:", columnsError);
			} else {
				(defaultColumns as DefaultColumn[] | null)?.forEach((column) => {
					const existing = columnsByTabla.get(column.default_tabla_id) ?? [];
					existing.push(column);
					columnsByTabla.set(column.default_tabla_id, existing);
				});
			}
		}

		// Map folder path -> tabla config
		const tablaByFolderPath = new Map<string, DefaultTabla>();
		(defaultTablas ?? []).forEach((tabla: DefaultTabla) => {
			if (tabla.linked_folder_path) {
				tablaByFolderPath.set(tabla.linked_folder_path, tabla);
			}
		});

		let tablasCreated = 0;

		// Create folders in storage
		let foldersCreated = 0;
		for (const folder of (defaultFolders ?? []) as DefaultFolder[]) {
			const rawPath = typeof folder.path === "string" ? folder.path.trim() : "";
			if (!rawPath) continue;
			const keepPath = `${obraId}/${rawPath}/.keep`;
			try {
				const { error: uploadError } = await supabase.storage
					.from("obra-documents")
					.upload(keepPath, new Blob([""], { type: "text/plain" }), {
						upsert: true,
					});
				if (uploadError) {
					console.error("[apply-obra-defaults] Storage upload error for", keepPath, uploadError);
				} else {
					foldersCreated++;
					console.info("[apply-obra-defaults] Created folder placeholder:", keepPath);
				}
			} catch (storageError) {
				console.error(
					"[apply-obra-defaults] Error creating placeholder for folder",
					rawPath,
					storageError
				);
			}

			// If folder has a linked OCR tabla, clone it for the obra
			const defaultTabla = tablaByFolderPath.get(rawPath);
			if (!defaultTabla) continue;

			const defaultSettings = (defaultTabla.settings as Record<string, unknown>) ?? {};
			const spreadsheetTemplate =
				typeof defaultSettings.spreadsheetTemplate === "string"
					? defaultSettings.spreadsheetTemplate
					: "auto";
			const isCertificadoSpreadsheet = spreadsheetTemplate === "certificado";

			if (isCertificadoSpreadsheet) {
				for (const preset of CERTIFICADO_SPREADSHEET_PRESETS) {
					const presetName = `${folder.name} · ${preset.name}`;
					const { data: existingPresetTabla } = await supabase
						.from("obra_tablas")
						.select("id")
						.eq("obra_id", obraId)
						.eq("name", presetName)
						.maybeSingle();

					if (existingPresetTabla) continue;

					const presetSettings: Record<string, unknown> = {
						...defaultSettings,
						ocrFolder: rawPath,
						spreadsheetTemplate: "certificado",
						spreadsheetPresetKey: preset.key,
					};
					if (defaultTabla.ocr_template_id) {
						presetSettings.ocrTemplateId = defaultTabla.ocr_template_id;
					}

					const { data: createdPresetTabla, error: presetTablaError } = await supabase
						.from("obra_tablas")
						.insert({
							obra_id: obraId,
							name: presetName,
							description: preset.description,
							source_type: defaultTabla.source_type,
							settings: presetSettings,
						})
						.select("id")
						.single();

					if (presetTablaError || !createdPresetTabla) {
						console.error(
							"[apply-obra-defaults] Error creating certificado preset tabla:",
							presetTablaError,
						);
						continue;
					}

					tablasCreated++;
					const columnsPayload = preset.columns.map((column) => ({
						tabla_id: createdPresetTabla.id,
						field_key: column.field_key,
						label: column.label,
						data_type: column.data_type,
						position: column.position,
						required: column.required,
						config: column.config ?? {},
					}));
					const { error: presetColumnsError } = await supabase
						.from("obra_tabla_columns")
						.insert(columnsPayload);
					if (presetColumnsError) {
						console.error(
							"[apply-obra-defaults] Error creating certificado preset columns:",
							presetColumnsError,
						);
					}
				}
				continue;
			}

			// Skip if a tabla with same name already exists for obra
			const { data: existingTabla } = await supabase
				.from("obra_tablas")
				.select("id")
				.eq("obra_id", obraId)
				.eq("name", defaultTabla.name)
				.maybeSingle();

			if (existingTabla) {
				continue;
			}

			const settings: Record<string, unknown> = {
				...defaultSettings,
				ocrFolder: rawPath,
			};
			if (defaultTabla.ocr_template_id) {
				settings.ocrTemplateId = defaultTabla.ocr_template_id;
			}
			// Ensure dataInputMethod is passed through
			if (!settings.dataInputMethod) {
				settings.dataInputMethod = 'both';
			}

			const { data: createdTabla, error: tablaError } = await supabase
				.from("obra_tablas")
				.insert({
					obra_id: obraId,
					name: defaultTabla.name,
					description: defaultTabla.description,
					source_type: defaultTabla.source_type,
					settings,
				})
				.select("id")
				.single();

			if (tablaError || !createdTabla) {
				console.error("[apply-obra-defaults] Error creating obra tabla:", tablaError);
				continue;
			}

			tablasCreated++;

			const defaultColumns = columnsByTabla.get(defaultTabla.id) ?? [];
			if (defaultColumns.length > 0) {
				const columnsPayload = defaultColumns.map((column) => ({
					tabla_id: createdTabla.id,
					field_key: column.field_key,
					label: column.label,
					data_type: column.data_type,
					position: column.position,
					required: column.required,
					config: column.config ?? {},
				}));

				const { error: insertColumnsError } = await supabase
					.from("obra_tabla_columns")
					.insert(columnsPayload);

				if (insertColumnsError) {
					console.error(
						"[apply-obra-defaults] Error cloning default tabla columns:",
						insertColumnsError
					);
				}
			}
		}

		console.info("[apply-obra-defaults] Completed:", {
			obraId,
			foldersConfigured: (defaultFolders ?? []).length,
			foldersCreatedInStorage: foldersCreated,
			tablasCreated,
		});

		return {
			success: true,
			foldersApplied: foldersCreated,
			tablasApplied: tablasCreated,
		};
	} catch (error) {
		console.error("[apply-obra-defaults] Error:", error);
		return {
			success: false,
			foldersApplied: 0,
			tablasApplied: 0,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

/**
 * Get the list of default folder paths for a tenant.
 * Useful for showing which folders will be created.
 */
export async function getDefaultFolderPaths(
	supabase: SupabaseClient,
	tenantId: string
): Promise<string[]> {
	const { data, error } = await supabase
		.from("obra_default_folders")
		.select("path")
		.eq("tenant_id", tenantId)
		.order("position", { ascending: true });

	if (error) {
		console.error("[get-default-folder-paths] Error:", error);
		return [];
	}

	return (data ?? []).map((row: { path: string }) => row.path);
}
