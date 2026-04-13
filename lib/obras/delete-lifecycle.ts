import type { SupabaseClient } from "@supabase/supabase-js";

export const OBRA_RECOVERY_WINDOW_DAYS = 30;
export const OBRA_PURGE_REASON_RETENTION = "retention_30_days";

type ObraDeleteStatus = "deleted" | "restored" | "expired" | "purged";

type ObraRow = {
	id: string;
	n: number | null;
	designacion_y_ubicacion: string | null;
	deleted_at: string | null;
	delete_reason: string | null;
	restore_deadline_at: string | null;
	deleted_by: string | null;
};

type ObraDeleteRow = {
	id: string;
	tenant_id: string;
	obra_id: string;
	obra_n: number | null;
	obra_name: string | null;
	delete_reason: string | null;
	deleted_at: string | null;
	deleted_by: string | null;
	deleted_by_email: string | null;
	restore_deadline_at: string | null;
	restored_at: string | null;
	restored_by: string | null;
	restored_by_email: string | null;
	purged_at: string | null;
	purged_by: string | null;
	purged_by_email: string | null;
	purge_job_id: string | null;
	purge_reason: string | null;
	status: ObraDeleteStatus | null;
};

type SoftDeleteObraInput = {
	supabase: SupabaseClient;
	tenantId: string;
	obraId: string;
	actorUserId: string | null;
	actorEmail: string | null;
	deleteReason?: string | null;
};

type RestoreObraInput = {
	supabase: SupabaseClient;
	tenantId: string;
	deleteId: string;
	actorUserId: string | null;
	actorEmail: string | null;
	now?: Date;
};

type ResolveDeleteStatusInput = {
	restoredAt: string | null;
	purgedAt: string | null;
	restoreDeadlineAt: string | null;
	nowMs?: number;
};

export function resolveObraDeleteStatus(
	input: ResolveDeleteStatusInput,
): ObraDeleteStatus {
	if (input.purgedAt) return "purged";
	if (input.restoredAt) return "restored";
	const nowMs = input.nowMs ?? Date.now();
	const deadlineMs = input.restoreDeadlineAt
		? new Date(input.restoreDeadlineAt).getTime()
		: Number.NaN;
	if (Number.isFinite(deadlineMs) && deadlineMs <= nowMs) return "expired";
	return "deleted";
}

async function loadActiveDeleteEvent(
	supabase: SupabaseClient,
	tenantId: string,
	obraId: string,
) {
	const { data, error } = await supabase
		.from("obra_deletes")
		.select(
			"id, tenant_id, obra_id, obra_n, obra_name, delete_reason, deleted_at, deleted_by, deleted_by_email, restore_deadline_at, restored_at, restored_by, restored_by_email, purged_at, purged_by, purged_by_email, purge_job_id, purge_reason, status",
		)
		.eq("tenant_id", tenantId)
		.eq("obra_id", obraId)
		.is("restored_at", null)
		.is("purged_at", null)
		.order("deleted_at", { ascending: false })
		.limit(1)
		.maybeSingle<ObraDeleteRow>();

	if (error) throw error;
	return data;
}

