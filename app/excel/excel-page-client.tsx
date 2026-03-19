'use client';

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import MobileExcelPageClient from "./mobile-excel-page-client";
import type { ExcelPageClientProps } from "@/lib/excel/types";

const DesktopExcelPageClient = dynamic(() => import("./desktop-excel-page-client"), {
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

const MOBILE_BREAKPOINT = 768;

type ResponsiveExcelPageClientProps = ExcelPageClientProps & {
	initialIsMobile: boolean;
};

export default function ExcelPageClient({
	initialMainTableColumnsConfig,
	initialObras,
	initialIsMobile,
}: ResponsiveExcelPageClientProps) {
	const [isMobile, setIsMobile] = useState(initialIsMobile);

	useEffect(() => {
		const mediaQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
		const syncViewport = () => setIsMobile(mediaQuery.matches);
		syncViewport();
		mediaQuery.addEventListener("change", syncViewport);
		return () => mediaQuery.removeEventListener("change", syncViewport);
	}, []);

	if (isMobile) {
		return <MobileExcelPageClient initialObras={initialObras} />;
	}

	return (
		<DesktopExcelPageClient
			initialMainTableColumnsConfig={initialMainTableColumnsConfig}
			initialObras={initialObras}
		/>
	);
}
