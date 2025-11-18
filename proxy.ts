import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getRouteAccessConfig, type Role } from "./lib/route-access";

const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000001";
const SUPERADMIN_USER_ID = "77b936fb-3e92-4180-b601-15c31125811e";

export async function proxy(req: NextRequest) {
	const res = NextResponse.next({ request: { headers: req.headers } });

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

	// Refresh the session and capture refreshed tokens into cookies
	await supabase.auth.getSession();

	const pathname = req.nextUrl.pathname;

	// Check if route is protected
	const config = getRouteAccessConfig(pathname);

	// If route is not protected, allow access
	if (!config) {
		return res;
	}

	// For protected routes, check authentication and authorization
	try {
		const {
			data: { user },
		} = await supabase.auth.getUser();

		// If no user, allow through (page will handle auth)
		if (!user) {
			return res;
		}

		// Check if superadmin
		const { data: profile } = await supabase
			.from("profiles")
			.select("is_superadmin")
			.eq("user_id", user.id)
			.maybeSingle();

		const isSuperAdmin =
			(profile?.is_superadmin ?? false) || user.id === SUPERADMIN_USER_ID;

		// Get tenant membership for current user
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

		// Check if admin via membership
		const isAdmin =
			membershipRole === "owner" || membershipRole === "admin" || isSuperAdmin;

		// Superadmin and admin always have access
		if (isSuperAdmin || isAdmin) {
			return res;
		}

		// Get user roles from the roles table (using same logic as route-guard.ts)
		const roles: Role[] = [];

		if (tenantId) {
			try {
				// Step 1: Get role_ids from user_roles table
				const { data: userRoleIds, error: userRoleIdsError } = await supabase
					.from("user_roles")
					.select("role_id")
					.eq("user_id", user.id);

				// Check for stack depth error (circular RLS dependency)
				if (userRoleIdsError?.code === "54001") {
					console.warn(
						"Stack depth limit exceeded in middleware - skipping user_roles query"
					);
					// Skip this query and continue with just admin/superadmin roles
				} else if (userRoleIdsError) {
					console.error(
						"Error fetching user role IDs in middleware:",
						userRoleIdsError
					);
				} else if (userRoleIds && userRoleIds.length > 0) {
					// Step 2: Get role details for those role_ids, filtered by tenant
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
						// Map role keys to standardized role names for route access
						const roleKeyMapping: Record<string, Role> = {
							"1": "contable", // Map '1' to 'contable'
							admin: "admin",
							contable: "contable",
						};

						for (const role of roleDetails) {
							const roleKey = role.key;
							if (roleKey) {
								// Map the role key to a standardized role name for route access
								const mappedRole = roleKeyMapping[roleKey] || roleKey;

								// Add the mapped role for route access checking
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

		// Check if user has any of the required roles
		const hasAccess =
			config.allowedRoles.length === 0 ||
			config.allowedRoles.some((role) => roles.includes(role));

		if (!hasAccess) {
			// Redirect to home page if user doesn't have access
			const url = req.nextUrl.clone();
			url.pathname = "/";
			return NextResponse.redirect(url);
		}
	} catch (error) {
		// If there's an error, log it but allow access to prevent breaking the app
		console.error("Middleware route access check error:", error);
		return res;
	}

	return res;
}

export const config = {
	matcher: [
		{
			source:
				"/((?!_next/static|_next/image|favicon.ico|\\.well-known/workflow/.*).*)",
		},
	],
};
