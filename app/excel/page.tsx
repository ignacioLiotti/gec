import { renderExcelLandingPage } from "./landing-page";
import {
	EXCEL_LOAD_MODE_QUERY_PARAM,
	resolveExcelLoadMode,
} from "@/lib/excel/load-mode";

type ExcelPageProps = {
	searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ExcelPage({ searchParams }: ExcelPageProps) {
	const resolvedSearchParams = (await searchParams) ?? {};
	const loadMode = resolveExcelLoadMode(
		resolvedSearchParams[EXCEL_LOAD_MODE_QUERY_PARAM],
		"after-form",
	);
	return renderExcelLandingPage(loadMode);
}
