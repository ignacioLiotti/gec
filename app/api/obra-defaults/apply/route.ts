import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

async function getAuthContext() {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return { supabase, user: null, tenantId: null };
	}

	const { data: membership } = await supabase
		.from("memberships")
		.select("tenant_id")
		.eq("user_id", user.id)
		.order("created_at", { ascending: true })
		.limit(1)
		.maybeSingle();

	return { supabase, user, tenantId: membership?.tenant_id ?? null };
}

/**
 * Apply default folders and OCR tablas to a newly created obra
 */
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
		const obraId = typeof body.obraId === "string" ? body.obraId : null;

		if (!obraId) {
			return NextResponse.json({ error: "obraId required" }, { status: 400 });
		}

		// Verify the obra belongs to this tenant
		const { data: obra, error: obraError } = await supabase
			.from("obras")
			.select("id, tenant_id")
			.eq("id", obraId)
			.eq("tenant_id", tenantId)
			.maybeSingle();

		if (obraError || !obra) {
			return NextResponse.json({ error: "Obra not found" }, { status: 404 });
		}

		// Fetch default folders
		const { data: defaultFolders, error: foldersError } = await supabase
			.from("obra_default_folders")
			.select("id, name, path, position")
			.eq("tenant_id", tenantId)
			.order("position", { ascending: true });

		if (foldersError) throw foldersError;

		// Fetch default OCR tablas with columns
		const { data: defaultTablas, error: tablasError } = await supabase
			.from("obra_default_tablas")
			.select("id, name, description, source_type, linked_folder_path, settings, position, ocr_template_id")
			.eq("tenant_id", tenantId)
			.eq("source_type", "ocr")
			.order("position", { ascending: true });

		if (tablasError) {
			console.error("[apply-defaults] Error fetching tablas:", tablasError);
		}

		// Fetch columns for OCR tablas
		const tablaIds = (defaultTablas ?? []).map(t => t.id);
		let columnsMap = new Map<string, Array<{
			field_key: string;
			label: string;
			data_type: string;
			required: boolean;
			config: Record<string, unknown>;
		}>>();

		console.log("[apply-defaults] Fetching columns for tablas:", tablaIds);

		if (tablaIds.length > 0) {
			const { data: columns, error: columnsError } = await supabase
				.from("obra_default_tabla_columns")
				.select("default_tabla_id, field_key, label, data_type, required, config")
				.in("default_tabla_id", tablaIds);

			console.log("[apply-defaults] Columns fetch result:", {
				count: columns?.length ?? 0,
				error: columnsError?.message,
			});

			if (columnsError) {
				console.error("[apply-defaults] Error fetching columns:", columnsError);
			} else if (columns) {
				columns.forEach((col, index) => {
					const existing = columnsMap.get(col.default_tabla_id) ?? [];
					existing.push({
						field_key: col.field_key,
						label: col.label,
						data_type: col.data_type,
						required: col.required,
						config: (col.config as Record<string, unknown>) ?? {},
					});
					columnsMap.set(col.default_tabla_id, existing);
				});
			}
		}

		// Create a map of folder path -> default tabla
		type DefaultTabla = NonNullable<typeof defaultTablas>[number];
		const tablaByFolderPath = new Map<string, DefaultTabla>();
		(defaultTablas ?? []).forEach(tabla => {
			if (tabla.linked_folder_path) {
				tablaByFolderPath.set(tabla.linked_folder_path, tabla);
			}
		});

		// Create folders in storage and track created tablas
		const createdFolders = defaultFolders ?? [];
		let tablasCreated = 0;

		for (const folder of createdFolders) {
			const folderPath =
				typeof folder?.path === "string" && folder.path.length > 0
					? folder.path
					: null;
			if (!folderPath) continue;

			// Create folder in storage
			try {
				const keepPath = `${obraId}/${folderPath}/.keep`;
				await supabase.storage
					.from("obra-documents")
					.upload(keepPath, new Blob([""], { type: "text/plain" }), {
						upsert: true,
					});
			} catch (storageError) {
				console.error(
					"[apply-defaults] Error creating placeholder for folder",
					folderPath,
					storageError
				);
			}

			// Check if this folder has a linked OCR tabla
			const defaultTabla = tablaByFolderPath.get(folderPath);
			if (!defaultTabla) continue;

			// Check if tabla with same name already exists for this obra
			const { data: existingTabla } = await supabase
				.from("obra_tablas")
				.select("id")
				.eq("obra_id", obraId)
				.eq("name", defaultTabla.name)
				.maybeSingle();

			if (existingTabla) {
				// Skip if already exists
				continue;
			}

			// Build settings for the new tabla
			const defaultSettings = (defaultTabla.settings as Record<string, unknown>) ?? {};
				const settings: Record<string, unknown> = {
					...defaultSettings,
					ocrFolder: folderPath,
					defaultTablaId: defaultTabla.id,
				};
			if (defaultTabla.ocr_template_id) {
				settings.ocrTemplateId = defaultTabla.ocr_template_id;
			}

			// Create the tabla
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
				console.error("[apply-defaults] Error creating tabla:", tablaError);
				continue;
			}

			tablasCreated++;

			// Create columns for the tabla
			const defaultColumns = columnsMap.get(defaultTabla.id) ?? [];
			console.log("[apply-defaults] Creating tabla columns:", {
				tablaId: tabla.id,
				defaultTablaId: defaultTabla.id,
				columnsFound: defaultColumns.length,
				columnsMapKeys: Array.from(columnsMap.keys()),
			});

			if (defaultColumns.length > 0) {
				const columnsPayload = defaultColumns.map((col, index) => ({
					tabla_id: tabla.id,
					field_key: col.field_key,
					label: col.label,
					data_type: col.data_type,
					position: index,
					required: col.required,
					config: col.config,
				}));

				const { error: insertColumnsError } = await supabase
					.from("obra_tabla_columns")
					.insert(columnsPayload);

				if (insertColumnsError) {
					console.error("[apply-defaults] Error creating columns:", insertColumnsError);
				} else {
					console.log("[apply-defaults] Successfully created", columnsPayload.length, "columns for tabla", tabla.id);
				}
			} else {
				console.warn("[apply-defaults] No columns found for default tabla", defaultTabla.id, "- OCR tabla will have no columns!");
			}
		}

		return NextResponse.json({
			ok: true,
			applied: {
				folders: createdFolders.length,
				tablas: tablasCreated,
			},
		});
	} catch (error) {
		console.error("[obra-defaults:apply]", error);
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Error applying defaults" },
			{ status: 500 }
		);
	}
}
