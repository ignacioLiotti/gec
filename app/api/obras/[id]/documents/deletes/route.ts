import { NextResponse } from "next/server";

import {
	hasDemoCapability,
	resolveRequestAccessContext,
} from "@/lib/demo-session";
import { fetchTenantPlan } from "@/lib/subscription-plans";
import { incrementTenantUsage, logTenantUsageEvent } from "@/lib/tenant-usage";

type RouteContext = { params: Promise<{ id: string }> };
type DeleteItemType = "file" | "folder";
type DeleteViewMode = "active" | "history";
type DeleteLifecycleStatus = "deleted" | "restored" | "expired" | "purged";

const DOCUMENTS_BUCKET = "obra-documents";
const RECOVERY_WINDOW_DAYS = 30;

function usageErrorToStatus(code?: string) {
	if (code === "storage_limit_exceeded") return 402;
	if (code === "insufficient_privilege") return 403;
	return 400;
}

type CandidateFile = {
	storagePath: string;
	fileName: string;
	fileSizeBytes: number | null;
	mimeType: string | null;
};

type DeleteRow = {
	id: string;
	item_type: DeleteItemType;
	storage_path: string;
	root_folder_path: string | null;
	file_name: string;
	file_size_bytes: number | null;
	deleted_at: string | null;
	deleted_by: string | null;
	deleted_by_email: string | null;
	recover_until: string | null;
	restored_at: string | null;
	restored_by: string | null;
	restored_by_email: string | null;
	purged_at: string | null;
	purged_by: string | null;
	purged_by_email: string | null;
	purge_reason: string | null;
	purge_job_id: string | null;
};

type DeletedTreeEntry = {
	path: string;
	name: string;
	itemType: DeleteItemType;
	depth: number;
	fileSizeBytes: number | null;
};

function normalizeStoragePath(path: string) {
	return path
		.replace(/\\/g, "/")
		.trim()
		.replace(/\/{2,}/g, "/")
		.replace(/^\/+/, "")
		.replace(/\/+$/, "");
}

function isPathInsideObra(obraId: string, storagePath: string) {
	return storagePath === obraId || storagePath.startsWith(`${obraId}/`);
}

function getActorUserId(actorType: "anonymous" | "user" | "demo", userId?: string | null) {
	return actorType === "user" && userId ? userId : null;
}

function chunk<T>(items: T[], size: number) {
	const output: T[][] = [];
	for (let i = 0; i < items.length; i += size) {
		output.push(items.slice(i, i + size));
	}
	return output;
}

function resolveDeleteStatus(row: DeleteRow): DeleteLifecycleStatus {
	if (row.purged_at) return "purged";
	if (row.restored_at) return "restored";

	const recoverUntilMs = row.recover_until
		? new Date(row.recover_until).getTime()
		: Number.NaN;
	if (Number.isFinite(recoverUntilMs) && recoverUntilMs <= Date.now()) {
		return "expired";
	}

	return "deleted";
}

function resolveActorLabel(
	userId: string | null,
	email: string | null,
	currentUserId: string | null,
) {
	if (email && email.trim().length > 0) return email;
	if (userId && currentUserId && userId === currentUserId) return "Vos";
	return userId;
}

function isKeepPlaceholderFile(
	fileName: string | null | undefined,
	storagePath: string | null | undefined,
) {
	const normalizedName = (fileName ?? "").trim().toLowerCase();
	if (normalizedName === ".keep") return true;
	const normalizedPath = (storagePath ?? "").trim().toLowerCase();
	return normalizedPath === ".keep" || normalizedPath.endsWith("/.keep");
}

