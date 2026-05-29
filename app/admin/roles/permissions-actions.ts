"use server";

import { createClient } from "@/utils/supabase/server";
import { auth } from "@/lib/auth";
import { resolveTenantMembership } from "@/lib/tenant-selection";
import { revalidatePath } from "next/cache";

// Types
export type PermissionLevel = "read" | "edit" | "admin";

export type Permission = {
	id: string;
	key: string;
	description: string | null;
	category: string;
	display_name: string | null;
	sort_order: number;
};

export type PermissionsByCategory = {
	category: string;
	permissions: Permission[];
};

export type Role = {
	id: string;
	tenant_id: string;
	name: string;
	description: string | null;
	color: string | null;
	is_default: boolean;
	permission_count?: number;
	permissions?: string[];
};

export type RoleTemplate = {
	id: string;
	key: string;
	name: string;
	description: string | null;
	permissions: string[];
	is_system: boolean;
};

export type MacroTablePermission = {
	id: string;
	macro_table_id: string;
	macro_table_name?: string;
	user_id: string | null;
	user_email?: string | null;
	role_id: string | null;
	role_name?: string | null;
	permission_level: PermissionLevel;
};

type PermissionKeyRelation =
	| { key?: string | null }
	| { key?: string | null }[]
	| null;

type NameRelation =
	| { name?: string | null }
	| { name?: string | null }[]
	| null;

type FullNameRelation =
	| { full_name?: string | null }
	| { full_name?: string | null }[]
	| null;

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

async function requireMacroTableInTenant(
	supabase: Supabase,
	macroTableId: string,
	tenantId: string
) {
	const { data: macroTable, error } = await supabase
		.from("macro_tables")
		.select("id")
		.eq("id", macroTableId)
		.eq("tenant_id", tenantId)
		.maybeSingle();
	if (error) throw error;
	if (!macroTable) throw new Error("Macro table not found");
}

function readPermissionKey(value: PermissionKeyRelation): string | null {
	const record = Array.isArray(value) ? value[0] : value;
	return typeof record?.key === "string" ? record.key : null;
}

function readName(value: NameRelation): string | null {
	const record = Array.isArray(value) ? value[0] : value;
	return typeof record?.name === "string" ? record.name : null;
}

function readFullName(value: FullNameRelation): string | null {
	const record = Array.isArray(value) ? value[0] : value;
	return typeof record?.full_name === "string" ? record.full_name : null;
}

// =====================================================
// PERMISSIONS
// =====================================================

export async function getPermissionsByCategory(): Promise<
	PermissionsByCategory[]
> {
	const session = await auth();
	if (!session.data.user) throw new Error("Unauthorized");
	const supabase = await createClient();
	await requireRolesAdmin(supabase);

	const { data, error } = await supabase
		.from("permissions")
		.select("id, key, description, category, display_name, sort_order")
		.order("category")
		.order("sort_order");

	if (error) {
		console.error("Error fetching permissions:", error);
		return [];
	}

	// Group by category
	const grouped = (data ?? []).reduce(
		(acc, perm) => {
			const category = perm.category || "general";
			if (!acc[category]) {
				acc[category] = [];
			}
			acc[category].push(perm);
			return acc;
		},
		{} as Record<string, Permission[]>
	);

	// Convert to array format
	return Object.entries(grouped).map(([category, permissions]) => ({
		category,
		permissions,
	}));
}

export async function getAllPermissions(): Promise<Permission[]> {
	const session = await auth();
	if (!session.data.user) throw new Error("Unauthorized");
	const supabase = await createClient();
	await requireRolesAdmin(supabase);

	const { data, error } = await supabase
		.from("permissions")
		.select("id, key, description, category, display_name, sort_order")
		.order("category")
		.order("sort_order");

	if (error) {
		console.error("Error fetching permissions:", error);
		return [];
	}

	return data ?? [];
}

// =====================================================
// ROLE TEMPLATES
// =====================================================

