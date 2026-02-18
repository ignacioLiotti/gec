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

	// Initialize filters from URL params
	const initialFilters: Partial<ObraFilters> = {
		supMin: searchParams.get("supMin") || "",
		supMax: searchParams.get("supMax") || "",
		entidadContains: searchParams.get("entidadContains") || "",
		mesYear: searchParams.get("mesYear") || "",
		mesContains: searchParams.get("mesContains") || "",
		iniYear: searchParams.get("iniYear") || "",
		iniContains: searchParams.get("iniContains") || "",
		cmaMin: searchParams.get("cmaMin") || "",
		cmaMax: searchParams.get("cmaMax") || "",
		cafMin: searchParams.get("cafMin") || "",
		cafMax: searchParams.get("cafMax") || "",
		sacMin: searchParams.get("sacMin") || "",
		sacMax: searchParams.get("sacMax") || "",
		scMin: searchParams.get("scMin") || "",
		scMax: searchParams.get("scMax") || "",
		paMin: searchParams.get("paMin") || "",
		paMax: searchParams.get("paMax") || "",
		ptMin: searchParams.get("ptMin") || "",
		ptMax: searchParams.get("ptMax") || "",
		ptrMin: searchParams.get("ptrMin") || "",
		ptrMax: searchParams.get("ptrMax") || "",
		porcentajeMin: searchParams.get("porcentajeMin") || "",
		porcentajeMax: searchParams.get("porcentajeMax") || "",
		estado: (searchParams.get("estado") as ObraFilters["estado"]) || "all",
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
		<Suspense fallback={<div className="flex items-center justify-center h-screen">Cargando...</div>}>
			<ReportePageContent />
		</Suspense>
	);
}
