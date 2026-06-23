import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";

import {
	ACTIVE_TENANT_COOKIE,
	resolveTenantMembership,
	type MembershipLike,
} from "@/lib/tenant-selection";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";
import {
	getDefaultDemoAppPath,
	hasAnyDemoCapability,
	hasDemoCapability,
	isDemoPathAllowed,
	type DemoCapability,
	normalizeDemoCapabilities,
} from "@/lib/demo-capabilities";
import {
	parsePermissionSimulationCookie,
	PERMISSION_SIMULATION_COOKIE,
	type PermissionSimulation,
} from "@/lib/permission-simulation";
import { isSuperAdminUser } from "@/lib/superadmin";

export const DEMO_SESSION_COOKIE = "demo_session";

type TenantMembershipRow = MembershipLike & {
	tenants?: { name: string | null } | { name: string | null }[] | null;
};

type DemoLinkRecord = {
	id: string;
	tenant_id: string;
	slug: string;
	label: string | null;
	token_hash: string;
	allowed_capabilities?: unknown;
	expires_at: string | null;
	last_seen_at?: string | null;
	revoked_at?: string | null;
	tenants?: { name: string | null } | { name: string | null }[] | null;
};

export type DemoSession = {
	id: string;
	tenantId: string;
	tenantName: string | null;
	slug: string;
	label: string | null;
	allowedCapabilities: DemoCapability[];
	expiresAt: string | null;
};

export {
	getDefaultDemoAppPath,
	hasAnyDemoCapability,
	hasDemoCapability,
	isDemoPathAllowed,
	type DemoCapability,
};

export type RequestAccessContext = {
	actorType: "anonymous" | "user" | "demo";
	supabase: Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createSupabaseAdminClient>;
	user: User | null;
	tenantId: string | null;
	tenantName: string | null;
	memberships: TenantMembershipRow[];
	isSuperAdmin: boolean;
	actualIsSuperAdmin: boolean;
	membershipRole: string | null;
	demoSession: DemoSession | null;
	permissionSimulation: PermissionSimulation | null;
};

function getTenantName(
	row:
		| { tenants?: { name: string | null } | { name: string | null }[] | null }
		| null
		| undefined,
) {
	if (!row?.tenants) return null;
	return Array.isArray(row.tenants)
		? (row.tenants[0]?.name ?? null)
		: (row.tenants.name ?? null);
}

async function loadUserMemberships(
	supabase: Awaited<ReturnType<typeof createClient>>,
	userId: string,
) {
	const { data, error } = await supabase
		.from("memberships")
		.select("tenant_id, role, tenants(name)")
		.eq("user_id", userId)
		.order("created_at", { ascending: true });

	if (!error) {
		return (data ?? []) as TenantMembershipRow[];
	}

	console.warn("[demo-session] memberships join failed; using fallback", {
		code: error.code,
		message: error.message,
	});

	const { data: fallbackRows, error: fallbackError } = await supabase
		.from("memberships")
		.select("tenant_id, role")
		.eq("user_id", userId)
		.order("created_at", { ascending: true });

	if (fallbackError) {
		console.warn("[demo-session] memberships fallback failed", {
			code: fallbackError.code,
			message: fallbackError.message,
		});
		return [];
	}

	const memberships = (fallbackRows ?? []) as TenantMembershipRow[];
	const tenantIds = memberships
		.map((membership) => membership.tenant_id)
		.filter((tenantId): tenantId is string => Boolean(tenantId));

	if (tenantIds.length === 0) {
		return memberships;
	}

	const { data: tenants } = await supabase
		.from("tenants")
		.select("id, name")
		.in("id", tenantIds);
	const tenantNameById = new Map(
		(tenants ?? []).map((tenant) => [tenant.id, tenant.name ?? null]),
	);

	return memberships.map((membership) => ({
		...membership,
		tenants: membership.tenant_id
			? { name: tenantNameById.get(membership.tenant_id) ?? null }
			: null,
	}));
}

function normalizeCapabilities(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value
		.filter((item): item is string => typeof item === "string")
		.map((item) => item.trim())
		.filter((item) => item.length > 0);
}

function parseDemoSessionCookie(rawValue: string | undefined) {
	if (!rawValue) return null;
	const separatorIndex = rawValue.indexOf(":");
	if (separatorIndex <= 0) return null;

	try {
		const slug = decodeURIComponent(rawValue.slice(0, separatorIndex));
		const token = decodeURIComponent(rawValue.slice(separatorIndex + 1));
		if (!slug || !token) return null;
		return { slug, token };
	} catch {
		return null;
	}
}

export function buildDemoSessionCookieValue(slug: string, token: string) {
	return `${encodeURIComponent(slug)}:${encodeURIComponent(token)}`;
}

export function hashDemoToken(token: string) {
	return createHash("sha256").update(token).digest("hex");
}

function createDemoUserId(seed: string) {
	const hash = createHash("sha256").update(seed).digest("hex").slice(0, 32);
	return [
		hash.slice(0, 8),
		hash.slice(8, 12),
		`4${hash.slice(13, 16)}`,
		`a${hash.slice(17, 20)}`,
		hash.slice(20, 32),
	].join("-");
}

