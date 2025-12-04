"use client";

import { useEffect, useRef, useCallback } from "react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

export default function SupabaseAuthListener() {
  const router = useRouter();
  const listenerSetup = useRef(false);
  const refreshTimeout = useRef<NodeJS.Timeout | null>(null);

  // Debounced refresh to handle cookie propagation timing
  const debouncedRefresh = useCallback((delay: number = 100) => {
    if (refreshTimeout.current) {
      clearTimeout(refreshTimeout.current);
    }
    refreshTimeout.current = setTimeout(() => {
      console.log("[AUTH-LISTENER] Executing debounced router.refresh()");
      router.refresh();
    }, delay);
  }, [router]);

  useEffect(() => {
    console.log("[AUTH-LISTENER] useEffect running, listenerSetup.current:", listenerSetup.current);

    // Only set up listener once to avoid race conditions
    if (listenerSetup.current) return;
    listenerSetup.current = true;

    const supabase = createSupabaseBrowserClient();
    console.log("[AUTH-LISTENER] Setting up onAuthStateChange listener");

    // Check initial session state
    supabase.auth.getSession().then(({ data }) => {
      console.log("[AUTH-LISTENER] Initial session check:", {
        hasSession: !!data?.session,
        user: data?.session?.user?.email,
        expiresAt: data?.session?.expires_at
      });
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("[AUTH-LISTENER] onAuthStateChange fired:", {
        event,
        hasSession: !!session,
        user: session?.user?.email,
        timestamp: new Date().toISOString()
      });

      if (event === 'SIGNED_OUT') {
        // Sign out is immediate, no delay needed
        console.log("[AUTH-LISTENER] Calling router.refresh() for SIGNED_OUT");
        router.refresh();
      } else if (event === 'SIGNED_IN') {
        // For SIGNED_IN, use debounce to allow cookies to propagate
        // This handles both OAuth callback and client-side PKCE flow
        console.log("[AUTH-LISTENER] Scheduling debounced refresh for SIGNED_IN");
        debouncedRefresh(500);
      } else if (event === 'TOKEN_REFRESHED') {
        console.log("[AUTH-LISTENER] Calling router.refresh() for TOKEN_REFRESHED");
        router.refresh();
      } else {
        console.log("[AUTH-LISTENER] Skipping router.refresh() for event:", event);
      }
    });

    return () => {
      console.log("[AUTH-LISTENER] Cleanup, unsubscribing");
      subscription.subscription?.unsubscribe();
      if (refreshTimeout.current) {
        clearTimeout(refreshTimeout.current);
      }
      listenerSetup.current = false;
    };
  }, [debouncedRefresh]);

  return null;
}


