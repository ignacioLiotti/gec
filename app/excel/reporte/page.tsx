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
		entidades: searchParams.getAll("entidad"),
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
