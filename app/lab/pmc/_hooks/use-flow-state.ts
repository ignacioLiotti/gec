"use client";

import { useQuery } from "@tanstack/react-query";

export type FlowStepData = {
	stepId: string;
	status: "blocked" | "ready" | "running" | "done" | "failed";
	reason?: unknown;
	inputs?: Record<string, unknown> | null;
	outputs?: Record<string, unknown> | null;
};

export type FlowStateResponse = {
	obraId: string;
	definitionId: string;
	period: string;
	steps: FlowStepData[];
	actions: string[];
	plannedJobs: Array<{ type: string; stepId: string; runId: string; payload?: unknown }>;
};

export function useFlowState(obraId: string | null, period: string | null) {
	return useQuery<FlowStateResponse>({
		queryKey: ["pmc-flow-state", obraId, period],
		queryFn: async () => {
			const res = await fetch(
				`/api/flows/state?obraId=${encodeURIComponent(obraId!)}&period=${encodeURIComponent(period!)}`,
				{ cache: "no-store" },
			);
			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				throw new Error(data?.error ?? "Failed to load flow state");
			}
			return res.json();
		},
		enabled: !!obraId && !!period,
		staleTime: 30_000,
	});
}
