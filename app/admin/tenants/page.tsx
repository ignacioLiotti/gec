import Link from "next/link";

import { createClient } from "@/utils/supabase/server";
import { Badge } from "@/components/ui/badge";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";
import { TenantSwitchButton } from "@/components/tenant-switch-button";

const SUPERADMIN_USER_ID = "77b936fb-3e92-4180-b601-15c31125811e";

type TenantRecord = {
	id: string;
	name: string;
	created_at: string;
};

type OwnerRecord = {
	tenant_id: string;
	user_id: string;
	profiles: { full_name: string | null } | null;
};

type InvitationRecord = {
	id: string;
	tenant_id: string;
	email: string;
	invited_role: string;
	status: string;
};

export default async function TenantsAdminPage() {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return <div className="p-6 text-sm">Iniciá sesión para ver las organizaciones.</div>;
	}

	const { data: profile } = await supabase
		.from("profiles")
		.select("is_superadmin")
		.eq("user_id", user.id)
		.maybeSingle();
	const isSuperAdmin =
		(profile?.is_superadmin ?? false) || user.id === SUPERADMIN_USER_ID;

	// Check if user should see all organizations
	const showAllOrgs = isSuperAdmin || user.email === "ignacioliotti@gmail.com";

	const { data: memberships, error: membershipError } = await supabase
		.from("memberships")
		.select("tenant_id, role")
		.eq("user_id", user.id)
		.in("role", ["owner", "admin"]);
	console.log("[admin/tenants] memberships", memberships, membershipError);

	if (membershipError) {
		return (
			<div className="p-6 text-sm text-destructive">
				No se pudo verificar tu rol en las organizaciones.
			</div>
		);
	}

	const memberTenantIds = (memberships ?? []).map((m) => m.tenant_id);
	if (!showAllOrgs && memberTenantIds.length === 0) {
		return (
			<div className="p-6 text-sm">
				Necesitás ser administrador de al menos una organización para verla.
			</div>
		);
	}

	const adminClient = createSupabaseAdminClient();
	const tenantClient = showAllOrgs ? adminClient : supabase;
	console.log("[admin/tenants] tenant query client", showAllOrgs ? "admin" : "user", {
		memberTenantIds,
	});
	let tenantQuery = tenantClient
		.from("tenants")
		.select("id, name, created_at")
		.order("created_at", { ascending: true });

	if (!showAllOrgs) {
		tenantQuery = tenantQuery.in("id", memberTenantIds);
	}

	const { data: tenantRows, error: tenantsError } = await tenantQuery;

	console.log("[admin/tenants] tenants result", tenantRows, tenantsError);

	if (tenantsError) {
		return (
			<div className="p-6 text-sm text-destructive">
				No se pudieron cargar las organizaciones. Intentalo más tarde.
			</div>
		);
	}

	const tenantIds = (tenantRows ?? []).map((row) => row.id);
	const detailClient = adminClient;
	const [ownerResult, invitationResult] = tenantIds.length
		? await Promise.all([
				detailClient
					.from("memberships")
					.select("tenant_id, user_id")
					.eq("role", "owner")
					.in("tenant_id", tenantIds),
				detailClient
					.from("invitations")
					.select("id, tenant_id, email, invited_role, status")
					.eq("status", "pending")
					.in("tenant_id", tenantIds),
		  ])
		: [{ data: [], error: null }, { data: [], error: null }];
	const ownerIds = (ownerResult.data ?? []).map((row) => row.user_id);
	const { data: ownerProfiles, error: ownerProfilesError } = ownerIds.length
		? await detailClient
				.from("profiles")
				.select("user_id, full_name")
				.in("user_id", ownerIds)
		: { data: [], error: null };

	console.log("[admin/tenants] owner result", ownerResult);
	console.log("[admin/tenants] owner profile result", ownerProfiles, ownerProfilesError);
	console.log("[admin/tenants] invitation result", invitationResult);

	if (ownerResult.error || invitationResult.error || ownerProfilesError) {
		return (
			<div className="p-6 text-sm text-destructive">
				No se pudieron cargar los detalles de miembros o invitaciones.
			</div>
		);
	}

	const ownerNameByUser = new Map(
		(ownerProfiles ?? []).map((profile: any) => [profile.user_id, profile.full_name])
	);
	const owners = (ownerResult.data ?? []).map((row) => {
		const fullName = ownerNameByUser.get(row.user_id) ?? null;
		return {
			tenant_id: row.tenant_id,
			user_id: row.user_id,
			profiles: { full_name: fullName },
		} as OwnerRecord;
	});
	const invitations = (invitationResult.data ?? []) as InvitationRecord[];

	const ownerByTenant = new Map<string, OwnerRecord>();
	for (const owner of owners) {
		if (!ownerByTenant.has(owner.tenant_id)) {
			ownerByTenant.set(owner.tenant_id, owner);
		}
	}

	const invitationsByTenant = new Map<string, InvitationRecord[]>();
	for (const invite of invitations) {
		if (!invitationsByTenant.has(invite.tenant_id)) {
			invitationsByTenant.set(invite.tenant_id, []);
		}
		invitationsByTenant.get(invite.tenant_id)!.push(invite);
	}

	return (
		<div className="space-y-6 p-6">
			<div>
				<h1 className="text-2xl font-semibold">Organizaciones</h1>
				<p className="text-sm text-muted-foreground">
					Revisá cada tenant, su propietario y las invitaciones activas. Podés cambiarte con un clic.
				</p>
			</div>

			<div className="space-y-4">
				{tenantRows?.map((tenant) => {
					const owner = ownerByTenant.get(tenant.id);
					const pendingInvites = invitationsByTenant.get(tenant.id) ?? [];
					return (
						<div key={tenant.id} className="rounded-xl border p-4">
							<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
								<div>
									<h2 className="text-lg font-semibold">{tenant.name}</h2>
									<p className="text-xs text-muted-foreground">
										ID: {tenant.id} • Creada el {new Date(tenant.created_at).toLocaleDateString()}
									</p>
									<p className="text-sm text-muted-foreground">
										Propietario: {owner?.profiles?.full_name ?? owner?.user_id ?? "—"}
									</p>
								</div>
								<TenantSwitchButton tenantId={tenant.id}>
									Cambiar a esta organización
								</TenantSwitchButton>
							</div>
							<div className="mt-4 space-y-2">
								<div className="flex items-center gap-2">
									<p className="text-sm font-medium">Invitaciones</p>
									<Badge variant="secondary">{pendingInvites.length}</Badge>
								</div>
								{pendingInvites.length === 0 ? (
									<p className="text-sm text-muted-foreground">No hay invitaciones activas.</p>
								) : (
									<ul className="space-y-2 text-sm">
										{pendingInvites.map((invite) => (
											<li
												key={invite.id}
												className="flex items-center justify-between rounded-md border px-3 py-1.5"
											>
												<span className="truncate">{invite.email}</span>
												<Badge variant="outline" className="capitalize">
													{invite.invited_role}
												</Badge>
											</li>
										))}
									</ul>
								)}
							</div>
						</div>
					);
				})}
				{!tenantRows?.length && (
					<div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
						No hay organizaciones creadas todavía.
					</div>
				)}
			</div>
		</div>
	);
}
