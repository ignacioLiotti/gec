export type TenantSetupSignals = {
	hasTenant: boolean;
	hasMainTableConfig: boolean;
	folderCount: number;
	tableCount: number;
	roleCount: number;
	macroCount: number;
	obraCount: number;
	memberCount: number;
};

export function getTenantSetupStatus(signals: TenantSetupSignals) {
	const companyReady = signals.hasTenant;
	const workspaceReady =
		signals.hasMainTableConfig &&
		signals.folderCount >= 8 &&
		signals.tableCount >= 2 &&
		signals.roleCount >= 3 &&
		signals.macroCount >= 3;
	const firstObraReady = signals.obraCount > 0;
	const teamReady = signals.memberCount > 1;
	const readiness = [
		companyReady,
		workspaceReady,
		firstObraReady,
		teamReady,
	];
	const completedSteps = readiness.filter(Boolean).length;

	return {
		companyReady,
		workspaceReady,
		firstObraReady,
		teamReady,
		completedSteps,
		totalSteps: readiness.length,
		progress: Math.round((completedSteps / readiness.length) * 100),
	};
}
