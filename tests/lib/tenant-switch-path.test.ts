import { describe, expect, it } from "vitest";

import { getTenantSwitchReturnPath } from "@/lib/tenant-switch-path";

describe("getTenantSwitchReturnPath", () => {
	it("drops obra identifiers when switching tenants", () => {
		expect(getTenantSwitchReturnPath("/excel/obra-a", "?tab=documentos")).toBe("/excel");
	});

	it("preserves tenant-neutral obra routes", () => {
		expect(getTenantSwitchReturnPath("/excel/data-flow", "?view=map")).toBe("/excel/data-flow?view=map");
	});

	it("drops macro identifiers that belong to the previous tenant", () => {
		expect(getTenantSwitchReturnPath("/macro", "?macroId=old-id")).toBe("/macro");
	});

	it("preserves neutral setup and help routes", () => {
		expect(getTenantSwitchReturnPath("/setup", "", "#team")).toBe("/setup#team");
		expect(getTenantSwitchReturnPath("/help")).toBe("/help");
	});
});
