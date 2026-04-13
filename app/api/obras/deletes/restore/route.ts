import { NextResponse } from "next/server";

import { resolveRequestAccessContext } from "@/lib/demo-session";
import { restoreSoftDeletedObra } from "@/lib/obras/delete-lifecycle";

export async function POST(request: Request) {
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
			{ error: "Solo administradores pueden restaurar obras eliminadas." },
			{ status: 403 },
		);
	}

	try {
		const body = await request.json().catch(() => ({}));
		const deleteId = typeof body?.deleteId === "string" ? body.deleteId.trim() : "";
		if (!deleteId) {
			return NextResponse.json({ error: "deleteId requerido." }, { status: 400 });
		}

		const result = await restoreSoftDeletedObra({
			supabase,
			tenantId,
			deleteId,
			actorUserId: user.id,
			actorEmail: user.email ?? null,
		});

		if (!result.ok) {
			if (result.errorCode === "delete_not_found") {
				return NextResponse.json({ error: result.errorMessage }, { status: 404 });
			}
			if (
				result.errorCode === "already_restored" ||
				result.errorCode === "already_purged" ||
				result.errorCode === "restore_window_expired"
			) {
				return NextResponse.json({ error: result.errorMessage }, { status: 409 });
			}
			if (result.errorCode === "obra_not_found") {
				return NextResponse.json({ error: result.errorMessage }, { status: 410 });
			}
			return NextResponse.json({ error: result.errorMessage }, { status: 400 });
		}

		return NextResponse.json({
			ok: true,
			deleteId: result.deleteId,
			obraId: result.obraId,
		});
	} catch (error) {
		console.error("[obras:deletes:restore]", error);
		const message =
			error instanceof Error ? error.message : "Error al restaurar la obra";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
