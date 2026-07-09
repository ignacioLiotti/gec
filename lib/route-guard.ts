"use server";

/**
 * Server-side route authorization: resolves the acting user (auth session,
 * superadmin flag, tenant membership, permission-simulation cookie) against
 * the declarative rules in `lib/route-access.ts`.
 *
 * This is the enforcement layer for page/route access — client hooks like
 * `useTenantAdminStatus` only mirror it for UI visibility. Permission
 * simulation (ADR 0024) can narrow but never widen effective permissions.
 * Changes here affect authorization across the entire app; read
 * `docs/obsidian-brain/31 - RLS & Security Policies.md` and the permission
 * ADRs (0012, 0016, 0023, 0024, 0028, 0029) first.
 */
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { auth } from "@/lib/auth";
import { getRouteAccessConfig } from "./route-access";
import {
	parsePermissionSimulationCookie,
	permissionSimulationHas,
	PERMISSION_SIMULATION_COOKIE,
	type PermissionSimulation,
} from "@/lib/permission-simulation";
import { isSuperAdminUser } from "@/lib/superadmin";
import { resolveTenantMembership } from "@/lib/tenant-selection";

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

async function resolveIsSuperAdminUser(
	supabase: Awaited<ReturnType<typeof createClient>>,
	user: { id: string; email?: string },
) {
	const { data: profile } = await supabase
		.from("profiles")
		.select("is_superadmin")
		.eq("user_id", user.id)
		.maybeSingle();

	return isSuperAdminUser(user.id, profile?.is_superadmin, user.email);
}

