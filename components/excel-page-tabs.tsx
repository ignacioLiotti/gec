"use client";

import { useCallback, useRef } from "react";
import { usePathname, useParams } from "next/navigation";
import { Building2, Receipt, Folder, Workflow } from "lucide-react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { prefetchDocuments } from "@/app/excel/[obraId]/tabs/file-manager/hooks/useDocumentsStore";

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
  const params = useParams();
  const obraId = typeof params?.obraId === "string" ? params.obraId : null;
  const prefetchedRef = useRef(false);

  // Prefetch documents data on hover/focus for faster tab switching
  const handleDocumentsPrefetch = useCallback(() => {
    if (!obraId || prefetchedRef.current) return;
    prefetchedRef.current = true;
    void prefetchDocuments(obraId);
  }, [obraId]);

  // Only show tabs on excel/[obraId] detail pages
  const isExcelDetailPage = /^\/excel\/[^/]+$/.test(pathname);
  if (!isExcelDetailPage) return null;

  return (
    <TabsList className="w-full justify-center sm:justify-start gap-1 overflow-x-auto sm:w-auto h-10">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isDocumentosTab = tab.value === "documentos";
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
            onMouseEnter={isDocumentosTab ? handleDocumentsPrefetch : undefined}
            onFocus={isDocumentosTab ? handleDocumentsPrefetch : undefined}
            onTouchStart={isDocumentosTab ? handleDocumentsPrefetch : undefined}
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