function createDemoUser(session: DemoSession): User {
	const id = createDemoUserId(`${session.id}:${session.tenantId}:${session.slug}`);
	return {
		id,
		app_metadata: { provider: "demo", providers: ["demo"] },
		user_metadata: {
			is_demo_user: true,
			demo_slug: session.slug,
			demo_label: session.label,
			tenant_id: session.tenantId,
		},
		aud: "authenticated",
		created_at: session.expiresAt ?? new Date().toISOString(),
		email: `demo+${session.slug}@syntesis.demo`,
		role: "authenticated",
	} as User;
}

export async function getDemoLinkBySlug(slug: string) {
	const admin = createSupabaseAdminClient();
	const { data, error } = await admin
		.from("tenant_demo_links")
		.select("id, tenant_id, slug, label, token_hash, allowed_capabilities, expires_at, revoked_at, tenants(name)")
		.eq("slug", slug)
		.maybeSingle();

	if (error) {
		console.error("[demo-session] failed to load demo link", { slug, error });
		return null;
	}

	return (data as DemoLinkRecord | null) ?? null;
}

export async function validateDemoLinkAccess(slug: string, token: string) {
	const link = await getDemoLinkBySlug(slug);
	if (!link) return { ok: false as const, reason: "not-found" };
	if (link.revoked_at) return { ok: false as const, reason: "revoked" };
	if (link.expires_at && new Date(link.expires_at).getTime() <= Date.now()) {
		return { ok: false as const, reason: "expired" };
	}
	if (hashDemoToken(token) !== link.token_hash) {
		return { ok: false as const, reason: "invalid-token" };
	}
	return { ok: true as const, link };
}

export async function resolveDemoSessionFromCookies() {
	const cookieStore = await cookies();
	const parsed = parseDemoSessionCookie(
		cookieStore.get(DEMO_SESSION_COOKIE)?.value,
	);

	if (!parsed) return null;

	const validation = await validateDemoLinkAccess(parsed.slug, parsed.token);
	if (!validation.ok) {
		return null;
	}
	const link = validation.link;

	const admin = createSupabaseAdminClient();
	await admin
		.from("tenant_demo_links")
		.update({ last_seen_at: new Date().toISOString() })
		.eq("id", link.id);

	return {
		id: link.id,
		tenantId: link.tenant_id,
		tenantName: getTenantName(link),
		slug: link.slug,
		label: link.label ?? null,
		allowedCapabilities: normalizeDemoCapabilities(
			normalizeCapabilities(link.allowed_capabilities),
		),
		expiresAt: link.expires_at ?? null,
	} satisfies DemoSession;
}

export async function resolveRequestAccessContext(): Promise<RequestAccessContext> {
	const supabase = await createClient();
	const cookieStore = await cookies();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (user) {
		const [{ data: profile }, memberships] = await Promise.all([
			supabase
				.from("profiles")
				.select("is_superadmin")
				.eq("user_id", user.id)
				.maybeSingle(),
			loadUserMemberships(supabase, user.id),
		]);

		const isSuperAdmin = isSuperAdminUser(
			user.id,
			profile?.is_superadmin,
			user.email,
		);
		const permissionSimulation = isSuperAdmin
			? parsePermissionSimulationCookie(
					cookieStore.get(PERMISSION_SIMULATION_COOKIE)?.value,
				)
			: null;
		const resolvedMembership = await resolveTenantMembership(
			memberships,
			{ isSuperAdmin },
		);
		const isSimulatingPermissions = Boolean(permissionSimulation);

		return {
			actorType: "user",
			supabase,
			user,
			tenantId: resolvedMembership.tenantId,
			tenantName: getTenantName(resolvedMembership.activeMembership as TenantMembershipRow | null),
			memberships: resolvedMembership.memberships as TenantMembershipRow[],
			isSuperAdmin: isSimulatingPermissions ? false : isSuperAdmin,
			actualIsSuperAdmin: isSuperAdmin,
			membershipRole: isSimulatingPermissions
				? "member"
				: (resolvedMembership.activeMembership?.role ?? null),
			demoSession: null,
			permissionSimulation,
		};
	}

	const demoSession = await resolveDemoSessionFromCookies();
	if (demoSession) {
		const admin = createSupabaseAdminClient();
		const demoUser = createDemoUser(demoSession);
		const demoMembership: TenantMembershipRow = {
			tenant_id: demoSession.tenantId,
			role: "member",
			tenants: demoSession.tenantName
				? { name: demoSession.tenantName }
				: null,
		};

		return {
			actorType: "demo",
			supabase: admin,
			user: demoUser,
			tenantId: demoSession.tenantId,
			tenantName: demoSession.tenantName,
			memberships: [demoMembership],
			isSuperAdmin: false,
			actualIsSuperAdmin: false,
			membershipRole: "member",
			demoSession,
			permissionSimulation: null,
		};
	}

	const preferredTenantId = cookieStore.get(ACTIVE_TENANT_COOKIE)?.value ?? null;

	return {
		actorType: "anonymous",
		supabase,
		user: null,
		tenantId: preferredTenantId,
		tenantName: null,
		memberships: [],
		isSuperAdmin: false,
		actualIsSuperAdmin: false,
		membershipRole: null,
		demoSession: null,
		permissionSimulation: null,
	};
}
