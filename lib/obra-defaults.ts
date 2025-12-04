import { normalizeFolderName } from "./tablas";

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

type DefaultTablaColumn = {
	field_key: string;
	label: string;
	data_type: string;
	position: number;
	required: boolean;
	config: Record<string, unknown>;
};

type DefaultTabla = {
	id: string;
	name: string;
	description: string | null;
	source_type: string;
	linked_folder_path: string | null;
	settings: Record<string, unknown>;
	position: number;
	ocr_template_id?: string | null;
};

export type ApplyDefaultsResult = {
	success: boolean;
	foldersApplied: number;
	tablasApplied: number;
	error?: string;
};

/**
 * Apply default folders and tablas to a newly created obra.
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

		// Fetch default tablas with columns
		const { data: defaultTablas, error: tablasError } = await supabase
			.from("obra_default_tablas")
			.select("id, name, description, source_type, linked_folder_path, settings, position, ocr_template_id")
			.eq("tenant_id", tenantId)
			.order("position", { ascending: true });

		if (tablasError) throw tablasError;

		const tablaIds = (defaultTablas ?? []).map((tabla: DefaultTabla) => tabla.id);
		let columnsData: (DefaultTablaColumn & { default_tabla_id: string })[] = [];

		if (tablaIds.length > 0) {
			const { data: columns, error: columnsError } = await supabase
				.from("obra_default_tabla_columns")
				.select("default_tabla_id, field_key, label, data_type, position, required, config")
				.in("default_tabla_id", tablaIds)
				.order("position", { ascending: true });

			if (columnsError) throw columnsError;
			columnsData = columns ?? [];
		}

		// Group columns by tabla
		const columnsByTabla = new Map<string, DefaultTablaColumn[]>();
		for (const column of columnsData) {
			const tablaId = column.default_tabla_id;
			const existing = columnsByTabla.get(tablaId) ?? [];
			existing.push({
				field_key: column.field_key,
				label: column.label,
				data_type: column.data_type,
				position: column.position,
				required: column.required,
				config: column.config,
			});
			columnsByTabla.set(tablaId, existing);
		}

		// Get set of folder paths for linking and ensure folders exist in storage
		const folderPaths = new Set<string>();
		for (const folder of defaultFolders ?? []) {
			const rawPath = typeof folder.path === "string" ? folder.path.trim() : "";
			if (!rawPath) continue;
			folderPaths.add(rawPath);
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
		}

		// Create tablas
		let tablasApplied = 0;

		for (const defaultTabla of (defaultTablas ?? []) as DefaultTabla[]) {
			// Build settings, updating ocrFolder path if linked
			const settings: Record<string, unknown> = {
				...(defaultTabla.settings ?? {}),
			};

			if (
				defaultTabla.source_type === "ocr" &&
				defaultTabla.linked_folder_path &&
				folderPaths.has(defaultTabla.linked_folder_path)
			) {
				settings.ocrFolder = defaultTabla.linked_folder_path;
			}
			if (
				defaultTabla.source_type === "ocr" &&
				defaultTabla.ocr_template_id &&
				!settings.ocrTemplateId
			) {
				settings.ocrTemplateId = defaultTabla.ocr_template_id;
			}

			// Check if tabla with same name already exists
			const { data: existing } = await supabase
				.from("obra_tablas")
				.select("id")
				.eq("obra_id", obraId)
				.eq("name", defaultTabla.name)
				.maybeSingle();

			if (existing) {
				// Skip if already exists
				continue;
			}

			// Insert the tabla
			const { data: tabla, error: tablaError } = await supabase
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

			if (tablaError) {
				console.error("[apply-obra-defaults] Error creating tabla:", tablaError);
				continue;
			}

			tablasApplied++;

			// Insert columns for this tabla
			const defaultColumns = columnsByTabla.get(defaultTabla.id) ?? [];
			if (defaultColumns.length > 0) {
				const columnsPayload = defaultColumns.map((col) => ({
					tabla_id: tabla.id,
					field_key: col.field_key,
					label: col.label,
					data_type: col.data_type,
					position: col.position,
					required: col.required,
					config: col.config,
				}));

				const { error: insertColumnsError } = await supabase
					.from("obra_tabla_columns")
					.insert(columnsPayload);

				if (insertColumnsError) {
					console.error("[apply-obra-defaults] Error creating columns:", insertColumnsError);
				}
			}
		}

		return {
			success: true,
			foldersApplied: (defaultFolders ?? []).length,
			tablasApplied,
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



