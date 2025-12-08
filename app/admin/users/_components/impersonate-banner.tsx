"use client";

import { useEffect, useState } from "react";

export default function ImpersonateBanner() {
  const [active, setActive] = useState(false);
  useEffect(() => {
    setActive(Boolean(document.cookie.split(";").find((c) => c.trim().startsWith("impersonating="))));
  }, []);
  async function stop() {
    await fetch("/api/impersonate/stop", { method: "POST" });
    location.reload();
  }
  if (!active) return null;
  return (
    <div className="rounded-md border bg-yellow-50 px-4 py-2 text-sm">Suplantando. <button onClick={stop} className="underline">Volver a mi cuenta</button></div>
  );
}


