import { describe, expect, it } from "vitest";

import { isPreTenantRoute } from "@/lib/pre-tenant-routes";

describe("isPreTenantRoute", () => {
	it.each([
		"/",
		"/privacy",
		"/onboarding",
		"/tenants/new",
		"/portfolio",
		"/portfolio/case-study",
		"/invitations/invite-token",
		"/auth/callback",
		"/auth/sign-up",
		"/auth/sign-in",
		"/demo/example",
		"/whatsapp/flow/run-id",
		"/whatsapp/flow/run-id/thanks",
		"/whatsapp/respond/run-id",
		"/whatsapp/respond/run-id/thanks",
	])("allows %s before a user has a tenant", (pathname) => {
		expect(isPreTenantRoute(pathname)).toBe(true);
	});

	it.each([
		"/dashboard", "/excel", "/setup", "/admin/users", "/privacy/private",
		"/whatsapp", "/whatsapp/flow", "/whatsapp/respond/",
		"/whatsapp/flow/run-id/edit", "/whatsapp/respond/run-id/thanks/private",
		"/whatsapp/admin/run-id", "/admin/whatsapp",
	])(
		"keeps %s behind the tenant membership check",
		(pathname) => {
			expect(isPreTenantRoute(pathname)).toBe(false);
		},
	);
});
