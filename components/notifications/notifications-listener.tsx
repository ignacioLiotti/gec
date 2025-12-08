"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type NotificationRow = {
  id: string;
  title: string;
  body: string | null;
  type: string;
  action_url: string | null;
  created_at: string;
  read_at: string | null;
};

const DISMISSED_KEY = "notifications:dismissed";

function loadDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    return new Set<string>(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function saveDismissed(set: Set<string>) {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(Array.from(set)));
  } catch {
    // ignore
  }
}

export default function NotificationsListener() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const dismissedRef = useRef<Set<string>>(new Set());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    dismissedRef.current = loadDismissed();
    setReady(true);
  }, []);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!cancelled) setUserId(data.user?.id ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const showToast = useMemo(() => {
    return async (row: NotificationRow) => {
      if (!ready) return;
      if (dismissedRef.current.has(row.id)) return;

      const supabase = createSupabaseBrowserClient();
      const markRead = async () => {
        try {
          await supabase
            .from("notifications")
            .update({ read_at: new Date().toISOString() })
            .eq("id", row.id);
        } catch {}
        dismissedRef.current.add(row.id);
        saveDismissed(dismissedRef.current);
      };

      toast(row.title, {
        description: row.body ?? undefined,
        duration: Infinity,
        action: row.action_url
          ? {
              label: "Ver",
              onClick: async () => {
                await markRead();
                router.push(row.action_url as string);
              },
            }
          : undefined,
        cancel: {
          label: "Descartar",
          onClick: async () => {
            await markRead();
          },
        },
      });
    };
  }, [router, ready]);

  // Initial fetch: show all unread notifications (even old ones)
  useEffect(() => {
    if (!userId) return;
    const supabase = createSupabaseBrowserClient();
    let aborted = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("notifications")
          .select("id,title,body,type,action_url,created_at,read_at")
          .eq("user_id", userId)
          .is("read_at", null)
          .order("created_at", { ascending: true })
          .limit(50);
        if (error) throw error;
        if (!aborted) {
          for (const n of (data ?? []) as NotificationRow[]) {
            await showToast(n);
          }
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      aborted = true;
    };
  }, [userId, showToast]);

  // Realtime: show toast for new notifications
  useEffect(() => {
    if (!userId) return;
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel("realtime:notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        async (payload) => {
          const row = payload.new as NotificationRow & { user_id: string };
          await showToast(row);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, showToast]);

  return null;
}










