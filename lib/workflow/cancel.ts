import { getRun } from "workflow/api";

/**
 * Cancel a running workflow by its run ID.
 * Safely handles cases where the workflow may have already completed.
 */
export async function cancelWorkflowRun(runId: string): Promise<boolean> {
	if (!runId) {
		console.warn("[workflow/cancel] no runId provided");
		return false;
	}

	try {
		const run = getRun(runId);
		await run.cancel();
		console.info("[workflow/cancel] workflow cancelled", { runId });
		return true;
	} catch (error: any) {
		// Workflow may have already completed or been cancelled
		console.warn("[workflow/cancel] failed to cancel workflow", {
			runId,
			error: error?.message ?? error,
		});
		return false;
	}
}
