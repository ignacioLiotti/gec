import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";

import { createClient } from "@/utils/supabase/server";
import {
	hasDemoCapability,
	resolveRequestAccessContext,
} from "@/lib/demo-session";
import { resolveTenantMembership } from "@/lib/tenant-selection";
import { fetchTenantPlan } from "@/lib/subscription-plans";
import { fetchTenantUsage } from "@/lib/tenant-usage";

const SUPERADMIN_USER_ID = "77b936fb-3e92-4180-b601-15c31125811e";

type MembershipRow = { tenant_id: string | null; role: string | null };
type TenantSupabase =
	| Awaited<ReturnType<typeof createClient>>
	| Awaited<ReturnType<typeof resolveRequestAccessContext>>["supabase"];

type TenantContext =
	| { supabase: TenantSupabase; user: User; tenantId: string; isSuperAdmin: boolean }
	| { error: { status: number; message: string } };

async function resolveTenantContext(
	supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<TenantContext> {
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return { error: { status: 401, message: "Inicia sesion para continuar." } };
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
		{ isSuperAdmin },
	);

	if (!tenantId) {
		return {
			error: {
				status: 403,
				message: "No pudimos resolver tu organizacion activa.",
			},
		};
	}

	return { supabase, user, tenantId, isSuperAdmin };
}

async function resolveTenantContextWithDemo(): Promise<TenantContext> {
	const access = await resolveRequestAccessContext();
	if (access.actorType === "demo") {
		if (!hasDemoCapability(access.demoSession, "excel")) {
			return { error: { status: 403, message: "Esta demo no permite usar Excel." } };
		}
		if (!access.tenantId || !access.user) {
			return { error: { status: 403, message: "No pudimos resolver la organizacion demo." } };
		}
		return {
			supabase: access.supabase,
			user: access.user,
			tenantId: access.tenantId,
			isSuperAdmin: false,
		};
	}

	const supabase = await createClient();
	return resolveTenantContext(supabase);
}

export async function GET() {
	const context = await resolveTenantContextWithDemo();

	if ("error" in context) {
		return NextResponse.json(
			{ error: context.error.message },
			{ status: context.error.status },
		);
	}

	const [plan, usage] = await Promise.all([
		fetchTenantPlan(context.supabase, context.tenantId),
		fetchTenantUsage(context.supabase, context.tenantId),
	]);

	return NextResponse.json({
		tenantId: context.tenantId,
		plan,
		usage,
	});
}

export async function POST() {
	return NextResponse.json(
		{
			error:
				"Los ajustes manuales de consumo desde cliente fueron deshabilitados. Usa endpoints de servidor.",
		},
		{ status: 405 },
	);
}
