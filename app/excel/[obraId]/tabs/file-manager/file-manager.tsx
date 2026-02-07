'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { MouseEvent } from 'react';
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
} from 'lucide-react';
import { toast } from 'sonner';
import * as Sentry from '@sentry/nextjs';
import ForgeViewer from '@/app/excel/[obraId]/tabs/file-manager/components/viewer/forgeviewer';
import { EnhancedDocumentViewer } from '@/components/viewer/enhanced-document-viewer';
import FolderFront from '@/components/ui/FolderFront';
import { DocumentSheet } from './components/document-sheet';
import { FileTreeSidebar } from './components/file-tree-sidebar';
import { AddRowDialog } from './components/add-row-dialog';
import { useDocumentsStore, needsRefetch, markDocumentsFetched, setDocumentsLoading } from './hooks/useDocumentsStore';
import { OcrTemplateConfigurator } from '@/app/admin/obra-defaults/_components/OcrTemplateConfigurator';
import { normalizeFolderName, normalizeFieldKey, ensureTablaDataType, TABLA_DATA_TYPES, type TablaColumnDataType } from '@/lib/tablas';
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
  }>;
};

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
  const FileThumbnail = ({ item }: { item: FileSystemItem }) => {
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
          <span className="text-sm text-center truncate w-full text-stone-700 absolute bottom-0 left-0 right-0 px-2 py-1 bg-stone-200/50 backdrop-blur-sm" title={item.name}>
            {item.name}
          </span>
        </div>
      );
    }

    return (
      <div className="relative w-full h-full">
        {getFileIcon(item.mimetype)}
        <div className="absolute top-2 right-2">
          {renderOcrStatusBadge(item)}
        </div>
      </div>
    );
  };
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
  const [newFolderName, setNewFolderName] = useState('');
  const [createFolderError, setCreateFolderError] = useState<string | null>(null);
  const [createFolderMode, setCreateFolderMode] = useState<'normal' | 'data' | null>(null);
  const [newFolderDataInputMethod, setNewFolderDataInputMethod] = useState<DataInputMethod>('both');
  const [newFolderOcrTemplateId, setNewFolderOcrTemplateId] = useState<string>('');
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
  const rateLimitUntilRef = useRef<number>(0);

  useEffect(() => {
    if (!obraId) return;
    resetDocumentsStore(obraId);
  }, [obraId, resetDocumentsStore]);

  const ocrFolderMap = useMemo(() => {
    const map = new Map<string, OcrFolderLink>();
    ocrFolderLinks.forEach((link) => map.set(link.folderName, link));
    return map;
  }, [ocrFolderLinks]);

  const ocrTablaMap = useMemo(() => {
    const map = new Map<string, OcrFolderLink>();
    ocrFolderLinks.forEach((link) => map.set(link.tablaId, link));
    return map;
  }, [ocrFolderLinks]);

  const resolveOcrLinkForDocument = useCallback(
    (doc: FileSystemItem | null) => {
      if (!doc?.storagePath) return null;
      if (doc.ocrFolderName) {
        const normalized = normalizeFolderName(doc.ocrFolderName);
        const direct = ocrFolderMap.get(doc.ocrFolderName);
        if (direct) return direct;
        const normalizedLink = ocrFolderMap.get(normalized);
        if (normalizedLink) return normalizedLink;
      }
      const segments = doc.storagePath.split('/').filter(Boolean);
      if (segments.length < 2) return null;
      const folderSegment = segments[segments.length - 2];
      const normalizedFolder = normalizeFolderName(folderSegment);
      return (
        ocrFolderMap.get(folderSegment) ||
        ocrFolderMap.get(normalizedFolder) ||
        null
      );
    },
    [ocrFolderMap]
  );

  // Table search state for OCR folders
  const [tableSearchQuery, setTableSearchQuery] = useState('');
  const [sourceFileModal, setSourceFileModal] = useState<FileSystemItem | null>(null);
  const [documentViewMode, setDocumentViewMode] = useState<'cards' | 'table'>('table');
  const [ocrDocumentFilterPath, setOcrDocumentFilterPath] = useState<string | null>(null);
  const [ocrDocumentFilterName, setOcrDocumentFilterName] = useState<string | null>(null);
  const [ocrDataViewMode, setOcrDataViewMode] = useState<'cards' | 'table'>('cards');
  const [ocrViewMode, setOcrViewMode] = useState<'table' | 'documents'>('table');

  const resetNewFolderForm = useCallback(() => {
    setNewFolderName('');
    setCreateFolderError(null);
    setNewFolderDataInputMethod('both');
    setNewFolderOcrTemplateId('');
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
      const folderKey = node.ocrFolderName ?? node.name;
      const normalizedKey = normalizeFolderName(folderKey);
      const link =
        ocrFolderMap.get(folderKey) ||
        ocrFolderMap.get(normalizedKey);
      if (link) {
        node.ocrEnabled = true;
        node.ocrTablaId = link.tablaId;
        node.ocrTablaName = link.tablaName;
        node.ocrFolderName = link.folderName ?? normalizedKey;
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
      segments.push(current.name);
      current = parentMapRef.current.get(current.id) ?? null;
    }
    return segments.reverse();
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
    (template: { id: string; name: string; description: string | null; columns: Array<{ fieldKey: string; label: string; dataType: string; ocrScope?: string }> }) => {
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
      const next = current?.children?.find(
        (child) => child.type === 'folder' && child.name === segment
      );
      if (!next) {
        return current;
      }
      current = next;
    }
    return current;
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
        const foldersToExpand = ['root'];
        const foldersWithContent = cachedTree.children
          ?.filter(c => c.type === 'folder' && c.children && c.children.length > 0)
          .map(c => c.id) || [];
        foldersToExpand.push(...foldersWithContent);
        setExpandedFolderIds(new Set(foldersToExpand));
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
        const foldersToExpand = ['root'];
        const foldersWithContent = tree.children
          ?.filter((c: FileSystemItem) => c.type === 'folder' && c.children && c.children.length > 0)
          .map((c: FileSystemItem) => c.id) || [];
        foldersToExpand.push(...foldersWithContent);
        setExpandedFolderIds(new Set(foldersToExpand));
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
  }, [findDocumentInTreeByStoragePath, findFolderInTreeBySegments, getPathSegments, obraId, rebuildParentMap, selectedDocument, selectedFolder, setExpandedFolderIds, setFileTree, setOcrFolderLinks, setSelectedDocument, setSelectedFolder, setSheetDocument, sheetDocument]);

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
        // Fetch OCR links if missing, to hydrate tags quickly
        if (shouldRefetchOcr) {
          await refreshOcrFolderLinks({ skipCache: true });
        }
        // Only rebuild the tree if it’s stale or missing
        if (shouldRefetchTree) {
          await buildFileTree({ skipCache: true });
        }
      } catch (error) {
        console.error('Error initializing documents data', error);
      }
    };

    void bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obraId, fileTree, ocrFolderLinks.length, buildFileTree, refreshOcrFolderLinks]);

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
      const folderKey = resolvedParent.ocrFolderName ?? resolvedParent.name;
      const normalizedKey = normalizeFolderName(folderKey);
      parentLink = ocrFolderMap.get(folderKey) || ocrFolderMap.get(normalizedKey) || null;
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
  }, [buildFileTree, createFolderParent, fileTree, newFolderName, obraId, ocrFolderLinks, resetNewFolderForm, resolveParentSegments, supabase]);

  const createDataFolder = useCallback(async () => {
    const rawFolderName = newFolderName.trim();
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
    const needsOcrTemplate = newFolderDataInputMethod === 'ocr' || newFolderDataInputMethod === 'both';
    if (needsOcrTemplate && !newFolderOcrTemplateId) {
      toast.error('Elegí o creá una plantilla de extracción');
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
    const parentSegments = resolveParentSegments(createFolderParent);
    const basePath = parentSegments.length ? `${obraId}/${parentSegments.join('/')}` : obraId;

    try {
      const payload = {
        name: normalizedFolder,
        description: newFolderDescription.trim() || undefined,
        sourceType: 'ocr' as const, // Keep 'ocr' for backward compatibility with API
        dataInputMethod: newFolderDataInputMethod,
        ocrFolderName: normalizedFolder,
        hasNestedData: newFolderHasNested,
        ocrTemplateId: needsOcrTemplate ? newFolderOcrTemplateId : undefined,
        columns: newFolderColumns.map((column, index) => ({
          label: column.label.trim() || `Columna ${index + 1}`,
          fieldKey: normalizeFieldKey(column.fieldKey),
          dataType: column.dataType,
          required: column.required,
          position: index,
          config: newFolderHasNested ? { ocrScope: column.scope ?? 'item' } : undefined,
        })),
      };

      const res = await fetch(`/api/obras/${obraId}/tablas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let errorMessage = 'No se pudo crear la carpeta de datos';
        try {
          const json = await res.json();
          errorMessage = json.error || errorMessage;
        } catch {
          // If not JSON, try text
          const text = await res.text();
          errorMessage = text || errorMessage;
        }
        throw new Error(errorMessage);
      }

      try {
        await supabase.storage
          .from('obra-documents')
          .upload(`${basePath}/${normalizedFolder}/.keep`, new Blob([''], { type: 'text/plain' }), { upsert: true });
      } catch (keepError) {
        console.error('No se pudo crear la carpeta en almacenamiento', keepError);
      }

      toast.success('Carpeta de datos creada');
      setIsCreateFolderOpen(false);
      resetNewFolderForm();
      await refreshOcrFolderLinks({ skipCache: true });
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
    fileTree,
    newFolderColumns,
    newFolderDataInputMethod,
    newFolderDescription,
    newFolderHasNested,
    newFolderName,
    newFolderOcrTemplateId,
    obraId,
    ocrFolderLinks,
    refreshOcrFolderLinks,
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
      await refreshOcrFolderLinks({ skipCache: true });
      await buildFileTree({ skipCache: true });
      toast.success('Documentos sincronizados');
    } catch (error) {
      console.error('Error refreshing documents:', error);
      toast.error('Error al sincronizar documentos');
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, refreshOcrFolderLinks, buildFileTree]);

  const refreshDocumentsSilent = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await refreshOcrFolderLinks({ skipCache: true });
      await buildFileTree({ skipCache: true });
    } catch (error) {
      console.error('Error refreshing documents:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, refreshOcrFolderLinks, buildFileTree]);

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
    const linkedTabla =
      folderForUpload?.ocrTablaId
        ? ocrTablaMap.get(folderForUpload.ocrTablaId)
        : folderForUpload?.ocrFolderName
          ? ocrFolderMap.get(folderForUpload.ocrFolderName)
          : null;
    const isOcrFolder = Boolean(linkedTabla);
    let importedTablaData = false;

    setUploadingFiles(true);
    setCurrentUploadFolder(folderForUpload ?? fileTree ?? null);
    let pendingUsageBytes = 0;
    const uploadedFiles: { path: string; name: string }[] = [];

    try {
      for (const file of filesArray) {
        const filePath = `${folderPath}/${file.name}`;

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

            if (linkedTabla) {
              const importRes = await fetch(
                `/api/obras/${obraId}/tablas/${linkedTabla.tablaId}/import/ocr?skipStorage=1`,
                {
                  method: 'POST',
                  body: fd,
                }
              );

              if (!importRes.ok) {
                const out = await importRes.json().catch(() => ({} as any));
                console.error('Tabla OCR import failed', out);
                const limitMessage =
                  typeof out?.error === 'string'
                    ? out.error
                    : 'Superaste el límite de tokens de IA de tu plan.';
                if (importRes.status === 402) {
                  toast.warning(limitMessage);
                } else {
                  toast.error(`No se pudieron extraer datos para ${linkedTabla.tablaName}`);
                }
                continue;
              }

              const out = await importRes.json().catch(() => ({} as any));
              toast.success(
                out?.inserted
                  ? `Se importaron ${out.inserted} filas en ${linkedTabla.tablaName}`
                  : `Archivo procesado en ${linkedTabla.tablaName}`
              );
              importedTablaData = true;
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

      if (importedTablaData) {
        await refreshOcrFolderLinks({ skipCache: true });
      }

      buildFileTree({ skipCache: true });
    } catch (error) {
      console.error('Error uploading files:', error);
      toast.error('Error uploading files');
    } finally {
      setUploadingFiles(false);
      setCurrentUploadFolder(null);
    }
  }, [applyUsageDelta, buildFileTree, ensureStorageCapacity, fileTree, getPathSegments, obraId, ocrTablaMap, onRefreshMaterials, refreshOcrFolderLinks, selectedFolder, supabase]);

  const handleDocumentAreaDragOver = useCallback((event: React.DragEvent<HTMLElement>) => {
    if (!containsFiles(event.dataTransfer)) return;
    event.preventDefault();
    if (!isGlobalFileDragActive) {
      setIsGlobalFileDragActive(true);
    }
    event.dataTransfer.dropEffect = 'copy';
  }, [isGlobalFileDragActive]);

  const handleDocumentAreaDragEnter = useCallback((event: React.DragEvent<HTMLElement>) => {
    if (!containsFiles(event.dataTransfer)) return;
    event.preventDefault();
    setIsGlobalFileDragActive(true);
  }, []);

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
  const isCreateFolderDisabled =
    !newFolderName.trim() ||
    (createFolderMode === 'data' && newFolderColumns.length === 0) ||
    (createFolderMode === 'data' && needsOcrTemplate && !newFolderOcrTemplateId);

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
    setDraggedFolderId(folder.id);
  }, []);

  const handleFolderDragOver = useCallback((event: React.DragEvent<HTMLElement>, folder: FileSystemItem) => {
    if (!containsFiles(event.dataTransfer)) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';
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
    event.dataTransfer.clearData();
    if (files.length) {
      void uploadFilesToFolder(files, folder);
    }
  }, [uploadFilesToFolder]);

  const openCreateFolderDialog = useCallback((mode: 'normal' | 'data', parent?: FileSystemItem | null) => {
    if (parent && parent.ocrEnabled) {
      toast.error('No podés crear carpetas dentro de una carpeta de datos');
      return;
    }
    setCreateFolderMode(mode);
    setCreateFolderParent(parent ?? fileTree ?? null);
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
        const folderPath = item.id === 'root' ? obraId : `${obraId}/${item.name}`;

        const { data: files, error: listError } = await supabase.storage
          .from('obra-documents')
          .list(folderPath, { limit: 1000 });

        if (listError) throw listError;

        if (files && files.length > 0) {
          const filePaths = files.map(file => {
            const fullPath = `${folderPath}/${file.name}`;
            deletedPaths.push(fullPath);
            bytesFreed += file.metadata?.size ?? 0;
            return fullPath;
          });
          const { error: deleteError } = await supabase.storage
            .from('obra-documents')
            .remove(filePaths);

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

  const confirmDelete = (item: FileSystemItem) => {
    setItemToDelete(item);
    setIsDeleteDialogOpen(true);
    setContextMenu(null);
  };

  const getTreeFileIcon = (mimetype?: string) => {
    if (!mimetype) return <File className="w-4 h-4 text-stone-400" />;
    if (mimetype.startsWith('image/')) return <ImageIcon className="w-4 h-4 text-stone-400" />;
    if (mimetype === 'application/pdf') return <FileText className="w-4 h-4 text-stone-400" />;
    return <File className="w-4 h-4 text-stone-400" />;
  };

  // Get folder icon color based on data input method
  const getFolderIconColor = (dataInputMethod?: DataInputMethod) => {
    switch (dataInputMethod) {
      case 'manual':
        return 'text-blue-600';
      case 'ocr':
        return 'text-amber-600';
      case 'both':
        return 'text-purple-600';
      default:
        return 'text-stone-500';
    }
  };

  const getFolderFileCount = (folder: FileSystemItem) => {
    const children = folder.children ?? [];
    return children.filter((child) => child.type === 'file' && child.name !== '.keep').length;
  };

  // NEW: Styled tree item with amber accents for OCR folders
  const renderTreeItem = (item: FileSystemItem, level: number = 0, parentFolder?: FileSystemItem) => {
    if (item.type === 'file' && item.name === '.keep') {
      return null;
    }
    const isExpanded = item.id === 'root';
    const isFolder = item.type === 'folder';
    const isOCR = item.ocrEnabled;
    const isFolderSelected = selectedFolder?.id === item.id;
    const isDocumentSelected = selectedDocument?.id === item.id;
    const isDragTarget = draggedFolderId === item.id;
    const hasChildren = item.children && item.children.length > 0;
    const folderLink = isFolder && item.ocrEnabled ? (ocrFolderMap.get(item.ocrFolderName ?? item.name) || ocrFolderMap.get(normalizeFolderName(item.ocrFolderName ?? item.name)) || null) : null;
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
          onContextMenu={(e) => {
            e.preventDefault();
            if (item.id !== 'root') {
              setContextMenu({ x: e.clientX, y: e.clientY, item: item });
            }
          }}
          className={`
            group w-full flex items-center gap-2 py-1.5 px-2 rounded-md text-sm
            transition-all duration-150
            ${isFolderSelected && isFolder
              ? isOCR
                ? item.dataInputMethod === 'manual' ? 'bg-blue-100 text-blue-900'
                  : item.dataInputMethod === 'both' ? 'bg-purple-100 text-purple-900'
                    : 'bg-amber-100 text-amber-900'
                : 'bg-stone-100 text-stone-900'
              : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
            }
            ${isDocumentSelected && !isFolder ? 'bg-amber-50 ring-2 ring-amber-400' : ''}
            ${isDragTarget ? 'ring-2 ring-amber-500 ring-offset-1' : ''}
          `}
          style={{ paddingLeft: `${level * 16 + 8}px` }}
        >
          <span className="w-4" />

          {isFolder ? (
            <Folder className="w-4 h-4 shrink-0 text-stone-400 group-hover:text-stone-500" />
          ) : (
            getTreeFileIcon(item.mimetype)
          )}

          <span className="flex-1 text-left truncate">{item.name}</span>

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

          {isOCR && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  aria-label={
                    item.dataInputMethod === 'manual'
                      ? 'Carga manual'
                      : item.dataInputMethod === 'both'
                        ? 'Mixta: extracción + manual'
                        : 'Extracción de datos'
                  }
                  className={`ml-auto inline-flex items-center justify-center rounded-full border px-1.5 py-0.5 ${item.dataInputMethod === 'manual'
                    ? 'bg-blue-100 text-blue-700 border-blue-200'
                    : item.dataInputMethod === 'both'
                      ? 'bg-purple-100 text-purple-700 border-purple-200'
                      : 'bg-amber-100 text-amber-700 border-amber-200'
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

          {/* {!isFolder && item.size && (
            <span className="text-xs text-stone-400">
              {(item.size / 1024).toFixed(0)} KB
            </span>
          )} */}
        </button>

        {item.name === 'Documentos' && isExpanded && item.children && (
          <div className="animate-in slide-in-from-top-1 duration-200">
            {item.children.map(child => renderTreeItem(child, level + 1, item))}
          </div>
        )}
      </div>
    );
  };

  const handleSidebarContextMenu = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        item: fileTree ?? { id: 'root', name: 'Documentos', type: 'folder', children: [] },
      });
    },
    [fileTree, setContextMenu]
  );

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
                variant="outline"
                size="sm"
                onClick={() => handleDownload(sourceFileModal)}
              >
                <Download className="w-4 h-4 mr-2" />
                Download
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

  const canRetryActiveDocument = useMemo(
    () => Boolean(resolveOcrLinkForDocument(activeDocument)),
    [activeDocument, resolveOcrLinkForDocument]
  );

  const documentBreadcrumb = useMemo(() => {
    const doc = activeDocument ?? selectedDocument;
    if (!doc) return '';
    const folderSegments = selectedFolder ? getPathSegments(selectedFolder) : [];
    return [...folderSegments, doc.name].join(' / ');
  }, [activeDocument, getPathSegments, selectedDocument, selectedFolder]);

  const getFileIcon = (mimetype?: string) => {
    if (!mimetype) return <File className="w-8 h-8" />;
    if (mimetype.startsWith('image/')) return <ImageIcon className="w-8 h-8" />;
    if (mimetype === 'application/pdf') return <FileText className="w-8 h-8" />;
    if (mimetype.includes('zip') || mimetype.includes('rar')) return <FileArchive className="w-8 h-8" />;
    return <File className="w-8 h-8" />;
  };

  const mapDataTypeToCellType = useCallback(
    (dataType: TablaColumnDataType): CellType => {
      switch (dataType) {
        case 'number':
          return 'number';
        case 'currency':
          return 'currency';
        case 'boolean':
          return 'toggle';
        case 'date':
          return 'date';
        default:
          return 'text';
      }
    },
    []
  );

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
      if (!obraId || !selectedFolder?.ocrTablaId) return;
      try {
        const res = await fetch(
          `/api/obras/${obraId}/tablas/${selectedFolder.ocrTablaId}/rows`,
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
        await refreshOcrFolderLinks({ skipCache: true });
        await buildFileTree({ skipCache: true });
      } catch (error) {
        console.error(error);
        toast.error(error instanceof Error ? error.message : 'No se pudo guardar la tabla');
      }
    },
    [buildFileTree, obraId, refreshOcrFolderLinks, selectedFolder?.ocrTablaId]
  );

  const activeFolderLink = useMemo(() => {
    if (!selectedFolder?.ocrEnabled) return null;
    const folderKey = selectedFolder.ocrFolderName ?? selectedFolder.name;
    const normalizedKey = normalizeFolderName(folderKey);
    return ocrFolderMap.get(folderKey) || ocrFolderMap.get(normalizedKey) || null;
  }, [ocrFolderMap, selectedFolder]);


  const handleAddManualRow = useCallback(() => {
    const tablaId = selectedFolder?.ocrTablaId;
    if (!tablaId) {
      toast.error('No se encontró la tabla asociada');
      return;
    }
    if (!activeFolderLink?.columns || activeFolderLink.columns.length === 0) {
      toast.error('La tabla no tiene columnas configuradas');
      return;
    }
    setIsAddRowDialogOpen(true);
  }, [activeFolderLink?.columns, selectedFolder?.ocrTablaId]);

  const handleQuickUploadClick = useCallback(() => {
    const input = document.getElementById('file-upload') as HTMLInputElement | null;
    input?.click();
  }, []);

  const handleRowAdded = useCallback(async () => {
    await refreshOcrFolderLinks({ skipCache: true });
  }, [refreshOcrFolderLinks]);

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
    const canEditTabla = Boolean(tablaColumns.length > 0 && selectedFolder?.ocrTablaId);
    const tablaColumnDefs: ColumnDef<OcrDocumentTableRow>[] = tablaColumns.map((column) => ({
      id: column.id,
      label: column.label,
      field: column.fieldKey as ColumnField<OcrDocumentTableRow>,
      editable: canEditTabla,
      cellType: mapDataTypeToCellType(column.dataType),
      required: column.required,
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
    const allColumns: ColumnDef<OcrDocumentTableRow>[] = [docSourceColumn, ...tablaColumnDefs];

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
      tableId: `ocr-orders-${obraId}-${selectedFolder?.id ?? 'none'}-${documentViewMode}-${ocrDocumentFilterPath ?? 'all'}`,
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
      onSave: canEditTabla ? handleSaveTablaRows : undefined,
      footerActions: activeFolderLink ? (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
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
            variant="outline"
            onClick={handleQuickUploadClick}
            disabled={activeFolderLink.dataInputMethod === 'manual'}
            className="gap-2"
          >
            <Upload className="w-4 h-4" />
            Subir documento
          </Button>
        </div>
      ) : null,
      toolbarActions: selectedFolder?.ocrTablaId ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => router.push(`/excel/${obraId}/tabla/${selectedFolder.ocrTablaId}/reporte`)}
          className="gap-1.5"
        >
          <ClipboardList className="w-3.5 h-3.5" />
          Generar reporte
        </Button>
      ) : null,
    };
  }, [activeFolderLink, clearOcrDocumentFilter, documentViewMode, documentsByStoragePath, handleAddManualRow, handleFilterRowsByDocument, handleOpenDocumentSheetByPath, handleQuickUploadClick, handleSaveTablaRows, mapDataTypeToCellType, obraId, ocrDocumentFilterName, ocrDocumentFilterPath, ocrTableRows, router, selectedFolder?.id, selectedFolder?.ocrTablaId, supabase]);

  const handleRetryDocumentOcr = useCallback(
    async (doc: FileSystemItem | null) => {
      if (!doc || !doc.storagePath) {
        toast.error('Seleccioná un documento válido para reprocesar.');
        return;
      }
      const link = resolveOcrLinkForDocument(doc);
      if (!link) {
        toast.error('Este documento no está vinculado a una tabla OCR.');
        return;
      }
      try {
        setRetryingDocumentId(doc.id);
        const formData = new FormData();
        formData.append('existingBucket', 'obra-documents');
        formData.append('existingPath', doc.storagePath);
        formData.append('existingFileName', doc.name);

        const response = await fetch(
          `/api/obras/${obraId}/tablas/${link.tablaId}/import/ocr?skipStorage=1`,
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
              : 'Superaste el límite de tokens de IA de tu plan.';
          if (response.status === 402) {
            toast.warning(limitMessage);
          } else {
            toast.error(`No se pudo reprocesar ${link.tablaName}.`);
          }
          return;
        }
        toast.success(
          payload?.inserted
            ? `Se importaron ${payload.inserted} filas en ${link.tablaName}`
            : `Documento reprocesado en ${link.tablaName}`
        );
        await refreshOcrFolderLinks({ skipCache: true });
        await buildFileTree({ skipCache: true });
      } catch (error) {
        console.error('Error retrying OCR document', error);
        toast.error('No se pudo reprocesar el documento.');
      } finally {
        setRetryingDocumentId(null);
      }
    },
    [buildFileTree, obraId, refreshOcrFolderLinks, resolveOcrLinkForDocument]
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
    const sortedItems = [...folders, ...files];

    // OCR folder toggle header for documents mode
    const hasTablaSchema = Boolean(activeFolderLink?.columns && activeFolderLink.columns.length > 0);
    const ocrToggleHeader = selectedFolder.ocrEnabled ? (
      <div className="space-y-2 mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-lg border border-stone-200 bg-white">
          <div className="flex items-center gap-3">
            <Table2 className={`w-5 h-5 ${getFolderIconColor(activeFolderLink?.dataInputMethod)}`} />
            <h2 className="text-base font-semibold text-stone-800">{selectedFolder.name}</h2>
            <span className="text-sm text-stone-500">
              {documentViewMode === 'table'
                ? `(${ocrFilteredRowCount} filas)`
                : `(${files.length} archivos)`}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Only show toggle button if folder supports file viewing (not manual-only) */}
            {selectedFolder.ocrEnabled && hasTablaSchema && activeFolderLink?.dataInputMethod !== 'manual' && (
              <div className="inline-flex items-center rounded-md border border-stone-200 bg-stone-50 p-0.5">
                <Button
                  type="button"
                  variant={documentViewMode === 'cards' ? 'default' : 'ghost'}
                  size="sm"
                  className="gap-1.5 h-8 px-3"
                  aria-pressed={documentViewMode === 'cards'}
                  onClick={() => handleDocumentViewModeChange('cards')}
                >
                  <Folder className="w-3.5 h-3.5" />
                  Archivos
                </Button>
                <Button
                  type="button"
                  variant={documentViewMode === 'table' ? 'default' : 'ghost'}
                  size="sm"
                  className="gap-1.5 h-8 px-3"
                  aria-pressed={documentViewMode === 'table'}
                  onClick={() => handleDocumentViewModeChange('table')}
                >
                  <Table2 className="w-3.5 h-3.5" />
                  Tabla
                </Button>
              </div>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleQuickUploadClick}
              className="gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              Subir archivos
            </Button>
          </div>
        </div>
        {hasTablaSchema && ocrDocumentFilterPath && documentViewMode === 'table' && (
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
    ) : null;

    if (isOcrDocumentsMode && documentViewMode === 'table') {
      const hasTablaSchema = Boolean(activeFolderLink?.columns && activeFolderLink.columns.length > 0);
      return (
        <div className="h-full flex flex-col">
          {ocrToggleHeader}
          <div className="flex-1 rounded-lg border border-stone-200 bg-white shadow-sm overflow-hidden pt-0 px-4">
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
                      variant="outline"
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
                      variant="outline"
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
                        variant="outline"
                        size="sm"
                        onClick={handleAddManualRow}
                        className="gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Agregar fila
                      </Button>
                      <Button
                        variant="outline"
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
                <FormTable key={ocrFormTableConfig.tableId} config={ocrFormTableConfig} className="max-h-[50vh]" />
              </div>
            )}
          </div>
        </div>
      );
    }

    const folderBody = (() => {
      if (sortedItems.length === 0) {
        return (
          <div className="flex h-full flex-col items-center justify-center text-stone-400">
            <Folder className="w-16 h-16 mb-4 opacity-20" />
            <p>Esta carpeta está vacía</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => document.getElementById('file-upload')?.click()}
              className="mt-4"
            >
              <Upload className="w-4 h-4 mr-2" />
              Subir archivos
            </Button>
          </div>
        );
      }

      return (
        <div
          className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 rounded-lg transition-colors mt-4 ${isGlobalFileDragActive ? 'border-2 border-dashed border-amber-500 bg-amber-50/60' : ''
            }`}
          onDragEnter={handleDocumentAreaDragEnter}
          onDragOver={handleDocumentAreaDragOver}
          onDragLeave={handleDocumentAreaDragLeave}
          onDrop={handleDocumentAreaDrop}
        >
          {sortedItems.map(item => {
            const isDragTarget = draggedFolderId === item.id;
            return (
              <div key={item.id} className="group cursor-default transition-colors flex flex-col items-center gap-2">
                <div
                  className={`flex flex-col items-start gap-2 p-3 w-[120px] h-[145px] border rounded-none hover:bg-stone-100 transition-colors bg-linear-to-b from-stone-200 to-stone-300 relative ${item.type === 'folder' && isDragTarget ? 'ring-2 ring-amber-500 ring-offset-2' : ''}`}
                  onClick={() => {
                    if (item.type === 'folder') {
                      handleFolderClick(item);
                    } else {
                      handleDocumentClick(item, selectedFolder, { preserveFilter: true });
                    }
                  }}
                  onDragEnter={item.type === 'folder' ? (event) => handleFolderDragEnter(event, item) : undefined}
                  onDragOver={item.type === 'folder' ? (event) => handleFolderDragOver(event, item) : undefined}
                  onDragLeave={item.type === 'folder' ? (event) => handleFolderDragLeave(event, item) : undefined}
                  onDrop={item.type === 'folder' ? (event) => handleFolderDrop(event, item) : undefined}
                >
                  <div className="pt-15 flex flex-col items-center justify-center w-full">
                    {item.type === 'folder' ? (
                      item.ocrEnabled ? (
                        <Table2 className={`w-10 h-10 ${getFolderIconColor(item.dataInputMethod)} absolute mx-auto top-5 transform origin-[50%_100%] group-hover:transform-[perspective(800px)_rotateX(-30deg)] transition-transform duration-300`} />
                      ) : (
                        <Folder className="w-10 h-10 text-stone-500 absolute mx-auto top-5 transform origin-[50%_100%] group-hover:transform-[perspective(800px)_rotateX(-30deg)] transition-transform duration-300" />
                      )
                    ) : (
                      <div className="absolute inset-0 top-0 flex items-center justify-center">
                        <FileThumbnail item={item} />
                      </div>
                    )}
                    <span className="text-sm text-center truncate w-full text-stone-700" title={item.name}>
                      {item.name}
                    </span>
                    {item.type === 'file' && item.size && (
                      <span className="text-xs text-stone-500">
                        {(item.size / 1024).toFixed(1)} KB
                      </span>
                    )}
                  </div>
                  {item.type === 'folder' ? (<FolderFront className="w-[110px] h-[80px] absolute -bottom-1 -left-1 transform origin-[50%_100%] group-hover:transform-[perspective(800px)_rotateX(-30deg)] transition-transform duration-300" />) : null}
                  <div className="absolute top-2 right-2">
                    {renderOcrStatusBadge(item)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      );

    })();

    const folderContent = (
      <div
        className={`h-full flex flex-col transition-colors ${isGlobalFileDragActive ? 'ring-2 ring-amber-500 ring-offset-2 bg-amber-50/40' : ''}`}
        onDragEnter={handleDocumentAreaDragEnter}
        onDragOver={handleDocumentAreaDragOver}
        onDragLeave={handleDocumentAreaDragLeave}
        onDrop={handleDocumentAreaDrop}
      >
        {ocrToggleHeader}
        {!selectedFolder.ocrEnabled && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 mb-4 rounded-lg border border-stone-200 bg-white">
            <div className="flex items-center gap-3">
              <Folder className="w-5 h-5 text-stone-500" />
              <h2 className="text-base font-semibold text-stone-800">{selectedFolder.name}</h2>
              <span className="text-sm text-stone-500">({files.length} archivos)</span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleQuickUploadClick}
              className="gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              Subir archivos
            </Button>
          </div>
        )}
        <div className="flex-1 min-h-[320px]">{folderBody}</div>
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
      // Wait for sheet close animation (300ms) before clearing document data
      sheetCloseTimeoutRef.current = setTimeout(() => {
        closeDocumentPreview();
        sheetCloseTimeoutRef.current = null;
      }, 300);
    }
  }, [closeDocumentPreview]);

  return (
    <div className="relative min-h-[calc(100vh-9rem)] flex flex-col gap-4 bg-stone-50">
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
                <p className="text-lg font-semibold text-stone-800">Procesando carpeta OCR</p>
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
          onContextMenu={handleSidebarContextMenu}
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
      />

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
              {createFolderMode === 'data' ? 'Nueva carpeta de datos' : 'Nueva carpeta'}
            </DialogTitle>
            <DialogDescription>
              {createFolderMode === 'data'
                ? 'Asociá esta carpeta a una tabla de datos y elegí cómo cargar la información.'
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
                />
                {createFolderError && (
                  <p className="text-xs text-red-600">{createFolderError}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Ruta: Documentos/{createFolderParentPath ? `${createFolderParentPath}/` : ''}{normalizeFolderName(newFolderName) || 'mi-carpeta'}
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
                      variant="outline"
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
                      variant="outline"
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
                variant="outline"
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

      {selectedFolder?.ocrTablaId && activeFolderLink?.columns && (
        <AddRowDialog
          open={isAddRowDialogOpen}
          onOpenChange={setIsAddRowDialogOpen}
          columns={activeFolderLink.columns}
          tablaId={selectedFolder.ocrTablaId}
          obraId={obraId}
          onRowAdded={handleRowAdded}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Eliminación</DialogTitle>
          </DialogHeader>
          <div className="py-4">
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
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
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
          const canCreateHere = parentFolder && !parentFolder.ocrEnabled;
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

function OcrDocumentSourceCell({
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
}
