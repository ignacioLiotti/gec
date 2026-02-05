"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

/**
 * Hook to prefetch obra data when user hovers over a link.
 * This reduces perceived load time when navigating to obra detail pages.
 */
export function usePrefetchObra() {
  const queryClient = useQueryClient();

  const prefetchObra = useCallback(
    (obraId: string) => {
      // Prefetch the main obra detail
      queryClient.prefetchQuery({
        queryKey: ["obra", obraId],
        queryFn: async () => {
          const response = await fetch(`/api/obras/${obraId}`);
          if (!response.ok) {
            throw new Error("Failed to fetch obra");
          }
          const data = await response.json();
          return data.obra;
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
      });

      // Also prefetch materials since it's commonly accessed
      queryClient.prefetchQuery({
        queryKey: ["obra", obraId, "materials"],
        queryFn: async () => {
          const res = await fetch(`/api/obras/${obraId}/materials`);
          if (!res.ok) return [];
          const data = await res.json();
          return data?.orders || [];
        },
        staleTime: 5 * 60 * 1000,
      });
    },
    [queryClient]
  );

  return { prefetchObra };
}
