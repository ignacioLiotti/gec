import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/utils/supabase/server";
import { resolveTenantMembership } from "@/lib/tenant-selection";
import { fetchTenantPlan } from "@/lib/subscription-plans";
import {
	fetchTenantUsage,
	incrementTenantUsage,
	logTenantUsageEvent,
	type UsageDelta,
} from "@/lib/tenant-usage";

const SUPERADMIN_USER_ID = "77b936fb-3e92-4180-b601-15c31125811e";

type MembershipRow = { tenant_id: string | null; role: string | null };

async function resolveTenantContext(supabase: Awaited<ReturnType<typeof createClient>>) {
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return { error: { status: 401, message: "Iniciá sesión para continuar." } } as const;
	}

	const { data: memberships } = await supabase
		.from("memberships")
		.select("tenant_id, role")
		.eq("user_id", user.id)
		.order("created_at", { ascending: true });

	const { data: profile } = await supabase
		.from("profiles")
		.select("is_superadmin")
		.eq("user_id", user.id)
		.maybeSingle();

	const isSuperAdmin =
		(profile?.is_superadmin ?? false) || user.id === SUPERADMIN_USER_ID;

	const { tenantId } = await resolveTenantMembership(
		(memberships ?? []) as MembershipRow[],
		{ isSuperAdmin }
	);

	if (!tenantId) {
		return {
			error: {
				status: 403,
				message: "No pudimos resolver tu organización activa.",
			},
		} as const;
	}

	return { user, tenantId, isSuperAdmin } as const;
}

export async function GET() {
	const supabase = await createClient();
	const context = await resolveTenantContext(supabase);

	if ("error" in context) {
		return NextResponse.json(
			{ error: context.error.message },
			{ status: context.error.status }
		);
	}

	const [plan, usage] = await Promise.all([
		fetchTenantPlan(supabase, context.tenantId),
		fetchTenantUsage(supabase, context.tenantId),
	]);

	return NextResponse.json({
		tenantId: context.tenantId,
		plan,
		usage,
	});
}

export async function POST(request: NextRequest) {
	const supabase = await createClient();
	const context = await resolveTenantContext(supabase);

	if ("error" in context) {
		return NextResponse.json(
			{ error: context.error.message },
			{ status: context.error.status }
		);
	}

	let payload: {
		storageBytesDelta?: unknown;
		aiTokensDelta?: unknown;
		whatsappMessagesDelta?: unknown;
		reason?: unknown;
		metadata?: unknown;
	} | null = null;
	try {
		payload = await request.json();
	} catch {
		// Ignore, we'll validate below
	}

	if (!payload) {
		return NextResponse.json(
			{ error: "No se envió ningún ajuste de uso." },
			{ status: 400 }
		);
	}

	const deltas: UsageDelta = {
		storageBytes: Number(payload.storageBytesDelta ?? 0) || 0,
		aiTokens: Number(payload.aiTokensDelta ?? 0) || 0,
		whatsappMessages: Number(payload.whatsappMessagesDelta ?? 0) || 0,
	};
	const reason =
		typeof payload.reason === "string" && payload.reason.length > 0
			? payload.reason
			: null;
	const metadata =
		payload.metadata && typeof payload.metadata === "object"
			? (payload.metadata as Record<string, unknown>)
			: undefined;

	if (
		!Number.isFinite(deltas.storageBytes ?? 0) ||
		!Number.isFinite(deltas.aiTokens ?? 0) ||
		!Number.isFinite(deltas.whatsappMessages ?? 0)
	) {
		return NextResponse.json(
			{ error: "Los ajustes enviados no son válidos." },
			{ status: 400 }
		);
	}

	if (
		(deltas.storageBytes ?? 0) === 0 &&
		(deltas.aiTokens ?? 0) === 0 &&
		(deltas.whatsappMessages ?? 0) === 0
	) {
		return NextResponse.json(
			{ error: "No se especificaron cambios en el uso." },
			{ status: 400 }
		);
	}

	const plan = await fetchTenantPlan(supabase, context.tenantId);

	try {
		const usage = await incrementTenantUsage(
			supabase,
			context.tenantId,
			deltas,
			plan.limits
		);

		await Promise.all(
			[
				{ kind: "storage_bytes" as const, delta: deltas.storageBytes },
				{ kind: "ai_tokens" as const, delta: deltas.aiTokens },
				{ kind: "whatsapp_messages" as const, delta: deltas.whatsappMessages },
			]
				.filter((item) => (item.delta ?? 0) !== 0)
				.map((item) =>
					logTenantUsageEvent(supabase, {
						tenantId: context.tenantId,
						kind: item.kind,
						amount: item.delta ?? 0,
						context: reason ?? "api_adjustment",
						metadata,
					})
				)
		);

		return NextResponse.json({
			ok: true,
			plan,
			usage,
		});
	} catch (error) {
		const err = error as Error & { code?: string };
		const limitErrors = new Set([
			"storage_limit_exceeded",
			"ai_limit_exceeded",
			"whatsapp_limit_exceeded",
		]);
		const status = limitErrors.has(err.code ?? "")
			? 402
			: err.code === "insufficient_privilege"
				? 403
				: 400;

		return NextResponse.json(
			{ error: err.message || "No se pudo actualizar el uso." },
			{ status }
		);
	}
}
