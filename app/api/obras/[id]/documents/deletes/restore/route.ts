import { NextResponse } from "next/server";

import {
	hasDemoCapability,
	resolveRequestAccessContext,
} from "@/lib/demo-session";
import { fetchTenantPlan } from "@/lib/subscription-plans";
import { incrementTenantUsage, logTenantUsageEvent } from "@/lib/tenant-usage";

type RouteContext = { params: Promise<{ id: string }> };

function usageErrorToStatus(code?: string) {
	if (code === "storage_limit_exceeded") return 402;
	if (code === "insufficient_privilege") return 403;
	return 400;
}

function getActorUserId(actorType: "anonymous" | "user" | "demo", userId?: string | null) {
	return actorType === "user" && userId ? userId : null;
}

export async function POST(request: Request, context: RouteContext) {
	const { id: obraId } = await context.params;
	if (!obraId) {
		return NextResponse.json({ error: "Obra no encontrada" }, { status: 400 });
	}

	try {
		const access = await resolveRequestAccessContext();
		const { supabase, user, tenantId, actorType } = access;
		const actorUserId = getActorUserId(actorType, user?.id);
		const actorEmail = user?.email ?? null;

		if (!user && actorType !== "demo") {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}
		if (actorType === "demo" && !hasDemoCapability(access.demoSession, "excel")) {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}
		if (!tenantId) {
			return NextResponse.json({ error: "No tenant" }, { status: 400 });
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
			return NextResponse.json({ error: "Obra no encontrada" }, { status: 404 });
		}

		const body = await request.json().catch(() => ({}));
		const deleteId = typeof body?.deleteId === "string" ? body.deleteId : "";
		if (!deleteId) {
			return NextResponse.json({ error: "deleteId requerido." }, { status: 400 });
		}

		const { data: targetDelete, error: targetError } = await supabase
			.from("obra_document_deletes")
			.select(
				"id, item_type, storage_path, recover_until, restored_at, purged_at, root_folder_path"
			)
			.eq("id", deleteId)
			.eq("tenant_id", tenantId)
			.eq("obra_id", obraId)
			.maybeSingle();
		if (targetError) throw targetError;
		if (!targetDelete) {
			return NextResponse.json({ error: "Registro no encontrado." }, { status: 404 });
		}
		if (targetDelete.restored_at) {
			return NextResponse.json({ error: "El elemento ya fue recuperado." }, { status: 409 });
		}
		if (targetDelete.purged_at) {
			return NextResponse.json(
				{ error: "El elemento ya fue eliminado definitivamente." },
				{ status: 410 },
			);
		}

		const recoverUntilMs = new Date(targetDelete.recover_until as string).getTime();
		if (!Number.isFinite(recoverUntilMs) || recoverUntilMs <= Date.now()) {
			return NextResponse.json(
				{ error: "La ventana de recuperación expiró." },
				{ status: 410 },
			);
		}

		const rowsToRestore: Array<{
			id: string;
			item_type: string;
			file_size_bytes: number | null;
		}> = [];
		if (targetDelete.item_type === "folder") {
			const { data: childrenRows, error: childrenRowsError } = await supabase
				.from("obra_document_deletes")
				.select("id, item_type, file_size_bytes")
				.eq("tenant_id", tenantId)
				.eq("obra_id", obraId)
				.eq("root_folder_path", targetDelete.storage_path as string)
				.is("restored_at", null)
				.is("purged_at", null);
			if (childrenRowsError) throw childrenRowsError;
			rowsToRestore.push(...(childrenRows ?? []));
		}

		const { data: targetRows, error: targetRowsError } = await supabase
			.from("obra_document_deletes")
			.select("id, item_type, file_size_bytes")
			.eq("id", deleteId)
			.eq("tenant_id", tenantId)
			.eq("obra_id", obraId)
			.is("restored_at", null)
			.is("purged_at", null);
		if (targetRowsError) throw targetRowsError;
		rowsToRestore.push(...(targetRows ?? []));

		const restoredFileRowsPreview = rowsToRestore.filter((row) => row.item_type === "file");
		const bytesRestored = restoredFileRowsPreview.reduce((sum, row) => {
			const size =
				typeof row.file_size_bytes === "number" && row.file_size_bytes > 0
					? row.file_size_bytes
					: 0;
			return sum + size;
		}, 0);
		const plan = await fetchTenantPlan(supabase, tenantId);

		if (bytesRestored > 0) {
			try {
				await incrementTenantUsage(
					supabase,
					tenantId,
					{ storageBytes: bytesRestored },
					plan.limits,
				);
				await logTenantUsageEvent(supabase, {
					tenantId,
					kind: "storage_bytes",
					amount: bytesRestored,
					context: "documents_restore",
					metadata: {
						obraId,
						deleteId,
						itemType: targetDelete.item_type,
						storagePath: targetDelete.storage_path,
						rowCount: rowsToRestore.length,
					},
				});
			} catch (usageError) {
				const err = usageError as Error & { code?: string };
				return NextResponse.json(
					{ error: err.message || "Superaste el limite de almacenamiento disponible." },
					{ status: usageErrorToStatus(err.code) },
				);
			}
		}

		const nowIso = new Date().toISOString();
		const restorePatch = {
			restored_at: nowIso,
			restored_by: actorUserId,
			restored_by_email: actorEmail,
		};

		let restoredRows: Array<{ id: string; item_type: string; file_size_bytes: number | null }> = [];
		try {
			if (targetDelete.item_type === "folder") {
				const { data: restoredChildren, error: childrenRestoreError } = await supabase
					.from("obra_document_deletes")
					.update(restorePatch)
					.eq("tenant_id", tenantId)
					.eq("obra_id", obraId)
					.eq("root_folder_path", targetDelete.storage_path as string)
					.is("restored_at", null)
					.is("purged_at", null)
					.select("id, item_type, file_size_bytes");
				if (childrenRestoreError) throw childrenRestoreError;
				restoredRows = [...restoredRows, ...(restoredChildren ?? [])];
			}

			const { data: restoredTarget, error: targetRestoreError } = await supabase
				.from("obra_document_deletes")
				.update(restorePatch)
				.eq("id", deleteId)
				.eq("tenant_id", tenantId)
				.eq("obra_id", obraId)
				.is("restored_at", null)
				.is("purged_at", null)
				.select("id, item_type, file_size_bytes");
			if (targetRestoreError) throw targetRestoreError;
			restoredRows = [...restoredRows, ...(restoredTarget ?? [])];
		} catch (restoreError) {
			if (bytesRestored > 0) {
				await incrementTenantUsage(
					supabase,
					tenantId,
					{ storageBytes: -bytesRestored },
					plan.limits,
				).catch((rollbackError) =>
					console.error(
						"[documents:deletes:restore] failed to rollback storage usage",
						rollbackError,
					),
				);
				await logTenantUsageEvent(supabase, {
					tenantId,
					kind: "storage_bytes",
					amount: -bytesRestored,
					context: "documents_restore_rollback",
					metadata: { obraId, deleteId },
				});
			}
			throw restoreError;
		}

		const restoredFileRows = restoredRows.filter((row) => row.item_type === "file");

		return NextResponse.json({
			ok: true,
			deleteId,
			restoredCount: restoredRows.length,
			restoredFileCount: restoredFileRows.length,
			bytesRestored,
		});
	} catch (error) {
		console.error("[documents:deletes:restore]", error);
		const message =
			error instanceof Error ? error.message : "Error al restaurar el elemento";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
