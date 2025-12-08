import { createSupabaseAdminClient } from "@/utils/supabase/admin";

export async function getUserEmailById(userId: string): Promise<string | null> {
	try {
		const admin = createSupabaseAdminClient();
		const { data } = await admin.auth.admin.getUserById(userId);
		return data?.user?.email ?? null;
	} catch {
		return null;
	}
}

/**
 * Fetch user IDs for all users that have a role with the given key
 * (scoped optionally to a tenant via roles.tenant_id).
 *
 * This uses the roles + user_roles tables instead of membership_role.
 */
export async function getUserIdsByRoleKey(params: {
	roleKey: string;
	tenantId?: string | null;
}): Promise<string[]> {
	try {
		const admin = createSupabaseAdminClient();

		// First resolve role IDs that match the key (and tenant if provided)
		let rolesQuery = admin.from("roles").select("id");
		rolesQuery = rolesQuery.eq("key", params.roleKey);
		if (params.tenantId) {
			rolesQuery = rolesQuery.eq("tenant_id", params.tenantId);
		}

		const { data: roles, error: rolesError } = await rolesQuery;
		if (rolesError || !roles || roles.length === 0) return [];

		const roleIds = (roles as { id: string }[]).map((r) => r.id);

		const { data: userRoles, error: userRolesError } = await admin
			.from("user_roles")
			.select("user_id")
			.in("role_id", roleIds);

		if (userRolesError || !userRoles) return [];

		return (userRoles as { user_id: string }[]).map((row) => row.user_id);
	} catch {
		return [];
	}
}
