"use client";

import { useEffect, useRef } from "react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

export default function SupabaseAuthListener() {
  const router = useRouter();
  const listenerSetup = useRef(false);

  useEffect(() => {
    // Only set up listener once to avoid race conditions
    if (listenerSetup.current) return;
    listenerSetup.current = true;

    const supabase = createSupabaseBrowserClient();

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      // Only refresh on actual auth changes, not initial session load
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
        // Revalidate RSC and update UI immediately when auth changes
        router.refresh();
      }
    });

    return () => {
      subscription.subscription?.unsubscribe();
      listenerSetup.current = false;
    };
  }, []); // Empty deps - only run once

  return null;
}


