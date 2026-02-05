"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef } from "react";

/**
 * Hook to prefetch obra data when user hovers over a link.
 * This reduces perceived load time when navigating to obra detail pages.
 * 
 * Uses debouncing to prevent excessive prefetch calls on rapid mouse movements.
 */
export function usePrefetchObra() {
  const queryClient = useQueryClient();
  const prefetchedIds = useRef<Set<string>>(new Set());

  const prefetchObra = useCallback(
    (obraId: string) => {
      // Skip if already prefetched in this session
      if (prefetchedIds.current.has(obraId)) return;
      prefetchedIds.current.add(obraId);

      // Prefetch the main obra detail - this is the critical data
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

      // Prefetch pendientes - shown on general tab (default tab)
      queryClient.prefetchQuery({
        queryKey: ["obra", obraId, "pendientes"],
        queryFn: async () => {
          const res = await fetch(`/api/obras/${obraId}/pendientes`);
          if (!res.ok) return [];
          const data = await res.json();
          return data?.pendientes ?? [];
        },
        staleTime: 5 * 60 * 1000,
      });

      // Prefetch memoria notes - shown on general tab
      queryClient.prefetchQuery({
        queryKey: ["obra", obraId, "memoria"],
        queryFn: async () => {
          const res = await fetch(`/api/obras/${obraId}/memoria`);
          if (!res.ok) return [];
          const data = await res.json();
          return data?.notes ?? [];
        },
        staleTime: 5 * 60 * 1000,
      });
    },
    [queryClient]
  );

  return { prefetchObra };
}
