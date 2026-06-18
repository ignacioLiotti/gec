"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactElement, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
	AlertCircle,
	CheckCircle2,
	ChevronLeft,
	Clock,
	Download,
	File,
	FileImage,
	FileText,
	Loader2,
	RefreshCw,
	Search,
	Table2,
	XIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { TabsContent } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import FolderFront from "@/components/ui/FolderFront";
import { NotchTail } from "@/components/ui/notch-tail";
import type { FormTable as FormTableComponent } from "@/components/form-table/form-table";
import type { CellType, ColumnDef, ColumnField, FormTableConfig, FormTableRow } from "@/components/form-table/types";
import { cn } from "@/lib/utils";
import { formatReadableBytes } from "@/lib/tenant-expenses";
import { evaluateTablaFormula, normalizeFolderName, normalizeFolderPath, toNumericValue } from "@/lib/tablas";
import type { FileSystemItem, OcrFolderLink, TablaDataRow } from "./file-manager/types";

const FormTable = dynamic(
	() => import("@/components/form-table/form-table").then((mod) => mod.FormTable),
	{
		loading: () => (
			<div className="flex min-h-[240px] items-center justify-center rounded-lg border bg-stone-50 text-sm text-stone-500">
				Cargando tabla...
			</div>
		),
	},
) as typeof FormTableComponent;

const DocumentSheet = dynamic(
	() => import("./file-manager/components/document-sheet").then((mod) => mod.DocumentSheet),
	{ ssr: false },
);

type DocumentDataSheetComponent = <Row extends FormTableRow, Filters>(props: {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	document: FileSystemItem | null;
	tableConfig: FormTableConfig<Row, Filters> | null;
	dataTableSelector?: ReactNode;
}) => ReactElement | null;

const DocumentDataSheet = dynamic(
	() => import("./file-manager/components/document-data-sheet").then((mod) => mod.DocumentDataSheet),
	{ ssr: false },
) as DocumentDataSheetComponent;

type DocumentsListPayload = {
	tree: FileSystemItem | null;
	folder?: FileSystemItem | null;
	links?: OcrFolderLink[];
	warnings?: string[];
	clientLoadMs?: number;
};

type BatchAccessPayload = {
	urls?: Record<string, string>;
	errors?: Record<string, string>;
};

type DocumentAccessPayload = {
	error?: string;
	code?: string;
};

type DocumentDownloadError = Error & {
	code?: string;
	status?: number;
};

type ReprocessTableResult = {
	tablaName?: string;
	inserted?: number;
};

type TablaRowsPayload = {
	rows?: TablaDataRow[];
};

type FolderState = {
	path: string;
	label: string;
};

type DocumentsNewTableRow = FormTableRow & Record<string, unknown>;

type OcrStatusMeta = {
	icon: typeof CheckCircle2;
	label: string;
	shortLabel: string;
	tooltip: string;
	toneClassName: string;
};

type PdfViewport = {
	width: number;
	height: number;
};

type PdfPageProxy = {
	getViewport(options: { scale: number }): PdfViewport;
	render(params: { canvasContext: CanvasRenderingContext2D; viewport: PdfViewport }): { promise: Promise<void> };
};

type PdfDocumentProxy = {
	numPages: number;
	getPage(pageNumber: number): Promise<PdfPageProxy>;
	destroy?: () => void | Promise<void>;
};

type PdfJsModule = {
	GlobalWorkerOptions?: { workerSrc: string };
	getDocument(params: { data: Uint8Array; disableWorker?: boolean }): { promise: Promise<PdfDocumentProxy> };
};

const PREVIEW_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif", "avif", "pdf"]);
const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif", "avif"]);
const INITIAL_VISIBLE_FILES = 80;
const FOLDER_STALE_TIME = 10 * 60 * 1000;
const TABLE_ROWS_STALE_TIME = 30 * 1000;
const PDF_THUMBNAIL_MAX_SIZE = 220;

let pdfJsModulePromise: Promise<PdfJsModule> | null = null;
const pdfThumbnailCache = new Map<string, string>();
let activePdfThumbnailTasks = 0;
const pendingPdfThumbnailTasks: Array<() => void> = [];

function normalizePath(path: string) {
	return path
		.split("/")
		.map((part) => part.trim())
		.filter(Boolean)
		.join("/");
}

function getFolderLookupKeys(folderName: string, obraId: string) {
	const keys = new Set<string>();
	const normalizedPath = normalizeFolderPath(folderName);
	if (normalizedPath) {
		keys.add(normalizedPath);
		if (normalizedPath === obraId) {
			keys.add("");
		} else if (normalizedPath.startsWith(`${obraId}/`)) {
			keys.add(normalizedPath.slice(obraId.length + 1));
		}
	}
	const normalizedFlat = normalizeFolderName(folderName);
	if (normalizedFlat) {
		keys.add(normalizedFlat);
	}
	for (const key of Array.from(keys)) {
		const flat = normalizeFolderName(key);
		if (flat) keys.add(flat);
	}
	return Array.from(keys).filter(Boolean);
}

function getRelativeFolderPath(item: FileSystemItem) {
	if (item.relativePath) return normalizePath(item.relativePath);
	if (item.storagePath) {
		const segments = item.storagePath.split("/").filter(Boolean);
		segments.shift();
		return normalizePath(segments.join("/"));
	}
	return "";
}

function clonePdfBytes(pdfBytes: Uint8Array) {
	return pdfBytes.slice();
}

function loadPdfJs() {
	pdfJsModulePromise ??= import("pdfjs-dist/legacy/build/pdf.mjs").then((pdfjsModule) => {
		const pdfjs = pdfjsModule as unknown as PdfJsModule;
		if (pdfjs.GlobalWorkerOptions && !pdfjs.GlobalWorkerOptions.workerSrc) {
			pdfjs.GlobalWorkerOptions.workerSrc = new URL(
				"pdfjs-dist/build/pdf.worker.min.mjs",
				import.meta.url,
			).toString();
		}
		return pdfjs;
	});
	return pdfJsModulePromise;
}

function enqueuePdfThumbnailTask<T>(task: () => Promise<T>): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		const run = () => {
			activePdfThumbnailTasks += 1;
			task()
				.then(resolve, reject)
				.finally(() => {
					activePdfThumbnailTasks = Math.max(0, activePdfThumbnailTasks - 1);
					const nextTask = pendingPdfThumbnailTasks.shift();
					if (nextTask) nextTask();
				});
		};

		if (activePdfThumbnailTasks < 1) {
			run();
		} else {
			pendingPdfThumbnailTasks.push(run);
		}
	});
}

async function renderPdfFirstPageThumbnail(pdfBytes: Uint8Array) {
	const pdfjs = await loadPdfJs();
	const loadingTask = pdfjs.getDocument({ data: clonePdfBytes(pdfBytes) });
	const pdf = await loadingTask.promise;

	try {
		const page = await pdf.getPage(1);
		const viewport = page.getViewport({ scale: 1 });
		const scale = Math.min(
			PDF_THUMBNAIL_MAX_SIZE / viewport.width,
			PDF_THUMBNAIL_MAX_SIZE / viewport.height,
			1,
		);
		const scaledViewport = page.getViewport({ scale });
		const canvas = document.createElement("canvas");
		const ctx = canvas.getContext("2d");
		if (!ctx) return null;
		canvas.width = Math.max(1, Math.floor(scaledViewport.width));
		canvas.height = Math.max(1, Math.floor(scaledViewport.height));
		await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;
		return canvas.toDataURL("image/png");
	} finally {
		if (typeof pdf.destroy === "function") {
			await pdf.destroy();
		}
	}
}

