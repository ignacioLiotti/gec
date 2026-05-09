"use server";

import { createClient } from "@/utils/supabase/server";
import { resolveTenantMembership } from "@/lib/tenant-selection";
import { revalidatePath } from "next/cache";

const SUPERADMIN_USER_ID = "77b936fb-3e92-4180-b601-15c31125811e";

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function requireRolesAdmin(
	supabase: Supabase,
	requestedTenantId?: string
) {
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		throw new Error("Unauthorized");
	}

	const [{ data: memberships }, { data: profile }] = await Promise.all([
		supabase
			.from("memberships")
			.select("tenant_id, role")
			.eq("user_id", user.id)
			.order("created_at", { ascending: true }),
		supabase
			.from("profiles")
			.select("is_superadmin")
			.eq("user_id", user.id)
			.maybeSingle(),
	]);

	const isSuperAdmin =
		(profile?.is_superadmin ?? false) || user.id === SUPERADMIN_USER_ID;
	const { tenantId } = await resolveTenantMembership(
		(memberships ?? []) as { tenant_id: string | null; role: string | null }[],
		{ isSuperAdmin }
	);
	const effectiveTenantId = requestedTenantId ?? tenantId;

	if (!effectiveTenantId) {
		throw new Error("No active tenant");
	}
	if (requestedTenantId && requestedTenantId !== tenantId && !isSuperAdmin) {
		throw new Error("Forbidden");
	}

	if (!isSuperAdmin) {
		const { data: canAdmin, error } = await supabase.rpc("has_permission", {
			tenant: effectiveTenantId,
			perm_key: "admin:roles",
		});
		if (error) throw error;
		if (!canAdmin) {
			throw new Error("Forbidden");
		}
	}

	return { user, tenantId: effectiveTenantId, isSuperAdmin };
}

async function requireRoleInTenant(
	supabase: Supabase,
	roleId: string,
	tenantId: string
) {
	const { data: role, error } = await supabase
		.from("roles")
		.select("id")
		.eq("id", roleId)
		.eq("tenant_id", tenantId)
		.maybeSingle();
	if (error) throw error;
	if (!role) throw new Error("Role not found");
}

async function requireUserInTenant(
	supabase: Supabase,
	userId: string,
	tenantId: string
) {
	const { data: membership, error } = await supabase
		.from("memberships")
		.select("user_id")
		.eq("user_id", userId)
		.eq("tenant_id", tenantId)
		.maybeSingle();
	if (error) throw error;
	if (!membership) throw new Error("User is not a member of this tenant");
}

export async function createRole({
	tenantId,
	name,
}: {
	tenantId: string;
	name: string;
}) {
	const supabase = await createClient();
	await requireRolesAdmin(supabase, tenantId);
	await supabase.from("roles").insert({ tenant_id: tenantId, name });
	revalidatePath("/admin/roles");
}

export async function deleteRole({ roleId }: { roleId: string }) {
	const supabase = await createClient();
	const { tenantId } = await requireRolesAdmin(supabase);
	await requireRoleInTenant(supabase, roleId, tenantId);
	await supabase.from("roles").delete().eq("id", roleId);
	revalidatePath("/admin/roles");
}

export async function listRoles({ tenantId }: { tenantId: string }) {
	const supabase = await createClient();
	await requireRolesAdmin(supabase, tenantId);
	const { data } = await supabase
		.from("roles")
		.select("id, name")
		.eq("tenant_id", tenantId)
		.order("name");
	return data ?? [];
}

export async function listUserRoles({ userId }: { userId: string }) {
	const supabase = await createClient();
	const { tenantId } = await requireRolesAdmin(supabase);
	await requireUserInTenant(supabase, userId, tenantId);
	const { data } = await supabase
		.from("user_roles")
		.select("role_id, roles!inner(tenant_id)")
		.eq("user_id", userId)
		.eq("roles.tenant_id", tenantId);
	return (data ?? []).map((row) => ({ role_id: row.role_id }));
}

export async function assignUserRole({
	userId,
	roleId,
}: {
	userId: string;
	roleId: string;
}) {
	const supabase = await createClient();
	const { tenantId } = await requireRolesAdmin(supabase);
	await Promise.all([
		requireRoleInTenant(supabase, roleId, tenantId),
		requireUserInTenant(supabase, userId, tenantId),
	]);
	await supabase
		.from("user_roles")
		.insert({ user_id: userId, role_id: roleId });
	revalidatePath("/admin/roles");
}

export async function revokeUserRole({
	userId,
	roleId,
}: {
	userId: string;
	roleId: string;
}) {
	const supabase = await createClient();
	const { tenantId } = await requireRolesAdmin(supabase);
	await Promise.all([
		requireRoleInTenant(supabase, roleId, tenantId),
		requireUserInTenant(supabase, userId, tenantId),
	]);
	await supabase
		.from("user_roles")
		.delete()
		.eq("user_id", userId)
		.eq("role_id", roleId);
	revalidatePath("/admin/roles");
}

// Role-Permissions
export async function listRolePermissions({ roleId }: { roleId: string }) {
	const supabase = await createClient();
	const { tenantId } = await requireRolesAdmin(supabase);
	await requireRoleInTenant(supabase, roleId, tenantId);
	const { data } = await supabase
		.from("role_permissions")
		.select("permission_id")
		.eq("role_id", roleId);
	return data ?? [];
}

