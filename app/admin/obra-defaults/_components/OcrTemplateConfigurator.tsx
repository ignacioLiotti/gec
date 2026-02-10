"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
	Upload,
	Trash2,
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
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
	existingTemplate?: OcrTemplate | null;
}

export function OcrTemplateConfigurator({
	open,
	onOpenChange,
	onTemplateCreated,
	existingTemplate,
}: Props) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);

	// State
	const [templateName, setTemplateName] = useState("");
	const [image, setImage] = useState<HTMLImageElement | null>(null);
	const [fileName, setFileName] = useState<string | null>(null);
	const [regions, setRegions] = useState<Region[]>([]);
	const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
	const [isDrawing, setIsDrawing] = useState(false);
	const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
	const [isSaving, setIsSaving] = useState(false);
	const [saveError, setSaveError] = useState<string | null>(null);
	const [scale, setScale] = useState(1);
	const [isDrawModeEnabled, setIsDrawModeEnabled] = useState(true);

	// Reset when dialog opens/closes
	useEffect(() => {
		if (open) {
			if (existingTemplate) {
				setTemplateName(existingTemplate.name);
				setRegions(existingTemplate.regions);
				// TODO: Load template image
			} else {
				setTemplateName("");
				setImage(null);
				setFileName(null);
				setRegions([]);
				setSelectedRegionId(null);
				setScale(1);
			}
		}
	}, [open, existingTemplate]);

	// Handle file upload
	const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		const isImage = file.type.startsWith("image/");
		const isPdf = file.type === "application/pdf" || file.name.endsWith(".pdf");

		if (!isImage && !isPdf) {
			toast.error("Solo se permiten imágenes o PDFs");
			return;
		}

		if (isPdf) {
			// For now, only support images. PDF support would require pdf.js
			toast.error("Por ahora solo se permiten imágenes. Soporte PDF próximamente.");
			return;
		}

		setFileName(file.name);

		const reader = new FileReader();
		reader.onload = (event) => {
			const img = new Image();
			img.onload = () => {
				setImage(img);
				setRegions([]);
				setSelectedRegionId(null);
				setScale(1);
			};
			img.src = event.target?.result as string;
		};
		reader.readAsDataURL(file);
	}, []);

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
			ctx.drawImage(image, 0, 0);

			// Draw existing regions
			for (const region of regions) {
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
				ctx.strokeStyle = REGION_COLORS[regions.length % REGION_COLORS.length];
				ctx.lineWidth = 3;
				ctx.setLineDash([6, 3]);
				ctx.strokeRect(tempRect.x, tempRect.y, tempRect.width, tempRect.height);
				ctx.setLineDash([]);
			}
		},
		[image, regions, selectedRegionId]
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
			for (let i = regions.length - 1; i >= 0; i--) {
				const r = regions[i];
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
		[image, isDrawModeEnabled, getScaledCoords, regions]
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
					label: `Campo ${regions.length + 1}`,
					color: REGION_COLORS[regions.length % REGION_COLORS.length],
					type: "single",
				};
				setRegions((prev) => [...prev, newRegion]);
				setSelectedRegionId(newRegion.id);
			}

			setIsDrawing(false);
			setDrawStart(null);
			redraw();
		},
		[isDrawing, drawStart, getScaledCoords, regions.length, redraw]
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
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: templateName.trim(),
					regions,
					templateWidth: image?.width,
					templateHeight: image?.height,
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
			toast.success("Plantilla guardada");
			onTemplateCreated?.(template);
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
	}, [templateName, regions, image, fileName, onTemplateCreated, onOpenChange]);

	const selectedRegion = regions.find((r) => r.id === selectedRegionId);

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

				{/* Explanation */}
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
					{/* Canvas Area */}
					<div className="flex flex-col gap-3 min-h-0">
						{/* Toolbar */}
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

						{/* Canvas Container */}
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

					{/* Right Panel: Regions List */}
					<div className="flex flex-col gap-3 min-h-0">
						{/* Template Name */}
						<div className="space-y-2">
							<Label>Nombre de la plantilla</Label>
							<Input
								value={templateName}
								onChange={(e) => setTemplateName(e.target.value)}
								placeholder="Ej. Orden de Compra"
							/>
						</div>

						{/* Regions List */}
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

				<DialogFooter className="gap-2 mt-4">
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancelar
					</Button>
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
						Guardar plantilla
					</Button>
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



