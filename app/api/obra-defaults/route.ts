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
		required?: boolean;
		ocrScope?: string;
		description?: string | null;
	}>;
};

type QuickAction = {
	id: string;
	name: string;
	description: string | null;
	folderPaths: string[];
	position: number;
	obraId?: string | null;
};

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
				required?: boolean;
				ocrScope?: string;
				description?: string | null;
			}>>();

		if (tablaIds.length > 0) {
			const { data: columns } = await supabase
				.from("obra_default_tabla_columns")
				.select("default_tabla_id, field_key, label, data_type, required, config")
				.in("default_tabla_id", tablaIds)
				.order("position", { ascending: true });

			if (columns) {
				columns.forEach(col => {
					const existing = columnsMap.get(col.default_tabla_id) ?? [];
					existing.push({
						fieldKey: col.field_key,
						label: col.label,
						dataType: col.data_type,
						required: Boolean(col.required),
						ocrScope: (col.config as any)?.ocrScope,
						description: (col.config as any)?.ocrDescription ?? null,
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
			let { data: quickActions, error: quickActionsError } =
				await quickActionsQuery;
			if (quickActionsError && isMissingQuickActionObraScopeColumn(quickActionsError)) {
				// Backward compatibility: environments without migration 0081 still have global quick actions.
				const fallback = await supabase
					.from("obra_default_quick_actions")
					.select("id, name, description, folder_paths, position")
					.eq("tenant_id", tenantId)
					.order("position", { ascending: true });
				quickActions = fallback.data as any;
				quickActionsError = fallback.error as any;
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
				quickActions: (quickActions ?? []).map((action: any): QuickAction => ({
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
				const { data: job, error: jobError } = await supabase
					.from("background_jobs")
					.insert({
						tenant_id: tenantId,
						type: "apply_default_folder",
						payload: { folderId: folder.id },
					})
					.select("id")
					.single();

				if (jobError) {
					console.error("[obra-defaults:post] job enqueue error:", jobError);
				}
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
				description?: string | null;
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
					const templateColumns = Array.isArray((template as any)?.columns)
						? ((template as any).columns as Array<{
								label?: string;
								fieldKey?: string;
								dataType?: string;
								ocrScope?: string;
								description?: string;
						  }>)
						: [];
					if (templateColumns.length > 0) {
						resolvedColumns = templateColumns.map((col, index) => ({
							label: col.label ?? `Columna ${index + 1}`,
							fieldKey: col.fieldKey,
							dataType: col.dataType ?? "text",
							required: false,
							ocrScope: col.ocrScope,
							description: col.description ?? null,
							position: index,
						}));
					}
				}
			}

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
				required?: boolean;
				ocrScope?: string;
				description?: string | null;
			}> = [];

			console.log("[obra-defaults:post] Creating columns for default tabla:", {
				tablaId: tabla.id,
				rawColumnsCount: rawColumns.length,
				rawColumns: rawColumns.map(c => ({ label: c.label, fieldKey: c.fieldKey })),
			});

			if (resolvedColumns.length > 0) {
				const columnsPayload = resolvedColumns.map((col, index) => ({
					default_tabla_id: tabla.id,
					field_key: normalizeFieldKey(col.fieldKey || col.label),
					label: col.label,
					data_type: ensureTablaDataType(col.dataType),
					position: col.position ?? index,
					required: Boolean(col.required),
					config:
						hasNestedData && col.ocrScope
							? { ocrScope: col.ocrScope, ocrDescription: col.description ?? null }
							: col.description
								? { ocrDescription: col.description }
								: {},
				}));

				const { data: columns, error: columnsError } = await supabase
					.from("obra_default_tabla_columns")
					.insert(columnsPayload)
					.select("field_key, label, data_type, required, config");

					if (columnsError) {
						console.error("[obra-defaults:post] columns error:", columnsError);
					} else if (columns) {
						console.log("[obra-defaults:post] Successfully created", columns.length, "columns for default tabla", tabla.id);
						insertedColumns = columns.map(col => ({
							fieldKey: col.field_key,
							label: col.label,
							dataType: col.data_type,
							required: Boolean(col.required),
							ocrScope: (col.config as any)?.ocrScope,
							description: (col.config as any)?.ocrDescription ?? null,
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
					dataInputMethod,
					ocrTemplateId,
					ocrTemplateName,
					hasNestedData,
					columns: insertedColumns,
				};

			const { data: job, error: jobError } = await supabase
				.from("background_jobs")
				.insert({
					tenant_id: tenantId,
					type: "apply_default_folder",
					payload: { folderId: folder.id },
				})
				.select("id")
				.single();

			if (jobError) {
				console.error("[obra-defaults:post] job enqueue error:", jobError);
			}

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

				const quickActionInsertPayload: Record<string, unknown> = {
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
					.insert(quickActionInsertPayload as any)
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

		const path = normalizeFolderName(rawName);
		if (!path) {
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

			const { error: jobError } = await supabase.from("background_jobs").insert({
				tenant_id: tenantId,
				type: "apply_default_folder",
				payload: { folderId: updatedFolder.id, forceSync: true, previousPath: existingFolder.path },
			});
			if (jobError) {
				console.error("[obra-defaults:put] job enqueue error:", jobError);
			}

			return NextResponse.json({ folder: updatedFolder });
		}

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
			description?: string | null;
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
				console.error("[obra-defaults:put] template columns error:", templateError);
			} else {
				const templateColumns = Array.isArray((template as any)?.columns)
					? ((template as any).columns as Array<{
							label?: string;
							fieldKey?: string;
							dataType?: string;
							ocrScope?: string;
							description?: string;
					  }>)
					: [];

				if (templateColumns.length > 0) {
					resolvedColumns = templateColumns.map((col, index) => ({
						label: col.label ?? `Columna ${index + 1}`,
						fieldKey: col.fieldKey,
						dataType: col.dataType ?? "text",
						required: false,
						ocrScope: col.ocrScope,
						description: col.description ?? null,
						position: index,
					}));
				}
			}
		}

		const rawDataInputMethod = typeof body.dataInputMethod === "string" ? body.dataInputMethod : "both";
		const dataInputMethod = ["ocr", "manual", "both"].includes(rawDataInputMethod)
			? rawDataInputMethod
			: "both";

		const settings: Record<string, unknown> = {
			ocrFolder: path,
			hasNestedData,
			dataInputMethod,
		};
		if (ocrTemplateId) {
			settings.ocrTemplateId = ocrTemplateId;
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
					ocr_template_id: ocrTemplateId,
				})
				.eq("id", tablaId)
				.eq("tenant_id", tenantId);

			if (updateTablaError) throw updateTablaError;

			await supabase
				.from("obra_default_tabla_columns")
				.delete()
				.eq("default_tabla_id", tablaId);
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
					ocr_template_id: ocrTemplateId,
				})
				.select("id")
				.single();

			if (tablaError || !tabla) throw tablaError ?? new Error("Failed to create default tabla");
			tablaId = tabla.id;
		}

		let insertedColumns: Array<{
			fieldKey: string;
			label: string;
			dataType: string;
			required?: boolean;
			ocrScope?: string;
			description?: string | null;
		}> = [];

		if (tablaId && resolvedColumns.length > 0) {
			const columnsPayload = resolvedColumns.map((col, index) => ({
				default_tabla_id: tablaId,
				field_key: normalizeFieldKey(col.fieldKey || col.label),
				label: col.label,
				data_type: ensureTablaDataType(col.dataType),
				position: col.position ?? index,
				required: Boolean(col.required),
				config:
					hasNestedData && col.ocrScope
						? { ocrScope: col.ocrScope, ocrDescription: col.description ?? null }
						: col.description
							? { ocrDescription: col.description }
							: {},
			}));

			const { data: columns, error: columnsError } = await supabase
				.from("obra_default_tabla_columns")
				.insert(columnsPayload)
				.select("field_key, label, data_type, required, config");

			if (columnsError) {
				console.error("[obra-defaults:put] columns error:", columnsError);
			} else {
				insertedColumns = (columns ?? []).map((col) => ({
					fieldKey: col.field_key,
					label: col.label,
					dataType: col.data_type,
					required: Boolean(col.required),
					ocrScope: (col.config as any)?.ocrScope,
					description: (col.config as any)?.ocrDescription ?? null,
				}));
			}
		}

		let ocrTemplateName: string | null = null;
		if (ocrTemplateId) {
			const { data: template } = await supabase
				.from("ocr_templates")
				.select("name")
				.eq("id", ocrTemplateId)
				.maybeSingle();
			ocrTemplateName = template?.name ?? null;
		}

		const enrichedFolder: DefaultFolder = {
			...updatedFolder,
			isOcr: true,
			dataInputMethod,
			ocrTemplateId,
			ocrTemplateName,
			hasNestedData,
			columns: insertedColumns,
		};

		const { error: jobError } = await supabase.from("background_jobs").insert({
			tenant_id: tenantId,
			type: "apply_default_folder",
			payload: { folderId: updatedFolder.id, forceSync: true, previousPath: existingFolder.path },
		});
		if (jobError) {
			console.error("[obra-defaults:put] job enqueue error:", jobError);
		}

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
