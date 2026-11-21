"use client";

import AuthModal from "@/components/auth/auth-modal";

export function AuthEntry({ mode }: { mode: "sign_in" | "sign_up" }) {
  return <AuthModal open entryPage initialMode={mode} onOpenChange={() => {}} />;
}
