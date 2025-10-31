"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

type UserMenuProps = {
  email?: string | null;
};

export default function UserMenu({ email }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [notifications, setNotifications] = useState<
    Array<{
      id: string;
      title: string;
      body: string | null;
      type: string;
      created_at: string;
      read_at: string | null;
      action_url: string | null;
    }>
  >([]);
  const [loading, setLoading] = useState(false);
  const isAuthed = Boolean(email);

  const demoNotifications = useMemo(
    () => [
      {
        id: "demo-1",
        title: "Welcome to the app",
        body: "Here are some quick tips to get started.",
        type: "info",
        created_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
        read_at: null,
        action_url: "#",
      },
      {
        id: "demo-2",
        title: "Document reminder",
        body: "A document requires your attention.",
        type: "warning",
        created_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
        read_at: null,
        action_url: "#",
      },
      {
        id: "demo-3",
        title: "Weekly summary ready",
        body: "Your weekly activity summary is available.",
        type: "success",
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
        read_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
        action_url: "#",
      },
    ],
    []
  );

  async function handleLogout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
  }

  useEffect(() => {
    if (!dialogOpen || !isAuthed) return;
    let aborted = false;
    (async () => {
      setLoading(true);
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: userRes } = await supabase.auth.getUser();
        const userId = userRes.user?.id;
        if (!userId) return;
        const { data, error } = await supabase
          .from("notifications")
          .select("id,title,body,type,created_at,read_at,action_url")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(50);
        if (error) throw error;
        if (!aborted) {
          const items = data ?? [];
          setNotifications(items.length ? items : demoNotifications);
        }
      } catch (err) {
        // noop: keep UX simple
      } finally {
        if (!aborted) setLoading(false);
      }
    })();
    return () => {
      aborted = true;
    };
  }, [dialogOpen, isAuthed, demoNotifications]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read_at).length,
    [notifications]
  );

  return (
    <div className="relative">
      <button
        onClick={() => {
          if (isAuthed) return setOpen((v) => !v);
          // Fire global event consumed by AuthController
          window.dispatchEvent(new Event("open-auth"));
        }}
        className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-foreground/10"
      >
        <div className="size-6 rounded-full bg-orange-primary" />
        <span className="max-w-[160px] truncate">{email ?? "Sign in"}</span>
      </button>
      {open && isAuthed && (
        <div className="absolute right-0 mt-2 w-64 overflow-hidden rounded-md border bg-card shadow-lg">
          <div className="px-3 py-2 text-sm text-foreground/70">{email}</div>
          <Separator />
          <button
            onClick={() => {
              setDialogOpen(true);
              setOpen(false);
            }}
            className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-foreground/10"
          >
            <span>Notifications</span>
            {unreadCount > 0 && (
              <span className="ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-orange-primary px-1.5 text-xs text-white">
                {unreadCount}
              </span>
            )}
          </button>
          <button
            onClick={handleLogout}
            className="block w-full px-3 py-2 text-left text-sm hover:bg-foreground/10"
          >
            Log out
          </button>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Notifications
              {unreadCount > 0 && (
                <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-orange-primary px-1.5 text-xs text-white">
                  {unreadCount}
                </span>
              )}
            </DialogTitle>
            <DialogDescription>Latest activity related to your account.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto p-4">
            {loading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">Loading…</div>
            ) : notifications.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">No notifications</div>
            ) : (
              <ul className="flex flex-col gap-3">
                {notifications.map((n) => (
                  <li key={n.id} className="rounded-md border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{n.title}</span>
                          {!n.read_at && (
                            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-orange-primary" />
                          )}
                        </div>
                        {n.body && (
                          <p className="text-foreground/80 mt-1 truncate text-sm">{n.body}</p>
                        )}
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {new Date(n.created_at).toLocaleString()}
                      </span>
                    </div>
                    {n.action_url && (
                      <div className="mt-2">
                        <a
                          href={n.action_url}
                          className="text-orange-primary hover:underline"
                        >
                          View details
                        </a>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}


