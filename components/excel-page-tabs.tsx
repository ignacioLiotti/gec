"use client";

import { usePathname } from "next/navigation";
import { Building2, FolderClock, FolderOpen, ShieldCheck, Workflow } from "lucide-react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const tabs = [
	{ value: "general", label: "General", icon: Building2 },
	{ value: "polizas", label: "Pólizas", icon: ShieldCheck },
	{ value: "flujo", label: "Flujo", icon: Workflow },
	// { value: "certificates", label: "Certificados", icon: Receipt },
	{ value: "documentos", label: "Documentos Legacy", icon: FolderOpen },
	{ value: "documentos-new", label: "Documentos New", icon: FolderClock },
];

export function ExcelPageTabs({
	tabBadges,
}: {
	tabBadges?: Partial<Record<"general" | "polizas" | "flujo" | "documentos" | "documentos-new", string>>;
}) {
	const pathname = usePathname();

	const isExcelDetailPage = /^\/excel\/[^/]+$/.test(pathname);
	if (!isExcelDetailPage) return null;

	return (
		<TabsList className="w-full sm:w-auto justify-start bg-transparent border-none p-0 gap-1 h-auto py-1">
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
						className={cn(
							"h-9 gap-2 px-4 rounded-xl text-[13px] font-medium cursor-pointer",
							"text-[#999] hover:bg-[#f5f5f5] hover:text-[#555]",
							"data-[state=active]:bg-[#1a1a1a] data-[state=active]:text-white data-[state=active]:hover:bg-[#1a1a1a]",
						)}
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
