export function isPreTenantRoute(pathname: string) {
	return (
		pathname === "/" ||
		pathname === "/onboarding" ||
		pathname === "/tenants/new" ||
		pathname.startsWith("/invitations/") ||
		pathname.startsWith("/auth/") ||
		pathname.startsWith("/demo/")
	);
}
