'use client';

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ReportPage } from "@/components/report";
import {
	obrasReportConfig,
	type ObraRow,
	type ObraFilters,
} from "@/components/report/configs/obras";

function ReportePageContent() {
	const searchParams = useSearchParams();
	const getSearchParam = (key: string): string | null => searchParams.get(key);

	// Initialize filters from URL params
	const initialFilters: Partial<ObraFilters> = {
		supMin: getSearchParam("supMin") || "",
		supMax: getSearchParam("supMax") || "",
		entidadContains: getSearchParam("entidadContains") || "",
		mesYear: getSearchParam("mesYear") || "",
		mesContains: getSearchParam("mesContains") || "",
		iniYear: getSearchParam("iniYear") || "",
		iniContains: getSearchParam("iniContains") || "",
		cmaMin: getSearchParam("cmaMin") || "",
		cmaMax: getSearchParam("cmaMax") || "",
		cafMin: getSearchParam("cafMin") || "",
		cafMax: getSearchParam("cafMax") || "",
		sacMin: getSearchParam("sacMin") || "",
		sacMax: getSearchParam("sacMax") || "",
		scMin: getSearchParam("scMin") || "",
		scMax: getSearchParam("scMax") || "",
		paMin: getSearchParam("paMin") || "",
		paMax: getSearchParam("paMax") || "",
		ptMin: getSearchParam("ptMin") || "",
		ptMax: getSearchParam("ptMax") || "",
		ptrMin: getSearchParam("ptrMin") || "",
		ptrMax: getSearchParam("ptrMax") || "",
		porcentajeMin: getSearchParam("porcentajeMin") || "",
		porcentajeMax: getSearchParam("porcentajeMax") || "",
		estado: (getSearchParam("estado") as ObraFilters["estado"]) || "all",
	};

	return (
		<ReportPage<ObraRow, ObraFilters>
			config={obrasReportConfig}
			initialFilters={initialFilters}
			backUrl="/excel"
		/>
	);
}

export default function Page() {
	return (
		<Suspense fallback={<div className="flex items-center justify-center h-screen">Cargando?</div>}>
			<ReportePageContent />
		</Suspense>
	);
}
