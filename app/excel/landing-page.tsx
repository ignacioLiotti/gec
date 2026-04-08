import { headers } from "next/headers";
import ExcelPageClient from "./excel-page-client";
import { getExcelPageInitialData } from "@/lib/excel/page-data";
import type { ExcelLoadMode } from "@/lib/excel/load-mode";

const MOBILE_USER_AGENT_PATTERN =
	/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i;

export async function renderExcelLandingPage(loadMode: ExcelLoadMode) {
	const headerStore = await headers();
	const userAgent = headerStore.get("user-agent") ?? "";
	const isMobile = MOBILE_USER_AGENT_PATTERN.test(userAgent);
	const { mainTableColumnsConfig, obras } = await getExcelPageInitialData({
		previewOnly: loadMode === "after-list",
	});

	return (
		<ExcelPageClient
			initialIsMobile={isMobile}
			initialMainTableColumnsConfig={mainTableColumnsConfig}
			initialObras={obras}
			initialLoadMode={loadMode}
		/>
	);
}
