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
		expect(status.progress).toBe(67);
	});

	it("completes the essential setup when a first obra exists", () => {
		const status = getTenantSetupStatus({
			...completeWorkspace,
			obraCount: 1,
		});

		expect(status.completedSteps).toBe(3);
		expect(status.teamReady).toBe(false);
		expect(status.progress).toBe(100);
	});

	it("does not mark a partially provisioned workspace ready", () => {
		const status = getTenantSetupStatus({
			...completeWorkspace,
			folderCount: 7,
		});

		expect(status.workspaceReady).toBe(false);
		expect(status.progress).toBe(33);
	});

	it("keeps a blueprint tenant incomplete while first-obra provisioning is partial", () => {
		const status = getTenantSetupStatus({
			...completeWorkspace,
			obraCount: 1,
			requiresProvisioningHealth: true,
			firstObraProvisioningStatus: "partial",
		});

		expect(status.firstObraReady).toBe(false);
		expect(status.progress).toBe(67);
	});

	it("requires a ready provisioning record for a blueprint tenant", () => {
		const status = getTenantSetupStatus({
			...completeWorkspace,
			obraCount: 1,
			requiresProvisioningHealth: true,
			firstObraProvisioningStatus: "ready",
		});

		expect(status.firstObraReady).toBe(true);
		expect(status.progress).toBe(100);
	});

	it("preserves the obra-count fallback for legacy tenants", () => {
		const status = getTenantSetupStatus({
			...completeWorkspace,
			obraCount: 1,
			firstObraProvisioningStatus: null,
		});

		expect(status.firstObraReady).toBe(true);
	});
});
