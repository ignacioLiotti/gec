import { Suspense } from "react";
import { ReportClient } from "./report-client";

export default async function ObraReportPage({
  params,
}: {
  params: Promise<{ obraId: string }>;
}) {
  const { obraId } = await params;
  return (
    <Suspense fallback={<div className="p-6 text-sm">Cargando reporte...</div>}>
      <ReportClient obraId={obraId} />
    </Suspense>
  );
}
