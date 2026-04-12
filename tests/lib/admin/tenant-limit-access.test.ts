import { describe, expect, it } from "vitest";

import {
	canManageTenantLimits,
	LIMITS_MANAGER_EMAIL,
} from "@/lib/admin/tenant-limit-access";

describe("tenant limit access", () => {
	it("allows the configured manager email", () => {
		expect(canManageTenantLimits(LIMITS_MANAGER_EMAIL)).toBe(true);
	});

	it("normalizes case and spaces", () => {
		expect(canManageTenantLimits("  IGNACIOLIOTTI@GMAIL.COM  ")).toBe(true);
	});

	it("rejects other users", () => {
		expect(canManageTenantLimits("someone@example.com")).toBe(false);
		expect(canManageTenantLimits(null)).toBe(false);
		expect(canManageTenantLimits(undefined)).toBe(false);
	});
});
