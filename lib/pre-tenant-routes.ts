export function isPreTenantRoute(pathname: string) {
	return (
		pathname === "/" ||
		pathname === "/privacy" ||
		pathname === "/onboarding" ||
		pathname === "/tenants/new" ||
		pathname.startsWith("/portfolio") ||
		pathname.startsWith("/invitations/") ||
		pathname.startsWith("/auth/") ||
		/^\/whatsapp\/(flow|respond)\/[^/]+(?:\/thanks)?$/.test(pathname) ||
		pathname.startsWith("/demo/")
	);
}
