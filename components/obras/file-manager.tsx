'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createSupabaseBrowserClient } from '@/utils/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
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
} from 'lucide-react';
import { toast } from 'sonner';
import ForgeViewer from '@/app/viewer/forgeviewer';
import { EnhancedDocumentViewer } from '@/components/viewer/enhanced-document-viewer';
import FolderFront from '../ui/FolderFront';

// Utility function to check if a file is a 3D model
const is3DModelFile = (fileName: string): boolean => {
  const ext = fileName.toLowerCase().split('.').pop();
  return ['nwc', 'nwd', 'rvt', 'dwg', 'ifc', 'zip'].includes(ext || '');
};

// Type definitions
export type FileSystemItem = {
  id: string;
  name: string;
  type: 'folder' | 'file';
  icon?: string;
  children?: FileSystemItem[];
  ocrEnabled?: boolean;
  extractedData?: any[];
  // For files
  size?: number;
  mimetype?: string;
  dataId?: string;
  storagePath?: string;
  apsUrn?: string; // Autodesk Platform Services URN for 3D models
};

export type MaterialOrder = {
  id: string;
  nroOrden: string;
  solicitante: string;
  gestor: string;
  proveedor: string;
  items: MaterialItem[];
  docUrl?: string;
  docBucket?: string;
  docPath?: string;
  apsUrn?: string; // Autodesk Platform Services URN for 3D models
};

export type MaterialItem = {
  id: string;
  cantidad: number;
  unidad: string;
  material: string;
  precioUnitario: number;
};

type FileManagerProps = {
  obraId: string;
  materialOrders?: MaterialOrder[];
  onRefreshMaterials?: () => void;
};

