export type FlowStepType = "input" | "generate";
export type FlowStepMode = "human_input" | "auto";
export type FlowStepStateStatus =
	| "blocked"
	| "ready"
	| "running"
	| "done"
	| "failed";

export interface FlowStepDefinition {
	id: string;
	type: FlowStepType;
	required?: boolean;
	requires?: string[];
	outputs?: string[];
	docKinds?: string[];
	mode?: FlowStepMode;
}

export interface FlowDefinition {
	id: string;
	name: string;
	runKey: "period";
	steps: FlowStepDefinition[];
}

export interface FlowInstance {
	id: string;
	obraId: string;
	flowDefinitionId: string;
	definitionJson: FlowDefinition;
	createdAt: string;
}

export interface FlowRun {
	id: string;
	instanceId: string;
	period: string;
	status: "active" | "archived";
	createdAt: string;
}

export interface FlowStepState {
	id?: string;
	runId: string;
	stepId: string;
	status: FlowStepStateStatus;
	reason?: string | Record<string, unknown> | null;
	inputs?: Record<string, unknown> | null;
	outputs?: Record<string, unknown> | null;
	updatedAt?: string;
}

export interface EngineEvent {
	type: string;
	payload?: Record<string, unknown> | null;
	dedupeKey?: string | null;
	runId?: string | null;
	period?: string | null;
}

export interface AvailableInput {
	stepId: string;
	data?: Record<string, unknown> | null;
}

export interface PlannedJob {
	type: string;
	stepId: string;
	runId: string;
	payload?: Record<string, unknown> | null;
}

export interface EvaluateResult {
	states: FlowStepState[];
	plannedJobs: PlannedJob[];
}
