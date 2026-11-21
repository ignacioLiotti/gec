import { lstat } from "node:fs/promises";
import path from "node:path";

import {
	loadRecoveryStatusFile,
	parseRecoveryStatus,
} from "@/scripts/recovery/status-contract.mjs";

export type OperationsRecoveryStatus =
	| { status: "unconfigured" }
	| { status: "unavailable" }
	| { status: "available"; evidence: ReturnType<typeof parseRecoveryStatus> };

// Server-only input configured by the operator; never accept this path from a request.
export async function loadOperationsRecoveryStatus(): Promise<OperationsRecoveryStatus> {
	const statusPath = process.env.OPERATIONS_RECOVERY_STATUS_PATH;
	if (!statusPath) return { status: "unconfigured" };
	try {
		if (!path.isAbsolute(statusPath)) return { status: "unavailable" };
		const stats = await lstat(statusPath);
		if (!stats.isFile() || stats.size > 65_536) return { status: "unavailable" };
		return { status: "available", evidence: await loadRecoveryStatusFile(statusPath) };
	} catch {
		return { status: "unavailable" };
	}
}
