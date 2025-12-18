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

	// Initialize filters from URL params
	const initialFilters: Partial<CertificadoFilters> = {
		montoMin: searchParams.get("montoMin") || "",
		montoMax: searchParams.get("montoMax") || "",
		entes: searchParams.getAll("ente"),
		facturado: (searchParams.get("facturado") as CertificadoFilters["facturado"]) || "all",
		cobrado: (searchParams.get("cobrado") as CertificadoFilters["cobrado"]) || "all",
		conceptoContains: searchParams.get("conceptoContains") || "",
		fechaFacturacionMin: searchParams.get("fechaFacturacionMin") || "",
		fechaFacturacionMax: searchParams.get("fechaFacturacionMax") || "",
		fechaPagoMin: searchParams.get("fechaPagoMin") || "",
		fechaPagoMax: searchParams.get("fechaPagoMax") || "",
		vencimientoMin: searchParams.get("vencimientoMin") || "",
		vencimientoMax: searchParams.get("vencimientoMax") || "",
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
		<Suspense fallback={<div className="flex items-center justify-center h-screen">Cargando...</div>}>
			<ReportePageContent />
		</Suspense>
	);
}



