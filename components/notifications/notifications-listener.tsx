"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { createSupabaseBrowserClient } from "@/utils/supabase/client";

type NotificationRow = {
  id: string;
  tenant_id: string | null;
  user_id: string;
  title: string;
  body: string | null;
  type: string;
  action_url: string | null;
  created_at: string;
  read_at: string | null;
};

const DISMISSED_KEY = "notifications:dismissed";

type NotificationsListenerProps = {
  activeTenantId: string | null;
  userId: string | null;
};

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

function belongsToScope(
  row: NotificationRow,
  { activeTenantId, userId }: NotificationsListenerProps,
) {
  return (
    row.user_id === userId &&
    (row.tenant_id === null || row.tenant_id === activeTenantId)
  );
}

export default function NotificationsListener({
  activeTenantId,
  userId,
}: NotificationsListenerProps) {
  const { push } = useRouter();
  const dismissedRef = useRef<Set<string>>(new Set());
  const shownToastIdsRef = useRef<Set<string>>(new Set());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    dismissedRef.current = loadDismissed();
    setReady(true);
  }, []);

  useEffect(() => {
    const shownToastIds = shownToastIdsRef.current;
    return () => {
      for (const toastId of shownToastIds) {
        toast.dismiss(toastId);
      }
      shownToastIds.clear();
    };
  }, [activeTenantId, userId]);

  const showToast = useCallback(
    (row: NotificationRow) => {
      if (!ready || !belongsToScope(row, { activeTenantId, userId })) return;
      if (dismissedRef.current.has(row.id)) return;

      const supabase = createSupabaseBrowserClient();
      const markRead = async () => {
        const { error } = await supabase
          .from("notifications")
          .update({ read_at: new Date().toISOString() })
          .eq("id", row.id)
          .eq("user_id", userId)
          .or(`tenant_id.is.null,tenant_id.eq.${activeTenantId}`);
        if (error) return false;

        dismissedRef.current.add(row.id);
        saveDismissed(dismissedRef.current);
        return true;
      };
      const actionUrl = row.action_url;

      toast(row.title, {
        id: row.id,
        description: row.body ?? undefined,
        duration: Infinity,
        action: actionUrl
          ? {
              label: "Ver",
              onClick: async () => {
                await markRead();
                push(actionUrl);
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
      shownToastIdsRef.current.add(row.id);
    },
    [activeTenantId, push, ready, userId],
  );

  // Initial fetch: show all unread notifications (even old ones)
  useEffect(() => {
    if (!ready || !userId || !activeTenantId) return;
    const supabase = createSupabaseBrowserClient();
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("notifications")
          .select("id,tenant_id,user_id,title,body,type,action_url,created_at,read_at")
          .eq("user_id", userId)
          .or(`tenant_id.is.null,tenant_id.eq.${activeTenantId}`)
          .is("read_at", null)
          .order("created_at", { ascending: true })
          .limit(50);
        if (error) throw error;
        if (cancelled) return;
        for (const row of (data ?? []) as NotificationRow[]) {
          showToast(row);
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTenantId, ready, showToast, userId]);

  // Realtime: show toast for new notifications
  useEffect(() => {
    if (!ready || !userId || !activeTenantId) return;
    const supabase = createSupabaseBrowserClient();
    let cancelled = false;
    const channel = supabase
      .channel("realtime:notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          if (cancelled) return;
          showToast(payload.new as NotificationRow);
        }
      )
      .subscribe();
    return () => {
      cancelled = true;
      void channel.unsubscribe();
    };
  }, [activeTenantId, ready, showToast, userId]);

  return null;
}










