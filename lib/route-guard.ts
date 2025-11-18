"use server";

import { createClient } from "@/utils/supabase/server";
import { getRouteAccessConfig, type Role } from "./route-access";

const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000001";
const SUPERADMIN_USER_ID = "77b936fb-3e92-4180-b601-15c31125811e";

/**
 * Get user roles for the current tenant
 */
export async function getUserRoles(): Promise<{
	roles: Role[];
	isAdmin: boolean;
	isSuperAdmin: boolean;
	tenantId: string | null;
}> {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return {
			roles: [],
			isAdmin: false,
			isSuperAdmin: false,
			tenantId: null,
		};
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
		console.error("Error fetching memberships:", membershipsError);
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

	// Get user roles from the roles table
	const roles: Role[] = [];

	// Add admin role if user is admin or superadmin
	if (isAdmin || isSuperAdmin) {
		if (!roles.includes("admin")) {
			roles.push("admin");
		}
	}

	// Get custom roles assigned to user within tenant (from user_roles table)
	// Split into two queries to avoid RLS circular dependency issues
	if (tenantId) {
		try {
			// Step 1: Get role_ids from user_roles table (simpler query, avoids RLS circular dependency)
			const { data: userRoleIds, error: userRoleIdsError } = await supabase
				.from("user_roles")
				.select("role_id")
				.eq("user_id", user.id);

			// Check for stack depth error (circular RLS dependency)
			if (userRoleIdsError?.code === "54001") {
				console.warn(
					"Stack depth limit exceeded in getUserRoles - skipping user_roles query to prevent recursion"
				);
				// Skip this query and continue with just admin/superadmin roles
			} else if (userRoleIdsError) {
				console.error("Error fetching user role IDs:", userRoleIdsError);
			} else if (userRoleIds && userRoleIds.length > 0) {
				// Step 2: Get role details for those role_ids, filtered by tenant
				const roleIds = userRoleIds.map((ur: any) => ur.role_id);
				const { data: roleDetails, error: roleDetailsError } = await supabase
					.from("roles")
					.select("id, key, tenant_id")
					.in("id", roleIds)
					.eq("tenant_id", tenantId);

				if (roleDetailsError) {
					console.error("Error fetching role details:", roleDetailsError);
				} else if (roleDetails) {
					console.log("[getUserRoles] Found roles:", roleDetails);

					// Map role keys to standardized role names for route access
					// This allows flexibility in database role keys while maintaining consistent route access
					const roleKeyMapping: Record<string, Role> = {
						"1": "contable", // Map '1' to 'contable'
						admin: "admin",
						contable: "contable",
					};

					for (const role of roleDetails as unknown as {
						key: string;
						name: string;
					}[]) {
						const roleKey = role.key;
						if (roleKey) {
							// Map the role key to a standardized role name for route access
							const mappedRole = roleKeyMapping[roleKey] || roleKey;

							// Add the mapped role for route access checking (this is what matters for route protection)
							if (!roles.includes(mappedRole as Role)) {
								roles.push(mappedRole as Role);
								console.log(
									"[getUserRoles] Mapped role key:",
									roleKey,
									"->",
									mappedRole,
									"(name:",
									role.name,
									")"
								);
							}
						}
					}
				}
			} else {
				console.log("[getUserRoles] No user roles found for user:", user.id);
			}
		} catch (error) {
			console.error("Exception fetching user roles:", error);
		}
	}

	// Debug logging (remove in production if needed)
	console.log(
		"[getUserRoles] User:",
		user.id,
		"Roles:",
		roles,
		"isAdmin:",
		isAdmin,
		"isSuperAdmin:",
		isSuperAdmin,
		"tenantId:",
		tenantId
	);

	return {
		roles,
		isAdmin,
		isSuperAdmin,
		tenantId,
	};
}

/**
 * Check if user can access a route
 */
export async function canAccessRoute(path: string): Promise<boolean> {
	const config = getRouteAccessConfig(path);

	// If route is not protected, allow access
	if (!config) {
		return true;
	}

	const { roles, isAdmin, isSuperAdmin } = await getUserRoles();

	// Superadmin and admin always have access
	if (isSuperAdmin || isAdmin) {
		return true;
	}

	// If no roles required, allow access
	if (config.allowedRoles.length === 0) {
		return true;
	}

	// Check if user has any of the required roles
	return config.allowedRoles.some((role) => roles.includes(role));
}
