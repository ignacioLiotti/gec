import { describe, expect, it } from "vitest";

import { canManageTenantLimits } from "@/lib/admin/tenant-limit-access";

describe("tenant limit access", () => {
	it("normalizes case and spaces", () => {
		expect(canManageTenantLimits("  IGNACIOLIOTTI@GMAIL.COM  ")).toBe(true);
	});

	it("rejects other users", () => {
		expect(canManageTenantLimits("someone@example.com")).toBe(false);
		expect(canManageTenantLimits(null)).toBe(false);
		expect(canManageTenantLimits(undefined)).toBe(false);
	});
});
