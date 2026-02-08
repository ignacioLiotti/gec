import type { FlowDefinition, FlowStepDefinition } from "./types";

export interface FlowDefinitionValidation {
	valid: boolean;
	errors: string[];
}

function validateStep(step: FlowStepDefinition, index: number): string[] {
	const errors: string[] = [];
	if (!step.id || typeof step.id !== "string") {
		errors.push(`steps[${index}].id is required`);
	}
	if (step.type !== "input" && step.type !== "generate") {
		errors.push(`steps[${index}].type must be input or generate`);
	}
	if (step.requires && !Array.isArray(step.requires)) {
		errors.push(`steps[${index}].requires must be an array`);
	}
	return errors;
}

export function validateFlowDefinition(
	definition: FlowDefinition,
): FlowDefinitionValidation {
	const errors: string[] = [];
	if (!definition || typeof definition !== "object") {
		return { valid: false, errors: ["definition is required"] };
	}
	if (!definition.id) errors.push("id is required");
	if (!definition.name) errors.push("name is required");
	if (definition.runKey !== "period") {
		errors.push("runKey must be period");
	}
	if (!Array.isArray(definition.steps) || definition.steps.length === 0) {
		errors.push("steps must be a non-empty array");
	} else {
		const seen = new Set<string>();
		definition.steps.forEach((step, index) => {
			errors.push(...validateStep(step, index));
			if (step.id) {
				if (seen.has(step.id)) {
					errors.push(`duplicate step id: ${step.id}`);
				} else {
					seen.add(step.id);
				}
			}
		});
	}

	return { valid: errors.length === 0, errors };
}
