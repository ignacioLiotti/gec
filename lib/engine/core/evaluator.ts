import type {
	AvailableInput,
	EvaluateResult,
	FlowDefinition,
	FlowStepState,
	FlowStepStateStatus,
} from "./types";
import { planJobs } from "./planner";

export interface EvaluateInput {
	definition: FlowDefinition;
	currentStates: FlowStepState[];
	availableInputs: AvailableInput[];
}

function cloneState(
	state: FlowStepState | undefined,
	fallback: FlowStepState,
): FlowStepState {
	if (!state) return { ...fallback };
	return {
		...fallback,
		...state,
	};
}

function isTerminal(status: FlowStepStateStatus | undefined): boolean {
	return status === "done" || status === "failed" || status === "running";
}

export function evaluateFlow({
	definition,
	currentStates,
	availableInputs,
}: EvaluateInput): EvaluateResult {
	const currentById = new Map(
		currentStates.map((state) => [state.stepId, state]),
	);
	const availableById = new Map(
		availableInputs.map((input) => [input.stepId, input]),
	);
	const nextStates: FlowStepState[] = [];
	const nextById = new Map<string, FlowStepState>();

	for (const step of definition.steps) {
		const current = currentById.get(step.id);
		const baseState: FlowStepState = {
			runId: current?.runId ?? "",
			stepId: step.id,
			status: "blocked",
		};

		if (current && isTerminal(current.status)) {
			const keep = cloneState(current, baseState);
			nextStates.push(keep);
			nextById.set(step.id, keep);
			continue;
		}

		if (step.type === "input") {
			const available = availableById.get(step.id);
			if (available) {
				const doneState: FlowStepState = {
					...baseState,
					status: "done",
					inputs: available.data ?? null,
				};
				nextStates.push(doneState);
				nextById.set(step.id, doneState);
				continue;
			}

			const blockedState: FlowStepState = {
				...baseState,
				status: step.required ? "blocked" : "ready",
				reason: step.required ? "input_missing" : null,
			};
			nextStates.push(blockedState);
			nextById.set(step.id, blockedState);
			continue;
		}

		const requires = step.requires ?? [];
		const allReady = requires.every((requiredId) => {
			const reqState = nextById.get(requiredId) ?? currentById.get(requiredId);
			return reqState?.status === "done";
		});

		if (allReady) {
			const readyState: FlowStepState = {
				...baseState,
				status: "ready",
			};
			nextStates.push(readyState);
			nextById.set(step.id, readyState);
			continue;
		}

		const blockedState: FlowStepState = {
			...baseState,
			status: "blocked",
			reason: "dependencies_missing",
		};
		nextStates.push(blockedState);
		nextById.set(step.id, blockedState);
	}

	const plannedJobs = planJobs(definition, nextStates);

	return { states: nextStates, plannedJobs };
}
