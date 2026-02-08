import { describe, expect, it } from "vitest";
import { resolveFlowDefinition } from "@/lib/engine/core/definition";
import { planJobs } from "@/lib/engine/core/planner";

const definition = resolveFlowDefinition();

describe("engine planner", () => {
	it("creates job for auto certificate when ready", () => {
		const jobs = planJobs(definition, [
			{ runId: "run-1", stepId: "certificate", status: "ready" },
		]);

		expect(jobs).toHaveLength(1);
		expect(jobs[0]).toMatchObject({
			type: "generate_certificate",
			stepId: "certificate",
			runId: "run-1",
		});
	});
});
