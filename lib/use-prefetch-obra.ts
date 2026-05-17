"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef } from "react";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
      if (!UUID_PATTERN.test(obraId)) return;

      // Skip if already prefetched in this session
      if (prefetchedIds.current.has(obraId)) return;
      prefetchedIds.current.add(obraId);

      // Prefetch the main obra detail - this is the critical data
      void queryClient
        .prefetchQuery({
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
        })
        .catch((error) => {
          console.warn("[obra-prefetch] main fetch failed", obraId, error);
        });

      // Prefetch pendientes - shown on general tab (default tab)
      void queryClient
        .prefetchQuery({
          queryKey: ["obra", obraId, "pendientes"],
          queryFn: async () => {
            const res = await fetch(`/api/obras/${obraId}/pendientes`);
            if (!res.ok) return [];
            const data = await res.json();
            return data?.pendientes ?? [];
          },
          staleTime: 5 * 60 * 1000,
        })
        .catch((error) => {
          console.warn("[obra-prefetch] pendientes fetch failed", obraId, error);
        });

      // Prefetch memoria notes - shown on general tab
      void queryClient
        .prefetchQuery({
          queryKey: ["obra", obraId, "memoria"],
          queryFn: async () => {
            const res = await fetch(`/api/obras/${obraId}/memoria`);
            if (!res.ok) return [];
            const data = await res.json();
            return data?.notes ?? [];
          },
          staleTime: 5 * 60 * 1000,
        })
        .catch((error) => {
          console.warn("[obra-prefetch] memoria fetch failed", obraId, error);
        });
    },
    [queryClient]
  );

  return { prefetchObra };
}
