import { createClient } from "@/utils/supabase/server";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";
import { resolveTenantMembership } from "@/lib/tenant-selection";
import DemoLinksPanel from "./demo-links-panel";

const SUPERADMIN_USER_ID = "77b936fb-3e92-4180-b601-15c31125811e";

type PageProps = {
	searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DemoLinksPage({ searchParams }: PageProps) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return <div className="p-6 text-sm">Inicia sesion primero.</div>;
	}

	const resolvedSearch = (await searchParams) ?? {};
	const requestedTenantValue = resolvedSearch?.tenantId;
	const requestedTenantId = Array.isArray(requestedTenantValue)
		? requestedTenantValue[0]
		: requestedTenantValue;

	const { data: memberships, error: membershipError } = await supabase
		.from("memberships")
		.select("tenant_id, role")
		.eq("user_id", user.id)
		.in("role", ["owner", "admin"])
		.order("created_at", { ascending: true });

	const { data: profile } = await supabase
		.from("profiles")
		.select("is_superadmin")
		.eq("user_id", user.id)
		.maybeSingle();

	const isSuperAdmin =
		(profile?.is_superadmin ?? false) || user.id === SUPERADMIN_USER_ID;

	if (membershipError && !isSuperAdmin) {
		return (
			<div className="p-6 text-sm text-destructive">
				No se pudo verificar tu membresia de administrador.
			</div>
		);
	}

	const { tenantId: preferredTenant } = await resolveTenantMembership(
		(memberships ?? []) as { tenant_id: string | null; role: string | null }[],
		{ isSuperAdmin },
	);
	let tenantId = preferredTenant;

	if (requestedTenantId) {
		const hasRequested = (memberships ?? []).some(
			(membership) => membership.tenant_id === requestedTenantId,
		);
		if (hasRequested || isSuperAdmin) {
			tenantId = requestedTenantId;
		} else {
			tenantId = null;
		}
	}

	if (!tenantId) {
		return (
			<div className="p-6 text-sm">
				No tenes permisos de administrador para gestionar demos.
			</div>
		);
	}

	const admin = createSupabaseAdminClient();
	const [{ data: tenant }, { data: links, error: linksError }] = await Promise.all([
		admin.from("tenants").select("id, name").eq("id", tenantId).maybeSingle(),
		admin
			.from("tenant_demo_links")
			.select(
				"id, slug, label, expires_at, last_seen_at, created_at, revoked_at, allowed_capabilities",
			)
			.eq("tenant_id", tenantId)
			.order("created_at", { ascending: false }),
	]);

	if (linksError) {
		return (
			<div className="p-6 text-sm text-destructive">
				No se pudieron cargar los demo links de la organizacion.
			</div>
		);
	}

	return (
		<div className="space-y-6 p-6">
			<div>
				<h1 className="text-2xl font-semibold">Demo Links</h1>
				<p className="text-sm text-muted-foreground">
					Crea accesos sin login para demos comerciales sobre una organizacion real.
				</p>
			</div>

			<DemoLinksPanel
				tenantId={tenantId}
				tenantName={tenant?.name ?? "Organizacion"}
				initialLinks={links ?? []}
			/>
		</div>
	);
}
