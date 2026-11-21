"use client";

import { usePathname } from "next/navigation";
import { Building2, FolderClock, FolderOpen, ShieldCheck, Workflow } from "lucide-react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";

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

	return <ExcelPageTabList tabBadges={tabBadges} />;
}

// The same route navigation can be rendered with local state in isolated previews.
export function ExcelPageTabList({ tabBadges, visibleTabs }: {
  tabBadges?: Partial<Record<string, string>>;
  visibleTabs?: readonly string[];
}) {
	return (
		<TabsList className="w-full sm:w-auto justify-start p-0 gap-1 h-auto py-1">
			{tabs.filter(tab => !visibleTabs || visibleTabs.includes(tab.value)).map((tab) => {
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
						className={"h-9 gap-2 px-4 text-[13px] font-medium cursor-pointer"}
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
