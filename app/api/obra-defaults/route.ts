import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { normalizeFolderName, normalizeFieldKey, ensureTablaDataType } from "@/lib/tablas";
import { ACTIVE_TENANT_COOKIE } from "@/lib/tenant-selection";

type DataInputMethod = 'ocr' | 'manual' | 'both';

type DefaultFolder = {
	id: string;
	name: string;
	path: string;
	position: number;
	// Data folder fields
	isOcr?: boolean;
	dataInputMethod?: DataInputMethod;
	ocrTemplateId?: string | null;
	ocrTemplateName?: string | null;
	hasNestedData?: boolean;
	columns?: Array<{
		fieldKey: string;
		label: string;
		dataType: string;
		ocrScope?: string;
	}>;
};

type QuickAction = {
	id: string;
	name: string;
	description: string | null;
	folderPaths: string[];
	position: number;
};

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

export async function GET() {
	const { supabase, user, tenantId } = await getAuthContext();

	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	if (!tenantId) {
		return NextResponse.json({ folders: [], quickActions: [] });
	}

	try {
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
		const templateIds = (tablas ?? [])
			.filter(t => t.ocr_template_id)
			.map(t => t.ocr_template_id);

		let templatesMap = new Map<string, string>();
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
		let columnsMap = new Map<string, Array<{
			fieldKey: string;
			label: string;
			dataType: string;
			ocrScope?: string;
		}>>();

		if (tablaIds.length > 0) {
			const { data: columns } = await supabase
				.from("obra_default_tabla_columns")
				.select("default_tabla_id, field_key, label, data_type, config")
				.in("default_tabla_id", tablaIds);

			if (columns) {
				columns.forEach(col => {
					const existing = columnsMap.get(col.default_tabla_id) ?? [];
					existing.push({
						fieldKey: col.field_key,
						label: col.label,
						dataType: col.data_type,
						ocrScope: (col.config as any)?.ocrScope,
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

			return {
				...folder,
				isOcr: true,
				dataInputMethod,
				ocrTemplateId: linkedTabla.ocr_template_id,
				ocrTemplateName: linkedTabla.ocr_template_id
					? templatesMap.get(linkedTabla.ocr_template_id)
					: null,
				hasNestedData: Boolean(settings.hasNestedData),
				columns: columnsMap.get(linkedTabla.id) ?? [],
			};
		});

		const { data: quickActions, error: quickActionsError } = await supabase
			.from("obra_default_quick_actions")
			.select("id, name, description, folder_paths, position")
			.eq("tenant_id", tenantId)
			.order("position", { ascending: true });

		if (quickActionsError) {
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

			const path = normalizeFolderName(rawName);
			if (!path) {
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
				return NextResponse.json({ folder });
			}

			// OCR folder - create linked tabla
			const ocrTemplateId = typeof body.ocrTemplateId === "string" && body.ocrTemplateId.trim()
				? body.ocrTemplateId.trim()
				: null;
			const hasNestedData = body.hasNestedData === true;
			const rawColumns: Array<{
				label: string;
				fieldKey?: string;
				dataType?: string;
				required?: boolean;
				ocrScope?: string;
				position?: number;
			}> = Array.isArray(body.columns) ? body.columns : [];

			// Parse dataInputMethod
			const rawDataInputMethod = typeof body.dataInputMethod === "string" ? body.dataInputMethod : "both";
			const dataInputMethod = ["ocr", "manual", "both"].includes(rawDataInputMethod) ? rawDataInputMethod : "both";

			// Build settings
			const settings: Record<string, unknown> = {
				ocrFolder: path,
				hasNestedData,
				dataInputMethod,
			};
			if (ocrTemplateId) {
				settings.ocrTemplateId = ocrTemplateId;
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
					ocr_template_id: ocrTemplateId,
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
				fieldKey: string;
				label: string;
				dataType: string;
				ocrScope?: string;
			}> = [];

			console.log("[obra-defaults:post] Creating columns for default tabla:", {
				tablaId: tabla.id,
				rawColumnsCount: rawColumns.length,
				rawColumns: rawColumns.map(c => ({ label: c.label, fieldKey: c.fieldKey })),
			});

			if (rawColumns.length > 0) {
				const columnsPayload = rawColumns.map((col, index) => ({
					default_tabla_id: tabla.id,
					field_key: normalizeFieldKey(col.fieldKey || col.label),
					label: col.label,
					data_type: ensureTablaDataType(col.dataType),
					position: col.position ?? index,
					required: Boolean(col.required),
					config: hasNestedData && col.ocrScope ? { ocrScope: col.ocrScope } : {},
				}));

				const { data: columns, error: columnsError } = await supabase
					.from("obra_default_tabla_columns")
					.insert(columnsPayload)
					.select("field_key, label, data_type, config");

				if (columnsError) {
					console.error("[obra-defaults:post] columns error:", columnsError);
				} else if (columns) {
					console.log("[obra-defaults:post] Successfully created", columns.length, "columns for default tabla", tabla.id);
					insertedColumns = columns.map(col => ({
						fieldKey: col.field_key,
						label: col.label,
						dataType: col.data_type,
						ocrScope: (col.config as any)?.ocrScope,
					}));
				}
			} else {
				console.warn("[obra-defaults:post] No columns provided for OCR folder - this will cause issues!");
			}

			// Get template name if applicable
			let ocrTemplateName: string | null = null;
			if (ocrTemplateId) {
				const { data: template } = await supabase
					.from("ocr_templates")
					.select("name")
					.eq("id", ocrTemplateId)
					.single();
				ocrTemplateName = template?.name ?? null;
			}

			const enrichedFolder: DefaultFolder = {
				...folder,
				isOcr: true,
				ocrTemplateId,
				ocrTemplateName,
				hasNestedData,
				columns: insertedColumns,
			};

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

			const { data: existingActions } = await supabase
				.from("obra_default_quick_actions")
				.select("position")
				.eq("tenant_id", tenantId)
				.order("position", { ascending: false })
				.limit(1);

			const nextPosition = (existingActions?.[0]?.position ?? -1) + 1;

			const { data: quickAction, error: quickActionError } = await supabase
				.from("obra_default_quick_actions")
				.insert({
					tenant_id: tenantId,
					name: rawName,
					description,
					folder_paths: folderPaths,
					position: nextPosition,
				})
				.select("id, name, description, folder_paths, position")
				.single();

			if (quickActionError) throw quickActionError;

			return NextResponse.json({
				quickAction: {
					id: quickAction.id,
					name: quickAction.name,
					description: quickAction.description,
					folderPaths: quickAction.folder_paths ?? [],
					position: quickAction.position ?? 0,
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

			if (folder) {
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
		} else if (type === "quick-action") {
			const { error } = await supabase
				.from("obra_default_quick_actions")
				.delete()
				.eq("id", id)
				.eq("tenant_id", tenantId);

			if (error) throw error;
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
