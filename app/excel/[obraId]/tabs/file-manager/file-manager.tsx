'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { MouseEvent } from 'react';
import { FormTable, type FormTableConfig, type FormTableRow, type ColumnDef } from '@/components/form-table/form-table';
import { createSupabaseBrowserClient } from '@/utils/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
} from 'lucide-react';
import { toast } from 'sonner';
import * as Sentry from '@sentry/nextjs';
import ForgeViewer from '@/app/viewer/forgeviewer';
import { EnhancedDocumentViewer } from '@/components/viewer/enhanced-document-viewer';
import FolderFront from '@/components/ui/FolderFront';
import { DocumentSheet } from './components/document-sheet';
import { FileTreeSidebar } from './components/file-tree-sidebar';
import { useSelectionStore } from './hooks/useSelectionStore';
import { OcrTemplateConfigurator } from '@/app/admin/obra-defaults/_components/OcrTemplateConfigurator';
import { normalizeFolderName, normalizeFieldKey, ensureTablaDataType, TABLA_DATA_TYPES, type TablaColumnDataType } from '@/lib/tablas';
import { cn } from '@/lib/utils';
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
};

type OcrOrderItemRow = FormTableRow & {
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

export function FileManager({
  obraId,
  materialOrders = [],
  onRefreshMaterials,
  selectedFolderPath = null,
  selectedFilePath = null,
  onSelectionChange,
}: FileManagerProps) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
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
          <span className="text-sm text-center truncate w-full text-stone-700 absolute bottom-0 left-0 right-0 px-2 py-1 bg-stone-200/50 backdrop-blur-sm" title={item.name}>
            {item.name}
          </span>
        </div>
      );
    }

    return <>{getFileIcon(item.mimetype)}</>;
  };
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsKey = searchParams?.toString() ?? '';

  // State
  const { state: selectionState, actions: selectionActions } = useSelectionStore();
  const { fileTree, selectedFolder, selectedDocument, sheetDocument, expandedFolderIds } = selectionState;
  const expandedFolders = expandedFolderIds;
  const { setFileTree, setSelectedFolder, setSelectedDocument, setSheetDocument, setExpandedFolderIds } = selectionActions;
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
  const [loading, setLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [createFolderParent, setCreateFolderParent] = useState<FileSystemItem | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [createFolderMode, setCreateFolderMode] = useState<'normal' | 'ocr' | null>(null);
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
  const [ocrFolderLinks, setOcrFolderLinks] = useState<OcrFolderLink[]>([]);
  const [isGlobalFileDragActive, setIsGlobalFileDragActive] = useState(false);
  const [isTemplateConfiguratorOpen, setIsTemplateConfiguratorOpen] = useState(false);

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
      'px-2 py-0.5 text-[10px] font-semibold rounded-full border flex items-center gap-1';
    switch (item.ocrDocumentStatus) {
      case 'completed':
        return (
          <span className={cn(baseClass, 'bg-green-100 text-green-700 border-green-500/30 px-1.5 ')}>
            ✓
          </span>
        );
      case 'failed':
        return (
          <span className={`${baseClass} bg-red-500/15 text-red-700 border-red-500/30`}>
            Error
          </span>
        );
      case 'processing':
        return (
          <span className={`${baseClass} bg-blue-500/15 text-blue-700 border-blue-500/30`}>
            Procesando
          </span>
        );
      case 'pending':
        return (
          <span className={`${baseClass} bg-amber-500/15 text-amber-700 border-amber-500/30`}>
            Pendiente
          </span>
        );
      case 'unprocessed':
        return (
          <span className={`${baseClass} bg-stone-200 text-stone-700 border-stone-300`}>
            Sin OCR
          </span>
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
    if (createFolderMode !== 'ocr') return;
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

  const refreshOcrFolderLinks = useCallback(async (options: { skipCache?: boolean } = {}) => {
    if (!obraId) return;

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
      const res = await fetch(`/api/obras/${obraId}/tablas`, { cache: 'no-store' });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || 'No se pudieron obtener las tablas OCR');
      }
      const payload = await res.json();
      const tablas = (payload?.tablas ?? []) as Array<any>;
      const ocrTables = tablas.filter((tabla) => tabla.sourceType === 'ocr');
      const results = await Promise.all(
        ocrTables.map(async (tabla) => {
          const tablaSettings = (tabla.settings as Record<string, unknown>) ?? {};
          const folderName = typeof tablaSettings.ocrFolder === 'string' ? tablaSettings.ocrFolder : '';
          if (!folderName) return null;
          const tablaColumnsRaw = Array.isArray(tabla.columns) ? (tabla.columns as Array<any>) : [];
          const normalizedColumns: OcrTablaColumn[] = tablaColumnsRaw.map((column) => ({
            id: typeof column.id === 'string' ? column.id : String(column.id ?? column.fieldKey ?? crypto.randomUUID()),
            fieldKey: typeof column.fieldKey === 'string' ? column.fieldKey : normalizeFieldKey(String(column.fieldKey ?? column.id ?? 'col')),
            label: typeof column.label === 'string' ? column.label : String(column.fieldKey ?? column.id ?? 'Columna'),
            dataType: ensureTablaDataType(column.dataType ?? column.data_type),
            required: Boolean(column.required),
          }));
          let documents: OcrDocumentStatus[] = [];
          try {
            const docsRes = await fetch(
              `/api/obras/${obraId}/tablas/${tabla.id}/documents`,
              { cache: 'no-store' }
            );
            if (docsRes.ok) {
              const docsPayload = await docsRes.json().catch(() => ({} as any));
              documents = Array.isArray(docsPayload?.documents) ? docsPayload.documents : [];
            }
          } catch (docsError) {
            console.error('Error fetching OCR documents', docsError);
          }
          try {
            const rowsRes = await fetch(
              `/api/obras/${obraId}/tablas/${tabla.id}/rows?limit=500`,
              { cache: 'no-store' }
            );
            if (!rowsRes.ok) throw new Error('rows');
            const rowsPayload = await rowsRes.json();
            const rows = Array.isArray(rowsPayload?.rows) ? rowsPayload.rows : [];
            return {
              tablaId: tabla.id as string,
              tablaName: tabla.name as string,
              folderName,
              columns: normalizedColumns,
              rows,
              orders: mapTablaRowsToOrders(rows, tabla.id as string),
              documents,
            } as OcrFolderLink;
          } catch (rowsError) {
            console.error('Error fetching tabla rows', rowsError);
            return {
              tablaId: tabla.id as string,
              tablaName: tabla.name as string,
              folderName,
              columns: normalizedColumns,
              rows: [],
              orders: [],
              documents,
            } as OcrFolderLink;
          }
        })
      );
      const links = results.filter(Boolean) as OcrFolderLink[];
      setCachedOcrLinks(obraId, links);
      setOcrFolderLinks(links);
    } catch (error) {
      console.error('Error refreshing OCR folder links', error);
    }
  }, [mapTablaRowsToOrders, obraId]);

  // Build file tree from storage
  const buildFileTree = useCallback(async (options: { skipCache?: boolean } = {}) => {
    // Check file tree cache first (unless skipCache is true)
    if (!options.skipCache) {
      const cachedTree = getCachedFileTree(obraId);
      if (cachedTree) {
        hydrateTreeWithOcrData(cachedTree);
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
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    try {
      // Check APS models cache
      let apsModels: Array<{ file_path: string; aps_urn: string }> = getCachedApsModels(obraId) ?? [];
      if (apsModels.length === 0) {
        const apsResponse = await fetch(`/api/aps/models?obraId=${obraId}`);
        const apsModelsData = await apsResponse.json();
        apsModels = apsModelsData.data || [];
        if (apsModels.length > 0) {
          setCachedApsModels(obraId, apsModels);
        }
      }

      const urnMap = new Map<string, string>();
      apsModels.forEach((model) => {
        urnMap.set(model.file_path, model.aps_urn);
      });

      const { data: files, error } = await supabase.storage
        .from('obra-documents')
        .list(obraId, {
          limit: 1000,
          sortBy: { column: 'name', order: 'asc' },
        });

      if (error) throw error;

      const root: FileSystemItem = {
        id: 'root',
        name: 'Documentos',
        type: 'folder',
        children: [],
      };

      const folderMap = new Map<string, FileSystemItem>();
      folderMap.set('root', root);

      const foldersToLoad: string[] = [];

      for (const item of files || []) {
        if (item.name === '.keep') continue;

        const isFolder = item.id === null || !item.metadata || (item.metadata && !item.metadata.mimetype);

        if (isFolder) {
          const folderName = item.name.replace(/\/$/, '');
          const normalizedFolderName = normalizeFolderName(folderName);
          foldersToLoad.push(folderName);
          const linkedTabla =
            ocrFolderMap.get(folderName) || ocrFolderMap.get(normalizedFolderName);

          const folderId = `folder-${folderName}`;
          const folder: FileSystemItem = {
            id: folderId,
            name: folderName,
            type: 'folder',
            children: [],
            ocrEnabled: Boolean(linkedTabla),
            ocrTablaId: linkedTabla?.tablaId,
            ocrTablaName: linkedTabla?.tablaName,
            ocrFolderName: linkedTabla?.folderName ?? normalizedFolderName,
            ocrTablaColumns: linkedTabla?.columns,
            ocrTablaRows: linkedTabla?.rows,
            extractedData: linkedTabla ? linkedTabla.orders : undefined,
          };
          folderMap.set(folderId, folder);
          root.children?.push(folder);
        }
      }

      for (const folderName of foldersToLoad) {
        const normalizedFolderName = normalizeFolderName(folderName);
        const folder = folderMap.get(`folder-${folderName}`);
        if (!folder) continue;

        const { data: folderContents, error: folderError } = await supabase.storage
          .from('obra-documents')
          .list(`${obraId}/${folderName}`, {
            limit: 1000,
            sortBy: { column: 'name', order: 'asc' },
          });

        if (folderError) continue;

        if (folderContents) {
          for (const file of folderContents) {
            if (file.id === null || file.name === '.keep') continue;

            const storagePath = `${obraId}/${folderName}/${file.name}`;
            const apsUrn = urnMap.get(storagePath);
            const folderLink =
              ocrFolderMap.get(folderName) || ocrFolderMap.get(normalizedFolderName);
            const docStatus = folderLink?.documents?.find((doc) => doc.source_path === storagePath);

            const fileItem: FileSystemItem = {
              id: `file-${folderName}-${file.name}`,
              name: file.name,
              type: 'file',
              size: file.metadata?.size,
              mimetype: file.metadata?.mimetype,
              storagePath: storagePath,
              apsUrn: apsUrn,
              ocrDocumentStatus: docStatus ? docStatus.status : folder?.ocrEnabled ? 'unprocessed' : undefined,
              ocrDocumentId: docStatus?.id,
              ocrDocumentError: docStatus?.error_message ?? null,
              ocrRowsExtracted: docStatus?.rows_extracted ?? null,
            };

            if (folderName === 'materiales') {
              const matchingOrder = materialOrders.find(order => {
                if (!order.docPath) return false;
                const pathParts = order.docPath.split('/');
                const docFileName = pathParts[pathParts.length - 1];
                return file.name === docFileName;
              });

              if (matchingOrder) {
                fileItem.dataId = matchingOrder.id;
              }
            }

            folder.children?.push(fileItem);
          }
        }
      }

      const materialesFolderRef = Array.from(folderMap.values()).find(f => f.name === 'materiales');
      const linkedMaterialTabla = ocrFolderMap.get('materiales');

      if (!materialesFolderRef && !linkedMaterialTabla && materialOrders.length > 0) {
        try {
          const folderPath = `${obraId}/materiales/.keep`;
          await supabase.storage
            .from('obra-documents')
            .upload(folderPath, new Blob([''], { type: 'text/plain' }), { upsert: false });

          const newMaterialesFolder: FileSystemItem = {
            id: 'folder-materiales',
            name: 'materiales',
            type: 'folder',
            children: [],
            ocrEnabled: true,
            ocrFolderName: 'materiales',
            extractedData: materialOrders,
          };
          folderMap.set('folder-materiales', newMaterialesFolder);
          root.children?.push(newMaterialesFolder);
        } catch (createError: any) {
          console.log('Could not create materiales folder:', createError);
        }
      }

      const rootFiles = (files || []).filter(item =>
        item.id !== null &&
        item.name !== '.keep' &&
        item.metadata?.mimetype !== undefined &&
        !item.name.endsWith('/')
      );

      for (const file of rootFiles) {
        const storagePath = `${obraId}/${file.name}`;
        const fileItem: FileSystemItem = {
          id: `file-root-${file.name}`,
          name: file.name,
          type: 'file',
          size: file.metadata?.size,
          mimetype: file.metadata?.mimetype,
          storagePath: storagePath,
          apsUrn: urnMap.get(storagePath),
        };
        root.children?.push(fileItem);
      }

      hydrateTreeWithOcrData(root);
      rebuildParentMap(root);
      setCachedFileTree(obraId, root);
      setFileTree(root);
      if (!selectedFolder) {
        setSelectedFolder(root);
      }

      const foldersToExpand = ['root'];
      const foldersWithContent = root.children
        ?.filter(c => c.type === 'folder' && c.children && c.children.length > 0)
        .map(c => c.id) || [];

      foldersToExpand.push(...foldersWithContent);
      setExpandedFolderIds(new Set(foldersToExpand));
    } catch (error) {
      console.error('Error building file tree:', error);
      Sentry.captureException(error, {
        tags: { feature: 'file-manager' },
        extra: { obraId, materialOrdersCount: materialOrders.length },
      });
      toast.error('Error loading documents');
    } finally {
      setLoading(false);
    }
  }, [hydrateTreeWithOcrData, obraId, materialOrders, ocrFolderMap, rebuildParentMap, supabase]);

  useEffect(() => {
    if (!obraId) return;
    if (lastBootstrapObraIdRef.current === obraId) return;
    lastBootstrapObraIdRef.current = obraId;

    const bootstrap = async () => {
      try {
        await refreshOcrFolderLinks({ skipCache: true });
        await buildFileTree({ skipCache: true });
      } catch (error) {
        console.error('Error initializing documents data', error);
      }
    };

    void bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obraId]);

  useEffect(() => {
    if (!obraId) return;
    if (ocrFolderLinks.length === 0) return;
    void buildFileTree({ skipCache: true });
  }, [obraId, ocrFolderLinks.length, buildFileTree]);

  useEffect(() => {
    if (!selectedFolder?.ocrEnabled) {
      setDocumentViewMode('cards');
      setOcrDataViewMode('cards');
      lastOcrFolderIdRef.current = null;
      return;
    }
    if (lastOcrFolderIdRef.current !== selectedFolder.id) {
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
      await handleDocumentClick(doc, parent, { preserveFilter: true, emitSelection: false });
      displayedDocumentRef.current = doc;
      setIsDocumentSheetOpen(true);
    },
    [findDocumentByStoragePath, handleDocumentClick]
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
    const parentSegments = resolveParentSegments(createFolderParent);
    const basePath = parentSegments.length ? `${obraId}/${parentSegments.join('/')}` : obraId;
    try {
      const folderPath = `${basePath}/${rawFolderName}/.keep`;
      const { error } = await supabase.storage
        .from('obra-documents')
        .upload(folderPath, new Blob([''], { type: 'text/plain' }));
      if (error) throw error;
      toast.success('Carpeta creada correctamente');
      setIsCreateFolderOpen(false);
      resetNewFolderForm();
      await buildFileTree({ skipCache: true });
    } catch (error) {
      console.error('Error creating folder:', error);
      toast.error('Error creando carpeta');
    }
  }, [buildFileTree, createFolderParent, newFolderName, obraId, resetNewFolderForm, resolveParentSegments, supabase]);

  const createOcrFolder = useCallback(async () => {
    const rawFolderName = newFolderName.trim();
    if (!rawFolderName) {
      toast.error('Ingresá un nombre de carpeta OCR válido');
      return;
    }
    const normalizedFolder = normalizeFolderName(rawFolderName);
    if (!normalizedFolder) {
      toast.error('Ingresá un nombre de carpeta OCR válido');
      return;
    }
    if (!newFolderOcrTemplateId) {
      toast.error('Elegí o creá una plantilla OCR');
      return;
    }
    if (newFolderColumns.length === 0) {
      toast.error('Añadí al menos una columna para la tabla OCR');
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
        sourceType: 'ocr' as const,
        ocrFolderName: normalizedFolder,
        hasNestedData: newFolderHasNested,
        ocrTemplateId: newFolderOcrTemplateId,
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
        const text = await res.text();
        throw new Error(text || 'No se pudo crear la carpeta OCR');
      }

      try {
        await supabase.storage
          .from('obra-documents')
          .upload(`${basePath}/${normalizedFolder}/.keep`, new Blob([''], { type: 'text/plain' }), { upsert: true });
      } catch (keepError) {
        console.error('No se pudo crear la carpeta en almacenamiento', keepError);
      }

      toast.success('Carpeta OCR creada y vinculada');
      setIsCreateFolderOpen(false);
      resetNewFolderForm();
      await refreshOcrFolderLinks({ skipCache: true });
      await buildFileTree({ skipCache: true });
    } catch (error) {
      console.error('Error creating OCR folder:', error);
      toast.error(error instanceof Error ? error.message : 'Error creando carpeta OCR');
    }
  }, [
    buildFileTree,
    createFolderParent,
    newFolderColumns,
    newFolderDescription,
    newFolderHasNested,
    newFolderName,
    newFolderOcrTemplateId,
    obraId,
    refreshOcrFolderLinks,
    resetNewFolderForm,
    resolveParentSegments,
    supabase,
  ]);

  const handleCreateFolder = useCallback(async () => {
    if (createFolderMode === 'ocr') {
      await createOcrFolder();
    } else {
      await createNormalFolder();
    }
  }, [createFolderMode, createNormalFolder, createOcrFolder]);

  const uploadFilesToFolder = useCallback(async (inputFiles: FileList | File[], targetFolder?: FileSystemItem | null) => {
    const filesArray = Array.isArray(inputFiles) ? inputFiles : Array.from(inputFiles);
    if (!filesArray.length) return;

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

    try {
      for (const file of filesArray) {
        const filePath = `${folderPath}/${file.name}`;

        const { error } = await supabase.storage
          .from('obra-documents')
          .upload(filePath, file);

        if (error) throw error;

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
                toast.error(`No se pudieron extraer datos para ${linkedTabla.tablaName}`);
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
  }, [buildFileTree, fileTree, getPathSegments, obraId, ocrTablaMap, onRefreshMaterials, refreshOcrFolderLinks, selectedFolder, supabase]);

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

  const isCreateFolderDisabled =
    !newFolderName.trim() ||
    (createFolderMode === 'ocr' && (!newFolderOcrTemplateId || newFolderColumns.length === 0));

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

  const openCreateFolderDialog = useCallback((mode: 'normal' | 'ocr', parent?: FileSystemItem | null) => {
    if (parent && parent.ocrEnabled) {
      toast.error('No podés crear carpetas dentro de una carpeta OCR');
      return;
    }
    setCreateFolderMode(mode);
    setCreateFolderParent(parent ?? fileTree ?? null);
    setNewFolderName('');
    setNewFolderHasNested(false);
    setIsCreateFolderOpen(true);
    if (mode === 'ocr') {
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
      if (item.type === 'file') {
        if (item.storagePath) {
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
          const filePaths = files.map(file => `${folderPath}/${file.name}`);
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

  // NEW: Styled tree item with amber accents for OCR folders
  const renderTreeItem = (item: FileSystemItem, level: number = 0, parentFolder?: FileSystemItem) => {
    // const isExpanded = expandedFolders.has(item.id);
    const isExpanded = expandedFolders.has(item.id) || item.id === 'root';
    const isFolder = item.type === 'folder';
    const isOCR = item.ocrEnabled;
    const isFolderSelected = selectedFolder?.id === item.id;
    const isDocumentSelected = selectedDocument?.id === item.id;
    const isDragTarget = draggedFolderId === item.id;
    const hasChildren = item.children && item.children.length > 0;

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
                ? 'bg-amber-100 text-amber-900'
                : 'bg-blue-50 text-blue-900'
              : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
            }
            ${isDocumentSelected && !isFolder ? 'bg-amber-50 ring-2 ring-amber-400' : ''}
            ${isDragTarget ? 'ring-2 ring-amber-500 ring-offset-1' : ''}
          `}
          style={{ paddingLeft: `${level * 16 + 8}px` }}
        >
          {isFolder && hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleFolder(item.id);
              }}
              className="p-0.5 hover:bg-stone-200 rounded transition-colors"
            >
              {/* {isExpanded ? (
                <ChevronDown className="w-3 h-3 text-stone-400" />
              ) : (
                <ChevronRight className="w-3 h-3 text-stone-400" />
              )} */}
            </button>
          ) : (
            <span className="w-4" />
          )}

          {isOCR ? (
            <Table2 className="w-4 h-4 shrink-0 text-amber-600" />
          ) : isFolder ? (
            <Folder className="w-4 h-4 shrink-0 text-stone-400 group-hover:text-stone-500" />
          ) : (
            getTreeFileIcon(item.mimetype)
          )}

          <span className="flex-1 text-left truncate">{item.name}</span>

          {isOCR && (
            <span className="ml-auto text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">
              OCR
            </span>
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

  const documentBreadcrumb = useMemo(() => {
    const doc = displayedDocumentRef.current ?? sheetDocument ?? selectedDocument;
    if (!doc) return '';
    const folderSegments = selectedFolder ? getPathSegments(selectedFolder) : [];
    return [...folderSegments, doc.name].join(' / ');
  }, [getPathSegments, selectedDocument, selectedFolder, sheetDocument]);

  const getFileIcon = (mimetype?: string) => {
    if (!mimetype) return <File className="w-8 h-8" />;
    if (mimetype.startsWith('image/')) return <ImageIcon className="w-8 h-8" />;
    if (mimetype === 'application/pdf') return <FileText className="w-8 h-8" />;
    if (mimetype.includes('zip') || mimetype.includes('rar')) return <FileArchive className="w-8 h-8" />;
    return <File className="w-8 h-8" />;
  };

  const mapDataTypeToCellType = useCallback(
    (dataType: TablaColumnDataType): ColumnDef<OcrDocumentTableRow>["cellType"] => {
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
      field: column.fieldKey as keyof OcrDocumentTableRow,
      editable: canEditTabla,
      cellType: mapDataTypeToCellType(column.dataType),
      required: column.required,
    }));
    const docSourceColumn: ColumnDef<OcrDocumentTableRow> = {
      id: 'doc-source',
      label: 'Documento origen',
      field: '__docFileName' as keyof OcrDocumentTableRow,
      editable: false,
      cellType: 'text',
      enableHide: false,
      cellConfig: {
        renderReadOnly: ({ row }) => (
          <OcrDocumentSourceCell
            row={row as OcrDocumentTableRow}
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
          onSelect: (row) => {
            const docPath = typeof (row as Record<string, unknown>).__docPath === 'string'
              ? (row as Record<string, unknown>).__docPath
              : null;
            const docName = typeof (row as Record<string, unknown>).__docFileName === 'string'
              ? (row as Record<string, unknown>).__docFileName
              : null;
            handleFilterRowsByDocument(docPath, docName);
          },
        },
        {
          id: 'preview-doc',
          label: 'Ver documento',
          onSelect: (row) => {
            const docPath = typeof (row as Record<string, unknown>).__docPath === 'string'
              ? (row as Record<string, unknown>).__docPath
              : null;
            void handleOpenDocumentSheetByPath(docPath);
          },
        },
      ],
    };
    const columns: ColumnDef<OcrDocumentTableRow>[] = [docSourceColumn, ...tablaColumnDefs];
    return {
      tableId: `ocr-orders-${obraId}-${selectedFolder?.id ?? 'none'}-${documentViewMode}-${ocrDocumentFilterPath ?? 'all'}`,
      searchPlaceholder: 'Buscar en esta tabla',
      columns,
      createFilters: () => ({ docPath: ocrDocumentFilterPath }),
      applyFilters: (row: OcrDocumentTableRow, filters: OcrDocumentTableFilters) => {
        if (!filters.docPath) return true;
        const docPath = typeof (row as Record<string, unknown>).__docPath === 'string'
          ? (row as Record<string, unknown>).__docPath
          : null;
        return docPath === filters.docPath;
      },
      defaultRows: ocrTableRows,
      // tabFilters: [{ id: 'all', label: 'Todas' }],
      emptyStateMessage: 'Sin datos disponibles para esta tabla.',
      showInlineSearch: true,
      onSave: canEditTabla ? handleSaveTablaRows : undefined,
    };
  }, [activeFolderLink, documentViewMode, documentsByStoragePath, handleFilterRowsByDocument, handleOpenDocumentSheetByPath, handleSaveTablaRows, mapDataTypeToCellType, obraId, ocrDocumentFilterPath, ocrTableRows, selectedFolder?.id, supabase]);

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
    const files = items.filter(item => item.type === 'file');
    const sortedItems = [...folders, ...files];

    // OCR folder toggle header for documents mode
    const hasTablaSchema = Boolean(activeFolderLink?.columns && activeFolderLink.columns.length > 0);
    const ocrToggleHeader = selectedFolder.ocrEnabled ? (
      <div className="space-y-2 mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-lg border border-stone-200 bg-white">
          <div className="flex items-center gap-3">
            <Folder className="w-5 h-5 text-amber-600" />
            <h2 className="text-base font-semibold text-stone-800">{selectedFolder.name}</h2>
            <span className="text-sm text-stone-500">
              {documentViewMode === 'table'
                ? `(${ocrFilteredRowCount} filas)`
                : `(${files.length} archivos)`}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {selectedFolder.ocrTablaId && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleNavigateToTabla(selectedFolder.ocrTablaId)}
                className="gap-1.5"
              >
                <Table2 className="w-3.5 h-3.5" />
                Ver tabla
              </Button>
            )}
            {selectedFolder.ocrEnabled && hasTablaSchema && (
              <Button
                type="button"
                variant={documentViewMode === 'table' ? 'default' : 'outline'}
                size="sm"
                className="gap-1.5"
                onClick={() =>
                  handleDocumentViewModeChange(documentViewMode === 'table' ? 'cards' : 'table')
                }
              >
                {documentViewMode === 'table' ? (
                  <>
                    <Folder className="w-3.5 h-3.5" />
                    Ver archivos
                  </>
                ) : (
                  <>
                    <Table2 className="w-3.5 h-3.5" />
                    Cambiar a tabla
                  </>
                )}
              </Button>
            )}
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
                <p>Esta carpeta OCR todavía no tiene columnas configuradas.</p>
                <p>Configuralas desde la pestaña Tablas para ver los datos acá.</p>
              </div>
            ) : ocrTableRows.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-sm text-stone-500 p-6 text-center">
                <Table2 className="w-10 h-10 mb-3 text-stone-300" />
                <p>No hay filas extraídas para esta tabla.</p>
                <p className="text-xs text-stone-400 mt-1">Subí o reprocesá documentos para ver resultados.</p>
              </div>
            ) : (
              <FormTable key={ocrFormTableConfig.tableId} config={ocrFormTableConfig} className="max-h-[50vh]" />
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
          className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 rounded-lg transition-colors ${isGlobalFileDragActive ? 'border-2 border-dashed border-amber-500 bg-amber-50/60' : ''
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
                        <Table2 className="w-10 h-10 text-amber-600 absolute mx-auto top-5 transform origin-[50%_100%] group-hover:transform-[perspective(800px)_rotateX(-30deg)] transition-transform duration-300" />
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
          onCreateFolderClick={() => openCreateFolderDialog('normal', fileTree)}
          fileTree={fileTree}
          renderTreeItem={renderTreeItem}
          loading={loading}
          onContextMenu={handleSidebarContextMenu}
        />

        {/* Main Content */}
        {(selectedDocument || selectedFolder?.ocrEnabled || (selectedFolder && selectedFolder.id !== 'root')) && (
          <div className="overflow-auto transition-all duration-300 ease-in-out">
            {renderMainContent()}
          </div>
        )}
      </div>

      <DocumentSheet
        isOpen={isDocumentSheetOpen && Boolean(sheetDocument ?? displayedDocumentRef.current)}
        onOpenChange={handleDocumentSheetOpenChange}
        document={sheetDocument ?? displayedDocumentRef.current}
        breadcrumb={documentBreadcrumb}
        previewUrl={previewUrl}
        onDownload={handleDownload}
      />

      {/* Create Folder Dialog */}
      <Dialog
        open={isCreateFolderOpen}
        onOpenChange={(open) => {
          setIsCreateFolderOpen(open);
          if (!open) resetNewFolderForm();
        }}
      >
        <DialogContent className="px-4 py-6 max-w-3xl">
          <DialogHeader className="space-y-1">
            <DialogTitle>
              {createFolderMode === 'ocr' ? 'Nueva carpeta OCR' : 'Nueva carpeta'}
            </DialogTitle>
            <DialogDescription>
              {createFolderMode === 'ocr'
                ? 'Asociá esta carpeta a una tabla OCR y configurá su plantilla.'
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
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Ej. Planos"
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                />
                <p className="text-xs text-muted-foreground">
                  Ruta: Documentos/{createFolderParentPath ? `${createFolderParentPath}/` : ''}{normalizeFolderName(newFolderName) || 'mi-carpeta'}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="ocr-folder-name" className="text-sm font-medium">Nombre de la carpeta OCR</Label>
                <Input
                  id="ocr-folder-name"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Ej. Ordenes de compra"
                />
                <p className="text-xs text-muted-foreground">
                  Ruta: Documentos/{createFolderParentPath ? `${createFolderParentPath}/` : ''}{normalizeFolderName(newFolderName) || 'mi-carpeta'}
                </p>
              </div>
              <div className="rounded-lg border border-purple-200 bg-purple-50/60 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <p className="text-sm font-semibold text-purple-900">Plantilla OCR</p>
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
              <div className="space-y-1 text-xs text-muted-foreground border border-dashed rounded-md px-3 py-2">
                <p>
                  La tabla OCR se creará con el mismo nombre de la carpeta:{" "}
                  <span className="font-semibold text-stone-700">
                    {normalizeFolderName(newFolderName) || 'mi-carpeta'}
                  </span>
                </p>
                <p>Podés ajustar el nombre editando el campo “Nombre de la carpeta OCR”.</p>
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
                {createFolderMode === 'ocr' ? 'Crear carpeta OCR' : 'Crear carpeta'}
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
                      openCreateFolderDialog('ocr', parentFolder);
                      setContextMenu(null);
                    }}
                  >
                    <Table2 className="w-4 h-4" />
                    Crear carpeta OCR
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
                  Ver tabla OCR
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
  const docPath =
    typeof (row as Record<string, unknown>).__docPath === 'string'
      ? (row as Record<string, unknown>).__docPath
      : null;
  const docName =
    typeof (row as Record<string, unknown>).__docFileName === 'string'
      ? (row as Record<string, unknown>).__docFileName
      : docPath?.split('/').pop() ?? 'Documento sin nombre';
  const relativePath =
    docPath && obraId && docPath.startsWith(`${obraId}/`)
      ? docPath.slice(obraId.length + 1)
      : docPath ?? 'Sin ruta';
  const docItem = docPath ? documentsByStoragePath.get(docPath) ?? null : null;
  const storagePath = docItem?.storagePath ?? docPath ?? null;
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
    </HoverCard>
  );
}