export async function getRoleTemplates(): Promise<RoleTemplate[]> {
	const session = await auth();
	if (!session.data.user) throw new Error("Unauthorized");
	const supabase = await createClient();
	await requireRolesAdmin(supabase);

	const { data, error } = await supabase
		.from("role_templates")
		.select("id, key, name, description, permissions, is_system")
		.order("name");

	if (error) {
		console.error("Error fetching role templates:", error);
		return [];
	}

	return (data ?? []).map((t) => ({
		...t,
		permissions: Array.isArray(t.permissions) ? t.permissions : [],
	}));
}

// =====================================================
// ROLES (Enhanced)
// =====================================================

export async function getRolesWithPermissions({
	tenantId,
}: {
	tenantId: string;
}): Promise<Role[]> {
	const session = await auth();
	if (!session.data.user) throw new Error("Unauthorized");
	const supabase = await createClient();
	await requireRolesAdmin(supabase, tenantId);

	// Get roles
	const { data: roles, error: rolesError } = await supabase
		.from("roles")
		.select("id, tenant_id, name, description, color, is_default")
		.eq("tenant_id", tenantId)
		.order("name");

	if (rolesError) {
		console.error("Error fetching roles:", rolesError);
		return [];
	}

	if (!roles?.length) return [];

	// Get permissions for each role
	const roleIds = roles.map((r) => r.id);
	const { data: rolePerms } = await supabase
		.from("role_permissions")
		.select("role_id, permissions(key)")
		.in("role_id", roleIds);

	// Build permission map
	const permMap: Record<string, string[]> = {};
	for (const rp of rolePerms ?? []) {
		if (!permMap[rp.role_id]) {
			permMap[rp.role_id] = [];
		}
		const permKey = readPermissionKey(
			rp.permissions as PermissionKeyRelation
		);
		if (permKey) {
			permMap[rp.role_id].push(permKey);
		}
	}

	return roles.map((r) => ({
		...r,
		permissions: permMap[r.id] || [],
		permission_count: (permMap[r.id] || []).length,
	}));
}

export async function createRoleFromTemplate({
	tenantId,
	templateKey,
	name,
	description,
	color,
}: {
	tenantId: string;
	templateKey: string;
	name: string;
	description?: string;
	color?: string;
}): Promise<{ role?: Role; error?: string }> {
	const session = await auth();
	if (!session.data.user) throw new Error("Unauthorized");
	const supabase = await createClient();
	await requireRolesAdmin(supabase, tenantId);

	// Get template
	const { data: template, error: templateError } = await supabase
		.from("role_templates")
		.select("permissions")
		.eq("key", templateKey)
		.single();

	if (templateError || !template) {
		return { error: "Template not found" };
	}

	const permissionKeys: string[] = Array.isArray(template.permissions)
		? template.permissions
		: [];

	// Create role
	const { data: role, error: roleError } = await supabase
		.from("roles")
		.insert({
			tenant_id: tenantId,
			name,
			description: description || null,
			color: color || "#6366f1",
		})
		.select()
		.single();

	if (roleError) {
		console.error("Error creating role:", roleError);
		return { error: roleError.message };
	}

	// Get permission IDs for the template permissions
	if (permissionKeys.length > 0) {
		const { data: permissions } = await supabase
			.from("permissions")
			.select("id")
			.in("key", permissionKeys);

		if (permissions?.length) {
			// Assign permissions to role
			await supabase.from("role_permissions").insert(
				permissions.map((p) => ({
					role_id: role.id,
					permission_id: p.id,
				}))
			);
		}
	}

	revalidatePath("/admin/roles");
	return { role };
}

