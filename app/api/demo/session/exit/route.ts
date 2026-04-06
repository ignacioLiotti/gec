import { NextResponse } from "next/server";

import { DEMO_SESSION_COOKIE } from "@/lib/demo-session";
import { ACTIVE_TENANT_COOKIE } from "@/lib/tenant-selection";

export async function POST() {
	const response = NextResponse.json({ ok: true });

	response.cookies.set(DEMO_SESSION_COOKIE, "", {
		path: "/",
		httpOnly: true,
		sameSite: "lax",
		secure: process.env.NODE_ENV === "production",
		maxAge: 0,
	});

	response.cookies.set(ACTIVE_TENANT_COOKIE, "", {
		path: "/",
		httpOnly: true,
		sameSite: "lax",
		secure: process.env.NODE_ENV === "production",
		maxAge: 0,
	});

	return response;
}
