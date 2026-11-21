"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useFormTable } from "./context";
import type { FormTableRow } from "./types";

export function FormTableTabs({ className }: { className?: string }) {
	const { tabs, pagination } = useFormTable<FormTableRow, unknown>();
	if (!tabs.enabled || tabs.items.length === 0) {
		return null;
	}

	const handleTabChange = (value: string) => {
		tabs.setActiveTab(value);
		pagination.setPage(1);
	};

	return (
		<div
			role="tablist"
			aria-label="Filtros de tabla"
			className={cn(
				"flex gap-1 rounded-md border border-stroke-soft bg-surface-recessed p-0.5",
				className
			)}
		>
			{tabs.items.map((tab) => {
				const isActive = tabs.activeTab === tab.id;
				return (
					<Button
						key={tab.id}
						type="button"
						role="tab"
						aria-selected={isActive}
						onClick={() => handleTabChange(tab.id)}
						variant={isActive ? "default" : "secondary"}
						className="gap-2"
					>
						<span>{tab.label}</span>
						<span
							className={cn(
								"rounded-full px-2 py-0.5 text-xs",
								isActive ? "bg-black/20 text-white" : "bg-surface-recessed text-content-muted"
							)}
						>
							{tabs.counts[tab.id] ?? 0}
						</span>
					</Button>
				);
			})}
		</div>
	);
}
