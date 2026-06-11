import ObraDetailPage from "./page-client";
import { getObraDetailInitialData } from "@/lib/excel/obra-detail-data";

type ObraDetailRoutePageProps = {
	params: Promise<{ obraId?: string }>;
	searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstParamValue(value: string | string[] | undefined) {
	return Array.isArray(value) ? value[0] : value;
}

const EMPTY_SEARCH_PARAMS: Record<string, string | string[] | undefined> = {};

export default async function ObraDetailRoutePage({
	params,
	searchParams,
}: ObraDetailRoutePageProps) {
	const [resolvedParams, resolvedSearchParams] = await Promise.all([
		params,
		searchParams ?? Promise.resolve(EMPTY_SEARCH_PARAMS),
	]);
	const obraId = resolvedParams.obraId;
	const initialTab = firstParamValue(resolvedSearchParams.tab) ?? "general";
	const initialData = await getObraDetailInitialData(obraId ?? "");

	return (
		<ObraDetailPage
			initialObraId={obraId}
			initialTab={initialTab}
			initialObra={initialData.obra}
			initialMainTableColumnsConfig={initialData.mainTableColumnsConfig}
		/>
	);
}
