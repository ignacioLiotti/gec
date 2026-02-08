import type { FlowDefinition } from "./types";
import pmcDefinition from "../flows/presupuesto-medicion-certificado.flow.json";

export type FlowDefinitionInput = FlowDefinition | string;

export function resolveFlowDefinition(
	input?: FlowDefinitionInput | null,
): FlowDefinition {
	if (!input || input === "pmc_v1") {
		return pmcDefinition as FlowDefinition;
	}

	if (typeof input === "string") {
		throw new Error(`Unknown flow definition: ${input}`);
	}

	return input;
}