function buildFolderTreeEntries(folderPath: string, fileRows: DeleteRow[]) {
	const normalizedFolderPath = folderPath.replace(/\/+$/, "");
	const nestedFolderPaths = new Set<string>();
	const fileEntries: DeletedTreeEntry[] = [];

	for (const row of fileRows) {
		if (row.item_type !== "file") continue;
		if (isKeepPlaceholderFile(row.file_name, row.storage_path)) continue;
		const fullPath =
			typeof row.storage_path === "string" ? row.storage_path.trim() : "";
		if (!fullPath) continue;
		if (
			fullPath !== normalizedFolderPath &&
			!fullPath.startsWith(`${normalizedFolderPath}/`)
		) {
			continue;
		}

		const relativePath = fullPath.slice(normalizedFolderPath.length).replace(/^\/+/, "");
		if (!relativePath) continue;

		const segments = relativePath.split("/").filter(Boolean);
		if (segments.length === 0) continue;

		if (segments.length > 1) {
			let accumulator = normalizedFolderPath;
			for (let index = 0; index < segments.length - 1; index += 1) {
				accumulator = `${accumulator}/${segments[index]}`;
				nestedFolderPaths.add(accumulator);
			}
		}

		fileEntries.push({
			path: fullPath,
			name: segments[segments.length - 1] ?? row.file_name,
			itemType: "file",
			depth: segments.length,
			fileSizeBytes:
				typeof row.file_size_bytes === "number" ? row.file_size_bytes : null,
		});
	}

	const folderEntries: DeletedTreeEntry[] = Array.from(nestedFolderPaths)
		.sort((left, right) => left.localeCompare(right))
		.map((path) => {
			const relativePath = path.slice(normalizedFolderPath.length).replace(/^\/+/, "");
			const segments = relativePath.split("/").filter(Boolean);
			return {
				path,
				name: segments[segments.length - 1] ?? path,
				itemType: "folder" as const,
				depth: segments.length,
				fileSizeBytes: null,
			};
		});

	const sortedFileEntries = fileEntries.sort((left, right) =>
		left.path.localeCompare(right.path),
	);

	const treeEntries = [...folderEntries, ...sortedFileEntries].sort((left, right) => {
		const byPath = left.path.localeCompare(right.path);
		if (byPath !== 0) return byPath;
		if (left.itemType === right.itemType) return 0;
		return left.itemType === "folder" ? -1 : 1;
	});

	return {
		treeEntries,
		nestedFolderCount: folderEntries.length,
	};
}

async function resolveObraAccess(obraId: string) {
	const access = await resolveRequestAccessContext();
	const { supabase, user, tenantId, actorType } = access;

	if (!user && actorType !== "demo") {
		return {
			error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
		} as const;
	}
	if (actorType === "demo" && !hasDemoCapability(access.demoSession, "excel")) {
		return {
			error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
		} as const;
	}
	if (!tenantId) {
		return {
			error: NextResponse.json({ error: "No tenant" }, { status: 400 }),
		} as const;
	}

	const { data: obraRow, error: obraError } = await supabase
		.from("obras")
		.select("id")
		.eq("id", obraId)
		.eq("tenant_id", tenantId)
		.is("deleted_at", null)
		.maybeSingle();

	if (obraError) throw obraError;
	if (!obraRow) {
		return {
			error: NextResponse.json({ error: "Obra no encontrada" }, { status: 404 }),
		} as const;
	}

	return {
		error: null,
		access,
		tenantId,
		actorUserId: getActorUserId(actorType, user?.id),
		actorEmail: user?.email ?? null,
		currentUserId: user?.id ?? null,
	} as const;
}