export async function createRoleWithPermissions({
	tenantId,
	name,
	description,
	color,
	permissionKeys,
}: {
	tenantId: string;
	name: string;
	description?: string;
	color?: string;
	permissionKeys: string[];
}): Promise<{ role?: Role; error?: string }> {
	const session = await auth();
	if (!session.data.user) throw new Error("Unauthorized");
	const supabase = await createClient();
	await requireRolesAdmin(supabase, tenantId);

	// Create role
	const { data: role, error: roleError } = await supabase
		.from("roles")
		.insert({
			tenant_id: tenantId,
			name,
			description: description || null,
			color: color || "#6366f1",
		})
		.select()
		.single();

	if (roleError) {
		console.error("Error creating role:", roleError);
		return { error: roleError.message };
	}

	// Get permission IDs
	if (permissionKeys.length > 0) {
		const { data: permissions } = await supabase
			.from("permissions")
			.select("id")
			.in("key", permissionKeys);

		if (permissions?.length) {
			await supabase.from("role_permissions").insert(
				permissions.map((p) => ({
					role_id: role.id,
					permission_id: p.id,
				}))
			);
		}
	}

	revalidatePath("/admin/roles");
	return { role };
}

export async function updateRoleWithPermissions({
	roleId,
	name,
	description,
	color,
	permissionKeys,
}: {
	roleId: string;
	name: string;
	description?: string;
	color?: string;
	permissionKeys: string[];
}): Promise<{ error?: string }> {
	const session = await auth();
	if (!session.data.user) throw new Error("Unauthorized");
	const supabase = await createClient();
	const { tenantId } = await requireRolesAdmin(supabase);
	await requireRoleInTenant(supabase, roleId, tenantId);

	// Update role
	const { error: roleError } = await supabase
		.from("roles")
		.update({
			name,
			description: description || null,
			color: color || "#6366f1",
		})
		.eq("id", roleId);

	if (roleError) {
		console.error("Error updating role:", roleError);
		return { error: roleError.message };
	}

	// Delete existing permissions
	await supabase.from("role_permissions").delete().eq("role_id", roleId);

	// Add new permissions
	if (permissionKeys.length > 0) {
		const { data: permissions } = await supabase
			.from("permissions")
			.select("id")
			.in("key", permissionKeys);

		if (permissions?.length) {
			await supabase.from("role_permissions").insert(
				permissions.map((p) => ({
					role_id: roleId,
					permission_id: p.id,
				}))
			);
		}
	}

	revalidatePath("/admin/roles");
	return {};
}

// =====================================================
// MACRO TABLE PERMISSIONS
// =====================================================

export async function getMacroTablePermissions({
	tenantId,
}: {
	tenantId: string;
}): Promise<MacroTablePermission[]> {
	const session = await auth();
	if (!session.data.user) throw new Error("Unauthorized");
	const supabase = await createClient();
	await requireRolesAdmin(supabase, tenantId);

	const { data } = await supabase
		.from("macro_table_permissions")
		.select(
			`
      id,
      macro_table_id,
      user_id,
      role_id,
      permission_level,
      macro_tables!inner(name, tenant_id),
      roles(name),
      profiles:user_id(full_name)
    `
		)
		.eq("macro_tables.tenant_id", tenantId);

	// if (error) {
	//   console.error("Error fetching macro table permissions:", error);
	//   return [];
	// }

	return (data ?? []).map((p) => ({
		id: p.id,
		macro_table_id: p.macro_table_id,
		macro_table_name: readName(p.macro_tables as NameRelation) ?? undefined,
		user_id: p.user_id,
		user_email: readFullName(p.profiles as FullNameRelation) ?? undefined,
		role_id: p.role_id,
		role_name: readName(p.roles as NameRelation) ?? undefined,
		permission_level: p.permission_level as PermissionLevel,
	}));
}

export async function getMacroTablesForPermissions({
	tenantId,
}: {
	tenantId: string;
}): Promise<{ id: string; name: string }[]> {
	const session = await auth();
	if (!session.data.user) throw new Error("Unauthorized");
	const supabase = await createClient();
	await requireRolesAdmin(supabase, tenantId);

	const { data } = await supabase
		.from("macro_tables")
		.select("id, name")
		.eq("tenant_id", tenantId)
		.order("name");

	return data ?? [];
}

