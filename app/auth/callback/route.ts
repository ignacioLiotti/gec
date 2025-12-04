import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
	console.log("[AUTH-CALLBACK] GET request received");
	const requestUrl = new URL(request.url);
	const code = requestUrl.searchParams.get("code");
	const origin = requestUrl.origin;
	console.log("[AUTH-CALLBACK] code present:", !!code, "origin:", origin);

	if (code) {
		// Create the redirect response FIRST so we can attach cookies to it
		let redirectUrl = origin;
		const response = NextResponse.redirect(redirectUrl);

		// Create Supabase client that reads from request cookies and writes to response cookies
		const supabase = createServerClient(
			process.env.NEXT_PUBLIC_SUPABASE_URL!,
			process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
			{
				cookies: {
					getAll() {
						return request.cookies.getAll();
					},
					setAll(cookiesToSet) {
						console.log(
							"[AUTH-CALLBACK] Setting cookies on response:",
							cookiesToSet.map((c) => c.name)
						);
						cookiesToSet.forEach(({ name, value, options }) => {
							// Set cookies directly on the response object
							response.cookies.set(name, value, options);
						});
					},
				},
			}
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
				.limit(1);
			console.log("[AUTH-CALLBACK] memberships:", memberships);

			// If no memberships, redirect to onboarding
			if (!memberships || memberships.length === 0) {
				console.log(
					"[AUTH-CALLBACK] No memberships, redirecting to onboarding"
				);
				// Update the redirect URL and create a new response with the same cookies
				const onboardingResponse = NextResponse.redirect(
					`${origin}/onboarding`
				);
				response.cookies.getAll().forEach((cookie) => {
					onboardingResponse.cookies.set(cookie.name, cookie.value);
				});
				return onboardingResponse;
			}
		}

		// Log cookies on the response
		console.log(
			"[AUTH-CALLBACK] Response cookies:",
			response.cookies.getAll().map((c) => c.name)
		);
		console.log("[AUTH-CALLBACK] Redirecting to:", redirectUrl);
		return response;
	}

	// No code, just redirect to home
	console.log("[AUTH-CALLBACK] No code, redirecting to origin:", origin);
	return NextResponse.redirect(origin);
}