async function listFolderFilesRecursively(
	supabase: Awaited<ReturnType<typeof resolveRequestAccessContext>>["supabase"],
	folderPath: string,
) {
	const files: CandidateFile[] = [];
	const foldersToScan: string[] = [folderPath];

	while (foldersToScan.length > 0) {
		const currentFolder = foldersToScan.shift();
		if (!currentFolder) continue;

		const { data: entries, error } = await supabase.storage
			.from(DOCUMENTS_BUCKET)
			.list(currentFolder, {
				limit: 1000,
				sortBy: { column: "name", order: "asc" },
			});
		if (error) throw error;

		for (const entry of entries ?? []) {
			if (entry.name === ".emptyFolderPlaceholder" || entry.name === ".keep") continue;
			const fullPath = `${currentFolder}/${entry.name}`.replace(/\/{2,}/g, "/");
			const isFolder = !entry.metadata;
			if (isFolder) {
				foldersToScan.push(fullPath.replace(/\/$/, ""));
				continue;
			}

			files.push({
				storagePath: fullPath,
				fileName: entry.name,
				fileSizeBytes:
					typeof entry.metadata?.size === "number" ? entry.metadata.size : null,
				mimeType:
					typeof entry.metadata?.mimetype === "string"
						? entry.metadata.mimetype
						: null,
			});
		}
	}

	return files;
}

async function loadSingleFileCandidate(
	supabase: Awaited<ReturnType<typeof resolveRequestAccessContext>>["supabase"],
	storagePath: string,
) {
	const lastSlash = storagePath.lastIndexOf("/");
	const parentPath = lastSlash > 0 ? storagePath.slice(0, lastSlash) : "";
	const fileName = lastSlash > -1 ? storagePath.slice(lastSlash + 1) : storagePath;

	const { data: entries, error } = await supabase.storage
		.from(DOCUMENTS_BUCKET)
		.list(parentPath, { limit: 1000, search: fileName });
	if (error) throw error;

	const matched = (entries ?? []).find(
		(entry) => entry.name === fileName && Boolean(entry.metadata),
	);

	return {
		storagePath,
		fileName,
		fileSizeBytes:
			typeof matched?.metadata?.size === "number" ? matched.metadata.size : null,
		mimeType:
			typeof matched?.metadata?.mimetype === "string"
				? matched.metadata.mimetype
				: null,
	} satisfies CandidateFile;
}

