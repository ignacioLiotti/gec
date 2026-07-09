import { describe, expect, it } from "vitest";

import { resolveTenantSwitchRedirect } from "@/lib/tenant-switch-redirect";

const REQUEST_URL = "https://app.example.com/api/tenants/tenant-id/switch";

describe("resolveTenantSwitchRedirect", () => {
	it("keeps relative application paths on the request origin", () => {
		expect(
			resolveTenantSwitchRedirect(REQUEST_URL, "/excel?tour=1").toString(),
		).toBe("https://app.example.com/excel?tour=1");
	});

	it.each([
		["missing path", null],
		["absolute URL", "https://evil.example/"],
		["protocol-relative URL", "//evil.example/"],
		["backslash authority", "/\\evil.example/"],
		["encoded backslash", "/%5cevil.example/"],
	])("falls back for %s", (_label, nextPath) => {
		expect(resolveTenantSwitchRedirect(REQUEST_URL, nextPath).toString()).toBe(
			"https://app.example.com/excel",
		);
	});
});
