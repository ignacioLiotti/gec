import ExcelPageClient from "./excel-page-client";
import { getExcelPageInitialData } from "@/lib/excel/page-data";

export default async function ExcelPage() {
  const { mainTableColumnsConfig, obras } = await getExcelPageInitialData();

  return (
    <ExcelPageClient
      initialMainTableColumnsConfig={mainTableColumnsConfig}
      initialObras={obras}
    />
  );
}
