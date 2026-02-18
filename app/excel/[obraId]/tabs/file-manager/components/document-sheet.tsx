"use client";

import { memo } from "react";
import type { ReactNode } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetOverlay } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Download, RefreshCw, Loader2 } from "lucide-react";
import type { FileSystemItem } from "../types";
import { DocumentPreview } from "./document-preview";
import { cn } from "@/lib/utils";

type DocumentSheetProps = {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	document: FileSystemItem | null;
	breadcrumb: string;
	previewUrl: string | null;
	onDownload: (doc: FileSystemItem) => void;
	onRetryOcr?: (doc: FileSystemItem | null) => void;
	retryingOcr?: boolean;
	ocrStatusBadge?: ReactNode;
	onToggleDataSheet?: () => void;
	showDataToggle?: boolean;
	isDataSheetOpen?: boolean;
	dataTableSelector?: ReactNode;
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
	ocrStatusBadge,
	onToggleDataSheet,
	showDataToggle = false,
	isDataSheetOpen = false,
	dataTableSelector,
}: DocumentSheetProps) {
	if (!isOpen || !document) {
		return null;
	}
	return (
		<Sheet open={isOpen} onOpenChange={onOpenChange} modal={false}>
			<div className="z-30 bg-black/40 pointer-events-none fixed inset-0 backdrop-blur-xs" />
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
					"mx-auto flex h-[95vh] w-full max-w-3xl flex-col gap-0 p-0 z-50 mb-6 transition-transform duration-300",
					isDataSheetOpen ? "-translate-x-72" : ""
				)}
			>
				<SheetHeader className="border-b bg-white px-6 py-4">
					<div className="flex items-start justify-between gap-3 mr-10">
						<div className="min-w-0 flex-1">
							<div className="flex items-center gap-2">
								<SheetTitle className="truncate text-lg text-stone-900">{document.name}</SheetTitle>
								{ocrStatusBadge}
							</div>
							{breadcrumb && (
								<SheetDescription className="truncate text-xs uppercase tracking-wide text-stone-400">
									{breadcrumb}
								</SheetDescription>
							)}
						</div>
						<div className="flex items-center gap-2">
							{dataTableSelector}
							{showDataToggle && (
								<Button
									variant="secondary"
									size="sm"
									onClick={onToggleDataSheet}
									className="shrink-0"
								>
									{isDataSheetOpen ? "Ocultar datos" : "Ver datos"}
								</Button>
							)}
							{onRetryOcr && (
								<Button
									variant="secondary"
									size="sm"
									disabled={retryingOcr}
									onClick={() => onRetryOcr(document)}
									className="shrink-0"
								>
									{retryingOcr ? (
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									) : (
										<RefreshCw className="mr-2 h-4 w-4" />
									)}
									Reprocesar OCR
								</Button>
							)}
							{/* <Button variant="outline" size="sm" onClick={() => onDownload(document)} className="shrink-0">
								<Download className="w-4 h-4 mr-2" />
								Descargar
							</Button> */}
						</div>
					</div>
				</SheetHeader>
				<div className="flex-1 min-h-[60vh] overflow-hidden bg-white">
					<DocumentPreview document={document} previewUrl={previewUrl} onDownload={onDownload} />
				</div>
			</SheetContent>
		</Sheet>
	);
});
