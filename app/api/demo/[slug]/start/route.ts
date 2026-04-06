import { NextResponse } from "next/server";

import {
	buildDemoSessionCookieValue,
	DEMO_SESSION_COOKIE,
	validateDemoLinkAccess,
} from "@/lib/demo-session";
import { ACTIVE_TENANT_COOKIE } from "@/lib/tenant-selection";
import { getDemoLaunchPath } from "@/lib/demo-flows/runtime";

export async function GET(
	request: Request,
	{ params }: { params: Promise<{ slug: string }> },
) {
	const { slug } = await params;
	const url = new URL(request.url);
	const token = String(url.searchParams.get("token") ?? "").trim();

	if (!slug || !token) {
		return NextResponse.redirect(
			new URL(`/demo/${slug}?error=missing-token`, request.url),
		);
	}

	const validation = await validateDemoLinkAccess(slug, token);
	if (!validation.ok) {
		return NextResponse.redirect(
			new URL(`/demo/${slug}?error=${validation.reason}`, request.url),
		);
	}
	const demoLink = validation.link;
	const targetPath = await getDemoLaunchPath(slug, demoLink.tenant_id);

	const response = NextResponse.redirect(new URL(targetPath, request.url));
	const secure = process.env.NODE_ENV === "production";

	response.cookies.set(
		DEMO_SESSION_COOKIE,
		buildDemoSessionCookieValue(slug, token),
		{
			httpOnly: true,
			path: "/",
			sameSite: "lax",
			secure,
			maxAge: 60 * 60 * 24 * 7,
		},
	);
	response.cookies.set(ACTIVE_TENANT_COOKIE, demoLink.tenant_id, {
		httpOnly: true,
		path: "/",
		sameSite: "lax",
		secure,
		maxAge: 60 * 60 * 24 * 7,
	});

	return response;
}