export function FileManager({ obraId, materialOrders = [], onRefreshMaterials }: FileManagerProps) {
  const supabase = createSupabaseBrowserClient();

  // State
  const [fileTree, setFileTree] = useState<FileSystemItem | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<FileSystemItem | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<FileSystemItem | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['root']));
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [minimizedPanel, setMinimizedPanel] = useState<'data' | 'preview' | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: FileSystemItem } | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<FileSystemItem | null>(null);
  const previewRequestIdRef = useRef(0);

  // Build file tree from storage
  const buildFileTree = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch APS URN mappings for this obra
      const apsResponse = await fetch(`/api/aps/models?obraId=${obraId}`);
      const apsModelsData = await apsResponse.json();
      const apsModels = apsModelsData.data || [];

      // Create a map of file paths to URNs for quick lookup
      const urnMap = new Map<string, string>();
      apsModels.forEach((model: any) => {
        urnMap.set(model.file_path, model.aps_urn);
        console.log('Mapped URN:', model.file_path, '->', model.aps_urn);
      });

      console.log('APS models loaded:', apsModels.length, 'models');
      console.log('URN map entries:', Array.from(urnMap.entries()));

      // List all files in the obra's storage
      const { data: files, error } = await supabase.storage
        .from('obra-documents')
        .list(obraId, {
          limit: 1000,
          sortBy: { column: 'name', order: 'asc' },
        });

      if (error) throw error;

      console.log('Files from storage:', files);

      // Build tree structure
      const root: FileSystemItem = {
        id: 'root',
        name: 'Documentos',
        type: 'folder',
        children: [],
      };

      // Process files and folders
      const folderMap = new Map<string, FileSystemItem>();
      folderMap.set('root', root);

      // First pass: detect and create all folders
      const foldersToLoad: string[] = [];

      for (const item of files || []) {
        // Skip .keep files but NOT items with null id (those are folders!)
        if (item.name === '.keep') continue;

        // In Supabase storage, folders appear as items with id: null OR without metadata
        const isFolder = item.id === null || !item.metadata || (item.metadata && !item.metadata.mimetype);

        console.log('Item:', {
          name: item.name,
          id: item.id,
          metadata: item.metadata,
          isFolder: isFolder
        });

        if (isFolder) {
          const folderName = item.name.replace(/\/$/, ''); // Remove trailing slash if present
          foldersToLoad.push(folderName);

          const folderId = `folder-${folderName}`;
          const folder: FileSystemItem = {
            id: folderId,
            name: folderName,
            type: 'folder',
            children: [],
            ocrEnabled: folderName === 'materiales',
            extractedData: folderName === 'materiales' ? materialOrders : undefined,
          };
          folderMap.set(folderId, folder);
          root.children?.push(folder);
          console.log('Created folder:', folderName, 'ocrEnabled:', folderName === 'materiales');
        }
      }

      console.log('Folders to load:', foldersToLoad);

      // Second pass: load contents of all folders
      for (const folderName of foldersToLoad) {
        const folder = folderMap.get(`folder-${folderName}`);
        if (!folder) continue;

        console.log(`Loading contents of folder: ${folderName}`);

        const { data: folderContents, error: folderError } = await supabase.storage
          .from('obra-documents')
          .list(`${obraId}/${folderName}`, {
            limit: 1000,
            sortBy: { column: 'name', order: 'asc' },
          });

        if (folderError) {
          console.error(`Error loading folder ${folderName}:`, folderError);
          continue;
        }

        console.log(`Contents of ${folderName}:`, folderContents);

        if (folderContents) {
          for (const file of folderContents) {
            if (file.id === null || file.name === '.keep') continue;

            const storagePath = `${obraId}/${folderName}/${file.name}`;
            const apsUrn = urnMap.get(storagePath);

            if (apsUrn) {
              console.log(`File ${file.name} has URN:`, apsUrn);
            }

            const fileItem: FileSystemItem = {
              id: `file-${folderName}-${file.name}`,
              name: file.name,
              type: 'file',
              size: file.metadata?.size,
              mimetype: file.metadata?.mimetype,
              storagePath: storagePath,
              apsUrn: apsUrn,
            };

            // If this is the materiales folder, try to link files to orders
            if (folderName === 'materiales') {
              const matchingOrder = materialOrders.find(order => {
                if (!order.docPath) return false;
                const pathParts = order.docPath.split('/');
                const docFileName = pathParts[pathParts.length - 1];
                return file.name === docFileName;
              });

              if (matchingOrder) {
                fileItem.dataId = matchingOrder.id;
                console.log('Linked file:', file.name, 'to order:', matchingOrder.id);
              }
            }

            folder.children?.push(fileItem);
          }

          console.log(`Loaded ${folder.children?.length || 0} files into ${folderName}`);
        }
      }

      // Ensure materiales folder exists if it wasn't found
      const materialesFolderRef = Array.from(folderMap.values()).find(f => f.name === 'materiales');

      if (!materialesFolderRef && materialOrders.length > 0) {
        console.log('Materiales folder not found, creating it...');
        // Create folder in storage
        try {
          const folderPath = `${obraId}/materiales/.keep`;
          await supabase.storage
            .from('obra-documents')
            .upload(folderPath, new Blob([''], { type: 'text/plain' }), { upsert: false });

          // Add to tree
          const newMaterialesFolder: FileSystemItem = {
            id: 'folder-materiales',
            name: 'materiales',
            type: 'folder',
            children: [],
            ocrEnabled: true,
            extractedData: materialOrders,
          };
          folderMap.set('folder-materiales', newMaterialesFolder);
          root.children?.push(newMaterialesFolder);
          console.log('Materiales folder created and added to tree');
        } catch (createError: any) {
          console.log('Could not create materiales folder:', createError);
        }
      }

      // List files in root
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

      console.log('Final file tree:', root);
      console.log('Total folders:', root.children?.filter(c => c.type === 'folder').length);
      console.log('Total files in root:', root.children?.filter(c => c.type === 'file').length);
      console.log('Root children:', root.children?.map(c => ({
        name: c.name,
        type: c.type,
        childCount: c.children?.length || 0,
        ocrEnabled: c.ocrEnabled
      })));

      // Log materiales folder details
      const materialesFolder = root.children?.find(c => c.name === 'materiales');
      if (materialesFolder) {
        console.log('Materiales folder:', {
          name: materialesFolder.name,
          childCount: materialesFolder.children?.length,
          files: materialesFolder.children?.map(f => ({ name: f.name, dataId: f.dataId })),
          extractedDataCount: materialesFolder.extractedData?.length
        });
      }

      console.log('Material orders passed to FileManager:', materialOrders.length);
      console.log('Material orders with docPath:', materialOrders.filter(o => o.docPath).map(o => ({
        id: o.id,
        nroOrden: o.nroOrden,
        docPath: o.docPath
      })));

      setFileTree(root);
      if (!selectedFolder) {
        setSelectedFolder(root);
      }

      // Auto-expand root and all folders that have content
      const foldersToExpand = ['root'];
      const foldersWithContent = root.children
        ?.filter(c => c.type === 'folder' && c.children && c.children.length > 0)
        .map(c => c.id) || [];

      foldersToExpand.push(...foldersWithContent);

      setExpandedFolders(new Set(foldersToExpand));
      console.log('Auto-expanded folders:', foldersToExpand);
    } catch (error) {
      console.error('Error building file tree:', error);
      toast.error('Error loading documents');
    } finally {
      setLoading(false);
    }
  }, [obraId, materialOrders, supabase]);

  useEffect(() => {
    buildFileTree();
  }, [buildFileTree]);

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [contextMenu]);

  // Toggle folder expansion
  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  // Handle folder click
  const handleFolderClick = (folder: FileSystemItem) => {
    setSelectedFolder(folder);
    setSelectedDocument(null);
    setPreviewUrl(null);
    setMinimizedPanel(null); // Reset panel minimization when switching folders
  };

  // Handle document click
  const handleDocumentClick = async (document: FileSystemItem, parentFolder?: FileSystemItem) => {
    console.log('handleDocumentClick called with:', document, 'parent:', parentFolder);
    console.log('Document has apsUrn:', document.apsUrn);
    console.log('Is 3D model file:', is3DModelFile(document.name));

    setSelectedDocument(document);
    const requestId = ++previewRequestIdRef.current;

    // If a parent folder is provided, also update the selected folder
    if (parentFolder) {
      setSelectedFolder(parentFolder);
    }

    // If this is a 3D model with URN, we don't need the storage preview URL
    if (document.apsUrn) {
      console.log('Using Autodesk Viewer for 3D model with URN:', document.apsUrn);
      setPreviewUrl(null); // Clear preview URL, we'll use ForgeViewer instead
      return;
    }

    // Generate preview URL for non-3D files
    if (document.storagePath) {
      console.log('Generating signed URL for:', document.storagePath);

      // Clear previous preview and track this fetch to avoid race conditions when switching files quickly
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
        console.log('Signed URL created:', data.signedUrl);
        setPreviewUrl(data.signedUrl);
      }
    } else {
      console.warn('No storagePath for document:', document);
    }
  };

  // Handle file download
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

  // Create folder
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;

    try {
      const folderPath = `${obraId}/${newFolderName}/.keep`;

      const { error } = await supabase.storage
        .from('obra-documents')
        .upload(folderPath, new Blob([''], { type: 'text/plain' }));

      if (error) throw error;

      toast.success('Folder created successfully');
      setIsCreateFolderOpen(false);
      setNewFolderName('');
      buildFileTree();
    } catch (error) {
      console.error('Error creating folder:', error);
      toast.error('Error creating folder');
    }
  };

  // Upload files
  const handleUploadFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingFiles(true);
    try {
      const folderPath = selectedFolder?.id === 'root'
        ? obraId
        : `${obraId}/${selectedFolder?.name}`;

      const isOcrFolder = Boolean(selectedFolder?.ocrEnabled);
      let importedAnyMaterials = false;

      for (const file of Array.from(files)) {
        const filePath = `${folderPath}/${file.name}`;

        // Upload to Supabase storage
        const { error } = await supabase.storage
          .from('obra-documents')
          .upload(filePath, file);

        if (error) throw error;

        // If it's a 3D model file, also upload to Autodesk APS
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
              console.error('APS upload failed:', apsData.error);
              toast.error(`3D model uploaded to storage, but APS processing failed: ${apsData.error}`);
            } else {
              console.log('APS upload successful, URN:', apsData.urn);

              // Store URN in database
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

        // If this is the OCR-enabled "materiales" folder, run OCR import for PDFs/images
        if (isOcrFolder) {
          try {
            const fd = new FormData();

            if (file.type.includes('pdf')) {
              try {
                // @ts-ignore: dynamic import without types is fine for client rasterization
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
                console.error('PDF rasterization failed (FileManager upload)', pdfErr);
                // Fallback: send raw file, server may still handle or return a helpful error
                fd.append('file', file);
              }
            } else if (file.type.startsWith('image/')) {
              fd.append('file', file);
            } else {
              // Non-image / non-PDF files are just stored, no OCR attempted
              continue;
            }

            const importRes = await fetch(`/api/obras/${obraId}/materials/import?preview=1`, {
              method: 'POST',
              body: fd,
            });

            if (!importRes.ok) {
              const out = await importRes.json().catch(() => ({} as any));
              console.error('Materials import failed for uploaded file', out);
              toast.error('El archivo se subió pero no se pudo extraer la orden de materiales');
              continue;
            }

            const out = await importRes.json();
            const extractedItems = (out.items || []) as Array<any>;
            const meta = out.meta || {};

            // Normalize items as in the excel materiales flow
            const normalizedItems = extractedItems
              .filter((it) => (String(it.material ?? '').trim().length > 0) && Number(it.cantidad) > 0)
              .map((it) => ({
                cantidad: Number(it.cantidad) || 0,
                unidad: String(it.unidad || '').trim(),
                material: String(it.material || '').trim(),
                precioUnitario: Number(it.precioUnitario) || 0,
              }));

            if (normalizedItems.length === 0) {
              console.log('No valid material items extracted from file', file.name);
              continue;
            }

            const saveRes = await fetch(`/api/obras/${obraId}/materials`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                nroOrden: String(meta.nroOrden ?? '').trim() || undefined,
                solicitante: String(meta.solicitante ?? '').trim() || undefined,
                gestor: String(meta.gestor ?? '').trim() || undefined,
                proveedor: String(meta.proveedor ?? '').trim() || undefined,
                items: normalizedItems,
                docBucket: 'obra-documents',
                docPath: filePath,
              }),
            });

            if (!saveRes.ok) {
              const errOut = await saveRes.json().catch(() => ({} as any));
              console.error('Failed to persist materials from uploaded file', errOut);
              toast.error('El archivo se subió pero no se pudo guardar la orden de materiales');
              continue;
            }

            importedAnyMaterials = true;
          } catch (ocrError) {
            console.error('Error extracting materials from uploaded file', ocrError);
            toast.error('El archivo se subió pero no se pudo extraer la orden de materiales');
          }
        }
      }

      toast.success(`${files.length} file(s) uploaded successfully`);

      // If we created / updated material orders, refresh them so the extracted data panel updates
      if (importedAnyMaterials && onRefreshMaterials) {
        try {
          await onRefreshMaterials();
        } catch (refreshErr) {
          console.error('Error refreshing material orders after OCR import', refreshErr);
        }
      }

      buildFileTree();
    } catch (error) {
      console.error('Error uploading files:', error);
      toast.error('Error uploading files');
    } finally {
      setUploadingFiles(false);
    }
  };

  // Delete file or folder
  const handleDelete = async (item: FileSystemItem) => {
    try {
      if (item.type === 'file') {
        // Delete single file
        if (item.storagePath) {
          const { error } = await supabase.storage
            .from('obra-documents')
            .remove([item.storagePath]);

          if (error) throw error;
          toast.success('File deleted successfully');
        }
      } else {
        // Delete folder and all its contents
        const folderPath = item.id === 'root' ? obraId : `${obraId}/${item.name}`;

        // List all files in the folder
        const { data: files, error: listError } = await supabase.storage
          .from('obra-documents')
          .list(folderPath, {
            limit: 1000,
          });

        if (listError) throw listError;

        // Delete all files
        if (files && files.length > 0) {
          const filePaths = files.map(file => `${folderPath}/${file.name}`);
          const { error: deleteError } = await supabase.storage
            .from('obra-documents')
            .remove(filePaths);

          if (deleteError) throw deleteError;
        }

        toast.success('Folder and contents deleted successfully');
      }

      // Clear selection if deleted item was selected
      if (selectedFolder?.id === item.id) {
        setSelectedFolder(fileTree);
        setSelectedDocument(null);
        setPreviewUrl(null);
      }
      if (selectedDocument?.id === item.id) {
        setSelectedDocument(null);
        setPreviewUrl(null);
      }

      buildFileTree();
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('Error deleting item');
    }
  };

  // Open delete confirmation dialog
  const confirmDelete = (item: FileSystemItem) => {
    setItemToDelete(item);
    setIsDeleteDialogOpen(true);
    setContextMenu(null);
  };

  // Get file icon for tree view
  const getTreeFileIcon = (mimetype?: string) => {
    if (!mimetype) return <File className="w-4 h-4 text-muted-foreground" />;
    if (mimetype.startsWith('image/')) return <ImageIcon className="w-4 h-4 text-muted-foreground" />;
    if (mimetype === 'application/pdf') return <FileText className="w-4 h-4 text-muted-foreground" />;
    return <File className="w-4 h-4 text-muted-foreground" />;
  };

  // Render tree item recursively (folders and files)
  const renderTreeItem = (item: FileSystemItem, level: number = 0, parentFolder?: FileSystemItem) => {
    const isExpanded = expandedFolders.has(item.id);
    const isFolder = item.type === 'folder';
    const isFolderSelected = selectedFolder?.id === item.id;
    const isDocumentSelected = selectedDocument?.id === item.id;
    const hasChildren = item.children && item.children.length > 0;

    const handleItemClick = () => {
      if (isFolder) {
        handleFolderClick(item);
      } else {
        // It's a file - preview it and set its parent folder as selected
        handleDocumentClick(item, parentFolder);
      }
    };

    return (
      <div key={item.id}>
        <button
          onClick={handleItemClick}
          onContextMenu={(e) => {
            e.preventDefault();
            // Don't allow deleting root folder
            if (item.id !== 'root') {
              setContextMenu({
                x: e.clientX,
                y: e.clientY,
                item: item,
              });
            }
          }}
          className={`
            w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm
            hover:bg-accent transition-colors
            ${isFolderSelected && isFolder ? 'bg-blue-100 dark:bg-blue-950' : ''}
            ${isDocumentSelected && !isFolder ? 'border-2 border-orange-primary rounded-md' : ''}
          `}
          style={{ paddingLeft: `${level * 12 + 8}px` }}
        >
          {/* Expand/collapse chevron for folders with children */}
          {isFolder && hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleFolder(item.id);
              }}
              className="p-0.5 hover:bg-accent rounded"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
          ) : (
            <div className="w-5" />
          )}

          {/* Icon */}
          {isFolder ? (
            item.ocrEnabled ? (
              <BarChart3 className="w-4 h-4 text-purple-500" />
            ) : (
              <Folder className="w-4 h-4 text-blue-500" />
            )
          ) : (
            getTreeFileIcon(item.mimetype)
          )}

          <span className="flex-1 text-left truncate">{item.name}</span>

          {/* Badge for OCR folders */}
          {isFolder && item.ocrEnabled && item.extractedData && (
            <Badge variant="secondary" className="text-xs">
              {item.extractedData.length}
            </Badge>
          )}

          {/* Size for files */}
          {!isFolder && item.size && (
            <span className="text-xs text-muted-foreground">
              {(item.size / 1024).toFixed(0)} KB
            </span>
          )}
        </button>

        {/* Render children if expanded */}
        {isFolder && isExpanded && item.children && (
          <div>
            {item.children.map(child => renderTreeItem(child, level + 1, item))}
          </div>
        )}
      </div>
    );
  };

  // Toggle order expansion
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

  // Render extracted data table
  const renderExtractedDataTable = () => {
    if (!selectedFolder?.extractedData || selectedFolder.extractedData.length === 0) {
      return (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          No data extracted yet
        </div>
      );
    }

    const data = selectedFolder.extractedData as MaterialOrder[];

    return (
      <div className="overflow-auto h-full p-4 space-y-3">
        {data.map((order) => {
          const total = order.items.reduce(
            (sum, item) => sum + item.cantidad * item.precioUnitario,
            0
          );
          const isExpanded = expandedOrders.has(order.id);
          const isSelected = selectedDocument?.dataId === order.id;

          return (
            <div key={order.id} className="border rounded-lg overflow-hidden">
              {/* Order Header */}
              <button
                onClick={() => toggleOrderExpanded(order.id)}
                className={`
                  w-full text-left bg-muted/40 px-4 py-3 flex items-center justify-between hover:bg-muted/60 transition-colors
                  ${isSelected ? 'bg-green-100 dark:bg-green-950 border-2 border-orange-primary rounded-md' : ''}
                `}
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 flex-shrink-0" />
                  )}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                    <div className="font-semibold">N° {order.nroOrden}</div>
                    <div className="text-sm text-muted-foreground">Proveedor: {order.proveedor}</div>
                    <div className="text-sm text-muted-foreground">Solicitante: {order.solicitante}</div>
                  </div>
                </div>
                <div className="text-sm font-semibold font-mono">
                  $ {total.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </button>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="p-4 space-y-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="text-sm text-muted-foreground">
                      {order.items.length} ítems en la orden
                    </div>
                    <button
                      type="button"
                      className="text-xs underline text-primary whitespace-nowrap"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Find the document associated with this order
                        const doc = selectedFolder.children?.find(
                          child => child.dataId === order.id
                        );
                        console.log('Looking for doc with dataId:', order.id);
                        console.log('Available children:', selectedFolder.children);
                        console.log('Found doc:', doc);
                        if (doc) {
                          handleDocumentClick(doc, selectedFolder);
                        } else {
                          toast.error('Document not found for this order');
                        }
                      }}
                    >
                      Ver documento
                    </button>
                  </div>

                  {/* Items Table */}
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left font-medium py-3 px-4 border-b">Cantidad</th>
                          <th className="text-left font-medium py-3 px-4 border-b">Unidad</th>
                          <th className="text-left font-medium py-3 px-4 border-b">Material</th>
                          <th className="text-right font-medium py-3 px-4 border-b">Precio unitario</th>
                          <th className="text-right font-medium py-3 px-4 border-b">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {order.items.map((item, idx) => (
                          <tr
                            key={item.id || idx}
                            className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                          >
                            <td className="py-3 px-4">{item.cantidad.toLocaleString('es-AR')}</td>
                            <td className="py-3 px-4">{item.unidad}</td>
                            <td className="py-3 px-4">{item.material}</td>
                            <td className="py-3 px-4 text-right font-mono">
                              $ {item.precioUnitario.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="py-3 px-4 text-right font-mono">
                              $ {(item.precioUnitario * item.cantidad).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Order Total */}
                  <div className="flex justify-end items-center p-4 rounded-lg bg-muted/40 border">
                    <span className="mr-3 text-sm text-muted-foreground">Total de la orden</span>
                    <span className="text-lg font-bold font-mono">
                      $ {total.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // Render document preview
  const renderDocumentPreview = () => {
    if (!selectedDocument) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
          <Eye className="w-16 h-16 mb-4 opacity-20" />
          <p>Select a document to preview</p>
        </div>
      );
    }

    const isImage = selectedDocument.mimetype?.startsWith('image/');
    const isPdf = selectedDocument.mimetype === 'application/pdf';
    const has3DModel = !!selectedDocument.apsUrn;

    console.log('renderDocumentPreview:', {
      fileName: selectedDocument.name,
      hasUrn: has3DModel,
      urn: selectedDocument.apsUrn,
      isImage,
      isPdf,
      hasPreviewUrl: !!previewUrl
    });

    return (
      <div className="h-full flex flex-col">
        {/* Only show header for non-enhanced preview types */}
        {!(previewUrl && (isImage || isPdf)) && (
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="font-medium truncate">{selectedDocument.name}</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDownload(selectedDocument)}
            >
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
          </div>
        )}

        <div className="flex-1 overflow-hidden">
          {has3DModel && selectedDocument.apsUrn ? (
            <div className="h-full">
              <ForgeViewer urn={selectedDocument.apsUrn} />
            </div>
          ) : previewUrl && (isImage || isPdf) ? (
            <EnhancedDocumentViewer
              url={previewUrl}
              fileName={selectedDocument.name}
              fileType={isPdf ? 'pdf' : 'image'}
              onDownload={() => handleDownload(selectedDocument)}
            />
          ) : previewUrl ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
              <FileText className="w-16 h-16 mb-4 opacity-20" />
              <p>Preview not available for this file type</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDownload(selectedDocument)}
                className="mt-4"
              >
                <Download className="w-4 h-4 mr-2" />
                Download to view
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    );
  };

  // Get file icon
  const getFileIcon = (mimetype?: string) => {
    if (!mimetype) return <File className="w-8 h-8" />;
    if (mimetype.startsWith('image/')) return <ImageIcon className="w-8 h-8" />;
    if (mimetype === 'application/pdf') return <FileText className="w-8 h-8" />;
    if (mimetype.includes('zip') || mimetype.includes('rar')) return <FileArchive className="w-8 h-8" />;
    return <File className="w-8 h-8" />;
  };

  // Render main content
  const renderMainContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (!selectedFolder) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
          <Folder className="w-16 h-16 mb-4 opacity-20" />
          <p>Select a folder to view its contents</p>
        </div>
      );
    }

    // If a document is selected in a non-OCR folder, show just the preview
    if (selectedDocument && !selectedFolder.ocrEnabled) {
      return (
        <div className="rounded-lg border bg-card shadow-sm overflow-hidden h-full min-h-[320px]">
          {renderDocumentPreview()}
        </div>
      );
    }

    // OCR folder - split view
    if (selectedFolder.ocrEnabled) {
      const dataMinimized = minimizedPanel === 'data';
      const previewMinimized = minimizedPanel === 'preview';

      return (
        <div className="h-full flex flex-col gap-4 lg:flex-row">
          {/* Extracted Data Panel */}
          <div
            className={`rounded-lg border bg-card shadow-sm overflow-hidden transition-all duration-300 ease-in-out ${dataMinimized
              ? 'flex items-center justify-center h-12 w-full lg:w-12 lg:h-auto flex-shrink-0'
              : 'flex-1 min-h-[260px]'
              }`}
          >
            {dataMinimized ? (
              <div className="animate-in fade-in duration-150">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMinimizedPanel(null)}
                  className="h-full w-full p-0"
                  title="Expand Extracted Data"
                >
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </div>
            ) : (
              <div className="h-full flex flex-col w-full animate-in fade-in duration-150">
                <div className="p-4 border-b flex items-center justify-between">
                  <h3 className="font-medium">Extracted Data</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setMinimizedPanel('data')}
                    title="Minimize Extracted Data"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex-1 overflow-hidden">
                  {renderExtractedDataTable()}
                </div>
              </div>
            )}
          </div>

          {/* Document Preview Panel */}
          <div
            className={`rounded-lg border bg-card shadow-sm overflow-hidden transition-all duration-300 ease-in-out ${previewMinimized
              ? 'flex items-center justify-center h-12 w-full lg:w-12 lg:h-auto flex-shrink-0'
              : 'flex-1 min-h-[260px]'
              }`}
          >
            {previewMinimized ? (
              <div className="animate-in fade-in duration-150">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMinimizedPanel(null)}
                  className="h-full w-full p-0"
                  title="Expand Document Preview"
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>
              </div>
            ) : (
              <div className="h-full flex flex-col w-full animate-in fade-in duration-150">
                <div className="p-4 border-b flex items-center justify-between">
                  <h3 className="font-medium truncate flex-1">{selectedDocument?.name || 'Document Preview'}</h3>
                  <div className="flex items-center gap-2">
                    {selectedDocument && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(selectedDocument)}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setMinimizedPanel('preview')}
                      title="Minimize Document Preview"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex-1 overflow-hidden">
                  {!selectedDocument ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                      <Eye className="w-16 h-16 mb-4 opacity-20" />
                      <p>Select a document to preview</p>
                    </div>
                  ) : selectedDocument.apsUrn ? (
                    <div className="h-full">
                      <ForgeViewer urn={selectedDocument.apsUrn} />
                    </div>
                  ) : previewUrl && (selectedDocument.mimetype?.startsWith('image/') || selectedDocument.mimetype === 'application/pdf') ? (
                    <EnhancedDocumentViewer
                      url={previewUrl}
                      fileName={selectedDocument.name}
                      fileType={selectedDocument.mimetype === 'application/pdf' ? 'pdf' : 'image'}
                      onDownload={() => handleDownload(selectedDocument)}
                    />
                  ) : previewUrl ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
                      <FileText className="w-16 h-16 mb-4 opacity-20" />
                      <p>Preview not available for this file type</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(selectedDocument)}
                        className="mt-4"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download to view
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    // Regular folder - grid/list view
    const items = selectedFolder.children || [];
    const folders = items.filter(item => item.type === 'folder');
    const files = items.filter(item => item.type === 'file');
    const sortedItems = [...folders, ...files];

    if (sortedItems.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
          <Folder className="w-16 h-16 mb-4 opacity-20" />
          <p>This folder is empty</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => document.getElementById('file-upload')?.click()}
            className="mt-4"
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload files
          </Button>
        </div>
      );
    }


    if (viewMode === 'grid') {
      return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {sortedItems.map(item => (
            <div key={item.id} className="group cursor-default transition-colors flex flex-col items-center gap-2">
              <div
                className="flex flex-col items-start gap-2 p-3 w-[105px] h-[75px] rounded-lg hover:bg-muted transition-colors bg-gradient-to-b from-[#4F4F4F] to-[#3D3D3D] relative"
                onClick={() => {
                  if (item.type === 'folder') {
                    handleFolderClick(item);
                  } else {
                    handleDocumentClick(item, selectedFolder);
                  }
                }}
              >
                {item.type === 'folder' ? (<FolderFront className="w-[110px] h-[80px] absolute -bottom-1 -left-1 transform origin-[50%_100%] group-hover:[transform:perspective(800px)_rotateX(-30deg)] transition-transform duration-300" />) : null}
                <div className="pt-15 flex flex-col items-center justify-center w-full">
                  {item.type === 'folder' ? (
                    item.ocrEnabled ? (
                      <BarChart3 className="w-10 h-10 text-white absolute mx-auto top-5 transform origin-[50%_100%] group-hover:[transform:perspective(800px)_rotateX(-30deg)] transition-transform duration-300" />
                    ) : (
                      <Folder className="w-10 h-10 text-white absolute mx-auto top-5 transform origin-[50%_100%] group-hover:[transform:perspective(800px)_rotateX(-30deg)] transition-transform duration-300" />
                    )
                  ) : (
                    getFileIcon(item.mimetype)
                  )}
                  <span className="text-sm text-center truncate w-full" title={item.name}>
                    {item.name}
                  </span>
                  {item.type === 'file' && item.size && (
                    <span className="text-xs text-muted-foreground">
                      {(item.size / 1024).toFixed(1)} KB
                    </span>
                  )}
                </div>

              </div>
            </div>
          ))}
        </div>
      );
    }

    // List view
    return (
      <div className="space-y-1">
        {sortedItems.map(item => (
          <div
            key={item.id}
            className="rounded-lg border bg-card shadow-sm cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => {
              if (item.type === 'folder') {
                handleFolderClick(item);
              } else {
                handleDocumentClick(item, selectedFolder);
              }
            }}
          >
            <div className="p-3 flex items-center gap-3">
              {item.type === 'folder' ? (
                item.ocrEnabled ? (
                  <BarChart3 className="w-5 h-5 text-purple-500 flex-shrink-0" />
                ) : (
                  <Folder className="w-5 h-5 text-blue-500 flex-shrink-0" />
                )
              ) : (
                <div className="flex-shrink-0">
                  {getFileIcon(item.mimetype)}
                </div>
              )}
              <span className="flex-1 truncate">{item.name}</span>
              {item.type === 'file' && item.size && (
                <span className="text-sm text-muted-foreground">
                  {(item.size / 1024).toFixed(1)} KB
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-[calc(100vh-9rem)] flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="w-full md:flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search files and folders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto md:justify-end">
          {!selectedFolder?.ocrEnabled && (
            <div className="flex items-center gap-1 border rounded-md">
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

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsCreateFolderOpen(true)}
          >
            <FolderPlus className="w-4 h-4 mr-2" />
            New Folder
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={() => document.getElementById('file-upload')?.click()}
            disabled={uploadingFiles}
          >
            {uploadingFiles ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Upload className="w-4 h-4 mr-2" />
            )}
            Upload
          </Button>

          <input
            id="file-upload"
            type="file"
            multiple
            className="hidden"
            onChange={handleUploadFiles}
          />
        </div>
      </div>

      {/* Main Layout */}
      <div className={`flex-1 min-h-0 transition-all duration-300 ease-in-out ${!selectedDocument && (!selectedFolder || selectedFolder.id === 'root')
        ? ''
        : 'grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4'
        }`}>
        {/* Tree View - Always rendered, animates width */}
        <div className={`rounded-lg border bg-card shadow-sm overflow-auto transition-all duration-300 ease-in-out ${!selectedDocument && (!selectedFolder || selectedFolder.id === 'root')
          ? 'h-full w-full'
          : 'max-h-[320px] lg:max-h-none'
          }`}>
          <div className="p-4">
            <h2 className="text-sm font-semibold mb-2 text-muted-foreground uppercase">
              Folders
            </h2>
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading...</div>
            ) : !fileTree ? (
              <div className="text-sm text-muted-foreground">No file tree</div>
            ) : (
              <>
                <div className="text-xs text-muted-foreground mb-2">
                  {(() => {
                    const folders = fileTree.children?.filter(c => c.type === 'folder').length || 0;
                    const files = fileTree.children?.filter(c => c.type === 'file').length || 0;
                    return `(${folders} folders, ${files} files)`;
                  })()}
                </div>
                <div className="space-y-1">
                  {renderTreeItem(fileTree)}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Main Content - Only shown when something is selected */}
        {(selectedDocument || (selectedFolder && selectedFolder.id !== 'root')) && (
          <div className="overflow-auto transition-all duration-300 ease-in-out animate-in fade-in duration-200">
            {renderMainContent()}
          </div>
        )}
      </div>

      {/* Create Folder Dialog */}
      <Dialog open={isCreateFolderOpen} onOpenChange={setIsCreateFolderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="folder-name" className="text-sm font-medium">Folder Name</label>
              <Input
                id="folder-name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Enter folder name"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateFolder();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateFolderOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateFolder} disabled={!newFolderName.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete{' '}
              <span className="font-semibold text-foreground">{itemToDelete?.name}</span>?
              {itemToDelete?.type === 'folder' && (
                <span className="block mt-2 text-destructive">
                  This will delete the folder and all its contents.
                </span>
              )}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
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
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-popover border rounded-md shadow-md py-1 min-w-[160px]"
          style={{
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full px-3 py-2 text-sm text-left hover:bg-accent flex items-center gap-2 text-destructive"
            onClick={() => confirmDelete(contextMenu.item)}
          >
            <Trash2 className="w-4 h-4" />
            Delete {contextMenu.item.type === 'folder' ? 'Folder' : 'File'}
          </button>
        </div>
      )}
    </div>
  );
}
