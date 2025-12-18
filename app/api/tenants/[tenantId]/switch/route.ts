import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/utils/supabase/server";
import { ACTIVE_TENANT_COOKIE } from "@/lib/tenant-selection";

const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function canSwitchTenant(
	supabase: Awaited<ReturnType<typeof createClient>>,
	userId: string,
	tenantId: string
) {
	const { data: membership } = await supabase
		.from("memberships")
		.select("tenant_id")
		.eq("tenant_id", tenantId)
		.eq("user_id", userId)
		.maybeSingle();

	if (membership) {
		return true;
	}

	const { data: profile } = await supabase
		.from("profiles")
		.select("is_superadmin")
		.eq("user_id", userId)
		.maybeSingle();

	return Boolean(profile?.is_superadmin);
}

function setTenantCookie(response: NextResponse, tenantId: string) {
	response.cookies.set(ACTIVE_TENANT_COOKIE, tenantId, {
		path: "/",
		maxAge: 60 * 60 * 24 * 30,
		sameSite: "lax",
	});
	return response;
}

type RouteParams = Promise<{ tenantId: string }>;

export async function POST(
	req: NextRequest,
	{ params }: { params: RouteParams }
) {
	const tenantId = (await params).tenantId;

	if (!tenantId || !UUID_PATTERN.test(tenantId)) {
		return NextResponse.json({ success: false }, { status: 400 });
	}

	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return NextResponse.json({ success: false }, { status: 401 });
	}

	const allowed = await canSwitchTenant(supabase, user.id, tenantId);
	console.log("[tenant-switch][GET]", {
		userId: user.id,
		tenantId,
		allowed,
	});
	console.log("[tenant-switch][POST]", {
		userId: user.id,
		tenantId,
		allowed,
	});
	if (!allowed) {
		return NextResponse.json({ success: false }, { status: 403 });
	}

	const response = NextResponse.json({ success: true });
	return setTenantCookie(response, tenantId);
}

export async function GET(
	req: NextRequest,
	{ params }: { params: RouteParams }
) {
	const tenantId = (await params).tenantId;
	const origin = new URL("/", req.url);

	if (!tenantId || !UUID_PATTERN.test(tenantId)) {
		return NextResponse.redirect(origin);
	}

	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return NextResponse.redirect(origin);
	}

	const allowed = await canSwitchTenant(supabase, user.id, tenantId);

	if (!allowed) {
		return NextResponse.redirect(new URL("/onboarding", req.url));
	}

	const response = NextResponse.redirect(new URL("/excel", req.url));
	return setTenantCookie(response, tenantId);
}