export async function softDeleteObraWithDocuments(input: SoftDeleteObraInput) {
	const { supabase, tenantId, obraId, actorUserId, actorEmail } = input;
	const deleteReason = (input.deleteReason ?? "").trim() || "manual_delete";
	const now = new Date();
	const nowIso = now.toISOString();
	const restoreDeadlineAt = new Date(
		now.getTime() + OBRA_RECOVERY_WINDOW_DAYS * 24 * 60 * 60 * 1000,
	).toISOString();

	const { data: obraRow, error: obraError } = await supabase
		.from("obras")
		.select("id, n, designacion_y_ubicacion, deleted_at, delete_reason, restore_deadline_at, deleted_by")
		.eq("tenant_id", tenantId)
		.eq("id", obraId)
		.maybeSingle<ObraRow>();
	if (obraError) throw obraError;

	const activeDeleteEvent = await loadActiveDeleteEvent(supabase, tenantId, obraId);
	if (activeDeleteEvent) {
		return {
			ok: true as const,
			alreadyDeleted: true,
			deleteId: activeDeleteEvent.id,
			restoreDeadlineAt: activeDeleteEvent.restore_deadline_at,
			status: resolveObraDeleteStatus({
				restoredAt: activeDeleteEvent.restored_at,
				purgedAt: activeDeleteEvent.purged_at,
				restoreDeadlineAt: activeDeleteEvent.restore_deadline_at,
			}),
		};
	}

	if (!obraRow) {
		return {
			ok: false as const,
			errorCode: "obra_not_found",
			errorMessage: "Obra no encontrada",
		};
	}

	if (obraRow.deleted_at) {
		const deletedAtMs = new Date(obraRow.deleted_at).getTime();
		const fallbackDeadline = Number.isFinite(deletedAtMs)
			? new Date(
				deletedAtMs + OBRA_RECOVERY_WINDOW_DAYS * 24 * 60 * 60 * 1000,
			).toISOString()
			: nowIso;
		const backfilledDeadline = obraRow.restore_deadline_at ?? fallbackDeadline;
		const backfilledStatus = resolveObraDeleteStatus({
			restoredAt: null,
			purgedAt: null,
			restoreDeadlineAt: backfilledDeadline,
		});
		const { data: backfilledDelete, error: backfillError } = await supabase
			.from("obra_deletes")
			.insert({
				tenant_id: tenantId,
				obra_id: obraId,
				obra_n: obraRow.n ?? null,
				obra_name: obraRow.designacion_y_ubicacion ?? null,
				delete_reason: obraRow.delete_reason ?? deleteReason,
				deleted_at: obraRow.deleted_at,
				deleted_by: obraRow.deleted_by,
				deleted_by_email: actorEmail,
				restore_deadline_at: backfilledDeadline,
				status: backfilledStatus,
				metadata: { operation: "obra_soft_delete_backfill" },
			})
			.select("id")
			.maybeSingle<{ id: string }>();
		if (backfillError) {
			const raceActiveDelete = await loadActiveDeleteEvent(supabase, tenantId, obraId);
			return {
				ok: true as const,
				alreadyDeleted: true,
				deleteId: raceActiveDelete?.id ?? null,
				restoreDeadlineAt: raceActiveDelete?.restore_deadline_at ?? backfilledDeadline,
				status: raceActiveDelete
					? resolveObraDeleteStatus({
						restoredAt: raceActiveDelete.restored_at,
						purgedAt: raceActiveDelete.purged_at,
						restoreDeadlineAt: raceActiveDelete.restore_deadline_at,
					})
					: backfilledStatus,
			};
		}
		return {
			ok: true as const,
			alreadyDeleted: true,
			deleteId: backfilledDelete?.id ?? null,
			restoreDeadlineAt: backfilledDeadline,
			status: backfilledStatus,
		};
	}

	const { data: insertDeleteData, error: insertDeleteError } = await supabase
		.from("obra_deletes")
		.insert({
			tenant_id: tenantId,
			obra_id: obraId,
			obra_n: obraRow.n ?? null,
			obra_name: obraRow.designacion_y_ubicacion ?? null,
			delete_reason: deleteReason,
			deleted_at: nowIso,
			deleted_by: actorUserId,
			deleted_by_email: actorEmail,
			restore_deadline_at: restoreDeadlineAt,
			status: "deleted",
			metadata: { operation: "obra_soft_delete" },
		})
		.select("id, restore_deadline_at")
		.single<{ id: string; restore_deadline_at: string | null }>();
	if (insertDeleteError) throw insertDeleteError;

	const { error: updateObraError } = await supabase
		.from("obras")
		.update({
			deleted_at: nowIso,
			deleted_by: actorUserId,
			delete_reason: deleteReason,
			restore_deadline_at: restoreDeadlineAt,
			restored_at: null,
			restored_by: null,
			purged_at: null,
			purged_by: null,
			purge_job_id: null,
		})
		.eq("tenant_id", tenantId)
		.eq("id", obraId)
		.is("deleted_at", null);
	if (updateObraError) {
		await supabase
			.from("obra_deletes")
			.delete()
			.eq("tenant_id", tenantId)
			.eq("id", insertDeleteData.id)
			.is("restored_at", null)
			.is("purged_at", null);
		throw updateObraError;
	}

	return {
		ok: true as const,
		alreadyDeleted: false,
		deleteId: insertDeleteData.id,
		restoreDeadlineAt: insertDeleteData.restore_deadline_at,
		status: "deleted" as const,
	};
}

