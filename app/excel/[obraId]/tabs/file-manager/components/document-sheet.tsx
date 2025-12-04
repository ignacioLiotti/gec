"use client";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import type { FileSystemItem } from "../types";
import { DocumentPreview } from "./document-preview";

type DocumentSheetProps = {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	document: FileSystemItem | null;
	breadcrumb: string;
	previewUrl: string | null;
	onDownload: (doc: FileSystemItem) => void;
};

export function DocumentSheet({
	isOpen,
	onOpenChange,
	document,
	breadcrumb,
	previewUrl,
	onDownload,
}: DocumentSheetProps) {
	return (
		<Sheet open={isOpen} onOpenChange={onOpenChange}>
			{document && (
				<SheetContent side="right" className="flex w-full max-w-full flex-col p-0 sm:max-w-2xl">
					<SheetHeader className="border-b bg-white px-6 py-4">
						<div className="flex items-start justify-between gap-3">
							<div className="min-w-0 flex-1">
								<SheetTitle className="truncate text-lg text-stone-900">{document.name}</SheetTitle>
								{breadcrumb && (
									<SheetDescription className="truncate text-xs uppercase tracking-wide text-stone-400">
										{breadcrumb}
									</SheetDescription>
								)}
							</div>
							<Button variant="outline" size="sm" onClick={() => onDownload(document)} className="shrink-0">
								<Download className="w-4 h-4 mr-2" />
								Descargar
							</Button>
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
