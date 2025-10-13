"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";

type UserMenuProps = {
  email?: string | null;
};

export default function UserMenu({ email }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const isAuthed = Boolean(email);

  async function handleLogout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
  }

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
        <div className="size-6 rounded-full bg-foreground/20" />
        <span className="max-w-[160px] truncate">{email ?? "Sign in"}</span>
      </button>
      {open && isAuthed && (
        <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-md border bg-background shadow-lg">
          <div className="px-3 py-2 text-sm text-foreground/70">{email}</div>
          <button
            onClick={handleLogout}
            className="block w-full px-3 py-2 text-left text-sm hover:bg-foreground/10"
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );
}