export async function restoreSoftDeletedObra(input: RestoreObraInput) {
	const { supabase, tenantId, deleteId, actorUserId, actorEmail } = input;
	const now = input.now ?? new Date();
	const nowIso = now.toISOString();

	const { data: deleteRow, error: deleteRowError } = await supabase
		.from("obra_deletes")
		.select(
			"id, tenant_id, obra_id, obra_n, obra_name, delete_reason, deleted_at, deleted_by, deleted_by_email, restore_deadline_at, restored_at, restored_by, restored_by_email, purged_at, purged_by, purged_by_email, purge_job_id, purge_reason, status",
		)
		.eq("tenant_id", tenantId)
		.eq("id", deleteId)
		.maybeSingle<ObraDeleteRow>();
	if (deleteRowError) throw deleteRowError;

	if (!deleteRow) {
		return {
			ok: false as const,
			errorCode: "delete_not_found",
			errorMessage: "Registro de eliminación no encontrado",
		};
	}

	if (deleteRow.restored_at) {
		return {
			ok: false as const,
			errorCode: "already_restored",
			errorMessage: "La obra ya fue restaurada",
		};
	}

	if (deleteRow.purged_at) {
		return {
			ok: false as const,
			errorCode: "already_purged",
			errorMessage: "La obra ya fue purgada definitivamente",
		};
	}

	const deadlineMs = deleteRow.restore_deadline_at
		? new Date(deleteRow.restore_deadline_at).getTime()
		: Number.NaN;
	if (!Number.isFinite(deadlineMs) || deadlineMs <= now.getTime()) {
		return {
			ok: false as const,
			errorCode: "restore_window_expired",
			errorMessage: "La ventana de recuperación de 30 días expiró",
		};
	}

	const { data: obraRow, error: obraError } = await supabase
		.from("obras")
		.select("id")
		.eq("tenant_id", tenantId)
		.eq("id", deleteRow.obra_id)
		.maybeSingle<{ id: string }>();
	if (obraError) throw obraError;
	if (!obraRow) {
		return {
			ok: false as const,
			errorCode: "obra_not_found",
			errorMessage: "La obra ya no existe",
		};
	}

	const { error: restoreObraError } = await supabase
		.from("obras")
		.update({
			deleted_at: null,
			deleted_by: null,
			delete_reason: null,
			restore_deadline_at: null,
			restored_at: nowIso,
			restored_by: actorUserId,
			purged_at: null,
			purged_by: null,
			purge_job_id: null,
		})
		.eq("tenant_id", tenantId)
		.eq("id", deleteRow.obra_id);
	if (restoreObraError) throw restoreObraError;

	const { error: restoreDeleteError } = await supabase
		.from("obra_deletes")
		.update({
			restored_at: nowIso,
			restored_by: actorUserId,
			restored_by_email: actorEmail,
			status: "restored",
		})
		.eq("tenant_id", tenantId)
		.eq("id", deleteId)
		.is("restored_at", null)
		.is("purged_at", null);
	if (restoreDeleteError) throw restoreDeleteError;

	return {
		ok: true as const,
		deleteId: deleteRow.id,
		obraId: deleteRow.obra_id,
	};
}
