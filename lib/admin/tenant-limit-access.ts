const LIMITS_MANAGER_EMAIL = "ignacioliotti@gmail.com";

export function canManageTenantLimits(email: string | null | undefined): boolean {
	return (email ?? "").trim().toLowerCase() === LIMITS_MANAGER_EMAIL;
}

export { LIMITS_MANAGER_EMAIL };