export async function grantPermissionToRole({
	roleId,
	permissionId,
}: {
	roleId: string;
	permissionId: string;
}) {
	const supabase = await createClient();
	const { tenantId } = await requireRolesAdmin(supabase);
	await requireRoleInTenant(supabase, roleId, tenantId);
	await supabase
		.from("role_permissions")
		.insert({ role_id: roleId, permission_id: permissionId });
	revalidatePath("/admin/roles");
}

export async function revokePermissionFromRole({
	roleId,
	permissionId,
}: {
	roleId: string;
	permissionId: string;
}) {
	const supabase = await createClient();
	const { tenantId } = await requireRolesAdmin(supabase);
	await requireRoleInTenant(supabase, roleId, tenantId);
	await supabase
		.from("role_permissions")
		.delete()
		.eq("role_id", roleId)
		.eq("permission_id", permissionId);
	revalidatePath("/admin/roles");
}

// User overrides
export async function listUserOverrides({ userId }: { userId: string }) {
	const supabase = await createClient();
	const { tenantId } = await requireRolesAdmin(supabase);
	await requireUserInTenant(supabase, userId, tenantId);
	const { data } = await supabase
		.from("user_permission_overrides")
		.select("permission_id, is_granted")
		.eq("user_id", userId);
	return data ?? [];
}

export async function setUserOverride({
	userId,
	permissionId,
	isGranted,
}: {
	userId: string;
	permissionId: string;
	isGranted: boolean;
}) {
	const supabase = await createClient();
	const { tenantId } = await requireRolesAdmin(supabase);
	await requireUserInTenant(supabase, userId, tenantId);
	await supabase
		.from("user_permission_overrides")
		.upsert(
			{ user_id: userId, permission_id: permissionId, is_granted: isGranted },
			{ onConflict: "user_id,permission_id" }
		);
	revalidatePath("/admin/roles");
}

// Permissions CRUD
export async function createPermission({
	key,
	description,
}: {
	key: string;
	description: string | null;
}) {
	const supabase = await createClient();
	await requireRolesAdmin(supabase);
	const { error } = await supabase.from("permissions").insert({ key, description });

	if (error) {
		console.error("Error creating permission:", error);
		return { error: error.message };
	}

	revalidatePath("/admin/roles");
	return { success: true };
}

export async function deletePermission({
	permissionId,
}: {
	permissionId: string;
}) {
	const supabase = await createClient();
	await requireRolesAdmin(supabase);
	const { error } = await supabase.from("permissions").delete().eq("id", permissionId);

	if (error) {
		console.error("Error deleting permission:", error);
		return { error: error.message };
	}

	revalidatePath("/admin/roles");
	return { success: true };
}

// Role update
export async function updateRole({
	roleId,
	name,
}: {
	roleId: string;
	name: string;
}) {
	const supabase = await createClient();
	const { tenantId } = await requireRolesAdmin(supabase);
	await requireRoleInTenant(supabase, roleId, tenantId);
	await supabase.from("roles").update({ name }).eq("id", roleId);
	revalidatePath("/admin/roles");
}

// User permission sources/context for a tenant
export async function userPermissionSources({
	tenantId,
	userId,
}: {
	tenantId: string;
	userId: string;
}) {
	const supabase = await createClient();
	await requireRolesAdmin(supabase, tenantId);
	await requireUserInTenant(supabase, userId, tenantId);

	// Roles assigned to user within tenant
	const { data: assigned } = await supabase
		.from("user_roles")
		.select("role_id, roles!inner(id, tenant_id, key, name)")
		.eq("roles.tenant_id", tenantId)
		.eq("user_id", userId);

	const roleIds = (assigned ?? []).map((row) => row.role_id as string);

	// Role permission grants
	let roleGrants: { roleId: string; permissionId: string }[] = [];
	if (roleIds.length) {
		const { data: rp } = await supabase
			.from("role_permissions")
			.select("role_id, permission_id")
			.in("role_id", roleIds);
		roleGrants = (rp ?? []).map((row) => ({
			roleId: row.role_id as string,
			permissionId: row.permission_id as string,
		}));
	}

	// Direct overrides (grants)
	const { data: overrides } = await supabase
		.from("user_permission_overrides")
		.select("permission_id")
		.eq("user_id", userId)
		.eq("is_granted", true);
	const overrideIds = new Set(
		(overrides ?? []).map((row) => row.permission_id as string)
	);

	// Admin via membership (owner/admin)
	const { data: membership } = await supabase
		.from("memberships")
		.select("role")
		.eq("tenant_id", tenantId)
		.eq("user_id", userId)
		.maybeSingle();
	const isAdmin = membership?.role === "owner" || membership?.role === "admin";

	return { roleGrants, overrideIds: Array.from(overrideIds), isAdmin };
}

export async function updateMembershipRole({
	tenantId,
	userId,
	role,
}: {
	tenantId: string;
	userId: string;
	role: "owner" | "admin" | "member";
}) {
	const supabase = await createClient();
	await requireRolesAdmin(supabase, tenantId);
	await requireUserInTenant(supabase, userId, tenantId);
	await supabase
		.from("memberships")
		.update({ role })
		.eq("tenant_id", tenantId)
		.eq("user_id", userId);
	revalidatePath("/admin/users");
}
