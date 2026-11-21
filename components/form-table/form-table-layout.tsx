"use client";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useFormTable } from "./context";
import type { FormTableRow } from "./types";
import { shouldUseSpreadsheetChrome } from "./table-layout";
import { FormTableContent } from "./form-table-content";
import { FormTablePagination } from "./form-table-pagination";
import { FormTableTabs } from "./form-table-tabs";
import { FormTableToolbar } from "./form-table-toolbar";

export function FormTableLayout({
	className,
	innerClassName,
	toolbarClassName,
}: {
	className?: string;
	innerClassName?: string;
	toolbarClassName?: string;
}) {
	const { config, meta } = useFormTable<FormTableRow, unknown>();
	const isEmbedded = meta.isEmbedded;
	const showRowNumbers = shouldUseSpreadsheetChrome(config);
	const tableSurface = showRowNumbers ? (
		<div className="mx-[1px] flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-card mt-[1px] shadow-[0_1px_0_0_#fff_inset,0_-1px_0_0_#0000001f_inset,0_0_0_1px_#00000024,0_2px_2px_0_#0b090c0d,0_1px_1px_0_#0b090c0f,0_5px_8px_-7px_#0b090c08]">
			{(config.showToolbar ?? true) ? (
				<div className={cn("border-b border-stroke-soft bg-surface px-3 py-2.5", toolbarClassName)}>
					<FormTableToolbar />
				</div>
			) : null}
			<FormTableTabs className="mx-3 mt-3" />
			<div className="flex min-h-0 flex-1">
				<FormTableContent className={className} innerClassName={innerClassName} />
			</div>
		</div>
	) : (
		<>
			{(config.showToolbar ?? true) ? <FormTableToolbar /> : null}
			<FormTableTabs />
			<div className="flex-1 shadow-card mx-[1px] flex">
				<FormTableContent className={className} innerClassName={innerClassName} />
			</div>
		</>
	);

	const content = (
		<div
			className={cn(
				"max-w-full overflow-hidden flex flex-col h-full",
				showRowNumbers ? "gap-3" : isEmbedded ? "gap-3 px-3 py-3" : "space-y-4 gap-4 pt-6"
			)}
		>
			{config.title || config.description ? (
				<div>
					{config.title ? <h1 className="text-xl font-bold mt-2">{config.title}</h1> : null}
					{config.description && <p className="text-content-secondary">{config.description}</p>}
				</div>
			) : null}
			{tableSurface}
			<FormTablePagination />
		</div>
	);
	const defaultLayout = <TooltipProvider delayDuration={200}>{content}</TooltipProvider>;

	return defaultLayout;
}
