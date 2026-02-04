"use client";

import { QueryClient, QueryClientProvider as RQProvider } from "@tanstack/react-query";
import { ReactNode, useState } from "react";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Data stays fresh for 5 minutes - prevents unnecessary refetches
        staleTime: 5 * 60 * 1000,
        // Keep data in cache for 30 minutes even after unmount
        gcTime: 30 * 60 * 1000,
        // Don't refetch when user switches browser tabs
        refetchOnWindowFocus: false,
        // Don't refetch on component mount if data is still fresh
        refetchOnMount: false,
        // Only retry once on failure
        retry: 1,
      },
    },
  });
}

// Browser-side singleton to preserve cache across navigation
let browserQueryClient: QueryClient | undefined = undefined;

function getQueryClient() {
  if (typeof window === 'undefined') {
    // Server: always make a new query client
    return makeQueryClient();
  } else {
    // Browser: reuse existing client or create new one
    if (!browserQueryClient) {
      browserQueryClient = makeQueryClient();
    }
    return browserQueryClient;
  }
}

export function QueryClientProvider({ children }: { children: ReactNode }) {
  const [client] = useState(getQueryClient);
  return <RQProvider client={client}>{children}</RQProvider>;
}

// Export for prefetching and cache invalidation
export { getQueryClient };
