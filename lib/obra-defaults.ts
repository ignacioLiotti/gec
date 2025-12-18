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
		for (const folder of (defaultFolders ?? []) as DefaultFolder[]) {
			const rawPath = typeof folder.path === "string" ? folder.path.trim() : "";
			if (!rawPath) continue;
			const keepPath = `${obraId}/${rawPath}/.keep`;
			try {
				await supabase.storage
					.from("obra-documents")
					.upload(keepPath, new Blob([""], { type: "text/plain" }), {
						upsert: true,
					});
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

			const defaultSettings = (defaultTabla.settings as Record<string, unknown>) ?? {};
			const settings: Record<string, unknown> = {
				...defaultSettings,
				ocrFolder: rawPath,
			};
			if (defaultTabla.ocr_template_id) {
				settings.ocrTemplateId = defaultTabla.ocr_template_id;
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

		return {
			success: true,
			foldersApplied: (defaultFolders ?? []).length,
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
