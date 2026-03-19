import { headers } from "next/headers";
import ExcelPageClient from "./excel-page-client";
import { getExcelPageInitialData } from "@/lib/excel/page-data";

const MOBILE_USER_AGENT_PATTERN =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i;

export default async function ExcelPage() {
  const headerStore = await headers();
  const userAgent = headerStore.get("user-agent") ?? "";
  const { mainTableColumnsConfig, obras } = await getExcelPageInitialData();

  return (
    <ExcelPageClient
      initialIsMobile={MOBILE_USER_AGENT_PATTERN.test(userAgent)}
      initialMainTableColumnsConfig={mainTableColumnsConfig}
      initialObras={obras}
    />
  );
}
