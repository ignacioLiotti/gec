'use client';

import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";
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
const MOBILE_MEDIA_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

type ResponsiveExcelPageClientProps = ExcelPageClientProps & {
	initialIsMobile: boolean;
};

function subscribeToViewportChange(onStoreChange: () => void) {
	const mediaQuery = window.matchMedia(MOBILE_MEDIA_QUERY);
	mediaQuery.addEventListener("change", onStoreChange);
	return () => mediaQuery.removeEventListener("change", onStoreChange);
}

function getMobileViewportSnapshot() {
	return window.matchMedia(MOBILE_MEDIA_QUERY).matches;
}

function useIsMobileViewport(initialIsMobile: boolean) {
	return useSyncExternalStore(
		subscribeToViewportChange,
		getMobileViewportSnapshot,
		() => initialIsMobile,
	);
}

export default function ExcelPageClient({
	initialMainTableColumnsConfig,
	initialObras,
	initialIsMobile,
	initialLoadMode,
}: ResponsiveExcelPageClientProps) {
	const isMobile = useIsMobileViewport(initialIsMobile);

	if (isMobile) {
		return <MobileExcelPageClient initialObras={initialObras} />;
	}

	return (
		<div className="relative">
			<DesktopExcelPageClient
				key={initialLoadMode}
				initialMainTableColumnsConfig={initialMainTableColumnsConfig}
				initialObras={initialObras}
				initialLoadMode={initialLoadMode}
			/>
		</div>
	);
}
