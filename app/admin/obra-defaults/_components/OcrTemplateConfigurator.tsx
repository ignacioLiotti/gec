"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import NextImage from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
	Upload,
	Save,
	Loader2,
	FileText,
	Table2,
	Type,
	Plus,
	X,
	ZoomIn,
	ZoomOut,
	RotateCcw,
	Move,
	Pencil,
	ChevronLeft,
	ChevronRight,
	CheckCircle2,
	Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

// Types
type RegionType = "single" | "table";

interface Region {
	id: string;
	x: number;
	y: number;
	width: number;
	height: number;
	label: string;
	description?: string;
	color: string;
	type: RegionType;
	pageNumber?: number;
	tableColumns?: string[];
}

interface OcrTemplate {
	id: string;
	name: string;
	description: string | null;
	template_file_name: string | null;
	regions: Region[];
	columns: Array<{
		fieldKey: string;
		label: string;
		dataType: string;
		ocrScope?: string;
		description?: string;
	}>;
	is_active: boolean;
}

type PdfViewport = {
	width: number;
	height: number;
};

type PdfPageProxy = {
	getViewport: (options: { scale: number }) => PdfViewport;
	render: (options: {
		canvasContext: CanvasRenderingContext2D;
		viewport: PdfViewport;
	}) => { promise: Promise<void> };
};

type PdfDocumentProxy = {
	numPages: number;
	getPage: (pageNumber: number) => Promise<PdfPageProxy>;
	destroy?: () => void;
};

type PdfJsModule = {
	GlobalWorkerOptions?: { workerSrc: string };
	getDocument: (options: {
		data: Uint8Array;
		disableWorker: boolean;
	}) => { promise: Promise<PdfDocumentProxy> };
};

// Constants
const REGION_COLORS = [
	"#f97316", "#8b5cf6", "#06b6d4", "#10b981",
	"#f43f5e", "#eab308", "#3b82f6", "#ec4899",
];

const DEFAULT_TABLE_COLUMNS = ["Cantidad", "Unidad", "Descripción", "Precio"];

function generateId(): string {
	return Math.random().toString(36).substring(2, 9);
}

interface Props {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onTemplateCreated?: (template: OcrTemplate) => void;
	onTemplateSaved?: (template: OcrTemplate) => void;
	existingTemplate?: OcrTemplate | null;
}

