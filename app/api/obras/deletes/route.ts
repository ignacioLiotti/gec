import { NextResponse } from "next/server";

import { resolveRequestAccessContext } from "@/lib/demo-session";
import { resolveObraDeleteStatus } from "@/lib/obras/delete-lifecycle";

type DeleteViewMode = "active" | "history";
type ObraDeleteStatus = "deleted" | "restored" | "expired" | "purged";

type ObraDeleteRow = {
	id: string;
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
	created_at: string;
	updated_at: string;
};

function resolveActorLabel(
	userId: string | null,
	email: string | null,
	currentUserId: string | null,
) {
	if (email && email.trim().length > 0) return email;
	if (userId && currentUserId && userId === currentUserId) return "Vos";
	return userId;
}

export async function GET(request: Request) {
	const access = await resolveRequestAccessContext();
	const { supabase, user, tenantId } = access;

	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}
	if (!tenantId) {
		return NextResponse.json({ error: "No tenant" }, { status: 400 });
	}

	const isTenantAdmin =
		access.isSuperAdmin ||
		access.membershipRole === "owner" ||
		access.membershipRole === "admin";
	if (!isTenantAdmin) {
		return NextResponse.json(
			{ error: "Solo administradores pueden ver la papelera de obras." },
			{ status: 403 },
		);
	}

	try {
		const url = new URL(request.url);
		const rawLimit = Number(url.searchParams.get("limit") ?? 100);
		const limit = Number.isFinite(rawLimit)
			? Math.min(400, Math.max(1, Math.trunc(rawLimit)))
			: 100;
		const view: DeleteViewMode =
			url.searchParams.get("view") === "history" ? "history" : "active";

		let query = supabase
			.from("obra_deletes")
			.select(
				"id, obra_id, obra_n, obra_name, delete_reason, deleted_at, deleted_by, deleted_by_email, restore_deadline_at, restored_at, restored_by, restored_by_email, purged_at, purged_by, purged_by_email, purge_job_id, purge_reason, status, created_at, updated_at",
			)
			.eq("tenant_id", tenantId)
			.order("deleted_at", { ascending: false })
			.limit(limit);

		if (view === "active") {
			query = query.is("restored_at", null).is("purged_at", null);
		}

		const { data, error } = await query;
		if (error) throw error;

		const nowMs = Date.now();
		const rows = (data ?? []) as ObraDeleteRow[];
		const items = rows.map((row) => {
			const status = resolveObraDeleteStatus({
				restoredAt: row.restored_at,
				purgedAt: row.purged_at,
				restoreDeadlineAt: row.restore_deadline_at,
				nowMs,
			});
			const deadlineMs = row.restore_deadline_at
				? new Date(row.restore_deadline_at).getTime()
				: Number.NaN;
			const recoverable =
				status === "deleted" && Number.isFinite(deadlineMs) && deadlineMs > nowMs;

			return {
				id: row.id,
				obraId: row.obra_id,
				obraN: row.obra_n,
				obraName: row.obra_name,
				deleteReason: row.delete_reason,
				deletedAt: row.deleted_at,
				deletedByUserId: row.deleted_by,
				deletedByLabel: resolveActorLabel(
					row.deleted_by,
					row.deleted_by_email,
					user.id,
				),
				restoreDeadlineAt: row.restore_deadline_at,
				recoverable,
				status,
				restoredAt: row.restored_at,
				restoredByUserId: row.restored_by,
				restoredByLabel: resolveActorLabel(
					row.restored_by,
					row.restored_by_email,
					user.id,
				),
				purgedAt: row.purged_at,
				purgedByUserId: row.purged_by,
				purgedByLabel: resolveActorLabel(
					row.purged_by,
					row.purged_by_email,
					user.id,
				),
				purgeJobId: row.purge_job_id,
				purgeReason: row.purge_reason,
				createdAt: row.created_at,
				updatedAt: row.updated_at,
			};
		});

		return NextResponse.json({
			view,
			items,
			total: items.length,
		});
	} catch (error) {
		console.error("[obras:deletes:get]", error);
		const message =
			error instanceof Error ? error.message : "Error al obtener obras eliminadas";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
