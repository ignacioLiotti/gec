import { cookies } from "next/headers";

export const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000001";
export const ACTIVE_TENANT_COOKIE = "active_tenant_id";

export type MembershipLike = {
	tenant_id: string | null;
	role?: string | null;
};

type ResolveOptions = {
	isSuperAdmin?: boolean;
	fallbackRole?: string | null;
};

/**
 * Given a list of tenant memberships, determine which tenant should be active.
 * Preference order:
 * 1. Membership that matches the `active_tenant_id` cookie (if present)
 * 2. First membership in the list
 * 3. Default tenant when the user is a superadmin
 */
export async function resolveTenantMembership<T extends MembershipLike>(
	memberships: T[] | null | undefined,
	options: ResolveOptions = {}
) {
	const { isSuperAdmin = false, fallbackRole = "admin" } = options;
	let resolved = memberships ? [...memberships] : [];

	if ((!resolved || resolved.length === 0) && isSuperAdmin) {
		resolved = [
			{
				tenant_id: DEFAULT_TENANT_ID,
				role: fallbackRole,
			} as T,
		];
	}

	const cookieStore = await cookies();
	const preferredTenantId = cookieStore.get(ACTIVE_TENANT_COOKIE)?.value;

	const preferredMembership = preferredTenantId
		? resolved.find((membership) => membership.tenant_id === preferredTenantId)
		: undefined;

	let activeMembership = preferredMembership ?? resolved?.[0] ?? null;
	if (!activeMembership && preferredTenantId && isSuperAdmin) {
		activeMembership = {
			tenant_id: preferredTenantId,
			role: fallbackRole,
		} as T;
	}
	const tenantId =
		activeMembership?.tenant_id ??
		(isSuperAdmin ? DEFAULT_TENANT_ID : null);

	return {
		tenantId,
		activeMembership,
		memberships: resolved,
	};
}
