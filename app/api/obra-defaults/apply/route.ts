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
 * Apply default folders and tablas to a newly created obra
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

		// Fetch default tablas with columns
		const { data: defaultTablas, error: tablasError } = await supabase
			.from("obra_default_tablas")
			.select("id, name, description, source_type, linked_folder_path, settings, position, ocr_template_id")
			.eq("tenant_id", tenantId)
			.order("position", { ascending: true });

		if (tablasError) throw tablasError;

		const tablaIds = (defaultTablas ?? []).map((tabla) => tabla.id);
		let columnsData: any[] = [];

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
		const columnsByTabla = new Map<string, any[]>();
		for (const column of columnsData) {
			const tablaId = column.default_tabla_id;
			const existing = columnsByTabla.get(tablaId) ?? [];
			existing.push(column);
			columnsByTabla.set(tablaId, existing);
		}

		// Ensure folders exist in storage so linked OCR tablas resolve their paths
		const createdFolders = defaultFolders ?? [];
		const folderPaths = new Set<string>();
		for (const folder of createdFolders) {
			const folderPath =
				typeof folder?.path === "string" && folder.path.length > 0
					? folder.path
					: null;
			if (!folderPath) continue;
			folderPaths.add(folderPath);
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
		}

		// Create tablas
		const createdTablas: string[] = [];

		for (const defaultTabla of defaultTablas ?? []) {
			// Build settings, updating ocrFolder path if linked
			const settings: Record<string, unknown> = {
				...((defaultTabla.settings as Record<string, unknown>) ?? {}),
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
				console.error("[apply-defaults] Error creating tabla:", tablaError);
				continue;
			}

			createdTablas.push(tabla.id);

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
					console.error("[apply-defaults] Error creating columns:", insertColumnsError);
				}
			}
		}

		return NextResponse.json({
			ok: true,
			applied: {
				folders: createdFolders.length,
				tablas: createdTablas.length,
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

