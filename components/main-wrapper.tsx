"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function MainWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isExcelDetailPage = /^\/excel\/[^/]+$/.test(pathname);

  return (
    <main className={cn("flex flex-1 flex-col gap-4 p-4")}>
      {children}
    </main>
  );
}


