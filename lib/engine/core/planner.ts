import type { FlowDefinition, FlowStepState, PlannedJob } from "./types";

export function planJobs(
	definition: FlowDefinition,
	states: FlowStepState[],
): PlannedJob[] {
	const stateById = new Map(states.map((state) => [state.stepId, state]));
	const jobs: PlannedJob[] = [];

	for (const step of definition.steps) {
		if (step.type !== "generate" || step.mode !== "auto") continue;
		const state = stateById.get(step.id);
		if (!state || state.status !== "ready") continue;

		jobs.push({
			type: `generate_${step.id}`,
			stepId: step.id,
			runId: state.runId,
		});
	}

	return jobs;
}
