'use client';

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ReportPage } from "@/components/report";
import {
	certificadosReportConfig,
	type CertificadoRow,
	type CertificadoFilters,
} from "@/components/report/configs/certificados";

function ReportePageContent() {
	const searchParams = useSearchParams();
	const getSearchParam = (key: string): string | null => searchParams.get(key);
	const getAllSearchParams = (key: string): string[] => searchParams.getAll(key);

	// Initialize filters from URL params
	const initialFilters: Partial<CertificadoFilters> = {
		montoMin: getSearchParam("montoMin") || "",
		montoMax: getSearchParam("montoMax") || "",
		entes: getAllSearchParams("ente"),
		facturado: (getSearchParam("facturado") as CertificadoFilters["facturado"]) || "all",
		cobrado: (getSearchParam("cobrado") as CertificadoFilters["cobrado"]) || "all",
		conceptoContains: getSearchParam("conceptoContains") || "",
		fechaFacturacionMin: getSearchParam("fechaFacturacionMin") || "",
		fechaFacturacionMax: getSearchParam("fechaFacturacionMax") || "",
		fechaPagoMin: getSearchParam("fechaPagoMin") || "",
		fechaPagoMax: getSearchParam("fechaPagoMax") || "",
		vencimientoMin: getSearchParam("vencimientoMin") || "",
		vencimientoMax: getSearchParam("vencimientoMax") || "",
	};

	return (
		<ReportPage<CertificadoRow, CertificadoFilters>
			config={certificadosReportConfig}
			initialFilters={initialFilters}
			backUrl="/certificados"
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





