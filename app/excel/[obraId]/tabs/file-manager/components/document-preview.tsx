"use client";

import React, { memo } from "react";
import dynamic from "next/dynamic";
import { Download, Eye, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FileSystemItem } from "../types";

// Lazy-load heavy viewers so they only mount when actually needed inside the sheet
const ForgeViewer = dynamic(
	() => import("@/app/excel/[obraId]/tabs/file-manager/components/viewer/forgeviewer"),
	{ ssr: false }
);
const EnhancedDocumentViewer = dynamic(
	() => import("@/components/viewer/enhanced-document-viewer").then((m) => ({ default: m.EnhancedDocumentViewer })),
	{
		ssr: false,
		loading: () => (
			<div className="flex items-center justify-center h-full">
				<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
			</div>
		),
	}
);

type DocumentPreviewProps = {
	document: FileSystemItem | null;
	previewUrl: string | null;
	onDownload: (doc: FileSystemItem) => void;
};

export const DocumentPreview = memo(function DocumentPreview({
	document,
	previewUrl,
	onDownload,
}: DocumentPreviewProps) {
	if (!document) {
		return (
			<div className="flex flex-col items-center justify-center h-full text-stone-400">
				<Eye className="w-16 h-16 mb-4 opacity-20" />
				<p>Selecciona un documento para previsualizar</p>
			</div>
		);
	}

	const isImage = document.mimetype?.startsWith("image/");
	const isPdf = document.mimetype === "application/pdf";
	const has3DModel = Boolean(document.apsUrn);

	return (
		<div className="h-full flex flex-col">
			{!(previewUrl && (isImage || isPdf)) && (
				<div className="flex items-center justify-between p-4 border-b border-stone-200">
					<h3 className="font-medium text-stone-800 truncate">{document.name}</h3>
					<Button variant="outline" size="sm" onClick={() => onDownload(document)}>
						<Download className="w-4 h-4 mr-2" />
						Download
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
