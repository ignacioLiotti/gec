import { describe, expect, it } from "vitest";

import { isPreTenantRoute } from "@/lib/pre-tenant-routes";

describe("isPreTenantRoute", () => {
	it.each([
		"/",
		"/onboarding",
		"/tenants/new",
		"/invitations/invite-token",
		"/auth/callback",
		"/demo/example",
	])("allows %s before a user has a tenant", (pathname) => {
		expect(isPreTenantRoute(pathname)).toBe(true);
	});

	it.each(["/dashboard", "/excel", "/setup", "/admin/users"])(
		"keeps %s behind the tenant membership check",
		(pathname) => {
			expect(isPreTenantRoute(pathname)).toBe(false);
		},
	);
});
