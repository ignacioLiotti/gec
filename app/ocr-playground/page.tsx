"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  RiUploadCloud2Line,
  RiDeleteBin6Line,
  RiFlashlightLine,
  RiFileTextLine,
  RiLayoutGridLine,
  RiCloseLine,
  RiInformationLine,
  RiCheckLine,
  RiLoader4Line,
  RiEyeLine,
  RiCodeLine,
  RiImageLine,
  RiTableLine,
  RiText,
  RiAddLine,
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiFilePdf2Line,
  RiZoomInLine,
  RiZoomOutLine,
  RiRefreshLine,
} from "@remixicon/react";
import {
  TransformWrapper,
  TransformComponent,
  useControls,
} from "react-zoom-pan-pinch";

// ============================================================================
// TYPES
// ============================================================================

type RegionType = "single" | "table";

interface Region {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  color: string;
  type: RegionType;
  tableColumns?: string[]; // Column names for table regions
}

interface ExtractionResult {
  id: string;
  label: string;
  type: RegionType;
  text?: string; // For single fields
  rows?: Record<string, string>[]; // For table fields
  color: string;
}

interface RegionPreview {
  id: string;
  label: string;
  color: string;
  type: RegionType;
  croppedDataUrl: string;
  coordinates: { x: number; y: number; width: number; height: number };
  tableColumns?: string[];
}

interface AIPayloadPreview {
  imageDataUrl: string;
  regions: Region[];
  prompt: string;
}

interface DocumentInfo {
  type: "image" | "pdf";
  name: string;
  totalPages: number;
  currentPage: number;
  pdfData?: Uint8Array; // Store PDF data for page navigation
}

// ============================================================================
// CONSTANTS
// ============================================================================

const REGION_COLORS = [
  "#f97316", // orange
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#10b981", // emerald
  "#f43f5e", // rose
  "#eab308", // yellow
  "#3b82f6", // blue
  "#ec4899", // pink
];

const DEFAULT_TABLE_COLUMNS = ["Cantidad", "Unidad", "Descripción", "Precio", "Total"];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

// Render a PDF page to an image using pdfjs-dist
async function renderPdfPageToImage(
  pdfData: Uint8Array,
  pageNumber: number,
  scale: number = 2
): Promise<{ image: HTMLImageElement; totalPages: number }> {
  // Import pdfjs-dist and set up worker
  const pdfjs = await import("pdfjs-dist");
  
  // Set worker source to public file
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf-worker/pdf.worker.min.mjs";
  
  const loadingTask = pdfjs.getDocument({ data: pdfData });
  const pdf = await loadingTask.promise;
  const totalPages = pdf.numPages;
  
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No canvas context");
  
  // @ts-ignore - canvas context type mismatch is fine
  await page.render({ canvasContext: ctx, viewport }).promise;
  
  const dataUrl = canvas.toDataURL("image/png");
  
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ image: img, totalPages });
    img.onerror = reject;
    img.src = dataUrl;
  });
}

// Check if file is a supported document type
function getFileType(file: File): "image" | "pdf" | "unsupported" {
  if (file.type.startsWith("image/")) return "image";
  if (file.type === "application/pdf" || file.name.endsWith(".pdf")) return "pdf";
  return "unsupported";
}

// ============================================================================
// TYPES FOR CANVAS EDITING
// ============================================================================

type HandlePosition = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";
type InteractionMode = "idle" | "drawing" | "moving" | "resizing";

interface EditState {
  mode: InteractionMode;
  selectedRegionId: string | null;
  resizeHandle: HandlePosition | null;
  startPoint: { x: number; y: number };
  originalRegion: Region | null;
}

const HANDLE_SIZE = 10;

// ============================================================================
// HOOKS
// ============================================================================