function getParentFolder(path: string): FolderState {
	const segments = normalizePath(path).split("/").filter(Boolean);
	segments.pop();
	const parentPath = segments.join("/");
	return {
		path: parentPath,
		label: parentPath ? segments[segments.length - 1] ?? "Carpeta" : "Todos los documentos",
	};
}

function getFileExtension(name: string) {
	return name.toLowerCase().split(".").pop() ?? "";
}

function isPreviewable(item: FileSystemItem) {
	const ext = getFileExtension(item.name);
	return Boolean(item.mimetype?.startsWith("image/")) || PREVIEW_EXTENSIONS.has(ext);
}

function isImageItem(item: FileSystemItem) {
	return (
		Boolean(item.mimetype?.startsWith("image/")) ||
		IMAGE_EXTENSIONS.has(getFileExtension(item.name))
	);
}

function isPdfItem(item: FileSystemItem) {
	return item.mimetype === "application/pdf" || getFileExtension(item.name) === "pdf";
}

function getOcrStatusMeta(item: FileSystemItem): OcrStatusMeta | null {
	if (item.type !== "file" || !item.ocrDocumentStatus) return null;

	const rowsExtracted =
		typeof item.ocrRowsExtracted === "number" && Number.isFinite(item.ocrRowsExtracted)
			? item.ocrRowsExtracted
			: null;

	switch (item.ocrDocumentStatus) {
		case "completed":
			if (rowsExtracted !== null && rowsExtracted <= 0) {
				return {
					icon: AlertCircle,
					label: "Sin datos extraidos",
					shortLabel: "Sin datos",
					tooltip: "La extraccion termino pero no se encontraron datos.",
					toneClassName: "border-rose-300 bg-rose-50 text-rose-800 shadow-[0_8px_18px_rgba(225,29,72,0.14)]",
				};
			}
			return {
				icon: CheckCircle2,
				label: rowsExtracted && rowsExtracted > 0 ? `${rowsExtracted} dato${rowsExtracted === 1 ? "" : "s"} extraidos` : "Datos extraidos",
				shortLabel: "Extraido",
				tooltip:
					rowsExtracted && rowsExtracted > 0
						? `Extraccion completada con ${rowsExtracted} dato${rowsExtracted === 1 ? "" : "s"} detectados.`
						: "Extraccion completada correctamente.",
				toneClassName: "border-emerald-300 bg-emerald-50 text-emerald-800 shadow-[0_8px_18px_rgba(5,150,105,0.14)]",
			};
		case "failed":
			return {
				icon: AlertCircle,
				label: item.ocrErrorCode === "LINEAGE_RECONCILIATION_CONFLICT" ? "Conflicto de lineage" : "Error de OCR",
				shortLabel: item.ocrErrorCode === "LINEAGE_RECONCILIATION_CONFLICT" ? "Conflicto" : "Error OCR",
				tooltip: item.ocrDocumentError?.trim() || "La extraccion fallo y no se pudieron obtener datos.",
				toneClassName: "border-rose-300 bg-rose-50 text-rose-800 shadow-[0_8px_18px_rgba(225,29,72,0.14)]",
			};
		case "processing":
			return {
				icon: Loader2,
				label: "Extrayendo datos",
				shortLabel: "Procesando",
				tooltip: "La extraccion OCR esta en proceso.",
				toneClassName: "border-sky-300 bg-sky-50 text-sky-800 shadow-[0_8px_18px_rgba(14,165,233,0.14)]",
			};
		case "pending":
			return {
				icon: Clock,
				label: "Pendiente de OCR",
				shortLabel: "Pendiente",
				tooltip: "El documento esta esperando procesamiento OCR.",
				toneClassName: "border-amber-300 bg-amber-50 text-amber-800 shadow-[0_8px_18px_rgba(245,158,11,0.14)]",
			};
		case "unprocessed":
			return {
				icon: XIcon,
				label: "Sin extraer",
				shortLabel: "Sin OCR",
				tooltip: "Todavia no se ejecuto la extraccion de datos para este documento.",
				toneClassName: "border-stone-300 bg-white text-stone-700 shadow-[0_8px_18px_rgba(28,25,23,0.08)]",
			};
		default:
			return null;
	}
}

function renderOcrStatusBadge(item: FileSystemItem) {
	const meta = getOcrStatusMeta(item);
	if (!meta) return null;

	const Icon = meta.icon;
	const className = cn(
		"inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] backdrop-blur-sm",
		meta.toneClassName,
	);

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<span className={className} aria-label={meta.label}>
					<Icon className={cn("size-3.5 shrink-0", meta.icon === Loader2 && "animate-spin")} />
				</span>
			</TooltipTrigger>
			<TooltipContent>{meta.tooltip}</TooltipContent>
		</Tooltip>
	);
}

function mapDataTypeToCellType(dataType: string | undefined): CellType {
	switch (dataType) {
		case "number":
			return "number";
		case "currency":
			return "currency";
		case "boolean":
			return "checkbox";
		case "date":
			return "date";
		default:
			return "text";
	}
}

function getConditionalClass(value: unknown, config?: Record<string, unknown>): string | undefined {
	const conditional =
		config?.conditional && typeof config.conditional === "object"
			? (config.conditional as Record<string, unknown>)
			: null;
	if (!conditional) return undefined;
	const numeric = toNumericValue(value);
	if (numeric == null) return undefined;
	const criticalBelow = toNumericValue(conditional.criticalBelow);
	const criticalAbove = toNumericValue(conditional.criticalAbove);
	const warnBelow = toNumericValue(conditional.warnBelow);
	const warnAbove = toNumericValue(conditional.warnAbove);
	if (criticalBelow != null && numeric <= criticalBelow) return "bg-red-100 text-red-800";
	if (criticalAbove != null && numeric >= criticalAbove) return "bg-red-100 text-red-800";
	if (warnBelow != null && numeric <= warnBelow) return "bg-amber-100 text-amber-800";
	if (warnAbove != null && numeric >= warnAbove) return "bg-amber-100 text-amber-800";
	return undefined;
}

async function fetchDocumentsList(obraId: string, path: string) {
	const suffix = path ? `?path=${encodeURIComponent(path)}` : "";
	const response = await fetch(`/api/obras/${encodeURIComponent(obraId)}/documents/list${suffix}`, {
		cache: "no-store",
	});
	const payload = await response.json().catch(() => ({}));
	if (!response.ok) {
		throw new Error(payload?.error ?? "No se pudieron cargar documentos");
	}
	return payload as DocumentsListPayload;
}

