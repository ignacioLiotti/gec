const TENANT_NEUTRAL_EXCEL_ROUTES = new Set([
	"/excel",
	"/excel/data-flow",
	"/excel/formtext",
	"/excel/listtest",
	"/excel/papelera-obras",
	"/excel/reporte",
]);

export function getTenantSwitchReturnPath(
	pathname: string,
	search = "",
	hash = "",
) {
	if (pathname.startsWith("/excel/") && !TENANT_NEUTRAL_EXCEL_ROUTES.has(pathname)) {
		return "/excel";
	}
	if (pathname.startsWith("/macro/") || (pathname === "/macro" && search.includes("macroId="))) {
		return "/macro";
	}
	if (pathname.startsWith("/invitations/")) {
		return "/dashboard";
	}

	return `${pathname}${search}${hash}`;
}