function useCanvasDrawing(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  image: HTMLImageElement | null,
  regions: Region[],
  selectedRegionId: string | null,
  onRegionCreated: (region: Omit<Region, "id" | "color">) => void,
  onRegionUpdated: (id: string, updates: Partial<Region>) => void,
  onRegionSelected: (id: string | null) => void
) {
  const [editState, setEditState] = useState<EditState>({
    mode: "idle",
    selectedRegionId: null,
    resizeHandle: null,
    startPoint: { x: 0, y: 0 },
    originalRegion: null,
  });

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
    [canvasRef]
  );

  // Get handle positions for a region
  const getHandles = useCallback((region: Region) => {
    const { x, y, width, height } = region;
    const hs = HANDLE_SIZE;
    return {
      nw: { x: x - hs / 2, y: y - hs / 2 },
      n: { x: x + width / 2 - hs / 2, y: y - hs / 2 },
      ne: { x: x + width - hs / 2, y: y - hs / 2 },
      e: { x: x + width - hs / 2, y: y + height / 2 - hs / 2 },
      se: { x: x + width - hs / 2, y: y + height - hs / 2 },
      s: { x: x + width / 2 - hs / 2, y: y + height - hs / 2 },
      sw: { x: x - hs / 2, y: y + height - hs / 2 },
      w: { x: x - hs / 2, y: y + height / 2 - hs / 2 },
    };
  }, []);

  // Check if point is inside a handle
  const getHandleAtPoint = useCallback(
    (px: number, py: number, region: Region): HandlePosition | null => {
      const handles = getHandles(region);
      for (const [pos, { x, y }] of Object.entries(handles)) {
        if (px >= x && px <= x + HANDLE_SIZE && py >= y && py <= y + HANDLE_SIZE) {
          return pos as HandlePosition;
        }
      }
      return null;
    },
    [getHandles]
  );

  // Check if point is inside a region
  const getRegionAtPoint = useCallback(
    (px: number, py: number): Region | null => {
      // Check in reverse order (top-most first)
      for (let i = regions.length - 1; i >= 0; i--) {
        const r = regions[i];
        if (px >= r.x && px <= r.x + r.width && py >= r.y && py <= r.y + r.height) {
          return r;
        }
      }
      return null;
    },
    [regions]
  );

  // Get cursor style based on position
  const getCursorStyle = useCallback(
    (coords: { x: number; y: number }): string => {
      // Check selected region handles first
      if (selectedRegionId) {
        const selectedRegion = regions.find((r) => r.id === selectedRegionId);
        if (selectedRegion) {
          const handle = getHandleAtPoint(coords.x, coords.y, selectedRegion);
          if (handle) {
            const cursors: Record<HandlePosition, string> = {
              nw: "nwse-resize",
              n: "ns-resize",
              ne: "nesw-resize",
              e: "ew-resize",
              se: "nwse-resize",
              s: "ns-resize",
              sw: "nesw-resize",
              w: "ew-resize",
            };
            return cursors[handle];
          }
        }
      }

      // Check if over any region
      const regionAtPoint = getRegionAtPoint(coords.x, coords.y);
      if (regionAtPoint) {
        return "move";
      }

      return "crosshair";
    },
    [selectedRegionId, regions, getHandleAtPoint, getRegionAtPoint]
  );

  const redraw = useCallback(
    (tempRect?: { x: number; y: number; width: number; height: number }) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx || !image) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0);

      // Draw existing regions
      regions.forEach((region) => {
        const isTable = region.type === "table";
        const isSelected = region.id === selectedRegionId;

        // Draw semi-transparent fill for selected region
        if (isSelected) {
          ctx.fillStyle = region.color + "15";
          ctx.fillRect(region.x, region.y, region.width, region.height);
        }

        // Draw border
        ctx.strokeStyle = region.color;
        ctx.lineWidth = isSelected ? 4 : isTable ? 4 : 3;
        if (isTable && !isSelected) {
          ctx.setLineDash([10, 5]);
        }
        ctx.strokeRect(region.x, region.y, region.width, region.height);
        ctx.setLineDash([]);

        // Draw label background
        ctx.fillStyle = region.color;
        const labelText = isTable ? `📊 ${region.label}` : region.label;
        const labelWidth = Math.min(180, region.width);
        ctx.fillRect(region.x, region.y - 28, labelWidth, 26);

        // Draw label text
        ctx.fillStyle = "white";
        ctx.font = "bold 12px system-ui, sans-serif";
        ctx.fillText(labelText.slice(0, 22), region.x + 6, region.y - 10);

        // For table regions, draw grid pattern
        if (isTable) {
          ctx.strokeStyle = region.color + "40";
          ctx.lineWidth = 1;
          const rowHeight = region.height / 5;
          for (let i = 1; i < 5; i++) {
            ctx.beginPath();
            ctx.moveTo(region.x, region.y + rowHeight * i);
            ctx.lineTo(region.x + region.width, region.y + rowHeight * i);
            ctx.stroke();
          }
        }

        // Draw resize handles for selected region
        if (isSelected) {
          const handles = getHandles(region);
          ctx.fillStyle = "white";
          ctx.strokeStyle = region.color;
          ctx.lineWidth = 2;

          Object.values(handles).forEach(({ x, y }) => {
            ctx.fillRect(x, y, HANDLE_SIZE, HANDLE_SIZE);
            ctx.strokeRect(x, y, HANDLE_SIZE, HANDLE_SIZE);
          });
        }
      });

      // Draw temporary rectangle while drawing new region
      if (tempRect) {
        ctx.strokeStyle = REGION_COLORS[regions.length % REGION_COLORS.length];
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 4]);
        ctx.strokeRect(tempRect.x, tempRect.y, tempRect.width, tempRect.height);
        ctx.setLineDash([]);
      }
    },
    [canvasRef, image, regions, selectedRegionId, getHandles]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!image) return;
      const coords = getScaledCoords(e);

      // Check if clicking on a handle of selected region
      if (selectedRegionId) {
        const selectedRegion = regions.find((r) => r.id === selectedRegionId);
        if (selectedRegion) {
          const handle = getHandleAtPoint(coords.x, coords.y, selectedRegion);
          if (handle) {
            setEditState({
              mode: "resizing",
              selectedRegionId,
              resizeHandle: handle,
              startPoint: coords,
              originalRegion: { ...selectedRegion },
            });
            return;
          }
        }
      }

      // Check if clicking on a region
      const regionAtPoint = getRegionAtPoint(coords.x, coords.y);
      if (regionAtPoint) {
        onRegionSelected(regionAtPoint.id);
        setEditState({
          mode: "moving",
          selectedRegionId: regionAtPoint.id,
          resizeHandle: null,
          startPoint: coords,
          originalRegion: { ...regionAtPoint },
        });
        return;
      }

      // Clicking on empty space - deselect and start drawing
      onRegionSelected(null);
      setEditState({
        mode: "drawing",
        selectedRegionId: null,
        resizeHandle: null,
        startPoint: coords,
        originalRegion: null,
      });
    },
    [image, getScaledCoords, selectedRegionId, regions, getHandleAtPoint, getRegionAtPoint, onRegionSelected]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const coords = getScaledCoords(e);

      // Update cursor
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.style.cursor = getCursorStyle(coords);
      }

      if (editState.mode === "idle") return;

      const dx = coords.x - editState.startPoint.x;
      const dy = coords.y - editState.startPoint.y;

      if (editState.mode === "drawing") {
        const tempRect = {
          x: Math.min(editState.startPoint.x, coords.x),
          y: Math.min(editState.startPoint.y, coords.y),
          width: Math.abs(dx),
          height: Math.abs(dy),
        };
        redraw(tempRect);
        return;
      }

      if (editState.mode === "moving" && editState.originalRegion) {
        onRegionUpdated(editState.originalRegion.id, {
          x: editState.originalRegion.x + dx,
          y: editState.originalRegion.y + dy,
        });
        return;
      }

      if (editState.mode === "resizing" && editState.originalRegion && editState.resizeHandle) {
        const orig = editState.originalRegion;
        let newX = orig.x;
        let newY = orig.y;
        let newWidth = orig.width;
        let newHeight = orig.height;

        const handle = editState.resizeHandle;

        // Handle horizontal resizing
        if (handle.includes("w")) {
          newX = orig.x + dx;
          newWidth = orig.width - dx;
        } else if (handle.includes("e")) {
          newWidth = orig.width + dx;
        }

        // Handle vertical resizing
        if (handle.includes("n")) {
          newY = orig.y + dy;
          newHeight = orig.height - dy;
        } else if (handle.includes("s")) {
          newHeight = orig.height + dy;
        }

        // Ensure minimum size
        if (newWidth < 20) {
          if (handle.includes("w")) {
            newX = orig.x + orig.width - 20;
          }
          newWidth = 20;
        }
        if (newHeight < 20) {
          if (handle.includes("n")) {
            newY = orig.y + orig.height - 20;
          }
          newHeight = 20;
        }

        onRegionUpdated(orig.id, {
          x: newX,
          y: newY,
          width: newWidth,
          height: newHeight,
        });
      }
    },
    [getScaledCoords, canvasRef, getCursorStyle, editState, redraw, onRegionUpdated]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (editState.mode === "drawing") {
        const coords = getScaledCoords(e);
        const width = Math.abs(coords.x - editState.startPoint.x);
        const height = Math.abs(coords.y - editState.startPoint.y);

        if (width > 15 && height > 15) {
          onRegionCreated({
            x: Math.min(editState.startPoint.x, coords.x),
            y: Math.min(editState.startPoint.y, coords.y),
            width,
            height,
            label: `Field ${regions.length + 1}`,
            type: "single",
          });
        }
      }

      setEditState({
        mode: "idle",
        selectedRegionId: null,
        resizeHandle: null,
        startPoint: { x: 0, y: 0 },
        originalRegion: null,
      });

      redraw();
    },
    [editState, getScaledCoords, onRegionCreated, regions.length, redraw]
  );

  useEffect(() => {
    redraw();
  }, [redraw]);

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    redraw,
  };
}

