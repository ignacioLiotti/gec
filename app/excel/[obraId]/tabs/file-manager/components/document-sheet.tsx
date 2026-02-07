"use client";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Download, RefreshCw, Loader2 } from "lucide-react";
import type { FileSystemItem } from "../types";
import { DocumentPreview } from "./document-preview";

type DocumentSheetProps = {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	document: FileSystemItem | null;
	breadcrumb: string;
	previewUrl: string | null;
	onDownload: (doc: FileSystemItem) => void;
	onRetryOcr?: (doc: FileSystemItem | null) => void;
	retryingOcr?: boolean;
	ocrStatusBadge?: React.ReactNode;
};

export function DocumentSheet({
	isOpen,
	onOpenChange,
	document,
	breadcrumb,
	previewUrl,
	onDownload,
	onRetryOcr,
	retryingOcr = false,
	ocrStatusBadge,
}: DocumentSheetProps) {
	return (
		<Sheet open={isOpen} onOpenChange={onOpenChange}>
			{document && (
				<SheetContent side="right" className="flex w-full max-w-full flex-col p-0 sm:max-w-2xl">
					<SheetHeader className="border-b bg-white px-6 py-4">
						<div className="flex items-start justify-between gap-3">
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
								<Button variant="outline" size="sm" onClick={() => onDownload(document)} className="shrink-0">
									<Download className="w-4 h-4 mr-2" />
									Descargar
								</Button>
							</div>
						</div>
					</SheetHeader>
					<div className="flex-1 min-h-[60vh] overflow-hidden bg-white">
						<DocumentPreview document={document} previewUrl={previewUrl} onDownload={onDownload} />
					</div>
				</SheetContent>
			)}
		</Sheet>
	);
}
