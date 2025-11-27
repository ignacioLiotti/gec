import { createClient } from "@/utils/supabase/server";
import TenantSecretsPanel from "./tenant-secrets-panel";

const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000001";
const SUPERADMIN_USER_ID = "77b936fb-3e92-4180-b601-15c31125811e";

type PageProps = {
	searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TenantSecretsPage({ searchParams }: PageProps) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return <div className="p-6 text-sm">Iniciá sesión primero.</div>;
	}

	const resolvedSearch = (await searchParams) ?? {};
	const requestedTenantValue = resolvedSearch?.tenantId;
	const requestedTenantId = Array.isArray(requestedTenantValue)
		? requestedTenantValue[0]
		: requestedTenantValue;

	let membershipQuery = supabase
		.from("memberships")
		.select("tenant_id, role")
		.eq("user_id", user.id)
		.in("role", ["owner", "admin"])
		.order("created_at", { ascending: true })
		.limit(1);

	if (requestedTenantId) {
		membershipQuery = membershipQuery.eq("tenant_id", requestedTenantId);
	}

	const { data: membership, error: membershipError } =
		await membershipQuery.maybeSingle();

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
				No se pudo verificar tu membresía de administrador.
			</div>
		);
	}

	let tenantId = membership?.tenant_id ?? null;

	if (!tenantId && isSuperAdmin) {
		tenantId = requestedTenantId ?? DEFAULT_TENANT_ID;
	}

	if (!tenantId) {
		return (
			<div className="p-6 text-sm">
				No tenés permisos de administrador para gestionar secretos.
			</div>
		);
	}

	const { data: tenant } = await supabase
		.from("tenants")
		.select("id, name")
		.eq("id", tenantId)
		.maybeSingle();

	const { data: secrets, error: secretsError } = await supabase
		.from("tenant_api_secrets")
		.select(
			"id, version, status, valid_from, valid_to, created_at, rotated_at"
		)
		.eq("tenant_id", tenantId)
		.order("version", { ascending: false })
		.limit(20);

	if (secretsError) {
		return (
			<div className="p-6 text-sm text-destructive">
				No se pudieron cargar los secretos de la organización.
			</div>
		);
	}

	return (
		<div className="p-6 space-y-6">
			<div>
				<h1 className="text-2xl font-semibold">Secretos de Inquilino</h1>
				<p className="text-sm text-foreground/70">
					Gestioná los secretos firmados utilizados por integraciones
					automatizadas. Usá la rotación para generar la próxima versión con
					períodos de gracia opcionales.
				</p>
			</div>
			<TenantSecretsPanel
				tenantId={tenantId}
				tenantName={tenant?.name ?? "Organización"}
				initialSecrets={secrets ?? []}
				requestedTenantId={requestedTenantId}
			/>
		</div>
	);
}
