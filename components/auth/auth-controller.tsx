"use client";

import { useEffect, useState } from "react";
import AuthModal from "@/components/auth/auth-modal";

export default function AuthController() {
  const [open, setOpen] = useState(false);
  const [forcedOpen, setForcedOpen] = useState(false);

  useEffect(() => {
    function handler(event: Event) {
      const customEvent = event as CustomEvent;
      const forced = customEvent.detail?.forced ?? false;
      console.log("[AUTH-CONTROLLER] Received open-auth event, forced:", forced);
      setOpen(true);
      setForcedOpen(forced);
    }
    window.addEventListener("open-auth", handler as EventListener);
    return () => window.removeEventListener("open-auth", handler as EventListener);
  }, []);

  const handleOpenChange = (newOpen: boolean) => {
    // If forcedOpen, don't allow closing
    if (forcedOpen && !newOpen) {
      console.log("[AUTH-CONTROLLER] Blocked closing of forced modal");
      return;
    }
    setOpen(newOpen);
    if (!newOpen) {
      setForcedOpen(false);
    }
  };

  return <AuthModal open={open} onOpenChange={handleOpenChange} forcedOpen={forcedOpen} />;
}


