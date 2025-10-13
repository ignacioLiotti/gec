"use client";

import { useEffect } from "react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

export default function SupabaseAuthListener() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const { data: subscription } = supabase.auth.onAuthStateChange(() => {
      // Revalidate RSC and update UI immediately when auth changes
      router.refresh();
    });
    return () => {
      subscription.subscription?.unsubscribe();
    };
  }, [router]);

  return null;
}


