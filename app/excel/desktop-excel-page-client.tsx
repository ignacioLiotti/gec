'use client';

import dynamic from "next/dynamic";
import type { ExcelPageClientProps } from "@/lib/excel/types";

const DesktopExcelPageFull = dynamic(() => import("./desktop-excel-page-full"), {
	loading: () => (
		<div className="min-h-full bg-[#fafafa] px-4 py-4 md:px-8 md:py-8">
			<div className="animate-pulse space-y-4 rounded-xl border border-[#ece7df] bg-white p-6 shadow-card">
				<div className="h-9 w-56 rounded bg-[#f3eee7]" />
				<div className="h-11 w-full rounded-lg bg-[#f6f2eb]" />
				<div className="h-[60vh] w-full rounded-xl bg-[#f6f2eb]" />
			</div>
		</div>
	),
});

const DesktopExcelPagePreview = dynamic(() => import("./desktop-excel-page-preview"), {
	loading: () => (
		<div className="min-h-full bg-[#fafafa] px-4 py-4 md:px-8 md:py-8">
			<div className="animate-pulse space-y-4 rounded-xl border border-[#ece7df] bg-white p-6 shadow-card">
				<div className="h-9 w-56 rounded bg-[#f3eee7]" />
				<div className="h-11 w-80 rounded-lg bg-[#f6f2eb]" />
				<div className="h-[60vh] w-full rounded-xl bg-[#f6f2eb]" />
			</div>
		</div>
	),
});

export default function DesktopExcelPageClient(props: ExcelPageClientProps) {
	if (props.initialLoadMode === "after-list") {
		return <DesktopExcelPagePreview {...props} />;
	}

	return <DesktopExcelPageFull {...props} />;
}