export async function setMacroTablePermission({
	macroTableId,
	targetType,
	targetId,
	permissionLevel,
}: {
	macroTableId: string;
	targetType: "user" | "role";
	targetId: string;
	permissionLevel: PermissionLevel;
}): Promise<{ error?: string }> {
	const session = await auth();
	if (!session.data.user) throw new Error("Unauthorized");
	const supabase = await createClient();
	const { tenantId } = await requireRolesAdmin(supabase);
	await requireMacroTableInTenant(supabase, macroTableId, tenantId);
	if (targetType === "user") {
		await requireUserInTenant(supabase, targetId, tenantId);
	} else {
		await requireRoleInTenant(supabase, targetId, tenantId);
	}

	const insertData: {
		macro_table_id: string;
		permission_level: PermissionLevel;
		user_id?: string;
		role_id?: string;
	} = {
		macro_table_id: macroTableId,
		permission_level: permissionLevel,
	};

	if (targetType === "user") {
		insertData.user_id = targetId;
	} else {
		insertData.role_id = targetId;
	}

	// Use upsert to handle existing entries
	const { error } = await supabase
		.from("macro_table_permissions")
		.upsert(insertData, {
			onConflict:
				targetType === "user"
					? "macro_table_id,user_id"
					: "macro_table_id,role_id",
		});

	if (error) {
		console.error("Error setting macro table permission:", error);
		return { error: error.message };
	}

	revalidatePath("/admin/roles");
	return {};
}

export async function removeMacroTablePermission({
	macroTableId,
	targetType,
	targetId,
}: {
	macroTableId: string;
	targetType: "user" | "role";
	targetId: string;
}): Promise<{ error?: string }> {
	const session = await auth();
	if (!session.data.user) throw new Error("Unauthorized");
	const supabase = await createClient();
	const { tenantId } = await requireRolesAdmin(supabase);
	await requireMacroTableInTenant(supabase, macroTableId, tenantId);
	if (targetType === "user") {
		await requireUserInTenant(supabase, targetId, tenantId);
	} else {
		await requireRoleInTenant(supabase, targetId, tenantId);
	}

	let query = supabase
		.from("macro_table_permissions")
		.delete()
		.eq("macro_table_id", macroTableId);

	if (targetType === "user") {
		query = query.eq("user_id", targetId);
	} else {
		query = query.eq("role_id", targetId);
	}

	const { error } = await query;

	if (error) {
		console.error("Error removing macro table permission:", error);
		return { error: error.message };
	}

	revalidatePath("/admin/roles");
	return {};
}

// =====================================================
// EFFECTIVE PERMISSIONS
// =====================================================

export type EffectivePermission = {
	key: string;
	display_name: string | null;
	category: string;
	sources: {
		type: "admin" | "role" | "override";
		name: string;
	}[];
};