async function fetchBatchAccess(obraId: string, paths: string[]) {
	if (paths.length === 0) return {};
	const response = await fetch(`/api/obras/${encodeURIComponent(obraId)}/documents/access/batch`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ paths, expiresIn: 3600 }),
	});
	const payload = (await response.json().catch(() => ({}))) as BatchAccessPayload;
	if (!response.ok) {
		throw new Error((payload as { error?: string })?.error ?? "No se pudieron firmar miniaturas");
	}
	return payload.urls ?? {};
}

async function fetchTablaRows(obraId: string, tablaId: string) {
	const response = await fetch(
		`/api/obras/${encodeURIComponent(obraId)}/tablas/${encodeURIComponent(tablaId)}/rows?limit=200&includeCount=0`,
		{ cache: "no-store" },
	);
	const payload = (await response.json().catch(() => ({}))) as TablaRowsPayload & { error?: string };
	if (!response.ok) {
		throw new Error(payload.error ?? "No se pudieron cargar los datos extraidos");
	}
	return Array.isArray(payload.rows) ? payload.rows : [];
}

async function fetchStoredDocumentBlob(obraId: string, storagePath: string) {
	const params = new URLSearchParams({
		path: storagePath,
		download: "1",
	});
	const response = await fetch(`/api/obras/${encodeURIComponent(obraId)}/documents/access?${params.toString()}`, {
		cache: "no-store",
	});
	if (!response.ok) {
		const payload = (await response.json().catch(() => ({}))) as DocumentAccessPayload;
		const error = new Error(payload.error ?? "No se pudo descargar el documento.") as DocumentDownloadError;
		error.status = response.status;
		if (typeof payload.code === "string") error.code = payload.code;
		throw error;
	}
	return response.blob();
}

function getDocumentDownloadErrorMessage(error: unknown) {
	const downloadError = error as DocumentDownloadError;
	if (downloadError?.code === "DOCUMENT_STORAGE_MISSING") {
		return "El documento figura en metadata, pero el archivo ya no existe en Storage.";
	}
	if (error instanceof Error && error.message) return error.message;
	return "No se pudo descargar el documento.";
}

