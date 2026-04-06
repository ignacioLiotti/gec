'use client';

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import MobileExcelPageClient from "./mobile-excel-page-client";
import type { ExcelPageClientProps } from "@/lib/excel/types";
import {
	GUIDED_EXCEL_STAGE_PARAM,
	GUIDED_EXCEL_STAGES,
	GUIDED_EXCEL_TOUR_ID,
} from "@/lib/demo-tours/excel-guided-flow";

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
	const searchParams = useSearchParams();
	const isExcelOverviewTour = searchParams.get("tour") === GUIDED_EXCEL_TOUR_ID;
	const firstObraId = useMemo(
		() => initialObras.find((obra) => typeof obra.id === "string" && obra.id.length > 0)?.id ?? null,
		[initialObras],
	);

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
		<div className="relative">
			{isExcelOverviewTour && firstObraId ? (
				<div className="pointer-events-none absolute right-8 top-4 z-[110] hidden md:block">
					<Link
						href={`/excel/${firstObraId}?tour=${GUIDED_EXCEL_TOUR_ID}&${GUIDED_EXCEL_STAGE_PARAM}=${GUIDED_EXCEL_STAGES.obraIntro}`}
						data-wizard-target="excel-page-open-obra-cta"
						className="pointer-events-auto inline-flex items-center rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-[0_10px_30px_rgba(15,23,42,0.08)] hover:bg-stone-50"
					>
						Abrir una obra
					</Link>
				</div>
			) : null}
			<DesktopExcelPageClient
				initialMainTableColumnsConfig={initialMainTableColumnsConfig}
				initialObras={initialObras}
			/>
		</div>
	);
}
