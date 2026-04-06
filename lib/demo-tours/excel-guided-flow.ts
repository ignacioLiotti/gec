import type { ReadonlyURLSearchParams } from "next/navigation";

export const GUIDED_EXCEL_TOUR_ID = "excel-overview";
export const GUIDED_EXCEL_STAGE_PARAM = "tourStage";

export const GUIDED_EXCEL_STAGES = {
	excelIntro: "excel-intro",
	obraIntro: "obra-intro",
	obraMissingCertificado: "obra-missing-certificado",
	obraGoDocuments: "obra-go-documents",
	documentsIntro: "documents-intro",
	documentsOpenCertificados: "documents-open-certificados",
	documentsSwitchToFiles: "documents-switch-to-files",
	documentsUploadCertificado: "documents-upload-certificado",
	documentsReviewCertificadoData: "documents-review-certificado-data",
	documentsOpenCurva: "documents-open-curva",
	documentsUploadCurva: "documents-upload-curva",
	documentsReturnGeneral: "documents-return-general",
	generalReviewUpdatedData: "general-review-updated-data",
} as const;

export type GuidedExcelTourStage =
	(typeof GUIDED_EXCEL_STAGES)[keyof typeof GUIDED_EXCEL_STAGES];

type SearchParamsLike =
	| URLSearchParams
	| ReadonlyURLSearchParams
	| { get(name: string): string | null }
	| null
	| undefined;

export function isGuidedExcelTour(searchParams: SearchParamsLike): boolean {
	return searchParams?.get("tour") === GUIDED_EXCEL_TOUR_ID;
}

export function getGuidedExcelStage(
	searchParams: SearchParamsLike,
): GuidedExcelTourStage | null {
	if (!isGuidedExcelTour(searchParams)) return null;
	const rawStage = searchParams?.get(GUIDED_EXCEL_STAGE_PARAM);
	if (!rawStage) return GUIDED_EXCEL_STAGES.excelIntro;
	const knownStages = new Set<string>(Object.values(GUIDED_EXCEL_STAGES));
	return knownStages.has(rawStage) ? (rawStage as GuidedExcelTourStage) : null;
}