export function OcrTemplateConfigurator({
	open,
	onOpenChange,
	onTemplateCreated,
	onTemplateSaved,
	existingTemplate,
}: Props) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const pdfBytesRef = useRef<Uint8Array | null>(null);
	const pdfRenderTokenRef = useRef(0);

	// State
	const [templateName, setTemplateName] = useState("");
	const [templateDescription, setTemplateDescription] = useState("");
	const [image, setImage] = useState<HTMLImageElement | null>(null);
	const [imageSrc, setImageSrc] = useState<string | null>(null);
	const [fileName, setFileName] = useState<string | null>(null);
	const [documentKind, setDocumentKind] = useState<"image" | "pdf" | null>(null);
	const [pageCount, setPageCount] = useState(1);
	const [selectedPageNumber, setSelectedPageNumber] = useState(1);
	const [isRenderingPdf, setIsRenderingPdf] = useState(false);
	const [regions, setRegions] = useState<Region[]>([]);
	const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
	const [isDrawing, setIsDrawing] = useState(false);
	const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
	const [isSaving, setIsSaving] = useState(false);
	const [saveError, setSaveError] = useState<string | null>(null);
	const [scale, setScale] = useState(1);
	const [isDrawModeEnabled, setIsDrawModeEnabled] = useState(true);
	const [currentStep, setCurrentStep] = useState(0);

	// Reset when dialog opens/closes
	useEffect(() => {
		if (open) {
			if (existingTemplate) {
				setTemplateName(existingTemplate.name);
				setTemplateDescription(existingTemplate.description ?? "");
				setRegions(existingTemplate.regions);
				setImage(null);
				setImageSrc(null);
				setFileName(existingTemplate.template_file_name ?? null);
				setDocumentKind(null);
				setPageCount(1);
				setSelectedPageNumber(1);
				pdfBytesRef.current = null;
				setSelectedRegionId(existingTemplate.regions[0]?.id ?? null);
				setScale(1);
			} else {
				setTemplateName("");
				setTemplateDescription("");
				setImage(null);
				setImageSrc(null);
				setFileName(null);
				setDocumentKind(null);
				setPageCount(1);
				setSelectedPageNumber(1);
				pdfBytesRef.current = null;
				setRegions([]);
				setSelectedRegionId(null);
				setScale(1);
			}
			setCurrentStep(0);
		}
	}, [open, existingTemplate]);

	const loadPreviewFromDataUrl = useCallback((src: string) => {
		return new Promise<HTMLImageElement>((resolve, reject) => {
			const img = new window.Image();
			img.onload = () => resolve(img);
			img.onerror = () => reject(new Error("No se pudo renderizar la previsualizaciÃ³n"));
			img.src = src;
		});
	}, []);

	const renderPdfPage = useCallback(
		async (pdfBytes: Uint8Array, pageNumber: number, currentFileName: string) => {
			setIsRenderingPdf(true);
			const renderToken = ++pdfRenderTokenRef.current;
			try {
				// @ts-expect-error pdfjs-dist legacy client build is imported dynamically without local typings
				const pdfjsModule = await import("pdfjs-dist/legacy/build/pdf");
				const pdfjs = pdfjsModule as unknown as PdfJsModule;
				if (pdfjs?.GlobalWorkerOptions) {
					pdfjs.GlobalWorkerOptions.workerSrc = new URL(
						"pdfjs-dist/build/pdf.worker.min.mjs",
						import.meta.url
					).toString();
				}
				const loadingTask = pdfjs.getDocument({ data: pdfBytes.slice(), disableWorker: true });
				const pdf = await loadingTask.promise;
				const safePage = Math.max(1, Math.min(pageNumber, pdf.numPages));
				const page = await pdf.getPage(safePage);
				const viewport = page.getViewport({ scale: 1.4 });
				const canvas = document.createElement("canvas");
				const ctx = canvas.getContext("2d");
				if (!ctx) {
					throw new Error("No se pudo preparar el canvas para el PDF");
				}
				canvas.width = Math.max(1, Math.floor(viewport.width));
				canvas.height = Math.max(1, Math.floor(viewport.height));
				await page.render({ canvasContext: ctx as never, viewport }).promise;
				const dataUrl = canvas.toDataURL("image/png");
				const img = await loadPreviewFromDataUrl(dataUrl);
				if (renderToken !== pdfRenderTokenRef.current) {
					if (typeof pdf.destroy === "function") {
						pdf.destroy();
					}
					return;
				}
				setImage(img);
				setImageSrc(dataUrl);
				setFileName(currentFileName);
				setDocumentKind("pdf");
				setPageCount(pdf.numPages);
				if (typeof pdf.destroy === "function") {
					pdf.destroy();
				}
			} finally {
				if (renderToken === pdfRenderTokenRef.current) {
					setIsRenderingPdf(false);
				}
			}
		},
		[loadPreviewFromDataUrl]
	);

	// Handle file upload
	const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		const isImage = file.type.startsWith("image/");
		const isPdf =
			file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

		if (!isImage && !isPdf) {
			toast.error("Solo se permiten imÃ¡genes o PDFs");
			return;
		}

		setSaveError(null);
		setFileName(file.name);
		setRegions([]);
		setSelectedRegionId(null);
		setScale(1);
		setSelectedPageNumber(1);

		if (!isImage && !isPdf) {
			toast.error("Solo se permiten imágenes o PDFs");
			return;
		}

		if (isPdf) {
			try {
				const arrayBuffer = await file.arrayBuffer();
				pdfBytesRef.current = new Uint8Array(arrayBuffer);
				await renderPdfPage(pdfBytesRef.current, 1, file.name);
			} catch (error) {
				console.error(error);
				pdfBytesRef.current = null;
				setImage(null);
				setImageSrc(null);
				setDocumentKind(null);
				setPageCount(1);
				toast.error("No se pudo abrir el PDF seleccionado");
			}
			return;
		}

		if (false && isPdf) {
			// Legacy fallback kept inert after PDF support landed.
			toast.error("Por ahora solo se permiten imágenes. Soporte PDF próximamente.");
			return;
		}

		setFileName(file.name);

		pdfBytesRef.current = null;
		setDocumentKind("image");
		setPageCount(1);

		const reader = new FileReader();
		reader.onload = async (event) => {
			const src = typeof event.target?.result === "string" ? event.target.result : null;
			if (!src) {
				toast.error("No se pudo leer la imagen seleccionada");
				return;
			}
			try {
				const img = await loadPreviewFromDataUrl(src);
				setImage(img);
				setImageSrc(src);
			} catch (error) {
				console.error(error);
				toast.error("No se pudo renderizar la imagen seleccionada");
			}
		};
		reader.readAsDataURL(file);
	}, [loadPreviewFromDataUrl, renderPdfPage]);

	const currentPageRegions = useMemo(
		() =>
			regions.filter(
				(region) => (region.pageNumber ?? 1) === selectedPageNumber
			),
		[regions, selectedPageNumber]
	);

	useEffect(() => {
		if (!selectedRegionId) return;
		const stillVisible = currentPageRegions.some((region) => region.id === selectedRegionId);
		if (!stillVisible) {
			setSelectedRegionId(null);
		}
	}, [currentPageRegions, selectedRegionId]);

	useEffect(() => {
		if (documentKind !== "pdf" || !pdfBytesRef.current) return;
		void renderPdfPage(pdfBytesRef.current, selectedPageNumber, fileName || "documento.pdf");
	}, [documentKind, fileName, renderPdfPage, selectedPageNumber]);

	// Get scaled coordinates from mouse event
	const getScaledCoords = useCallback(
		(e: React.MouseEvent<HTMLCanvasElement>) => {
			const canvas = canvasRef.current;
			if (!canvas) return { x: 0, y: 0 };

			const rect = canvas.getBoundingClientRect();
			const scaleX = canvas.width / rect.width;
			const scaleY = canvas.height / rect.height;

			return {
				x: (e.clientX - rect.left) * scaleX,
				y: (e.clientY - rect.top) * scaleY,
			};
		},
		[]
	);

	// Redraw canvas
	const redraw = useCallback(
		(tempRect?: { x: number; y: number; width: number; height: number }) => {
			const canvas = canvasRef.current;
			const ctx = canvas?.getContext("2d");
			if (!canvas || !ctx || !image) return;

			ctx.clearRect(0, 0, canvas.width, canvas.height);

			// Draw existing regions for the visible page
			for (const region of currentPageRegions) {
				const isSelected = region.id === selectedRegionId;
				const isTable = region.type === "table";

				// Fill for selected
				if (isSelected) {
					ctx.fillStyle = region.color + "20";
					ctx.fillRect(region.x, region.y, region.width, region.height);
				}

				// Border
				ctx.strokeStyle = region.color;
				ctx.lineWidth = isSelected ? 4 : 3;
				if (isTable) ctx.setLineDash([8, 4]);
				ctx.strokeRect(region.x, region.y, region.width, region.height);
				ctx.setLineDash([]);

				// Label
				const labelText = isTable ? `📊 ${region.label}` : region.label;
				const labelWidth = Math.min(180, region.width);
				ctx.fillStyle = region.color;
				ctx.fillRect(region.x, region.y - 26, labelWidth, 24);
				ctx.fillStyle = "white";
				ctx.font = "bold 11px system-ui, sans-serif";
				ctx.fillText(labelText.slice(0, 22), region.x + 5, region.y - 9);
			}

			// Draw temporary rectangle
			if (tempRect) {
				ctx.strokeStyle = REGION_COLORS[currentPageRegions.length % REGION_COLORS.length];
				ctx.lineWidth = 3;
				ctx.setLineDash([6, 3]);
				ctx.strokeRect(tempRect.x, tempRect.y, tempRect.width, tempRect.height);
				ctx.setLineDash([]);
			}
		},
		[image, currentPageRegions, selectedRegionId]
	);

	// Redraw when dependencies change
	useEffect(() => {
		redraw();
	}, [redraw]);
	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas || !image) return;
		canvas.width = image.width;
		canvas.height = image.height;
		canvas.style.width = `${image.width}px`;
		canvas.style.height = `${image.height}px`;
		redraw();
	}, [image, redraw]);

	// Mouse handlers
	const handleMouseDown = useCallback(
		(e: React.MouseEvent<HTMLCanvasElement>) => {
			if (!image || !isDrawModeEnabled) return;

			const coords = getScaledCoords(e);

			// Check if clicking on existing region
			for (let i = currentPageRegions.length - 1; i >= 0; i--) {
				const r = currentPageRegions[i];
				if (
					coords.x >= r.x &&
					coords.x <= r.x + r.width &&
					coords.y >= r.y &&
					coords.y <= r.y + r.height
				) {
					setSelectedRegionId(r.id);
					return;
				}
			}

			// Start drawing new region
			setSelectedRegionId(null);
			setIsDrawing(true);
			setDrawStart(coords);
		},
		[image, isDrawModeEnabled, getScaledCoords, currentPageRegions]
	);

	const handleMouseMove = useCallback(
		(e: React.MouseEvent<HTMLCanvasElement>) => {
			if (!isDrawing || !drawStart) return;

			const coords = getScaledCoords(e);
			const tempRect = {
				x: Math.min(drawStart.x, coords.x),
				y: Math.min(drawStart.y, coords.y),
				width: Math.abs(coords.x - drawStart.x),
				height: Math.abs(coords.y - drawStart.y),
			};
			redraw(tempRect);
		},
		[isDrawing, drawStart, getScaledCoords, redraw]
	);

	const handleMouseUp = useCallback(
		(e: React.MouseEvent<HTMLCanvasElement>) => {
			if (!isDrawing || !drawStart) return;

			const coords = getScaledCoords(e);
			const width = Math.abs(coords.x - drawStart.x);
			const height = Math.abs(coords.y - drawStart.y);

			if (width > 20 && height > 20) {
				const newRegion: Region = {
					id: generateId(),
					x: Math.min(drawStart.x, coords.x),
					y: Math.min(drawStart.y, coords.y),
					width,
					height,
					label: `Campo ${currentPageRegions.length + 1}`,
					color: REGION_COLORS[currentPageRegions.length % REGION_COLORS.length],
					type: "single",
					pageNumber: selectedPageNumber,
				};
				setRegions((prev) => [...prev, newRegion]);
				setSelectedRegionId(newRegion.id);
			}

			setIsDrawing(false);
			setDrawStart(null);
			redraw();
		},
		[
			isDrawing,
			drawStart,
			getScaledCoords,
			currentPageRegions.length,
			redraw,
			selectedPageNumber,
		]
	);

	// Region actions
	const handleRegionLabelChange = useCallback((id: string, label: string) => {
		setRegions((prev) => prev.map((r) => (r.id === id ? { ...r, label } : r)));
	}, []);

	const handleRegionDescriptionChange = useCallback(
		(id: string, description: string) => {
			setRegions((prev) =>
				prev.map((r) => (r.id === id ? { ...r, description } : r)),
			);
		},
		[],
	);

	const handleRegionTypeChange = useCallback((id: string, type: RegionType) => {
		setRegions((prev) =>
			prev.map((r) => {
				if (r.id !== id) return r;
				return {
					...r,
					type,
					tableColumns: type === "table" && !r.tableColumns?.length
						? DEFAULT_TABLE_COLUMNS
						: r.tableColumns,
				};
			})
		);
	}, []);

	const handleAddColumn = useCallback((id: string, column: string) => {
		setRegions((prev) =>
			prev.map((r) => {
				if (r.id !== id) return r;
				return {
					...r,
					tableColumns: [...(r.tableColumns || []), column],
				};
			})
		);
	}, []);

	const handleRemoveColumn = useCallback((id: string, index: number) => {
		setRegions((prev) =>
			prev.map((r) => {
				if (r.id !== id) return r;
				const newColumns = [...(r.tableColumns || [])];
				newColumns.splice(index, 1);
				return { ...r, tableColumns: newColumns };
			})
		);
	}, []);

	const handleDeleteRegion = useCallback((id: string) => {
		setRegions((prev) => prev.filter((r) => r.id !== id));
		if (selectedRegionId === id) {
			setSelectedRegionId(null);
		}
	}, [selectedRegionId]);

	// Save template
	const handleSave = useCallback(async () => {
		if (!templateName.trim()) {
			toast.error("Ingresá un nombre para la plantilla");
			return;
		}

		if (regions.length === 0) {
			toast.error("Dibujá al menos una región");
			return;
		}

		setIsSaving(true);
		setSaveError(null);

		try {
			const res = await fetch("/api/ocr-templates", {
				method: existingTemplate ? "PUT" : "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					id: existingTemplate?.id,
					name: templateName.trim(),
					description: templateDescription.trim() || null,
					regions,
					templateWidth: image?.width,
					templateHeight: image?.height,
					templateSourceType: documentKind,
					templatePageCount: pageCount,
					templatePageNumber: selectedPageNumber,
					templateFileName: fileName,
				}),
			});

			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				if (res.status === 409 && data?.code === "template_name_exists") {
					setSaveError("Ya existe una plantilla con ese nombre");
					return;
				}
				throw new Error(data.error || "Error guardando plantilla");
			}

			const { template } = await res.json();
			toast.success(existingTemplate ? "Plantilla actualizada" : "Plantilla guardada");
			onTemplateCreated?.(template);
			onTemplateSaved?.(template);
			onOpenChange(false);
		} catch (error) {
			console.error(error);
			const message =
				error instanceof Error ? error.message : "Error guardando plantilla";
			setSaveError(message);
			toast.error(message);
		} finally {
			setIsSaving(false);
		}
	}, [
		templateName,
		templateDescription,
		regions,
		image,
		documentKind,
		pageCount,
		selectedPageNumber,
		fileName,
		onTemplateCreated,
		existingTemplate,
		onTemplateSaved,
		onOpenChange,
	]);

	const singleRegions = useMemo(
		() => regions.filter((region) => region.type === "single"),
		[regions]
	);
	const tableRegions = useMemo(
		() => regions.filter((region) => region.type === "table"),
		[regions]
	);
	const derivedColumns = useMemo(
		() =>
			regions.flatMap((region) =>
				region.type === "single"
					? [{ label: region.label || "Campo sin nombre", type: "Campo" }]
					: (region.tableColumns ?? []).map((column) => ({
						label: `${region.label || "Tabla"} > ${column}`,
						type: "Tabla",
					}))
			),
		[regions]
	);
	const steps = ["Contexto", "Documento ejemplo", "Regiones y significado", "Publicación"];
	const canGoNext =
		(currentStep === 0 && templateName.trim().length > 0) ||
		(currentStep === 1 && Boolean(image) && !isRenderingPdf) ||
		(currentStep === 2 && regions.length > 0);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col px-4">
				<DialogHeader className="px-0">
					<DialogTitle className="flex items-center gap-2">
						<FileText className="h-5 w-5 text-purple-500" />
						Configurar Plantilla de Extracción
					</DialogTitle>
					<DialogDescription>
						Subí un documento de ejemplo y marcá las regiones a extraer
					</DialogDescription>
				</DialogHeader>

				<div className="grid gap-2 sm:grid-cols-4 my-4">
					{steps.map((step, index) => {
						const isActive = currentStep === index;
						const isDone = currentStep > index;
						const isStepSelectable = Boolean(existingTemplate);
						return (
							<button
								key={step}
								type="button"
								onClick={() => {
									if (isStepSelectable) {
										setCurrentStep(index);
									}
								}}
								disabled={!isStepSelectable}
								className={`rounded-xl border px-3 py-2 ${isActive
									? "border-purple-500 bg-purple-50 dark:bg-purple-950/20"
									: isDone
										? "border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20"
										: "bg-muted/30"
									} ${isStepSelectable ? "text-left transition-colors hover:border-purple-300" : "text-left"}`}
							>
								<p className="text-[10px] uppercase tracking-wide text-muted-foreground">
									Paso {index + 1}
								</p>
								<p className="text-sm font-medium">{step}</p>
							</button>
						);
					})}
				</div>

				{saveError && (
					<div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
						{saveError}
					</div>
				)}

				{currentStep === 0 && (
					<div className="grid gap-4 lg:grid-cols-[1.1fr,0.9fr] my-4">
						<div className="space-y-4">
							<div className="space-y-2">
								<Label>Nombre de la plantilla</Label>
								<Input
									value={templateName}
									onChange={(e) => setTemplateName(e.target.value)}
									placeholder="Ej. Certificado mensual"
								/>
							</div>
							<div className="space-y-2">
								<Label>Qué documentos representa</Label>
								<Textarea
									value={templateDescription}
									onChange={(e) => setTemplateDescription(e.target.value)}
									placeholder="Indicá variantes, señales visuales y diferencias importantes del documento."
									className="min-h-[160px] max-h-[160px] overflow-y-auto"
								/>
							</div>
						</div>
						<div className="space-y-4">
							<div className="rounded-xl border bg-muted/20 p-4">
								<p className="text-sm font-medium">Objetivo</p>
								<p className="mt-2 text-sm text-muted-foreground">
									Una buena plantilla enseña al sistema cómo luce el documento y qué estructura de datos puede producir.
								</p>
							</div>
							<div className="rounded-xl border bg-muted/20 p-4">
								<p className="text-sm font-medium">Checklist</p>
								<div className="mt-3 space-y-2 text-sm">
									<div className="flex items-center gap-2">
										<CheckCircle2 className="h-4 w-4 text-emerald-500" />
										<span>Usar un documento representativo</span>
									</div>
									<div className="flex items-center gap-2">
										<CheckCircle2 className="h-4 w-4 text-emerald-500" />
										<span>Nombrar cada región por su significado</span>
									</div>
									<div className="flex items-center gap-2">
										<CheckCircle2 className="h-4 w-4 text-emerald-500" />
										<span>Separar campos únicos y tablas</span>
									</div>
								</div>
							</div>
						</div>
					</div>
				)}

				{(currentStep === 1 || currentStep === 2) && (
					<div className="grid lg:grid-cols-[1fr_340px] gap-4 overflow-hidden my-4 min-h-[560px]">
						<div className="flex flex-col gap-3 min-h-[560px]">
							<div className="flex items-center gap-2 flex-wrap">
								<Button asChild variant="outline" size="sm" className="relative">
									<label>
										<Upload className="h-4 w-4 mr-2" />
										{image ? "Cambiar ejemplo" : existingTemplate ? "Subir nuevo ejemplo" : "Subir documento ejemplo"}
										<input
											type="file"
											accept="image/*,.pdf,application/pdf"
											onChange={handleFileUpload}
											className="absolute inset-0 opacity-0 cursor-pointer"
										/>
									</label>
								</Button>

								{image && (
									<>
										<div className="h-6 w-px bg-border" />
										<Button
											variant={isDrawModeEnabled ? "default" : "outline"}
											size="sm"
											onClick={() => setIsDrawModeEnabled((prev) => !prev)}
											className={isDrawModeEnabled ? "bg-purple-600 hover:bg-purple-700" : ""}
										>
											{isDrawModeEnabled ? (
												<>
													<Pencil className="h-4 w-4 mr-1" />
													Dibujar
												</>
											) : (
												<>
													<Move className="h-4 w-4 mr-1" />
													Navegar
												</>
											)}
										</Button>
										<div className="h-6 w-px bg-border" />
										<Button variant="outline" size="icon" onClick={() => setScale((s) => Math.max(0.25, s - 0.25))}>
											<ZoomOut className="h-4 w-4" />
										</Button>
										<span className="text-xs font-mono w-12 text-center">
											{Math.round(scale * 100)}%
										</span>
										<Button variant="outline" size="icon" onClick={() => setScale((s) => Math.min(3, s + 0.25))}>
											<ZoomIn className="h-4 w-4" />
										</Button>
										<Button variant="outline" size="icon" onClick={() => setScale(1)}>
											<RotateCcw className="h-4 w-4" />
										</Button>
										{documentKind === "pdf" && pageCount > 1 && (
											<>
												<div className="h-6 w-px bg-border" />
												<Button
													variant="outline"
													size="icon"
													onClick={() => setSelectedPageNumber((page) => Math.max(1, page - 1))}
													disabled={selectedPageNumber <= 1 || isRenderingPdf}
												>
													<ChevronLeft className="h-4 w-4" />
												</Button>
												<span className="text-xs font-medium min-w-[88px] text-center">
													Pág. {selectedPageNumber} / {pageCount}
												</span>
												<Button
													variant="outline"
													size="icon"
													onClick={() => setSelectedPageNumber((page) => Math.min(pageCount, page + 1))}
													disabled={selectedPageNumber >= pageCount || isRenderingPdf}
												>
													<ChevronRight className="h-4 w-4" />
												</Button>
											</>
										)}
									</>
								)}
							</div>

							<div
								ref={containerRef}
								className="flex-1 min-h-[460px] bg-muted/30 rounded-lg border-2 border-dashed border-muted-foreground/20 overflow-auto"
							>
								{isRenderingPdf && (
									<div className="sticky top-0 z-10 flex items-center justify-end p-3">
										<div className="rounded-full border bg-background/90 px-3 py-1 text-xs text-muted-foreground shadow-sm">
											Renderizando PDF...
										</div>
									</div>
								)}
								{image ? (
									<div
										className="p-4"
										style={{
											transform: `scale(${scale})`,
											transformOrigin: "top left",
										}}
									>
										<div
											className="relative inline-block"
											style={{
												width: image.width,
												height: image.height,
											}}
										>
											{imageSrc && (
												<NextImage
													src={imageSrc}
													alt={fileName || "Documento ejemplo"}
													unoptimized
													width={image.width}
													height={image.height}
													className="absolute inset-0 block max-w-none select-none"
													style={{
														pointerEvents: "none",
													}}
													draggable={false}
												/>
											)}
											<canvas
												ref={canvasRef}
												onMouseDown={handleMouseDown}
												onMouseMove={handleMouseMove}
												onMouseUp={handleMouseUp}
												onMouseLeave={handleMouseUp}
												className="absolute inset-0"
												style={{
													cursor: isDrawModeEnabled ? "crosshair" : "grab",
													maxWidth: "100%",
												}}
											/>
										</div>
									</div>
								) : (
									<div className="flex flex-col items-center justify-center h-full min-h-[300px] text-muted-foreground">
										<Upload className="h-16 w-16 mb-4 opacity-30" />
										<p className="font-medium">Subí un documento de ejemplo</p>
										<p className="text-sm opacity-70">PNG, JPG, WebP o PDF</p>
									</div>
								)}
							</div>
						</div>

						<div className="flex flex-col gap-3 min-h-0 overflow-hidden">
							{currentStep === 1 ? (
								<div className="space-y-4 overflow-auto pr-1">
									<div className="rounded-xl border bg-muted/20 p-4">
										<p className="text-sm font-medium">Cómo dibujar mejor</p>
										<div className="mt-3 space-y-2 text-sm text-muted-foreground">
											<p>Marcá una región por concepto.</p>
											<p>Usá <strong>campo</strong> para valores únicos y <strong>tabla</strong> para bloques repetitivos.</p>
											<p>Ignorá firmas, logos y ruido visual si no aportan al dato.</p>
										</div>
									</div>
									<div className="rounded-xl border bg-muted/20 p-4">
										<p className="text-sm font-medium">Vista rápida</p>
										<div className="mt-3 flex flex-wrap gap-2">
											{documentKind === "pdf" && (
												<Badge variant="secondary">{pageCount} pÃ¡ginas detectadas</Badge>
											)}
											<Badge variant="secondary">{singleRegions.length} campos únicos</Badge>
											<Badge variant="secondary">{tableRegions.length} regiones tabla</Badge>
										</div>
									</div>
								</div>
							) : (
								<>
									<div className="space-y-2">
										<Label className="mb-0 block">Regiones ({currentPageRegions.length})</Label>
										<p className="text-xs text-muted-foreground">
											Editá nombre, significado y tipo para cada región.
										</p>
									</div>
									<div className="flex-1 min-h-0">
										<ScrollArea className="h-full pr-3">
											<AnimatePresence mode="popLayout">
												{currentPageRegions.length === 0 ? (
													<motion.p
														initial={{ opacity: 0 }}
														animate={{ opacity: 1 }}
														className="text-sm text-muted-foreground py-8 text-center"
													>
														Dibujá regiones sobre el documento
													</motion.p>
												) : (
													<div className="space-y-2">
														{currentPageRegions.map((region) => (
															<RegionItem
																key={region.id}
																region={region}
																isSelected={region.id === selectedRegionId}
																onSelect={() => setSelectedRegionId(region.id)}
																onLabelChange={(label) => handleRegionLabelChange(region.id, label)}
																onDescriptionChange={(description) =>
																	handleRegionDescriptionChange(region.id, description)
																}
																onTypeChange={(type) => handleRegionTypeChange(region.id, type)}
																onAddColumn={(col) => handleAddColumn(region.id, col)}
																onRemoveColumn={(idx) => handleRemoveColumn(region.id, idx)}
																onDelete={() => handleDeleteRegion(region.id)}
															/>
														))}
													</div>
												)}
											</AnimatePresence>
										</ScrollArea>
									</div>
								</>
							)}
						</div>
					</div>
				)}

				{currentStep === 3 && (
					<div className="grid gap-4 lg:grid-cols-[1fr_340px] my-4 h-[560px] overflow-auto">
						<div className="space-y-4">
							<div className="rounded-xl border bg-muted/20 p-4">
								<p className="text-sm font-medium">Resumen de publicación</p>
								<div className="mt-4 grid gap-3 md:grid-cols-2">
									<div className="rounded-lg border bg-background p-3">
										<p className="text-xs text-muted-foreground">Plantilla</p>
										<p className="text-sm font-medium">{templateName || "Sin nombre"}</p>
									</div>
									<div className="rounded-lg border bg-background p-3">
										<p className="text-xs text-muted-foreground">Documento ejemplo</p>
										<p className="text-sm font-medium">{fileName || "No cargado"}</p>
									</div>
									<div className="rounded-lg border bg-background p-3">
										<p className="text-xs text-muted-foreground">Tipo de fuente</p>
										<p className="text-sm font-medium">
											{documentKind === "pdf" ? "PDF" : documentKind === "image" ? "Imagen" : "Sin definir"}
										</p>
									</div>
									<div className="rounded-lg border bg-background p-3">
										<p className="text-xs text-muted-foreground">Cobertura de páginas</p>
										<p className="text-sm font-medium">
											{documentKind === "pdf" ? `${pageCount} página(s)` : "1 página"}
										</p>
									</div>
									<div className="rounded-lg border bg-background p-3">
										<p className="text-xs text-muted-foreground">Campos únicos</p>
										<p className="text-sm font-medium">{singleRegions.length}</p>
									</div>
									<div className="rounded-lg border bg-background p-3">
										<p className="text-xs text-muted-foreground">Tablas</p>
										<p className="text-sm font-medium">{tableRegions.length}</p>
									</div>
								</div>
							</div>
							<div className="rounded-xl border bg-muted/20 p-4">
								<p className="text-sm font-medium">Descripción operativa</p>
								<p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">
									{templateDescription || "Sin descripción cargada."}
								</p>
							</div>
						</div>
						<div className="rounded-xl border bg-muted/20 p-4">
							<div className="flex items-center gap-2">
								<Sparkles className="h-4 w-4 text-purple-500" />
								<p className="text-sm font-medium">Columnas derivadas</p>
							</div>
							<div className="mt-3 flex flex-wrap gap-2">
								{derivedColumns.length === 0 ? (
									<p className="text-sm text-muted-foreground">Todavía no hay columnas derivadas.</p>
								) : (
									derivedColumns.map((column) => (
										<Badge key={column.label} variant="secondary">
											{column.type}: {column.label}
										</Badge>
									))
								)}
							</div>
						</div>
					</div>
				)}

				{/*

				
				<div className="rounded-md bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 p-3 my-4">
					<p className="text-sm text-purple-800 dark:text-purple-200">
						<strong>¿Qué es una plantilla de extracción?</strong> Es una configuración que le indica al sistema qué información extraer de un documento.
						Por ejemplo, de una factura podés extraer: fecha, proveedor, monto total, y los ítems con sus precios.
					</p>
					<p className="text-xs text-purple-600 dark:text-purple-300 mt-2">
						Primero creás la plantilla, luego la asignás a una carpeta con extracción. Cuando subas documentos a esa carpeta, el sistema los lee y crea las tablas automáticamente.
					</p>
				</div>
				{saveError && (
					<div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
						{saveError}
					</div>
				)}

				<div className="flex-1 grid lg:grid-cols-[1fr_320px] gap-4 overflow-hidden">
					
					<div className="flex flex-col gap-3 min-h-0">
						
						<div className="flex items-center gap-2 flex-wrap">
							<Button asChild variant="outline" size="sm" className="relative">
								<label>
									<Upload className="h-4 w-4 mr-2" />
									{image ? "Cambiar" : "Subir documento"}
									<input
										type="file"
										accept="image/*"
										onChange={handleFileUpload}
										className="absolute inset-0 opacity-0 cursor-pointer"
									/>
								</label>
							</Button>

							{image && (
								<>
									<div className="h-6 w-px bg-border" />
									<Button
										variant={isDrawModeEnabled ? "default" : "outline"}
										size="sm"
										onClick={() => setIsDrawModeEnabled((prev) => !prev)}
										className={isDrawModeEnabled ? "bg-purple-600 hover:bg-purple-700" : ""}
									>
										{isDrawModeEnabled ? (
											<>
												<Pencil className="h-4 w-4 mr-1" />
												Dibujando
											</>
										) : (
											<>
												<Move className="h-4 w-4 mr-1" />
												Navegar
											</>
										)}
									</Button>
									<div className="h-6 w-px bg-border" />
									<Button
										variant="outline"
										size="icon"
										onClick={() => setScale((s) => Math.max(0.25, s - 0.25))}
									>
										<ZoomOut className="h-4 w-4" />
									</Button>
									<span className="text-xs font-mono w-12 text-center">
										{Math.round(scale * 100)}%
									</span>
									<Button
										variant="outline"
										size="icon"
										onClick={() => setScale((s) => Math.min(3, s + 0.25))}
									>
										<ZoomIn className="h-4 w-4" />
									</Button>
									<Button
										variant="outline"
										size="icon"
										onClick={() => setScale(1)}
									>
										<RotateCcw className="h-4 w-4" />
									</Button>
								</>
							)}

							{fileName && (
								<span className="text-xs text-muted-foreground ml-auto truncate max-w-[200px]">
									{fileName}
								</span>
							)}
						</div>

						
						<div
							ref={containerRef}
							className="flex-1 bg-muted/30 rounded-lg border-2 border-dashed border-muted-foreground/20 overflow-auto"
						>
							{image ? (
								<div
									className="p-4"
									style={{
										transform: `scale(${scale})`,
										transformOrigin: "top left",
									}}
								>
									<canvas
										ref={canvasRef}
										onMouseDown={handleMouseDown}
										onMouseMove={handleMouseMove}
										onMouseUp={handleMouseUp}
										onMouseLeave={handleMouseUp}
										style={{
											cursor: isDrawModeEnabled ? "crosshair" : "grab",
											maxWidth: "100%",
										}}
									/>
								</div>
							) : (
								<div className="flex flex-col items-center justify-center h-full min-h-[300px] text-muted-foreground">
									<Upload className="h-16 w-16 mb-4 opacity-30" />
									<p className="font-medium">Subí un documento de ejemplo</p>
									<p className="text-sm opacity-70">PNG, JPG o WebP</p>
								</div>
							)}
						</div>
					</div>

					
					<div className="flex flex-col gap-3 min-h-0">
						
						<div className="space-y-2">
							<Label>Nombre de la plantilla</Label>
							<Input
								value={templateName}
								onChange={(e) => setTemplateName(e.target.value)}
								placeholder="Ej. Orden de Compra"
							/>
						</div>

						
						<div className="flex-1 min-h-0">
							<Label className="mb-2 block">
								Regiones ({regions.length})
							</Label>
							<ScrollArea className="h-[calc(100%-2rem)] pr-3">
								<AnimatePresence mode="popLayout">
									{regions.length === 0 ? (
										<motion.p
											initial={{ opacity: 0 }}
											animate={{ opacity: 1 }}
											className="text-sm text-muted-foreground py-8 text-center"
										>
											Dibujá regiones sobre el documento
										</motion.p>
									) : (
										<div className="space-y-2">
											{regions.map((region) => (
												<RegionItem
													key={region.id}
													region={region}
													isSelected={region.id === selectedRegionId}
													onSelect={() => setSelectedRegionId(region.id)}
													onLabelChange={(label) => handleRegionLabelChange(region.id, label)}
													onDescriptionChange={(description) =>
														handleRegionDescriptionChange(region.id, description)
													}
													onTypeChange={(type) => handleRegionTypeChange(region.id, type)}
													onAddColumn={(col) => handleAddColumn(region.id, col)}
													onRemoveColumn={(idx) => handleRemoveColumn(region.id, idx)}
													onDelete={() => handleDeleteRegion(region.id)}
												/>
											))}
										</div>
									)}
								</AnimatePresence>
							</ScrollArea>
						</div>
					</div>
				</div>

				</div>

				*/}

				<DialogFooter className="gap-2 mt-4">
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancelar
					</Button>
					{currentStep > 0 && (
						<Button
							variant="outline"
							onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
						>
							Atrás
						</Button>
					)}
					{currentStep < steps.length - 1 ? (
						<Button
							onClick={() => setCurrentStep((prev) => Math.min(steps.length - 1, prev + 1))}
							disabled={!canGoNext}
							className="bg-purple-600 hover:bg-purple-700"
						>
							Continuar
						</Button>
					) : (
						<Button
							onClick={handleSave}
							disabled={isSaving || regions.length === 0 || !templateName.trim()}
							className="bg-purple-600 hover:bg-purple-700"
						>
							{isSaving ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								<Save className="h-4 w-4" />
							)}
							{existingTemplate ? "Guardar cambios" : "Guardar plantilla"}
						</Button>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

// Region Item Component
function RegionItem({
	region,
	isSelected,
	onSelect,
	onLabelChange,
	onDescriptionChange,
	onTypeChange,
	onAddColumn,
	onRemoveColumn,
	onDelete,
}: {
	region: Region;
	isSelected: boolean;
	onSelect: () => void;
	onLabelChange: (label: string) => void;
	onDescriptionChange: (description: string) => void;
	onTypeChange: (type: RegionType) => void;
	onAddColumn: (column: string) => void;
	onRemoveColumn: (index: number) => void;
	onDelete: () => void;
}) {
	const [newColumn, setNewColumn] = useState("");
	const [showColumns, setShowColumns] = useState(false);

	const handleAddColumn = () => {
		if (newColumn.trim()) {
			onAddColumn(newColumn.trim());
			setNewColumn("");
		}
	};

	return (
		<motion.div
			layout
			initial={{ opacity: 0, x: -10 }}
			animate={{ opacity: 1, x: 0 }}
			exit={{ opacity: 0, x: 10 }}
			onClick={onSelect}
			className={`p-3 rounded-lg border cursor-pointer transition-all ${isSelected
				? "bg-accent ring-2 ring-primary/30"
				: "bg-card hover:bg-accent/50"
				}`}
			style={{ borderLeftColor: region.color, borderLeftWidth: 4 }}
		>
			<div className="flex items-center gap-2">
				<Input
					value={region.label}
					onChange={(e) => onLabelChange(e.target.value)}
					onClick={(e) => e.stopPropagation()}
					placeholder="Nombre del campo"
					className="flex-1 h-8 text-sm"
				/>

				{/* Type toggle */}
				<div className="flex rounded-md border overflow-hidden">
					<button
						onClick={(e) => {
							e.stopPropagation();
							onTypeChange("single");
						}}
						className={`px-2 py-1 text-xs flex items-center gap-1 transition-colors ${region.type === "single"
							? "bg-primary text-primary-foreground"
							: "bg-muted hover:bg-muted/80"
							}`}
						title="Valor único"
					>
						<Type className="h-3 w-3" />
					</button>
					<button
						onClick={(e) => {
							e.stopPropagation();
							onTypeChange("table");
							setShowColumns(true);
						}}
						className={`px-2 py-1 text-xs flex items-center gap-1 transition-colors ${region.type === "table"
							? "bg-primary text-primary-foreground"
							: "bg-muted hover:bg-muted/80"
							}`}
						title="Tabla (múltiples filas)"
					>
						<Table2 className="h-3 w-3" />
					</button>
				</div>

				<Button
					variant="ghost"
					size="icon"
					onClick={(e) => {
						e.stopPropagation();
						onDelete();
					}}
					className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
				>
					<X className="h-4 w-4" />
				</Button>
			</div>
			<div className="mt-2" onClick={(e) => e.stopPropagation()}>
				<Label className="text-xs text-muted-foreground">Descripcion (opcional)</Label>
				<Input
					value={region.description ?? ""}
					onChange={(e) => onDescriptionChange(e.target.value)}
					placeholder="Ej: Numero de orden visible en el encabezado"
					className="mt-1 h-8 text-xs"
				/>
			</div>

			{/* Table columns */}
			{region.type === "table" && (
				<motion.div
					initial={{ opacity: 0, height: 0 }}
					animate={{ opacity: 1, height: "auto" }}
					className="mt-2 pt-2 border-t space-y-2"
				>
					<div className="flex items-center justify-between">
						<span className="text-xs text-muted-foreground">
							Columnas ({region.tableColumns?.length || 0})
						</span>
						<button
							onClick={(e) => {
								e.stopPropagation();
								setShowColumns(!showColumns);
							}}
							className="text-xs text-primary hover:underline"
						>
							{showColumns ? "Ocultar" : "Editar"}
						</button>
					</div>

					{showColumns && (
						<div className="space-y-2" onClick={(e) => e.stopPropagation()}>
							<div className="flex flex-wrap gap-1">
								{region.tableColumns?.map((col, i) => (
									<Badge key={i} variant="secondary" className="text-xs gap-1">
										{col}
										<button
											onClick={() => onRemoveColumn(i)}
											className="hover:text-destructive ml-1"
										>
											×
										</button>
									</Badge>
								))}
							</div>
							<div className="flex gap-1">
								<Input
									value={newColumn}
									onChange={(e) => setNewColumn(e.target.value)}
									placeholder="Nueva columna..."
									className="h-7 text-xs"
									onKeyDown={(e) => e.key === "Enter" && handleAddColumn()}
								/>
								<Button size="sm" onClick={handleAddColumn} className="h-7 px-2">
									<Plus className="h-3 w-3" />
								</Button>
							</div>
						</div>
					)}
				</motion.div>
			)}
		</motion.div>
	);
}
