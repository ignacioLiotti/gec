"use server";

import { createClient } from "@/utils/supabase/server";
import { auth } from "@/lib/auth";
import { getRouteAccessConfig } from "./route-access";
import { resolveTenantMembership } from "@/lib/tenant-selection";

const SUPERADMIN_USER_ID = "77b936fb-3e92-4180-b601-15c31125811e";
const SUPERADMIN_EMAIL = "ignacioliotti@gmail.com";
const DEBUG_AUTH = process.env.DEBUG_AUTH === "true";

export type PermissionLevel = "read" | "edit" | "admin";

type PermissionRelation =
	| { key?: string | null }
	| Array<{ key?: string | null }>
	| null
	| undefined;

type Supabase = Awaited<ReturnType<typeof createClient>>;

function getPermissionRelationKey(value: PermissionRelation) {
	const record = Array.isArray(value) ? value[0] : value;
	return typeof record?.key === "string" ? record.key : null;
}

async function getAuthenticatedUser(supabase: Supabase) {
	const {
		data: { user },
	} = await supabase.auth.getUser();
	return user;
}

function warnSupabaseError(
	context: string,
	error: { code?: string; message?: string } | unknown,
) {
	if (error && typeof error === "object" && ("code" in error || "message" in error)) {
		const typedError = error as { code?: string; message?: string };
		console.warn(context, {
			code: typedError.code,
			message: typedError.message,
		});
		return;
	}
	console.warn(context, error);
}

async function isSuperAdminUser(
	supabase: Awaited<ReturnType<typeof createClient>>,
	user: { id: string; email?: string },
) {
	const { data: profile } = await supabase
		.from("profiles")
		.select("is_superadmin")
		.eq("user_id", user.id)
		.maybeSingle();

	return (
		(profile?.is_superadmin ?? false) ||
		user.id === SUPERADMIN_USER_ID ||
		user.email?.toLowerCase() === SUPERADMIN_EMAIL
	);
}

async function loadUserTenantMemberships(
	supabase: Awaited<ReturnType<typeof createClient>>,
	userId: string,
) {
	const { data, error } = await supabase
		.from("memberships")
		.select("tenant_id, role")
		.eq("user_id", userId)
		.order("created_at", { ascending: true });

	if (error) {
		warnSupabaseError("Could not fetch memberships; using empty set", error);
		return [];
	}

	return (data ?? []) as { tenant_id: string | null; role: string | null }[];
}

/**
 * Get user roles for the current tenant
 */
export async function getUserRoles(): Promise<{
	roles: string[]; // Role names for display
	roleIds: string[];
	isAdmin: boolean;
	isSuperAdmin: boolean;
	tenantId: string | null;
}> {
	const session = await auth();
	if (!session.data.user) {
		return {
			roles: [],
			roleIds: [],
			isAdmin: false,
			isSuperAdmin: false,
			tenantId: null,
		};
	}
	const supabase = await createClient();
	const user = await getAuthenticatedUser(supabase);

	if (!user) {
		return {
			roles: [],
			roleIds: [],
			isAdmin: false,
			isSuperAdmin: false,
			tenantId: null,
		};
	}

	const isSuperAdmin = await isSuperAdminUser(supabase, user);

	// Get tenant membership for current user
	const memberships = await loadUserTenantMemberships(supabase, user.id);

	const { tenantId, activeMembership } = await resolveTenantMembership(
		memberships,
		{ isSuperAdmin }
	);
	const membershipRole = activeMembership?.role;

	// Check if admin via membership
	const isAdmin =
		membershipRole === "owner" || membershipRole === "admin" || isSuperAdmin;

	// Get user roles from the roles table
	const roles: string[] = []; // Role names for display
	const roleIds: string[] = [];
	const roleNameSet = new Set<string>();
	const roleIdSet = new Set<string>();

	// Add admin label if user is admin or superadmin
	if (isAdmin || isSuperAdmin) {
		roleNameSet.add("admin");
		roles.push("admin");
	}

	// Get custom roles assigned to user within tenant (from user_roles table)
	// Split into two queries to avoid RLS circular dependency issues
	if (tenantId && !isAdmin && !isSuperAdmin) {
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
				warnSupabaseError(
					"Could not fetch user role IDs; continuing without custom roles",
					userRoleIdsError,
				);
			} else if (userRoleIds && userRoleIds.length > 0) {
				// Step 2: Get role details for those role_ids, filtered by tenant
				const fetchedRoleIds = (userRoleIds as Array<{ role_id: string }>).map(
					(ur) => ur.role_id,
				);
				const { data: roleDetails, error: roleDetailsError } = await supabase
					.from("roles")
					.select("id, name, tenant_id")
					.in("id", fetchedRoleIds)
					.eq("tenant_id", tenantId);

					if (roleDetailsError) {
						warnSupabaseError(
							"Could not fetch role details; continuing without custom roles",
							roleDetailsError,
						);
					} else if (roleDetails) {
						if (DEBUG_AUTH) {
							console.log("[getUserRoles] Found roles:", roleDetails);
						}

					for (const role of roleDetails as unknown as {
						id: string;
						name: string;
					}[]) {
						// Track role ID
						if (role.id && !roleIdSet.has(role.id)) {
							roleIdSet.add(role.id);
							roleIds.push(role.id);
						}
						// Track role name for display
						if (role.name && !roleNameSet.has(role.name)) {
							roleNameSet.add(role.name);
							roles.push(role.name);
						}
					}
				}
				} else {
					if (DEBUG_AUTH) {
						console.log("[getUserRoles] No user roles found for user:", user.id);
					}
				}
			} catch (error) {
				warnSupabaseError(
					"Unexpected error fetching user roles; continuing without custom roles",
					error,
				);
			}
		}

		if (DEBUG_AUTH) {
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
		}

	return {
		roles,
		roleIds,
		isAdmin,
		isSuperAdmin,
		tenantId,
	};
}

