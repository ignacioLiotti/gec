import { describe, expect, it } from "vitest";

import { POST } from "@/app/api/tenant-usage/route";

describe("POST /api/tenant-usage", () => {
	it("returns 405 because client-side usage writes are disabled", async () => {
		const response = await POST();
		const payload = (await response.json()) as { error?: string };

		expect(response.status).toBe(405);
		expect(payload.error).toContain("deshabilitados");
	});
});
