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
 * Fetch user IDs for all users that have a specific role ID assigned.
 *
 * This uses the user_roles table to find all users with the given role.
 */
export async function getUserIdsByRoleId(params: {
	roleId: string;
	tenantId?: string | null;
}): Promise<string[]> {
	try {
		const admin = createSupabaseAdminClient();

		// Verify the role exists and optionally belongs to the tenant
		let roleQuery = admin.from("roles").select("id").eq("id", params.roleId);
		if (params.tenantId) {
			roleQuery = roleQuery.eq("tenant_id", params.tenantId);
		}

		const { data: role, error: roleError } = await roleQuery.maybeSingle();
		if (roleError || !role) return [];

		const { data: userRoles, error: userRolesError } = await admin
			.from("user_roles")
			.select("user_id")
			.eq("role_id", params.roleId);

		if (userRolesError || !userRoles) return [];

		return (userRoles as { user_id: string }[]).map((row) => row.user_id);
	} catch {
		return [];
	}
}
