"use client";

import { memo, type ReactNode } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import type { FileSystemItem } from "../types";
import { DocumentPreview } from "./document-preview";
import { cn } from "@/lib/utils";

type DocumentSheetProps = {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	document: FileSystemItem | null;
	breadcrumb?: string;
	previewUrl: string | null;
	onDownload: (doc: FileSystemItem) => void;
	onRetryOcr?: (doc: FileSystemItem | null) => void;
	retryingOcr?: boolean;
	ocrStatusBadge?: ReactNode;
	onToggleDataSheet?: () => void;
	showDataToggle?: boolean;
	isDataSheetOpen?: boolean;
	highlightRetryAction?: boolean;
	onPreviousDocument?: (() => void) | null;
	onNextDocument?: (() => void) | null;
	documentPositionLabel?: string | null;
};

export const DocumentSheet = memo(function DocumentSheet({
	isOpen,
	onOpenChange,
	document,
	breadcrumb,
	previewUrl,
	onDownload,
	onRetryOcr,
	retryingOcr = false,
	ocrStatusBadge = null,
	onToggleDataSheet,
	showDataToggle = false,
	isDataSheetOpen = false,
	highlightRetryAction = false,
	onPreviousDocument = null,
	onNextDocument = null,
	documentPositionLabel = null,
}: DocumentSheetProps) {
	if (!isOpen || !document) {
		return null;
	}

	const uploadedAtLabel = (() => {
		if (!document.uploadedAt) return null;
		const parsed = new Date(document.uploadedAt);
		if (Number.isNaN(parsed.getTime())) return document.uploadedAt;
		return new Intl.DateTimeFormat("es-AR", {
			dateStyle: "medium",
			timeStyle: "short",
		}).format(parsed);
	})();
	const uploadedByLabel = document.uploadedByLabel ?? (document.uploadedByUserId ? "Usuario" : null);
	const showDocumentPagination = Boolean(onPreviousDocument || onNextDocument);
	const arePaginationButtonsDisabled = isDataSheetOpen;
	const showOcrProcessingOverlay = document.ocrDocumentStatus === "pending" || document.ocrDocumentStatus === "processing";
	const processingOverlayLabel = retryingOcr
		? "Reprocesando OCR..."
		: document.ocrDocumentStatus === "pending"
			? "OCR en cola..."
			: "Procesando OCR...";
	const ocrFailureFollowUpMessage =
		document.ocrErrorCode === "LINEAGE_RECONCILIATION_CONFLICT"
			? "Impacto: este documento no se reconcilio automaticamente con su materializacion anterior. Siguiente paso: revisa Lineage o reprocesa el documento."
			: document.ocrErrorCode === "OCR_PROVIDER_HIGH_DEMAND"
				? "Impacto: la extraccion no pudo completarse por saturacion temporal del proveedor OCR. Siguiente paso: intenta reprocesar el documento mas tarde."
				: "Impacto: la extraccion no pudo completarse. Siguiente paso: reprocesa el documento o revisa el detalle del error.";
	const ocrConflictMessage =
		document.ocrErrorCode === "LINEAGE_RECONCILIATION_CONFLICT"
			? {
				title: "Conflicto de continuidad detectado",
				detail:
					document.ocrDocumentError ??
					"No pudimos reconciliar automaticamente la identidad estable del documento. El contenido no se aplico con continuidad y requiere revision.",
			}
			: document.ocrErrorCode === "OCR_PROVIDER_HIGH_DEMAND"
				? {
					title: "El proveedor OCR esta saturado",
					detail:
						document.ocrDocumentError ??
						"El proveedor OCR devolvio una saturacion temporal. Intenta de nuevo mas tarde.",
				}
				: document.ocrDocumentStatus === "failed" && document.ocrDocumentError
					? {
						title: "La extraccion OCR fallo",
						detail: document.ocrDocumentError,
					}
					: null;

	return (
		<Sheet open={isOpen} onOpenChange={onOpenChange} modal={false}>
			<div className="z-30 bg-black/40 pointer-events-none fixed inset-0 backdrop-blur-xs" />
			{showDocumentPagination ? (
				<div className="pointer-events-none fixed inset-y-0 left-1 right-1 z-[55] flex items-center justify-around sm:left-2 sm:right-2">
					<Button
						type="button"
						variant="outline"
						size="icon-lg"
						onClick={onPreviousDocument ?? undefined}
						disabled={!onPreviousDocument || arePaginationButtonsDisabled}
						aria-label="Documento anterior"
						className={cn(
							"pointer-events-auto h-10 w-10 rounded-full border-stone-200/80 bg-white/92 text-stone-700 shadow-[0_20px_60px_rgba(0,0,0,0.18)] backdrop-blur-xl transition-transform duration-200 hover:-translate-y-0.5 hover:bg-white active:scale-[0.97] sm:h-12 sm:w-12",
							"disabled:border-stone-200/70 disabled:bg-white/55 disabled:text-stone-300 disabled:shadow-[0_12px_30px_rgba(0,0,0,0.08)]",
							arePaginationButtonsDisabled && "opacity-0 cursor-not-allowed"
						)}
					>
						<ChevronLeft className="size-5" />
					</Button>
					<Button
						type="button"
						variant="outline"
						size="icon-lg"
						onClick={onNextDocument ?? undefined}
						disabled={!onNextDocument || arePaginationButtonsDisabled}
						aria-label="Documento siguiente"
						className={cn(
							"pointer-events-auto h-10 w-10 rounded-full border-stone-200/80 bg-white/92 text-stone-700 shadow-[0_20px_60px_rgba(0,0,0,0.18)] backdrop-blur-xl transition-transform duration-200 hover:-translate-y-0.5 hover:bg-white active:scale-[0.97] sm:h-12 sm:w-12",
							"disabled:border-stone-200/70 disabled:bg-white/55 disabled:text-stone-300 disabled:shadow-[0_12px_30px_rgba(0,0,0,0.08)]",
							arePaginationButtonsDisabled && "opacity-0 cursor-not-allowed"
						)}
					>
						<ChevronRight className="size-5" />
					</Button>
				</div>
			) : null}
			<SheetContent
				side="bottom"
				showOverlay={false}
				onInteractOutside={(event) => {
					event.preventDefault();
				}}
				onPointerDownOutside={(event) => {
					event.preventDefault();
				}}
				className={cn(
					"mx-auto flex h-[100dvh] sm:h-[95vh] w-full max-w-[100vw] sm:max-w-[700px] 2xl:max-w-[800px] flex-col gap-0 p-0 z-50 mb-0 sm:mb-6 transition-transform duration-300",
					isDataSheetOpen ? "2xl:-translate-x-[22rem] xl:-translate-x-[18rem]" : ""
				)}
			>
				<SheetHeader className="border-b bg-white px-3 sm:px-6 py-3 sm:py-4">
					<div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
						<div className="min-w-0 flex-1">
							<div className="flex flex-wrap items-center gap-2">
								<SheetTitle className="truncate text-lg text-stone-900">{document.name}</SheetTitle>
								{ocrStatusBadge}
							</div>
							<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 pt-2">
								{breadcrumb ? (
									<p className="truncate text-xs uppercase tracking-wide text-stone-400">
										{breadcrumb}
									</p>
								) : null}
								{(uploadedAtLabel || uploadedByLabel) && (
									<div className="mt-1 text-xs text-stone-500 break-words">
										{uploadedByLabel && <span>Subido por: {uploadedByLabel}</span>}
										{uploadedByLabel && uploadedAtLabel && <span className="mx-2">|</span>}
										{uploadedAtLabel && <span>Fecha: {uploadedAtLabel}</span>}
									</div>
								)}
							</div>
						</div>
						{documentPositionLabel ? (
							<div className="mr-10 shrink-0 rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-stone-500">
								Documento {documentPositionLabel}
							</div>
						) : null}
					</div>
					{ocrConflictMessage ? (
						<div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
							<p className="font-semibold">{ocrConflictMessage.title}</p>
							<p className="mt-1 text-xs leading-5 text-rose-800">
								{ocrConflictMessage.detail}
							</p>
							<p className="mt-1 text-xs leading-5 text-rose-700">
								{ocrFailureFollowUpMessage}
							</p>
						</div>
					) : null}
				</SheetHeader>
				<div className="relative flex-1 min-h-[50dvh] sm:min-h-[60vh] overflow-hidden bg-white">
					<DocumentPreview
						document={document}
						previewUrl={previewUrl}
						onDownload={onDownload}
						onRetryOcr={onRetryOcr}
						retryingOcr={retryingOcr}
						highlightRetryAction={highlightRetryAction}
						onToggleDataSheet={onToggleDataSheet}
						showDataToggle={showDataToggle}
						isDataSheetOpen={isDataSheetOpen}
					/>
					{showOcrProcessingOverlay ? (
						<div className="pointer-events-none absolute inset-0 z-30 overflow-hidden ocr-scan-overlay">
							<div className="absolute inset-0 ocr-scan-tint" />
							<div className="absolute inset-0 ocr-scan-grid" />
							<div
								className="absolute inset-x-0 h-44 ocr-scan-beam"
								aria-hidden="true"
							>
								<div className="absolute inset-0 ocr-scan-beam-halo" />
								<div className="absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 ocr-scan-beam-core" />
							</div>
							<div className="absolute inset-x-0 bottom-5 flex justify-center px-4">
								<div
									className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] backdrop-blur-sm"
									style={{
										border: "1px solid rgba(255, 88, 0, 0.7)",
										backgroundColor: "rgba(255, 88, 0, 0.16)",
										color: "var(--color-orange-primary, #ff5800)",
										boxShadow: "0 18px 38px rgba(255, 88, 0, 0.32)",
									}}
								>
									<Loader2 className="size-3.5 animate-spin" />
									{processingOverlayLabel}
								</div>
							</div>
						</div>
					) : null}
				</div>
				<style jsx>{`
						.ocr-scan-overlay {
							backdrop-filter: blur(1px);
							--ocr-orange-rgb: 255, 88, 0;
						}

						.ocr-scan-tint {
							background: linear-gradient(
								180deg,
								rgba(var(--ocr-orange-rgb), 0.12) 0%,
								rgba(var(--ocr-orange-rgb), 0.24) 48%,
								rgba(var(--ocr-orange-rgb), 0.16) 100%
							);
						}

						.ocr-scan-grid {
							background-image: repeating-linear-gradient(
								to bottom,
								rgba(var(--ocr-orange-rgb), 0.3) 0px,
								rgba(var(--ocr-orange-rgb), 0.3) 1px,
								transparent 1px,
								transparent 7px
							);
							opacity: 0.42;
						}

						.ocr-scan-beam {
							top: -35%;
							animation: ocr-scan-sweep 1.8s linear infinite;
							will-change: top, opacity;
						}

						.ocr-scan-beam-halo {
							background: linear-gradient(
								180deg,
								transparent 0%,
								rgba(var(--ocr-orange-rgb), 0.16) 18%,
								rgba(var(--ocr-orange-rgb), 0.66) 52%,
								rgba(var(--ocr-orange-rgb), 0.26) 80%,
								transparent 100%
							);
							filter: blur(2.6px);
						}

						.ocr-scan-beam-core {
							background: linear-gradient(
								90deg,
								rgba(var(--ocr-orange-rgb), 0) 0%,
								rgba(var(--ocr-orange-rgb), 0.95) 18%,
								rgba(var(--ocr-orange-rgb), 1) 50%,
								rgba(var(--ocr-orange-rgb), 0.95) 82%,
								rgba(var(--ocr-orange-rgb), 0) 100%
							);
							box-shadow:
								0 0 14px rgba(var(--ocr-orange-rgb), 0.9),
								0 0 30px rgba(var(--ocr-orange-rgb), 0.55);
							animation: ocr-scan-flicker 0.12s steps(2, end) infinite;
						}

						@keyframes ocr-scan-sweep {
							0% {
								opacity: 0;
								top: -35%;
							}
							10% {
								opacity: 1;
							}
							55% {
								opacity: 1;
							}
							88% {
								opacity: 0.92;
							}
							100% {
								opacity: 0;
								top: 115%;
							}
						}

					@keyframes ocr-scan-flicker {
						0% {
							opacity: 0.86;
						}
						100% {
							opacity: 1;
						}
					}
				`}</style>
			</SheetContent>
		</Sheet>
	);
});
