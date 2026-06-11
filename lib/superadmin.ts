const envSuperadminIds = (process.env.SUPERADMIN_USER_IDS ?? "")
	.split(",")
	.map((id) => id.trim())
	.filter(Boolean);

const envSuperadminEmails = (process.env.SUPERADMIN_EMAILS ?? "")
	.split(",")
	.map((email) => email.trim().toLowerCase())
	.filter(Boolean);

/**
 * A user is superadmin if their profile flag says so, or their identity is in
 * the deploy-time owner allowlist.
 */
export function isSuperAdminUser(
	userId: string | null | undefined,
	profileIsSuperadmin?: boolean | null,
	userEmail?: string | null,
): boolean {
	if (profileIsSuperadmin === true) return true;
	if (userId && envSuperadminIds.includes(userId)) return true;
	if (userEmail && envSuperadminEmails.includes(userEmail.toLowerCase())) {
		return true;
	}
	return false;
}
