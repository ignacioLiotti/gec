import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getRouteAccessConfig, type Role } from "./lib/route-access";
import { getClientIp, rateLimitByIp } from "@/lib/security/rate-limit";

const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000001";
const SUPERADMIN_USER_ID = "77b936fb-3e92-4180-b601-15c31125811e";
const rateLimitEnabled =
	(process.env.RATE_LIMIT_IP ?? "120") !== "0" &&
	!!process.env.UPSTASH_REDIS_REST_URL &&
	!!process.env.UPSTASH_REDIS_REST_TOKEN;

const securityHeaders: Record<string, string> = {
	"strict-transport-security": "max-age=63072000; includeSubDomains; preload",
	"x-frame-options": "DENY",
	"x-content-type-options": "nosniff",
	"referrer-policy": "strict-origin-when-cross-origin",
	"content-security-policy":
		"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'self'",
};

function attachSecurityHeaders(res: NextResponse) {
	for (const [key, value] of Object.entries(securityHeaders)) {
		res.headers.set(key, value);
	}
	return res;
}

function enforceCsrf(req: NextRequest) {
	if (!req.nextUrl.pathname.startsWith("/api")) {
		return null;
	}
	const method = req.method?.toUpperCase();
	if (!method || ["GET", "HEAD", "OPTIONS"].includes(method)) {
		return null;
	}
	const fetchSite = req.headers.get("sec-fetch-site");
	if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "same-site") {
		return attachSecurityHeaders(
			new NextResponse(
				JSON.stringify({ error: "Cross-site request blocked" }),
				{
					status: 403,
					headers: { "content-type": "application/json" },
				}
			)
		);
	}
	return null;
}

export async function proxy(req: NextRequest) {
	const csrfFailure = enforceCsrf(req);
	if (csrfFailure) {
		return csrfFailure;
	}

	let rateLimitResult = null;
	if (rateLimitEnabled && req.nextUrl.pathname.startsWith("/api")) {
		const ip = getClientIp(req);
		if (ip) {
			const identifier = `${ip}:${req.nextUrl.pathname}`;
			const result = await rateLimitByIp(identifier);
			if (result.pending) {
				await result.pending;
			}
			if (!result.success) {
				const retryAfter = Math.max(
					1,
					Math.ceil((result.reset - Date.now()) / 1000)
				);
				return attachSecurityHeaders(
					new NextResponse(
						JSON.stringify({
							error:
								"Demasiadas solicitudes desde esta IP. Intentalo de nuevo en breve.",
						}),
						{
							status: 429,
							headers: {
								"content-type": "application/json",
								"retry-after": retryAfter.toString(),
								"x-ratelimit-limit": result.limit.toString(),
								"x-ratelimit-remaining": "0",
								"x-ratelimit-reset": result.reset.toString(),
							},
						}
					)
				);
			}
			rateLimitResult = result;
		}
	}

	const res = NextResponse.next({ request: { headers: req.headers } });
	if (rateLimitResult) {
		res.headers.set("x-ratelimit-limit", rateLimitResult.limit.toString());
		res.headers.set(
			"x-ratelimit-remaining",
			Math.max(rateLimitResult.remaining, 0).toString()
		);
		res.headers.set("x-ratelimit-reset", rateLimitResult.reset.toString());
	}

	const supabase = createServerClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
		{
			cookies: {
				get(name) {
					return req.cookies.get(name)?.value;
				},
				set(name, value, options) {
					res.cookies.set({ name, value, ...options });
				},
				remove(name, options) {
					res.cookies.set({ name, value: "", ...options });
				},
			},
		}
	);

	await supabase.auth.getSession();

	const pathname = req.nextUrl.pathname;
	const config = getRouteAccessConfig(pathname);

	if (!config) {
		return attachSecurityHeaders(res);
	}

	try {
		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) {
			return attachSecurityHeaders(res);
		}

		const { data: profile } = await supabase
			.from("profiles")
			.select("is_superadmin")
			.eq("user_id", user.id)
			.maybeSingle();

		const isSuperAdmin =
			(profile?.is_superadmin ?? false) || user.id === SUPERADMIN_USER_ID;

		const { data: memberships, error: membershipsError } = await supabase
			.from("memberships")
			.select("tenant_id, role")
			.eq("user_id", user.id)
			.order("created_at", { ascending: true });

		if (membershipsError) {
			console.error(
				"Error fetching memberships in middleware:",
				membershipsError
			);
		}

		let resolvedMemberships = memberships;
		if (
			(!resolvedMemberships || resolvedMemberships.length === 0) &&
			isSuperAdmin
		) {
			resolvedMemberships = [{ tenant_id: DEFAULT_TENANT_ID, role: "admin" }];
		}

		const tenantId = resolvedMemberships?.[0]?.tenant_id ?? DEFAULT_TENANT_ID;
		const membershipRole = resolvedMemberships?.[0]?.role;
		const isAdmin =
			membershipRole === "owner" || membershipRole === "admin" || isSuperAdmin;

		if (isSuperAdmin || isAdmin) {
			return attachSecurityHeaders(res);
		}

		const roles: Role[] = [];

		if (tenantId) {
			try {
				const { data: userRoleIds, error: userRoleIdsError } = await supabase
					.from("user_roles")
					.select("role_id")
					.eq("user_id", user.id);

				if (userRoleIdsError?.code === "54001") {
					console.warn(
						"Stack depth limit exceeded in middleware - skipping user_roles query"
					);
				} else if (userRoleIdsError) {
					console.error(
						"Error fetching user role IDs in middleware:",
						userRoleIdsError
					);
				} else if (userRoleIds && userRoleIds.length > 0) {
					const roleIds = userRoleIds.map((ur: any) => ur.role_id);
					const { data: roleDetails, error: roleDetailsError } = await supabase
						.from("roles")
						.select("id, key, name, tenant_id")
						.in("id", roleIds)
						.eq("tenant_id", tenantId);

					if (roleDetailsError) {
						console.error(
							"Error fetching role details in middleware:",
							roleDetailsError
						);
					} else if (roleDetails) {
						const roleKeyMapping: Record<string, Role> = {
							"1": "contable",
							admin: "admin",
							contable: "contable",
						};

						for (const role of roleDetails) {
							const roleKey = role.key;
							if (roleKey) {
								const mappedRole = roleKeyMapping[roleKey] || roleKey;
								if (!roles.includes(mappedRole as Role)) {
									roles.push(mappedRole as Role);
								}
							}
						}
					}
				}
			} catch (error) {
				console.error("Exception fetching user roles in middleware:", error);
			}
		}

		const hasAccess =
			config.allowedRoles.length === 0 ||
			config.allowedRoles.some((role) => roles.includes(role));

		if (!hasAccess) {
			const url = req.nextUrl.clone();
			url.pathname = "/";
			return attachSecurityHeaders(NextResponse.redirect(url));
		}
	} catch (error) {
		console.error("Middleware route access check error:", error);
		return attachSecurityHeaders(res);
	}

	return attachSecurityHeaders(res);
}

export const config = {
	matcher: [
		{
			source:
				"/((?!_next/static|_next/image|favicon.ico|\\.well-known/workflow/.*).*)",
		},
	],
};
