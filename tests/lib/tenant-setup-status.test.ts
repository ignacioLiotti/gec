import { describe, expect, it } from "vitest";

import { getTenantSetupStatus } from "@/lib/tenant-setup-status";

const completeWorkspace = {
	hasTenant: true,
	hasMainTableConfig: true,
	folderCount: 8,
	tableCount: 2,
	roleCount: 3,
	macroCount: 3,
	obraCount: 0,
	memberCount: 1,
};

describe("getTenantSetupStatus", () => {
	it("treats the standard blueprint as a completed workspace model", () => {
		const status = getTenantSetupStatus(completeWorkspace);

		expect(status.companyReady).toBe(true);
		expect(status.workspaceReady).toBe(true);
		expect(status.firstObraReady).toBe(false);
		expect(status.teamReady).toBe(false);
		expect(status.progress).toBe(50);
	});

	it("completes when a first obra and another team member exist", () => {
		const status = getTenantSetupStatus({
			...completeWorkspace,
			obraCount: 1,
			memberCount: 2,
		});

		expect(status.completedSteps).toBe(4);
		expect(status.progress).toBe(100);
	});

	it("does not mark a partially provisioned workspace ready", () => {
		const status = getTenantSetupStatus({
			...completeWorkspace,
			folderCount: 7,
		});

		expect(status.workspaceReady).toBe(false);
		expect(status.progress).toBe(25);
	});
});
