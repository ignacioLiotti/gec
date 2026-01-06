"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export async function createRole({
	tenantId,
	name,
}: {
	tenantId: string;
	name: string;
}) {
	const supabase = await createClient();
	await supabase.from("roles").insert({ tenant_id: tenantId, name });
	revalidatePath("/admin/roles");
}

export async function deleteRole({ roleId }: { roleId: string }) {
	const supabase = await createClient();
	await supabase.from("roles").delete().eq("id", roleId);
	revalidatePath("/admin/roles");
}

export async function listRoles({ tenantId }: { tenantId: string }) {
	const supabase = await createClient();
	const { data } = await supabase
		.from("roles")
		.select("id, name")
		.eq("tenant_id", tenantId)
		.order("name");
	return data ?? [];
}

export async function listUserRoles({ userId }: { userId: string }) {
	const supabase = await createClient();
	const { data } = await supabase
		.from("user_roles")
		.select("role_id")
		.eq("user_id", userId);
	return data ?? [];
}

export async function assignUserRole({
	userId,
	roleId,
}: {
	userId: string;
	roleId: string;
}) {
	const supabase = await createClient();
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

	// Roles assigned to user within tenant
	const { data: assigned } = await supabase
		.from("user_roles")
		.select("role_id, roles!inner(id, tenant_id, key, name)")
		.eq("roles.tenant_id", tenantId)
		.eq("user_id", userId);

	const roleIds = (assigned ?? []).map((r: any) => r.role_id);

	// Role permission grants
	let roleGrants: { roleId: string; permissionId: string }[] = [];
	if (roleIds.length) {
		const { data: rp } = await supabase
			.from("role_permissions")
			.select("role_id, permission_id")
			.in("role_id", roleIds);
		roleGrants = (rp ?? []).map((x: any) => ({
			roleId: x.role_id,
			permissionId: x.permission_id,
		}));
	}

	// Direct overrides (grants)
	const { data: overrides } = await supabase
		.from("user_permission_overrides")
		.select("permission_id")
		.eq("user_id", userId)
		.eq("is_granted", true);
	const overrideIds = new Set(
		(overrides ?? []).map((o: any) => o.permission_id)
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
	await supabase
		.from("memberships")
		.update({ role })
		.eq("tenant_id", tenantId)
		.eq("user_id", userId);
	revalidatePath("/admin/users");
}
