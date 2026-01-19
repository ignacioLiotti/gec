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

export function ExcelPageTabs() {
  const pathname = usePathname();

  // Only show tabs on excel/[obraId] detail pages
  const isExcelDetailPage = /^\/excel\/[^/]+$/.test(pathname);
  if (!isExcelDetailPage) return null;

  return (
    <TabsList >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            className="gap-2"
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{tab.label}</span>
          </TabsTrigger>
        );
      })}
    </TabsList>
  );
}
