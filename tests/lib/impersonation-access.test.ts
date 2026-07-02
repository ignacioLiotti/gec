import { describe, expect, it } from "vitest";

import { canStartImpersonation } from "@/lib/impersonation-access";

describe("canStartImpersonation", () => {
	it("allows the app owner superadmin", () => {
		expect(
			canStartImpersonation({
				isSuperAdmin: true,
				actorEmail: "ignaciolati@gmail.com",
			})
		).toEqual({
			allowed: true,
			auditTenantId: null,
		});
	});

	it("denies other superadmins", () => {
		expect(
			canStartImpersonation({
				isSuperAdmin: true,
				actorEmail: "admin@example.com",
			})
		).toEqual({
			allowed: false,
			auditTenantId: null,
		});
	});

	it("denies tenant admins because impersonation is owner-only", () => {
		expect(
			canStartImpersonation({
				isSuperAdmin: false,
				actorEmail: "ignaciolati@gmail.com",
			})
		).toEqual({
			allowed: false,
			auditTenantId: null,
		});
	});
});
