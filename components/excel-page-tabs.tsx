"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Building2, Mail, Receipt, FileText, Folder, Workflow } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { value: "general", label: "General", icon: Building2 },
  { value: "flujo", label: "Flujo", icon: Workflow },
  { value: "certificates", label: "Certificados", icon: Receipt },
  { value: "documentos", label: "Documentos", icon: Folder },
];

export function ExcelPageTabs() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Only show tabs on excel/[obraId] pages
  const isExcelDetailPage = /^\/excel\/[^/]+$/.test(pathname);
  if (!isExcelDetailPage) return null;

  const activeTab = searchParams.get("tab") || "general";

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", value);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="flex items-center h-10">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.value;
        return (
          <button
            key={tab.value}
            onClick={() => handleTabChange(tab.value)}
            className={cn(
              "inline-flex items-center justify-center gap-2 whitespace-nowrap px-3 py-1.5 text-sm font-medium transition-all",
              "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              "disabled:pointer-events-none disabled:opacity-50",
              "rounded-md",
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
