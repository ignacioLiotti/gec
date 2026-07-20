import { canStartImpersonation } from "@/lib/impersonation-access";
import { isSuperAdminUser } from "@/lib/superadmin";
import { resolveTenantMembership } from "@/lib/tenant-selection";
import { hasPermission } from "@/lib/route-guard";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";
import { PendingInvitationsList } from "./_components/pending-invitations-list";
import { UsersPageClient } from "./users-page-client";

export default async function AdminUsersPage() {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) return <div className="p-6 text-sm">Inicia sesion primero.</div>;

	const { data: memberships } = await supabase
		.from("memberships")
		.select("tenant_id, role")
		.eq("user_id", user.id)
		.order("created_at", { ascending: true });

	const { data: profile } = await supabase
		.from("profiles")
		.select("is_superadmin")
		.eq("user_id", user.id)
		.maybeSingle();
	const isSuperAdmin = isSuperAdminUser(
		user.id,
		profile?.is_superadmin,
		user.email,
	);

	const { tenantId, activeMembership } = await resolveTenantMembership(
		(memberships ?? []) as { tenant_id: string | null; role: string | null }[],
		{ isSuperAdmin },
	);
	if (!tenantId) {
		return (
			<div className="p-6 text-sm">
				No se encontró una membresía de organización.
			</div>
		);
	}

	const [canManageRoles, canManageUsers] = isSuperAdmin
		? [true, true]
		: await Promise.all([
			hasPermission("admin:roles"),
			hasPermission("admin:users"),
		]);
	if (!canManageUsers) {
		return <div className="p-6 text-sm">Sin permisos de administrador.</div>;
	}

	const [{ data: members }, { data: roles }, { data: permissions }] =
		await Promise.all([
			supabase
				.from("memberships")
				.select("user_id, role")
				.eq("tenant_id", tenantId)
				.order("role", { ascending: true }),
			supabase
				.from("roles")
				.select("id, name, description, color")
				.eq("tenant_id", tenantId)
				.order("name"),
			supabase
				.from("permissions")
				.select("id, key, description, category, display_name, sort_order")
				.order("category")
				.order("sort_order"),
		]);

	const memberIds = (members ?? []).map((member) => member.user_id);
	const [userRolesResult, overridesResult] =
		memberIds.length > 0
			? await Promise.all([
				supabase
					.from("user_roles")
					.select("user_id, role_id, roles!inner(tenant_id)")
					.in("user_id", memberIds)
					.eq("roles.tenant_id", tenantId),
				supabase
					.from("user_permission_overrides")
					.select("user_id, is_granted")
					.eq("tenant_id", tenantId)
					.in("user_id", memberIds),
			])
			: [{ data: [] }, { data: [] }];

	const roleIdsByUser = new Map<string, string[]>();
	for (const assignment of userRolesResult.data ?? []) {
		const current = roleIdsByUser.get(assignment.user_id) ?? [];
		current.push(assignment.role_id);
		roleIdsByUser.set(assignment.user_id, current);
	}

	const overrideCountsByUser = new Map<
		string,
		{ granted: number; denied: number }
	>();
	for (const override of overridesResult.data ?? []) {
		const current = overrideCountsByUser.get(override.user_id) ?? {
			granted: 0,
			denied: 0,
		};
		if (override.is_granted) {
			current.granted += 1;
		} else {
			current.denied += 1;
		}
		overrideCountsByUser.set(override.user_id, current);
	}

	const admin = createSupabaseAdminClient();
	const users = await Promise.all(
		memberIds.map(async (userId) => {
			const membership = members?.find((member) => member.user_id === userId);
			const overrideCounts = overrideCountsByUser.get(userId) ?? {
				granted: 0,
				denied: 0,
			};

			try {
				const { data } = await admin.auth.admin.getUserById(userId);
				return {
					user_id: data.user?.id ?? userId,
					full_name:
						data.user?.user_metadata?.display_name ??
						data.user?.user_metadata?.full_name ??
						null,
					email: data.user?.email ?? null,
					membership_role: membership?.role ?? "member",
					assigned_role_ids: roleIdsByUser.get(userId) ?? [],
					override_count: overrideCounts.granted,
					denied_override_count: overrideCounts.denied,
					created_at: data.user?.created_at ?? null,
					last_sign_in_at: data.user?.last_sign_in_at ?? null,
				};
			} catch (error) {
				console.error(`Failed to fetch user ${userId}:`, error);
				return {
					user_id: userId,
					full_name: null,
					email: null,
					membership_role: membership?.role ?? "member",
					assigned_role_ids: roleIdsByUser.get(userId) ?? [],
					override_count: overrideCounts.granted,
					denied_override_count: overrideCounts.denied,
					created_at: null,
					last_sign_in_at: null,
				};
			}
		}),
	);

	const impersonationAccess = canStartImpersonation({
		isSuperAdmin,
		actorEmail: user.email,
	});

	return (
		<div className="min-h-screen bg-canvas px-4 py-6 text-content sm:px-6 lg:px-8">
			<div className="mx-auto max-w-[90rem] space-y-5">
				<UsersPageClient
					users={users}
					tenantId={tenantId}
					allRoles={roles ?? []}
					allPermissions={permissions ?? []}
					canImpersonate={impersonationAccess.allowed}
					canManageUsers={canManageUsers}
					canManageRoles={canManageRoles}
					canAssignOwner={
						isSuperAdmin || activeMembership?.role === "owner"
					}
				/>
				<PendingInvitationsList tenantId={tenantId} />
			</div>
		</div>
	);
}
