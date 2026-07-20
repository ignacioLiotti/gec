"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const AuthModal = dynamic(() => import("@/components/auth/auth-modal"), {
  ssr: false,
});

export default function AuthController() {
  const [open, setOpen] = useState(false);
  const [forcedOpen, setForcedOpen] = useState(false);

  useEffect(() => {
    function handler(event: Event) {
      const customEvent = event as CustomEvent;
      const forced = customEvent.detail?.forced ?? false;
      setOpen(true);
      setForcedOpen(forced);
    }
    window.addEventListener("open-auth", handler as EventListener);
    return () => window.removeEventListener("open-auth", handler as EventListener);
  }, []);

  const handleOpenChange = (newOpen: boolean) => {
    // If forcedOpen, don't allow closing
    if (forcedOpen && !newOpen) {
      return;
    }
    setOpen(newOpen);
    if (!newOpen) {
      setForcedOpen(false);
    }
  };

  if (!open && !forcedOpen) return null;

  return <AuthModal open={open} onOpenChange={handleOpenChange} forcedOpen={forcedOpen} />;
}