export async function getUserEffectivePermissions({
	userId,
	tenantId,
}: {
	userId: string;
	tenantId: string;
}): Promise<EffectivePermission[]> {
	const session = await auth();
	if (!session.data.user) throw new Error("Unauthorized");
	const supabase = await createClient();
	await requireRolesAdmin(supabase, tenantId);
	await requireUserInTenant(supabase, userId, tenantId);

	// Check if user is admin
	const { data: membership } = await supabase
		.from("memberships")
		.select("role")
		.eq("user_id", userId)
		.eq("tenant_id", tenantId)
		.single();

	const isAdmin = membership?.role === "owner" || membership?.role === "admin";

	// Get all permissions
	const { data: allPermissions } = await supabase
		.from("permissions")
		.select("id, key, display_name, category")
		.order("category")
		.order("sort_order");

	if (!allPermissions) return [];

	// If admin, they have all permissions
	if (isAdmin) {
		return allPermissions.map((p) => ({
			key: p.key,
			display_name: p.display_name,
			category: p.category,
			sources: [{ type: "admin" as const, name: membership?.role || "admin" }],
		}));
	}

	// Get user's roles in this tenant
	const { data: userRoles } = await supabase
		.from("user_roles")
		.select("role_id, roles!inner(name, tenant_id)")
		.eq("user_id", userId)
		.eq("roles.tenant_id", tenantId);

	const roleIds = (userRoles ?? []).map((ur) => ur.role_id);
	const roleNames: Record<string, string> = {};
	for (const ur of userRoles ?? []) {
		roleNames[ur.role_id] =
			readName(ur.roles as NameRelation) || "Unknown";
	}

	// Get permissions from roles
	let rolePermissions: { role_id: string; permission_id: string }[] = [];
	if (roleIds.length > 0) {
		const { data: rp } = await supabase
			.from("role_permissions")
			.select("role_id, permission_id")
			.in("role_id", roleIds);
		rolePermissions = rp ?? [];
	}

	// Get direct overrides
	const { data: overrides } = await supabase
		.from("user_permission_overrides")
		.select("permission_id, is_granted")
		.eq("user_id", userId)
		.eq("is_granted", true);

	const overrideIds = new Set((overrides ?? []).map((o) => o.permission_id));

	// Build effective permissions
	const result: EffectivePermission[] = [];

	for (const perm of allPermissions) {
		const sources: EffectivePermission["sources"] = [];

		// Check override
		if (overrideIds.has(perm.id)) {
			sources.push({ type: "override", name: "Direct Grant" });
		}

		// Check roles
		for (const rp of rolePermissions) {
			if (rp.permission_id === perm.id) {
				sources.push({
					type: "role",
					name: roleNames[rp.role_id] || "Unknown",
				});
			}
		}

		if (sources.length > 0) {
			result.push({
				key: perm.key,
				display_name: perm.display_name,
				category: perm.category,
				sources,
			});
		}
	}

	return result;
}

export async function getUserMacroTableAccess({
	userId,
	tenantId,
}: {
	userId: string;
	tenantId: string;
}): Promise<
	{
		macroTableId: string;
		macroTableName: string;
		level: PermissionLevel;
		source: string;
	}[]
> {
	const session = await auth();
	if (!session.data.user) throw new Error("Unauthorized");
	const supabase = await createClient();
	await requireRolesAdmin(supabase, tenantId);
	await requireUserInTenant(supabase, userId, tenantId);

	// Check if user is admin
	const { data: membership } = await supabase
		.from("memberships")
		.select("role")
		.eq("user_id", userId)
		.eq("tenant_id", tenantId)
		.single();

	const isAdmin = membership?.role === "owner" || membership?.role === "admin";

	// Get all macro tables for tenant
	const { data: macroTables } = await supabase
		.from("macro_tables")
		.select("id, name")
		.eq("tenant_id", tenantId);

	if (!macroTables) return [];

	// If admin, full access to all
	if (isAdmin) {
		return macroTables.map((mt) => ({
			macroTableId: mt.id,
			macroTableName: mt.name,
			level: "admin" as PermissionLevel,
			source: membership?.role || "admin",
		}));
	}

	// Get user's direct permissions
	const { data: userPerms } = await supabase
		.from("macro_table_permissions")
		.select("macro_table_id, permission_level")
		.eq("user_id", userId);

	// Get user's role permissions
	const { data: userRoles } = await supabase
		.from("user_roles")
		.select("role_id, roles!inner(tenant_id)")
		.eq("user_id", userId)
		.eq("roles.tenant_id", tenantId);

	const roleIds = (userRoles ?? []).map((ur) => ur.role_id);

	let rolePerms: {
		macro_table_id: string;
		permission_level: string;
		role_id: string;
	}[] = [];
	if (roleIds.length > 0) {
		const { data: rp } = await supabase
			.from("macro_table_permissions")
			.select("macro_table_id, permission_level, role_id")
			.in("role_id", roleIds);
		rolePerms = rp ?? [];
	}

	// Build result
	const result: {
		macroTableId: string;
		macroTableName: string;
		level: PermissionLevel;
		source: string;
	}[] = [];

	for (const mt of macroTables) {
		// Check direct user permission first
		const directPerm = (userPerms ?? []).find(
			(p) => p.macro_table_id === mt.id
		);
		if (directPerm) {
			result.push({
				macroTableId: mt.id,
				macroTableName: mt.name,
				level: directPerm.permission_level as PermissionLevel,
				source: "Direct",
			});
			continue;
		}

		// Check role permissions
		const rolePerm = rolePerms.find((p) => p.macro_table_id === mt.id);
		if (rolePerm) {
			result.push({
				macroTableId: mt.id,
				macroTableName: mt.name,
				level: rolePerm.permission_level as PermissionLevel,
				source: "Role",
			});
		}
	}

	return result;
}