/**
 * Check if user can access a route
 */
export async function canAccessRoute(path: string): Promise<boolean> {
	const session = await auth();
	if (!session.data.user) {
		return false;
	}
	const supabase = await createClient();
	const user = await getAuthenticatedUser(supabase);

	if (!user) {
		return false;
	}

	const config = getRouteAccessConfig(path);

	// If route is not protected, allow access for authenticated users.
	if (!config) {
		return true;
	}

	const { isAdmin, isSuperAdmin } = await getUserRoles();

	// Superadmin and admin always have access
	if (isSuperAdmin || isAdmin) {
		return true;
	}

	if (config.requiredPermissions?.length) {
		const permissionResults = await Promise.all(
			config.requiredPermissions.map((permissionKey) =>
				hasPermission(permissionKey)
			)
		);
		return permissionResults.every(Boolean);
	}

	// If no roles required, allow access (most routes). Fine-grained access is
	// controlled via sidebar_macro_tables and macro_table_permissions.
	if (config.allowedRoles.length > 0) {
		return false;
	}

	return true;
}

/**
 * Check if user can access a macro table with a specific permission level
 */
export async function canAccessMacroTable(
	macroTableId: string,
	requiredLevel: PermissionLevel
): Promise<boolean> {
	const session = await auth();
	if (!session.data.user) {
		return false;
	}
	const supabase = await createClient();
	const user = await getAuthenticatedUser(supabase);

	if (!user) {
		return false;
	}

	// Get the macro table's tenant
	const { data: macroTable } = await supabase
		.from("macro_tables")
		.select("tenant_id")
		.eq("id", macroTableId)
		.single();

	if (!macroTable) {
		return false;
	}

	const tenantId = macroTable.tenant_id;

	const isSuperAdmin = await isSuperAdminUser(supabase, user);

	if (isSuperAdmin) {
		return true;
	}

	// Check if tenant admin
	const { data: membership } = await supabase
		.from("memberships")
		.select("role")
		.eq("user_id", user.id)
		.eq("tenant_id", tenantId)
		.single();

	if (!membership) {
		return false; // Not a member of this tenant
	}

	const isAdmin = membership.role === "owner" || membership.role === "admin";
	if (isAdmin) {
		return true;
	}

	// Define level hierarchy (admin > edit > read)
	const levelOrder: Record<PermissionLevel, number> = {
		read: 1,
		edit: 2,
		admin: 3,
	};
	const requiredOrder = levelOrder[requiredLevel];

	// Check direct user permission
	const { data: userPerm } = await supabase
		.from("macro_table_permissions")
		.select("permission_level")
		.eq("macro_table_id", macroTableId)
		.eq("user_id", user.id)
		.maybeSingle();

	if (userPerm) {
		const userLevel = levelOrder[userPerm.permission_level as PermissionLevel] || 0;
		if (userLevel >= requiredOrder) {
			return true;
		}
	}

	// Check through roles
	const { data: userRoles, error: userRolesError } = await supabase
		.from("user_roles")
		.select("role_id")
		.eq("user_id", user.id);

	if (userRolesError) {
		warnSupabaseError(
			"Could not fetch macro table user roles; denying macro table access",
			userRolesError,
		);
		return false;
	}

	if (userRoles && userRoles.length > 0) {
		const roleIds = userRoles.map((ur) => ur.role_id);

		const { data: rolePerms, error: rolePermsError } = await supabase
			.from("macro_table_permissions")
			.select("permission_level")
			.eq("macro_table_id", macroTableId)
			.in("role_id", roleIds);

		if (rolePermsError) {
			warnSupabaseError(
				"Could not fetch macro table role permissions; denying macro table access",
				rolePermsError,
			);
			return false;
		}

		if (rolePerms && rolePerms.length > 0) {
			const maxRoleLevel = Math.max(
				...rolePerms.map(
					(rp) => levelOrder[rp.permission_level as PermissionLevel] || 0
				)
			);
			if (maxRoleLevel >= requiredOrder) {
				return true;
			}
		}
	}

	return false;
}

