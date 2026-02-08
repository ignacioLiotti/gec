"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

type FlowActionParams = {
	action: string;
	payload?: Record<string, unknown> | null;
};

export function useFlowAction(obraId: string | null, period: string | null) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (params: FlowActionParams) => {
			const res = await fetch("/api/flows/action", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					obraId,
					period,
					action: params.action,
					payload: params.payload ?? null,
				}),
			});
			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				throw new Error(data?.error ?? "Failed to execute action");
			}
			return res.json();
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["pmc-flow-state", obraId, period],
			});
			toast.success("Accion ejecutada correctamente");
		},
		onError: (error: Error) => {
			toast.error(error.message);
		},
	});
}