async function resolveActivePermissionSimulation(isSuperAdmin: boolean) {
	if (!isSuperAdmin) return null;
	const cookieStore = await cookies();
	return parsePermissionSimulationCookie(
		cookieStore.get(PERMISSION_SIMULATION_COOKIE)?.value,
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
	actualIsSuperAdmin?: boolean;
	permissionSimulation?: PermissionSimulation | null;
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

	const actualIsSuperAdmin = await resolveIsSuperAdminUser(supabase, user);
	const permissionSimulation =
		await resolveActivePermissionSimulation(actualIsSuperAdmin);
	const isSimulatingPermissions = Boolean(permissionSimulation);
	const isSuperAdmin = isSimulatingPermissions ? false : actualIsSuperAdmin;

	// Get tenant membership for current user
	const memberships = await loadUserTenantMemberships(supabase, user.id);

	const { tenantId, activeMembership } = await resolveTenantMembership(
		memberships,
		{ isSuperAdmin: actualIsSuperAdmin }
	);
	const membershipRole = isSimulatingPermissions
		? "member"
		: activeMembership?.role;

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
	if (tenantId && !isAdmin && !isSuperAdmin && !isSimulatingPermissions) {
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
		actualIsSuperAdmin,
		permissionSimulation,
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

	if (
		config.deniedByPermission &&
		await hasExplicitPermissionDeny(config.deniedByPermission)
	) {
		return false;
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

	const actualIsSuperAdmin = await resolveIsSuperAdminUser(supabase, user);
	const permissionSimulation =
		await resolveActivePermissionSimulation(actualIsSuperAdmin);
	const isSuperAdmin = permissionSimulation ? false : actualIsSuperAdmin;

	if (isSuperAdmin) {
		return true;
	}
	if (permissionSimulation) {
		const levelKeys: Record<PermissionLevel, string[]> = {
			read: ["macro:read", "macro:edit", "macro:admin"],
			edit: ["macro:edit", "macro:admin"],
			admin: ["macro:admin"],
		};
		return levelKeys[requiredLevel].some((permissionKey) =>
			permissionSimulationHas(permissionSimulation, permissionKey),
		);
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

	const actualIsSuperAdmin = await resolveIsSuperAdminUser(supabase, user);
	const permissionSimulation =
		await resolveActivePermissionSimulation(actualIsSuperAdmin);

	if (permissionSimulation) {
		return permissionSimulationHas(permissionSimulation, permissionKey);
	}

	if (actualIsSuperAdmin) {
		return true;
	}

	// Get current tenant
	const memberships = await loadUserTenantMemberships(supabase, user.id);

	if (!memberships || memberships.length === 0) {
		return false;
	}

	const { tenantId, activeMembership } = await resolveTenantMembership(
		memberships,
		{ isSuperAdmin: actualIsSuperAdmin }
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
		.eq("tenant_id", tenantId)
		.eq("permissions.key", permissionKey)
		.maybeSingle();

	if (overrideError) {
		warnSupabaseError(
			"Could not fetch user permission override; continuing without override",
			overrideError,
		);
	}

	if (typeof override?.is_granted === "boolean") {
		return override.is_granted;
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
			.select("is_granted, permissions!inner(key)")
			.in("role_id", roleIds)
			.eq("permissions.key", permissionKey);

		if (rolePermsError) {
			warnSupabaseError(
				"Could not fetch role permissions; denying permission",
				rolePermsError,
			);
			return false;
		}

		if (rolePerms?.some((rolePermission) => rolePermission.is_granted === false)) {
			return false;
		}

		if (rolePerms?.some((rolePermission) => rolePermission.is_granted !== false)) {
			return true;
		}
	}

	return false;
}

/**
 * Check if the active tenant has an explicit user or role deny for a permission.
 * Owner/admin/superadmin memberships bypass custom denies by design.
 */
export async function hasExplicitPermissionDeny(
	permissionKey: string
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

	const actualIsSuperAdmin = await resolveIsSuperAdminUser(supabase, user);
	const permissionSimulation =
		await resolveActivePermissionSimulation(actualIsSuperAdmin);

	if (permissionSimulation || actualIsSuperAdmin) {
		return false;
	}

	const memberships = await loadUserTenantMemberships(supabase, user.id);
	const { tenantId, activeMembership } = await resolveTenantMembership(
		memberships,
		{ isSuperAdmin: actualIsSuperAdmin }
	);

	if (!tenantId) {
		return false;
	}

	const isAdmin =
		activeMembership?.role === "owner" || activeMembership?.role === "admin";
	if (isAdmin) {
		return false;
	}

	const { data: override, error } = await supabase
		.from("user_permission_overrides")
		.select("is_granted, permissions!inner(key)")
		.eq("user_id", user.id)
		.eq("tenant_id", tenantId)
		.eq("permissions.key", permissionKey)
		.maybeSingle();

	if (error) {
		warnSupabaseError(
			"Could not fetch explicit permission deny; continuing without deny",
			error,
		);
		return false;
	}

	if (override?.is_granted === false) {
		return true;
	}

	if (override?.is_granted === true) {
		return false;
	}

	const { data: userRoles, error: userRolesError } = await supabase
		.from("user_roles")
		.select("role_id, roles!inner(tenant_id)")
		.eq("user_id", user.id)
		.eq("roles.tenant_id", tenantId);

	if (userRolesError) {
		warnSupabaseError(
			"Could not fetch explicit deny user roles; continuing without role deny",
			userRolesError,
		);
		return false;
	}

	if (!userRoles?.length) {
		return false;
	}

	const { data: roleDenials, error: roleDenialsError } = await supabase
		.from("role_permissions")
		.select("is_granted, permissions!inner(key)")
		.in("role_id", userRoles.map((role) => role.role_id))
		.eq("permissions.key", permissionKey)
		.eq("is_granted", false);

	if (roleDenialsError) {
		warnSupabaseError(
			"Could not fetch explicit role permission deny; continuing without role deny",
			roleDenialsError,
		);
		return false;
	}

	return Boolean(roleDenials?.length);
}

/**
 * Get all permission keys the user has
 */
export async function getUserPermissionKeys(): Promise<string[]> {
	const session = await auth();
	if (!session.data.user) {
		return [];
	}
	const {
		isAdmin,
		isSuperAdmin,
		tenantId,
		permissionSimulation,
	} = await getUserRoles();

	if (!tenantId) {
		return [];
	}

	if (permissionSimulation) {
		return permissionSimulation.permissionKeys;
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
	const deniedPermissionKeys = new Set<string>();
	const roleDeniedPermissionKeys = new Set<string>();

	const { data: deniedOverrides, error: deniedOverridesError } = await supabase
		.from("user_permission_overrides")
		.select("permissions(key)")
		.eq("user_id", user.id)
		.eq("tenant_id", tenantId)
		.eq("is_granted", false);

	if (deniedOverridesError) {
		warnSupabaseError(
			"Could not fetch denied permission overrides; continuing without denies",
			deniedOverridesError,
		);
	}

	for (const o of deniedOverrides ?? []) {
		const key = getPermissionRelationKey(o.permissions as PermissionRelation);
		if (key) {
			deniedPermissionKeys.add(key);
		}
	}

	// Get direct overrides
	const { data: overrides, error: overridesError } = await supabase
		.from("user_permission_overrides")
		.select("permissions(key)")
		.eq("user_id", user.id)
		.eq("tenant_id", tenantId)
		.eq("is_granted", true);

	if (overridesError) {
		warnSupabaseError(
			"Could not fetch permission overrides; continuing without overrides",
			overridesError,
		);
	}

	for (const o of overrides ?? []) {
		const key = getPermissionRelationKey(o.permissions as PermissionRelation);
		if (key && !deniedPermissionKeys.has(key)) {
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
			.select("is_granted, permissions(key)")
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
			if (!key) {
				continue;
			}
			if (rp.is_granted === false) {
				roleDeniedPermissionKeys.add(key);
				continue;
			}
			if (!deniedPermissionKeys.has(key) && !roleDeniedPermissionKeys.has(key)) {
				permissionKeys.add(key);
			}
		}

		for (const key of roleDeniedPermissionKeys) {
			if (!permissionKeys.has(key) || deniedPermissionKeys.has(key)) continue;
			const hasDirectGrant = (overrides ?? []).some((override) => {
				const overrideKey = getPermissionRelationKey(
					override.permissions as PermissionRelation
				);
				return overrideKey === key;
			});
			if (!hasDirectGrant) {
				permissionKeys.delete(key);
			}
		}
	}

	return Array.from(permissionKeys);
}

export async function getUserDeniedPermissionKeys(): Promise<string[]> {
	const session = await auth();
	if (!session.data.user) {
		return [];
	}
	const {
		isAdmin,
		isSuperAdmin,
		tenantId,
		permissionSimulation,
	} = await getUserRoles();

	if (!tenantId || isAdmin || isSuperAdmin || permissionSimulation) {
		return [];
	}

	const supabase = await createClient();
	const user = await getAuthenticatedUser(supabase);

	if (!user) {
		return [];
	}

	const { data: overrides, error } = await supabase
		.from("user_permission_overrides")
		.select("is_granted, permissions(key)")
		.eq("user_id", user.id)
		.eq("tenant_id", tenantId);

	if (error) {
		warnSupabaseError(
			"Could not fetch denied permission keys; returning no denies",
			error,
		);
		return [];
	}

	const grantedOverrides = new Set<string>();
	const deniedKeys = new Set<string>();

	for (const override of overrides ?? []) {
		const key = getPermissionRelationKey(
			override.permissions as PermissionRelation
		);
		if (!key) continue;
		if (override.is_granted) {
			grantedOverrides.add(key);
		} else {
			deniedKeys.add(key);
		}
	}

	const { data: userRoles, error: userRolesError } = await supabase
		.from("user_roles")
		.select("role_id, roles!inner(tenant_id)")
		.eq("user_id", user.id)
		.eq("roles.tenant_id", tenantId);

	if (userRolesError) {
		warnSupabaseError(
			"Could not fetch denied permission user roles; returning override denies only",
			userRolesError,
		);
		return Array.from(deniedKeys);
	}

	if (!userRoles?.length) {
		return Array.from(deniedKeys);
	}

	const { data: roleDenials, error: roleDenialsError } = await supabase
		.from("role_permissions")
		.select("permissions(key)")
		.in("role_id", userRoles.map((role) => role.role_id))
		.eq("is_granted", false);

	if (roleDenialsError) {
		warnSupabaseError(
			"Could not fetch role denied permission keys; returning override denies only",
			roleDenialsError,
		);
		return Array.from(deniedKeys);
	}

	for (const roleDeny of roleDenials ?? []) {
		const key = getPermissionRelationKey(
			roleDeny.permissions as PermissionRelation
		);
		if (key && !grantedOverrides.has(key)) {
			deniedKeys.add(key);
		}
	}

	return Array.from(deniedKeys);
}