export async function GET(request: Request, context: RouteContext) {
	const { id: obraId } = await context.params;
	if (!obraId) {
		return NextResponse.json({ error: "Obra no encontrada" }, { status: 400 });
	}

	try {
		const access = await resolveObraAccess(obraId);
		if (access.error) return access.error;

		const url = new URL(request.url);
		const rawLimit = Number(url.searchParams.get("limit") ?? 100);
		const limit = Number.isFinite(rawLimit)
			? Math.min(400, Math.max(1, Math.trunc(rawLimit)))
			: 100;
		const view: DeleteViewMode =
			url.searchParams.get("view") === "history" ? "history" : "active";

		let query = access.access.supabase
			.from("obra_document_deletes")
			.select(
				"id, item_type, storage_path, root_folder_path, file_name, file_size_bytes, deleted_at, deleted_by, deleted_by_email, recover_until, restored_at, restored_by, restored_by_email, purged_at, purged_by, purged_by_email, purge_reason, purge_job_id"
			)
			.eq("tenant_id", access.tenantId)
			.eq("obra_id", obraId)
			.order("deleted_at", { ascending: false })
			.limit(limit * 10);

		if (view === "active") {
			query = query.is("restored_at", null).is("purged_at", null);
		}

		const { data, error } = await query;
		if (error) throw error;

		const rows = (data ?? []) as DeleteRow[];
		const folderStats = new Map<string, { fileCount: number; totalBytes: number }>();
		const folderFileRows = new Map<string, DeleteRow[]>();

		for (const row of rows) {
			if (row.item_type !== "file") continue;
			if (isKeepPlaceholderFile(row.file_name, row.storage_path)) continue;
			const rootFolderPath =
				typeof row.root_folder_path === "string" ? row.root_folder_path : null;
			if (!rootFolderPath) continue;
			const previous = folderStats.get(rootFolderPath) ?? { fileCount: 0, totalBytes: 0 };
			const existingFiles = folderFileRows.get(rootFolderPath) ?? [];
			existingFiles.push(row);
			folderFileRows.set(rootFolderPath, existingFiles);
			const nextBytes =
				typeof row.file_size_bytes === "number" && row.file_size_bytes > 0
					? previous.totalBytes + row.file_size_bytes
					: previous.totalBytes;
			folderStats.set(rootFolderPath, {
				fileCount: previous.fileCount + 1,
				totalBytes: nextBytes,
			});
		}

		const items: Array<Record<string, unknown>> = [];
		for (const row of rows) {
			if (items.length >= limit) break;
			if (row.item_type === "file" && isKeepPlaceholderFile(row.file_name, row.storage_path)) {
				continue;
			}

			if (row.item_type === "file" && row.root_folder_path) {
				continue;
			}

			const status = resolveDeleteStatus(row);
			const recoverUntilMs = row.recover_until
				? new Date(row.recover_until).getTime()
				: Number.NaN;
			const recoverable =
				status === "deleted" &&
				Number.isFinite(recoverUntilMs) &&
				recoverUntilMs > Date.now();

			if (row.item_type === "folder") {
				const stats = folderStats.get(row.storage_path) ?? { fileCount: 0, totalBytes: 0 };
				const folderTree = buildFolderTreeEntries(
					row.storage_path,
					folderFileRows.get(row.storage_path) ?? [],
				);
				items.push({
					id: row.id,
					itemType: row.item_type,
					status,
					storagePath: row.storage_path,
					fileName: row.file_name,
					fileSizeBytes: null,
					fileCount: stats.fileCount,
					totalBytes: stats.totalBytes,
					deletedAt: row.deleted_at,
					deletedByUserId: row.deleted_by,
					deletedByLabel: resolveActorLabel(
						row.deleted_by,
						row.deleted_by_email,
						access.currentUserId,
					),
					recoverUntil: row.recover_until,
					recoverable,
					restoredAt: row.restored_at,
					restoredByUserId: row.restored_by,
					restoredByLabel: resolveActorLabel(
						row.restored_by,
						row.restored_by_email,
						access.currentUserId,
					),
					purgedAt: row.purged_at,
					purgedByUserId: row.purged_by,
					purgedByLabel: resolveActorLabel(
						row.purged_by,
						row.purged_by_email,
						access.currentUserId,
					),
					purgeReason: row.purge_reason,
					purgeJobId: row.purge_job_id,
					nestedFolderCount: folderTree.nestedFolderCount,
					treeEntries: folderTree.treeEntries,
				});
				continue;
			}

			const bytes =
				typeof row.file_size_bytes === "number" ? row.file_size_bytes : 0;
			items.push({
				id: row.id,
				itemType: row.item_type,
				status,
				storagePath: row.storage_path,
				fileName: row.file_name,
				fileSizeBytes: typeof row.file_size_bytes === "number" ? row.file_size_bytes : null,
				fileCount: 1,
				totalBytes: bytes,
				deletedAt: row.deleted_at,
				deletedByUserId: row.deleted_by,
				deletedByLabel: resolveActorLabel(
					row.deleted_by,
					row.deleted_by_email,
					access.currentUserId,
				),
				recoverUntil: row.recover_until,
				recoverable,
				restoredAt: row.restored_at,
				restoredByUserId: row.restored_by,
				restoredByLabel: resolveActorLabel(
					row.restored_by,
					row.restored_by_email,
					access.currentUserId,
				),
				purgedAt: row.purged_at,
				purgedByUserId: row.purged_by,
				purgedByLabel: resolveActorLabel(
					row.purged_by,
					row.purged_by_email,
					access.currentUserId,
				),
				purgeReason: row.purge_reason,
				purgeJobId: row.purge_job_id,
			});
		}

		return NextResponse.json({
			view,
			items,
			total: items.length,
		});
	} catch (error) {
		console.error("[documents:deletes:get]", error);
		const message =
			error instanceof Error ? error.message : "Error al obtener documentos eliminados";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}

export async function POST(request: Request, context: RouteContext) {
	const { id: obraId } = await context.params;
	if (!obraId) {
		return NextResponse.json({ error: "Obra no encontrada" }, { status: 400 });
	}

	try {
		const access = await resolveObraAccess(obraId);
		if (access.error) return access.error;
		const plan = await fetchTenantPlan(access.access.supabase, access.tenantId);

		const body = await request.json().catch(() => ({}));
		const itemType =
			body?.itemType === "file" || body?.itemType === "folder"
				? (body.itemType as DeleteItemType)
				: null;
		const rawStoragePath =
			typeof body?.storagePath === "string" ? body.storagePath.trim() : "";

		if (!itemType) {
			return NextResponse.json({ error: "Tipo de elemento inválido." }, { status: 400 });
		}
		if (!rawStoragePath) {
			return NextResponse.json({ error: "Ruta inválida." }, { status: 400 });
		}

		const storagePath = normalizeStoragePath(rawStoragePath);
		if (!storagePath || !isPathInsideObra(obraId, storagePath)) {
			return NextResponse.json(
				{ error: "La ruta no pertenece a la obra." },
				{ status: 400 },
			);
		}
		if (itemType === "folder" && storagePath === obraId) {
			return NextResponse.json(
				{ error: "No se puede eliminar la carpeta raíz." },
				{ status: 400 },
			);
		}
		if (itemType === "file" && storagePath === obraId) {
			return NextResponse.json(
				{ error: "No se puede eliminar esta ruta." },
				{ status: 400 },
			);
		}
		if (
			itemType === "file" &&
			isKeepPlaceholderFile(storagePath.split("/").pop() ?? null, storagePath)
		) {
			return NextResponse.json(
				{ error: "No se puede eliminar el archivo de sistema .keep." },
				{ status: 400 },
			);
		}

		const fileCandidates =
			itemType === "folder"
				? await listFolderFilesRecursively(access.access.supabase, storagePath)
				: [await loadSingleFileCandidate(access.access.supabase, storagePath)];

		const candidatePaths = Array.from(
			new Set(fileCandidates.map((file) => file.storagePath).filter(Boolean)),
		);
		const pathsToCheck = Array.from(new Set([storagePath, ...candidatePaths]));

		const activeRowsByPath = new Map<string, Set<DeleteItemType>>();
		for (const pathChunk of chunk(pathsToCheck, 250)) {
			const { data, error } = await access.access.supabase
				.from("obra_document_deletes")
				.select("storage_path, item_type")
				.eq("tenant_id", access.tenantId)
				.eq("obra_id", obraId)
				.is("restored_at", null)
				.is("purged_at", null)
				.in("storage_path", pathChunk);
			if (error) throw error;

			for (const row of data ?? []) {
				const existingPath = row.storage_path as string;
				const existingType = row.item_type as DeleteItemType;
				const types = activeRowsByPath.get(existingPath) ?? new Set<DeleteItemType>();
				types.add(existingType);
				activeRowsByPath.set(existingPath, types);
			}
		}

		const now = new Date();
		const recoverUntil = new Date(
			now.getTime() + RECOVERY_WINDOW_DAYS * 24 * 60 * 60 * 1000,
		);
		const nowIso = now.toISOString();
		const recoverUntilIso = recoverUntil.toISOString();

		const rowsToInsert: Array<Record<string, unknown>> = [];
		const actorEmail = access.actorEmail;

		if (itemType === "folder") {
			const existingFolderTypes = activeRowsByPath.get(storagePath);
			if (!existingFolderTypes?.has("folder")) {
				rowsToInsert.push({
					tenant_id: access.tenantId,
					obra_id: obraId,
					storage_bucket: DOCUMENTS_BUCKET,
					storage_path: storagePath,
					item_type: "folder",
					root_folder_path: null,
					file_name: storagePath.split("/").pop() ?? storagePath,
					file_size_bytes: null,
					mime_type: null,
					deleted_by: access.actorUserId,
					deleted_by_email: actorEmail,
					deleted_at: nowIso,
					recover_until: recoverUntilIso,
					metadata: { operation: "folder_soft_delete" },
				});
			}
		}

		for (const file of fileCandidates) {
			const existingTypes = activeRowsByPath.get(file.storagePath);
			if (existingTypes?.has("file")) continue;
			rowsToInsert.push({
				tenant_id: access.tenantId,
				obra_id: obraId,
				storage_bucket: DOCUMENTS_BUCKET,
				storage_path: file.storagePath,
				item_type: "file",
				root_folder_path: itemType === "folder" ? storagePath : null,
				file_name: file.fileName,
				file_size_bytes: file.fileSizeBytes,
				mime_type: file.mimeType,
				deleted_by: access.actorUserId,
				deleted_by_email: actorEmail,
				deleted_at: nowIso,
				recover_until: recoverUntilIso,
				metadata: {
					operation:
						itemType === "folder" ? "folder_contents_soft_delete" : "file_soft_delete",
				},
			});
		}

		const deletedFileRows = rowsToInsert.filter((row) => row.item_type === "file");
		const bytesDeleted = deletedFileRows.reduce((sum, row) => {
			const size =
				typeof row.file_size_bytes === "number" && row.file_size_bytes > 0
					? row.file_size_bytes
					: 0;
			return sum + size;
		}, 0);
		const deletedPaths = deletedFileRows
			.map((row) => row.storage_path)
			.filter((value): value is string => typeof value === "string");

		if (bytesDeleted > 0) {
			try {
				await incrementTenantUsage(
					access.access.supabase,
					access.tenantId,
					{ storageBytes: -bytesDeleted },
					plan.limits,
				);
				await logTenantUsageEvent(access.access.supabase, {
					tenantId: access.tenantId,
					kind: "storage_bytes",
					amount: -bytesDeleted,
					context: "documents_soft_delete",
					metadata: {
						obraId,
						itemType,
						storagePath,
						deletedPaths,
						deletedFileCount: deletedFileRows.length,
					},
				});
			} catch (usageError) {
				const err = usageError as Error & { code?: string };
				return NextResponse.json(
					{
						error:
							err.message || "No se pudo actualizar el uso de almacenamiento.",
					},
					{ status: usageErrorToStatus(err.code) },
				);
			}
		}

		if (rowsToInsert.length > 0) {
			try {
				for (const rowsChunk of chunk(rowsToInsert, 200)) {
					const { error: insertError } = await access.access.supabase
						.from("obra_document_deletes")
						.insert(rowsChunk);
					if (insertError) throw insertError;
				}
			} catch (insertError) {
				if (bytesDeleted > 0) {
					await incrementTenantUsage(
						access.access.supabase,
						access.tenantId,
						{ storageBytes: bytesDeleted },
						plan.limits,
					).catch((rollbackError) =>
						console.error(
							"[documents:deletes:post] failed to rollback storage usage",
							rollbackError,
						),
					);
					await logTenantUsageEvent(access.access.supabase, {
						tenantId: access.tenantId,
						kind: "storage_bytes",
						amount: bytesDeleted,
						context: "documents_soft_delete_rollback",
						metadata: { obraId, itemType, storagePath, deletedPaths },
					});
				}
				throw insertError;
			}
		}

		return NextResponse.json({
			ok: true,
			itemType,
			storagePath,
			bytesDeleted,
			deletedFileCount: deletedFileRows.length,
			insertedCount: rowsToInsert.length,
			recoverUntil: recoverUntilIso,
			alreadyDeleted: rowsToInsert.length === 0,
			deletedPaths,
		});
	} catch (error) {
		console.error("[documents:deletes:post]", error);
		const message =
			error instanceof Error ? error.message : "Error al eliminar documento/carpeta";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
