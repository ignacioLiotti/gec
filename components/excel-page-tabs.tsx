"use client";

import { useCallback, useRef } from "react";
import { usePathname, useParams } from "next/navigation";
import { Building2, Folder, Workflow } from "lucide-react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { prefetchDocuments } from "@/app/excel/[obraId]/tabs/file-manager/hooks/useDocumentsStore";
import { cn } from "@/lib/utils";

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

	const handleDocumentsPrefetch = useCallback(() => {
		if (!obraId || prefetchedRef.current) return;
		prefetchedRef.current = true;
		void prefetchDocuments(obraId);
	}, [obraId]);

	const isExcelDetailPage = /^\/excel\/[^/]+$/.test(pathname);
	if (!isExcelDetailPage) return null;

	return (
		<TabsList className="w-full sm:w-auto justify-start bg-transparent border-none p-0 gap-1 h-auto">
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
						className={cn(
							"h-9 gap-2 px-4 rounded-xl text-[13px] font-medium cursor-pointer",
							"text-[#999] hover:bg-[#f5f5f5] hover:text-[#555]",
							"data-[state=active]:bg-[#1a1a1a] data-[state=active]:text-white data-[state=active]:hover:bg-[#1a1a1a]",
						)}
						onMouseEnter={isDocumentosTab ? handleDocumentsPrefetch : undefined}
						onFocus={isDocumentosTab ? handleDocumentsPrefetch : undefined}
						onTouchStart={isDocumentosTab ? handleDocumentsPrefetch : undefined}
					>
						<Icon className="size-3.5 shrink-0" />
						{tab.label}

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