function triggerBlobDownload(blob: Blob, fileName: string) {
	const objectUrl = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = objectUrl;
	anchor.download = fileName;
	document.body.appendChild(anchor);
	anchor.click();
	anchor.remove();
	window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

function FilePreview({
	item,
	signedUrl,
}: {
	item: FileSystemItem;
	signedUrl?: string;
}) {
	const ext = getFileExtension(item.name);
	const storagePath = item.storagePath;
	const [pdfThumbnailUrl, setPdfThumbnailUrl] = useState<string | null>(
		storagePath ? pdfThumbnailCache.get(storagePath) ?? null : null,
	);

	useEffect(() => {
		if (!signedUrl || !storagePath || ext !== "pdf") return;
		const cached = pdfThumbnailCache.get(storagePath);
		if (cached) {
			return;
		}
		let cancelled = false;
		void enqueuePdfThumbnailTask(async () => {
			const response = await fetch(signedUrl, { cache: "force-cache" });
			if (!response.ok) return null;
			const pdfBytes = new Uint8Array(await response.arrayBuffer());
			return renderPdfFirstPageThumbnail(pdfBytes);
		})
			.then((thumbnail) => {
				if (!thumbnail || cancelled) return;
				pdfThumbnailCache.set(storagePath, thumbnail);
				setPdfThumbnailUrl(thumbnail);
			})
			.catch((error) => {
				if (!cancelled) console.warn("[documents-new] PDF thumbnail failed", error);
			});
		return () => {
			cancelled = true;
		};
	}, [ext, signedUrl, storagePath]);

	if (signedUrl && isImageItem(item)) {
		return (
			<img
				src={signedUrl}
				alt={item.name}
				className="h-full w-full object-cover"
				loading="lazy"
				decoding="async"
			/>
		);
	}
	if (ext === "pdf" && pdfThumbnailUrl) {
		return (
			<img
				src={pdfThumbnailUrl}
				alt={item.name}
				className="h-full w-full object-cover"
				loading="lazy"
				decoding="async"
			/>
		);
	}
	if (ext === "pdf") {
		return <FileText className="size-8 text-red-500" />;
	}
	if (isPreviewable(item)) {
		return <FileImage className="size-8 text-amber-600" />;
	}
	return <File className="size-8 text-stone-500" />;
}

function FolderThumbnail({
	item,
	onClick,
	onPrefetch,
}: {
	item: FileSystemItem;
	onClick: () => void;
	onPrefetch: () => void;
}) {
	const isOcrEnabled = Boolean(item.ocrEnabled);
	const hasContent =
		Boolean(item.hasFiles) ||
		(typeof item.fileCount === "number" && item.fileCount > 0) ||
		Boolean(item.children && item.children.length > 0);

	return (
		<div className="group flex h-[105px] shrink-0 flex-col items-center justify-end gap-2">
			<button
				type="button"
				onClick={onClick}
				onMouseEnter={onPrefetch}
				onFocus={onPrefetch}
				className={cn(
					"relative ml-1 mb-1 flex h-[85px] w-[120px] flex-col items-start gap-2 rounded-lg border p-3 pb-1 transition-colors",
					isOcrEnabled ? "bg-linear-to-b from-amber-500 to-amber-700" : "bg-linear-to-b from-stone-500 to-stone-700",
				)}
			>
				<div className="flex h-full w-full flex-col items-center justify-end">
					{hasContent ? (
						<span className="absolute -top-2 left-1/2 h-[80px] w-[100px] -translate-x-1/2 border bg-linear-to-b from-stone-100 to-stone-200 transition-all duration-200 ease-in-out group-hover:-top-4" />
					) : null}
					<FolderFront
						firstStopColor={isOcrEnabled ? "#fe9a00" : "#79716b"}
						secondStopColor={isOcrEnabled ? "#fb8634" : "#57534d"}
						className="absolute -bottom-1 -left-3 h-[80px] w-[140px] origin-[50%_100%] transition-transform duration-300 group-hover:transform-[perspective(800px)_rotateX(-30deg)]"
					/>
					{isOcrEnabled ? <Table2 className="absolute top-5 z-10 size-5 text-white/90" /> : null}
					<span className="z-10 w-full truncate text-center text-sm text-white" title={item.name}>
						{item.name}
					</span>
				</div>
			</button>
		</div>
	);
}

export function ObraDocumentsNewTab({ obraId }: { obraId: string }) {
	const pathname = usePathname();
	const router = useRouter();
	const queryClient = useQueryClient();
	const searchParams = useSearchParams();
	const selectedFolderPath = normalizePath(searchParams.get("folder") ?? "");
	const [search, setSearch] = useState("");
	const [visibleLimit, setVisibleLimit] = useState(INITIAL_VISIBLE_FILES);
	const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
	const [documentViewMode, setDocumentViewMode] = useState<"cards" | "table">("cards");
	const [activeOcrTablaIdOverride, setActiveOcrTablaIdOverride] = useState<string | null>(null);
	const [isDownloadingAll, setIsDownloadingAll] = useState(false);
	const [isReprocessingAll, setIsReprocessingAll] = useState(false);
	const [isReprocessAllConfirmOpen, setIsReprocessAllConfirmOpen] = useState(false);
	const [reprocessAllProgress, setReprocessAllProgress] = useState<{ done: number; total: number; errors: number } | null>(null);
	const [retryingDocumentId, setRetryingDocumentId] = useState<string | null>(null);
	const [selectedDocument, setSelectedDocument] = useState<FileSystemItem | null>(null);
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	const [isDocumentSheetOpen, setIsDocumentSheetOpen] = useState(false);
	const [isDocumentDataSheetOpen, setIsDocumentDataSheetOpen] = useState(false);
	const reprocessAllAbortRef = useRef(false);
	const previewRequestIdRef = useRef(0);

	const folderQuery = useQuery({
		queryKey: ["obra", obraId, "documents-new", "folder", selectedFolderPath],
		queryFn: () => fetchDocumentsList(obraId, selectedFolderPath),
		enabled: Boolean(obraId),
		staleTime: FOLDER_STALE_TIME,
		refetchOnWindowFocus: false,
	});

	const folderNode = folderQuery.data?.folder ?? folderQuery.data?.tree ?? null;
	const children = folderNode?.children ?? [];
	const folders = children.filter((item) => item.type === "folder");
	const files = children.filter((item) => item.type === "file" && item.name !== ".keep");
	const allLinks = useMemo(() => folderQuery.data?.links ?? [], [folderQuery.data?.links]);
	const folderLookupKeys = useMemo(() => {
		const keys = new Set<string>();
		const candidates = [
			selectedFolderPath,
			folderNode?.relativePath,
			folderNode?.ocrFolderName,
			folderNode?.name,
		].filter((value): value is string => typeof value === "string" && value.trim().length > 0);
		for (const candidate of candidates) {
			getFolderLookupKeys(candidate, obraId).forEach((key) => keys.add(key));
		}
		return keys;
	}, [folderNode?.name, folderNode?.ocrFolderName, folderNode?.relativePath, obraId, selectedFolderPath]);
	const activeFolderLinks = useMemo<OcrFolderLink[]>(() => {
		if (!folderNode?.ocrEnabled) return [];
		const matchingLinks = allLinks.filter((link) => {
			if (folderNode.ocrTablaId && link.tablaId === folderNode.ocrTablaId) return true;
			return getFolderLookupKeys(link.folderName, obraId).some((key) => folderLookupKeys.has(key));
		});
		if (matchingLinks.length > 0) {
			return matchingLinks.toSorted((left, right) =>
				(left.tablaName ?? "").localeCompare(right.tablaName ?? "", "es", { sensitivity: "base" }),
			);
		}
		if (!folderNode.ocrTablaId) return [];
		return [
			{
				tablaId: folderNode.ocrTablaId,
				tablaName: folderNode.ocrTablaName ?? "Tabla",
				folderName: folderNode.ocrFolderName ?? selectedFolderPath,
				columns: folderNode.ocrTablaColumns ?? [],
				rows: folderNode.ocrTablaRows ?? [],
				orders: [],
				documents: [],
				dataInputMethod: folderNode.dataInputMethod,
			},
		];
	}, [
		allLinks,
		folderLookupKeys,
		folderNode?.dataInputMethod,
		folderNode?.ocrEnabled,
		folderNode?.ocrFolderName,
		folderNode?.ocrTablaColumns,
		folderNode?.ocrTablaId,
		folderNode?.ocrTablaName,
		folderNode?.ocrTablaRows,
		obraId,
		selectedFolderPath,
	]);
	const activeFolderLink = useMemo(() => {
		if (activeFolderLinks.length === 0) return null;
		if (activeOcrTablaIdOverride) {
			return activeFolderLinks.find((link) => link.tablaId === activeOcrTablaIdOverride) ?? activeFolderLinks[0] ?? null;
		}
		return activeFolderLinks[0] ?? null;
	}, [activeFolderLinks, activeOcrTablaIdOverride]);
	const activeOcrTablaId = activeFolderLink?.tablaId ?? null;
	const hasTablaSchema = Boolean(activeFolderLink?.columns && activeFolderLink.columns.length > 0);
	const showArchivosTablaToggle = Boolean(folderNode?.ocrEnabled && hasTablaSchema && activeFolderLink?.dataInputMethod !== "manual");
	const isOcrFolder = Boolean(folderNode?.ocrEnabled);
	const reprocessableFiles = useMemo(() => {
		if (!isOcrFolder || activeFolderLinks.length === 0) return [] as FileSystemItem[];
		return files.filter((file) => typeof file.storagePath === "string" && file.storagePath.trim().length > 0);
	}, [activeFolderLinks.length, files, isOcrFolder]);
	const fileDownloadEntries = useMemo(
		() =>
			files
				.filter((file) => typeof file.storagePath === "string" && file.storagePath.trim().length > 0)
				.map((file) => ({
					name: file.name,
					storagePath: file.storagePath as string,
				})),
		[files],
	);
	const selectedFolderLabel =
		folderNode?.name ??
		(selectedFolderPath
			? selectedFolderPath.split("/").filter(Boolean).at(-1) ?? "Carpeta"
			: "Todos los documentos");

	const searchTerm = search.trim().toLowerCase();
	const filteredFiles = searchTerm
		? files.filter((item) => item.name.toLowerCase().includes(searchTerm))
		: files;
	const visibleFiles = filteredFiles.slice(0, visibleLimit);
	const previewPaths = visibleFiles
		.filter((item) => item.storagePath && (isImageItem(item) || isPdfItem(item)))
		.map((item) => item.storagePath as string)
		.filter((path) => !signedUrls[path])
		.slice(0, 80);
	const previewPathKey = previewPaths.join("\n");
	const tablaRowsQuery = useQuery({
		queryKey: ["obra", obraId, "documents-new", "tabla-rows", activeOcrTablaId],
		queryFn: () => fetchTablaRows(obraId, activeOcrTablaId as string),
		enabled: Boolean(obraId && activeOcrTablaId && (documentViewMode === "table" || selectedDocument?.storagePath)),
		staleTime: TABLE_ROWS_STALE_TIME,
		refetchOnWindowFocus: false,
	});
	const activeTablaRows = useMemo(
		() => tablaRowsQuery.data ?? activeFolderLink?.rows ?? [],
		[activeFolderLink?.rows, tablaRowsQuery.data],
	);
	const tableRows = useMemo<DocumentsNewTableRow[]>(() => {
		const columns = activeFolderLink?.columns ?? [];
		if (columns.length === 0) return [];
		return activeTablaRows.map((row) => {
			const data = (row.data as Record<string, unknown>) ?? {};
			const mapped: DocumentsNewTableRow = { id: row.id };
			columns.forEach((column) => {
				mapped[column.fieldKey] = data[column.fieldKey];
			});
			columns.forEach((column) => {
				const formula =
					column.config && typeof column.config.formula === "string"
						? column.config.formula.trim()
						: "";
				if (!formula) return;
				mapped[column.fieldKey] = evaluateTablaFormula(formula, mapped);
			});
			if (typeof data.__docFileName === "string") mapped.__docFileName = data.__docFileName;
			if (typeof data.__docPath === "string") mapped.__docPath = data.__docPath;
			if (typeof row.source === "string") mapped.source = row.source;
			if (typeof row.extraction_id === "string") mapped.extraction_id = row.extraction_id;
			if (typeof row.lineage_row_key === "string") mapped.lineage_row_key = row.lineage_row_key;
			return mapped;
		});
	}, [activeFolderLink?.columns, activeTablaRows]);
	const ocrTableConfig = useMemo<FormTableConfig<DocumentsNewTableRow, Record<string, never>> | null>(() => {
		const columns = activeFolderLink?.columns ?? [];
		if (!activeOcrTablaId || columns.length === 0) return null;
		const tableColumns: ColumnDef<DocumentsNewTableRow>[] = columns.map((column) => ({
			id: column.id,
			label: column.label,
			field: column.fieldKey as ColumnField<DocumentsNewTableRow>,
			editable: false,
			cellType: mapDataTypeToCellType(column.dataType),
			required: column.required,
			cellClassName: (row) => getConditionalClass(row[column.fieldKey], column.config),
		}));
		const emptyStateMessage = tablaRowsQuery.isFetching
			? "Cargando datos extraidos..."
			: "Sin datos extraidos todavia.";
		return {
			tableId: `documents-new-ocr-${obraId}-${activeOcrTablaId}`,
			editMode: "active-cell",
			readOnly: true,
			searchPlaceholder: "Buscar en esta tabla",
			columns: tableColumns,
			defaultRows: tableRows,
			disablePagination: true,
			emptyStateMessage,
			showInlineSearch: true,
			hideFooterPaginationSummary: true,
			enableColumnResizing: true,
		};
	}, [activeFolderLink?.columns, activeOcrTablaId, obraId, tableRows, tablaRowsQuery.isFetching]);
	const selectedDocumentRows = useMemo(() => {
		const docPath = selectedDocument?.storagePath ?? null;
		if (!docPath) return [] as DocumentsNewTableRow[];
		return tableRows.filter((row) => row.__docPath === docPath);
	}, [selectedDocument?.storagePath, tableRows]);
	const documentDataTableConfig = useMemo<FormTableConfig<DocumentsNewTableRow, Record<string, never>> | null>(() => {
		if (!ocrTableConfig || !selectedDocument) return null;
		return {
			...ocrTableConfig,
			tableId: `${ocrTableConfig.tableId}-document-${selectedDocument.id}`,
			defaultRows: selectedDocumentRows,
			emptyStateMessage: tablaRowsQuery.isFetching
				? "Cargando datos extraidos..."
				: "Este documento no tiene datos extraidos.",
		};
	}, [ocrTableConfig, selectedDocument, selectedDocumentRows, tablaRowsQuery.isFetching]);

	useEffect(() => {
		if (activeFolderLinks.length === 0) {
			setActiveOcrTablaIdOverride(null);
			setDocumentViewMode("cards");
			return;
		}
		if (activeOcrTablaIdOverride && activeFolderLinks.some((link) => link.tablaId === activeOcrTablaIdOverride)) {
			return;
		}
		setActiveOcrTablaIdOverride(activeFolderLinks[0]?.tablaId ?? null);
	}, [activeFolderLinks, activeOcrTablaIdOverride]);

	useEffect(() => {
		let cancelled = false;
		if (!previewPathKey) return;
		const paths = previewPathKey.split("\n").filter(Boolean);
		void fetchBatchAccess(obraId, paths)
			.then((urls) => {
				if (cancelled) return;
				setSignedUrls((current) => ({ ...current, ...urls }));
			})
			.catch((error) => {
				console.error("[documents-new] thumbnail batch failed", error);
			});
		return () => {
			cancelled = true;
		};
	}, [obraId, previewPathKey]);

	function updateFolderPath(nextFolderPath: string) {
		const params = new URLSearchParams(searchParams?.toString?.() || "");
		params.set("tab", "documentos-new");
		params.delete("file");
		const normalizedNextFolderPath = normalizePath(nextFolderPath);
		if (normalizedNextFolderPath) {
			params.set("folder", normalizedNextFolderPath);
		} else {
			params.delete("folder");
		}
		const qs = params.toString();
		router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
		setVisibleLimit(INITIAL_VISIBLE_FILES);
		setSearch("");
		setDocumentViewMode("cards");
		setActiveOcrTablaIdOverride(null);
		setSelectedDocument(null);
		setPreviewUrl(null);
		setIsDocumentSheetOpen(false);
		setIsDocumentDataSheetOpen(false);
	}

	function openFolder(item: FileSystemItem) {
		updateFolderPath(getRelativeFolderPath(item));
	}

	function prefetchFolder(item: FileSystemItem) {
		const path = getRelativeFolderPath(item);
		void queryClient.prefetchQuery({
			queryKey: ["obra", obraId, "documents-new", "folder", path],
			queryFn: () => fetchDocumentsList(obraId, path),
			staleTime: FOLDER_STALE_TIME,
		});
	}

	function goToParent() {
		updateFolderPath(getParentFolder(selectedFolderPath).path);
	}

	const totalBytes = files.reduce((sum, item) => sum + (typeof item.size === "number" ? item.size : 0), 0);
	const folderCountLabel = documentViewMode === "table" && isOcrFolder ? `${tableRows.length} filas` : `${files.length} archivos`;

	const handleDownloadAllFromFolder = useCallback(async () => {
		if (isDownloadingAll) return;
		if (fileDownloadEntries.length === 0) {
			toast.error("No hay archivos para descargar en esta carpeta.");
			return;
		}

		setIsDownloadingAll(true);
		let downloadedCount = 0;

		try {
			const { default: JSZip } = await import("jszip");
			const zip = new JSZip();

			for (const file of fileDownloadEntries) {
				try {
					const blob = await fetchStoredDocumentBlob(obraId, file.storagePath);
					zip.file(file.name, blob);
					downloadedCount += 1;
				} catch (error) {
					console.error("[documents-new] Error downloading file for zip", file.storagePath, error);
				}
			}

			if (downloadedCount === 0) {
				toast.error("No se pudo descargar ningun archivo de la carpeta.");
				return;
			}

			const zipBlob = await zip.generateAsync({
				type: "blob",
				compression: "DEFLATE",
				compressionOptions: { level: 6 },
			});
			triggerBlobDownload(zipBlob, `${normalizeFolderName(selectedFolderLabel) || "documentos"}.zip`);

			if (downloadedCount < fileDownloadEntries.length) {
				toast.warning(`ZIP generado con ${downloadedCount} de ${fileDownloadEntries.length} archivos.`);
				return;
			}

			toast.success(`ZIP generado con ${downloadedCount} archivo${downloadedCount === 1 ? "" : "s"}.`);
		} finally {
			setIsDownloadingAll(false);
		}
	}, [fileDownloadEntries, isDownloadingAll, obraId, selectedFolderLabel]);

	const handleReprocessAll = useCallback(async () => {
		if (reprocessableFiles.length === 0) {
			toast.error("No hay documentos para reprocesar en esta carpeta.");
			return;
		}
		const tablaIds = [...new Set(activeFolderLinks.map((link) => link.tablaId).filter(Boolean))];
		if (tablaIds.length === 0) {
			toast.error("No encontramos tablas de extraccion para esta carpeta.");
			return;
		}

		setIsReprocessingAll(true);
		reprocessAllAbortRef.current = false;
		setReprocessAllProgress({ done: 0, total: reprocessableFiles.length, errors: 0 });

		let errorCount = 0;
		let successCount = 0;

		for (let index = 0; index < reprocessableFiles.length; index += 1) {
			if (reprocessAllAbortRef.current) {
				toast.info("Reproceso masivo cancelado.");
				break;
			}
			const file = reprocessableFiles[index];
			try {
				const formData = new FormData();
				formData.append("existingBucket", "obra-documents");
				formData.append("existingPath", file.storagePath as string);
				formData.append("existingFileName", file.name);
				formData.append("tablaIds", JSON.stringify(tablaIds));

				const response = await fetch(
					`/api/obras/${encodeURIComponent(obraId)}/tablas/import/ocr-multi?skipStorage=1`,
					{ method: "POST", body: formData },
				);
				const payload = await response.json().catch(() => ({} as { error?: string }));

				if (!response.ok) {
					errorCount += 1;
					if (response.status === 413) {
						toast.warning(payload.error ?? `El documento ${file.name} es demasiado grande para OCR.`);
					} else if (response.status === 402) {
						toast.warning(payload.error ?? "Superaste el limite de tokens de IA de tu plan.");
						break;
					} else {
						console.error("[documents-new] Reprocess failed", file.name, payload);
					}
				} else {
					successCount += 1;
				}
			} catch (error) {
				errorCount += 1;
				console.error("[documents-new] Error reprocessing file", file.name, error);
			}
			setReprocessAllProgress({ done: index + 1, total: reprocessableFiles.length, errors: errorCount });
		}

		await folderQuery.refetch();
		if (activeOcrTablaId) {
			await tablaRowsQuery.refetch();
		}

		if (successCount > 0) {
			toast.success(`${successCount} documento${successCount === 1 ? "" : "s"} reprocesado${successCount === 1 ? "" : "s"}.`);
		}
		if (errorCount > 0) {
			toast.error(`${errorCount} documento${errorCount === 1 ? "" : "s"} fallaron al reprocesar.`);
		}

		setIsReprocessingAll(false);
		setReprocessAllProgress(null);
		setIsReprocessAllConfirmOpen(false);
	}, [activeFolderLinks, activeOcrTablaId, folderQuery, obraId, reprocessableFiles, tablaRowsQuery]);

	const handleCancelReprocessAll = useCallback(() => {
		reprocessAllAbortRef.current = true;
	}, []);

	const handleReprocessDocument = useCallback(
		async (document: FileSystemItem | null) => {
			if (!document?.storagePath) {
				toast.error("No encontramos la ruta del documento para reprocesar.");
				return;
			}
			const tablaIds = [...new Set(activeFolderLinks.map((link) => link.tablaId).filter(Boolean))];
			if (tablaIds.length === 0) {
				toast.error("Este documento no esta vinculado a una tabla OCR.");
				return;
			}

			setRetryingDocumentId(document.id);
			try {
				const formData = new FormData();
				formData.append("existingBucket", "obra-documents");
				formData.append("existingPath", document.storagePath);
				formData.append("existingFileName", document.name);
				formData.append("tablaIds", JSON.stringify(tablaIds));

				const response = await fetch(
					`/api/obras/${encodeURIComponent(obraId)}/tablas/import/ocr-multi?skipStorage=1`,
					{ method: "POST", body: formData },
				);
				const payload = (await response.json().catch(() => ({}))) as {
					error?: string;
					perTable?: ReprocessTableResult[];
				};

				if (!response.ok) {
					if (response.status === 413) {
						toast.warning(payload.error ?? `El documento ${document.name} es demasiado grande para OCR.`);
					} else if (response.status === 402) {
						toast.warning(payload.error ?? "Superaste el limite de tokens de IA de tu plan.");
					} else {
						toast.error(payload.error ?? "No se pudo reprocesar el documento.");
					}
					return;
				}

				const perTableResults = Array.isArray(payload.perTable) ? payload.perTable : [];
				if (perTableResults.length > 0) {
					perTableResults.forEach((result) => {
						const inserted = result.inserted ?? 0;
						if (inserted > 0) {
							toast.success(`${result.tablaName ?? "Tabla"}: ${inserted} filas actualizadas.`);
						} else {
							toast.warning(`${result.tablaName ?? "Tabla"}: sin filas detectadas.`);
						}
					});
				} else {
					toast.success("Documento reprocesado.");
				}

				await folderQuery.refetch();
				if (activeOcrTablaId) {
					await tablaRowsQuery.refetch();
				}
			} catch (error) {
				console.error("[documents-new] Error reprocessing document", document.name, error);
				toast.error("No se pudo reprocesar el documento.");
			} finally {
				setRetryingDocumentId(null);
			}
		},
		[activeFolderLinks, activeOcrTablaId, folderQuery, obraId, tablaRowsQuery],
	);

	const handleDownloadDocument = useCallback(
		async (document: FileSystemItem) => {
			if (!document.storagePath) {
				toast.error("No encontramos la ruta del documento.");
				return;
			}
			try {
				const blob = await fetchStoredDocumentBlob(obraId, document.storagePath);
				triggerBlobDownload(blob, document.name);
			} catch (error) {
				console.error("[documents-new] Document download failed", error);
				toast.error(getDocumentDownloadErrorMessage(error));
			}
		},
		[obraId],
	);

	const handleOpenDocumentPreview = useCallback(
		async (document: FileSystemItem) => {
			setSelectedDocument(document);
			setIsDocumentSheetOpen(true);
			setIsDocumentDataSheetOpen(false);
			const requestId = previewRequestIdRef.current + 1;
			previewRequestIdRef.current = requestId;

			if (!document.storagePath || document.apsUrn) {
				setPreviewUrl(null);
				return;
			}

			const cachedSignedUrl = signedUrls[document.storagePath];
			if (cachedSignedUrl) {
				setPreviewUrl(cachedSignedUrl);
				return;
			}

			setPreviewUrl(null);
			try {
				const urls = await fetchBatchAccess(obraId, [document.storagePath]);
				const signedUrl = urls[document.storagePath] ?? null;
				if (previewRequestIdRef.current !== requestId) return;
				if (!signedUrl) {
					toast.error("No se pudo cargar la previsualizacion del documento.");
					return;
				}
				setSignedUrls((current) => ({ ...current, [document.storagePath as string]: signedUrl }));
				setPreviewUrl(signedUrl);
			} catch (error) {
				if (previewRequestIdRef.current !== requestId) return;
				console.error("[documents-new] Document preview failed", error);
				toast.error("No se pudo cargar la previsualizacion del documento.");
			}
		},
		[obraId, signedUrls],
	);

	const handleDocumentSheetOpenChange = useCallback((open: boolean) => {
		setIsDocumentSheetOpen(open);
		if (!open) {
			previewRequestIdRef.current += 1;
			setIsDocumentDataSheetOpen(false);
			setSelectedDocument(null);
			setPreviewUrl(null);
		}
	}, []);

	const toggleDocumentDataSheet = useCallback(() => {
		if (!documentDataTableConfig) return;
		setIsDocumentDataSheetOpen((current) => !current);
	}, [documentDataTableConfig]);

	const selectedDocumentIndex = selectedDocument
		? files.findIndex((file) => file.id === selectedDocument.id)
		: -1;
	const previousDocument =
		selectedDocumentIndex > 0 ? files[selectedDocumentIndex - 1] : null;
	const nextDocument =
		selectedDocumentIndex >= 0 && selectedDocumentIndex < files.length - 1
			? files[selectedDocumentIndex + 1]
			: null;
	const canReprocessSelectedDocument = Boolean(selectedDocument?.storagePath);
	const canShowSelectedDocumentData = Boolean(selectedDocument?.storagePath && documentDataTableConfig);

	const skeletonContent = (
		<div className="space-y-4">
			<div className="flex gap-4 overflow-hidden">
				{Array.from({ length: 5 }).map((_, index) => (
					<div key={index} className="h-[85px] w-[120px] shrink-0 animate-pulse rounded-lg bg-stone-100" />
				))}
			</div>
			<div className="grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-7 xl:grid-cols-10">
				{Array.from({ length: 20 }).map((_, index) => (
					<div key={index} className="h-[145px] w-[120px] animate-pulse bg-stone-100" />
				))}
			</div>
		</div>
	);

	const errorContent = (
		<div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
			{folderQuery.error instanceof Error ? folderQuery.error.message : "No se pudo cargar la carpeta"}
		</div>
	);

	const cardsContent = (
		<div className="space-y-5">
			{folders.length > 0 ? (
				<div className="border-b border-[#d9d9d9] pb-3">
					<div className="flex items-start gap-4 overflow-x-auto px-2 pb-1">
						{folders.map((folder) => (
							<FolderThumbnail
								key={folder.id}
								item={folder}
								onClick={() => openFolder(folder)}
								onPrefetch={() => prefetchFolder(folder)}
							/>
						))}
					</div>
				</div>
			) : null}

			{filteredFiles.length === 0 ? (
				<div className="flex min-h-[320px] flex-col items-center justify-center rounded-md border border-dashed border-stone-200 text-sm text-stone-500">
					<File className="mb-3 size-10 text-stone-300" />
					No hay archivos para mostrar.
				</div>
			) : (
				<>
					<div className="grid grid-cols-3 gap-4 rounded-lg sm:grid-cols-4 lg:grid-cols-7 xl:grid-cols-10">
						{visibleFiles.map((item) => (
							<button
								type="button"
								key={item.id}
								className="group relative flex h-[145px] w-[120px] flex-col items-start gap-2 rounded-none border bg-stone-100 p-3 text-left transition-colors"
								title={item.name}
								onClick={() => void handleOpenDocumentPreview(item)}
							>
								<span className="absolute top-0 right-0 z-10 border-8 border-stone-300 bg-stone-100" />
								<span className="absolute top-[-1px] right-[-1px] z-10 border-8 border-b-transparent border-l-transparent border-white bg-stone-200" />
								<div className="absolute inset-0 top-0 flex items-center justify-center">
									<FilePreview item={item} signedUrl={item.storagePath ? signedUrls[item.storagePath] : undefined} />
								</div>
								<div className="absolute right-2 top-2 z-20">{renderOcrStatusBadge(item)}</div>
								<div className="relative z-20 mt-auto w-full bg-stone-200/60 px-1 py-1 backdrop-blur-sm">
									<p className="truncate text-center text-sm text-stone-700">{item.name}</p>
								</div>
							</button>
						))}
					</div>
					{visibleLimit < filteredFiles.length ? (
						<div className="flex justify-center">
							<Button
								type="button"
								variant="secondary"
								onClick={() => setVisibleLimit((current) => current + INITIAL_VISIBLE_FILES)}
							>
								Mostrar mas ({filteredFiles.length - visibleLimit})
							</Button>
						</div>
					) : null}
				</>
			)}
		</div>
	);

	const tableContent = !hasTablaSchema ? (
		<div className="flex min-h-[420px] flex-col items-center justify-center p-6 text-center text-sm text-stone-500">
			<Table2 className="mb-3 size-10 text-stone-300" />
			<p>Esta carpeta de datos todavia no tiene columnas configuradas.</p>
			<p>Configuralas desde la pestana Tablas para ver los datos aca.</p>
		</div>
	) : tablaRowsQuery.isError ? (
		<div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
			{tablaRowsQuery.error instanceof Error ? tablaRowsQuery.error.message : "No se pudieron cargar los datos extraidos"}
		</div>
	) : ocrTableConfig ? (
		<div data-wizard-target="documents-extracted-data-table" className="px-4 pt-4 max-w-[calc(96vw-var(--sidebar-current-width))]">
			<FormTable key={ocrTableConfig.tableId} config={ocrTableConfig} innerClassName="max-h-[50vh] min-h-[50vh]" />
		</div>
	) : null;

	const activeBody = folderQuery.isLoading
		? skeletonContent
		: folderQuery.isError
			? errorContent
			: documentViewMode === "table" && isOcrFolder
				? tableContent
				: cardsContent;

	const normalHeader = (
		<div className="flex flex-col gap-3 border-b border-stone-100 p-4 xl:flex-row xl:items-center xl:justify-between">
			<div className="min-w-0">
				<div className="flex items-center gap-2">
					{selectedFolderPath ? (
						<Button
							type="button"
							variant="defaultSecondary"
							size="icon-sm"
							aria-label="Volver"
							onClick={goToParent}
						>
							<ChevronLeft className="size-4" />
						</Button>
					) : null}
					<h2 className="truncate text-xl font-semibold text-stone-950">{selectedFolderLabel}</h2>
					{folderQuery.isFetching ? <Loader2 className="size-4 animate-spin text-stone-400" /> : null}
				</div>
				<p className="text-sm text-stone-500">
					{files.length} archivos - {folders.length} carpetas - {formatReadableBytes(totalBytes)}
				</p>
			</div>
			<div className="flex w-full items-center gap-2 xl:w-auto">
				<div className="relative min-w-0 flex-1 xl:w-80">
					<Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
					<Input
						value={search}
						onChange={(event) => setSearch(event.target.value)}
						placeholder="Buscar archivo"
						className="h-9 pl-9"
					/>
				</div>
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					onClick={() => void folderQuery.refetch()}
					disabled={folderQuery.isFetching}
					aria-label="Actualizar"
				>
					<RefreshCw className={cn("size-4", folderQuery.isFetching && "animate-spin")} />
				</Button>
			</div>
		</div>
	);

	const ocrHeader = (
		<div className="mb-0">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div
					className="relative z-10 flex h-full items-center gap-3 overflow-visible rounded-tl-xl border border-b-0 border-[#d9d9d9] bg-white px-4 py-3"
					style={
						{
							"--notch-bg": "white",
							"--notch-stroke": "#d9d9d9",
						} as CSSProperties
					}
				>
					<NotchTail side="right" className="mb-[4px] h-[55px]" />
					{selectedFolderPath ? (
						<Button
							type="button"
							variant="defaultSecondary"
							size="icon-sm"
							aria-label="Volver"
							onClick={goToParent}
						>
							<ChevronLeft className="size-4" />
						</Button>
					) : null}
					<div className="min-w-0">
						<div className="flex min-w-0 flex-wrap items-baseline gap-2">
							<h2 className="truncate text-xl font-semibold text-stone-950">{selectedFolderLabel}</h2>
							<span className="text-sm font-medium text-stone-500">
								{folderQuery.isFetching ? "(cargando...)" : `(${folderCountLabel})`}
							</span>
						</div>
					</div>
					{fileDownloadEntries.length > 0 && documentViewMode === "cards" ? (
						<Button
							type="button"
							variant="secondary"
							size="sm"
							onClick={() => void handleDownloadAllFromFolder()}
							disabled={isDownloadingAll}
							className="ml-1 gap-1.5"
						>
							{isDownloadingAll ? (
								<>
									<Loader2 className="size-3.5 animate-spin" />
									Generando ZIP...
								</>
							) : (
								<>
									<Download className="size-3.5" />
									Descargar todos
								</>
							)}
						</Button>
					) : null}
					{reprocessableFiles.length > 0 && documentViewMode === "cards" ? (
						<Button
							type="button"
							variant="secondary"
							size="sm"
							onClick={() => setIsReprocessAllConfirmOpen(true)}
							disabled={isReprocessingAll}
							className="ml-1 gap-1.5"
						>
							{isReprocessingAll ? (
								<>
									<Loader2 className="size-3.5 animate-spin" />
									Reprocesando{reprocessAllProgress ? ` (${reprocessAllProgress.done}/${reprocessAllProgress.total})` : "..."}
								</>
							) : (
								<>
									<RefreshCw className="size-3.5" />
									Reprocesar todos
								</>
							)}
						</Button>
					) : null}
				</div>

				{showArchivosTablaToggle ? (
					<div
						className="relative z-10 flex h-full flex-wrap items-center gap-2 overflow-visible rounded-tl-none border-l-0 rounded-tr-xl border border-b-0 border-[#d9d9d9] bg-white px-4 pb-0 pl-1 pt-3"
						style={
							{
								"--notch-bg": "white",
								"--notch-stroke": "#d9d9d9",
							} as CSSProperties
						}
					>
						<NotchTail side="left" className="mb-[4px] h-[48px] " />
						<div className="inline-flex items-center rounded-md border border-[#d9d9d9] bg-stone-50 p-0.5">
							<Button
								type="button"
								data-wizard-target="documents-view-mode-cards"
								variant={documentViewMode === "cards" ? "default" : "ghost"}
								size="sm"
								className="h-8 gap-1.5 px-3"
								aria-pressed={documentViewMode === "cards"}
								onClick={() => setDocumentViewMode("cards")}
							>
								<File className="size-3.5" />
								Archivos
							</Button>
							<Button
								type="button"
								data-wizard-target="documents-view-mode-table"
								variant={documentViewMode === "table" ? "default" : "ghost"}
								size="sm"
								className="h-8 gap-1.5 px-3"
								aria-pressed={documentViewMode === "table"}
								onClick={() => setDocumentViewMode("table")}
							>
								<Table2 className="size-3.5" />
								Tabla
							</Button>
						</div>
					</div>
				) : null}
			</div>
		</div>
	);

	return (
		<TabsContent value="documentos-new" className="space-y-4">
			<section className={cn("min-h-[640px] overflow-hidden ", !isOcrFolder && "rounded-lg border border-[#d9d9d9] shadow-sm")}>
				<div className="-mb-1">
					{isOcrFolder ? ocrHeader : normalHeader}
				</div>
				<div
					className={cn(
						"min-h-[560px] bg-white",
						isOcrFolder
							? "rounded-b-lg border border-[#d9d9d9] p-4 pt-4"
							: "p-4",
					)}
				>
					{activeBody}
				</div>
			</section>

			<DocumentDataSheet
				isOpen={isDocumentDataSheetOpen && Boolean(selectedDocument) && Boolean(documentDataTableConfig)}
				onOpenChange={setIsDocumentDataSheetOpen}
				document={selectedDocument}
				tableConfig={documentDataTableConfig}
			/>

			<DocumentSheet
				isOpen={isDocumentSheetOpen && Boolean(selectedDocument)}
				onOpenChange={handleDocumentSheetOpenChange}
				document={selectedDocument}
				previewUrl={previewUrl}
				onDownload={(document) => void handleDownloadDocument(document)}
				onRetryOcr={canReprocessSelectedDocument ? handleReprocessDocument : undefined}
				retryingOcr={Boolean(selectedDocument && retryingDocumentId === selectedDocument.id)}
				highlightRetryAction={Boolean(
					selectedDocument &&
					(selectedDocument.ocrDocumentStatus === "failed" ||
						selectedDocument.ocrDocumentStatus === "unprocessed" ||
						(selectedDocument.ocrDocumentStatus === "completed" &&
							typeof selectedDocument.ocrRowsExtracted === "number" &&
							selectedDocument.ocrRowsExtracted <= 0)),
				)}
				onToggleDataSheet={toggleDocumentDataSheet}
				showDataToggle={canShowSelectedDocumentData}
				isDataSheetOpen={isDocumentDataSheetOpen}
				onPreviousDocument={previousDocument ? () => void handleOpenDocumentPreview(previousDocument) : null}
				onNextDocument={nextDocument ? () => void handleOpenDocumentPreview(nextDocument) : null}
			/>

			<Dialog open={isReprocessAllConfirmOpen} onOpenChange={(open) => { if (!isReprocessingAll) setIsReprocessAllConfirmOpen(open); }}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Reprocesar todos los documentos</DialogTitle>
						<DialogDescription>
							{isReprocessingAll
								? "Reprocesando documentos..."
								: `Se van a reprocesar ${reprocessableFiles.length} documento${reprocessableFiles.length === 1 ? "" : "s"} en la carpeta "${selectedFolderLabel}". Los datos extraidos existentes se reemplazaran con los nuevos resultados.`}
						</DialogDescription>
					</DialogHeader>
					{isReprocessingAll && reprocessAllProgress ? (
						<div className="space-y-3 px-4 pb-2">
							<div className="flex items-center justify-between text-sm text-stone-600">
								<span>{reprocessAllProgress.done} de {reprocessAllProgress.total} procesados</span>
								{reprocessAllProgress.errors > 0 ? (
									<span className="text-red-600">{reprocessAllProgress.errors} error{reprocessAllProgress.errors === 1 ? "" : "es"}</span>
								) : null}
							</div>
							<div className="h-2 w-full overflow-hidden rounded-full bg-stone-100">
								<div
									className="h-full rounded-full bg-amber-500 transition-all duration-300 ease-out"
									style={{ width: `${Math.round((reprocessAllProgress.done / reprocessAllProgress.total) * 100)}%` }}
								/>
							</div>
						</div>
					) : null}
					<DialogFooter>
						{isReprocessingAll ? (
							<Button variant="destructive" onClick={handleCancelReprocessAll}>
								Cancelar
							</Button>
						) : (
							<>
								<Button variant="secondary" onClick={() => setIsReprocessAllConfirmOpen(false)}>
									Cancelar
								</Button>
								<Button onClick={() => void handleReprocessAll()} className="gap-1.5">
									<RefreshCw className="size-4" />
									Reprocesar {reprocessableFiles.length} documento{reprocessableFiles.length === 1 ? "" : "s"}
								</Button>
							</>
						)}
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</TabsContent>
	);
}
