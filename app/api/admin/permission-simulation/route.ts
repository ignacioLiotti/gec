import { NextRequest, NextResponse } from "next/server";

import {
	buildPermissionSimulationCookieValue,
	normalizePermissionSimulationKeys,
	PERMISSION_SIMULATION_COOKIE,
} from "@/lib/permission-simulation";
import { isSuperAdminUser } from "@/lib/superadmin";
import { createClient } from "@/utils/supabase/server";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 8;

async function readJsonPayload(request: NextRequest) {
	try {
		return (await request.json()) as {
			active?: unknown;
			permissionKeys?: unknown;
		};
	} catch {
		return {};
	}
}

export async function POST(request: NextRequest) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { data: profile } = await supabase
		.from("profiles")
		.select("is_superadmin")
		.eq("user_id", user.id)
		.maybeSingle();

	const isSuperAdmin = isSuperAdminUser(
		user.id,
		profile?.is_superadmin,
		user.email,
	);

	if (!isSuperAdmin) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	const payload = await readJsonPayload(request);
	const response = NextResponse.json({ ok: true });

	if (payload.active === false) {
		response.cookies.set(PERMISSION_SIMULATION_COOKIE, "", {
			httpOnly: true,
			sameSite: "lax",
			secure: process.env.NODE_ENV === "production",
			path: "/",
			maxAge: 0,
		});
		return response;
	}

	const requestedKeys = normalizePermissionSimulationKeys(payload.permissionKeys);
	let permissionKeys = requestedKeys;

	if (requestedKeys.length > 0) {
		const { data: allowedPermissions } = await supabase
			.from("permissions")
			.select("key")
			.in("key", requestedKeys);
		const allowedKeySet = new Set(
			(allowedPermissions ?? []).map((permission) => permission.key),
		);
		permissionKeys = requestedKeys.filter((key) => allowedKeySet.has(key));
	}

	response.cookies.set(
		PERMISSION_SIMULATION_COOKIE,
		buildPermissionSimulationCookieValue(permissionKeys),
		{
			httpOnly: true,
			sameSite: "lax",
			secure: process.env.NODE_ENV === "production",
			path: "/",
			maxAge: COOKIE_MAX_AGE_SECONDS,
		},
	);

	return response;
}
