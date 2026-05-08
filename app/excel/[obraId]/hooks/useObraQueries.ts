"use client";

import { useQuery } from "@tanstack/react-query";

/**
 * Query hook for tenant marker - replaces useEffect fetch pattern
 * This provides automatic caching, deduplication, and error handling
 */
export function useTenantMarker(activeTenantId: string | null | undefined) {
  return useQuery({
    queryKey: ["tenant-marker", activeTenantId],
    queryFn: async () => {
      const response = await fetch("/api/tenant-marker", { cache: "no-store" });
      if (!response.ok) {
        return { isIlagDemoTenant: false };
      }
      const payload = await response.json().catch(() => ({}));
      return {
        isIlagDemoTenant: payload.isIlagDemoTenant === true,
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!activeTenantId,
  });
}

/**
 * Query hook for main table config - replaces useEffect fetch pattern
 */
export type MainTableColumnConfig = {
  key: string;
  label: string;
  visible: boolean;
  width?: number;
};

export function useMainTableConfig() {
  return useQuery({
    queryKey: ["main-table-config"],
    queryFn: async () => {
      const response = await fetch("/api/main-table-config", { cache: "no-store" });
      if (!response.ok) {
        return { columns: [] as MainTableColumnConfig[] };
      }
      const payload = await response.json();
      return {
        columns: Array.isArray(payload.columns) ? payload.columns : [],
      };
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Query hook for current user ID - replaces useEffect fetch pattern
 */
export function useCurrentUserId() {
  return useQuery({
    queryKey: ["current-user-id"],
    queryFn: async () => {
      const response = await fetch("/api/me", { cache: "no-store" });
      if (!response.ok) {
        return { userId: null };
      }
      const payload = await response.json();
      return {
        userId: typeof payload.userId === "string" ? payload.userId : null,
      };
    },
    staleTime: 30 * 60 * 1000, // 30 minutes - user ID rarely changes
  });
}
