import { NextResponse } from "next/server";
import { emitEvent, expandEffectsForEvent } from "@/lib/notifications/engine";
import "@/lib/notifications/rules";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";
import { createClient as createServerRlsClient } from "@/utils/supabase/server";

export async function POST(request: Request) {
	try {
		const body = await request.json();
		const eventType = String(body?.type ?? "");
		const ctx = (body?.ctx ?? {}) as Record<string, unknown>;
		if (!eventType)
			return NextResponse.json({ error: "type required" }, { status: 400 });

		const workflowsEnabled =
			process.env.NODE_ENV === "production" &&
			process.env.WORKFLOWS_DISABLED !== "1";
		if (workflowsEnabled) {
			await emitEvent(eventType, ctx);
			return NextResponse.json({ ok: true });
		}

		const effects = await expandEffectsForEvent(eventType, ctx as any);
		if (!effects.length) return NextResponse.json({ ok: true });

		const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
		const now = Date.now();
		let inserted = 0;
		if (serviceKey) {
			const admin = createSupabaseAdminClient();
			for (const eff of effects) {
				if (eff.channel !== "in-app") continue;
				const at =
					typeof eff.when === "function" ? eff.when(eff.ctx) : eff.when;
				const shouldDeliver =
					at === "now" || (at instanceof Date && at.getTime() <= now);
				if (!shouldDeliver) continue;
				const { error } = await admin.from("notifications").insert({
					user_id: eff.recipientId,
					tenant_id: (eff.ctx?.tenantId as string | null) ?? null,
					title: eff.title?.(eff.ctx) ?? "",
					body: eff.body?.(eff.ctx) ?? null,
					type: eff.type ?? "info",
					action_url: eff.actionUrl?.(eff.ctx) ?? null,
					pendiente_id: (eff.ctx?.pendienteId as string | null) ?? null,
					data: eff.data?.(eff.ctx) ?? {},
				});
				if (!error) inserted++;
			}
			return NextResponse.json({ ok: true, delivered: true, inserted });
		} else {
			// Fallback: use server RLS client. Only works when recipientId matches current auth user.
			const rls = await createServerRlsClient();
			const { data: userRes } = await rls.auth.getUser();
			const authedUserId = userRes.user?.id ?? null;
			if (!authedUserId)
				return NextResponse.json(
					{ error: "Not authenticated" },
					{ status: 401 }
				);
			for (const eff of effects) {
				if (eff.channel !== "in-app") continue;
				if (eff.recipientId !== authedUserId) continue;
				const at =
					typeof eff.when === "function" ? eff.when(eff.ctx) : eff.when;
				const shouldDeliver =
					at === "now" || (at instanceof Date && at.getTime() <= now);
				if (!shouldDeliver) continue;
				const { error } = await rls.from("notifications").insert({
					user_id: authedUserId,
					tenant_id: (eff.ctx?.tenantId as string | null) ?? null,
					title: eff.title?.(eff.ctx) ?? "",
					body: eff.body?.(eff.ctx) ?? null,
					type: eff.type ?? "info",
					action_url: eff.actionUrl?.(eff.ctx) ?? null,
					pendiente_id: (eff.ctx?.pendienteId as string | null) ?? null,
					data: eff.data?.(eff.ctx) ?? {},
				});
				if (!error) inserted++;
			}
			return NextResponse.json({ ok: true, delivered: true, inserted });
		}
	} catch (e: any) {
		return NextResponse.json(
			{ error: e?.message ?? "failed" },
			{ status: 500 }
		);
	}
}
