'use client';

import { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { FormTable } from '@/components/form-table/form-table';
import { createSupabaseBrowserClient } from '@/utils/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { HoverCard, HoverCardTrigger, HoverCardContent } from '@/components/ui/hover-card';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  Folder,
  File,
  FileText,
  Image as ImageIcon,
  FileArchive,
  Plus,
  Upload,
  Search,
  Grid3x3,
  List,
  Download,
  Eye,
  Loader2,
  FolderPlus,
  BarChart3,
  Trash2,
  X,
  Filter,
  ArrowLeft,
  Table2,
  XIcon,
  ClipboardList,
  Building2,
  CalendarDays,
  Package,
  Users,
  Sparkles,
  Hand,
  Layers,
  AlertCircle,
  CheckCircle2,
  Clock,
  FolderIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import * as Sentry from '@sentry/nextjs';
import ForgeViewer from '@/app/excel/[obraId]/tabs/file-manager/components/viewer/forgeviewer';
import { EnhancedDocumentViewer } from '@/components/viewer/enhanced-document-viewer';
import FolderFront from '@/components/ui/FolderFront';
import { DocumentSheet } from './components/document-sheet';
import { DocumentDataSheet } from './components/document-data-sheet';
import { FileTreeSidebar } from './components/file-tree-sidebar';
import { AddRowDialog } from './components/add-row-dialog';
import { useDocumentsStore, needsRefetch, markDocumentsFetched, setDocumentsLoading } from './hooks/useDocumentsStore';
import { OcrTemplateConfigurator } from '@/app/admin/obra-defaults/_components/OcrTemplateConfigurator';
import {
  normalizeFolderName,
  normalizeFolderPath,
  getParentFolderPath,
  normalizeFieldKey,
  ensureTablaDataType,
  TABLA_DATA_TYPES,
  evaluateTablaFormula,
  toNumericValue,
  type TablaColumnDataType
} from '@/lib/tablas';
import { cn } from '@/lib/utils';
import { formatReadableBytes } from '@/lib/tenant-expenses';
import type { UsageDelta } from '@/lib/tenant-usage';
import type {
  FileSystemItem,
  FileManagerSelectionChange,
  MaterialItem,
  MaterialOrder,
  OcrFolderLink,
  OcrTablaColumn,
  OcrDocumentStatus,
  TablaDataRow,
  OcrDocumentTableRow,
  SelectionChangeOptions,
  DataInputMethod,
} from './types';
import {
  getCachedFileTree,
  setCachedFileTree,
  invalidateFileTreeCache,
  getCachedSignedUrl,
  setCachedSignedUrl,
  getCachedBlobUrl,
  preloadAndCacheFile,
  clearCachesForObra,
  getCachedApsModels,
  setCachedApsModels,
  getCachedOcrLinks,
  setCachedOcrLinks,
} from './cache';
import { CellType, FormTableConfig, FormTableRow, ColumnDef, ColumnField } from '@/components/form-table/types';
import { createRowFromColumns } from '@/components/form-table/table-utils';
import { FilterSection, RangeInputGroup, TextFilterInput } from '@/components/form-table/filter-components';
import { FileText as FileTextIcon2, Hash, Type, DollarSign as DollarSignIcon, ToggleLeft } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { HoverCardPortal } from '@radix-ui/react-hover-card';

// Re-export types for external consumers
export type { FileManagerSelectionChange };

const DATA_TYPE_LABELS: Record<TablaColumnDataType, string> = {
  text: 'Texto',
  number: 'Número',
  currency: 'Moneda',
  boolean: 'Booleano',
  date: 'Fecha',
};

type DataFolderColumnPayload = {
  label: string;
  fieldKey: string;
  dataType: TablaColumnDataType;
  required: boolean;
  position: number;
  config?: Record<string, unknown>;
};

type DataFolderTablePreset = {
  name: string;
  description: string;
  columns: DataFolderColumnPayload[];
};

const CERTIFICADO_SPREADSHEET_TABLE_PRESETS: DataFolderTablePreset[] = [
  {
    name: 'PMC Resumen',
    description: 'Resumen mensual del certificado: período, monto, avance acumulado.',
    columns: [
      { label: 'Período', fieldKey: 'periodo', dataType: 'text', required: false, position: 0, config: { excelKeywords: ['periodo', 'mes', 'month', 'correspondiente'] } },
      { label: 'N° Certificado', fieldKey: 'nro_certificado', dataType: 'text', required: false, position: 1, config: { excelKeywords: ['nro', 'numero', 'certificado', 'cert', 'n°'] } },
      { label: 'Fecha Certificación', fieldKey: 'fecha_certificacion', dataType: 'text', required: false, position: 2, config: { excelKeywords: ['fecha', 'certificacion', 'date'] } },
      { label: 'Monto Certificado', fieldKey: 'monto_certificado', dataType: 'currency', required: false, position: 3, config: { excelKeywords: ['monto', 'importe', 'certificado'] } },
      { label: 'Avance Físico Acum. %', fieldKey: 'avance_fisico_acumulado_pct', dataType: 'number', required: false, position: 4, config: { excelKeywords: ['avance', 'fisico', 'acumulado', '%'] } },
      { label: 'Monto Acumulado', fieldKey: 'monto_acumulado', dataType: 'currency', required: false, position: 5, config: { excelKeywords: ['monto', 'acumulado', 'total'] } },
    ],
  },
  {
    name: 'PMC Items',
    description: 'Desglose por rubro/item del certificado con avances e importes.',
    columns: [
      { label: 'Código Item', fieldKey: 'item_code', dataType: 'text', required: false, position: 0, config: { excelKeywords: ['item', 'codigo', 'cod', 'rubro'] } },
      { label: 'Descripción', fieldKey: 'descripcion', dataType: 'text', required: false, position: 1, config: { excelKeywords: ['descripcion', 'rubro', 'concepto', 'detalle'] } },
      { label: 'Incidencia %', fieldKey: 'incidencia_pct', dataType: 'number', required: false, position: 2, config: { excelKeywords: ['incidencia', '%'] } },
      { label: 'Monto Rubro', fieldKey: 'monto_rubro', dataType: 'currency', required: false, position: 3, config: { excelKeywords: ['total', 'rubro', 'monto'] } },
      { label: 'Avance Anterior %', fieldKey: 'avance_anterior_pct', dataType: 'number', required: false, position: 4, config: { excelKeywords: ['anterior', 'avance', '%'] } },
      { label: 'Avance Período %', fieldKey: 'avance_periodo_pct', dataType: 'number', required: false, position: 5, config: { excelKeywords: ['presente', 'periodo', 'avance', '%'] } },
      { label: 'Avance Acumulado %', fieldKey: 'avance_acumulado_pct', dataType: 'number', required: false, position: 6, config: { excelKeywords: ['acumulado', 'avance', '%'] } },
      { label: 'Monto Anterior $', fieldKey: 'monto_anterior', dataType: 'currency', required: false, position: 7, config: { excelKeywords: ['anterior', 'cert', 'importe'] } },
      { label: 'Monto Presente $', fieldKey: 'monto_presente', dataType: 'currency', required: false, position: 8, config: { excelKeywords: ['presente', 'cert', 'importe'] } },
      { label: 'Monto Acumulado $', fieldKey: 'monto_acumulado', dataType: 'currency', required: false, position: 9, config: { excelKeywords: ['total', 'acumulado', 'cert', 'importe'] } },
    ],
  },
  {
    name: 'Curva Plan',
    description: 'Curva de inversiones con avance mensual y acumulado.',
    columns: [
      { label: 'Período', fieldKey: 'periodo', dataType: 'text', required: false, position: 0, config: { excelKeywords: ['mes', 'periodo', 'month'] } },
      { label: 'Avance Mensual %', fieldKey: 'avance_mensual_pct', dataType: 'number', required: false, position: 1, config: { excelKeywords: ['avance', 'mensual', '%'] } },
      { label: 'Avance Acumulado %', fieldKey: 'avance_acumulado_pct', dataType: 'number', required: false, position: 2, config: { excelKeywords: ['acumulado', 'financiero', '%'] } },
    ],
  },
];

// Utility function to check if a file is a 3D model
const is3DModelFile = (fileName: string): boolean => {
  const ext = fileName.toLowerCase().split('.').pop();
  return ['nwc', 'nwd', 'rvt', 'dwg', 'ifc', 'zip'].includes(ext || '');
};


type OcrDocumentTableFilters = {
  docPath: string | null;
  /** Dynamic column filters keyed by fieldKey. For text columns, stores a search string.
   *  For number/currency columns, stores { min: string; max: string }. */
  columnFilters: Record<string, string | { min: string; max: string }>;
};

type OcrOrderItemRow = OcrDocumentTableRow & {
  orderId: string;
  nroOrden: string;
  proveedor: string;
  solicitante: string;
  cantidad: number;
  unidad: string;
  material: string;
  precioUnitario: number;
  total: number;
};

type OcrOrderItemFilters = Record<string, never>;

type OcrDraftColumn = {
  id: string;
  label: string;
  fieldKey: string;
  dataType: TablaColumnDataType;
  required: boolean;
  scope?: 'parent' | 'item';
  description?: string;
};

type OcrTemplateOption = {
  id: string;
  name: string;
  description: string | null;
  columns: Array<{
    fieldKey: string;
    label: string;
    dataType: string;
    ocrScope?: string;
    description?: string;
  }>;
};

type TablaSchemaDraftColumn = {
  localId: string;
  id?: string;
  label: string;
  fieldKey: string;
  dataType: TablaColumnDataType;
  required: boolean;
  formula: string;
  warnBelow: string;
  warnAbove: string;
  criticalBelow: string;
  criticalAbove: string;
};

type SpreadsheetPreviewMapping = {
  dbColumn: string;
  label: string;
  excelHeader: string | null;
  confidence: number;
  manualValue?: string;
};

type SpreadsheetPreviewSheet = {
  name: string;
  headers: string[];
  rowCount: number;
};

type SpreadsheetPreviewTable = {
  tablaId: string;
  tablaName: string;
  inserted: number;
  sheetName: string | null;
  mappings?: SpreadsheetPreviewMapping[];
  previewRows?: Record<string, unknown>[];
  availableSheets?: SpreadsheetPreviewSheet[];
};

type SpreadsheetPreviewPayload = {
  perTable: SpreadsheetPreviewTable[];
  sheetAssignments: Record<string, string | null>;
  columnMappings: Record<string, Record<string, string | null>>;
  manualValues: Record<string, Record<string, string>>;
  existingBucket: string;
  existingPath: string;
  existingFileName: string;
  tablaIds: string[];
};

function getConditionalClass(
  value: unknown,
  config?: Record<string, unknown>
): string | undefined {
  const conditional =
    config?.conditional && typeof config.conditional === 'object'
      ? (config.conditional as Record<string, unknown>)
      : null;
  if (!conditional) return undefined;
  const numeric = toNumericValue(value);
  if (numeric == null) return undefined;
  const criticalBelow = toNumericValue(conditional.criticalBelow);
  const criticalAbove = toNumericValue(conditional.criticalAbove);
  const warnBelow = toNumericValue(conditional.warnBelow);
  const warnAbove = toNumericValue(conditional.warnAbove);
  if (criticalBelow != null && numeric <= criticalBelow) return 'bg-red-100 text-red-800';
  if (criticalAbove != null && numeric >= criticalAbove) return 'bg-red-100 text-red-800';
  if (warnBelow != null && numeric <= warnBelow) return 'bg-amber-100 text-amber-800';
  if (warnAbove != null && numeric >= warnAbove) return 'bg-amber-100 text-amber-800';
  return undefined;
}

type FileManagerProps = {
  obraId: string;
  materialOrders?: MaterialOrder[];
  onRefreshMaterials?: () => void;
  selectedFolderPath?: string | null;
  selectedFilePath?: string | null;
  onSelectionChange?: (selection: FileManagerSelectionChange) => void;
};

type TenantPlanLimits = {
  storageBytes: number | null;
  aiTokens: number | null;
  whatsappMessages: number | null;
};

type TenantUsageInfo = {
  plan: {
    key: string;
    name: string;
    limits: TenantPlanLimits;
  };
  usage: {
    storageBytes: number;
    aiTokens: number;
    whatsappMessages: number;
    periodStart: string;
    periodEnd: string;
  };
};

type FileThumbnailProps = {
  item: FileSystemItem;
  supabase: ReturnType<typeof createSupabaseBrowserClient>;
  getFileIcon: (mimetype?: string) => ReactNode;
  renderOcrStatusBadge: (item: FileSystemItem) => ReactNode;
};

const FileThumbnail = memo(function FileThumbnail({
  item,
  supabase,
  getFileIcon,
  renderOcrStatusBadge,
}: FileThumbnailProps) {
  const storagePath = item.storagePath;
  // Check blob cache first, then signed URL cache
  const initialUrl = storagePath
    ? (getCachedBlobUrl(storagePath) ?? getCachedSignedUrl(storagePath))
    : null;
  const [thumbUrl, setThumbUrl] = useState<string | null>(initialUrl);

  useEffect(() => {
    if (!storagePath || !item.mimetype?.startsWith('image/')) {
      setThumbUrl(null);
      return;
    }

    // Check blob cache first (instant, no network)
    const cachedBlob = getCachedBlobUrl(storagePath);
    if (cachedBlob) {
      setThumbUrl(cachedBlob);
      return;
    }

    // Check signed URL cache
    const cachedSignedUrl = getCachedSignedUrl(storagePath);
    if (cachedSignedUrl) {
      setThumbUrl(cachedSignedUrl);
      // Preload to blob cache in background
      preloadAndCacheFile(cachedSignedUrl, storagePath).then((blobUrl) => {
        setThumbUrl(blobUrl);
      });
      return;
    }

    let isMounted = true;

    (async () => {
      const { data, error } = await supabase.storage
        .from('obra-documents')
        .createSignedUrl(storagePath, 3600); // 1 hour
      if (!isMounted || error || !data?.signedUrl) return;
      setCachedSignedUrl(storagePath, data.signedUrl);
      // Set signed URL first for immediate display
      setThumbUrl(data.signedUrl);
      // Then preload to blob cache
      const blobUrl = await preloadAndCacheFile(data.signedUrl, storagePath);
      if (isMounted) {
        setThumbUrl(blobUrl);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [item.mimetype, storagePath, supabase]);

  if (thumbUrl) {
    return (
      <div className="relative w-full h-full">
        <img
          src={thumbUrl}
          alt={item.name}
          className="w-full h-full object-cover rounded-none"
          loading="lazy"
        />
        <div className="absolute top-2 right-2">
          {renderOcrStatusBadge(item)}
        </div>
        <span
          className="text-sm text-center truncate w-full text-stone-700 absolute bottom-0 left-0 right-0 px-2 py-1 bg-stone-200/50 backdrop-blur-sm"
          title={item.name}
        >
          {item.name}
        </span>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full text-primary p-2">
      {getFileIcon(item.mimetype)}
      <div className="absolute top-2 right-2">
        {renderOcrStatusBadge(item)}
      </div>
    </div>
  );
});

export function FileManager({
  obraId,
  materialOrders = [],
  onRefreshMaterials,
  selectedFolderPath = null,
  selectedFilePath = null,
  onSelectionChange,
}: FileManagerProps) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [usageInfo, setUsageInfo] = useState<TenantUsageInfo | null>(null);
  const usageInfoRef = useRef<TenantUsageInfo | null>(null);
  const mapUsagePayload = useCallback((payload: any): TenantUsageInfo | null => {
    if (!payload?.plan || !payload?.usage) {
      return null;
    }
    const limits = payload.plan.limits ?? {};
    const usage = payload.usage ?? {};
    return {
      plan: {
        key: payload.plan.key ?? 'plan',
        name: payload.plan.name ?? 'Plan',
        limits: {
          storageBytes:
            typeof limits.storageBytes === 'number' ? limits.storageBytes : null,
          aiTokens: typeof limits.aiTokens === 'number' ? limits.aiTokens : null,
          whatsappMessages:
            typeof limits.whatsappMessages === 'number'
              ? limits.whatsappMessages
              : null,
        },
      },
      usage: {
        storageBytes: Number(usage.storageBytes ?? 0),
        aiTokens: Number(usage.aiTokens ?? 0),
        whatsappMessages: Number(usage.whatsappMessages ?? 0),
        periodStart: usage.periodStart ?? '',
        periodEnd: usage.periodEnd ?? '',
      },
    };
  }, []);

  const fetchUsageInfo = useCallback(async () => {
    try {
      const response = await fetch('/api/tenant-usage', { cache: 'no-store' });
      if (!response.ok) return null;
      const payload = await response.json();
      const mapped = mapUsagePayload(payload);
      if (mapped) {
        setUsageInfo(mapped);
        usageInfoRef.current = mapped;
      }
      return mapped;
    } catch (error) {
      console.error('[file-manager] Failed to load tenant usage', error);
      return null;
    }
  }, [mapUsagePayload]);

  const applyUsageDelta = useCallback(
    async (
      delta: UsageDelta,
      options?: { reason?: string; metadata?: Record<string, unknown> }
    ) => {
      const storageDelta = Math.trunc(delta.storageBytes ?? 0);
      const aiDelta = Math.trunc(delta.aiTokens ?? 0);
      const whatsappDelta = Math.trunc(delta.whatsappMessages ?? 0);
      if (storageDelta === 0 && aiDelta === 0 && whatsappDelta === 0) {
        return;
      }
      try {
        const response = await fetch('/api/tenant-usage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            storageBytesDelta: storageDelta,
            aiTokensDelta: aiDelta,
            whatsappMessagesDelta: whatsappDelta,
            reason: options?.reason,
            metadata: options?.metadata,
          }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          const errorMessage =
            typeof payload?.error === 'string'
              ? payload.error
              : 'No se pudo actualizar el uso del plan.';
          toast.error(errorMessage);
          return;
        }
        const mapped = mapUsagePayload(payload);
        if (mapped) {
          setUsageInfo(mapped);
          usageInfoRef.current = mapped;
        }
      } catch (error) {
        console.error('[file-manager] Failed to persist tenant usage', error);
        toast.error('No se pudo registrar el uso de la organización.');
      }
    },
    [mapUsagePayload]
  );

  const ensureStorageCapacity = useCallback(
    async (bytesNeeded: number) => {
      if (bytesNeeded <= 0) return true;
      let snapshot = usageInfoRef.current;
      if (!snapshot) {
        snapshot = await fetchUsageInfo();
      }
      if (!snapshot) {
        return true;
      }
      const limit = snapshot.plan.limits.storageBytes;
      if (!limit || limit <= 0) {
        return true;
      }
      const remaining = limit - snapshot.usage.storageBytes;
      if (bytesNeeded <= remaining) {
        return true;
      }
      toast.error(
        `Superás tu límite de almacenamiento (${formatReadableBytes(
          limit
        )}). Eliminá archivos o actualizá tu plan.`
      );
      return false;
    },
    [fetchUsageInfo]
  );

  useEffect(() => {
    usageInfoRef.current = usageInfo;
  }, [usageInfo]);

  useEffect(() => {
    void fetchUsageInfo();
  }, [fetchUsageInfo]);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsKey = searchParams?.toString() ?? '';

  // State - using global store for persistence across tab switches
  const { state: documentsState, actions: documentsActions } = useDocumentsStore();
  const { fileTree, selectedFolder, selectedDocument, sheetDocument, expandedFolderIds, isLoading: isStoreLoading, lastFetchedAt } = documentsState;
  const expandedFolders = expandedFolderIds;
  const { setFileTree, setSelectedFolder, setSelectedDocument, setSheetDocument, setExpandedFolderIds, resetDocumentsStore } = documentsActions;
  const updateExpandedFolders = useCallback(
    (updater: (prev: Set<string>) => Set<string>) => {
      setExpandedFolderIds(updater(new Set(expandedFolderIds)));
    },
    [expandedFolderIds, setExpandedFolderIds]
  );
  const documentsByStoragePath = useMemo(() => {
    const map = new Map<string, FileSystemItem>();
    const walk = (node: FileSystemItem | null) => {
      if (!node) return;
      if (node.type === 'file' && node.storagePath) {
        map.set(node.storagePath, node);
      }
      node.children?.forEach(child => walk(child));
    };
    walk(fileTree);
    return map;
  }, [fileTree]);
  // Separate sheet open state and displayed document ref to prevent flicker on close
  const [isDocumentSheetOpen, setIsDocumentSheetOpen] = useState(false);
  const displayedDocumentRef = useRef<FileSystemItem | null>(null);
  const suppressSelectionOnCloseRef = useRef(false);
  const sheetCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  // Loading state is derived from global store + local refreshing state
  const [isRefreshing, setIsRefreshing] = useState(false);
  const loading = isStoreLoading || (needsRefetch(obraId) && !fileTree);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [isAddRowDialogOpen, setIsAddRowDialogOpen] = useState(false);
  const [createFolderParent, setCreateFolderParent] = useState<FileSystemItem | null>(null);
  const [convertFolderTarget, setConvertFolderTarget] = useState<FileSystemItem | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [createFolderError, setCreateFolderError] = useState<string | null>(null);
  const [createFolderMode, setCreateFolderMode] = useState<'normal' | 'data' | null>(null);
  const [newFolderDataInputMethod, setNewFolderDataInputMethod] = useState<DataInputMethod>('both');
  const [newFolderOcrTemplateId, setNewFolderOcrTemplateId] = useState<string>('');
  const [newFolderSpreadsheetTemplate, setNewFolderSpreadsheetTemplate] = useState<'' | 'auto' | 'certificado'>('');
  const [newFolderDescription, setNewFolderDescription] = useState('');
  const [newFolderHasNested, setNewFolderHasNested] = useState(false);
  const [ocrTemplates, setOcrTemplates] = useState<OcrTemplateOption[]>([]);
  const [isLoadingOcrTemplates, setIsLoadingOcrTemplates] = useState(false);
  const [newFolderColumns, setNewFolderColumns] = useState<OcrDraftColumn[]>([
    {
      id: crypto.randomUUID(),
      label: 'Columna 1',
      fieldKey: 'columna_1',
      dataType: 'text',
      required: false,
      scope: 'item',
    },
  ]);
  const [isSchemaDialogOpen, setIsSchemaDialogOpen] = useState(false);
  const [isSavingSchema, setIsSavingSchema] = useState(false);
  const [schemaDraftColumns, setSchemaDraftColumns] = useState<TablaSchemaDraftColumn[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: FileSystemItem } | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<FileSystemItem | null>(null);
  const [draggedFolderId, setDraggedFolderId] = useState<string | null>(null);
  const [currentUploadFolder, setCurrentUploadFolder] = useState<FileSystemItem | null>(null);
  // ocrFolderLinks now comes from the global store (documentsState)
  const ocrFolderLinks = documentsState.ocrFolderLinks;
  const { setOcrFolderLinks } = documentsActions;
  const [isGlobalFileDragActive, setIsGlobalFileDragActive] = useState(false);
  const [isTemplateConfiguratorOpen, setIsTemplateConfiguratorOpen] = useState(false);
  const [retryingDocumentId, setRetryingDocumentId] = useState<string | null>(null);
  const [isSpreadsheetPreviewOpen, setIsSpreadsheetPreviewOpen] = useState(false);
  const [isLoadingSpreadsheetPreview, setIsLoadingSpreadsheetPreview] = useState(false);
  const [isApplyingSpreadsheetPreview, setIsApplyingSpreadsheetPreview] = useState(false);
  const [spreadsheetPreviewPayload, setSpreadsheetPreviewPayload] = useState<SpreadsheetPreviewPayload | null>(null);
  const spreadsheetPreviewResolverRef = useRef<((confirmed: boolean) => void) | null>(null);
  const rateLimitUntilRef = useRef<number>(0);

  useEffect(() => {
    if (!obraId) return;
    resetDocumentsStore(obraId);
  }, [obraId, resetDocumentsStore]);

  const ocrFolderLinksMap = useMemo(() => {
    const map = new Map<string, OcrFolderLink[]>();
    ocrFolderLinks.forEach((link) => {
      const normalizedPath = normalizeFolderPath(link.folderName);
      if (normalizedPath) {
        const existing = map.get(normalizedPath) ?? [];
        existing.push(link);
        map.set(normalizedPath, existing);
      }
      const normalizedFlat = normalizeFolderName(link.folderName);
      if (normalizedFlat && normalizedFlat !== normalizedPath) {
        const existing = map.get(normalizedFlat) ?? [];
        existing.push(link);
        map.set(normalizedFlat, existing);
      }
    });
    return map;
  }, [ocrFolderLinks]);

  const ocrFolderMap = useMemo(() => {
    const map = new Map<string, OcrFolderLink>();
    ocrFolderLinksMap.forEach((links, key) => {
      if (links.length > 0) {
        map.set(key, links[0]);
      }
    });
    return map;
  }, [ocrFolderLinksMap]);

  const ocrTablaMap = useMemo(() => {
    const map = new Map<string, OcrFolderLink>();
    ocrFolderLinks.forEach((link) => map.set(link.tablaId, link));
    return map;
  }, [ocrFolderLinks]);

  const resolveOcrLinksForDocument = useCallback(
    (doc: FileSystemItem | null) => {
      if (!doc?.storagePath) return [] as OcrFolderLink[];
      if (doc.ocrFolderName) {
        const normalized = normalizeFolderPath(doc.ocrFolderName);
        const direct = ocrFolderLinksMap.get(normalized) ?? ocrFolderLinksMap.get(normalizeFolderName(normalized));
        if (direct && direct.length > 0) return direct;
      }
      const segments = doc.storagePath.split('/').filter(Boolean);
      if (segments.length < 3) return [] as OcrFolderLink[];
      const relativePath = normalizeFolderPath(segments.slice(1, -1).join('/'));
      let cursor = relativePath;
      while (cursor) {
        const links = ocrFolderLinksMap.get(cursor) ?? ocrFolderLinksMap.get(normalizeFolderName(cursor));
        if (links && links.length > 0) return links;
        cursor = getParentFolderPath(cursor);
      }
      return [] as OcrFolderLink[];
    },
    [ocrFolderLinksMap]
  );

  // Table search state for OCR folders
  const [tableSearchQuery, setTableSearchQuery] = useState('');
  const [sourceFileModal, setSourceFileModal] = useState<FileSystemItem | null>(null);
  const [documentViewMode, setDocumentViewMode] = useState<'cards' | 'table'>('table');
  const [ocrDocumentFilterPath, setOcrDocumentFilterPath] = useState<string | null>(null);
  const [ocrDocumentFilterName, setOcrDocumentFilterName] = useState<string | null>(null);
  const [ocrDataViewMode, setOcrDataViewMode] = useState<'cards' | 'table'>('cards');
  const [ocrViewMode, setOcrViewMode] = useState<'table' | 'documents'>('table');
  const [activeOcrTablaIdOverride, setActiveOcrTablaIdOverride] = useState<string | null>(null);
  const [activeDocumentTablaIdOverride, setActiveDocumentTablaIdOverride] = useState<string | null>(null);
  const ITEMS_PER_PAGE = 24;
  const [folderPage, setFolderPage] = useState(1);

  const resetNewFolderForm = useCallback(() => {
    setNewFolderName('');
    setCreateFolderError(null);
    setNewFolderDataInputMethod('both');
    setNewFolderOcrTemplateId('');
    setNewFolderSpreadsheetTemplate('');
    setNewFolderDescription('');
    setNewFolderHasNested(false);
    setNewFolderColumns([
      {
        id: crypto.randomUUID(),
        label: 'Columna 1',
        fieldKey: 'columna_1',
        dataType: 'text',
        required: false,
        scope: 'item',
      },
    ]);
    setCreateFolderMode(null);
    setCreateFolderParent(null);
    setConvertFolderTarget(null);
  }, []);

  const previewRequestIdRef = useRef(0);
  const lastBootstrapObraIdRef = useRef<string | null>(null);
  const isUploadingOcrFolder = uploadingFiles && Boolean(currentUploadFolder?.ocrEnabled);
  const parentMapRef = useRef<Map<string, FileSystemItem | null>>(new Map());
  const pendingFolderPathRef = useRef<string | null>(null);
  const pendingFilePathRef = useRef<string | null>(null);
  const skipFilePathSyncRef = useRef(false);
  const lastOcrFolderIdRef = useRef<string | null>(null);

  const sanitizePath = useCallback((path: string | null | undefined) => {
    if (!path) return [] as string[];
    return path
      .split('/')
      .map(segment => segment.trim())
      .filter(Boolean);
  }, []);

  const sanitizeStorageFileName = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return `archivo-${Date.now()}`;
    const dotIndex = trimmed.lastIndexOf('.');
    const base = dotIndex > 0 ? trimmed.slice(0, dotIndex) : trimmed;
    const ext = dotIndex > 0 ? trimmed.slice(dotIndex + 1) : '';
    const safeBase = base
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
    const fallbackBase = safeBase || `archivo-${Date.now()}`;
    const safeExt = ext
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toLowerCase();
    return safeExt ? `${fallbackBase}.${safeExt}` : fallbackBase;
  }, []);

  const folderPathSegments = useMemo(() => sanitizePath(selectedFolderPath), [selectedFolderPath, sanitizePath]);
  const filePathSegments = useMemo(() => sanitizePath(selectedFilePath), [selectedFilePath, sanitizePath]);
  const folderPathKey = useMemo(() => folderPathSegments.join('/'), [folderPathSegments]);
  const filePathKey = useMemo(() => filePathSegments.join('/'), [filePathSegments]);

  const rebuildParentMap = useCallback((tree: FileSystemItem | null) => {
    const nextMap = new Map<string, FileSystemItem | null>();
    const walk = (node: FileSystemItem | null, parent: FileSystemItem | null) => {
      if (!node) return;
      nextMap.set(node.id, parent);
      node.children?.forEach(child => walk(child, node));
    };
    walk(tree, null);
    parentMapRef.current = nextMap;
  }, []);

  const hydrateTreeWithOcrData = useCallback((tree: FileSystemItem | null) => {
    if (!tree) return;
    const stack: FileSystemItem[] = [tree];
    while (stack.length > 0) {
      const node = stack.pop();
      if (!node || node.type !== 'folder') continue;
      const folderKey = normalizeFolderPath((node.relativePath as string | undefined) ?? node.ocrFolderName ?? node.name);
      const link =
        ocrFolderMap.get(folderKey) ||
        ocrFolderMap.get(normalizeFolderName(folderKey));
      if (link) {
        node.ocrEnabled = true;
        node.ocrTablaId = link.tablaId;
        node.ocrTablaName = link.tablaName;
        node.ocrFolderName = link.folderName ?? folderKey;
        node.ocrTablaColumns = link.columns;
        node.ocrTablaRows = link.rows;
        node.extractedData = link.orders;
        node.dataInputMethod = link.dataInputMethod;
      }
      node.children?.forEach(child => stack.push(child));
    }
  }, [ocrFolderMap]);

  const ensureAncestorsExpanded = useCallback((item?: FileSystemItem | null) => {
    if (!item) return;
    updateExpandedFolders(prev => {
      const next = new Set(prev);
      let current: FileSystemItem | null | undefined = item;
      while (current) {
        if (current.type === 'folder') {
          next.add(current.id);
        }
        current = parentMapRef.current.get(current.id) ?? null;
      }
      return next;
    });
  }, []);

  const getPathSegments = useCallback((item: FileSystemItem | null | undefined) => {
    if (!item) return [] as string[];
    const segments: string[] = [];
    let current: FileSystemItem | null | undefined = item;
    while (current && current.id !== 'root') {
      if (current.type === 'folder') {
        if (typeof current.relativePath === 'string' && current.relativePath.trim().length > 0) {
          const segmentFromPath = current.relativePath.split('/').filter(Boolean).pop() ?? '';
          segments.push(segmentFromPath);
        } else {
          segments.push(normalizeFolderName(current.name));
        }
      } else {
        segments.push(current.name);
      }
      current = parentMapRef.current.get(current.id) ?? null;
    }
    return segments.reverse();
  }, []);

  const hasOcrAncestor = useCallback((item: FileSystemItem | null | undefined) => {
    let current: FileSystemItem | null | undefined = item;
    while (current) {
      if (current.ocrEnabled) return true;
      current = parentMapRef.current.get(current.id) ?? null;
    }
    return false;
  }, []);

  const containsFiles = (dataTransfer?: DataTransfer | null) => {
    if (!dataTransfer) return false;
    if (dataTransfer.files && dataTransfer.files.length > 0) return true;
    if (dataTransfer.types && Array.from(dataTransfer.types).includes('Files')) return true;
    if (dataTransfer.items) {
      return Array.from(dataTransfer.items).some(item => item.kind === 'file');
    }
    return false;
  };

  const renderOcrStatusBadge = useCallback((item: FileSystemItem) => {
    if (item.type !== 'file' || !item.ocrDocumentStatus) return null;
    const baseClass =
      'px-1.5 py-0.5 text-[10px] font-semibold rounded-full border flex items-center gap-1';
    switch (item.ocrDocumentStatus) {
      case 'completed':
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={cn(baseClass, 'bg-green-100 text-green-700 border-green-500/30')}>
                <CheckCircle2 className="w-3 h-3" />
              </span>
            </TooltipTrigger>
            <TooltipContent>Extracción completa</TooltipContent>
          </Tooltip>
        );
      case 'failed':
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={`${baseClass} bg-red-500/15 text-red-700 border-red-500/30`}>
                <AlertCircle className="w-3 h-3" />
              </span>
            </TooltipTrigger>
            <TooltipContent>Error en extracción</TooltipContent>
          </Tooltip>
        );
      case 'processing':
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={`${baseClass} bg-blue-500/15 text-blue-700 border-blue-500/30`}>
                <Loader2 className="w-3 h-3 animate-spin" />
              </span>
            </TooltipTrigger>
            <TooltipContent>Procesando extracción</TooltipContent>
          </Tooltip>
        );
      case 'pending':
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={`${baseClass} bg-amber-500/15 text-amber-700 border-amber-500/30`}>
                <Clock className="w-3 h-3" />
              </span>
            </TooltipTrigger>
            <TooltipContent>Pendiente de extracción</TooltipContent>
          </Tooltip>
        );
      case 'unprocessed':
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={`${baseClass} bg-stone-200 text-stone-700 border-stone-300`}>
                <XIcon className="w-3 h-3" />
              </span>
            </TooltipTrigger>
            <TooltipContent>Sin extracción</TooltipContent>
          </Tooltip>
        );
      default:
        return null;
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const fetchTemplates = async () => {
      try {
        setIsLoadingOcrTemplates(true);
        const res = await fetch('/api/ocr-templates');
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || 'No se pudieron cargar las plantillas OCR');
        }
        const data = await res.json();
        if (isMounted) {
          setOcrTemplates(data?.templates ?? []);
        }
      } catch (error) {
        console.error('Error fetching OCR templates:', error);
      } finally {
        if (isMounted) {
          setIsLoadingOcrTemplates(false);
        }
      }
    };

    void fetchTemplates();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleNewFolderTemplateSelect = useCallback(
    (templateId: string | null) => {
      setNewFolderOcrTemplateId(templateId ?? '');
      if (!templateId) {
        return;
      }
      const template = ocrTemplates.find((tpl) => tpl.id === templateId);
      if (!template) return;

      const mappedColumns: OcrDraftColumn[] = template.columns.map((col, index) => {
        const normalizedKey = col.fieldKey && col.fieldKey.trim()
          ? normalizeFieldKey(col.fieldKey)
          : normalizeFieldKey(col.label || `columna_${index + 1}`);
        const normalizedType = TABLA_DATA_TYPES.includes(col.dataType as TablaColumnDataType)
          ? (col.dataType as TablaColumnDataType)
          : 'text';
        return {
          id: crypto.randomUUID(),
          label: col.label || `Columna ${index + 1}`,
          fieldKey: normalizedKey,
          dataType: normalizedType,
          required: false,
          scope: col.ocrScope === 'parent' ? 'parent' : 'item',
          description: col.description,
        };
      });
      const hasParent = mappedColumns.some((col) => col.scope === 'parent');
      const hasItem = mappedColumns.some((col) => col.scope !== 'parent');
      setNewFolderHasNested(hasParent && hasItem);
      setNewFolderColumns(
        mappedColumns.length > 0
          ? mappedColumns
          : [{
            id: crypto.randomUUID(),
            label: 'Columna 1',
            fieldKey: 'columna_1',
            dataType: 'text',
            required: false,
            scope: 'item',
          }]
      );
      if (!newFolderName.trim()) {
        setNewFolderName(template.name);
      }
    },
    [newFolderName, ocrTemplates]
  );

  const handleOcrTemplateCreated = useCallback((template: OcrTemplateOption) => {
    setOcrTemplates((prev) => [template, ...prev]);
    handleNewFolderTemplateSelect(template.id);
    setIsTemplateConfiguratorOpen(false);
  }, [handleNewFolderTemplateSelect]);

  const handleTemplateConfiguratorCreated = useCallback(
    (template: { id: string; name: string; description: string | null; columns: Array<{ fieldKey: string; label: string; dataType: string; ocrScope?: string; description?: string }> }) => {
      handleOcrTemplateCreated({
        id: template.id,
        name: template.name,
        description: template.description,
        columns: template.columns,
      });
    },
    [handleOcrTemplateCreated]
  );

  useEffect(() => {
    if (createFolderMode !== 'data') return;
    if (newFolderHasNested) return;
    setNewFolderColumns((prev) =>
      prev.map((column) =>
        column.scope === 'parent' ? { ...column, scope: 'item' } : column
      )
    );
  }, [createFolderMode, newFolderHasNested]);

  const handleNavigateToTabla = useCallback(
    (tablaId?: string | null) => {
      if (!tablaId || !pathname) return;
      const params = new URLSearchParams(searchParamsKey);
      params.set('tab', 'tablas');
      params.set('tablaId', tablaId);
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParamsKey]
  );

  const mapTablaRowsToOrders = useCallback((rows: any[], tablaId: string): MaterialOrder[] => {
    const groups = new Map<string, MaterialOrder>();
    rows.forEach((row: any) => {
      const data = (row?.data as Record<string, unknown>) ?? {};
      const fallbackId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${tablaId}-${Date.now()}`;
      const rawKey = typeof data.nroOrden === 'string' && data.nroOrden.trim().length > 0
        ? data.nroOrden.trim()
        : String(row?.id ?? fallbackId);
      if (!groups.has(rawKey)) {
        const docBucketValue = data && typeof (data as any).__docBucket === 'string' ? (data as any).__docBucket : undefined;
        const docPathValue = data && typeof (data as any).__docPath === 'string' ? (data as any).__docPath : undefined;
        groups.set(rawKey, {
          id: `${tablaId}-${rawKey}`,
          nroOrden: typeof data.nroOrden === 'string' && data.nroOrden.trim().length > 0 ? data.nroOrden.trim() : 'Sin número',
          solicitante: typeof data.solicitante === 'string' ? data.solicitante : '',
          gestor: typeof data.gestor === 'string' ? data.gestor : '',
          proveedor: typeof data.proveedor === 'string' ? data.proveedor : '',
          items: [],
          docBucket: docBucketValue || (docPathValue ? 'obra-documents' : undefined),
          docPath: docPathValue,
        });
      }
      const order = groups.get(rawKey)!;
      order.items.push({
        id: String(row?.id ?? `${rawKey}-${order.items.length}`),
        cantidad: Number((data as any).cantidad ?? 0) || 0,
        unidad: typeof (data as any).unidad === 'string' ? (data as any).unidad : '',
        material: typeof (data as any).material === 'string' ? (data as any).material : '',
        precioUnitario: Number((data as any).precioUnitario ?? 0) || 0,
      });
    });
    return Array.from(groups.values());
  }, []);

  const findDocumentInTreeByStoragePath = useCallback((tree: FileSystemItem | null, storagePath: string) => {
    if (!tree) return null;
    const stack: FileSystemItem[] = [tree];
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (current.type === 'file' && current.storagePath === storagePath) {
        return current;
      }
      if (current.children) {
        stack.push(...current.children);
      }
    }
    return null;
  }, []);

  const findFolderInTreeBySegments = useCallback((tree: FileSystemItem | null, segments: string[]) => {
    if (!tree) return null;
    if (segments.length === 0) return tree;
    let current: FileSystemItem | null = tree;
    for (const segment of segments) {
      const nextFolder: FileSystemItem | undefined = current?.children?.find(
        (child) => child.type === 'folder' && child.name === segment
      );
      if (!nextFolder) {
        return current;
      }
      current = nextFolder;
    }
    return current;
  }, []);

  const collectExpandableFolderIds = useCallback((tree: FileSystemItem | null) => {
    const ids = new Set<string>();
    const walk = (node: FileSystemItem | null) => {
      if (!node) return;
      if (node.type === 'folder') {
        ids.add(node.id);
      }
      node.children?.forEach((child) => walk(child));
    };
    walk(tree);
    return ids;
  }, []);

  const refreshOcrFolderLinks = useCallback(async (options: { skipCache?: boolean } = {}) => {
    if (!obraId) return;
    if (Date.now() < rateLimitUntilRef.current) return;

    // Check cache first (unless skipCache is true)
    if (!options.skipCache) {
      const cachedLinks = getCachedOcrLinks(obraId);
      if (cachedLinks) {
        const cacheHasSchema = cachedLinks.every(
          (link) => Array.isArray(link.columns) && Array.isArray(link.rows)
        );
        if (!cacheHasSchema) {
          clearCachesForObra(obraId);
        } else {
          setOcrFolderLinks(cachedLinks);
          return;
        }
      }
    }

    try {
      const res = await fetch(`/api/obras/${obraId}/documents-tree?limit=500`, { cache: 'no-store' });
      if (res.status === 429) {
        rateLimitUntilRef.current = Date.now() + 30_000;
        markDocumentsFetched();
        return;
      }
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || 'No se pudieron obtener las tablas OCR');
      }
      const payload = await res.json();
      const links = Array.isArray(payload?.links) ? payload.links : [];
      const tree = payload?.tree ?? null;
      if (tree) {
        rebuildParentMap(tree);
        setCachedFileTree(obraId, tree);
        setFileTree(tree);
        if (selectedFolder) {
          const selectedSegments = getPathSegments(selectedFolder);
          const resolvedFolder = findFolderInTreeBySegments(tree, selectedSegments);
          if (resolvedFolder) {
            setSelectedFolder(resolvedFolder);
          }
        }
        const currentDocPath = (sheetDocument ?? selectedDocument)?.storagePath;
        if (currentDocPath) {
          const updatedDoc = findDocumentInTreeByStoragePath(tree, currentDocPath);
          if (updatedDoc) {
            if (selectedDocument) setSelectedDocument(updatedDoc);
            if (sheetDocument) setSheetDocument(updatedDoc);
          }
        }
      }
      setCachedOcrLinks(obraId, links);
      setOcrFolderLinks(links);
    } catch (error) {
      console.error('Error refreshing OCR folder links', error);
    }
  }, [findDocumentInTreeByStoragePath, findFolderInTreeBySegments, getPathSegments, obraId, rebuildParentMap, selectedDocument, selectedFolder, setSelectedFolder, sheetDocument]);

  // Build file tree from storage
  const buildFileTree = useCallback(async (options: { skipCache?: boolean } = {}) => {
    if (Date.now() < rateLimitUntilRef.current) return;
    if (!options.skipCache) {
      const cachedTree = getCachedFileTree(obraId);
      if (cachedTree) {
        rebuildParentMap(cachedTree);
        setFileTree(cachedTree);
        if (!selectedFolder) {
          setSelectedFolder(cachedTree);
        }
        setExpandedFolderIds(collectExpandableFolderIds(cachedTree));
        markDocumentsFetched();
        return;
      }
    }

    setDocumentsLoading(true);
    try {
      const res = await fetch(`/api/obras/${obraId}/documents-tree?limit=500`, { cache: 'no-store' });
      if (res.status === 429) {
        rateLimitUntilRef.current = Date.now() + 30_000;
        markDocumentsFetched();
        return;
      }
      if (!res.ok) throw new Error('documents-tree');
      const payload = await res.json();
      const tree = payload?.tree ?? null;
      const links = Array.isArray(payload?.links) ? payload.links : [];
      if (tree) {
        rebuildParentMap(tree);
        setCachedFileTree(obraId, tree);
        setFileTree(tree);
        if (!selectedFolder) {
          setSelectedFolder(tree);
        }
        if (selectedFolder) {
          const selectedSegments = getPathSegments(selectedFolder);
          const resolvedFolder = findFolderInTreeBySegments(tree, selectedSegments);
          if (resolvedFolder) {
            setSelectedFolder(resolvedFolder);
          }
        }
        const currentDocPath = (sheetDocument ?? selectedDocument)?.storagePath;
        if (currentDocPath) {
          const updatedDoc = findDocumentInTreeByStoragePath(tree, currentDocPath);
          if (updatedDoc) {
            if (selectedDocument) setSelectedDocument(updatedDoc);
            if (sheetDocument) setSheetDocument(updatedDoc);
          }
        }
        setExpandedFolderIds(collectExpandableFolderIds(tree));
      }
      setCachedOcrLinks(obraId, links);
      setOcrFolderLinks(links);
    } catch (error) {
      console.error('Error building file tree:', error);
      Sentry.captureException(error, {
        tags: { feature: 'file-manager' },
        extra: { obraId, materialOrdersCount: materialOrders.length },
      });
      toast.error('Error loading documents');
    } finally {
      markDocumentsFetched();
    }
  }, [collectExpandableFolderIds, findDocumentInTreeByStoragePath, findFolderInTreeBySegments, getPathSegments, obraId, rebuildParentMap, selectedDocument, selectedFolder, setExpandedFolderIds, setFileTree, setOcrFolderLinks, setSelectedDocument, setSelectedFolder, setSheetDocument, sheetDocument]);

  useEffect(() => {
    if (!obraId) return;
    const shouldRefetchTree = needsRefetch(obraId) || !fileTree;
    const shouldRefetchOcr = ocrFolderLinks.length === 0;

    // Skip if everything is already fresh
    if (!shouldRefetchTree && !shouldRefetchOcr) {
      lastBootstrapObraIdRef.current = obraId;
      return;
    }
    if (lastBootstrapObraIdRef.current === obraId && !shouldRefetchTree && !shouldRefetchOcr) {
      return;
    }
    lastBootstrapObraIdRef.current = obraId;

    const bootstrap = async () => {
      try {
        // Build once: this endpoint already returns tree + OCR links.
        if (shouldRefetchTree || shouldRefetchOcr) {
          await buildFileTree({ skipCache: true });
        }
      } catch (error) {
        console.error('Error initializing documents data', error);
      }
    };

    void bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obraId, fileTree, ocrFolderLinks.length, buildFileTree]);

  // OCR links are now fetched alongside the tree; no separate re-hydration loop needed.

  useEffect(() => {
    if (!selectedFolder?.ocrEnabled) {
      setDocumentViewMode('cards');
      setOcrDataViewMode('cards');
      setOcrViewMode('table');
      lastOcrFolderIdRef.current = null;
      return;
    }
    if (lastOcrFolderIdRef.current !== selectedFolder.id) {
      // For data folders, show the table view by default (ocrViewMode: 'documents' enables the data table)
      setOcrViewMode('documents');
      setDocumentViewMode('table');
      lastOcrFolderIdRef.current = selectedFolder.id;
    }
  }, [selectedFolder]);

  useEffect(() => {
    setActiveOcrTablaIdOverride(null);
  }, [selectedFolder?.id]);

  useEffect(() => {
    if (ocrViewMode === 'documents') {
      setDocumentViewMode('table');
    } else {
      setOcrDataViewMode('cards');
    }
  }, [ocrViewMode]);

  const findFolderBySegments = useCallback((segments: string[]) => {
    if (!fileTree) return null;
    if (segments.length === 0) return fileTree;
    let current: FileSystemItem | null = fileTree;
    for (const segment of segments) {
      const next: FileSystemItem | undefined = current?.children?.find(child => child.type === 'folder' && child.name === segment);
      if (!next) return null;
      current = next;
    }
    return current;
  }, [fileTree]);

  const findDocumentBySegments = useCallback((segments: string[]) => {
    if (!fileTree || segments.length === 0) return null;
    const fileName = segments[segments.length - 1];
    const folderSegments = segments.slice(0, -1);
    const parentFolder = folderSegments.length > 0 ? findFolderBySegments(folderSegments) : fileTree;
    if (!parentFolder) return null;
    return parentFolder.children?.find(child => child.type === 'file' && child.name === fileName) || null;
  }, [fileTree, findFolderBySegments]);

  const findDocumentByStoragePath = useCallback((storagePath?: string | null) => {
    if (!storagePath) return null;
    return documentsByStoragePath.get(storagePath) ?? null;
  }, [documentsByStoragePath]);

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [contextMenu]);

  const toggleFolder = (folderId: string) => {
    updateExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const clearOcrDocumentFilter = useCallback(() => {
    setOcrDocumentFilterPath(null);
    setOcrDocumentFilterName(null);
  }, []);

  const openDocumentPreviewModal = useCallback(async (doc: FileSystemItem) => {
    if (doc.storagePath && !doc.apsUrn) {
      const cachedBlob = getCachedBlobUrl(doc.storagePath);
      if (cachedBlob) {
        setPreviewUrl(cachedBlob);
      } else {
        const cachedSignedUrl = getCachedSignedUrl(doc.storagePath);
        if (cachedSignedUrl) {
          setPreviewUrl(cachedSignedUrl);
          preloadAndCacheFile(cachedSignedUrl, doc.storagePath).then(setPreviewUrl);
        } else {
          const { data } = await supabase.storage
            .from('obra-documents')
            .createSignedUrl(doc.storagePath, 3600);
          if (data?.signedUrl) {
            setCachedSignedUrl(doc.storagePath, data.signedUrl);
            setPreviewUrl(data.signedUrl);
            preloadAndCacheFile(data.signedUrl, doc.storagePath).then(setPreviewUrl);
          }
        }
      }
    }
    setSourceFileModal(doc);
  }, [supabase]);

  const handleFilterRowsByDocument = useCallback((docPath?: string | null, docName?: string | null) => {
    if (!docPath) {
      toast.error('No encontramos la ruta del documento para filtrar');
      return;
    }
    setOcrDocumentFilterPath(docPath);
    setOcrDocumentFilterName(docName ?? null);
  }, []);

  const handleFolderClick = useCallback((folder: FileSystemItem, options: SelectionChangeOptions = {}) => {
    setSelectedFolder(folder);
    setSelectedDocument(null);
    setSheetDocument(null);
    setPreviewUrl(null);
    if (folder.id !== selectedFolder?.id) {
      clearOcrDocumentFilter();
    }
    ensureAncestorsExpanded(folder);

    if (options.emitSelection === false) {
      return;
    }
    const folderPath = getPathSegments(folder);
    pendingFolderPathRef.current = folderPath.join('/');
    onSelectionChange?.({
      folder,
      folderPath,
      document: null,
      documentPath: [],
    });
  }, [clearOcrDocumentFilter, ensureAncestorsExpanded, getPathSegments, onSelectionChange, selectedFolder?.id]);

  const handleDocumentClick = useCallback(async (document: FileSystemItem, parentFolder?: FileSystemItem, options: SelectionChangeOptions = {}) => {
    setSelectedDocument(document);
    setSheetDocument(document);
    const requestId = ++previewRequestIdRef.current;

    // this is for ap
    const resolvedParent = parentFolder ?? parentMapRef.current.get(document.id) ?? null;
    if (resolvedParent && resolvedParent.type === 'folder') {
      setSelectedFolder(resolvedParent);
      ensureAncestorsExpanded(resolvedParent);
    }

    if (options.emitSelection !== false) {
      //this is adding the folder and its not needed, just the document
      //const folderPath = resolvedParent ? getPathSegments(resolvedParent) : [];
      const folderPath = resolvedParent ? getPathSegments(resolvedParent) : [];
      const documentPath = [...folderPath, document.name];
      // pendingFolderPathRef.current = folderPath.join('/');
      pendingFilePathRef.current = documentPath.join('/');
      onSelectionChange?.({
        folder: resolvedParent,
        folderPath,
        document,
        documentPath,
      });
    }

    let parentLink: OcrFolderLink | null = null;
    if (resolvedParent?.ocrEnabled) {
      const folderKey = normalizeFolderPath((resolvedParent.relativePath ?? resolvedParent.ocrFolderName ?? resolvedParent.name));
      parentLink = ocrFolderMap.get(folderKey) || ocrFolderMap.get(normalizeFolderName(folderKey)) || null;
    }
    const isOcrTableView =
      resolvedParent?.ocrEnabled &&
      ocrViewMode === 'documents' &&
      documentViewMode === 'table';
    if (options.enforceFilter) {
      if (document.storagePath) {
        setOcrDocumentFilterPath(document.storagePath);
        setOcrDocumentFilterName(document.name);
      }
    } else if (options.preserveFilter !== true) {
      if (isOcrTableView && parentLink && document.storagePath && parentLink.columns.length > 0) {
        setOcrDocumentFilterPath(document.storagePath);
        setOcrDocumentFilterName(document.name);
      } else {
        clearOcrDocumentFilter();
      }
    }

    if (document.apsUrn) {
      setPreviewUrl(null);
      return;
    }

    if (document.storagePath) {
      // Check blob cache first (actual file content)
      const cachedBlobUrl = getCachedBlobUrl(document.storagePath);
      if (cachedBlobUrl) {
        setPreviewUrl(cachedBlobUrl);
        return;
      }

      // Check signed URL cache
      const cachedSignedUrl = getCachedSignedUrl(document.storagePath);
      if (cachedSignedUrl) {
        setPreviewUrl(cachedSignedUrl);
        // Preload to blob cache in background for future use
        preloadAndCacheFile(cachedSignedUrl, document.storagePath).then((blobUrl) => {
          if (previewRequestIdRef.current === requestId && blobUrl !== cachedSignedUrl) {
            setPreviewUrl(blobUrl);
          }
        });
        return;
      }

      setPreviewUrl(null);
      const { data, error } = await supabase.storage
        .from('obra-documents')
        .createSignedUrl(document.storagePath, 3600);

      if (error) {
        console.error('Error creating signed URL:', error);
        toast.error('Error loading document preview');
        return;
      }

      if (data?.signedUrl && previewRequestIdRef.current === requestId) {
        setCachedSignedUrl(document.storagePath, data.signedUrl);
        // Set signed URL immediately, then preload to blob
        setPreviewUrl(data.signedUrl);
        preloadAndCacheFile(data.signedUrl, document.storagePath).then((blobUrl) => {
          if (previewRequestIdRef.current === requestId && blobUrl !== data.signedUrl) {
            setPreviewUrl(blobUrl);
          }
        });
      }
    }
  }, [clearOcrDocumentFilter, ensureAncestorsExpanded, getPathSegments, ocrFolderMap, onSelectionChange, supabase]);

  const handleOpenDocumentSheetByPath = useCallback(
    async (docPath?: string | null) => {
      if (!docPath) {
        toast.error('Esta fila no tiene un documento asociado.');
        return;
      }
      const doc = findDocumentByStoragePath(docPath);
      if (!doc) {
        toast.error('No encontramos el documento origen.');
        return;
      }
      const parent = parentMapRef.current.get(doc.id) ?? undefined;
      suppressSelectionOnCloseRef.current = true;

      // Pre-fetch the signed URL and set previewUrl state BEFORE opening the sheet
      let resolvedPreviewUrl: string | null = null;
      if (doc.storagePath && !doc.apsUrn) {
        const cachedBlobUrl = getCachedBlobUrl(doc.storagePath);
        if (cachedBlobUrl) {
          resolvedPreviewUrl = cachedBlobUrl;
        } else {
          const cachedSignedUrl = getCachedSignedUrl(doc.storagePath);
          if (cachedSignedUrl) {
            resolvedPreviewUrl = cachedSignedUrl;
          } else {
            // Fetch the signed URL
            const { data } = await supabase.storage
              .from('obra-documents')
              .createSignedUrl(doc.storagePath, 3600);
            if (data?.signedUrl) {
              setCachedSignedUrl(doc.storagePath, data.signedUrl);
              resolvedPreviewUrl = data.signedUrl;
            }
          }
        }
      }

      // Set the previewUrl state FIRST
      setPreviewUrl(resolvedPreviewUrl);

      // Skip the file path sync effect to prevent it from clearing previewUrl
      skipFilePathSyncRef.current = true;

      // Then set up the document state and open the sheet
      setSelectedDocument(doc);
      setSheetDocument(doc);
      if (parent && parent.type === 'folder') {
        setSelectedFolder(parent);
        ensureAncestorsExpanded(parent);
      }
      displayedDocumentRef.current = doc;
      setIsDocumentSheetOpen(true);
    },
    [ensureAncestorsExpanded, findDocumentByStoragePath, supabase]
  );

  const handleDocumentViewModeChange = useCallback((mode: 'cards' | 'table') => {
    setOcrViewMode('documents');
    setDocumentViewMode(mode);
    if (mode === 'table') {
      setSelectedDocument(null);
      setSheetDocument(null);
      setPreviewUrl(null);
    }
  }, []);

  const closeDocumentPreview = useCallback(() => {
    const skipSelection = suppressSelectionOnCloseRef.current;
    suppressSelectionOnCloseRef.current = false;
    setSelectedDocument(null);
    setSheetDocument(null);
    setPreviewUrl(null);
    pendingFilePathRef.current = null;

    if (skipSelection) {
      return;
    }

    const folder = selectedFolder && selectedFolder.type === 'folder' ? selectedFolder : null;
    const folderPath = folder ? getPathSegments(folder) : [];
    pendingFilePathRef.current = '__closing__';
    onSelectionChange?.({
      folder,
      folderPath,
      document: null,
      documentPath: [],
    });
  }, [getPathSegments, onSelectionChange, selectedDocument, selectedFolder]);

  const selectedFolderId = selectedFolder?.id;
  const selectedDocumentId = selectedDocument?.id;

  useEffect(() => {
    if (!fileTree) return;
    if (folderPathSegments.length === 0) {
      if (pendingFolderPathRef.current) return;
      if (!selectedFolderId || selectedFolderId !== fileTree.id) {
        handleFolderClick(fileTree, { emitSelection: false });
      }
      return;
    }
    const folderFromPath = findFolderBySegments(folderPathSegments);
    if (folderFromPath && folderFromPath.id !== selectedFolderId) {
      handleFolderClick(folderFromPath, { emitSelection: false });
    }
    if (pendingFolderPathRef.current === folderPathKey) {
      pendingFolderPathRef.current = null;
    }
  }, [fileTree, folderPathKey, folderPathSegments, selectedFolderId, handleFolderClick, findFolderBySegments]);

  useEffect(() => {
    // Skip this sync when opening document sheet directly (e.g., from context menu)
    if (skipFilePathSyncRef.current) {
      skipFilePathSyncRef.current = false;
      return;
    }
    if (!fileTree) return;
    if (pendingFilePathRef.current === '__closing__') {
      if (filePathSegments.length === 0) {
        pendingFilePathRef.current = null;
      }
      return;
    }
    if (filePathSegments.length === 0) {
      if (pendingFilePathRef.current) return;
      if (selectedDocumentId) {
        setSelectedDocument(null);
        setSheetDocument(null);
        setPreviewUrl(null);
      }
      return;
    }
    const documentFromPath = findDocumentBySegments(filePathSegments);
    if (documentFromPath && documentFromPath.id !== selectedDocumentId) {
      const parentSegments = filePathSegments.slice(0, -1);
      const parentFolder = parentSegments.length > 0 ? findFolderBySegments(parentSegments) : fileTree;
      handleDocumentClick(documentFromPath, parentFolder ?? undefined, { emitSelection: false });
    }
    if (pendingFilePathRef.current === filePathKey) {
      pendingFilePathRef.current = null;
    }
  }, [filePathKey, filePathSegments, fileTree, findDocumentBySegments, findFolderBySegments, handleDocumentClick, selectedDocumentId]);

  const handleDownload = async (document: FileSystemItem) => {
    if (document.storagePath) {
      const { data } = await supabase.storage
        .from('obra-documents')
        .createSignedUrl(document.storagePath, 60);

      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    }
  };

  const createFolderParentPath = useMemo(() => {
    if (!createFolderParent || createFolderParent.id === 'root') return '';
    return getPathSegments(createFolderParent).join('/');
  }, [createFolderParent, getPathSegments]);

  const convertFolderPath = useMemo(() => {
    if (!convertFolderTarget) return '';
    return getPathSegments(convertFolderTarget).join('/');
  }, [convertFolderTarget, getPathSegments]);

  const resolveParentSegments = useCallback((parent: FileSystemItem | null) => {
    if (!parent || parent.id === 'root') return [] as string[];
    return getPathSegments(parent);
  }, [getPathSegments]);

  const createNormalFolder = useCallback(async () => {
    const rawFolderName = newFolderName.trim();
    if (!rawFolderName) {
      toast.error('Ingresá un nombre válido para la carpeta');
      return;
    }
    const normalizedFolder = normalizeFolderName(rawFolderName);
    if (!normalizedFolder) {
      toast.error('Ingresá un nombre válido para la carpeta');
      return;
    }
    const parentTarget = createFolderParent ?? fileTree;
    if (createFolderParent && hasOcrAncestor(createFolderParent)) {
      setCreateFolderError('No podés crear carpetas dentro de una carpeta de datos.');
      return;
    }
    const existingFolder = parentTarget?.children?.some(
      (child) =>
        child.type === 'folder' && normalizeFolderName(child.name) === normalizedFolder
    );
    if (existingFolder) {
      setCreateFolderError('Ya existe una carpeta con ese nombre. Elegí otro nombre.');
      return;
    }
    if (!createFolderParent && ocrFolderLinks.some((link) => normalizeFolderName(link.folderName) === normalizedFolder)) {
      setCreateFolderError('Ya existe una carpeta de datos con ese nombre. Elegí otro nombre.');
      return;
    }
    const parentSegments = resolveParentSegments(createFolderParent);
    const basePath = parentSegments.length ? `${obraId}/${parentSegments.join('/')}` : obraId;
    try {
      const folderPath = `${basePath}/${normalizedFolder}/.keep`;
      const { error } = await supabase.storage
        .from('obra-documents')
        .upload(folderPath, new Blob([''], { type: 'text/plain' }));
      if (error) {
        // Check if it's a duplicate folder error
        if (error.message?.toLowerCase().includes('already exists') || error.message?.toLowerCase().includes('duplicate')) {
          setCreateFolderError('Ya existe una carpeta con ese nombre. Elegí otro nombre.');
          return;
        }
        throw error;
      }
      toast.success('Carpeta creada correctamente');
      setIsCreateFolderOpen(false);
      resetNewFolderForm();
      await buildFileTree({ skipCache: true });
    } catch (error) {
      console.error('Error creating folder:', error);
      toast.error('Error creando carpeta');
    }
  }, [buildFileTree, createFolderParent, fileTree, hasOcrAncestor, newFolderName, obraId, ocrFolderLinks, resetNewFolderForm, resolveParentSegments, supabase]);

  const createDataFolder = useCallback(async () => {
    const convertingExistingFolder = Boolean(convertFolderTarget);
    const rawFolderName = convertingExistingFolder
      ? convertFolderTarget?.name?.trim() ?? ''
      : newFolderName.trim();
    if (!rawFolderName) {
      toast.error('Ingresá un nombre de carpeta válido');
      return;
    }
    const normalizedFolder = normalizeFolderName(rawFolderName);
    if (!normalizedFolder) {
      toast.error('Ingresá un nombre de carpeta válido');
      return;
    }
    const parentTarget = createFolderParent ?? fileTree;
    if (createFolderParent && hasOcrAncestor(createFolderParent)) {
      setCreateFolderError('No podés crear carpetas dentro de una carpeta de datos.');
      return;
    }
    const folderRelativePath = convertingExistingFolder
      ? normalizeFolderPath(getPathSegments(convertFolderTarget).join('/'))
      : normalizeFolderPath([...resolveParentSegments(createFolderParent), normalizedFolder].join('/'));
    if (!folderRelativePath) {
      toast.error('No se pudo resolver la carpeta de datos');
      return;
    }
    if (
      !convertingExistingFolder &&
      parentTarget?.children?.some(
        (child) =>
          child.type === 'folder' && normalizeFolderName(child.name) === normalizedFolder
      )
    ) {
      setCreateFolderError('Ya existe una carpeta con ese nombre. Elegí otro nombre.');
      return;
    }
    // Allow multiple OCR tables targeting the same folder path (fan-out extraction).
    const needsOcrTemplate = newFolderDataInputMethod === 'ocr' || newFolderDataInputMethod === 'both';
    const hasAnyTemplateSelected = Boolean(newFolderOcrTemplateId || newFolderSpreadsheetTemplate);
    if (!hasAnyTemplateSelected) {
      toast.error('Seleccioná una plantilla OCR o una plantilla XLSX/CSV');
      return;
    }
    if (newFolderColumns.length === 0) {
      toast.error('Añadí al menos una columna para la tabla');
      return;
    }
    if (newFolderHasNested) {
      const parentColumns = newFolderColumns.filter((column) => column.scope === 'parent');
      const itemColumns = newFolderColumns.filter((column) => column.scope !== 'parent');
      if (parentColumns.length === 0) {
        toast.error('Marcá al menos una columna como nivel Documento');
        return;
      }
      if (itemColumns.length === 0) {
        toast.error('Marcá al menos una columna como nivel Ítem');
        return;
      }
    }
    try {
      const basePayload = {
        sourceType: 'ocr' as const, // Keep 'ocr' for backward compatibility with API
        dataInputMethod: newFolderDataInputMethod,
        ocrFolderName: normalizedFolder,
        ocrFolderPath: folderRelativePath,
        hasNestedData: newFolderHasNested,
        ocrTemplateId: needsOcrTemplate ? newFolderOcrTemplateId : undefined,
        spreadsheetTemplate: newFolderSpreadsheetTemplate || undefined,
      };

      const defaultColumns = newFolderColumns.map((column, index) => ({
        label: column.label.trim() || `Columna ${index + 1}`,
        fieldKey: normalizeFieldKey(column.fieldKey),
        dataType: column.dataType,
        required: column.required,
        position: index,
        config: newFolderHasNested
          ? { ocrScope: column.scope ?? 'item', ocrDescription: column.description ?? null }
          : column.description
            ? { ocrDescription: column.description }
            : undefined,
      }));

      const tablesToCreate =
        newFolderSpreadsheetTemplate === 'certificado'
          ? CERTIFICADO_SPREADSHEET_TABLE_PRESETS.map((preset) => ({
            name: `${rawFolderName} · ${preset.name}`,
            description: preset.description,
            columns: preset.columns,
          }))
          : [{
            name: rawFolderName,
            description: newFolderDescription.trim() || undefined,
            columns: defaultColumns,
          }];

      const createdTablaIds: string[] = [];
      for (const tableDef of tablesToCreate) {
        const res = await fetch(`/api/obras/${obraId}/tablas`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...basePayload,
            name: tableDef.name,
            description: tableDef.description,
            columns: tableDef.columns,
          }),
        });
        if (!res.ok) {
          let errorMessage = 'No se pudo crear la carpeta de datos';
          try {
            const json = await res.json();
            errorMessage = json.error || errorMessage;
          } catch {
            const text = await res.text();
            errorMessage = text || errorMessage;
          }
          throw new Error(errorMessage);
        }
        const created = await res.json().catch(() => ({}));
        const createdTablaId = created?.tabla?.id as string | undefined;
        if (createdTablaId) {
          createdTablaIds.push(createdTablaId);
        }
      }

      if (!convertingExistingFolder) {
        const basePath = createFolderParentPath
          ? `${obraId}/${createFolderParentPath}`
          : obraId;
        try {
          await supabase.storage
            .from('obra-documents')
            .upload(`${basePath}/${normalizedFolder}/.keep`, new Blob([''], { type: 'text/plain' }), { upsert: true });
        } catch (keepError) {
          console.error('No se pudo crear la carpeta en almacenamiento', keepError);
        }
      }

      if (convertingExistingFolder && createdTablaIds.length > 0 && newFolderDataInputMethod !== 'manual') {
        const filesToReprocess = (convertFolderTarget?.children ?? [])
          .filter((child) => child.type === 'file' && child.storagePath)
          .map((child) => child as FileSystemItem);
        if (filesToReprocess.length > 0) {
          await Promise.all(
            filesToReprocess.map(async (file) => {
              const form = new FormData();
              form.append('existingBucket', 'obra-documents');
              form.append('existingPath', file.storagePath!);
              form.append('existingFileName', file.name);
              form.append('tablaIds', JSON.stringify(createdTablaIds));
              await fetch(`/api/obras/${obraId}/tablas/import/ocr-multi?skipStorage=1`, {
                method: 'POST',
                body: form,
              });
            })
          );
        }
      }

      toast.success(
        convertingExistingFolder
          ? 'Carpeta convertida a extracción'
          : 'Carpeta de datos creada'
      );
      setIsCreateFolderOpen(false);
      resetNewFolderForm();
      await buildFileTree({ skipCache: true });
    } catch (error) {
      console.error('Error creating data folder:', error);
      const message = error instanceof Error ? error.message : 'Error creando carpeta de datos';
      const normalized = message.toLowerCase();
      if (
        normalized.includes('ya existe') ||
        normalized.includes('already exists') ||
        normalized.includes('duplicate')
      ) {
        setCreateFolderError('Ya existe una carpeta con ese nombre. Elegí otro nombre.');
        return;
      }
      toast.error(message);
    }
  }, [
    buildFileTree,
    createFolderParent,
    createFolderParentPath,
    convertFolderTarget,
    hasOcrAncestor,
    fileTree,
    getPathSegments,
    newFolderColumns,
    newFolderDataInputMethod,
    newFolderDescription,
    newFolderHasNested,
    newFolderName,
    newFolderOcrTemplateId,
    newFolderSpreadsheetTemplate,
    obraId,
    ocrFolderLinks,
    resetNewFolderForm,
    resolveParentSegments,
    supabase,
  ]);

  const handleCreateFolder = useCallback(async () => {
    if (createFolderMode === 'data') {
      await createDataFolder();
    } else {
      await createNormalFolder();
    }
  }, [createFolderMode, createNormalFolder, createDataFolder]);

  // Manual refresh handler for syncing documents when others have made changes
  const handleManualRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      // Force refresh by skipping cache
      await buildFileTree({ skipCache: true });
      toast.success('Documentos sincronizados');
    } catch (error) {
      console.error('Error refreshing documents:', error);
      toast.error('Error al sincronizar documentos');
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, buildFileTree]);

  const refreshDocumentsSilent = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await buildFileTree({ skipCache: true });
    } catch (error) {
      console.error('Error refreshing documents:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, buildFileTree]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<{ obraId?: string }>;
      if (customEvent.detail?.obraId && customEvent.detail.obraId !== obraId) return;
      void refreshDocumentsSilent();
    };
    window.addEventListener('obra:documents-refresh', handler);
    return () => window.removeEventListener('obra:documents-refresh', handler);
  }, [obraId, refreshDocumentsSilent]);

  const fetchSpreadsheetPreview = useCallback(
    async ({
      existingPath,
      existingFileName,
      tablaIds,
      sheetAssignments,
      columnMappings,
      manualValues,
    }: {
      existingPath: string;
      existingFileName: string;
      tablaIds: string[];
      sheetAssignments?: Record<string, string | null>;
      columnMappings?: Record<string, Record<string, string | null>>;
      manualValues?: Record<string, Record<string, string>>;
    }) => {
      const formData = new FormData();
      formData.append('existingBucket', 'obra-documents');
      formData.append('existingPath', existingPath);
      formData.append('existingFileName', existingFileName);
      const uniqueTablaIds = [...new Set(tablaIds)];
      formData.append('tablaIds', JSON.stringify(uniqueTablaIds));
      if (sheetAssignments) {
        formData.append('sheetAssignments', JSON.stringify(sheetAssignments));
      }
      if (columnMappings) {
        formData.append('columnMappings', JSON.stringify(columnMappings));
      }
      if (manualValues) {
        formData.append('manualValues', JSON.stringify(manualValues));
      }
      const response = await fetch(
        `/api/obras/${obraId}/tablas/import/spreadsheet-multi?preview=1&skipStorage=1`,
        {
          method: 'POST',
          body: formData,
        }
      );
      const payload = await response.json().catch(() => ({} as any));
      if (!response.ok) {
        throw new Error(
          typeof payload?.error === 'string'
            ? payload.error
            : 'No se pudo generar la vista previa de planilla.'
        );
      }
      const previewTables = Array.isArray(payload?.perTable) ? payload.perTable : [];
      const nextSheetAssignments: Record<string, string | null> = {};
      const nextColumnMappings: Record<string, Record<string, string | null>> = {};
      const nextManualValues: Record<string, Record<string, string>> = {};
      previewTables.forEach((table: SpreadsheetPreviewTable) => {
        nextSheetAssignments[table.tablaId] = table.sheetName ?? null;
        const perTableMapping: Record<string, string | null> = {};
        const perTableManualValues: Record<string, string> = {};
        (table.mappings ?? []).forEach((mapping) => {
          perTableMapping[mapping.dbColumn] = mapping.excelHeader ?? null;
          perTableManualValues[mapping.dbColumn] = mapping.manualValue ?? '';
        });
        nextColumnMappings[table.tablaId] = perTableMapping;
        nextManualValues[table.tablaId] = perTableManualValues;
      });
      return {
        perTable: previewTables as SpreadsheetPreviewTable[],
        sheetAssignments: sheetAssignments ?? nextSheetAssignments,
        columnMappings: columnMappings ?? nextColumnMappings,
        manualValues: manualValues ?? nextManualValues,
        existingBucket: 'obra-documents',
        existingPath,
        existingFileName,
        tablaIds: uniqueTablaIds,
      } satisfies SpreadsheetPreviewPayload;
    },
    [obraId]
  );

  const openSpreadsheetPreview = useCallback(
    (payload: SpreadsheetPreviewPayload) =>
      new Promise<boolean>((resolve) => {
        spreadsheetPreviewResolverRef.current = resolve;
        setSpreadsheetPreviewPayload(payload);
        setIsSpreadsheetPreviewOpen(true);
      }),
    []
  );

  const closeSpreadsheetPreview = useCallback((confirmed: boolean) => {
    setIsSpreadsheetPreviewOpen(false);
    const resolver = spreadsheetPreviewResolverRef.current;
    spreadsheetPreviewResolverRef.current = null;
    resolver?.(confirmed);
  }, []);

  const refreshSpreadsheetPreviewWithOverrides = useCallback(
    async (nextSheetAssignments: Record<string, string | null>, nextColumnMappings: Record<string, Record<string, string | null>>) => {
      if (!spreadsheetPreviewPayload) return;
      try {
        setIsLoadingSpreadsheetPreview(true);
        const nextPayload = await fetchSpreadsheetPreview({
          existingPath: spreadsheetPreviewPayload.existingPath,
          existingFileName: spreadsheetPreviewPayload.existingFileName,
          tablaIds: spreadsheetPreviewPayload.tablaIds,
          sheetAssignments: nextSheetAssignments,
          columnMappings: nextColumnMappings,
          manualValues: spreadsheetPreviewPayload.manualValues,
        });
        setSpreadsheetPreviewPayload(nextPayload);
      } catch (error) {
        console.error(error);
        toast.error(error instanceof Error ? error.message : 'No se pudo actualizar la vista previa.');
      } finally {
        setIsLoadingSpreadsheetPreview(false);
      }
    },
    [fetchSpreadsheetPreview, spreadsheetPreviewPayload]
  );

  const handleSpreadsheetPreviewSheetChange = useCallback(
    async (tablaId: string, sheetName: string | null) => {
      if (!spreadsheetPreviewPayload) return;
      const nextSheetAssignments = {
        ...spreadsheetPreviewPayload.sheetAssignments,
        [tablaId]: sheetName,
      };
      const nextColumnMappings = { ...spreadsheetPreviewPayload.columnMappings };
      delete nextColumnMappings[tablaId];
      const nextManualValues = { ...spreadsheetPreviewPayload.manualValues };
      delete nextManualValues[tablaId];
      try {
        setIsLoadingSpreadsheetPreview(true);
        const nextPayload = await fetchSpreadsheetPreview({
          existingPath: spreadsheetPreviewPayload.existingPath,
          existingFileName: spreadsheetPreviewPayload.existingFileName,
          tablaIds: spreadsheetPreviewPayload.tablaIds,
          sheetAssignments: nextSheetAssignments,
          columnMappings: nextColumnMappings,
          manualValues: nextManualValues,
        });
        setSpreadsheetPreviewPayload(nextPayload);
      } catch (error) {
        console.error(error);
        toast.error(error instanceof Error ? error.message : 'No se pudo actualizar la vista previa.');
      } finally {
        setIsLoadingSpreadsheetPreview(false);
      }
    },
    [fetchSpreadsheetPreview, spreadsheetPreviewPayload]
  );

  const handleSpreadsheetPreviewMappingChange = useCallback(
    async (tablaId: string, dbColumn: string, excelHeader: string | null) => {
      if (!spreadsheetPreviewPayload) return;
      const nextColumnMappings = {
        ...spreadsheetPreviewPayload.columnMappings,
        [tablaId]: {
          ...(spreadsheetPreviewPayload.columnMappings[tablaId] ?? {}),
          [dbColumn]: excelHeader,
        },
      };
      await refreshSpreadsheetPreviewWithOverrides(
        spreadsheetPreviewPayload.sheetAssignments,
        nextColumnMappings
      );
    },
    [refreshSpreadsheetPreviewWithOverrides, spreadsheetPreviewPayload]
  );

  const handleSpreadsheetPreviewManualValueChange = useCallback(
    async (tablaId: string, dbColumn: string, manualValue: string) => {
      if (!spreadsheetPreviewPayload) return;
      const nextManualValues = {
        ...spreadsheetPreviewPayload.manualValues,
        [tablaId]: {
          ...(spreadsheetPreviewPayload.manualValues[tablaId] ?? {}),
          [dbColumn]: manualValue,
        },
      };
      try {
        setIsLoadingSpreadsheetPreview(true);
        const nextPayload = await fetchSpreadsheetPreview({
          existingPath: spreadsheetPreviewPayload.existingPath,
          existingFileName: spreadsheetPreviewPayload.existingFileName,
          tablaIds: spreadsheetPreviewPayload.tablaIds,
          sheetAssignments: spreadsheetPreviewPayload.sheetAssignments,
          columnMappings: spreadsheetPreviewPayload.columnMappings,
          manualValues: nextManualValues,
        });
        setSpreadsheetPreviewPayload(nextPayload);
      } catch (error) {
        console.error(error);
        toast.error(error instanceof Error ? error.message : 'No se pudo actualizar el valor manual.');
      } finally {
        setIsLoadingSpreadsheetPreview(false);
      }
    },
    [fetchSpreadsheetPreview, spreadsheetPreviewPayload]
  );

  const applySpreadsheetPreviewImport = useCallback(async () => {
    if (!spreadsheetPreviewPayload) return false;
    try {
      setIsApplyingSpreadsheetPreview(true);
      const formData = new FormData();
      formData.append('existingBucket', spreadsheetPreviewPayload.existingBucket);
      formData.append('existingPath', spreadsheetPreviewPayload.existingPath);
      formData.append('existingFileName', spreadsheetPreviewPayload.existingFileName);
      formData.append('tablaIds', JSON.stringify(spreadsheetPreviewPayload.tablaIds));
      formData.append('sheetAssignments', JSON.stringify(spreadsheetPreviewPayload.sheetAssignments));
      formData.append('columnMappings', JSON.stringify(spreadsheetPreviewPayload.columnMappings));
      formData.append('manualValues', JSON.stringify(spreadsheetPreviewPayload.manualValues));
      const response = await fetch(
        `/api/obras/${obraId}/tablas/import/spreadsheet-multi?skipStorage=1`,
        {
          method: 'POST',
          body: formData,
        }
      );
      const payload = await response.json().catch(() => ({} as any));
      if (!response.ok) {
        throw new Error(
          typeof payload?.error === 'string'
            ? payload.error
            : 'No se pudo aplicar la importación de planilla.'
        );
      }
      const perTableResults = Array.isArray(payload?.perTable) ? payload.perTable : [];
      if (perTableResults.length > 0) {
        perTableResults.forEach((result: { tablaName?: string; inserted?: number }) => {
          if ((result?.inserted ?? 0) > 0) {
            toast.success(`Se importaron ${result.inserted} filas en ${result?.tablaName ?? 'tabla'}`);
          } else {
            toast.warning(`No se detectaron filas para ${result?.tablaName ?? 'tabla'}`);
          }
        });
      } else {
        toast.success('Planilla procesada');
      }
      return true;
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'No se pudo importar la planilla.');
      return false;
    } finally {
      setIsApplyingSpreadsheetPreview(false);
    }
  }, [obraId, spreadsheetPreviewPayload]);

  const uploadFilesToFolder = useCallback(async (inputFiles: FileList | File[], targetFolder?: FileSystemItem | null) => {
    const filesArray = Array.isArray(inputFiles) ? inputFiles : Array.from(inputFiles);
    if (!filesArray.length) return;
    const totalBytes = filesArray.reduce((sum, file) => sum + (file.size ?? 0), 0);
    const hasSpace = await ensureStorageCapacity(totalBytes);
    if (!hasSpace) return;

    const resolvedFolder =
      targetFolder ??
      (selectedFolder?.type === 'folder' ? selectedFolder : null) ??
      fileTree ??
      null;

    const folderForUpload = resolvedFolder?.type === 'folder' ? resolvedFolder : fileTree;

    const resolveFolderPath = (folder?: FileSystemItem | null) => {
      if (!folder || folder.id === 'root') return obraId;
      const segments = getPathSegments(folder);
      const relativePath = segments.join('/');
      return relativePath ? `${obraId}/${relativePath}` : obraId;
    };

    const folderPath = resolveFolderPath(folderForUpload ?? null);
    const linkedTablas = (() => {
      if (!folderForUpload) return [] as OcrFolderLink[];
      const folderKey = normalizeFolderPath(
        folderForUpload.relativePath ?? folderForUpload.ocrFolderName ?? folderForUpload.name
      );
      const linksByPath =
        ocrFolderLinksMap.get(folderKey) ??
        ocrFolderLinksMap.get(normalizeFolderName(folderKey)) ??
        [];
      if (linksByPath.length > 0) return linksByPath;
      if (folderForUpload.ocrTablaId) {
        return [ocrTablaMap.get(folderForUpload.ocrTablaId)].filter(Boolean) as OcrFolderLink[];
      }
      return [] as OcrFolderLink[];
    })();
    const isOcrFolder = linkedTablas.length > 0;

    setUploadingFiles(true);
    setCurrentUploadFolder(folderForUpload ?? fileTree ?? null);
    let pendingUsageBytes = 0;
    const uploadedFiles: { path: string; name: string }[] = [];

    try {
      for (const file of filesArray) {
        const storageFileName = sanitizeStorageFileName(file.name);
        const filePath = `${folderPath}/${storageFileName}`;

        const { error } = await supabase.storage
          .from('obra-documents')
          .upload(filePath, file, { upsert: true });

        if (error) throw error;
        pendingUsageBytes += file.size ?? 0;
        uploadedFiles.push({ path: filePath, name: file.name });

        if (is3DModelFile(file.name)) {
          try {
            const formData = new FormData();
            formData.append('file', file);

            const apsResponse = await fetch('/api/aps/upload', {
              method: 'POST',
              body: formData,
            });

            const apsData = await apsResponse.json();

            if (!apsResponse.ok) {
              toast.error(`3D model uploaded to storage, but APS processing failed: ${apsData.error}`);
            } else {
              try {
                const storeResponse = await fetch('/api/aps/models', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    obraId,
                    filePath,
                    fileName: file.name,
                    apsUrn: apsData.urn,
                    apsObjectId: apsData.objectId,
                  }),
                });

                if (!storeResponse.ok) {
                  console.error('Failed to store URN in database');
                }

                toast.success(`${file.name} uploaded and processing for 3D viewing`);
              } catch (storeError) {
                console.error('Error storing URN:', storeError);
              }
            }
          } catch (apsError) {
            console.error('APS upload error:', apsError);
            toast.error('File uploaded to storage, but 3D processing failed');
          }
        }

        if (isOcrFolder) {
          try {
            const ext = file.name.toLowerCase().split('.').pop() ?? '';
            const isSpreadsheet = ext === 'csv' || ext === 'xlsx' || ext === 'xls';
            if (isSpreadsheet) {
              let previewPayload: SpreadsheetPreviewPayload;
              try {
                setIsLoadingSpreadsheetPreview(true);
                const uniqueTablaIds = [...new Set(linkedTablas.map((tabla) => tabla.tablaId))];
                previewPayload = await fetchSpreadsheetPreview({
                  existingPath: filePath,
                  existingFileName: file.name,
                  tablaIds: uniqueTablaIds,
                });
              } finally {
                setIsLoadingSpreadsheetPreview(false);
              }
              const confirmed = await openSpreadsheetPreview(previewPayload);
              if (!confirmed) {
                toast.info(`Importación cancelada para ${file.name}`);
                continue;
              }
              continue;
            }

            const fd = new FormData();

            if (file.type.includes('pdf')) {
              try {
                // @ts-ignore - pdfjs types are not required for client-side rasterization
                const pdfjs: any = await import('pdfjs-dist/legacy/build/pdf');
                const array = new Uint8Array(await file.arrayBuffer());
                const loadingTask = pdfjs.getDocument({ data: array, disableWorker: true });
                const pdf = await loadingTask.promise;
                const page = await pdf.getPage(1);
                const viewport = page.getViewport({ scale: 2 });
                const canvasEl = document.createElement('canvas');
                canvasEl.width = Math.ceil(viewport.width);
                canvasEl.height = Math.ceil(viewport.height);
                const ctx = canvasEl.getContext('2d');
                if (!ctx) throw new Error('No canvas context');
                await page.render({ canvasContext: ctx as any, viewport }).promise;
                const dataUrl = canvasEl.toDataURL('image/png');
                fd.append('imageDataUrl', dataUrl);
              } catch (pdfErr) {
                console.error('PDF rasterization failed', pdfErr);
                fd.append('file', file);
              }
            } else if (file.type.startsWith('image/')) {
              fd.append('file', file);
            } else {
              continue;
            }
            fd.append('existingBucket', 'obra-documents');
            fd.append('existingPath', filePath);
            fd.append('existingFileName', file.name);
            fd.append('tablaIds', JSON.stringify([...new Set(linkedTablas.map((tabla) => tabla.tablaId))]));
            const importRes = await fetch(
              `/api/obras/${obraId}/tablas/import/ocr-multi?skipStorage=1`,
              {
                method: 'POST',
                body: fd,
              }
            );

            const out = await importRes.json().catch(() => ({} as any));
            if (!importRes.ok) {
              console.error('Tabla OCR import failed', out);
              const limitMessage =
                typeof out?.error === 'string'
                  ? out.error
                  : 'Superaste el límite de tokens de IA de tu plan.';
              if (importRes.status === 402) {
                toast.warning(limitMessage);
              } else {
                toast.error('No se pudieron extraer datos para las tablas OCR');
              }
              continue;
            }

            const perTableResults = Array.isArray(out?.perTable) ? out.perTable : [];
            if (perTableResults.length > 0) {
              perTableResults.forEach((result: { tablaName?: string; inserted?: number }) => {
                toast.success(
                  result?.inserted
                    ? `Se importaron ${result.inserted} filas en ${result?.tablaName ?? 'tabla OCR'}`
                    : `Archivo procesado en ${result?.tablaName ?? 'tabla OCR'}`
                );
              });
            } else {
              toast.success('Archivo procesado en tablas OCR');
            }
          } catch (ocrError) {
            console.error('Error extracting materials', ocrError);
            toast.error('El archivo se subió pero no se pudo extraer la orden de materiales');
          }
        }
      }

      toast.success(`${filesArray.length} file(s) uploaded successfully`);

      if (pendingUsageBytes > 0) {
        await applyUsageDelta(
          { storageBytes: pendingUsageBytes },
          {
            reason: 'storage_upload',
            metadata: { folderPath, files: uploadedFiles },
          }
        );
        pendingUsageBytes = 0;
      }

      await buildFileTree({ skipCache: true });
    } catch (error) {
      console.error('Error uploading files:', error);
      toast.error('Error uploading files');
    } finally {
      setUploadingFiles(false);
      setCurrentUploadFolder(null);
    }
  }, [applyUsageDelta, buildFileTree, ensureStorageCapacity, fetchSpreadsheetPreview, fileTree, getPathSegments, obraId, ocrFolderLinksMap, ocrTablaMap, onRefreshMaterials, openSpreadsheetPreview, sanitizeStorageFileName, selectedFolder, supabase]);

  const handleDocumentAreaDragOver = useCallback((event: React.DragEvent<HTMLElement>) => {
    if (!containsFiles(event.dataTransfer)) return;
    event.preventDefault();
    if (draggedFolderId) {
      return;
    }
    if (!isGlobalFileDragActive) {
      setIsGlobalFileDragActive(true);
    }
    event.dataTransfer.dropEffect = 'copy';
  }, [draggedFolderId, isGlobalFileDragActive]);

  const handleDocumentAreaDragEnter = useCallback((event: React.DragEvent<HTMLElement>) => {
    if (!containsFiles(event.dataTransfer)) return;
    event.preventDefault();
    if (draggedFolderId) return;
    setIsGlobalFileDragActive(true);
  }, [draggedFolderId]);

  const handleDocumentAreaDragLeave = useCallback((event: React.DragEvent<HTMLElement>) => {
    if (!containsFiles(event.dataTransfer)) return;
    const currentTarget = event.currentTarget as HTMLElement;
    const related = event.relatedTarget as Node | null;
    if (related && currentTarget.contains(related)) return;
    setIsGlobalFileDragActive(false);
  }, []);

  const handleDocumentAreaDrop = useCallback((event: React.DragEvent<HTMLElement>) => {
    if (!containsFiles(event.dataTransfer)) return;
    event.preventDefault();
    const files = Array.from(event.dataTransfer.files || []);
    if (files.length) {
      void uploadFilesToFolder(files);
    }
    setIsGlobalFileDragActive(false);
  }, [uploadFilesToFolder]);

  const needsOcrTemplate = newFolderDataInputMethod === 'ocr' || newFolderDataInputMethod === 'both';
  const hasAnyTemplateSelected = Boolean(newFolderOcrTemplateId || newFolderSpreadsheetTemplate);
  const isCreateFolderDisabled =
    !newFolderName.trim() ||
    (createFolderMode === 'data' && newFolderColumns.length === 0) ||
    (createFolderMode === 'data' && !hasAnyTemplateSelected) ||
    (createFolderMode === 'data' && needsOcrTemplate && !newFolderOcrTemplateId && !newFolderSpreadsheetTemplate);

  const handleUploadFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await uploadFilesToFolder(files);
    e.target.value = '';
  };

  const handleFolderDragEnter = useCallback((event: React.DragEvent<HTMLElement>, folder: FileSystemItem) => {
    if (!containsFiles(event.dataTransfer)) return;
    event.preventDefault();
    event.stopPropagation();
    setIsGlobalFileDragActive(false);
    setDraggedFolderId(folder.id);
  }, []);

  const handleFolderDragOver = useCallback((event: React.DragEvent<HTMLElement>, folder: FileSystemItem) => {
    if (!containsFiles(event.dataTransfer)) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';
    setIsGlobalFileDragActive(false);
    setDraggedFolderId(prev => (prev === folder.id ? prev : folder.id));
  }, []);

  const handleFolderDragLeave = useCallback((event: React.DragEvent<HTMLElement>, folder: FileSystemItem) => {
    if (!containsFiles(event.dataTransfer)) return;
    const currentTarget = event.currentTarget as HTMLElement;
    const related = event.relatedTarget as Node | null;
    if (related && currentTarget.contains(related)) return;
    setDraggedFolderId(prev => (prev === folder.id ? null : prev));
  }, []);

  const handleFolderDrop = useCallback((event: React.DragEvent<HTMLElement>, folder: FileSystemItem) => {
    if (!containsFiles(event.dataTransfer)) return;
    event.preventDefault();
    event.stopPropagation();
    const files = Array.from(event.dataTransfer.files || []);
    setDraggedFolderId(null);
    setIsGlobalFileDragActive(false);
    event.dataTransfer.clearData();
    if (files.length) {
      void uploadFilesToFolder(files, folder);
    }
  }, [uploadFilesToFolder]);

  const openCreateFolderDialog = useCallback((mode: 'normal' | 'data', parent?: FileSystemItem | null) => {
    if (parent && hasOcrAncestor(parent)) {
      toast.error('No podés crear carpetas dentro de una carpeta de datos');
      return;
    }
    setCreateFolderMode(mode);
    setCreateFolderParent(parent ?? fileTree ?? null);
    setConvertFolderTarget(null);
    setNewFolderName('');
    setNewFolderHasNested(false);
    setIsCreateFolderOpen(true);
    if (mode === 'data') {
      setNewFolderDataInputMethod('both');
      setNewFolderDescription('');
      setNewFolderOcrTemplateId('');
      setNewFolderColumns([
        {
          id: crypto.randomUUID(),
          label: 'Columna 1',
          fieldKey: 'columna_1',
          dataType: 'text',
          required: false,
          scope: 'item',
        },
      ]);
    }
  }, [fileTree, hasOcrAncestor]);

  const openConvertFolderDialog = useCallback((folder: FileSystemItem) => {
    if (folder.type !== 'folder') return;
    if (folder.ocrEnabled) {
      toast.error('La carpeta ya es de extracción');
      return;
    }
    const hasNestedFolders = (folder.children ?? []).some((child) => child.type === 'folder');
    if (hasNestedFolders) {
      toast.error('No podés convertir carpetas que tengan subcarpetas');
      return;
    }
    if (hasOcrAncestor(folder)) {
      toast.error('No podés convertir subcarpetas dentro de una carpeta de extracción');
      return;
    }
    const parent = parentMapRef.current.get(folder.id) ?? fileTree ?? null;
    setCreateFolderMode('data');
    setCreateFolderParent(parent);
    setConvertFolderTarget(folder);
    setNewFolderName(folder.name);
    setNewFolderDataInputMethod('both');
    setNewFolderDescription('');
    setNewFolderOcrTemplateId('');
    setNewFolderHasNested(false);
    setCreateFolderError(null);
    setIsCreateFolderOpen(true);
  }, [fileTree, hasOcrAncestor]);

  const openAddOcrTableToFolderDialog = useCallback((folder: FileSystemItem) => {
    if (folder.type !== 'folder') return;
    const parent = parentMapRef.current.get(folder.id) ?? fileTree ?? null;
    setCreateFolderMode('data');
    setCreateFolderParent(parent);
    setConvertFolderTarget(folder);
    setNewFolderName(folder.name);
    setNewFolderDataInputMethod('both');
    setNewFolderDescription('');
    setNewFolderOcrTemplateId('');
    setNewFolderHasNested(false);
    setCreateFolderError(null);
    setIsCreateFolderOpen(true);
  }, [fileTree]);

  const handleDelete = async (item: FileSystemItem) => {
    try {
      const deletedPaths: string[] = [];
      let bytesFreed = 0;
      if (item.type === 'file') {
        if (item.storagePath) {
          bytesFreed = item.size ?? 0;
          deletedPaths.push(item.storagePath);
          const { error } = await supabase.storage
            .from('obra-documents')
            .remove([item.storagePath]);

          if (error) throw error;
          toast.success('File deleted successfully');
        }
      } else {
        const folderStoragePath = item.storagePath ?? (item.id === 'root' ? obraId : `${obraId}/${getPathSegments(item).join('/')}`);
        const foldersToScan = [folderStoragePath];
        const filesToDelete: string[] = [];
        while (foldersToScan.length > 0) {
          const currentFolder = foldersToScan.shift()!;
          const { data: entries, error: listError } = await supabase.storage
            .from('obra-documents')
            .list(currentFolder, { limit: 1000 });
          if (listError) throw listError;
          for (const entry of entries ?? []) {
            const isFolder = !entry.metadata;
            const fullPath = `${currentFolder}/${entry.name}`;
            if (isFolder) {
              foldersToScan.push(fullPath);
              continue;
            }
            deletedPaths.push(fullPath);
            bytesFreed += entry.metadata?.size ?? 0;
            filesToDelete.push(fullPath);
          }
        }

        if (filesToDelete.length > 0) {
          const { error: deleteError } = await supabase.storage
            .from('obra-documents')
            .remove(filesToDelete);
          if (deleteError) throw deleteError;
        }

        toast.success('Folder and contents deleted successfully');
      }

      if (selectedFolder?.id === item.id) {
        setSelectedFolder(fileTree);
        setSelectedDocument(null);
        setSheetDocument(null);
        setPreviewUrl(null);
      }
      if (selectedDocument?.id === item.id) {
        setSelectedDocument(null);
        setSheetDocument(null);
        setPreviewUrl(null);
      }

      buildFileTree({ skipCache: true });

      if (bytesFreed > 0) {
        await applyUsageDelta(
          { storageBytes: -bytesFreed },
          {
            reason: 'storage_delete',
            metadata: { paths: deletedPaths, itemId: item.id },
          }
        );
      }
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('Error deleting item');
    }
  };

  const confirmDelete = useCallback((item: FileSystemItem) => {
    setItemToDelete(item);
    setIsDeleteDialogOpen(true);
    setContextMenu(null);
  }, []);

  const getTreeFileIcon = useCallback((mimetype?: string) => {
    if (!mimetype) return <File className="w-4 h-4 text-stone-400" />;
    if (mimetype.startsWith('image/')) return <ImageIcon className="w-4 h-4 text-stone-400" />;
    if (mimetype === 'application/pdf') return <FileText className="w-4 h-4 text-stone-400" />;
    return <File className="w-4 h-4 text-stone-400" />;
  }, []);

  // Get folder icon color based on data input method
  const getFolderIconColor = useCallback((dataInputMethod?: DataInputMethod) => {
    // switch (dataInputMethod) {
    //   case 'manual':
    //     return 'text-green-600';
    //   case 'ocr':
    //     return 'text-amber-600';
    //   case 'both':
    //     return 'text-purple-600';
    //   default:
    //     return 'text-stone-500';
    // }
    if (dataInputMethod === 'manual' || dataInputMethod === 'both' || dataInputMethod === 'ocr') return 'text-amber-600';
    return 'text-stone-500';
  }, []);

  const getFolderFileCount = useCallback((folder: FileSystemItem) => {
    const children = folder.children ?? [];
    return children.filter((child) => child.type === 'file' && child.name !== '.keep').length;
  }, []);

  // NEW: Styled tree item with amber accents for OCR folders
  const renderTreeItem = useCallback((item: FileSystemItem, level: number = 0, parentFolder?: FileSystemItem) => {
    if (item.type === 'file' && item.name === '.keep') {
      return null;
    }
    const isFolder = item.type === 'folder';
    const isOCR = item.ocrEnabled;
    const isExpanded = item.id === 'root' || isOCR || expandedFolders.has(item.id);
    const isFolderSelected = selectedFolder?.id === item.id;
    const isDocumentSelected = selectedDocument?.id === item.id;
    const isDragTarget = draggedFolderId === item.id;
    const hasChildren = item.children && item.children.length > 0;
    const folderLookupKey = normalizeFolderPath((item.relativePath ?? item.ocrFolderName ?? item.name));
    const folderLink = isFolder && item.ocrEnabled ? (ocrFolderMap.get(folderLookupKey) || ocrFolderMap.get(normalizeFolderName(folderLookupKey)) || null) : null;
    const isManualOnly = Boolean(folderLink && folderLink.dataInputMethod === 'manual');
    const rowCount = isManualOnly ? (folderLink?.rows?.length ?? 0) : 0;
    const fileCount = isFolder ? getFolderFileCount(item) : 0;
    const countValue = isFolder && item.id !== 'root' ? (isManualOnly ? rowCount : fileCount) : null;
    const countLabel = isManualOnly ? 'filas' : 'archivos';

    const handleItemClick = () => {
      if (isFolder) {
        handleFolderClick(item);
      } else {
        handleDocumentClick(item, parentFolder, { preserveFilter: true });
      }
    };

    return (
      <div key={item.id}>
        <button
          onClick={handleItemClick}
          onDragEnter={isFolder ? (event) => handleFolderDragEnter(event, item) : undefined}
          onDragOver={isFolder ? (event) => handleFolderDragOver(event, item) : undefined}
          onDragLeave={isFolder ? (event) => handleFolderDragLeave(event, item) : undefined}
          onDrop={isFolder ? (event) => handleFolderDrop(event, item) : undefined}
          onContextMenu={isFolder && item.id !== 'root'
            ? (e) => {
              e.preventDefault();
              setContextMenu({ x: e.clientX, y: e.clientY, item: item });
            }
            : undefined
          }
          className={`
            group w-full flex items-center gap-2 py-1.5 px-2 rounded-md text-sm
            transition-all duration-150
            ${isFolderSelected && isFolder
              ? isOCR
                // ? item.dataInputMethod === 'manual' ? 'bg-green-100 text-green-900'
                //   : item.dataInputMethod === 'both' ? 'bg-purple-100 text-purple-900'
                //     : 'bg-amber-100 text-amber-900'
                // : 'bg-stone-100 text-stone-900'
                ? "bg-amber-100 text-amber-900" : "bg-stone-100 text-stone-900"
              : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
            }
            ${isDocumentSelected && !isFolder ? 'bg-amber-50 ring-2 ring-amber-400' : ''}
            ${isDragTarget ? 'ring-2 ring-amber-500 ring-offset-1' : ''}
          `}
          style={{ paddingLeft: `${level * 16 + 8}px` }}
        >
          {isFolder && !isOCR ? (
            <button
              type="button"
              className="w-4 h-4 inline-flex items-center justify-center text-stone-400 hover:text-stone-700"
              onClick={(event) => {
                event.stopPropagation();
                toggleFolder(item.id);
              }}
              aria-label={isExpanded ? 'Contraer carpeta' : 'Expandir carpeta'}
            >
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </button>
          ) : (
            <span className="w-4" />
          )}

          {isFolder ? (
            <FolderIcon className={cn("w-4 h-4 text-stone-400 ", getFolderIconColor(item.dataInputMethod))} />
          ) : (
            getTreeFileIcon(item.mimetype)
          )}

          <span className="flex-1 text-left truncate">{item.name}</span>

          {isOCR && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1 relative -mx-2">
                  <span
                    aria-label={
                      item.dataInputMethod === 'manual'
                        ? 'Carga manual'
                        : item.dataInputMethod === 'both'
                          ? 'Mixta: extracción + manual'
                          : 'Extracción de datos'
                    }
                    className={` inline-flex items-center justify-center  px-1.5 py-0.5 ${item.dataInputMethod === 'manual'
                      ? ' text-green-700 '
                      : item.dataInputMethod === 'both'
                        ? ' text-purple-700 '
                        : ' text-amber-700 '
                      }`}
                  >
                    {item.dataInputMethod === 'manual' ? (
                      <Hand className="w-3 h-3" />
                    ) : item.dataInputMethod === 'both' ? (
                      <Layers className="w-3 h-3" />
                    ) : (
                      <Sparkles className="w-3 h-3" />
                    )}
                  </span>
                </div>

              </TooltipTrigger>
              <TooltipContent>
                {item.dataInputMethod === 'manual'
                  ? 'Carga manual'
                  : item.dataInputMethod === 'both'
                    ? 'Mixta: extracción + manual'
                    : 'Extracción de datos'}
              </TooltipContent>
            </Tooltip>
          )}


          {isFolder && countValue !== null && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 border border-stone-200">
                  {countValue}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {countValue} {countLabel}
              </TooltipContent>
            </Tooltip>
          )}

          {item.id !== 'root' && (
            <button
              type="button"
              className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity text-stone-400 hover:text-red-600"
              onClick={(event) => {
                event.stopPropagation();
                confirmDelete(item);
              }}
              aria-label={`Eliminar ${item.type === 'folder' ? 'carpeta' : 'archivo'}`}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}


          {/* {!isFolder && item.size && (
            <span className="text-xs text-stone-400">
              {(item.size / 1024).toFixed(0)} KB
            </span>
          )} */}
        </button>

        {isFolder && !isOCR && isExpanded && item.children && (
          <div className="animate-in slide-in-from-top-1 duration-200">
            {item.children.map(child => renderTreeItem(child, level + 1, item))}
          </div>
        )}
      </div>
    );
  }, [
    confirmDelete,
    draggedFolderId,
    expandedFolders,
    getFolderFileCount,
    getFolderIconColor,
    getTreeFileIcon,
    handleDocumentClick,
    handleFolderClick,
    handleFolderDragEnter,
    handleFolderDragLeave,
    handleFolderDragOver,
    handleFolderDrop,
    normalizeFolderName,
    ocrFolderMap,
    renderOcrStatusBadge,
    selectedDocument?.id,
    selectedFolder?.id,
    toggleFolder,
  ]);

  const toggleOrderExpanded = (orderId: string) => {
    setExpandedOrders(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  };

  // Get status style for table
  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'pending': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'overdue': return 'bg-red-50 text-red-700 border-red-200';
      default: return 'bg-stone-50 text-stone-700 border-stone-200';
    }
  };

  // NEW: Source file modal for viewing documents from table
  const renderSourceFileModal = () => {
    if (!sourceFileModal) return null;

    const isImage = sourceFileModal.mimetype?.startsWith('image/');
    const isPdf = sourceFileModal.mimetype === 'application/pdf';

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          onClick={() => setSourceFileModal(null)}
        />
        <div className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-xl border border-stone-200 shadow-2xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-stone-200">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-stone-500" />
              <span className="font-medium text-stone-800">{sourceFileModal.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleDownload(sourceFileModal)}
              >
                <Download className="w-4 h-4 mr-2" />
                Descargar
              </Button>
              <button
                onClick={() => setSourceFileModal(null)}
                className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            {sourceFileModal.apsUrn ? (
              <div className="h-full min-h-[400px]">
                <ForgeViewer urn={sourceFileModal.apsUrn} />
              </div>
            ) : previewUrl && (isImage || isPdf) ? (
              <EnhancedDocumentViewer
                url={previewUrl}
                fileName={sourceFileModal.name}
                fileType={isPdf ? 'pdf' : 'image'}
                onDownload={() => handleDownload(sourceFileModal)}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-stone-400">
                <FileText className="w-16 h-16 mb-4 opacity-30" />
                <p className="text-sm">Preview not available</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const activeDocument = sheetDocument ?? displayedDocumentRef.current ?? null;

  const activeDocumentOcrLinks = useMemo(
    () => (activeDocument ? resolveOcrLinksForDocument(activeDocument) : [] as OcrFolderLink[]),
    [activeDocument, resolveOcrLinksForDocument]
  );

  const activeDocumentRowsByTablaId = useMemo(() => {
    const map = new Map<string, OcrDocumentTableRow[]>();
    if (!activeDocument?.storagePath) return map;
    activeDocumentOcrLinks.forEach((link) => {
      if (!Array.isArray(link.rows) || !Array.isArray(link.columns) || link.columns.length === 0) {
        map.set(link.tablaId, []);
        return;
      }
      const rows = (link.rows as TablaDataRow[])
        .filter((row) => {
          const data = (row?.data as Record<string, unknown>) ?? {};
          return data.__docPath === activeDocument.storagePath;
        })
        .map((row) => {
          const data = (row?.data as Record<string, unknown>) ?? {};
          const mapped: OcrDocumentTableRow = { id: row.id };
          link.columns.forEach((column) => {
            mapped[column.fieldKey] = data[column.fieldKey];
          });
          return mapped;
        });
      map.set(link.tablaId, rows);
    });
    return map;
  }, [activeDocument, activeDocumentOcrLinks]);

  const activeDocumentOcrLink = useMemo(() => {
    if (activeDocumentOcrLinks.length === 0) return null;
    if (activeDocumentTablaIdOverride) {
      const selected = activeDocumentOcrLinks.find((link) => link.tablaId === activeDocumentTablaIdOverride);
      if (selected) return selected;
    }
    const firstWithRows = activeDocumentOcrLinks.find((link) => {
      const rows = activeDocumentRowsByTablaId.get(link.tablaId) ?? [];
      return rows.length > 0;
    });
    return firstWithRows ?? activeDocumentOcrLinks[0] ?? null;
  }, [activeDocumentOcrLinks, activeDocumentRowsByTablaId, activeDocumentTablaIdOverride]);

  const activeDocumentOcrColumns = useMemo(() => {
    return activeDocumentOcrLink?.columns ?? [];
  }, [activeDocumentOcrLink]);

  const activeDocumentOcrRows = useMemo(() => {
    if (!activeDocumentOcrLink) return [];
    return activeDocumentRowsByTablaId.get(activeDocumentOcrLink.tablaId) ?? [];
  }, [activeDocumentOcrLink, activeDocumentRowsByTablaId]);

  const canRetryActiveDocument = useMemo(
    () => activeDocumentOcrLinks.length > 0,
    [activeDocumentOcrLinks]
  );

  const [isDocumentDataSheetOpen, setIsDocumentDataSheetOpen] = useState(false);

  const hasAnyActiveDocumentData = useMemo(
    () => Array.from(activeDocumentRowsByTablaId.values()).some((rows) => rows.length > 0),
    [activeDocumentRowsByTablaId]
  );


  const toggleDocumentDataSheet = useCallback(() => {
    if (!hasAnyActiveDocumentData) return;
    setIsDocumentDataSheetOpen((prev) => !prev);
  }, [hasAnyActiveDocumentData]);

  useEffect(() => {
    if (!isDocumentSheetOpen) {
      setIsDocumentDataSheetOpen(false);
    }
  }, [isDocumentSheetOpen]);

  useEffect(() => {
    setFolderPage(1);
  }, [selectedFolder?.id, documentViewMode, ocrViewMode]);

  useEffect(() => {
    setIsDocumentDataSheetOpen(false);
  }, [activeDocument?.storagePath]);

  useEffect(() => {
    setActiveDocumentTablaIdOverride(null);
  }, [activeDocument?.storagePath]);

  const documentBreadcrumb = useMemo(() => {
    const doc = activeDocument ?? selectedDocument;
    if (!doc) return '';
    const folderSegments = selectedFolder ? getPathSegments(selectedFolder) : [];
    return [...folderSegments, doc.name].join(' / ');
  }, [activeDocument, getPathSegments, selectedDocument, selectedFolder]);

  const getFileIcon = useCallback((mimetype?: string) => {
    if (!mimetype) return <File className="w-8 h-8" />;
    if (mimetype.startsWith('image/')) return <ImageIcon className="w-8 h-8" />;
    if (mimetype === 'application/pdf') return <FileText className="w-8 h-8" />;
    if (mimetype.includes('zip') || mimetype.includes('rar')) return <FileArchive className="w-8 h-8" />;
    return <File className="w-8 h-8" />;
  }, []);

  const mapDataTypeToCellType = useCallback(
    (dataType: TablaColumnDataType): CellType => {
      switch (dataType) {
        case 'number':
          return 'number';
        case 'currency':
          return 'currency';
        case 'boolean':
          return 'checkbox';
        case 'date':
          return 'date';
        default:
          return 'text';
      }
    },
    []
  );

  const documentDataTableConfig = useMemo<FormTableConfig<OcrDocumentTableRow, OcrDocumentTableFilters> | null>(() => {
    if (!activeDocument || !activeDocumentOcrLink || activeDocumentOcrColumns.length === 0) {
      return null;
    }

    const tablaColumnDefs: ColumnDef<OcrDocumentTableRow>[] = activeDocumentOcrColumns.map((column) => ({
      id: column.id,
      label: column.label,
      field: column.fieldKey as ColumnField<OcrDocumentTableRow>,
      editable: true,
      cellType: mapDataTypeToCellType(column.dataType),
      required: column.required,
    }));

    const createRow = () => {
      const row = createRowFromColumns<OcrDocumentTableRow>(tablaColumnDefs);
      row.id = row.id || crypto.randomUUID();
      row.__docPath = activeDocument.storagePath ?? '';
      row.__docFileName = activeDocument.name ?? '';
      return row;
    };

    const applyDocMeta = (row: OcrDocumentTableRow) => ({
      ...row,
      __docPath: row.__docPath ?? activeDocument.storagePath ?? '',
      __docFileName: row.__docFileName ?? activeDocument.name ?? '',
      source: (row as any).source ?? 'ocr',
    });

    return {
      tableId: `ocr-doc-${obraId}-${activeDocument.id}-${activeDocumentOcrLink.tablaId}`,
      title: `Datos de ${activeDocument.name}${activeDocumentOcrLink?.tablaName ? ` · ${activeDocumentOcrLink.tablaName}` : ''}`,
      columns: tablaColumnDefs,
      defaultRows: activeDocumentOcrRows,
      createRow,
      allowAddRows: true,
      onSave: async ({ rows, dirtyRows, deletedRowIds }) => {
        if (!obraId) return;
        try {
          const res = await fetch(
            `/api/obras/${obraId}/tablas/${activeDocumentOcrLink.tablaId}/rows`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                rows: rows.map(applyDocMeta),
                dirtyRows: dirtyRows.map(applyDocMeta),
                deletedRowIds,
              }),
            }
          );
          if (!res.ok) {
            const text = await res.text();
            throw new Error(text || 'No se pudieron guardar los cambios');
          }
          toast.success('Datos actualizados');
          await buildFileTree({ skipCache: true });
        } catch (error) {
          console.error(error);
          toast.error(error instanceof Error ? error.message : 'No se pudo guardar la tabla');
        }
      },
      emptyStateMessage: 'No hay datos extraídos para este documento.',
      showInlineSearch: true,
      lockedPageSize: 10,
    };
  }, [
    activeDocument,
    activeDocumentOcrColumns,
    activeDocumentOcrLink,
    activeDocumentOcrRows,
    buildFileTree,
    mapDataTypeToCellType,
    obraId,
  ]);

  const activeDocumentTableSelector = useMemo(() => {
    if (activeDocumentOcrLinks.length <= 1 || !activeDocumentOcrLink) return null;
    return (
      <Select
        value={activeDocumentOcrLink.tablaId}
        onValueChange={(value) => setActiveDocumentTablaIdOverride(value)}
      >
        <SelectTrigger className="h-8 w-[260px]">
          <SelectValue placeholder="Tabla de extracción" />
        </SelectTrigger>
        <SelectContent>
          {activeDocumentOcrLinks.map((link) => {
            const rowsCount = activeDocumentRowsByTablaId.get(link.tablaId)?.length ?? 0;
            return (
              <SelectItem key={link.tablaId} value={link.tablaId}>
                {`${link.tablaName} (${rowsCount})`}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    );
  }, [activeDocumentOcrLink, activeDocumentOcrLinks, activeDocumentRowsByTablaId]);

  const activeFolderLinks = useMemo(() => {
    if (!selectedFolder?.ocrEnabled) return [] as OcrFolderLink[];
    const folderKey = normalizeFolderPath(
      selectedFolder.relativePath ?? selectedFolder.ocrFolderName ?? selectedFolder.name
    );
    return (
      ocrFolderLinksMap.get(folderKey) ||
      ocrFolderLinksMap.get(normalizeFolderName(folderKey)) ||
      []
    );
  }, [ocrFolderLinksMap, selectedFolder]);

  const activeFolderLink = useMemo(() => {
    if (activeFolderLinks.length === 0) return null;
    if (activeOcrTablaIdOverride) {
      const selectedLink = activeFolderLinks.find((link) => link.tablaId === activeOcrTablaIdOverride);
      if (selectedLink) return selectedLink;
    }
    return activeFolderLinks[0] ?? null;
  }, [activeFolderLinks, activeOcrTablaIdOverride]);

  const activeOcrTablaId = activeFolderLink?.tablaId ?? null;

  const handleSaveTablaRows = useCallback(
    async ({
      rows,
      dirtyRows,
      deletedRowIds,
    }: {
      rows: OcrDocumentTableRow[];
      dirtyRows: OcrDocumentTableRow[];
      deletedRowIds: string[];
    }) => {
      if (!obraId || !activeOcrTablaId) return;
      try {
        const res = await fetch(
          `/api/obras/${obraId}/tablas/${activeOcrTablaId}/rows`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rows, dirtyRows, deletedRowIds }),
          }
        );
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || 'No se pudieron guardar los cambios');
        }
        toast.success('Tabla actualizada');
        await buildFileTree({ skipCache: true });
      } catch (error) {
        console.error(error);
        toast.error(error instanceof Error ? error.message : 'No se pudo guardar la tabla');
      }
    },
    [activeOcrTablaId, buildFileTree, obraId]
  );

  const handleAddManualRow = useCallback(() => {
    const tablaId = activeOcrTablaId;
    if (!tablaId) {
      toast.error('No se encontró la tabla asociada');
      return;
    }
    if (!activeFolderLink?.columns || activeFolderLink.columns.length === 0) {
      toast.error('La tabla no tiene columnas configuradas');
      return;
    }
    setIsAddRowDialogOpen(true);
  }, [activeFolderLink?.columns, activeOcrTablaId]);

  const handleQuickUploadClick = useCallback(() => {
    const input = document.getElementById('file-upload') as HTMLInputElement | null;
    input?.click();
  }, []);

  const handleRowAdded = useCallback(async () => {
    await refreshOcrFolderLinks({ skipCache: true });
  }, [refreshOcrFolderLinks]);

  const handleOpenSchemaEditor = useCallback(() => {
    const currentColumns = activeFolderLink?.columns ?? [];
    if (!activeOcrTablaId || currentColumns.length === 0) {
      toast.error('No hay columnas para editar en esta tabla.');
      return;
    }
    const draft = currentColumns.map((column) => {
      const config =
        column.config && typeof column.config === 'object'
          ? (column.config as Record<string, unknown>)
          : {};
      const conditional =
        config.conditional && typeof config.conditional === 'object'
          ? (config.conditional as Record<string, unknown>)
          : {};
      return {
        localId: crypto.randomUUID(),
        id: column.id,
        label: column.label,
        fieldKey: column.fieldKey,
        dataType: ensureTablaDataType(column.dataType),
        required: column.required,
        formula: typeof config.formula === 'string' ? config.formula : '',
        warnBelow: typeof conditional.warnBelow === 'number' ? String(conditional.warnBelow) : '',
        warnAbove: typeof conditional.warnAbove === 'number' ? String(conditional.warnAbove) : '',
        criticalBelow:
          typeof conditional.criticalBelow === 'number'
            ? String(conditional.criticalBelow)
            : '',
        criticalAbove:
          typeof conditional.criticalAbove === 'number'
            ? String(conditional.criticalAbove)
            : '',
      } satisfies TablaSchemaDraftColumn;
    });
    setSchemaDraftColumns(draft);
    setIsSchemaDialogOpen(true);
  }, [activeFolderLink?.columns, activeOcrTablaId]);

  const handleSaveSchema = useCallback(async () => {
    const tablaId = activeOcrTablaId;
    if (!tablaId) {
      toast.error('No encontramos la tabla para guardar la estructura.');
      return;
    }
    if (schemaDraftColumns.length === 0) {
      toast.error('La tabla debe tener al menos una columna.');
      return;
    }
    try {
      const usedKeys = new Set<string>();
      const payloadColumns = schemaDraftColumns.map((column, index) => {
        const label = column.label.trim() || `Columna ${index + 1}`;
        const fieldKey = normalizeFieldKey(column.fieldKey.trim() || label);
        if (usedKeys.has(fieldKey)) {
          throw new Error(`Field key repetido: ${fieldKey}`);
        }
        usedKeys.add(fieldKey);
        const conditional: Record<string, number> = {};
        const warnBelow = toNumericValue(column.warnBelow);
        const warnAbove = toNumericValue(column.warnAbove);
        const criticalBelow = toNumericValue(column.criticalBelow);
        const criticalAbove = toNumericValue(column.criticalAbove);
        if (warnBelow != null) conditional.warnBelow = warnBelow;
        if (warnAbove != null) conditional.warnAbove = warnAbove;
        if (criticalBelow != null) conditional.criticalBelow = criticalBelow;
        if (criticalAbove != null) conditional.criticalAbove = criticalAbove;
        const config: Record<string, unknown> = {};
        if (column.formula.trim()) config.formula = column.formula.trim();
        if (Object.keys(conditional).length > 0) config.conditional = conditional;
        return {
          id: column.id,
          label,
          fieldKey,
          dataType: ensureTablaDataType(column.dataType),
          required: column.required,
          config,
        };
      });
      setIsSavingSchema(true);
      const res = await fetch(`/api/obras/${obraId}/tablas/${tablaId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ columns: payloadColumns }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error ?? 'No se pudo actualizar el esquema');
      }
      await refreshOcrFolderLinks({ skipCache: true });
      setIsSchemaDialogOpen(false);
      toast.success('Esquema de tabla actualizado.');
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar el esquema');
    } finally {
      setIsSavingSchema(false);
    }
  }, [activeOcrTablaId, obraId, refreshOcrFolderLinks, schemaDraftColumns]);

  const folderOrders = useMemo<MaterialOrder[]>(() => {
    if (!selectedFolder?.ocrEnabled) return [];
    return (activeFolderLink?.orders ?? (selectedFolder.extractedData || [])) as MaterialOrder[];
  }, [activeFolderLink, selectedFolder]);

  const ocrTableRows = useMemo<OcrDocumentTableRow[]>(() => {
    if (!selectedFolder?.ocrEnabled) return [];
    const tablaRows = (activeFolderLink?.rows || []) as TablaDataRow[];
    const columns = activeFolderLink?.columns || [];
    if (tablaRows.length === 0 || columns.length === 0) return [];
    return tablaRows.map((row) => {
      const data = (row?.data as Record<string, unknown>) ?? {};
      const mapped: OcrDocumentTableRow = { id: row.id };
      columns.forEach((column) => {
        mapped[column.fieldKey] = data[column.fieldKey];
      });
      columns.forEach((column) => {
        const formula =
          column.config && typeof column.config.formula === 'string'
            ? column.config.formula.trim()
            : '';
        if (!formula) return;
        const computed = evaluateTablaFormula(formula, mapped);
        mapped[column.fieldKey] = computed;
      });
      if (typeof data.__docPath === 'string') {
        mapped.__docPath = data.__docPath;
      }
      if (typeof data.__docFileName === 'string') {
        mapped.__docFileName = data.__docFileName;
      }
      return mapped;
    });
  }, [activeFolderLink, selectedFolder]);

  const ocrFilteredRowCount = useMemo(() => {
    if (!selectedFolder?.ocrEnabled) return 0;
    if (!ocrDocumentFilterPath || documentViewMode !== 'table') {
      return ocrTableRows.length;
    }
    return ocrTableRows.filter((row) => {
      const docPath = typeof (row as Record<string, unknown>).__docPath === 'string'
        ? (row as Record<string, unknown>).__docPath
        : null;
      return docPath === ocrDocumentFilterPath;
    }).length;
  }, [documentViewMode, ocrDocumentFilterPath, ocrTableRows, selectedFolder?.ocrEnabled]);

  const ocrOrderItemRows = useMemo<OcrOrderItemRow[]>(() => {
    if (!selectedFolder?.ocrEnabled) return [];
    const orders = folderOrders;
    const query = tableSearchQuery.trim().toLowerCase();
    const rows: OcrOrderItemRow[] = [];

    orders.forEach(order => {
      const nroOrden = order.nroOrden || 'Sin número';
      const proveedor = order.proveedor || 'Sin proveedor';
      const solicitante = order.solicitante || 'Sin solicitante';

      order.items.forEach((item, idx) => {
        const row: OcrOrderItemRow = {
          id: `${order.id}-${item.id ?? idx}`,
          orderId: order.id,
          nroOrden,
          proveedor,
          solicitante,
          cantidad: item.cantidad,
          unidad: item.unidad,
          material: item.material,
          precioUnitario: item.precioUnitario,
          total: item.precioUnitario * item.cantidad,
        };

        const matchesQuery =
          !query ||
          row.nroOrden.toLowerCase().includes(query) ||
          row.proveedor.toLowerCase().includes(query) ||
          row.solicitante.toLowerCase().includes(query) ||
          row.material.toLowerCase().includes(query);

        if (matchesQuery) {
          rows.push(row);
        }
      });
    });

    return rows;
  }, [folderOrders, selectedFolder, tableSearchQuery]);

  const ocrFormTableConfig = useMemo<FormTableConfig<OcrDocumentTableRow, OcrDocumentTableFilters>>(() => {
    const tablaColumns = activeFolderLink?.columns ?? [];
    const canEditTabla = Boolean(tablaColumns.length > 0 && activeOcrTablaId);
    const tablaColumnDefs: ColumnDef<OcrDocumentTableRow>[] = tablaColumns.map((column) => ({
      id: column.id,
      label: column.label,
      field: column.fieldKey as ColumnField<OcrDocumentTableRow>,
      editable:
        canEditTabla &&
        !(
          column.config &&
          typeof column.config.formula === 'string' &&
          column.config.formula.trim().length > 0
        ),
      cellType: mapDataTypeToCellType(column.dataType),
      required: column.required,
      cellClassName: (row) => getConditionalClass(row[column.fieldKey], column.config),
    }));
    const docSourceColumn: ColumnDef<OcrDocumentTableRow> = {
      id: 'doc-source',
      label: 'Documento origen',
      field: '__docFileName' as ColumnField<OcrDocumentTableRow>,
      editable: false,
      cellType: 'text',
      enableHide: false,
      cellConfig: {
        renderReadOnly: ({ row }: { value: unknown; row: OcrDocumentTableRow; highlightQuery: string }) => (
          <OcrDocumentSourceCell
            row={row}
            obraId={obraId}
            documentsByStoragePath={documentsByStoragePath}
            supabase={supabase}
          />
        ),
      },
      cellMenuItems: [
        {
          id: 'filter-doc',
          label: 'Filtrar por este documento',
          onSelect: (row: OcrDocumentTableRow) => {
            const docPath = typeof (row as Record<string, unknown>).__docPath === 'string'
              ? (row as Record<string, unknown>).__docPath as string
              : null;
            const docName = typeof (row as Record<string, unknown>).__docFileName === 'string'
              ? (row as Record<string, unknown>).__docFileName as string
              : null;
            handleFilterRowsByDocument(docPath, docName);
          },
        },
        {
          id: 'preview-doc',
          label: 'Ver documento',
          onSelect: (row: OcrDocumentTableRow) => {
            const docPath = typeof (row as Record<string, unknown>).__docPath === 'string'
              ? (row as Record<string, unknown>).__docPath as string
              : null;
            void handleOpenDocumentSheetByPath(docPath);
          },
        },
      ],
    };
    const includeDocSourceColumn = activeFolderLink?.dataInputMethod !== 'manual';
    const allColumns: ColumnDef<OcrDocumentTableRow>[] = includeDocSourceColumn
      ? [docSourceColumn, ...tablaColumnDefs]
      : [...tablaColumnDefs];

    // Build initial empty column filters for all tabla columns
    const buildEmptyColumnFilters = (): Record<string, string | { min: string; max: string }> => {
      const cf: Record<string, string | { min: string; max: string }> = {};
      tablaColumns.forEach((col) => {
        if (col.dataType === 'number' || col.dataType === 'currency') {
          cf[col.fieldKey] = { min: '', max: '' };
        } else {
          cf[col.fieldKey] = '';
        }
      });
      return cf;
    };

    return {
      tableId: `ocr-orders-${obraId}-${selectedFolder?.id ?? 'none'}-${activeOcrTablaId ?? 'none'}`,
      title: activeFolderLink?.tablaName ?? selectedFolder?.name ?? 'Tabla OCR',
      searchPlaceholder: 'Buscar en esta tabla',
      columns: allColumns,
      allowAddRows: false,
      enableColumnResizing: true,
      createFilters: (): OcrDocumentTableFilters => ({
        docPath: ocrDocumentFilterPath,
        columnFilters: buildEmptyColumnFilters(),
      }),
      renderFilters: ({ filters: currentFilters, onChange }) => {
        const keywordGroups: Array<{
          id: string;
          title: string;
          icon: typeof Type;
          keywords: string[];
        }> = [
            { id: 'ordenes', title: 'Órdenes', icon: ClipboardList, keywords: ['orden', 'oc', 'compra', 'pedido', 'nro', 'numero'] },
            { id: 'fechas', title: 'Fechas', icon: CalendarDays, keywords: ['fecha', 'venc', 'emision', 'entrega', 'pago'] },
            { id: 'personas', title: 'Proveedor / Solicitante', icon: Users, keywords: ['proveedor', 'solicitante', 'cliente', 'contratista'] },
            { id: 'obra', title: 'Obra / Proyecto', icon: Building2, keywords: ['obra', 'proyecto', 'ubicacion', 'site'] },
            { id: 'cantidades', title: 'Cantidades', icon: Package, keywords: ['cantidad', 'unidad', 'unid', 'qty', 'medida'] },
            { id: 'importes', title: 'Importes', icon: DollarSignIcon, keywords: ['precio', 'importe', 'monto', 'total', 'subtotal', 'iva', 'neto', 'bruto', 'pagar', 'costo', 'coste'] },
            { id: 'descripcion', title: 'Descripción', icon: FileTextIcon2, keywords: ['descripcion', 'detalle', 'concepto', 'material', 'item', 'articulo', 'producto', 'servicio'] },
          ];

        const groupedColumns = new Map<string, OcrTablaColumn[]>();
        keywordGroups.forEach((group) => groupedColumns.set(group.id, []));
        groupedColumns.set('otros', []);

        const normalize = (value: string) =>
          value
            .toLowerCase()
            .normalize('NFD')
            .replace(/\p{Diacritic}/gu, '');

        tablaColumns.forEach((col) => {
          const haystack = normalize(`${col.label} ${col.fieldKey}`);
          const group = keywordGroups.find((g) => g.keywords.some((kw) => haystack.includes(kw)));
          const groupId = group ? group.id : 'otros';
          groupedColumns.get(groupId)?.push(col);
        });

        const getActiveCount = (cols: OcrTablaColumn[]) =>
          cols.reduce((count, col) => {
            const v = currentFilters.columnFilters?.[col.fieldKey];
            if (typeof v === 'string') {
              return v.trim().length > 0 ? count + 1 : count;
            }
            if (typeof v === 'object' && v !== null) {
              return (v.min ?? '').trim().length > 0 || (v.max ?? '').trim().length > 0 ? count + 1 : count;
            }
            return count;
          }, 0);

        return (
          <div className="space-y-3">
            {keywordGroups.map((group) => {
              const cols = groupedColumns.get(group.id) ?? [];
              if (cols.length === 0) return null;
              return (
                <FilterSection
                  key={group.id}
                  title={group.title}
                  icon={group.icon}
                  activeCount={getActiveCount(cols)}
                  defaultOpen
                >
                  <div className="space-y-3">
                    {cols.map((col) => {
                      if (col.dataType === 'number' || col.dataType === 'currency') {
                        const v = currentFilters.columnFilters?.[col.fieldKey];
                        const rangeVal = typeof v === 'object' && v !== null ? v : { min: '', max: '' };
                        return (
                          <RangeInputGroup
                            key={col.id}
                            label={col.label}
                            minValue={rangeVal.min}
                            maxValue={rangeVal.max}
                            onMinChange={(val) =>
                              onChange((prev) => ({
                                ...prev,
                                columnFilters: {
                                  ...prev.columnFilters,
                                  [col.fieldKey]: {
                                    ...(typeof prev.columnFilters?.[col.fieldKey] === 'object' && prev.columnFilters[col.fieldKey] !== null
                                      ? prev.columnFilters[col.fieldKey] as { min: string; max: string }
                                      : { min: '', max: '' }),
                                    min: val,
                                  },
                                },
                              }))
                            }
                            onMaxChange={(val) =>
                              onChange((prev) => ({
                                ...prev,
                                columnFilters: {
                                  ...prev.columnFilters,
                                  [col.fieldKey]: {
                                    ...(typeof prev.columnFilters?.[col.fieldKey] === 'object' && prev.columnFilters[col.fieldKey] !== null
                                      ? prev.columnFilters[col.fieldKey] as { min: string; max: string }
                                      : { min: '', max: '' }),
                                    max: val,
                                  },
                                },
                              }))
                            }
                          />
                        );
                      }
                      return (
                        <TextFilterInput
                          key={col.id}
                          label={col.label}
                          value={(currentFilters.columnFilters?.[col.fieldKey] as string) ?? ''}
                          onChange={(v) =>
                            onChange((prev) => ({
                              ...prev,
                              columnFilters: { ...prev.columnFilters, [col.fieldKey]: v },
                            }))
                          }
                          placeholder={`Buscar en ${col.label}...`}
                        />
                      );
                    })}
                  </div>
                </FilterSection>
              );
            })}

            {(groupedColumns.get('otros') ?? []).length > 0 && (
              <FilterSection
                title="Otros"
                icon={Type}
                activeCount={getActiveCount(groupedColumns.get('otros') ?? [])}
                defaultOpen
              >
                <div className="space-y-3">
                  {(groupedColumns.get('otros') ?? []).map((col) => {
                    if (col.dataType === 'number' || col.dataType === 'currency') {
                      const v = currentFilters.columnFilters?.[col.fieldKey];
                      const rangeVal = typeof v === 'object' && v !== null ? v : { min: '', max: '' };
                      return (
                        <RangeInputGroup
                          key={col.id}
                          label={col.label}
                          minValue={rangeVal.min}
                          maxValue={rangeVal.max}
                          onMinChange={(val) =>
                            onChange((prev) => ({
                              ...prev,
                              columnFilters: {
                                ...prev.columnFilters,
                                [col.fieldKey]: {
                                  ...(typeof prev.columnFilters?.[col.fieldKey] === 'object' && prev.columnFilters[col.fieldKey] !== null
                                    ? prev.columnFilters[col.fieldKey] as { min: string; max: string }
                                    : { min: '', max: '' }),
                                  min: val,
                                },
                              },
                            }))
                          }
                          onMaxChange={(val) =>
                            onChange((prev) => ({
                              ...prev,
                              columnFilters: {
                                ...prev.columnFilters,
                                [col.fieldKey]: {
                                  ...(typeof prev.columnFilters?.[col.fieldKey] === 'object' && prev.columnFilters[col.fieldKey] !== null
                                    ? prev.columnFilters[col.fieldKey] as { min: string; max: string }
                                    : { min: '', max: '' }),
                                  max: val,
                                },
                              },
                            }))
                          }
                        />
                      );
                    }
                    return (
                      <TextFilterInput
                        key={col.id}
                        label={col.label}
                        value={(currentFilters.columnFilters?.[col.fieldKey] as string) ?? ''}
                        onChange={(v) =>
                          onChange((prev) => ({
                            ...prev,
                            columnFilters: { ...prev.columnFilters, [col.fieldKey]: v },
                          }))
                        }
                        placeholder={`Buscar en ${col.label}...`}
                      />
                    );
                  })}
                </div>
              </FilterSection>
            )}

            {tablaColumns.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No hay columnas configuradas para filtrar.
              </p>
            )}
          </div>
        );
      },
      countActiveFilters: (filters: OcrDocumentTableFilters) => {
        let count = 0;
        if (filters.docPath) count += 1;
        const cf = filters.columnFilters ?? {};
        Object.values(cf).forEach((v) => {
          if (typeof v === 'string') {
            if (v.trim().length > 0) count += 1;
          } else if (typeof v === 'object' && v !== null) {
            if ((v.min ?? '').trim().length > 0 || (v.max ?? '').trim().length > 0) count += 1;
          }
        });
        return count;
      },
      applyFilters: (row: OcrDocumentTableRow, filters: OcrDocumentTableFilters) => {
        // Document path filter
        if (filters.docPath) {
          const docPath = typeof (row as Record<string, unknown>).__docPath === 'string'
            ? (row as Record<string, unknown>).__docPath
            : null;
          if (docPath !== filters.docPath) return false;
        }
        // Column filters
        const cf = filters.columnFilters ?? {};
        for (const col of tablaColumns) {
          const filterVal = cf[col.fieldKey];
          if (!filterVal) continue;
          const cellValue = (row as Record<string, unknown>)[col.fieldKey];

          if (typeof filterVal === 'string' && filterVal.trim().length > 0) {
            // Text / date / boolean filter
            if (col.dataType === 'boolean') {
              const boolStr = String(cellValue ?? '').toLowerCase();
              if (filterVal === 'true' && boolStr !== 'true') return false;
              if (filterVal === 'false' && boolStr !== 'false') return false;
            } else {
              const cellStr = String(cellValue ?? '').toLowerCase();
              if (!cellStr.includes(filterVal.trim().toLowerCase())) return false;
            }
          } else if (typeof filterVal === 'object' && filterVal !== null) {
            // Number / currency range filter
            const numVal = typeof cellValue === 'number' ? cellValue : Number(cellValue);
            if (!Number.isFinite(numVal)) {
              // If cell has no valid number and filter is set, exclude
              if (filterVal.min.trim() || filterVal.max.trim()) return false;
              continue;
            }
            if (filterVal.min.trim()) {
              const minNum = Number(filterVal.min);
              if (Number.isFinite(minNum) && numVal < minNum) return false;
            }
            if (filterVal.max.trim()) {
              const maxNum = Number(filterVal.max);
              if (Number.isFinite(maxNum) && numVal > maxNum) return false;
            }
          }
        }
        return true;
      },
      defaultRows: ocrTableRows,
      emptyStateMessage: 'Sin datos disponibles para esta tabla.',
      showInlineSearch: true,
      rowClassName: (row) => {
        for (const col of tablaColumns) {
          const style = getConditionalClass(row[col.fieldKey], col.config);
          if (style?.includes('bg-red-100')) return 'bg-red-50/70';
          if (style?.includes('bg-amber-100')) return 'bg-amber-50/70';
        }
        return undefined;
      },
      onSave: canEditTabla ? handleSaveTablaRows : undefined,
      footerActions: activeFolderLink ? (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={handleAddManualRow}
            disabled={activeFolderLink.dataInputMethod === 'ocr'}
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            Agregar fila
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={handleQuickUploadClick}
            disabled={activeFolderLink.dataInputMethod === 'manual'}
            className="gap-2"
          >
            <Upload className="w-4 h-4" />
            Subir documento
          </Button>
        </div>
      ) : null,
      toolbarActions: activeOcrTablaId ? (
        <div className="flex items-center gap-2">
          {activeFolderLinks.length > 1 && (
            <Select
              value={activeOcrTablaId}
              onValueChange={(value) => setActiveOcrTablaIdOverride(value)}
            >
              <SelectTrigger className="h-8 w-[280px]">
                <SelectValue placeholder="Seleccionar tabla" />
              </SelectTrigger>
              <SelectContent>
                {activeFolderLinks.map((link) => (
                  <SelectItem key={link.tablaId} value={link.tablaId}>
                    {link.tablaName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {/* <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleOpenSchemaEditor}
            className="gap-1.5"
          >
            <Layers className="w-3.5 h-3.5" />
            Editar columnas
          </Button> */}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => router.push(`/excel/${obraId}/tabla/${activeOcrTablaId}/reporte`)}
            className="gap-1.5"
          >
            <ClipboardList className="w-3.5 h-3.5" />
            Generar reporte
          </Button>
        </div>
      ) : null,
    };
  }, [activeFolderLink, activeFolderLinks, activeOcrTablaId, clearOcrDocumentFilter, documentViewMode, documentsByStoragePath, handleAddManualRow, handleFilterRowsByDocument, handleOpenDocumentSheetByPath, handleOpenSchemaEditor, handleQuickUploadClick, handleSaveTablaRows, mapDataTypeToCellType, obraId, ocrDocumentFilterName, ocrDocumentFilterPath, ocrTableRows, router, selectedFolder?.id, supabase]);

  const handleRetryDocumentOcr = useCallback(
    async (doc: FileSystemItem | null) => {
      if (!doc || !doc.storagePath) {
        toast.error('Seleccioná un documento válido para reprocesar.');
        return;
      }
      const links = resolveOcrLinksForDocument(doc);
      if (links.length === 0) {
        toast.error('Este documento no está vinculado a una tabla OCR.');
        return;
      }
      try {
        setRetryingDocumentId(doc.id);
        const formData = new FormData();
        formData.append('existingBucket', 'obra-documents');
        formData.append('existingPath', doc.storagePath);
        formData.append('existingFileName', doc.name);
        formData.append('tablaIds', JSON.stringify([...new Set(links.map((link) => link.tablaId))]));
        const ext = doc.name.toLowerCase().split('.').pop() ?? '';
        const isSpreadsheet = ext === 'csv' || ext === 'xlsx' || ext === 'xls';
        const response = await fetch(
          isSpreadsheet
            ? `/api/obras/${obraId}/tablas/import/spreadsheet-multi?skipStorage=1`
            : `/api/obras/${obraId}/tablas/import/ocr-multi?skipStorage=1`,
          {
            method: 'POST',
            body: formData,
          }
        );
        const payload = await response.json().catch(() => ({} as any));
        if (!response.ok) {
          const limitMessage =
            typeof payload?.error === 'string'
              ? payload.error
              : isSpreadsheet
                ? 'No se pudo reprocesar la planilla.'
                : 'Superaste el límite de tokens de IA de tu plan.';
          if (!isSpreadsheet && response.status === 402) {
            toast.warning(limitMessage);
          } else {
            toast.error(limitMessage);
          }
          return;
        }
        const perTableResults = Array.isArray(payload?.perTable) ? payload.perTable : [];
        if (perTableResults.length > 0) {
          perTableResults.forEach((result: { tablaName?: string; inserted?: number }) => {
            if ((result?.inserted ?? 0) > 0) {
              toast.success(`${result?.tablaName ?? 'Tabla'}: ${result.inserted} filas actualizadas.`);
            } else {
              toast.warning(`${result?.tablaName ?? 'Tabla'}: sin filas detectadas.`);
            }
          });
        } else {
          toast.success('Documento reprocesado en tablas OCR.');
        }
        await buildFileTree({ skipCache: true });
      } catch (error) {
        console.error('Error retrying OCR document', error);
        toast.error('No se pudo reprocesar el documento.');
      } finally {
        setRetryingDocumentId(null);
      }
    },
    [buildFileTree, obraId, resolveOcrLinksForDocument]
  );

  const ocrOrderItemsTableConfig = useMemo<FormTableConfig<OcrOrderItemRow, OcrOrderItemFilters>>(() => {
    return {
      tableId: `ocr-order-items-${obraId}-${selectedFolder?.id ?? 'none'}`,
      title: 'Ítems OCR',
      searchPlaceholder: 'Buscar ítems...',
      columns: [
        { id: 'nroOrden', label: 'N° de orden', field: 'nroOrden', editable: false, cellType: 'text' },
        { id: 'proveedor', label: 'Proveedor', field: 'proveedor', editable: false, cellType: 'text' },
        { id: 'solicitante', label: 'Solicitante', field: 'solicitante', editable: false, cellType: 'text' },
        { id: 'cantidad', label: 'Cant.', field: 'cantidad', editable: false, cellType: 'number' },
        { id: 'unidad', label: 'Unidad', field: 'unidad', editable: false, cellType: 'text' },
        { id: 'material', label: 'Material', field: 'material', editable: false, cellType: 'text' },
        { id: 'precioUnitario', label: 'P. Unit.', field: 'precioUnitario', editable: false, cellType: 'currency' },
        { id: 'total', label: 'Total', field: 'total', editable: false, cellType: 'currency' },
      ],
      createFilters: () => ({} as OcrOrderItemFilters),
      defaultRows: ocrOrderItemRows,
      tabFilters: [],
      emptyStateMessage: 'Sin ítems registrados',
    };
  }, [obraId, ocrOrderItemRows, selectedFolder?.id]);

  function NotchTail({ side = "right", className = "" }) {
    return (
      <svg
        width="60"
        height="42"
        viewBox="0 0 60 42"
        preserveAspectRatio="none"
        aria-hidden="true"
        className={[
          "pointer-events-none absolute bottom-[-1px] h-[42px] w-[60px]",
          side === "right" ? "right-[-59px]" : "left-[-59px] scale-x-[-1]",
          className,
        ].join(" ")}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Fill */}
        <path
          d="M0 1H7.0783C14.772 1 21.7836 5.41324 25.111 12.3501L33.8889 30.6498C37.2164 37.5868 44.228 42 51.9217 42H60H0V1Z"
          className="fill-[var(--notch-bg)]"
        />
        {/* Stroke */}
        <path
          d="M0 1H7.0783C14.772 1 21.7836 5.41324 25.111 12.3501L33.8889 30.6498C37.2164 37.5868 44.228 42 51.9217 42H60"
          className="fill-none stroke-[var(--notch-stroke)]"
          strokeWidth="1"
        />
      </svg>
    );
  }


  // Render main content
  const renderMainContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-8 h-8 animate-spin text-stone-400" />
        </div>
      );
    }

    if (!selectedFolder) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-stone-400">
          <Folder className="w-16 h-16 mb-4 opacity-20" />
          <p>Selecciona una carpeta para ver su contenido</p>
        </div>
      );
    }

    // If OCR folder is selected, show either table or documents view based on toggle
    // if (selectedFolder.ocrEnabled) {
    //   if (ocrViewMode === 'table') {
    //     return renderOcrTableView();
    //   }
    //   // Fall through to regular folder view for 'documents' mode
    // }

    const isOcrDocumentsMode = selectedFolder.ocrEnabled && ocrViewMode === 'documents';

    // Regular folder - grid/list view
    const items = selectedFolder.children || [];
    const folders = items.filter(item => item.type === 'folder');
    const files = items.filter(item => item.type === 'file' && item.name !== '.keep');

    // Unified folder header (tab style) for both OCR and normal folders
    const hasTablaSchema = Boolean(activeFolderLink?.columns && activeFolderLink.columns.length > 0);
    const showArchivosTablaToggle = selectedFolder.ocrEnabled && hasTablaSchema && activeFolderLink?.dataInputMethod !== "manual";
    const folderContentHeader = (
      <div className="mb-0">
        <div className="flex flex-wrap items-end justify-between gap-3">
          {/* LEFT TAB */}
          <div
            className="relative z-10 flex items-center gap-3 border border-b-0 -mb-[2px] border-stone-200 bg-white h-full px-4 py-3 rounded-tr-md rounded-tl-xl overflow-visible"
            style={
              {
                "--notch-bg": "white",
                "--notch-stroke": "rgb(231 229 228)", // stone-200
              } as React.CSSProperties
            }
          >
            {/* Tail on the right */}
            <NotchTail side="right" className={cn("h-[53px] mb-[2px]", !selectedFolder.ocrEnabled ? "h-[54px] mb-[1px]" : "")} />

            {selectedFolder.ocrEnabled ? (
              <Table2 className={`w-5 h-5 ${getFolderIconColor(activeFolderLink?.dataInputMethod)}`} />
            ) : (
              <Folder className="w-5 h-5 text-stone-500" />
            )}
            <h2 className="text-xl font-semibold text-stone-800">{selectedFolder.name}</h2>
            <span className="text-sm text-stone-500">
              {selectedFolder.ocrEnabled && documentViewMode === "table"
                ? `(${ocrFilteredRowCount} filas)`
                : `(${files.length} archivos)`}
            </span>
          </div>

          {/* RIGHT TAB */}
          <div
            className="relative z-10 flex flex-wrap items-center gap-2 border border-b-0 -mb-[2px] border-stone-200 bg-white h-full px-4 pl-1 pt-3 pb-0 rounded-tl-md rounded-tr-xl overflow-visible"
            style={
              {
                "--notch-bg": "white",
                "--notch-stroke": "rgb(231 229 228)", // stone-200
              } as React.CSSProperties
            }
          >
            {/* Tail on the left */}
            <NotchTail side="left" className={cn(" mb-[2px]", activeFolderLink?.dataInputMethod === "manual" || !selectedFolder.ocrEnabled ? "h-[46px] mb-[1px]" : "h-[50px]")} />

            {/* Only show Archivos/Tabla toggle for OCR folders with tabla schema and file viewing */}
            {showArchivosTablaToggle && (
              <div className="inline-flex items-center rounded-md border border-stone-200 bg-stone-50 p-0.5">
                <Button
                  type="button"
                  variant={documentViewMode === "cards" ? "default" : "ghost"}
                  size="sm"
                  className="gap-1.5 h-8 px-3"
                  aria-pressed={documentViewMode === "cards"}
                  onClick={() => handleDocumentViewModeChange("cards")}
                >
                  <Folder className="w-3.5 h-3.5" />
                  Archivos
                </Button>
                <Button
                  type="button"
                  variant={documentViewMode === "table" ? "default" : "ghost"}
                  size="sm"
                  className="gap-1.5 h-8 px-3"
                  aria-pressed={documentViewMode === "table"}
                  onClick={() => handleDocumentViewModeChange("table")}
                >
                  <Table2 className="w-3.5 h-3.5" />
                  Tabla
                </Button>
              </div>
            )}

            <Button type="button" variant="secondary" size="sm" onClick={handleQuickUploadClick} className="gap-1.5">
              <Upload className="w-3.5 h-3.5" />
              Subir archivos
            </Button>
          </div>
        </div>

        {selectedFolder.ocrEnabled && hasTablaSchema && ocrDocumentFilterPath && documentViewMode === 'table' && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-amber-700 px-4">
            <Badge variant="outline" className="text-[11px] bg-amber-50 border-amber-200 text-amber-800">
              Filtrando: {ocrDocumentFilterName ?? 'Documento seleccionado'}
            </Badge>
            <Button
              variant="ghost"
              size="xs"
              onClick={clearOcrDocumentFilter}
              className="h-6 px-2 text-amber-800 hover:text-amber-900"
            >
              Ver todos
            </Button>
          </div>
        )}
      </div>
    );

    if (isOcrDocumentsMode && documentViewMode === 'table') {
      const hasTablaSchema = Boolean(activeFolderLink?.columns && activeFolderLink.columns.length > 0);
      return (
        <div className="h-full flex flex-col">
          {folderContentHeader}
          <div className="flex-1 rounded-lg border rounded-t-none border-stone-200 bg-white shadow-sm overflow-hidden pt-0 px-4">
            {!hasTablaSchema ? (
              <div className="flex h-full flex-col items-center justify-center text-sm text-stone-500 p-6 text-center">
                <Table2 className="w-10 h-10 mb-3 text-stone-300" />
                <p>Esta carpeta de datos todavía no tiene columnas configuradas.</p>
                <p>Configuralas desde la pestaña Tablas para ver los datos acá.</p>
              </div>
            ) : ocrTableRows.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-sm text-stone-500 p-6 text-center">
                <Table2 className="w-10 h-10 mb-3 text-stone-300" />
                {activeFolderLink?.dataInputMethod === 'manual' ? (
                  <>
                    <p>Esta tabla no tiene filas todavía.</p>
                    <p className="text-xs text-stone-400 mt-1">Agregá filas manualmente usando el botón de abajo.</p>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleAddManualRow}
                      className="mt-4 gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Agregar fila
                    </Button>
                  </>
                ) : activeFolderLink?.dataInputMethod === 'ocr' ? (
                  <>
                    <p>No hay filas extraídas para esta tabla.</p>
                    <p className="text-xs text-stone-400 mt-1">Subí documentos para extraer datos automáticamente.</p>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => document.getElementById('file-upload')?.click()}
                      className="mt-4 gap-2"
                    >
                      <Upload className="w-4 h-4" />
                      Subir documentos
                    </Button>
                  </>
                ) : (
                  <>
                    <p>Esta tabla no tiene filas todavía.</p>
                    <p className="text-xs text-stone-400 mt-1">Agregá filas manualmente o subí documentos para extraer datos.</p>
                    <div className="flex gap-2 mt-4">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleAddManualRow}
                        className="gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Agregar fila
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => document.getElementById('file-upload')?.click()}
                        className="gap-2"
                      >
                        <Upload className="w-4 h-4" />
                        Subir documentos
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="flex flex-col h-full">
                <FormTable key={ocrFormTableConfig.tableId} config={ocrFormTableConfig} className="max-h-[50vh] " />
              </div>
            )}
          </div>
        </div>
      );
    }

    const folderBody = (() => {
      if (folders.length === 0 && files.length === 0) {
        return (
          <div className="flex h-full flex-col items-center justify-start pt-40 text-sm text-stone-500 p-6 text-center rounded-lg bg-white">
            <Folder className="w-10 h-10 mb-3 text-stone-300" />
            <p>Esta carpeta está vacía.</p>
            <p className="text-xs text-stone-400 mt-1">Subí archivos para comenzar.</p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => document.getElementById('file-upload')?.click()}
              className="mt-4 gap-2"
            >
              <Upload className="w-4 h-4" />
              Subir archivos
            </Button>
          </div>
        );
      }

      return (
        <div className="h-full min-h-0 flex flex-col">
          {folders.length > 0 && (
            <div className="px-4 pt-4 pb-3 border-b border-stone-100">
              <div className="overflow-x-auto overflow-y-hidden">
                <div className="flex items-start gap-4 w-max px-2 pb-1 ">
                  {folders.map((item) => {
                    const isDragTarget = draggedFolderId === item.id;
                    const folderLookupKey = normalizeFolderPath((item.relativePath ?? item.ocrFolderName ?? item.name));
                    const folderLink = item.ocrEnabled
                      ? (ocrFolderMap.get(folderLookupKey) || ocrFolderMap.get(normalizeFolderName(folderLookupKey)) || null)
                      : null;
                    const isManualOnly = Boolean(folderLink && folderLink.dataInputMethod === 'manual');
                    const rowCount = isManualOnly ? (folderLink?.rows?.length ?? 0) : 0;
                    const fileCount = getFolderFileCount(item);
                    const countValue = isManualOnly ? rowCount : fileCount;
                    const countLabel = isManualOnly ? 'filas' : 'archivos';
                    const isOcrEnabled = item.ocrEnabled;
                    return (
                      <div key={item.id} className="group cursor-default transition-colors flex flex-col items-center justify-end gap-2 shrink-0 h-[105px]">
                        <div
                          className={` flex flex-col items-start gap-2 p-3 pb-1 ml-1 mb-1 w-[120px] h-[85px] border rounded-lg hover:bg-stone-100 transition-colors relative 
                            ${isDragTarget ? 'ring-2 ring-amber-500 ring-offset-6' : ''}
                            ${isOcrEnabled ? "bg-linear-to-b from-amber-500 to-amber-700" : "bg-linear-to-b from-stone-500 to-stone-700"}
                            `}
                          onClick={() => handleFolderClick(item)}
                          onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, item }); }}
                          onDragEnter={(event) => handleFolderDragEnter(event, item)}
                          onDragOver={(event) => handleFolderDragOver(event, item)}
                          onDragLeave={(event) => handleFolderDragLeave(event, item)}
                          onDrop={(event) => handleFolderDrop(event, item)}
                        >
                          <div className="flex flex-col items-center justify-end w-full h-full">
                            {countValue > 0 && (
                              <span className={cn("bg-stone-100 bg-linear-to-b from-stone-100 to-stone-200 border  w-[100px] h-[80px] group-hover:-top-4 -top-2 absolute left-1/2 -translate-x-1/2 transition-all ease-in-out duration-[200ms]", isDragTarget ? 'border-2 border-amber-500 -top-4' : '')} />
                            )}
                            <FolderFront
                              firstStopColor={isOcrEnabled ? "#fe9a00" : "#79716b"}
                              secondStopColor={isOcrEnabled ? "#fb8634" : "#57534d"}
                              className={cn("w-[140px] h-[80px] absolute -bottom-1 -left-3 transform origin-[50%_100%] group-hover:transform-[perspective(800px)_rotateX(-30deg)] transition-transform duration-300", isDragTarget ? 'transform-[perspective(800px)_rotateX(-40deg)]' : '')} />
                            {/* {item.ocrEnabled ? (
                              <Table2 className={`w-10 h-10 ${getFolderIconColor(item.dataInputMethod)} absolute mx-auto top-5 transform origin-[50%_100%] group-hover:transform-[perspective(800px)_rotateX(-30deg)] transition-transform duration-300`} />
                            ) : (
                              <Folder className="w-10 h-10 text-red-500 mt-2 absolute mx-auto top-5 transform origin-[50%_100%] group-hover:transform-[perspective(800px)_rotateX(-30deg)] transition-transform duration-300" />
                            )} */}
                            <span className="text-sm text-center truncate w-full text-white z-10" title={item.name}>
                              {item.name}
                            </span>
                            {/* {countValue > 0 && (
                              <span className="text-[10px] text-center w-full text-stone-200 z-10">
                                {countValue} {countLabel}
                              </span>
                            )} */}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <div
            className={`flex-1 min-h-0 overflow-y-auto p-4 transition-colors ${isGlobalFileDragActive && !draggedFolderId ? 'border-2 border-dashed border-amber-500 bg-amber-50/60' : ''}`}
            onDragEnter={handleDocumentAreaDragEnter}
            onDragOver={handleDocumentAreaDragOver}
            onDragLeave={handleDocumentAreaDragLeave}
            onDrop={handleDocumentAreaDrop}
          >
            {files.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-sm text-stone-500 p-6 text-center rounded-lg bg-white">
                <File className="w-10 h-10 mb-3 text-stone-300" />
                <p>No hay archivos en esta carpeta.</p>
                <p className="text-xs text-stone-400 mt-1">Subí archivos para comenzar.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-10 gap-4 rounded-lg">
                {files.map((item) => (
                  <div key={item.id} className="group cursor-default transition-colors flex flex-col items-center gap-2">
                    <div
                      className="flex flex-col items-start gap-2 p-3 w-[120px] h-[145px] border rounded-none transition-colors bg-stone-100 relative"
                      onClick={() => handleDocumentClick(item, selectedFolder, { preserveFilter: true })}
                      onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, item }); }}
                    >
                      <div className="flex flex-col items-center justify-end w-full h-full">
                        <span className="bg-stone-100 border-stone-300 border-8 absolute top-0 right-0 z-10" />
                        <span className="bg-stone-200 border-white border-l-transparent border-b-transparent border-8 absolute top-[-1px] right-[-1px] z-10" />
                        <div className="absolute inset-0 top-0 flex items-center justify-center">
                          <FileThumbnail
                            item={item}
                            supabase={supabase}
                            getFileIcon={getFileIcon}
                            renderOcrStatusBadge={renderOcrStatusBadge}
                          />
                        </div>
                        <span className="text-sm text-center truncate w-full text-stone-700" title={item.name}>
                          {item.name}
                        </span>
                        {item.size && (
                          <span className="text-xs text-stone-500">
                            {(item.size / 1024).toFixed(1)} KB
                          </span>
                        )}
                      </div>
                      <div className="absolute top-2 right-2">
                        {renderOcrStatusBadge(item)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      );

    })();

    const folderContent = (
      <div
        className={`h-full flex flex-col transition-colors ${isGlobalFileDragActive && !draggedFolderId ? 'ring-2 ring-amber-500 ring-offset-2 bg-amber-50/40' : ''}`}
        onDragEnter={handleDocumentAreaDragEnter}
        onDragOver={handleDocumentAreaDragOver}
        onDragLeave={handleDocumentAreaDragLeave}
        onDrop={handleDocumentAreaDrop}
      >
        {folderContentHeader}
        <div className="flex-1 min-h-[320px] bg-white border rounded-t-none rounded-b-lg border-stone-200">{folderBody}</div>
      </div>
    );

    return folderContent;
  };

  // Sync sheet open state and displayed document ref
  useEffect(() => {
    if (sheetDocument) {
      if (sheetCloseTimeoutRef.current) {
        clearTimeout(sheetCloseTimeoutRef.current);
        sheetCloseTimeoutRef.current = null;
      }
      displayedDocumentRef.current = sheetDocument;
      setIsDocumentSheetOpen(true);
    } else {
      setIsDocumentSheetOpen(false);
    }
  }, [sheetDocument]);

  // Cleanup sheet close timeout on unmount
  useEffect(() => {
    return () => {
      if (sheetCloseTimeoutRef.current) {
        clearTimeout(sheetCloseTimeoutRef.current);
      }
    };
  }, []);

  const handleDocumentSheetOpenChange = useCallback((open: boolean) => {
    if (!open) {
      // Close sheet first (triggers animation), then clear document after animation
      setIsDocumentSheetOpen(false);
      setIsDocumentDataSheetOpen(false);
      // Wait for sheet close animation (300ms) before clearing document data
      sheetCloseTimeoutRef.current = setTimeout(() => {
        closeDocumentPreview();
        sheetCloseTimeoutRef.current = null;
      }, 300);
    }
  }, [closeDocumentPreview]);

  return (
    <div className="relative min-h-[calc(100vh-9rem)] flex flex-col gap-4">
      {/* Upload animation overlay */}
      <AnimatePresence>
        {isUploadingOcrFolder && (
          <motion.div
            key="materiales-upload"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-30 flex items-center justify-center bg-white/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="relative w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl flex flex-col items-center gap-4 text-center"
            >
              <div className="relative flex items-center justify-center">
                <div className="relative w-24 h-28 rounded-2xl border border-amber-200 bg-amber-50 shadow-inner overflow-hidden">
                  <FileText className="w-12 h-12 text-amber-600 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10" />
                  <motion.div
                    className="absolute left-2 right-2 h-px bg-linear-to-r from-transparent via-amber-500 to-transparent"
                    animate={{ y: [10, 80] }}
                    transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-lg font-semibold text-stone-800">Procesando extracción de datos</p>
                <p className="text-sm text-stone-500">
                  Subiendo archivos a la carpeta {currentUploadFolder?.name || 'OCR'} y extrayendo datos.
                </p>
              </div>
              <div className="w-full h-1.5 rounded-full bg-stone-100 overflow-hidden">
                <motion.span
                  className="block h-full bg-linear-to-r from-amber-300 via-amber-500 to-amber-300"
                  animate={{ x: ['-100%', '100%'] }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      {/* <div className="flex items-center justify-end bg-white p-4 rounded-lg border border-stone-200 shadow-sm relative">
        <div className="flex flex-wrap items-center gap-2">
          {!selectedFolder?.ocrEnabled && (
            <div className="flex items-center gap-1 border border-stone-200 rounded-md">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
              >
                <Grid3x3 className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
          )}


          <input
            id="file-upload"
            type="file"
            multiple
            className="hidden"
            onChange={handleUploadFiles}
          />
        </div>
      </div> */}

      {/* Hidden file input for upload button */}
      <input
        id="file-upload"
        type="file"
        multiple
        className="hidden"
        onChange={handleUploadFiles}
      />

      {/* Main Layout */}
      <div className={`flex-1 min-h-0 transition-all duration-300 ease-in-out max-h-[calc(90vh-9rem)] ${!selectedDocument && !selectedFolder?.ocrEnabled && (!selectedFolder || selectedFolder.id === 'root')
        ? ''
        : 'grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4'
        }`}>
        {/* Tree View Sidebar */}
        <FileTreeSidebar
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          selectedFolder={selectedFolder}
          documentViewMode={documentViewMode}
          onDocumentViewModeChange={handleDocumentViewModeChange}
          showDocumentToggle={Boolean(selectedFolder?.ocrEnabled && ocrViewMode === 'documents')}
          onCreateFolderClick={(mode) => openCreateFolderDialog(mode, fileTree)}
          fileTree={fileTree}
          renderTreeItem={renderTreeItem}
          loading={loading}
          onRefresh={handleManualRefresh}
          isRefreshing={isRefreshing}
        />

        {/* Main Content */}
        {(selectedDocument || selectedFolder?.ocrEnabled || (selectedFolder && selectedFolder.id !== 'root')) && (
          <div className="overflow-auto transition-all duration-300 ease-in-out">
            {renderMainContent()}
          </div>
        )}
      </div>

      <DocumentDataSheet
        isOpen={
          isDocumentDataSheetOpen &&
          Boolean(activeDocument) &&
          hasAnyActiveDocumentData
        }
        onOpenChange={(open) => setIsDocumentDataSheetOpen(open)}
        document={activeDocument}
        tableConfig={documentDataTableConfig}
        dataTableSelector={activeDocumentTableSelector}
      />

      <DocumentSheet
        isOpen={isDocumentSheetOpen && Boolean(activeDocument)}
        onOpenChange={handleDocumentSheetOpenChange}
        document={activeDocument}
        breadcrumb={documentBreadcrumb}
        previewUrl={previewUrl}
        onDownload={handleDownload}
        ocrStatusBadge={activeDocument ? renderOcrStatusBadge(activeDocument) : null}
        onRetryOcr={canRetryActiveDocument ? handleRetryDocumentOcr : undefined}
        retryingOcr={Boolean(activeDocument && retryingDocumentId === activeDocument.id)}
        onToggleDataSheet={toggleDocumentDataSheet}
        showDataToggle={hasAnyActiveDocumentData}
        isDataSheetOpen={isDocumentDataSheetOpen}
      />

      <Dialog
        open={isSpreadsheetPreviewOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeSpreadsheetPreview(false);
          }
        }}
      >
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Vista previa de extracción Excel/CSV</DialogTitle>
            <DialogDescription>
              Elegí hoja y mapeo por tabla antes de guardar filas en la base.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto space-y-4 pr-2">
            {isLoadingSpreadsheetPreview && (
              <div className="text-sm text-muted-foreground">Actualizando vista previa...</div>
            )}
            {(spreadsheetPreviewPayload?.perTable ?? []).map((table) => {
              const availableSheets = table.availableSheets ?? [];
              const selectedSheet = table.sheetName ?? '';
              const previewRows = table.previewRows ?? [];
              const mappings = table.mappings ?? [];
              return (
                <div key={table.tablaId} className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{table.tablaName}</p>
                      <p className="text-xs text-muted-foreground">
                        Filas detectadas: {table.inserted}
                      </p>
                    </div>
                    <div className="w-[320px]">
                      <Label className="text-xs">Hoja origen</Label>
                      <Select
                        value={selectedSheet || '__none__'}
                        onValueChange={(value) =>
                          void handleSpreadsheetPreviewSheetChange(
                            table.tablaId,
                            value === '__none__' ? null : value
                          )
                        }
                        disabled={isLoadingSpreadsheetPreview || isApplyingSpreadsheetPreview}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="Seleccionar hoja" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Sin hoja</SelectItem>
                          {availableSheets
                            .filter((sheet) => sheet.name.trim().length > 0)
                            .map((sheet) => (
                              <SelectItem key={sheet.name} value={sheet.name}>
                                {sheet.name} ({sheet.rowCount})
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Mapeo de columnas
                      </p>
                      <div className="max-h-64 overflow-auto space-y-2 pr-1">
                        {mappings.map((mapping) => {
                          const headersForSheet =
                            availableSheets.find((sheet) => sheet.name === selectedSheet)?.headers ?? [];
                          return (
                            <div key={`${table.tablaId}-${mapping.dbColumn}`} className="grid grid-cols-[1fr_1fr] gap-2 items-center">
                              <div className="text-xs">
                                <p className="font-medium">{mapping.label}</p>
                                <p className="text-muted-foreground">{mapping.dbColumn}</p>
                              </div>
                              <div className="space-y-1">
                                <Select
                                  value={mapping.excelHeader ?? '__none__'}
                                  onValueChange={(value) =>
                                    void handleSpreadsheetPreviewMappingChange(
                                      table.tablaId,
                                      mapping.dbColumn,
                                      value === '__none__' ? null : value
                                    )
                                  }
                                  disabled={isLoadingSpreadsheetPreview || isApplyingSpreadsheetPreview}
                                >
                                  <SelectTrigger className="h-8">
                                    <SelectValue placeholder="Sin mapear" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none__">Sin mapear</SelectItem>
                                    {headersForSheet.filter((header) => header.trim().length > 0).map((header) => (
                                      <SelectItem key={`${table.tablaId}-${mapping.dbColumn}-${header}`} value={header}>
                                        {header}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Input
                                  className="h-8 text-xs"
                                  placeholder="Valor manual (si no se detecta)"
                                  value={mapping.manualValue ?? ''}
                                  onChange={(event) =>
                                    void handleSpreadsheetPreviewManualValueChange(
                                      table.tablaId,
                                      mapping.dbColumn,
                                      event.target.value
                                    )
                                  }
                                  disabled={isLoadingSpreadsheetPreview || isApplyingSpreadsheetPreview}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Vista previa
                      </p>
                      <div className="max-h-64 overflow-auto border rounded-md">
                        {previewRows.length === 0 ? (
                          <div className="p-3 text-xs text-muted-foreground">Sin filas detectadas con el mapeo actual.</div>
                        ) : (
                          (() => {
                            const visiblePreviewColumns = Object.keys(previewRows[0] ?? {}).filter(
                              (key) => !key.startsWith('__doc')
                            );
                            return (
                              <table className="w-full text-xs">
                                <thead className="bg-muted/50 sticky top-0">
                                  <tr>
                                    {visiblePreviewColumns.map((key) => (
                                      <th key={`${table.tablaId}-head-${key}`} className="text-left px-2 py-1 border-b">
                                        {key}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {previewRows.slice(0, 20).map((row, idx) => (
                                    <tr key={`${table.tablaId}-row-${idx}`} className="border-b">
                                      {visiblePreviewColumns.map((key) => (
                                        <td key={`${table.tablaId}-cell-${idx}-${key}`} className="px-2 py-1 align-top">
                                          {String(row[key] ?? '')}
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            );
                          })()
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => closeSpreadsheetPreview(false)}
              disabled={isApplyingSpreadsheetPreview}
            >
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                const ok = await applySpreadsheetPreviewImport();
                if (ok) {
                  closeSpreadsheetPreview(true);
                }
              }}
              disabled={isLoadingSpreadsheetPreview || isApplyingSpreadsheetPreview}
            >
              {isApplyingSpreadsheetPreview ? 'Importando...' : 'Confirmar e importar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Folder Dialog */}
      <Dialog
        open={isCreateFolderOpen}
        onOpenChange={(open) => {
          setIsCreateFolderOpen(open);
          if (!open) resetNewFolderForm();
          if (open) setCreateFolderError(null);
        }}
      >
        <DialogContent className="px-4 py-6 max-w-3xl">
          <DialogHeader className="space-y-1">
            <DialogTitle>
              {createFolderMode === 'data'
                ? (convertFolderTarget?.ocrEnabled ? 'Agregar tabla de extracción a carpeta existente' : convertFolderTarget ? 'Convertir carpeta a extracción' : 'Nueva carpeta de datos')
                : 'Nueva carpeta'}
            </DialogTitle>
            <DialogDescription>
              {createFolderMode === 'data'
                ? (convertFolderTarget?.ocrEnabled
                  ? 'Se creará una nueva tabla OCR vinculada a esta misma carpeta y se reprocesarán sus archivos actuales.'
                  : convertFolderTarget
                    ? 'Esta carpeta quedará asociada a una tabla de extracción y se reprocesarán sus archivos existentes.'
                    : 'Asociá esta carpeta a una tabla de datos y elegí cómo cargar la información.')
                : 'Creá una carpeta estándar para organizar tus documentos.'}
            </DialogDescription>
          </DialogHeader>
          {!createFolderMode ? (
            <div className="text-sm text-muted-foreground py-4">
              Usá el menú contextual del árbol para elegir qué tipo de carpeta crear.
            </div>
          ) : createFolderMode === 'normal' ? (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="folder-name" className="text-sm font-medium">Nombre de la carpeta</Label>
                <Input
                  id="folder-name"
                  value={newFolderName}
                  onChange={(e) => {
                    setNewFolderName(e.target.value);
                    if (createFolderError) setCreateFolderError(null);
                  }}
                  placeholder="Ej. Planos"
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                />
                {createFolderError && (
                  <p className="text-xs text-red-600">{createFolderError}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Ruta: Documentos/{createFolderParentPath ? `${createFolderParentPath}/` : ''}{normalizeFolderName(newFolderName) || 'mi-carpeta'}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="data-folder-name" className="text-sm font-medium">Nombre de la carpeta</Label>
                <Input
                  id="data-folder-name"
                  value={newFolderName}
                  onChange={(e) => {
                    setNewFolderName(e.target.value);
                    if (createFolderError) setCreateFolderError(null);
                  }}
                  placeholder="Ej. Ordenes de compra"
                  disabled={Boolean(convertFolderTarget)}
                />
                {createFolderError && (
                  <p className="text-xs text-red-600">{createFolderError}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Ruta: Documentos/{convertFolderTarget
                    ? convertFolderPath
                    : `${createFolderParentPath ? `${createFolderParentPath}/` : ''}${normalizeFolderName(newFolderName) || 'mi-carpeta'}`}
                </p>
              </div>
              <div className="space-y-3">
                <Label className="text-sm font-medium">Método de carga de datos</Label>
                <RadioGroup
                  value={newFolderDataInputMethod}
                  onValueChange={(value) => setNewFolderDataInputMethod(value as DataInputMethod)}
                  className="grid grid-cols-3 gap-3"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="ocr" id="method-ocr" />
                    <Label htmlFor="method-ocr" className="text-sm font-normal cursor-pointer">Solo OCR</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="manual" id="method-manual" />
                    <Label htmlFor="method-manual" className="text-sm font-normal cursor-pointer">Solo manual</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="both" id="method-both" />
                    <Label htmlFor="method-both" className="text-sm font-normal cursor-pointer">Ambos</Label>
                  </div>
                </RadioGroup>
                <p className="text-xs text-muted-foreground">
                  {newFolderDataInputMethod === 'ocr' && 'Los datos se extraerán automáticamente de documentos subidos.'}
                  {newFolderDataInputMethod === 'manual' && 'Los datos se ingresarán manualmente en la tabla.'}
                  {newFolderDataInputMethod === 'both' && 'Podés cargar datos manualmente o extraerlos de documentos.'}
                </p>
              </div>
              {newFolderDataInputMethod !== 'ocr' && (
                <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-4 space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-blue-900">Plantilla de extracción XLSX/CSV</p>
                    <p className="text-xs text-blue-700">
                      Define cómo se interpreta la planilla al importar.
                    </p>
                  </div>
                  <Select
                    value={newFolderSpreadsheetTemplate || undefined}
                    onValueChange={(value) => setNewFolderSpreadsheetTemplate(value as 'auto' | 'certificado')}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccioná una plantilla XLSX" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto (detectar por columnas)</SelectItem>
                      <SelectItem value="certificado">Certificado (certexampleplayground)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {(newFolderDataInputMethod === 'ocr' || newFolderDataInputMethod === 'both') && (
                <div className="rounded-lg border border-purple-200 bg-purple-50/60 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <p className="text-sm font-semibold text-purple-900">Plantilla de extracción</p>
                      <p className="text-xs text-purple-700">
                        Subí un documento para crearla o seleccioná una existente.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setIsTemplateConfiguratorOpen(true)}
                      className="gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Nueva plantilla
                    </Button>
                  </div>
                  {isLoadingOcrTemplates ? (
                    <div className="text-xs text-muted-foreground border border-dashed rounded-md px-3 py-2">
                      Cargando plantillas...
                    </div>
                  ) : ocrTemplates.length === 0 ? (
                    <div className="text-xs text-purple-700 bg-white border border-purple-200 rounded-md px-3 py-2">
                      No hay plantillas disponibles. Creá una a partir de un documento para continuar.
                    </div>
                  ) : (
                    <Select
                      value={newFolderOcrTemplateId || undefined}
                      onValueChange={(value) => handleNewFolderTemplateSelect(value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccioná una plantilla" />
                      </SelectTrigger>
                      <SelectContent>
                        {ocrTemplates.map((template) => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}
              {newFolderDataInputMethod === 'manual' && (
                <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <p className="text-sm font-semibold text-amber-900">Columnas de la tabla</p>
                      <p className="text-xs text-amber-700">
                        Definí las columnas que tendrá la tabla de datos.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setNewFolderColumns(prev => [...prev, {
                          id: crypto.randomUUID(),
                          label: `Columna ${prev.length + 1}`,
                          fieldKey: normalizeFieldKey(`columna_${prev.length + 1}`),
                          dataType: 'text' as TablaColumnDataType,
                          required: false,
                        }]);
                      }}
                      className="gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Agregar columna
                    </Button>
                  </div>
                  {newFolderColumns.length === 0 ? (
                    <div className="text-xs text-amber-700 bg-white border border-amber-200 rounded-md px-3 py-2">
                      No hay columnas definidas. Agregá al menos una columna.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                      {newFolderColumns.map((column, index) => (
                        <div key={column.id} className="flex items-center gap-2 p-2 bg-white rounded border border-amber-100">
                          <div className="flex-1 grid grid-cols-3 gap-2">
                            <Input
                              value={column.label}
                              onChange={(e) => {
                                const newLabel = e.target.value;
                                setNewFolderColumns(prev => prev.map(c =>
                                  c.id === column.id
                                    ? { ...c, label: newLabel, fieldKey: normalizeFieldKey(newLabel) }
                                    : c
                                ));
                              }}
                              placeholder="Nombre"
                              className="h-8 text-sm"
                            />
                            <Select
                              value={column.dataType}
                              onValueChange={(value) => {
                                setNewFolderColumns(prev => prev.map(c =>
                                  c.id === column.id ? { ...c, dataType: value as TablaColumnDataType } : c
                                ));
                              }}
                            >
                              <SelectTrigger className="h-8 text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="text">Texto</SelectItem>
                                <SelectItem value="number">Número</SelectItem>
                                <SelectItem value="currency">Moneda</SelectItem>
                                <SelectItem value="date">Fecha</SelectItem>
                                <SelectItem value="boolean">Sí/No</SelectItem>
                              </SelectContent>
                            </Select>
                            <div className="flex items-center gap-2">
                              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={column.required}
                                  onChange={(e) => {
                                    setNewFolderColumns(prev => prev.map(c =>
                                      c.id === column.id ? { ...c, required: e.target.checked } : c
                                    ));
                                  }}
                                  className="rounded border-stone-300"
                                />
                                Requerido
                              </label>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setNewFolderColumns(prev => prev.filter(c => c.id !== column.id));
                            }}
                            className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="space-y-1 text-xs text-muted-foreground border border-dashed rounded-md px-3 py-2">
                <p>
                  La tabla de datos se creará con el mismo nombre de la carpeta:{" "}
                  <span className="font-semibold text-stone-700">
                    {normalizeFolderName(newFolderName) || 'mi-carpeta'}
                  </span>
                </p>
              </div>
              <div className="space-y-2">
                <Label>Descripción</Label>
                <Textarea
                  value={newFolderDescription}
                  onChange={(e) => setNewFolderDescription(e.target.value)}
                  rows={2}
                  placeholder="Contexto u objetivo de la tabla (opcional)"
                />
              </div>
            </div>
          )}
          {createFolderMode && (
            <DialogFooter>
              <Button
                variant="secondary"
                onClick={() => {
                  setIsCreateFolderOpen(false);
                  resetNewFolderForm();
                }}
              >
                Cancelar
              </Button>
              <Button onClick={handleCreateFolder} disabled={isCreateFolderDisabled}>
                {createFolderMode === 'data' ? 'Crear carpeta de datos' : 'Crear carpeta'}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <OcrTemplateConfigurator
        open={isTemplateConfiguratorOpen}
        onOpenChange={setIsTemplateConfiguratorOpen}
        onTemplateCreated={handleTemplateConfiguratorCreated}
      />

      {activeOcrTablaId && activeFolderLink?.columns && (
        <AddRowDialog
          open={isAddRowDialogOpen}
          onOpenChange={setIsAddRowDialogOpen}
          columns={activeFolderLink.columns}
          tablaId={activeOcrTablaId}
          obraId={obraId}
          onRowAdded={handleRowAdded}
        />
      )}

      <Dialog open={isSchemaDialogOpen} onOpenChange={setIsSchemaDialogOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Editar columnas de la tabla</DialogTitle>
            <DialogDescription>
              Agregá, eliminá o modificá columnas. Las fórmulas usan formato <code>[campo_a] - [campo_b]</code>.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[65vh] overflow-auto space-y-3 pr-2">
            {schemaDraftColumns.map((column, index) => (
              <div key={column.localId} className="rounded-md border p-3 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
                  <div className="md:col-span-2">
                    <Label className="text-xs">Etiqueta</Label>
                    <Input
                      value={column.label}
                      onChange={(e) =>
                        setSchemaDraftColumns((prev) =>
                          prev.map((it) =>
                            it.localId === column.localId ? { ...it, label: e.target.value } : it
                          )
                        )
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Field key</Label>
                    <Input
                      value={column.fieldKey}
                      onChange={(e) =>
                        setSchemaDraftColumns((prev) =>
                          prev.map((it) =>
                            it.localId === column.localId ? { ...it, fieldKey: e.target.value } : it
                          )
                        )
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Tipo</Label>
                    <Select
                      value={column.dataType}
                      onValueChange={(value) =>
                        setSchemaDraftColumns((prev) =>
                          prev.map((it) =>
                            it.localId === column.localId
                              ? { ...it, dataType: ensureTablaDataType(value) }
                              : it
                          )
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TABLA_DATA_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {DATA_TYPE_LABELS[type]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={column.required}
                        onCheckedChange={(checked: boolean | "indeterminate") =>
                          setSchemaDraftColumns((prev) =>
                            prev.map((it) =>
                              it.localId === column.localId ? { ...it, required: Boolean(checked) } : it
                            )
                          )
                        }
                      />
                      Requerida
                    </label>
                  </div>
                  <div className="flex items-end justify-end">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        setSchemaDraftColumns((prev) =>
                          prev.filter((it) => it.localId !== column.localId)
                        )
                      }
                    >
                      Eliminar
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Fórmula intrafila (opcional)</Label>
                    <Input
                      value={column.formula}
                      placeholder="[monto_total] - [monto_certificado]"
                      onChange={(e) =>
                        setSchemaDraftColumns((prev) =>
                          prev.map((it) =>
                            it.localId === column.localId ? { ...it, formula: e.target.value } : it
                          )
                        )
                      }
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Warn ≤</Label>
                      <Input
                        value={column.warnBelow}
                        onChange={(e) =>
                          setSchemaDraftColumns((prev) =>
                            prev.map((it) =>
                              it.localId === column.localId ? { ...it, warnBelow: e.target.value } : it
                            )
                          )
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Warn ≥</Label>
                      <Input
                        value={column.warnAbove}
                        onChange={(e) =>
                          setSchemaDraftColumns((prev) =>
                            prev.map((it) =>
                              it.localId === column.localId ? { ...it, warnAbove: e.target.value } : it
                            )
                          )
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Crítico ≤</Label>
                      <Input
                        value={column.criticalBelow}
                        onChange={(e) =>
                          setSchemaDraftColumns((prev) =>
                            prev.map((it) =>
                              it.localId === column.localId
                                ? { ...it, criticalBelow: e.target.value }
                                : it
                            )
                          )
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Crítico ≥</Label>
                      <Input
                        value={column.criticalAbove}
                        onChange={(e) =>
                          setSchemaDraftColumns((prev) =>
                            prev.map((it) =>
                              it.localId === column.localId
                                ? { ...it, criticalAbove: e.target.value }
                                : it
                            )
                          )
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                setSchemaDraftColumns((prev) => [
                  ...prev,
                  {
                    localId: crypto.randomUUID(),
                    label: `Columna ${prev.length + 1}`,
                    fieldKey: normalizeFieldKey(`columna_${prev.length + 1}`),
                    dataType: 'text',
                    required: false,
                    formula: '',
                    warnBelow: '',
                    warnAbove: '',
                    criticalBelow: '',
                    criticalAbove: '',
                  },
                ])
              }
            >
              Agregar columna
            </Button>
            <Button type="button" onClick={handleSaveSchema} disabled={isSavingSchema}>
              {isSavingSchema ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Eliminación</DialogTitle>
          </DialogHeader>
          <div className="p-4">
            <p className="text-sm text-stone-500">
              ¿Estás seguro de que deseas eliminar{' '}
              <span className="font-semibold text-stone-800">{itemToDelete?.name}</span>?
              {itemToDelete?.type === 'folder' && (
                <span className="block mt-2 text-red-600">
                  Esto eliminará la carpeta y todo su contenido.
                </span>
              )}
            </p>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (itemToDelete) {
                  handleDelete(itemToDelete);
                  setIsDeleteDialogOpen(false);
                  setItemToDelete(null);
                }
              }}
            >
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Context Menu */}
      {contextMenu && (
        (() => {
          const parentFolder = contextMenu.item.type === 'folder' ? contextMenu.item : null;
          const canCreateHere = parentFolder && !hasOcrAncestor(parentFolder);
          return (
            <div
              className="fixed z-50 bg-white border border-stone-200 rounded-lg shadow-lg py-1 min-w-[200px]"
              style={{
                left: `${contextMenu.x}px`,
                top: `${contextMenu.y}px`,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {canCreateHere && (
                <>
                  <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-stone-400">
                    Crear
                  </div>
                  <button
                    className="w-full px-3 py-2 text-sm text-left hover:bg-stone-50 flex items-center gap-2 text-stone-700"
                    onClick={() => {
                      openCreateFolderDialog('normal', parentFolder);
                      setContextMenu(null);
                    }}
                  >
                    <FolderPlus className="w-4 h-4" />
                    Crear carpeta
                  </button>
                  <button
                    className="w-full px-3 py-2 text-sm text-left hover:bg-stone-50 flex items-center gap-2 text-stone-700"
                    onClick={() => {
                      openCreateFolderDialog('data', parentFolder);
                      setContextMenu(null);
                    }}
                  >
                    <Table2 className="w-4 h-4" />
                    Crear carpeta de datos
                  </button>
                  <div className="my-1 h-px bg-stone-100" />
                </>
              )}
              {contextMenu.item.ocrEnabled && contextMenu.item.ocrTablaId && (
                <>
                  <button
                    className="w-full px-3 py-2 text-sm text-left hover:bg-stone-50 flex items-center gap-2 text-stone-700"
                    onClick={() => {
                      handleNavigateToTabla(contextMenu.item.ocrTablaId);
                      setContextMenu(null);
                    }}
                  >
                    <Table2 className="w-4 h-4" />
                    Ver tabla de datos
                  </button>
                  <button
                    className="w-full px-3 py-2 text-sm text-left hover:bg-stone-50 flex items-center gap-2 text-stone-700"
                    onClick={() => {
                      openAddOcrTableToFolderDialog(contextMenu.item);
                      setContextMenu(null);
                    }}
                  >
                    <Table2 className="w-4 h-4" />
                    Agregar tabla de extracción en esta carpeta
                  </button>
                </>
              )}
              {contextMenu.item.type === 'folder' && contextMenu.item.id !== 'root' && !contextMenu.item.ocrEnabled && (
                <button
                  className="w-full px-3 py-2 text-sm text-left hover:bg-stone-50 flex items-center gap-2 text-stone-700"
                  onClick={() => {
                    openConvertFolderDialog(contextMenu.item);
                    setContextMenu(null);
                  }}
                >
                  <Sparkles className="w-4 h-4" />
                  Convertir a carpeta de extracción
                </button>
              )}
              {contextMenu.item.id !== 'root' && (
                <button
                  className="w-full px-3 py-2 text-sm text-left hover:bg-stone-50 flex items-center gap-2 text-red-600"
                  onClick={() => confirmDelete(contextMenu.item)}
                >
                  <Trash2 className="w-4 h-4" />
                  Eliminar {contextMenu.item.type === 'folder' ? 'Carpeta' : 'Archivo'}
                </button>
              )}
            </div>
          );
        })()
      )}
    </div>
  );
}

type OcrDocumentSourceCellProps = {
  row: OcrDocumentTableRow;
  obraId?: string;
  documentsByStoragePath: Map<string, FileSystemItem>;
  supabase: ReturnType<typeof createSupabaseBrowserClient>;
};

const OcrDocumentSourceCell = memo(function OcrDocumentSourceCell({
  row,
  obraId,
  documentsByStoragePath,
  supabase,
}: OcrDocumentSourceCellProps) {
  const docPath: string | null =
    typeof (row as Record<string, unknown>).__docPath === 'string'
      ? (row as Record<string, unknown>).__docPath as string
      : null;
  const docName: string =
    typeof (row as Record<string, unknown>).__docFileName === 'string'
      ? (row as Record<string, unknown>).__docFileName as string
      : docPath?.split('/').pop() ?? 'Documento sin nombre';
  const relativePath: string =
    docPath && obraId && docPath.startsWith(`${obraId}/`)
      ? docPath.slice(obraId.length + 1)
      : docPath ?? 'Sin ruta';
  const docItem = docPath ? documentsByStoragePath.get(docPath) ?? null : null;
  const storagePath: string | null = docItem?.storagePath ?? docPath ?? null;
  const isImage = Boolean(docItem?.mimetype?.startsWith('image/'));

  const [previewUrl, setPreviewUrl] = useState<string | null>(() => {
    if (!storagePath || !isImage) return null;
    return getCachedBlobUrl(storagePath) ?? getCachedSignedUrl(storagePath) ?? null;
  });
  const [hasRequestedPreview, setHasRequestedPreview] = useState<boolean>(() => Boolean(previewUrl));
  const [hoverOpen, setHoverOpen] = useState(false);

  useEffect(() => {
    if (!storagePath || !isImage) {
      setPreviewUrl(null);
      setHasRequestedPreview(false);
      return;
    }
    const cached = getCachedBlobUrl(storagePath) ?? getCachedSignedUrl(storagePath) ?? null;
    setPreviewUrl(cached);
    setHasRequestedPreview(Boolean(cached));
  }, [isImage, storagePath]);

  useEffect(() => {
    if (!hasRequestedPreview || !storagePath || !isImage) return;
    let isMounted = true;
    const applyPreview = (url: string | null) => {
      if (isMounted) {
        setPreviewUrl(url);
      }
    };

    const cachedBlob = getCachedBlobUrl(storagePath);
    if (cachedBlob) {
      applyPreview(cachedBlob);
      return () => {
        isMounted = false;
      };
    }
    const cachedSigned = getCachedSignedUrl(storagePath);
    if (cachedSigned) {
      applyPreview(cachedSigned);
      preloadAndCacheFile(cachedSigned, storagePath).then((blobUrl) => {
        if (isMounted) {
          setPreviewUrl(blobUrl);
        }
      });
      return () => {
        isMounted = false;
      };
    }
    (async () => {
      const { data } = await supabase.storage
        .from('obra-documents')
        .createSignedUrl(storagePath, 3600);
      if (!isMounted || !data?.signedUrl) return;
      setCachedSignedUrl(storagePath, data.signedUrl);
      setPreviewUrl(data.signedUrl);
      const blobUrl = await preloadAndCacheFile(data.signedUrl, storagePath);
      if (isMounted) {
        setPreviewUrl(blobUrl);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [hasRequestedPreview, isImage, storagePath, supabase]);

  if (!docPath) {
    return (
      <div className="flex items-center justify-start gap-3 text-xs text-stone-500 h-full w-full pl-2">
        <div className="min-w-7 min-h-7 rounded-md border border-muted-foreground/40 bg-muted-foreground/10 flex items-center justify-center relative">
          <FileText className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
          {/* a span that is a dash across the file icon */}
          <XIcon className="w-9 h-9 text-muted-foreground opacity-60 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" aria-hidden="true" />
        </div>
        <p className="font-semibold text-stone-700 truncate">No hay archivo vinculado</p>
      </div>
    );
  }

  return (
    <HoverCard
      open={hoverOpen}
      onOpenChange={(open) => {
        setHoverOpen(open);
        if (open && !hasRequestedPreview) {
          setHasRequestedPreview(true);
        }
      }}
      openDelay={150}
      closeDelay={120}
    >
      <HoverCardTrigger asChild>
        <div className="flex items-center justify-start gap-3 min-w-0 cursor-default h-full w-full pl-2">
          <div className="min-w-7 min-h-7 rounded-md border border-amber-500/40 bg-amber-500/10 flex items-center justify-center">
            <FileText className="w-5 h-5 text-amber-500" aria-hidden="true" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-semibold text-stone-800 truncate">{docName}</span>
            <span className="text-[11px] text-stone-500 truncate">{relativePath}</span>
          </div>
        </div>
      </HoverCardTrigger>
      <HoverCardPortal>

        <HoverCardContent align="start" side="right" className="w-[260px] p-0 rounded-none">
          <div className="px-3 py-2 border-b border-stone-100">
            <p className="text-xs font-semibold text-stone-800 truncate">{docName}</p>
            <p className="text-[11px] text-stone-500 truncate">{relativePath}</p>
          </div>
          <div className="w-full h-[260px] bg-stone-50 flex items-center justify-center overflow-hidden">
            {previewUrl ? (
              <img src={previewUrl} alt={docName ?? 'Vista previa'} className="w-full h-full object-cover" />
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 text-xs text-stone-500 p-4">
                <FileText className="w-6 h-6 text-stone-400" />
                <span className="text-center leading-tight">Vista previa no disponible para este documento.</span>
              </div>
            )}
          </div>
        </HoverCardContent>
      </HoverCardPortal>
    </HoverCard>
  );
});
