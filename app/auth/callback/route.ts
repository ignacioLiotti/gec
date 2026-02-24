import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { ACTIVE_TENANT_COOKIE } from "@/lib/tenant-selection";

const domainSplitEnabled = process.env.ENABLE_DOMAIN_SPLIT === "true";
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
	console.log("[AUTH-CALLBACK] GET request received");
	const requestUrl = new URL(request.url);
	const code = requestUrl.searchParams.get("code");
	const origin = requestUrl.origin;
	const nextParam = requestUrl.searchParams.get("next");
	const safeNextPath =
		nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")
			? nextParam
			: null;
	console.log("[AUTH-CALLBACK] code present:", !!code, "origin:", origin);

	if (code) {
		// Create the redirect response FIRST so we can attach cookies to it
		let redirectUrl = safeNextPath ? `${origin}${safeNextPath}` : `${origin}/dashboard`;
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
						console.log(
							"[AUTH-CALLBACK] Setting cookies on response:",
							cookiesToSet.map((c) => c.name),
						);
						cookiesToSet.forEach(({ name, value, options }) => {
							// Set cookies directly on the response object
							response.cookies.set(name, value, options);
						});
					},
				},
			},
		);

		console.log("[AUTH-CALLBACK] Calling exchangeCodeForSession...");
		const { error } = await supabase.auth.exchangeCodeForSession(code);

		if (error) {
			console.error("[AUTH-CALLBACK] exchangeCodeForSession error:", error);
			return NextResponse.redirect(`${origin}/?error=auth_failed`);
		}
		console.log("[AUTH-CALLBACK] exchangeCodeForSession successful");

		// Check if user has completed onboarding (has tenant membership)
		console.log("[AUTH-CALLBACK] Calling getUser...");
		const {
			data: { user },
		} = await supabase.auth.getUser();
		console.log("[AUTH-CALLBACK] getUser result:", {
			hasUser: !!user,
			email: user?.email,
		});

		if (user) {
			const { data: memberships } = await supabase
				.from("memberships")
				.select("tenant_id")
				.eq("user_id", user.id)
				.order("created_at", { ascending: true })
				.limit(1);
			console.log("[AUTH-CALLBACK] memberships:", memberships);

			// If no memberships, redirect to onboarding unless auth flow requested
			// a safe internal return path (e.g. invitation acceptance page).
			if (!memberships || memberships.length === 0) {
				console.log(
					"[AUTH-CALLBACK] No memberships, redirecting to onboarding",
				);
				const target =
					safeNextPath && safeNextPath.startsWith("/invitations/")
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

		// Log cookies on the response
		console.log(
			"[AUTH-CALLBACK] Response cookies:",
			response.cookies.getAll().map((c) => c.name),
		);
		response.headers.set(
			"Location",
			applyDomainSplitHost(request, new URL(redirectUrl)).toString(),
		);
		console.log("[AUTH-CALLBACK] Redirecting to:", redirectUrl);
		return response;
	}

	// No code, just redirect to home
	console.log("[AUTH-CALLBACK] No code, redirecting to origin:", origin);
	return NextResponse.redirect(origin);
}