/**
 * Check if user has a specific permission key
 */
export async function hasPermission(permissionKey: string): Promise<boolean> {
	const session = await auth();
	if (!session.data.user) {
		return false;
	}
	const supabase = await createClient();
	const user = await getAuthenticatedUser(supabase);

	if (!user) {
		return false;
	}

	const isSuperAdmin = await isSuperAdminUser(supabase, user);

	if (isSuperAdmin) {
		return true;
	}

	// Get current tenant
	const memberships = await loadUserTenantMemberships(supabase, user.id);

	if (!memberships || memberships.length === 0) {
		return false;
	}

	const { tenantId, activeMembership } = await resolveTenantMembership(
		memberships,
		{ isSuperAdmin }
	);

	if (!tenantId) {
		return false;
	}

	// Check if tenant admin (has all permissions)
	const isAdmin =
		activeMembership?.role === "owner" || activeMembership?.role === "admin";
	if (isAdmin) {
		return true;
	}

	// Check direct user permission override
	const { data: override, error: overrideError } = await supabase
		.from("user_permission_overrides")
		.select("is_granted, permissions!inner(key)")
		.eq("user_id", user.id)
		.eq("permissions.key", permissionKey)
		.maybeSingle();

	if (overrideError) {
		warnSupabaseError(
			"Could not fetch user permission override; continuing without override",
			overrideError,
		);
	}

	if (override?.is_granted) {
		return true;
	}

	// Check through roles
	const { data: userRoles, error: userRolesError } = await supabase
		.from("user_roles")
		.select("role_id, roles!inner(tenant_id)")
		.eq("user_id", user.id)
		.eq("roles.tenant_id", tenantId);

	if (userRolesError) {
		warnSupabaseError(
			"Could not fetch permission user roles; denying permission",
			userRolesError,
		);
		return false;
	}

	if (userRoles && userRoles.length > 0) {
		const roleIds = userRoles.map((ur) => ur.role_id);

		const { data: rolePerms, error: rolePermsError } = await supabase
			.from("role_permissions")
			.select("permissions!inner(key)")
			.in("role_id", roleIds)
			.eq("permissions.key", permissionKey);

		if (rolePermsError) {
			warnSupabaseError(
				"Could not fetch role permissions; denying permission",
				rolePermsError,
			);
			return false;
		}

		if (rolePerms && rolePerms.length > 0) {
			return true;
		}
	}

	return false;
}

/**
 * Get all permission keys the user has
 */
export async function getUserPermissionKeys(): Promise<string[]> {
	const session = await auth();
	if (!session.data.user) {
		return [];
	}
	const { isAdmin, isSuperAdmin, tenantId } = await getUserRoles();

	if (!tenantId) {
		return [];
	}

	const supabase = await createClient();
	const user = await getAuthenticatedUser(supabase);

	if (!user) {
		return [];
	}

	// If admin/superadmin, get all permissions
	if (isAdmin || isSuperAdmin) {
		const { data: allPerms } = await supabase
			.from("permissions")
			.select("key");
		return (allPerms ?? []).map((p) => p.key);
	}

	const permissionKeys = new Set<string>();

	// Get direct overrides
	const { data: overrides, error: overridesError } = await supabase
		.from("user_permission_overrides")
		.select("permissions(key)")
		.eq("user_id", user.id)
		.eq("is_granted", true);

	if (overridesError) {
		warnSupabaseError(
			"Could not fetch permission overrides; continuing without overrides",
			overridesError,
		);
	}

	for (const o of overrides ?? []) {
		const key = getPermissionRelationKey(o.permissions as PermissionRelation);
		if (key) {
			permissionKeys.add(key);
		}
	}

	// Get role permissions
	const { data: userRoles, error: userRolesError } = await supabase
		.from("user_roles")
		.select("role_id, roles!inner(tenant_id)")
		.eq("user_id", user.id)
		.eq("roles.tenant_id", tenantId);

	if (userRolesError) {
		warnSupabaseError(
			"Could not fetch permission key user roles; returning direct permissions only",
			userRolesError,
		);
		return Array.from(permissionKeys);
	}

	if (userRoles && userRoles.length > 0) {
		const roleIds = userRoles.map((ur) => ur.role_id);

		const { data: rolePerms, error: rolePermsError } = await supabase
			.from("role_permissions")
			.select("permissions(key)")
			.in("role_id", roleIds);

		if (rolePermsError) {
			warnSupabaseError(
				"Could not fetch permission keys from roles; returning direct permissions only",
				rolePermsError,
			);
			return Array.from(permissionKeys);
		}

		for (const rp of rolePerms ?? []) {
			const key = getPermissionRelationKey(rp.permissions as PermissionRelation);
			if (key) {
				permissionKeys.add(key);
			}
		}
	}

	return Array.from(permissionKeys);
}
