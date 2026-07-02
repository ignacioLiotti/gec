export const OWNER_IMPERSONATION_EMAIL = "ignaciolati@gmail.com";

export function canStartImpersonation({
	isSuperAdmin,
	actorEmail,
}: {
	isSuperAdmin: boolean;
	actorEmail?: string | null;
}): { allowed: boolean; auditTenantId: string | null } {
	return {
		allowed:
			isSuperAdmin &&
			actorEmail?.trim().toLowerCase() === OWNER_IMPERSONATION_EMAIL,
		auditTenantId: null,
	};
}
