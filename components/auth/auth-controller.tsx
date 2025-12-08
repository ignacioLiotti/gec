"use client";

import { useEffect, useState } from "react";
import AuthModal from "@/components/auth/auth-modal";

export default function AuthController() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function handler() {
      setOpen(true);
    }
    window.addEventListener("open-auth", handler as EventListener);
    return () => window.removeEventListener("open-auth", handler as EventListener);
  }, []);

  return <AuthModal open={open} onOpenChange={setOpen} />;
}


