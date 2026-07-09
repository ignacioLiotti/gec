'use client';

import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";
import MobileExcelPageClient from "./mobile-excel-page-client";
import { ExcelPageSkeleton } from "./_components/excel-page-chrome";
import type { ExcelPageClientProps } from "@/lib/excel/types";

const DesktopExcelPageFull = dynamic(() => import("./desktop-excel-page-full"), {
	loading: () => <ExcelPageSkeleton />,
});

const DesktopExcelPagePreview = dynamic(() => import("./desktop-excel-page-preview"), {
	loading: () => <ExcelPageSkeleton tableRows={5} />,
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

	if (initialLoadMode === "after-list") {
		return (
			<DesktopExcelPagePreview
				key={initialLoadMode}
				initialMainTableColumnsConfig={initialMainTableColumnsConfig}
				initialObras={initialObras}
				initialLoadMode={initialLoadMode}
			/>
		);
	}

	return (
		<DesktopExcelPageFull
			key={initialLoadMode}
			initialMainTableColumnsConfig={initialMainTableColumnsConfig}
			initialObras={initialObras}
			initialLoadMode={initialLoadMode}
		/>
	);
}
