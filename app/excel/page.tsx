import { headers } from "next/headers";
import ExcelPageClient from "./excel-page-client";
import { getExcelPageInitialData } from "@/lib/excel/page-data";

const MOBILE_USER_AGENT_PATTERN =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i;
const DESKTOP_PREVIEW_ROWS = 8;
const clampPercentage = (value: number | null | undefined) =>
  Math.max(0, Math.min(100, Number.isFinite(value ?? NaN) ? Number(value) : 0));

export default async function ExcelPage() {
  const headerStore = await headers();
  const userAgent = headerStore.get("user-agent") ?? "";
  const initialIsMobile = MOBILE_USER_AGENT_PATTERN.test(userAgent);
  const { mainTableColumnsConfig, obras } = await getExcelPageInitialData();
  const completedCount = obras.filter((obra) => clampPercentage(obra.porcentaje) >= 100).length;
  const averageProgress =
    obras.length > 0
      ? obras.reduce((sum, obra) => sum + clampPercentage(obra.porcentaje), 0) / obras.length
      : 0;

  return (
    <ExcelPageClient
      initialIsMobile={initialIsMobile}
      initialMainTableColumnsConfig={mainTableColumnsConfig}
      initialObras={initialIsMobile ? obras : []}
      initialPreviewObras={obras.slice(0, DESKTOP_PREVIEW_ROWS)}
      initialPreviewStats={{
        totalCount: obras.length,
        completedCount,
        averageProgress,
      }}
    />
  );
}
