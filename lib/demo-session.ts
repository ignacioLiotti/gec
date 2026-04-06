import { createHash } from "node:crypto";
import { cookies } from "next/headers";

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
	user: Awaited<ReturnType<Awaited<ReturnType<typeof createClient>>["auth"]["getUser"]>>["data"]["user"] | null;
	tenantId: string | null;
	tenantName: string | null;
	memberships: TenantMembershipRow[];
	isSuperAdmin: boolean;
	membershipRole: string | null;
	demoSession: DemoSession | null;
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
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (user) {
		const [{ data: profile }, { data: memberships, error: membershipsError }] =
			await Promise.all([
				supabase
					.from("profiles")
					.select("is_superadmin")
					.eq("user_id", user.id)
					.maybeSingle(),
				supabase
					.from("memberships")
					.select("tenant_id, role, tenants(name)")
					.eq("user_id", user.id)
					.order("created_at", { ascending: true }),
			]);

		if (membershipsError) {
			console.error("[demo-session] failed to fetch memberships", membershipsError);
		}

		const isSuperAdmin = profile?.is_superadmin ?? false;
		const resolvedMembership = await resolveTenantMembership(
			(memberships ?? []) as TenantMembershipRow[],
			{ isSuperAdmin },
		);

		return {
			actorType: "user",
			supabase,
			user,
			tenantId: resolvedMembership.tenantId,
			tenantName: getTenantName(resolvedMembership.activeMembership as TenantMembershipRow | null),
			memberships: resolvedMembership.memberships as TenantMembershipRow[],
			isSuperAdmin,
			membershipRole: resolvedMembership.activeMembership?.role ?? null,
			demoSession: null,
		};
	}

	const demoSession = await resolveDemoSessionFromCookies();
	if (demoSession) {
		const admin = createSupabaseAdminClient();
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
			user: null,
			tenantId: demoSession.tenantId,
			tenantName: demoSession.tenantName,
			memberships: [demoMembership],
			isSuperAdmin: false,
			membershipRole: "member",
			demoSession,
		};
	}

	const cookieStore = await cookies();
	const preferredTenantId = cookieStore.get(ACTIVE_TENANT_COOKIE)?.value ?? null;

	return {
		actorType: "anonymous",
		supabase,
		user: null,
		tenantId: preferredTenantId,
		tenantName: null,
		memberships: [],
		isSuperAdmin: false,
		membershipRole: null,
		demoSession: null,
	};
}
