import { Suspense } from "react";
import { ReportClient } from "./report-client";

export default function ObraReportPage({ params }: { params: { obraId: string } }) {
  return (
    <Suspense fallback={<div className="p-6 text-sm">Cargando reporte...</div>}>
      <ReportClient obraId={params.obraId} />
    </Suspense>
  );
}
