import { describe, expect, it } from "vitest";
import { resolveFlowDefinition } from "@/lib/engine/core/definition";
import { evaluateFlow } from "@/lib/engine/core/evaluator";

const definition = resolveFlowDefinition();

function getStatus(stepId: string, states: ReturnType<typeof evaluateFlow>["states"]) {
	return states.find((state) => state.stepId === stepId)?.status;
}

describe("engine evaluator", () => {
	it("blocks measurement when budget is missing", () => {
		const result = evaluateFlow({
			definition,
			currentStates: [],
			availableInputs: [],
		});

		expect(getStatus("budget_base", result.states)).toBe("blocked");
		expect(getStatus("measurement", result.states)).toBe("blocked");
	});

	it("marks measurement ready when budget exists", () => {
		const result = evaluateFlow({
			definition,
			currentStates: [],
			availableInputs: [{ stepId: "budget_base" }],
		});

		expect(getStatus("budget_base", result.states)).toBe("done");
		expect(getStatus("measurement", result.states)).toBe("ready");
	});

	it("marks certificate ready when measurement is done", () => {
		const result = evaluateFlow({
			definition,
			currentStates: [
				{
					runId: "run-1",
					stepId: "measurement",
					status: "done",
				},
			],
			availableInputs: [{ stepId: "budget_base" }],
		});

		expect(getStatus("certificate", result.states)).toBe("ready");
	});
});
