"use client";

import { memo } from "react";
import { Download, Eye, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import ForgeViewer from "@/app/excel/[obraId]/tabs/file-manager/components/viewer/forgeviewer";
import { EnhancedDocumentViewer } from "@/components/viewer/enhanced-document-viewer";
import type { FileSystemItem } from "../types";

type DocumentPreviewProps = {
	document: FileSystemItem | null;
	previewUrl: string | null;
	onDownload: (doc: FileSystemItem) => void;
};

export const DocumentPreview = memo(function DocumentPreview({ document, previewUrl, onDownload }: DocumentPreviewProps) {
	if (!document) {
		return (
			<div className="flex flex-col items-center justify-center h-full text-stone-400">
				<Eye className="w-16 h-16 mb-4 opacity-20" />
				<p>Selecciona un documento para previsualizar</p>
			</div>
		);
	}

	const mimeType = (document.mimetype || "").toLowerCase();
	const fileName = (document.name || "").toLowerCase();
	const isImage = mimeType.startsWith("image/");
	const isPdf = mimeType.includes("pdf") || fileName.endsWith(".pdf");
	const has3DModel = Boolean(document.apsUrn);

	return (
		<div className="h-full flex flex-col">
			{!(previewUrl && (isImage || isPdf)) && (
				<div className="flex items-center justify-between p-4 border-b border-stone-200">
					<h3 className="font-medium text-stone-800 truncate">{document.name}</h3>
					<Button variant="outline" size="sm" onClick={() => onDownload(document)}>
						<Download className="w-4 h-4 mr-2" />
						Descargar
					</Button>
				</div>
			)}

			<div className="flex-1 overflow-hidden">
				{has3DModel && document.apsUrn ? (
					<div className="h-full">
						<ForgeViewer urn={document.apsUrn} />
					</div>
				) : previewUrl && (isImage || isPdf) ? (
					<EnhancedDocumentViewer
						title={false}
						url={previewUrl}
						fileName={document.name}
						fileType={isPdf ? "pdf" : "image"}
						onDownload={() => onDownload(document)}
					/>
				) : previewUrl ? (
					<div className="flex flex-col items-center justify-center h-full text-stone-400 p-4">
						<FileText className="w-16 h-16 mb-4 opacity-20" />
						<p>Vista previa no disponible para este tipo de archivo</p>
						<Button variant="outline" size="sm" onClick={() => onDownload(document)} className="mt-4">
							<Download className="w-4 h-4 mr-2" />
							Descargar para ver
						</Button>
					</div>
				) : null}
			</div>
		</div>
	);
});