// =====================================================
// NAVIGATION ACCESS
// =====================================================

// Define the navigation structure with required permissions
function getNavigationItems(): NavigationItem[] {
	return [
	{ path: "/", label: "Dashboard", permission: "nav:dashboard", icon: "Home" },
	{
		path: "/excel",
		label: "Excel/Obras",
		permission: "nav:excel",
		icon: "Database",
	},
	{
		path: "/excel/data-flow",
		label: "Data-flow",
		permission: "data-flow:read",
		icon: "Layers",
	},
	{
		path: "/certificados",
		label: "Certificados",
		permission: "nav:certificados",
		icon: "FileCheck",
	},
	{
		path: "/macro",
		label: "Macro Tablas",
		permission: "nav:macro",
		icon: "Layers",
	},
	{
		path: "/notifications",
		label: "Notificaciones",
		permission: "nav:notifications",
		icon: "Bell",
	},
	{
		path: "/document-generation/review",
		label: "Revision de documentos",
		permission: "documents:review",
		icon: "FileText",
	},
	{
		path: "/document-generation/config",
		label: "Configuracion documental",
		permission: "documents:templates",
		icon: "FileText",
	},
	{
		path: "/admin",
		label: "Administracion",
		permission: "nav:admin",
		icon: "Settings",
		children: [
			{ path: "/admin/users", label: "Usuarios", permission: "admin:users" },
			{
				path: "/admin/roles",
				label: "Roles y Permisos",
				permission: "admin:roles",
			},
			{
				path: "/admin/main-table-config",
				label: "Tabla Principal",
				permission: "admin:main-table-config",
			},
			{
				path: "/admin/obra-defaults",
				label: "Configuracion de Obras",
				permission: "admin:obra-defaults",
			},
			{
				path: "/admin/audit-log",
				label: "Auditoria",
				permission: "admin:audit",
			},
		],
	},
	];
}

export type NavigationItem = {
	path: string;
	label: string;
	permission: string;
	icon?: string;
	children?: NavigationItem[];
	hasAccess?: boolean;
};

export async function getNavigationWithAccess({
	permissionKeys,
}: {
	permissionKeys: string[];
}): Promise<NavigationItem[]> {
	const session = await auth();
	if (!session.data.user) throw new Error("Unauthorized");
	const supabase = await createClient();
	await requireRolesAdmin(supabase);
	const permSet = new Set(permissionKeys);

	const checkAccess = (item: NavigationItem): NavigationItem => {
		const hasAccess = permSet.has(item.permission);
		return {
			...item,
			hasAccess,
			children: item.children?.map(checkAccess),
		};
	};

	return getNavigationItems().map(checkAccess);
}

export async function getNavigationStructure(): Promise<NavigationItem[]> {
	const session = await auth();
	if (!session.data.user) throw new Error("Unauthorized");
	const supabase = await createClient();
	await requireRolesAdmin(supabase);
	return getNavigationItems();
}
