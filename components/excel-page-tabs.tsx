"use client";

import { usePathname } from "next/navigation";
import { Building2, Receipt, Folder, Workflow } from "lucide-react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";

const tabs = [
  { value: "general", label: "General", icon: Building2 },
  { value: "flujo", label: "Flujo", icon: Workflow },
  // { value: "certificates", label: "Certificados", icon: Receipt },
  { value: "documentos", label: "Documentos", icon: Folder },
];

export function ExcelPageTabs({
	tabBadges,
}: {
	tabBadges?: Partial<Record<"general" | "flujo" | "documentos", string>>;
}) {
  const pathname = usePathname();

  // Only show tabs on excel/[obraId] detail pages
  const isExcelDetailPage = /^\/excel\/[^/]+$/.test(pathname);
  if (!isExcelDetailPage) return null;

  return (
    <TabsList className="w-full justify-center sm:justify-start gap-1 overflow-x-auto sm:w-auto h-10">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            data-wizard-target={
              tab.value === "documentos"
                ? "obra-page-file-manager-tab"
                : tab.value === "general"
                  ? "obra-page-general-tab"
                  : undefined
            }
            className="gap-1.5 text-xs sm:text-sm cursor-pointer"
          >
            <Icon className="sm:h-4 sm:w-4 h-5 w-5" />
            <span className="inline text-base md:text-sm">{tab.label}</span>
            {tabBadges?.[tab.value as keyof typeof tabBadges] ? (
              <span className="rounded-full bg-[#fff1df] px-2 py-0.5 text-[10px] font-semibold text-[#c96b14]">
                {tabBadges[tab.value as keyof typeof tabBadges]}
              </span>
            ) : null}
          </TabsTrigger>
        );
      })}
    </TabsList>
  );
}
