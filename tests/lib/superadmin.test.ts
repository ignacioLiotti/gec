import { afterEach, describe, expect, it, vi } from "vitest";

async function loadSuperadminHelper() {
	vi.resetModules();
	return import("@/lib/superadmin");
}

afterEach(() => {
	vi.unstubAllEnvs();
});

describe("isSuperAdminUser", () => {
	it("allows users with the profile flag when env is empty", async () => {
		vi.stubEnv("SUPERADMIN_USER_IDS", "");
		const { isSuperAdminUser } = await loadSuperadminHelper();

		expect(isSuperAdminUser("user-a", true)).toBe(true);
	});

	it("allows an id from the env allowlist", async () => {
		vi.stubEnv("SUPERADMIN_USER_IDS", "user-a");
		const { isSuperAdminUser } = await loadSuperadminHelper();

		expect(isSuperAdminUser("user-a", false)).toBe(true);
	});

	it("trims multiple ids in the env allowlist", async () => {
		vi.stubEnv("SUPERADMIN_USER_IDS", "user-a, user-b");
		const { isSuperAdminUser } = await loadSuperadminHelper();

		expect(isSuperAdminUser("user-a", false)).toBe(true);
		expect(isSuperAdminUser("user-b", undefined)).toBe(true);
	});

	it("allows a configured owner email", async () => {
		vi.stubEnv("SUPERADMIN_EMAILS", "Owner@Example.com");
		const { isSuperAdminUser } = await loadSuperadminHelper();

		expect(isSuperAdminUser("user-a", false, "owner@example.com")).toBe(true);
	});

	it("denies users without the flag or allowlist match", async () => {
		vi.stubEnv("SUPERADMIN_USER_IDS", "user-a");
		vi.stubEnv("SUPERADMIN_EMAILS", "owner@example.com");
		const { isSuperAdminUser } = await loadSuperadminHelper();

		expect(isSuperAdminUser("user-b", false, "member@example.com")).toBe(false);
	});

	it("denies null user ids without a matching email", async () => {
		vi.stubEnv("SUPERADMIN_USER_IDS", "user-a");
		const { isSuperAdminUser } = await loadSuperadminHelper();

		expect(isSuperAdminUser(null, false)).toBe(false);
	});
});
