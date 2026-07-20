import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { ACTIVE_TENANT_COOKIE } from "@/lib/tenant-selection";
import { resolveTenantSwitchRedirect } from "@/lib/tenant-switch-redirect";

const domainSplitEnabled =
	process.env.ENABLE_DOMAIN_SPLIT === "true" &&
	(process.env.VERCEL_ENV !== "preview" ||
		process.env.ENABLE_DOMAIN_SPLIT_PREVIEW === "true");
const appHost = process.env.APP_HOST?.toLowerCase();
const marketingHost = process.env.MARKETING_HOST?.toLowerCase();

function applyDomainSplitHost(request: NextRequest, target: URL) {
	if (!domainSplitEnabled || !appHost || !marketingHost) {
		return target;
	}
	const currentHost = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "")
		.split(",")[0]
		.trim()
		.toLowerCase();
	if (currentHost !== marketingHost) {
		return target;
	}
	target.host = appHost;
	const forwardedProto = request.headers.get("x-forwarded-proto");
	if (forwardedProto === "http" || forwardedProto === "https") {
		target.protocol = `${forwardedProto}:`;
	}
	return target;
}

export async function GET(request: NextRequest) {
	const requestUrl = new URL(request.url);
	const code = requestUrl.searchParams.get("code");
	const origin = requestUrl.origin;
	const nextParam = requestUrl.searchParams.get("next");
	const safeNextUrl = resolveTenantSwitchRedirect(request.url, nextParam, "/dashboard");
	const safeNextPath = `${safeNextUrl.pathname}${safeNextUrl.search}${safeNextUrl.hash}`;

	if (code) {
		// Create the redirect response FIRST so we can attach cookies to it
		let redirectUrl = `${origin}${safeNextPath}`;
		const response = NextResponse.redirect(
			applyDomainSplitHost(request, new URL(redirectUrl)),
		);

		// Create Supabase client that reads from request cookies and writes to response cookies
		const supabase = createServerClient(
			process.env.NEXT_PUBLIC_SUPABASE_URL!,
			process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
			{
				cookies: {
					getAll() {
						return request.cookies.getAll();
					},
					setAll(
						cookiesToSet: {
							name: string;
							value: string;
							options: CookieOptions;
						}[],
					) {
						cookiesToSet.forEach(({ name, value, options }) => {
							// Set cookies directly on the response object
							response.cookies.set(name, value, options);
						});
					},
				},
			},
		);

		const { error } = await supabase.auth.exchangeCodeForSession(code);

		if (error) {
			console.error("[AUTH-CALLBACK] exchangeCodeForSession error:", error);
			return NextResponse.redirect(`${origin}/?error=auth_failed`);
		}
		// Check if user has completed onboarding (has tenant membership)
		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (user) {
			const { data: memberships } = await supabase
				.from("memberships")
				.select("tenant_id")
				.eq("user_id", user.id)
				.order("created_at", { ascending: true })
				.limit(1);
			// If no memberships, redirect to onboarding unless auth flow requested
			// a safe internal return path (e.g. invitation acceptance page).
			if (!memberships || memberships.length === 0) {
				const target =
					safeNextUrl.pathname.startsWith("/invitations/")
						? `${origin}${safeNextPath}`
						: `${origin}/onboarding`;
				response.headers.set(
					"Location",
					applyDomainSplitHost(request, new URL(target)).toString(),
				);
				return response;
			}

			const tenantId = memberships[0]?.tenant_id;
			if (tenantId) {
				response.cookies.set(ACTIVE_TENANT_COOKIE, tenantId, {
					path: "/",
					maxAge: 60 * 60 * 24 * 30,
					sameSite: "lax",
				});
				redirectUrl = safeNextPath ? `${origin}${safeNextPath}` : `${origin}/dashboard`;
			}
		}

		response.headers.set(
			"Location",
			applyDomainSplitHost(request, new URL(redirectUrl)).toString(),
		);
		return response;
	}

	// No code, just redirect to home
	return NextResponse.redirect(origin);
}
