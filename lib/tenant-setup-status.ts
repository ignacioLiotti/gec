export type TenantSetupSignals = {
	hasTenant: boolean;
	hasMainTableConfig: boolean;
	folderCount: number;
	tableCount: number;
	roleCount: number;
	macroCount: number;
	obraCount: number;
	memberCount: number;
	requiresProvisioningHealth?: boolean;
	firstObraProvisioningStatus?: "running" | "partial" | "ready" | null;
};

export function getTenantSetupStatus(signals: TenantSetupSignals) {
	const companyReady = signals.hasTenant;
	const workspaceReady =
		signals.hasMainTableConfig &&
		signals.folderCount >= 8 &&
		signals.tableCount >= 2 &&
		signals.roleCount >= 3 &&
		signals.macroCount >= 3;
	const firstObraReady =
		signals.obraCount > 0 &&
		(!signals.requiresProvisioningHealth ||
			signals.firstObraProvisioningStatus === "ready");
	const teamReady = signals.memberCount > 1;
	const requiredReadiness = [
		companyReady,
		workspaceReady,
		firstObraReady,
	];
	const completedSteps = requiredReadiness.filter(Boolean).length;

	return {
		companyReady,
		workspaceReady,
		firstObraReady,
		teamReady,
		completedSteps,
		totalSteps: requiredReadiness.length,
		progress: Math.round((completedSteps / requiredReadiness.length) * 100),
	};
}
