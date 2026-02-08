"use client";

import { useQuery } from "@tanstack/react-query";

export type FlowEvent = {
	type: string;
	payload_json: unknown;
	dedupe_key: string | null;
	run_id: string | null;
	created_at: string;
};

export function useFlowEvents(obraId: string | null) {
	return useQuery<{ events: FlowEvent[] }>({
		queryKey: ["pmc-flow-events", obraId],
		queryFn: async () => {
			const params = new URLSearchParams({ obraId: obraId!, limit: "10" });
			const res = await fetch(`/api/flows/events?${params}`, { cache: "no-store" });
			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				throw new Error(data?.error ?? "Failed to load events");
			}
			return res.json();
		},
		enabled: !!obraId,
		staleTime: 30_000,
	});
}