// ============================================================================
// COMPONENTS
// ============================================================================

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 text-muted-foreground"
    >
      <Icon className="size-16 mb-4 opacity-40" />
      <p className="font-medium text-lg">{title}</p>
      <p className="text-sm opacity-70">{description}</p>
    </motion.div>
  );
}

function RegionListItem({
  region,
  isSelected,
  onSelect,
  onLabelChange,
  onTypeChange,
  onColumnsChange,
  onDelete,
}: {
  region: Region;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onLabelChange: (id: string, label: string) => void;
  onTypeChange: (id: string, type: RegionType) => void;
  onColumnsChange: (id: string, columns: string[]) => void;
  onDelete: (id: string) => void;
}) {
  const [showColumns, setShowColumns] = useState(false);
  const [newColumn, setNewColumn] = useState("");

  const addColumn = () => {
    if (newColumn.trim()) {
      onColumnsChange(region.id, [...(region.tableColumns || []), newColumn.trim()]);
      setNewColumn("");
    }
  };

  const removeColumn = (index: number) => {
    const newColumns = [...(region.tableColumns || [])];
    newColumns.splice(index, 1);
    onColumnsChange(region.id, newColumns);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      onClick={() => onSelect(region.id)}
      className={`p-3 rounded-lg border space-y-2 cursor-pointer transition-all ${
        isSelected
          ? "bg-accent ring-2 ring-primary/30"
          : "bg-card hover:bg-accent/50"
      }`}
      style={{ borderLeftColor: region.color, borderLeftWidth: 4 }}
    >
      <div className="flex items-center gap-2">
        <Input
          value={region.label}
          onChange={(e) => onLabelChange(region.id, e.target.value)}
          onClick={(e) => e.stopPropagation()}
          placeholder="Field name"
          className="flex-1"
        />
        
        {/* Type toggle buttons */}
        <div className="flex rounded-md border overflow-hidden">
          <button
            onClick={() => onTypeChange(region.id, "single")}
            className={`px-2 py-1.5 text-xs flex items-center gap-1 transition-colors ${
              region.type === "single"
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted/80"
            }`}
            title="Single value"
          >
            <RiText className="size-3" />
          </button>
          <button
            onClick={() => {
              onTypeChange(region.id, "table");
              if (!region.tableColumns?.length) {
                onColumnsChange(region.id, DEFAULT_TABLE_COLUMNS);
              }
              setShowColumns(true);
            }}
            className={`px-2 py-1.5 text-xs flex items-center gap-1 transition-colors ${
              region.type === "table"
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted/80"
            }`}
            title="Table (multiple rows)"
          >
            <RiTableLine className="size-3" />
          </button>
        </div>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onDelete(region.id)}
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <RiCloseLine className="size-4" />
        </Button>
      </div>

      {/* Table columns editor */}
      {region.type === "table" && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="space-y-2 pt-2 border-t"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Table Columns ({region.tableColumns?.length || 0})
            </span>
            <button
              onClick={() => setShowColumns(!showColumns)}
              className="text-xs text-primary hover:underline"
            >
              {showColumns ? "Hide" : "Edit"}
            </button>
          </div>

          {showColumns && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1">
                {region.tableColumns?.map((col, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-muted"
                  >
                    {col}
                    <button
                      onClick={() => removeColumn(i)}
                      className="hover:text-destructive"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-1">
                <Input
                  value={newColumn}
                  onChange={(e) => setNewColumn(e.target.value)}
                  placeholder="Add column..."
                  className="h-7 text-xs"
                  onKeyDown={(e) => e.key === "Enter" && addColumn()}
                />
                <Button size="xs" onClick={addColumn}>
                  <RiAddLine className="size-3" />
                </Button>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}

function ResultItem({ result }: { result: ExtractionResult }) {
  const isTable = result.type === "table" && result.rows;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 rounded-lg bg-card border"
      style={{ borderLeftColor: result.color, borderLeftWidth: 4 }}
    >
      <div className="flex items-center gap-2 mb-2">
        {isTable ? (
          <RiTableLine className="size-4" style={{ color: result.color }} />
        ) : (
          <RiCheckLine className="size-4" style={{ color: result.color }} />
        )}
        <span className="font-semibold text-sm">{result.label}</span>
        {isTable && (
          <span className="text-xs text-muted-foreground ml-auto">
            {result.rows?.length || 0} rows
          </span>
        )}
      </div>

      {isTable ? (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-muted">
                {result.rows?.[0] &&
                  Object.keys(result.rows[0]).map((key) => (
                    <th
                      key={key}
                      className="px-2 py-1 text-left font-medium border"
                    >
                      {key}
                    </th>
                  ))}
              </tr>
            </thead>
            <tbody>
              {result.rows?.map((row, i) => (
                <tr key={i} className="hover:bg-muted/50">
                  {Object.values(row).map((val, j) => (
                    <td key={j} className="px-2 py-1 border">
                      {val || "-"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <code className="block p-3 rounded-md bg-muted text-sm font-mono whitespace-pre-wrap break-words">
          {result.text || "(empty)"}
        </code>
      )}
    </motion.div>
  );
}

function PageNavigator({
  docInfo,
  onPageChange,
  isLoading,
}: {
  docInfo: DocumentInfo;
  onPageChange: (page: number) => void;
  isLoading: boolean;
}) {
  if (docInfo.totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-2 py-2 px-3 bg-muted/50 rounded-lg border">
      <RiFilePdf2Line className="size-4 text-red-500" />
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => onPageChange(docInfo.currentPage - 1)}
        disabled={docInfo.currentPage <= 1 || isLoading}
      >
        <RiArrowLeftSLine className="size-4" />
      </Button>
      <span className="text-sm font-medium min-w-[80px] text-center">
        Page {docInfo.currentPage} / {docInfo.totalPages}
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => onPageChange(docInfo.currentPage + 1)}
        disabled={docInfo.currentPage >= docInfo.totalPages || isLoading}
      >
        <RiArrowRightSLine className="size-4" />
      </Button>
      {isLoading && <RiLoader4Line className="size-4 animate-spin text-muted-foreground" />}
    </div>
  );
}

function DocumentBadge({ docInfo }: { docInfo: DocumentInfo | null }) {
  if (!docInfo) return null;

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      {docInfo.type === "pdf" ? (
        <RiFilePdf2Line className="size-4 text-red-500" />
      ) : (
        <RiImageLine className="size-4 text-blue-500" />
      )}
      <span className="truncate max-w-[150px]">{docInfo.name}</span>
      {docInfo.totalPages > 1 && (
        <span className="text-muted-foreground">({docInfo.totalPages} pages)</span>
      )}
    </div>
  );
}

function ZoomControls({ showScale = false }: { showScale?: boolean }) {
  const { zoomIn, zoomOut, resetTransform, instance } = useControls();
  const scale = instance.transformState.scale;

  return (
    <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-background/90 backdrop-blur-sm rounded-lg border shadow-sm p-1 z-10">
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => zoomOut()}
        title="Zoom out"
      >
        <RiZoomOutLine className="size-4" />
      </Button>
      {showScale && (
        <span className="text-xs font-mono min-w-[40px] text-center">
          {Math.round(scale * 100)}%
        </span>
      )}
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => resetTransform()}
        title="Reset zoom"
      >
        <RiRefreshLine className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => zoomIn()}
        title="Zoom in"
      >
        <RiZoomInLine className="size-4" />
      </Button>
    </div>
  );
}

// Template canvas with zoom that tracks scale for drawing mode
function TemplateCanvasWithZoom({
  templateCanvasRef,
  templateDrawing,
  isDrawingLocked,
  onToggleDrawingLock,
}: {
  templateCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  templateDrawing: {
    handleMouseDown: (e: React.MouseEvent<HTMLCanvasElement>) => void;
    handleMouseMove: (e: React.MouseEvent<HTMLCanvasElement>) => void;
    handleMouseUp: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  };
  isDrawingLocked: boolean;
  onToggleDrawingLock: () => void;
}) {
  const { instance, zoomIn, zoomOut, resetTransform } = useControls();
  const scale = instance.transformState.scale;
  const isAtNormalScale = Math.abs(scale - 1) < 0.05;
  
  // Drawing is allowed when at 1x scale OR when drawing mode is locked
  const canDraw = isAtNormalScale || isDrawingLocked;

  return (
    <>
      {/* Zoom controls with lock button */}
      <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-background/90 backdrop-blur-sm rounded-lg border shadow-sm p-1 z-10">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => zoomOut()}
          title="Zoom out"
          disabled={isDrawingLocked}
        >
          <RiZoomOutLine className="size-4" />
        </Button>
        <span className="text-xs font-mono min-w-[40px] text-center">
          {Math.round(scale * 100)}%
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => resetTransform()}
          title="Reset zoom"
          disabled={isDrawingLocked}
        >
          <RiRefreshLine className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => zoomIn()}
          title="Zoom in"
          disabled={isDrawingLocked}
        >
          <RiZoomInLine className="size-4" />
        </Button>
        <div className="w-px h-5 bg-border mx-1" />
        <Button
          variant={isDrawingLocked ? "default" : "ghost"}
          size="xs"
          onClick={onToggleDrawingLock}
          title={isDrawingLocked ? "Unlock to pan/zoom" : "Lock zoom to draw"}
          className={isDrawingLocked ? "bg-orange-500 hover:bg-orange-600 text-white" : ""}
        >
          {isDrawingLocked ? "🔒 Drawing" : "✏️ Draw"}
        </Button>
      </div>

      <TransformComponent
        wrapperStyle={{ width: "100%", height: "100%" }}
        contentStyle={{ 
          width: "100%", 
          height: "100%", 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center" 
        }}
      >
        <canvas
          ref={templateCanvasRef}
          onMouseDown={(e) => {
            if (canDraw) templateDrawing.handleMouseDown(e);
          }}
          onMouseMove={(e) => {
            if (canDraw) templateDrawing.handleMouseMove(e);
          }}
          onMouseUp={(e) => {
            if (canDraw) templateDrawing.handleMouseUp(e);
          }}
          onMouseLeave={(e) => {
            if (canDraw) templateDrawing.handleMouseUp(e);
          }}
          className="max-w-full max-h-[500px]"
          style={{ 
            objectFit: "contain",
            cursor: canDraw ? "crosshair" : "grab"
          }}
        />
      </TransformComponent>

      {/* Status badge */}
      {isDrawingLocked && !isAtNormalScale && (
        <div className="absolute top-3 left-3 bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 text-xs px-2 py-1 rounded-md flex items-center gap-1">
          🔒 Drawing at {Math.round(scale * 100)}% zoom
        </div>
      )}
      {!canDraw && (
        <div className="absolute top-3 left-3 bg-muted text-muted-foreground text-xs px-2 py-1 rounded-md">
          Click &quot;Draw&quot; to enable drawing
        </div>
      )}
    </>
  );
}

function InstructionsPanel() {
  return (
    <div className="flex items-start gap-3 p-4 rounded-xl bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30 border border-orange-200 dark:border-orange-900">
      <RiInformationLine className="size-5 text-orange-600 dark:text-orange-400 mt-0.5 shrink-0" />
      <div className="text-sm">
        <p className="font-medium text-orange-800 dark:text-orange-200 mb-1">
          Hierarchical Extraction:
        </p>
        <ul className="space-y-1 text-orange-700 dark:text-orange-300">
          <li>
            <RiFilePdf2Line className="size-3 inline mr-1" />
            <strong>Supports:</strong> Images (PNG, JPG, WebP) and <strong>PDFs</strong> (multi-page)
          </li>
          <li>
            <RiText className="size-3 inline mr-1" />
            <strong>Single fields</strong> - Extract one value (order number, client name)
          </li>
          <li>
            <RiTableLine className="size-3 inline mr-1" />
            <strong>Table regions</strong> - Extract multiple rows with defined columns
          </li>
          <li>
            <strong>Edit regions:</strong> Click to select → drag to move → drag corners to resize
          </li>
        </ul>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default function OcrPlaygroundPage() {
  // Canvas refs
  const templateCanvasRef = useRef<HTMLCanvasElement>(null);
  const testCanvasRef = useRef<HTMLCanvasElement>(null);

  // Image state
  const [templateImage, setTemplateImage] = useState<HTMLImageElement | null>(
    null
  );
  const [testImage, setTestImage] = useState<HTMLImageElement | null>(null);

  // Document info (for PDFs with multiple pages)
  const [templateDocInfo, setTemplateDocInfo] = useState<DocumentInfo | null>(null);
  const [testDocInfo, setTestDocInfo] = useState<DocumentInfo | null>(null);
  const [isLoadingDoc, setIsLoadingDoc] = useState(false);

  // Regions state
  const [regions, setRegions] = useState<Region[]>([]);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);

  // Extraction state
  const [isExtracting, setIsExtracting] = useState(false);
  const [results, setResults] = useState<ExtractionResult[]>([]);

  // Preview state - shows what's being sent to AI
  const [regionPreviews, setRegionPreviews] = useState<RegionPreview[]>([]);
  const [payloadPreview, setPayloadPreview] = useState<AIPayloadPreview | null>(null);
  const [showPayloadJson, setShowPayloadJson] = useState(false);

  // Drawing lock state - allows drawing at any zoom level
  const [isDrawingLocked, setIsDrawingLocked] = useState(false);

  // Region management
  const handleRegionCreated = useCallback(
    (regionData: Omit<Region, "id" | "color">) => {
      const newRegion: Region = {
        ...regionData,
        id: generateId(),
        color: REGION_COLORS[regions.length % REGION_COLORS.length],
      };
      setRegions((prev) => [...prev, newRegion]);
      setSelectedRegionId(newRegion.id); // Auto-select new region
    },
    [regions.length]
  );

  const handleRegionUpdated = useCallback((id: string, updates: Partial<Region>) => {
    setRegions((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...updates } : r))
    );
  }, []);

  const handleLabelChange = useCallback((id: string, label: string) => {
    setRegions((prev) =>
      prev.map((r) => (r.id === id ? { ...r, label } : r))
    );
  }, []);

  const handleTypeChange = useCallback((id: string, type: RegionType) => {
    setRegions((prev) =>
      prev.map((r) => (r.id === id ? { ...r, type } : r))
    );
  }, []);

  const handleColumnsChange = useCallback((id: string, columns: string[]) => {
    setRegions((prev) =>
      prev.map((r) => (r.id === id ? { ...r, tableColumns: columns } : r))
    );
  }, []);

  const handleDeleteRegion = useCallback((id: string) => {
    setRegions((prev) => prev.filter((r) => r.id !== id));
    if (selectedRegionId === id) {
      setSelectedRegionId(null);
    }
  }, [selectedRegionId]);

  const handleClearAllRegions = useCallback(() => {
    if (regions.length === 0) return;
    if (confirm("Are you sure you want to clear all regions?")) {
      setRegions([]);
      setSelectedRegionId(null);
    }
  }, [regions.length]);

  // Canvas drawing for template
  const templateDrawing = useCanvasDrawing(
    templateCanvasRef,
    templateImage,
    regions,
    selectedRegionId,
    handleRegionCreated,
    handleRegionUpdated,
    setSelectedRegionId
  );

  // Keyboard shortcuts for editing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === "Escape") {
        setSelectedRegionId(null);
      } else if ((e.key === "Delete" || e.key === "Backspace") && selectedRegionId) {
        handleDeleteRegion(selectedRegionId);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedRegionId, handleDeleteRegion]);

  // Document upload handlers (supports images and PDFs)
  const handleTemplateUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const fileType = getFileType(file);
      if (fileType === "unsupported") {
        alert("Unsupported file type. Please upload an image or PDF.");
        return;
      }

      setIsLoadingDoc(true);

      try {
        if (fileType === "pdf") {
          // Handle PDF
          const arrayBuffer = await file.arrayBuffer();
          const pdfData = new Uint8Array(arrayBuffer);
          
          const { image, totalPages } = await renderPdfPageToImage(pdfData, 1);
          
          setTemplateImage(image);
          setTemplateDocInfo({
            type: "pdf",
            name: file.name,
            totalPages,
            currentPage: 1,
            pdfData,
          });

          const canvas = templateCanvasRef.current;
          if (canvas) {
            canvas.width = image.width;
            canvas.height = image.height;
          }
        } else {
          // Handle image
          const reader = new FileReader();
          reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
              setTemplateImage(img);
              setTemplateDocInfo({
                type: "image",
                name: file.name,
                totalPages: 1,
                currentPage: 1,
              });

              const canvas = templateCanvasRef.current;
              if (canvas) {
                canvas.width = img.width;
                canvas.height = img.height;
              }
            };
            img.src = event.target?.result as string;
          };
          reader.readAsDataURL(file);
        }
      } catch (error) {
        console.error("Error loading document:", error);
        alert("Failed to load document. Please try again.");
      } finally {
        setIsLoadingDoc(false);
      }
    },
    []
  );

  const handleTestUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const fileType = getFileType(file);
      if (fileType === "unsupported") {
        alert("Unsupported file type. Please upload an image or PDF.");
        return;
      }

      setIsLoadingDoc(true);
      setResults([]);

      try {
        if (fileType === "pdf") {
          const arrayBuffer = await file.arrayBuffer();
          const pdfData = new Uint8Array(arrayBuffer);
          
          const { image, totalPages } = await renderPdfPageToImage(pdfData, 1);
          
          setTestImage(image);
          setTestDocInfo({
            type: "pdf",
            name: file.name,
            totalPages,
            currentPage: 1,
            pdfData,
          });

          const canvas = testCanvasRef.current;
          if (canvas) {
            canvas.width = image.width;
            canvas.height = image.height;
          }
        } else {
          const reader = new FileReader();
          reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
              setTestImage(img);
              setTestDocInfo({
                type: "image",
                name: file.name,
                totalPages: 1,
                currentPage: 1,
              });

              const canvas = testCanvasRef.current;
              if (canvas) {
                canvas.width = img.width;
                canvas.height = img.height;
              }
            };
            img.src = event.target?.result as string;
          };
          reader.readAsDataURL(file);
        }
      } catch (error) {
        console.error("Error loading document:", error);
        alert("Failed to load document. Please try again.");
      } finally {
        setIsLoadingDoc(false);
      }
    },
    []
  );

  // Page navigation for PDFs
  const handleTemplatePageChange = useCallback(
    async (newPage: number) => {
      if (!templateDocInfo?.pdfData || templateDocInfo.type !== "pdf") return;
      if (newPage < 1 || newPage > templateDocInfo.totalPages) return;

      setIsLoadingDoc(true);
      try {
        const { image } = await renderPdfPageToImage(templateDocInfo.pdfData, newPage);
        setTemplateImage(image);
        setTemplateDocInfo((prev) => prev ? { ...prev, currentPage: newPage } : null);

        const canvas = templateCanvasRef.current;
        if (canvas) {
          canvas.width = image.width;
          canvas.height = image.height;
        }
      } catch (error) {
        console.error("Error changing page:", error);
      } finally {
        setIsLoadingDoc(false);
      }
    },
    [templateDocInfo]
  );

  const handleTestPageChange = useCallback(
    async (newPage: number) => {
      if (!testDocInfo?.pdfData || testDocInfo.type !== "pdf") return;
      if (newPage < 1 || newPage > testDocInfo.totalPages) return;

      setIsLoadingDoc(true);
      try {
        const { image } = await renderPdfPageToImage(testDocInfo.pdfData, newPage);
        setTestImage(image);
        setTestDocInfo((prev) => prev ? { ...prev, currentPage: newPage } : null);

        const canvas = testCanvasRef.current;
        if (canvas) {
          canvas.width = image.width;
          canvas.height = image.height;
        }
      } catch (error) {
        console.error("Error changing page:", error);
      } finally {
        setIsLoadingDoc(false);
      }
    },
    [testDocInfo]
  );

  // Draw test image with regions
  useEffect(() => {
    const canvas = testCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !testImage) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(testImage, 0, 0);

    // Draw regions overlay
    regions.forEach((region) => {
      const isTable = region.type === "table";

      ctx.strokeStyle = region.color;
      ctx.lineWidth = isTable ? 4 : 3;
      if (isTable) ctx.setLineDash([10, 5]);
      ctx.strokeRect(region.x, region.y, region.width, region.height);
      ctx.setLineDash([]);

      ctx.fillStyle = region.color;
      const labelText = isTable ? `📊 ${region.label}` : region.label;
      const labelWidth = Math.min(180, region.width);
      ctx.fillRect(region.x, region.y - 28, labelWidth, 26);

      ctx.fillStyle = "white";
      ctx.font = "bold 12px system-ui, sans-serif";
      ctx.fillText(labelText.slice(0, 22), region.x + 6, region.y - 10);
    });
  }, [testImage, regions]);

  // Helper function to draw annotated image with numbered boxes
  const createAnnotatedImage = useCallback(
    (image: HTMLImageElement, regionsToAnnotate: Region[]): string => {
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return "";

      // Draw the base image
      ctx.drawImage(image, 0, 0);

      // Draw each region with a numbered label
      regionsToAnnotate.forEach((region, index) => {
        const boxNumber = index + 1;
        const isTable = region.type === "table";

        // Draw semi-transparent fill
        ctx.fillStyle = region.color + "20";
        ctx.fillRect(region.x, region.y, region.width, region.height);

        // Draw border
        ctx.strokeStyle = region.color;
        ctx.lineWidth = isTable ? 5 : 4;
        if (isTable) ctx.setLineDash([12, 6]);
        ctx.strokeRect(region.x, region.y, region.width, region.height);
        ctx.setLineDash([]);

        // Draw numbered label badge
        const badgeWidth = isTable ? 80 : 40;
        const badgeHeight = 40;
        const badgeX = region.x + 4;
        const badgeY = region.y + 4;

        ctx.fillStyle = region.color;
        ctx.beginPath();
        ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 6);
        ctx.fill();

        // Badge content
        ctx.fillStyle = "white";
        ctx.font = `bold ${isTable ? 14 : 20}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        
        if (isTable) {
          ctx.fillText(
            `[${boxNumber}]📊`,
            badgeX + badgeWidth / 2,
            badgeY + badgeHeight / 2
          );
        } else {
          ctx.fillText(
            `${boxNumber}`,
            badgeX + badgeWidth / 2,
            badgeY + badgeHeight / 2
          );
        }

        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
      });

      return canvas.toDataURL("image/jpeg", 0.92);
    },
    []
  );

  // Generate cropped previews for each region
  const generatePreviews = useCallback(() => {
    if (!testImage || regions.length === 0) return;

    const previews: RegionPreview[] = [];
    const tempCanvas = document.createElement("canvas");
    const tempCtx = tempCanvas.getContext("2d");

    for (let i = 0; i < regions.length; i++) {
      const region = regions[i];
      if (!tempCtx) continue;

      tempCanvas.width = region.width;
      tempCanvas.height = region.height;
      tempCtx.drawImage(
        testImage,
        region.x,
        region.y,
        region.width,
        region.height,
        0,
        0,
        region.width,
        region.height
      );

      const typeIcon = region.type === "table" ? "📊" : "";
      previews.push({
        id: region.id,
        label: `[${i + 1}] ${typeIcon} ${region.label}`,
        color: region.color,
        type: region.type,
        croppedDataUrl: tempCanvas.toDataURL("image/png"),
        coordinates: {
          x: Math.round(region.x),
          y: Math.round(region.y),
          width: Math.round(region.width),
          height: Math.round(region.height),
        },
        tableColumns: region.tableColumns,
      });
    }

    setRegionPreviews(previews);

    // Generate ANNOTATED image
    const annotatedImageDataUrl = createAnnotatedImage(testImage, regions);

    // Build hierarchical prompt
    const singleFields = regions.filter((r) => r.type === "single");
    const tableFields = regions.filter((r) => r.type === "table");

    let regionDescriptions = "";
    
    if (singleFields.length > 0) {
      regionDescriptions += "SINGLE VALUE FIELDS (extract one value each):\n";
      regionDescriptions += singleFields
        .map((r) => {
          const idx = regions.indexOf(r) + 1;
          return `  [${idx}] = "${r.label}"`;
        })
        .join("\n");
    }

    if (tableFields.length > 0) {
      regionDescriptions += "\n\nTABLE REGIONS (extract multiple rows):\n";
      regionDescriptions += tableFields
        .map((r) => {
          const idx = regions.indexOf(r) + 1;
          const cols = r.tableColumns?.join(", ") || "auto-detect columns";
          return `  [${idx}]📊 = "${r.label}" with columns: [${cols}]`;
        })
        .join("\n");
    }

    const prompt = `You are an OCR assistant extracting data from a document image with numbered boxes drawn on it.

${regionDescriptions}

INSTRUCTIONS:
- Look at the VISUAL boxes drawn on the image
- Boxes with just a number [1], [2] are SINGLE VALUE fields - extract one text value
- Boxes with [N]📊 are TABLE regions - extract ALL rows visible in that area
- For tables, return an array of objects with the specified column names
- Extract text exactly as it appears, no interpretation
- Return null for empty or illegible fields`;

    setPayloadPreview({
      imageDataUrl: annotatedImageDataUrl,
      regions,
      prompt,
    });
  }, [testImage, regions, createAnnotatedImage]);

  // Auto-generate previews when test image or regions change
  useEffect(() => {
    if (testImage && regions.length > 0) {
      generatePreviews();
    } else {
      setRegionPreviews([]);
      setPayloadPreview(null);
    }
  }, [testImage, regions, generatePreviews]);

  // OCR extraction using GPT-4o-mini via API
  const handleExtract = useCallback(async () => {
    if (!testImage || regions.length === 0 || !payloadPreview) return;

    setIsExtracting(true);
    setResults([]);

    try {
      const response = await fetch("/api/ocr-playground", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          annotatedImageDataUrl: payloadPreview.imageDataUrl,
          regions: regions.map((r) => ({
            id: r.id,
            x: r.x,
            y: r.y,
            width: r.width,
            height: r.height,
            label: r.label,
            color: r.color,
            type: r.type,
            tableColumns: r.tableColumns,
          })),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to extract text");
      }

      const data = await response.json();

      if (data.ok && Array.isArray(data.results)) {
        setResults(data.results);
      }
    } catch (error) {
      console.error("OCR extraction failed:", error);
      setResults([
        {
          id: "error",
          label: "Error",
          type: "single",
          text: error instanceof Error ? error.message : "Failed to extract text",
          color: "#ef4444",
        },
      ]);
    } finally {
      setIsExtracting(false);
    }
  }, [testImage, regions, payloadPreview]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-background to-amber-50 dark:from-orange-950/20 dark:via-background dark:to-amber-950/20">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-orange-500 to-amber-500 text-white py-8 px-6 mb-8"
      >
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <RiLayoutGridLine className="size-8" />
            <h1 className="text-3xl font-bold tracking-tight">
              OCR Playground
            </h1>
          </div>
          <p className="text-orange-100 text-lg">
            Hierarchical Extraction: Single Fields + Table Regions
          </p>
        </div>
      </motion.div>

      <div className="max-w-7xl mx-auto px-6 pb-12">
        <div className="mb-6">
          <InstructionsPanel />
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Template Definition Panel */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/30 border-b">
                <CardTitle className="flex items-center gap-2 text-orange-800 dark:text-orange-200">
                  <RiLayoutGridLine className="size-5" />
                  Step 1: Define Template
                </CardTitle>
                <CardDescription>
                  Draw regions and mark them as single values or tables
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Button asChild className="relative" disabled={isLoadingDoc}>
                    <label>
                      <RiUploadCloud2Line className="size-4 mr-2" />
                      Upload Template
                      <input
                        type="file"
                        accept="image/*,.pdf,application/pdf"
                        onChange={handleTemplateUpload}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                    </label>
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleClearAllRegions}
                    disabled={regions.length === 0}
                  >
                    <RiDeleteBin6Line className="size-4 mr-2" />
                    Clear All
                  </Button>
                  <DocumentBadge docInfo={templateDocInfo} />
                </div>

                {/* Page navigation for PDFs */}
                {templateDocInfo && templateDocInfo.totalPages > 1 && (
                  <PageNavigator
                    docInfo={templateDocInfo}
                    onPageChange={handleTemplatePageChange}
                    isLoading={isLoadingDoc}
                  />
                )}

                <div className="relative min-h-[400px] bg-muted/50 rounded-xl border-2 border-dashed border-muted-foreground/20 overflow-hidden flex items-center justify-center">
                  {isLoadingDoc && !templateImage ? (
                    <div className="flex flex-col items-center gap-3">
                      <RiLoader4Line className="size-10 animate-spin text-orange-500" />
                      <p className="text-muted-foreground">Loading document...</p>
                    </div>
                  ) : templateImage ? (
                    <TransformWrapper
                      initialScale={1}
                      minScale={0.5}
                      maxScale={5}
                      wheel={{ step: 0.1, disabled: isDrawingLocked }}
                      panning={{ disabled: isDrawingLocked }}
                      doubleClick={{ disabled: true }}
                    >
                      <TemplateCanvasWithZoom
                        templateCanvasRef={templateCanvasRef}
                        templateDrawing={templateDrawing}
                        isDrawingLocked={isDrawingLocked}
                        onToggleDrawingLock={() => setIsDrawingLocked((prev) => !prev)}
                      />
                    </TransformWrapper>
                  ) : (
                    <EmptyState
                      icon={RiUploadCloud2Line}
                      title="Upload a template"
                      description="Supports images (PNG, JPG) and PDFs"
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <h3 className="font-medium text-sm text-muted-foreground">
                    Defined Regions ({regions.length})
                  </h3>
                  <AnimatePresence mode="popLayout">
                    {regions.length > 0 ? (
                      <div className="space-y-2 max-h-[350px] overflow-y-auto pr-2">
                        {regions.map((region) => (
                          <RegionListItem
                            key={region.id}
                            region={region}
                            isSelected={selectedRegionId === region.id}
                            onSelect={setSelectedRegionId}
                            onLabelChange={handleLabelChange}
                            onTypeChange={handleTypeChange}
                            onColumnsChange={handleColumnsChange}
                            onDelete={handleDeleteRegion}
                          />
                        ))}
                      </div>
                    ) : (
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-sm text-muted-foreground text-center py-4"
                      >
                        No regions defined yet. Draw on the template to create regions.
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Test & Extract Panel */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 border-b">
                <CardTitle className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200">
                  <RiFileTextLine className="size-5" />
                  Step 2: Test Extraction
                </CardTitle>
                <CardDescription>
                  Upload a document to extract single values and table data
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Button asChild variant="outline" className="relative" disabled={isLoadingDoc}>
                    <label>
                      <RiUploadCloud2Line className="size-4 mr-2" />
                      Upload Test Document
                      <input
                        type="file"
                        accept="image/*,.pdf,application/pdf"
                        onChange={handleTestUpload}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                    </label>
                  </Button>
                  <Button
                    onClick={handleExtract}
                    disabled={!testImage || regions.length === 0 || isExtracting || isLoadingDoc}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    {isExtracting ? (
                      <>
                        <RiLoader4Line className="size-4 mr-2 animate-spin" />
                        Extracting...
                      </>
                    ) : (
                      <>
                        <RiFlashlightLine className="size-4 mr-2" />
                        Extract All
                      </>
                    )}
                  </Button>
                  <DocumentBadge docInfo={testDocInfo} />
                </div>

                {/* Page navigation for PDFs */}
                {testDocInfo && testDocInfo.totalPages > 1 && (
                  <PageNavigator
                    docInfo={testDocInfo}
                    onPageChange={handleTestPageChange}
                    isLoading={isLoadingDoc}
                  />
                )}

                <div className="relative min-h-[400px] bg-muted/50 rounded-xl border-2 border-dashed border-muted-foreground/20 overflow-hidden flex items-center justify-center">
                  {isLoadingDoc && !testImage ? (
                    <div className="flex flex-col items-center gap-3">
                      <RiLoader4Line className="size-10 animate-spin text-emerald-500" />
                      <p className="text-muted-foreground">Loading document...</p>
                    </div>
                  ) : testImage ? (
                    <TransformWrapper
                      initialScale={1}
                      minScale={0.5}
                      maxScale={5}
                      wheel={{ step: 0.1 }}
                    >
                      <ZoomControls />
                      <TransformComponent
                        wrapperStyle={{ width: "100%", height: "100%" }}
                        contentStyle={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}
                      >
                        <canvas
                          ref={testCanvasRef}
                          className="max-w-full max-h-[500px]"
                          style={{ objectFit: "contain", cursor: "grab" }}
                        />
                      </TransformComponent>
                    </TransformWrapper>
                  ) : (
                    <EmptyState
                      icon={RiFileTextLine}
                      title="Upload a test document"
                      description="Supports images (PNG, JPG) and PDFs"
                    />
                  )}
                </div>

                {/* Preview: What's being sent to AI */}
                <AnimatePresence>
                  {regionPreviews.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-4"
                    >
                      {/* Cropped Regions Preview */}
                      <div className="p-4 rounded-xl bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 border border-violet-200 dark:border-violet-800">
                        <div className="flex items-center gap-2 mb-3">
                          <RiEyeLine className="size-5 text-violet-600" />
                          <h3 className="font-semibold text-violet-800 dark:text-violet-200">
                            Preview: Cropped Regions
                          </h3>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          {regionPreviews.map((preview) => (
                            <motion.div
                              key={preview.id}
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="p-3 rounded-lg bg-white dark:bg-gray-900 border shadow-sm"
                              style={{ borderLeftColor: preview.color, borderLeftWidth: 4 }}
                            >
                              <div className="flex items-center gap-2 mb-2">
                                {preview.type === "table" ? (
                                  <RiTableLine className="size-4" style={{ color: preview.color }} />
                                ) : (
                                  <RiImageLine className="size-4" style={{ color: preview.color }} />
                                )}
                                <span className="font-medium text-xs truncate">{preview.label}</span>
                              </div>
                              <div className="relative bg-muted rounded overflow-hidden mb-2">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={preview.croppedDataUrl}
                                  alt={`Cropped region: ${preview.label}`}
                                  className="w-full h-auto max-h-24 object-contain"
                                />
                              </div>
                              {preview.type === "table" && preview.tableColumns && (
                                <p className="text-xs text-muted-foreground truncate">
                                  Cols: {preview.tableColumns.join(", ")}
                                </p>
                              )}
                            </motion.div>
                          ))}
                        </div>
                      </div>

                      {/* API Payload Preview */}
                      {payloadPreview && (
                        <div className="p-4 rounded-xl bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-950/30 dark:to-gray-950/30 border border-slate-200 dark:border-slate-700">
                          <button
                            onClick={() => setShowPayloadJson(!showPayloadJson)}
                            className="flex items-center gap-2 w-full text-left"
                          >
                            <RiCodeLine className="size-5 text-slate-600" />
                            <h3 className="font-semibold text-slate-800 dark:text-slate-200 flex-1">
                              What GPT Actually Sees
                            </h3>
                            <span className="text-xs text-muted-foreground">
                              {showPayloadJson ? "Hide" : "Show"}
                            </span>
                          </button>
                          
                          <AnimatePresence>
                            {showPayloadJson && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="mt-3 space-y-4">
                                  <div>
                                    <p className="text-xs font-medium text-muted-foreground mb-2">
                                      📸 Annotated Image (with numbered boxes) - scroll to zoom:
                                    </p>
                                    <div className="relative bg-muted rounded-lg overflow-hidden border h-64">
                                      <TransformWrapper
                                        initialScale={1}
                                        minScale={0.5}
                                        maxScale={5}
                                        wheel={{ step: 0.1 }}
                                      >
                                        <ZoomControls />
                                        <TransformComponent
                                          wrapperStyle={{ width: "100%", height: "100%" }}
                                          contentStyle={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}
                                        >
                                          {/* eslint-disable-next-line @next/next/no-img-element */}
                                          <img
                                            src={payloadPreview.imageDataUrl}
                                            alt="Annotated image being sent to GPT"
                                            className="w-full h-auto max-h-64 object-contain"
                                            style={{ cursor: "grab" }}
                                          />
                                        </TransformComponent>
                                      </TransformWrapper>
                                    </div>
                                  </div>

                                  <div>
                                    <p className="text-xs font-medium text-muted-foreground mb-1">
                                      💬 Prompt:
                                    </p>
                                    <pre className="p-3 rounded-lg bg-muted text-xs overflow-x-auto whitespace-pre-wrap max-h-40 overflow-y-auto">
                                      {payloadPreview.prompt}
                                    </pre>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Results */}
                <AnimatePresence mode="wait">
                  {isExtracting ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex flex-col items-center justify-center py-8"
                    >
                      <RiLoader4Line className="size-10 text-emerald-600 animate-spin mb-3" />
                      <p className="text-muted-foreground">
                        Extracting fields and tables...
                      </p>
                    </motion.div>
                  ) : results.length > 0 ? (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-3"
                    >
                      <h3 className="font-medium text-sm text-muted-foreground flex items-center gap-2">
                        <RiCheckLine className="size-4 text-emerald-600" />
                        Extraction Results
                      </h3>
                      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                        {results.map((result) => (
                          <ResultItem key={result.id} result={result} />
                        ))}
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
