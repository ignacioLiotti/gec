"use client";

import { memo, useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import { AlertCircle, Download, Eye, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { parseWorkbook, type SheetData } from "@/lib/excel-preview";
import { ExcelGrid } from "@/components/excel-grid";
import ForgeViewer from "@/app/excel/[obraId]/tabs/file-manager/components/viewer/forgeviewer";
import { EnhancedDocumentViewer } from "@/components/viewer/enhanced-document-viewer";
import type { FileSystemItem } from "../types";

type DocumentPreviewProps = {
	document: FileSystemItem | null;
	previewUrl: string | null;
	onDownload: (doc: FileSystemItem) => void;
};

type PreviewKind =
	| "image"
	| "pdf"
	| "spreadsheet"
	| "csv"
	| "word"
	| "text"
	| "model"
	| "unsupported";

type MammothMessage = {
	type: string;
	message: string;
};

type MammothResult = {
	value: string;
	messages: MammothMessage[];
};

type MammothImage = {
	contentType: string;
	readAsBase64String: () => Promise<string>;
};

type MammothModule = {
	convertToHtml: (
		input: { arrayBuffer: ArrayBuffer },
		options?: {
			convertImage?: unknown;
			styleMap?: string[];
		}
	) => Promise<MammothResult>;
	images: {
		imgElement: (
			handler: (image: MammothImage) => Promise<Record<string, string>>
		) => unknown;
	};
};

const MODEL_EXTENSIONS = new Set(["nwc", "nwd", "rvt", "dwg", "ifc", "zip"]);
const SPREADSHEET_EXTENSIONS = new Set(["xlsx", "xls"]);
const WORD_EXTENSIONS = new Set(["doc", "docx"]);
const TEXT_EXTENSIONS = new Set(["txt", "md", "json", "log", "xml", "yaml", "yml"]);

function getFileExtension(fileName?: string | null) {
	const normalized = (fileName ?? "").toLowerCase().trim();
	const segments = normalized.split(".");
	return segments.length > 1 ? segments.pop() ?? "" : "";
}

function getPreviewKind(document: FileSystemItem): PreviewKind {
	const mimeType = (document.mimetype || "").toLowerCase();
	const ext = getFileExtension(document.name);

	if (document.apsUrn || MODEL_EXTENSIONS.has(ext)) return "model";
	if (mimeType.startsWith("image/")) return "image";
	if (mimeType.includes("pdf") || ext === "pdf") return "pdf";
	if (
		SPREADSHEET_EXTENSIONS.has(ext) ||
		mimeType.includes("spreadsheet") ||
		mimeType === "application/vnd.ms-excel"
	) {
		return "spreadsheet";
	}
	if (ext === "csv" || mimeType.includes("csv")) return "csv";
	if (
		WORD_EXTENSIONS.has(ext) ||
		mimeType.includes("wordprocessingml") ||
		mimeType.includes("msword")
	) {
		return "word";
	}
	if (mimeType.startsWith("text/") || TEXT_EXTENSIONS.has(ext)) return "text";
	return "unsupported";
}

function buildCsvSheet(text: string): SheetData {
	const parsed = Papa.parse<string[]>(text, {
		skipEmptyLines: false,
	});
	const rows = (parsed.data ?? []).map((row) =>
		Array.isArray(row) ? row.map((cell) => cell ?? "") : []
	);
	const colCount = rows.reduce((max, row) => Math.max(max, row.length), 0);
	const normalizedRows = rows.map((row) => {
		if (row.length >= colCount) return row;
		return [...row, ...Array.from({ length: colCount - row.length }, () => "")];
	});
	return {
		name: "CSV",
		data: normalizedRows,
		rowCount: normalizedRows.length,
		colCount,
	};
}

function sanitizeWordHtml(input: string) {
	if (!input) return "";

	return input
		.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
		.replace(/\son\w+="[^"]*"/gi, "")
		.replace(/\son\w+='[^']*'/gi, "")
		.replace(/href=(['"])\s*javascript:[\s\S]*?\1/gi, 'href="#"');
}

function filterWordMessages(messages: MammothMessage[]) {
	return messages.filter((message) => {
		const text = message.message.trim();
		if (text === "An unrecognised element was ignored: v:stroke") return false;
		if (text === "An unrecognised element was ignored: v:path") return false;
		return true;
	});
}

function PreviewActionBar({
	document,
	onDownload,
}: {
	document: FileSystemItem;
	onDownload: (doc: FileSystemItem) => void;
}) {
	return (
		<div className="absolute right-4 top-4 z-20">
			<Button variant="default" size="sm" onClick={() => onDownload(document)}>
				<Download className="mr-2 h-4 w-4" />
				Descargar
			</Button>
		</div>
	);
}

function PreviewFallback({
	document,
	onDownload,
	message = "Vista previa no disponible para este tipo de archivo",
}: {
	document: FileSystemItem;
	onDownload: (doc: FileSystemItem) => void;
	message?: string;
}) {
	return (
		<div className="relative flex h-full flex-col">
			<PreviewActionBar document={document} onDownload={onDownload} />
			<div className="flex flex-1 flex-col items-center justify-center p-4 text-stone-400">
				<FileText className="mb-4 h-16 w-16 opacity-20" />
				<p>{message}</p>
				<Button variant="outline" size="sm" onClick={() => onDownload(document)} className="mt-4">
					<Download className="mr-2 h-4 w-4" />
					Descargar para ver
				</Button>
			</div>
		</div>
	);
}

function SpreadsheetLikePreview({
	document,
	previewUrl,
	onDownload,
	mode,
}: {
	document: FileSystemItem;
	previewUrl: string;
	onDownload: (doc: FileSystemItem) => void;
	mode: "spreadsheet" | "csv" | "text";
}) {
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [sheets, setSheets] = useState<SheetData[]>([]);
	const [textPreview, setTextPreview] = useState("");
	const [selectedSheetName, setSelectedSheetName] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;

		const loadPreview = async () => {
			setIsLoading(true);
			setError(null);

			try {
				const response = await fetch(previewUrl, { cache: "no-store" });
				if (!response.ok) {
					throw new Error(`No se pudo cargar el archivo (${response.status})`);
				}

				if (mode === "spreadsheet") {
					const workbook = parseWorkbook(await response.arrayBuffer());
					if (cancelled) return;
					setSheets(workbook.sheets);
					setSelectedSheetName((prev) => prev ?? workbook.sheets[0]?.name ?? null);
					setTextPreview("");
					return;
				}

				const text = await response.text();
				if (cancelled) return;
				if (mode === "csv") {
					const csvSheet = buildCsvSheet(text);
					setSheets([csvSheet]);
					setSelectedSheetName(csvSheet.name);
					setTextPreview("");
					return;
				}

				setSheets([]);
				setSelectedSheetName(null);
				setTextPreview(text);
			} catch (loadError) {
				if (cancelled) return;
				const message =
					loadError instanceof Error ? loadError.message : "No se pudo cargar la vista previa.";
				setError(message);
				setSheets([]);
				setSelectedSheetName(null);
				setTextPreview("");
			} finally {
				if (!cancelled) {
					setIsLoading(false);
				}
			}
		};

		void loadPreview();
		return () => {
			cancelled = true;
		};
	}, [mode, previewUrl]);

	const selectedSheet = useMemo(() => {
		if (sheets.length === 0) return null;
		if (!selectedSheetName) return sheets[0] ?? null;
		return sheets.find((sheet) => sheet.name === selectedSheetName) ?? sheets[0] ?? null;
	}, [selectedSheetName, sheets]);

	if (isLoading) {
		return (
			<div className="relative flex h-full flex-col">
				<PreviewActionBar document={document} onDownload={onDownload} />
				<div className="flex flex-1 items-center justify-center gap-2 text-sm text-stone-500">
					<Loader2 className="h-4 w-4 animate-spin" />
					Cargando vista previa...
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="relative flex h-full flex-col">
				<PreviewActionBar document={document} onDownload={onDownload} />
				<div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center text-stone-500">
					<AlertCircle className="h-10 w-10 text-amber-500" />
					<p>{error}</p>
				</div>
			</div>
		);
	}

	if (mode === "text") {
		return (
			<div className="relative flex h-full flex-col">
				<PreviewActionBar document={document} onDownload={onDownload} />
				<div className="min-h-0 flex-1 overflow-auto bg-stone-50 p-4 pt-16">
					<pre className="whitespace-pre-wrap break-words font-mono text-xs text-stone-700">
						{textPreview}
					</pre>
				</div>
			</div>
		);
	}

	if (!selectedSheet) {
		return (
			<PreviewFallback
				document={document}
				onDownload={onDownload}
				message="El archivo no contiene datos previsualizables."
			/>
		);
	}

	return (
		<div className="relative flex h-full min-h-0 flex-col">
			<PreviewActionBar document={document} onDownload={onDownload} />
			{sheets.length > 1 ? (
				<div className="flex gap-2 overflow-x-auto border-b border-stone-200 px-3 py-2 pr-40">
					{sheets.map((sheet) => (
						<button
							key={sheet.name}
							type="button"
							onClick={() => setSelectedSheetName(sheet.name)}
							className={cn(
								"shrink-0 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
								sheet.name === selectedSheet.name
									? "border-stone-300 bg-stone-900 text-white"
									: "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
							)}
						>
							{sheet.name}
						</button>
					))}
				</div>
			) : null}
			<div className={cn("min-h-0 flex-1", sheets.length <= 1 ? "pt-16" : "")}>
				<ExcelGrid sheet={selectedSheet} />
			</div>
		</div>
	);
}

function WordDocumentPreview({
	document,
	previewUrl,
	onDownload,
}: {
	document: FileSystemItem;
	previewUrl: string;
	onDownload: (doc: FileSystemItem) => void;
}) {
	const ext = getFileExtension(document.name);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [html, setHtml] = useState("");
	const [messages, setMessages] = useState<MammothMessage[]>([]);

	useEffect(() => {
		let cancelled = false;

		const renderWordDocument = async () => {
			setIsLoading(true);
			setError(null);
			setHtml("");
			setMessages([]);

			if (ext === "doc") {
				setError("La vista previa embebida soporta DOCX. Los archivos .doc requieren descarga.");
				setIsLoading(false);
				return;
			}

			try {
				const response = await fetch(previewUrl, { cache: "no-store" });
				if (!response.ok) {
					throw new Error(`No se pudo cargar el documento (${response.status})`);
				}

				const mammothModule = (await import("mammoth/mammoth.browser")) as unknown as MammothModule;
				const result = await mammothModule.convertToHtml({
					arrayBuffer: await response.arrayBuffer(),
				}, {
					convertImage: mammothModule.images.imgElement(async (image) => {
						const imageBuffer = await image.readAsBase64String();
						return {
							src: `data:${image.contentType};base64,${imageBuffer}`,
						};
					}),
					styleMap: [
						"p[style-name='Normal (Web)'] => p:fresh",
						"p[style-name='Normal'] => p:fresh",
						"p[style-name='Title'] => h1:fresh",
						"p[style-name='Subtitle'] => h2:fresh",
						"p[style-name='Heading 1'] => h1:fresh",
						"p[style-name='Heading 2'] => h2:fresh",
						"p[style-name='Heading 3'] => h3:fresh",
						"p[style-name='Heading 4'] => h4:fresh",
						"p[style-name='Quote'] => blockquote:fresh",
						"p[style-name='Intense Quote'] => blockquote:fresh",
						"p[style-name='Code'] => pre:fresh",
						"r[style-name='Strong'] => strong",
						"r[style-name='Emphasis'] => em",
						"u => em",
						"strike => s",
						"table => table.docx-table:fresh",
					],
				});

				if (cancelled) return;

				setHtml(sanitizeWordHtml(result.value));
				setMessages(filterWordMessages(result.messages));
			} catch (renderError) {
				if (cancelled) return;
				setError(
					renderError instanceof Error
						? renderError.message
						: "No se pudo renderizar el documento Word."
				);
			} finally {
				if (!cancelled) {
					setIsLoading(false);
				}
			}
		};

		void renderWordDocument();
		return () => {
			cancelled = true;
		};
	}, [ext, previewUrl]);

	if (isLoading) {
		return (
			<div className="relative flex h-full flex-col">
				<PreviewActionBar document={document} onDownload={onDownload} />
				<div className="flex flex-1 items-center justify-center gap-2 text-sm text-stone-500">
					<Loader2 className="h-4 w-4 animate-spin" />
					Renderizando documento...
				</div>
			</div>
		);
	}

	if (error) {
		return <PreviewFallback document={document} onDownload={onDownload} message={error} />;
	}

	return (
		<div className="relative flex h-full flex-col">
			<PreviewActionBar document={document} onDownload={onDownload} />
			<div className="min-h-0 flex-1 overflow-auto bg-stone-50 p-6 pt-16">
				<div className="docx-preview-shell mx-auto max-w-4xl rounded-xl border border-stone-200 bg-white p-8 shadow-sm">
					<div
						className="docx-preview-content max-w-none text-sm leading-6 text-stone-700"
						dangerouslySetInnerHTML={{ __html: html }}
					/>
				</div>
				{messages.length > 0 ? (
					<div className="mx-auto mt-4 max-w-4xl rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
						{messages.map((message, index) => (
							<p key={`${message.type}-${index}`}>{message.message}</p>
						))}
					</div>
				) : null}
			</div>
			<style jsx>{`
				.docx-preview-content :global(h1),
				.docx-preview-content :global(h2),
				.docx-preview-content :global(h3),
				.docx-preview-content :global(h4),
				.docx-preview-content :global(h5),
				.docx-preview-content :global(h6) {
					color: #1c1917;
					font-weight: 700;
					line-height: 1.2;
					margin-top: 1.5rem;
					margin-bottom: 0.75rem;
				}

				.docx-preview-content :global(h1) {
					font-size: 1.75rem;
				}

				.docx-preview-content :global(h2) {
					font-size: 1.35rem;
				}

				.docx-preview-content :global(h3) {
					font-size: 1.1rem;
				}

				.docx-preview-content :global(p),
				.docx-preview-content :global(ul),
				.docx-preview-content :global(ol),
				.docx-preview-content :global(blockquote),
				.docx-preview-content :global(pre),
				.docx-preview-content :global(table) {
					margin-top: 0.75rem;
					margin-bottom: 0.75rem;
				}

				.docx-preview-content :global(ul),
				.docx-preview-content :global(ol) {
					padding-left: 1.5rem;
				}

				.docx-preview-content :global(ul) {
					list-style: disc;
				}

				.docx-preview-content :global(ol) {
					list-style: decimal;
				}

				.docx-preview-content :global(li) {
					margin: 0.25rem 0;
				}

				.docx-preview-content :global(blockquote) {
					border-left: 3px solid #d6d3d1;
					padding-left: 1rem;
					color: #57534e;
					font-style: italic;
				}

				.docx-preview-content :global(pre) {
					white-space: pre-wrap;
					background: #f5f5f4;
					border: 1px solid #e7e5e4;
					border-radius: 0.75rem;
					padding: 0.875rem 1rem;
					font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
					font-size: 0.8rem;
				}

				.docx-preview-content :global(table) {
					width: 100%;
					border-collapse: collapse;
					display: table;
					overflow: hidden;
					border-radius: 0.75rem;
					border: 1px solid #d6d3d1;
				}

				.docx-preview-content :global(th),
				.docx-preview-content :global(td) {
					border: 1px solid #e7e5e4;
					padding: 0.6rem 0.75rem;
					vertical-align: top;
					text-align: left;
				}

				.docx-preview-content :global(th) {
					background: #f5f5f4;
					font-weight: 600;
				}

				.docx-preview-content :global(img) {
					display: block;
					max-width: 100%;
					height: auto;
					margin: 1rem auto;
					border-radius: 0.5rem;
				}

				.docx-preview-content :global(hr) {
					border: 0;
					border-top: 1px solid #d6d3d1;
					margin: 1.25rem 0;
				}

				.docx-preview-content :global(a) {
					color: #0f766e;
					text-decoration: underline;
				}

				.docx-preview-content :global(strong) {
					font-weight: 700;
				}

				.docx-preview-content :global(em) {
					font-style: italic;
				}
			`}</style>
		</div>
	);
}

function ModelDocumentPreview({
	document,
	onDownload,
}: {
	document: FileSystemItem;
	onDownload: (doc: FileSystemItem) => void;
}) {
	const [resolvedUrn, setResolvedUrn] = useState<string | null>(document.apsUrn ?? null);
	const [isLoading, setIsLoading] = useState(Boolean(document.storagePath || document.apsUrn));
	const [status, setStatus] = useState<string | null>(document.apsUrn ? "checking" : null);
	const [progressLabel, setProgressLabel] = useState<string | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

		const pollManifest = async (urn: string) => {
			for (let attempt = 0; attempt < 18; attempt += 1) {
				const response = await fetch(`/api/aps/status?urn=${encodeURIComponent(urn)}`, {
					cache: "no-store",
				});
				const payload = await response.json().catch(() => null);
				if (cancelled) return;

				if (!response.ok) {
					setStatus("ready");
					setProgressLabel(null);
					setErrorMessage(null);
					setIsLoading(false);
					return;
				}

				const manifestStatus =
					typeof payload?.status === "string" ? payload.status.toLowerCase() : null;
				const manifestProgress =
					typeof payload?.progress === "string" ? payload.progress : null;

				if (manifestStatus === "success") {
					setStatus("ready");
					setProgressLabel(null);
					setErrorMessage(null);
					setIsLoading(false);
					return;
				}

				if (manifestStatus === "failed") {
					setStatus("failed");
					setProgressLabel(manifestProgress);
					setErrorMessage(
						typeof payload?.diagnostic === "string"
							? payload.diagnostic
							: "APS no pudo generar la vista 3D para este archivo."
					);
					setIsLoading(false);
					return;
				}

				setStatus("processing");
				setProgressLabel(manifestProgress);
				setErrorMessage(null);
				await wait(4000);
				if (cancelled) return;
			}

			setStatus("ready");
			setProgressLabel(null);
			setErrorMessage(null);
			setIsLoading(false);
		};

		const ensureModelUrn = async () => {
			if (!document.storagePath && !document.apsUrn) {
				setResolvedUrn(null);
				setStatus("missing");
				setErrorMessage("Este archivo no tiene una ruta válida para generar la vista 3D.");
				setIsLoading(false);
				return;
			}

			setIsLoading(true);
			setErrorMessage(null);
			setProgressLabel(null);

			try {
				let urn = document.apsUrn ?? null;

				if (!urn && document.storagePath) {
					const modelResponse = await fetch(
						`/api/aps/models?filePath=${encodeURIComponent(document.storagePath)}`,
						{ cache: "no-store" }
					);
					const modelPayload = await modelResponse.json().catch(() => null);
					if (cancelled) return;

					if (modelResponse.ok && typeof modelPayload?.data?.aps_urn === "string") {
						urn = modelPayload.data.aps_urn;
					}
				}

				if (!urn && document.storagePath) {
					setStatus("uploading");
					const formData = new FormData();
					formData.append("storagePath", document.storagePath);
					formData.append("fileName", document.name);

					const uploadResponse = await fetch("/api/aps/upload", {
						method: "POST",
						body: formData,
					});
					const uploadPayload = await uploadResponse.json().catch(() => null);
					if (cancelled) return;

					if (!uploadResponse.ok || typeof uploadPayload?.urn !== "string") {
						throw new Error(
							typeof uploadPayload?.error === "string"
								? uploadPayload.error
								: "No se pudo iniciar el procesamiento 3D en APS."
						);
					}

					urn = uploadPayload.urn;
				}

				if (!urn) {
					setResolvedUrn(null);
					setStatus("missing");
					setErrorMessage("No encontramos un modelo APS asociado a este archivo.");
					setIsLoading(false);
					return;
				}

				setResolvedUrn(urn);
				setStatus("checking");
				await pollManifest(urn);
			} catch (modelError) {
				if (cancelled) return;
				setResolvedUrn(null);
				setStatus("failed");
				setErrorMessage(
					modelError instanceof Error
						? modelError.message
						: "No se pudo cargar la vista 3D."
				);
				setIsLoading(false);
			}
		};

		void ensureModelUrn();
		return () => {
			cancelled = true;
		};
	}, [document.apsUrn, document.name, document.storagePath]);

	if (resolvedUrn && status === "ready") {
		return (
			<div className="relative flex h-full flex-col">
				<PreviewActionBar document={document} onDownload={onDownload} />
				<div className="min-h-0 flex-1">
					<ForgeViewer urn={resolvedUrn} />
				</div>
			</div>
		);
	}

	if (isLoading) {
		return (
			<div className="relative flex h-full flex-col">
				<PreviewActionBar document={document} onDownload={onDownload} />
				<div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center text-sm text-stone-500">
					<Loader2 className="h-4 w-4 animate-spin" />
					<p>
						{status === "uploading"
							? "Enviando modelo a APS..."
							: status === "checking" || status === "processing"
								? "Preparando vista 3D..."
								: "Cargando visor 3D..."}
					</p>
					{progressLabel ? <p className="text-xs text-stone-400">{progressLabel}</p> : null}
				</div>
			</div>
		);
	}

	return (
		<PreviewFallback
			document={document}
			onDownload={onDownload}
			message={
				status === "processing"
					? `El modelo 3D todavía se está procesando${progressLabel ? ` (${progressLabel})` : ""}.`
					: errorMessage ?? "Vista 3D no disponible para este archivo."
			}
		/>
	);
}

export const DocumentPreview = memo(function DocumentPreview({
	document,
	previewUrl,
	onDownload,
}: DocumentPreviewProps) {
	if (!document) {
		return (
			<div className="flex h-full flex-col items-center justify-center text-stone-400">
				<Eye className="mb-4 h-16 w-16 opacity-20" />
				<p>Selecciona un documento para previsualizar</p>
			</div>
		);
	}

	const previewKind = getPreviewKind(document);

	if (previewKind === "model") {
		return <ModelDocumentPreview document={document} onDownload={onDownload} />;
	}

	if (!previewUrl) {
		return <PreviewFallback document={document} onDownload={onDownload} />;
	}

	if (previewKind === "image" || previewKind === "pdf") {
		return (
			<div className="flex h-full flex-col">
				<EnhancedDocumentViewer
					title={false}
					url={previewUrl}
					fileName={document.name}
					fileType={previewKind === "pdf" ? "pdf" : "image"}
					onDownload={() => onDownload(document)}
				/>
			</div>
		);
	}

	if (previewKind === "spreadsheet" || previewKind === "csv" || previewKind === "text") {
		return (
			<SpreadsheetLikePreview
				document={document}
				previewUrl={previewUrl}
				onDownload={onDownload}
				mode={previewKind}
			/>
		);
	}

	if (previewKind === "word") {
		return (
			<WordDocumentPreview
				document={document}
				previewUrl={previewUrl}
				onDownload={onDownload}
			/>
		);
	}

	return <PreviewFallback document={document} onDownload={onDownload} />;
});
