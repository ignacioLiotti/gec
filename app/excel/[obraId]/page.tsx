'use client';

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useForm } from "@tanstack/react-form";
import { obraSchema, type Obra } from "../schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useParams } from "next/navigation";
import {
	ArrowLeft,
	Building2,
	Calendar,
	DollarSign,
	FileText,
	Mail,
	MapPin,
	Percent,
	Plus,
	Receipt,
	TrendingUp,
	Folder,
	FolderPlus,
	Upload,
	Image as ImageIcon,
	File as FileIcon,
	Download,
	Trash2,
	Pencil,
	Eye
} from "lucide-react";
import { motion } from "framer-motion";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import { FileManager } from "@/components/obras/file-manager";
import { ExcelPageTabs } from "@/components/excel-page-tabs";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

type Certificate = {
	id: string;
	obra_id: string;
	n_exp: string;
	n_certificado: number;
	monto: number;
	mes: string;
	estado: string;
};

type NewCertificateFormState = {
	n_exp: string;
	n_certificado: string;
	monto: string;
	mes: string;
	estado: string;
};

const certificateFormDefault: NewCertificateFormState = {
	n_exp: "",
	n_certificado: "",
	monto: "",
	mes: "",
	estado: "CERTIFICADO",
};

const emptyObra: Obra = {
	id: "",
	n: 1,
	designacionYUbicacion: "",
	supDeObraM2: 0,
	entidadContratante: "",
	mesBasicoDeContrato: "",
	iniciacion: "",
	contratoMasAmpliaciones: 0,
	certificadoALaFecha: 0,
	saldoACertificar: 0,
	segunContrato: 0,
	prorrogasAcordadas: 0,
	plazoTotal: 0,
	plazoTransc: 0,
	porcentaje: 0,
	onFinishFirstMessage: null,
	onFinishSecondMessage: null,
	onFinishSecondSendAt: null,
};

const toLocalDateTimeValue = (value: string | null) => {
	if (!value) return null;
	const hasTimezone = /(?:[Zz]|[+-]\d{2}:\d{2})$/.test(value);
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return null;
	if (!hasTimezone) {
		return value.slice(0, 16);
	}
	const offset = date.getTimezoneOffset();
	const local = new Date(date.getTime() - offset * 60_000);
	return local.toISOString().slice(0, 16);
};

const toIsoDateTime = (value: string | null) => {
	if (!value) return null;
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return null;
	return date.toISOString();
};

export default function ObraDetailPage() {
	const params = useParams();
	const obraId = useMemo(() => {
		const raw = (params as Record<string, string | string[] | undefined>)?.obraId;
		if (Array.isArray(raw)) return raw[0];
		return raw;
	}, [params]);
	const [routeError, setRouteError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [certificates, setCertificates] = useState<Certificate[]>([]);
	const [certificatesTotal, setCertificatesTotal] = useState(0);
	const [certificatesLoading, setCertificatesLoading] = useState(true);
	const [isAddingCertificate, setIsAddingCertificate] = useState(false);
	const [newCertificate, setNewCertificate] = useState<NewCertificateFormState>(
		() => ({ ...certificateFormDefault })
	);
	const [createCertificateError, setCreateCertificateError] = useState<string | null>(null);
	const [isCreatingCertificate, setIsCreatingCertificate] = useState(false);
	const mountedRef = useRef(true);
	const [currentUserId, setCurrentUserId] = useState<string | null>(null);
	const [isGeneralTabEditMode, setIsGeneralTabEditMode] = useState(false);

	type PendingDoc = { id: string; name: string; poliza: string; dueMode: "fixed" | "after_completion"; dueDate: string; offsetDays: number; done: boolean };
	const [pendingDocs, setPendingDocs] = useState<PendingDoc[]>([
		{ id: "doc-1", name: "", poliza: "", dueMode: "fixed", dueDate: "", offsetDays: 0, done: false },
		{ id: "doc-2", name: "", poliza: "", dueMode: "fixed", dueDate: "", offsetDays: 0, done: false },
		{ id: "doc-3", name: "", poliza: "", dueMode: "fixed", dueDate: "", offsetDays: 0, done: false },
	]);

	type ObraRole = { id: string; key: string; name: string | null };
	type ObraUser = { id: string; full_name: string | null };
	type ObraUserRole = { user_id: string; role_id: string };

	const [obraRoles, setObraRoles] = useState<ObraRole[]>([]);
	const [obraUsers, setObraUsers] = useState<ObraUser[]>([]);
	const [obraUserRoles, setObraUserRoles] = useState<ObraUserRole[]>([]);
	const [selectedRecipientUserId, setSelectedRecipientUserId] = useState<string>("");
	const [selectedRecipientRoleId, setSelectedRecipientRoleId] = useState<string>("");

	// Flujo Actions state
	type FlujoAction = {
		id: string;
		action_type: 'email' | 'calendar_event';
		timing_mode: 'immediate' | 'offset' | 'scheduled';
		offset_value: number | null;
		offset_unit: 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | null;
		scheduled_date: string | null;
		title: string;
		message: string | null;
		recipient_user_ids: string[];
		notification_types: ('in_app' | 'email')[];
		enabled: boolean;
	};
	const [flujoActions, setFlujoActions] = useState<FlujoAction[]>([]);
	const [isLoadingFlujoActions, setIsLoadingFlujoActions] = useState(false);
	const [isAddingFlujoAction, setIsAddingFlujoAction] = useState(false);
	const [newFlujoAction, setNewFlujoAction] = useState<Partial<FlujoAction>>({
		action_type: 'email',
		timing_mode: 'immediate',
		offset_value: 1,
		offset_unit: 'days',
		title: '',
		message: '',
		recipient_user_ids: [],
		notification_types: ["in_app"],
		enabled: true,
	});

	// Materiales state
	type MaterialItem = {
		id: string;
		cantidad: number;
		unidad: string;
		material: string;
		precioUnitario: number;
	};

	type MaterialOrder = {
		id: string;
		nroOrden: string;
		solicitante: string;
		gestor: string;
		proveedor: string;
		items: MaterialItem[];
		docUrl?: string; // signed URL to view uploaded document (optional)
		docPath?: string; // storage path to document
		docBucket?: string; // storage bucket name
	};

	// Start with no material orders; they are loaded from `/api/obras/:obraId/materials`
	const [materialOrders, setMaterialOrders] = useState<MaterialOrder[]>([]);

	const [globalMaterialsFilter, setGlobalMaterialsFilter] = useState("");
	const [expandedOrders, setExpandedOrders] = useState<Set<string>>(() => new Set());
	const [orderFilters, setOrderFilters] = useState<Record<string, string>>(() => ({}));
	const [orderDocPaths, setOrderDocPaths] = useState<Record<string, { segments: string[]; name: string; mime?: string }>>(() => ({}));
	const [pendingOpenDoc, setPendingOpenDoc] = useState<{ segments: string[]; name: string; mime?: string } | null>(null);
	const router = useRouter();
	const searchParams = useSearchParams();
	const pathname = usePathname();

	// Derive activeTab from URL params
	const activeTab = searchParams?.get?.("tab") || "general";

	const setQueryParams = useCallback((patch: Record<string, string | null | undefined>) => {
		const params = new URLSearchParams(searchParams?.toString?.() || "");
		for (const [key, value] of Object.entries(patch)) {
			if (value == null || value === "") params.delete(key); else params.set(key, value);
		}
		const qs = params.toString();
		router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
	}, [router, pathname, searchParams]);

	console.log('orderDocPaths', orderDocPaths);

	// Import OC from PDF
	const importInputRef = useRef<HTMLInputElement | null>(null);
	const [isImportingMaterials, setIsImportingMaterials] = useState(false);
	const [isImportPreviewOpen, setIsImportPreviewOpen] = useState(false);
	const [importPreviewOrder, setImportPreviewOrder] = useState<NewOrderForm | null>(null);
	const lastUploadedDocRef = useRef<{ segments: string[]; name: string; mime?: string } | null>(null);

	const triggerImportMaterials = useCallback(() => {
		importInputRef.current?.click();
	}, []);

	const handleImportMaterials = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		if (!obraId || obraId === "undefined") {
			toast.error("Obra no encontrada");
			return;
		}
		try {
			setIsImportingMaterials(true);
			// Upload original file to Supabase Storage under <obraId>/materiales/
			try {
				const supabase = createSupabaseBrowserClient();
				const basePath = String(obraId);
				// Check if 'materiales' folder exists under obra root
				const { data: rootList } = await supabase.storage
					.from(DOCUMENTS_BUCKET)
					.list(basePath, { limit: 1000, sortBy: { column: 'name', order: 'asc' } });
				const hasMateriales = Boolean((rootList || []).find((it: any) => it.name === 'materiales' && !it.metadata));
				if (!hasMateriales) {
					const keepKey = `${basePath}/materiales/.keep`;
					await supabase.storage
						.from(DOCUMENTS_BUCKET)
						.upload(keepKey, new Blob([""], { type: 'text/plain' }), { upsert: true });
				}
				// Upload the file with a timestamped name to avoid collisions
				const safeName = `${Date.now()}-${file.name}`;
				const uploadKey = `${basePath}/materiales/${safeName}`;
				const { error: upErr } = await supabase.storage
					.from(DOCUMENTS_BUCKET)
					.upload(uploadKey, file, { upsert: false });
				if (!upErr) {
					lastUploadedDocRef.current = { segments: ["materiales"], name: safeName, mime: file.type };
				}
				toast.success('Archivo guardado en Documentos/materiales');
			} catch (uploadErr) {
				console.error('Upload to materiales failed', uploadErr);
				toast.error('No se pudo guardar el archivo en Documentos/materiales');
			}
			const fd = new FormData();
			if (file.type.includes("pdf")) {
				// Rasterize first page to PNG in-browser using pdfjs and send as imageDataUrl
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
					console.error('PDF rasterization failed', pdfErr);
					// Fallback: send file anyway (server will reject with a helpful message)
					fd.append('file', file);
				}
			} else {
				fd.append('file', file);
			}
			const res = await fetch(`/api/obras/${obraId}/materials/import?preview=1`, { method: "POST", body: fd });
			if (!res.ok) {
				const out = await res.json().catch(() => ({} as any));
				throw new Error(out?.error || "No se pudo importar");
			}
			const out = await res.json();
			// Build preview order form
			const extractedItems = (out.items || []).map((it: any) => ({
				cantidad: String(it.cantidad ?? ''),
				unidad: String(it.unidad ?? ''),
				material: String(it.material ?? ''),
				precioUnitario: String(it.precioUnitario ?? ''),
			}));
			const meta = out.meta || {};
			setImportPreviewOrder({
				nroOrden: meta.nroOrden ?? '',
				solicitante: meta.solicitante ?? '',
				gestor: meta.gestor ?? '',
				proveedor: meta.proveedor ?? '',
				items: extractedItems.length > 0 ? extractedItems : [{ cantidad: '', unidad: '', material: '', precioUnitario: '' }],
			});
			setIsImportPreviewOpen(true);
		} catch (err) {
			console.error(err);
			const message = err instanceof Error ? err.message : "No se pudo importar";
			toast.error(message);
		} finally {
			setIsImportingMaterials(false);
			if (importInputRef.current) importInputRef.current.value = "";
		}
	}, [obraId]);

	// Add-order dialog state
	const [isAddOrderOpen, setIsAddOrderOpen] = useState(false);

	type NewOrderItemForm = {
		cantidad: string;
		unidad: string;
		material: string;
		precioUnitario: string;
	};

	type NewOrderForm = {
		nroOrden: string;
		solicitante: string;
		gestor: string;
		proveedor: string;
		items: NewOrderItemForm[];
	};

	const emptyNewOrderForm: NewOrderForm = {
		nroOrden: "",
		solicitante: "",
		gestor: "",
		proveedor: "",
		items: [
			{ cantidad: "", unidad: "", material: "", precioUnitario: "" },
		],
	};

	const [newOrder, setNewOrder] = useState<NewOrderForm>(() => ({ ...emptyNewOrderForm }));

	const updateNewOrderMeta = useCallback(
		(field: "nroOrden" | "solicitante" | "gestor" | "proveedor", value: string) => {
			setNewOrder((prev) => ({ ...prev, [field]: value }));
		},
		[]
	);

	const addNewOrderItem = useCallback(() => {
		setNewOrder((prev) => ({
			...prev,
			items: [...prev.items, { cantidad: "", unidad: "", material: "", precioUnitario: "" }],
		}));
	}, []);

	const removeNewOrderItem = useCallback((index: number) => {
		setNewOrder((prev) => {
			const items = [...prev.items];
			items.splice(index, 1);
			return { ...prev, items };
		});
	}, []);

	const updateNewOrderItem = useCallback((index: number, field: keyof NewOrderItemForm, value: string) => {
		setNewOrder((prev) => {
			const items = [...prev.items];
			items[index] = { ...items[index], [field]: value };
			return { ...prev, items };
		});
	}, []);

	const handleCreateOrder = useCallback((event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const orderId = `ord-${Date.now()}`;
		const normalizedItems: MaterialItem[] = newOrder.items
			.filter((it) => (it.material?.trim() ?? "").length > 0 && Number(it.cantidad) > 0)
			.map((it, idx) => ({
				id: `${orderId}-i-${idx}`,
				cantidad: Number(it.cantidad) || 0,
				unidad: it.unidad.trim(),
				material: it.material.trim(),
				precioUnitario: Number(it.precioUnitario) || 0,
			}));

		const order: MaterialOrder = {
			id: orderId,
			nroOrden: newOrder.nroOrden.trim() || orderId,
			solicitante: newOrder.solicitante.trim(),
			gestor: newOrder.gestor.trim(),
			proveedor: newOrder.proveedor.trim(),
			items: normalizedItems,
		};

		setMaterialOrders((prev) => [order, ...prev]);
		setOrderFilters((prev) => ({ ...prev, [order.id]: "" }));
		setExpandedOrders((prev) => {
			const next = new Set(prev);
			next.add(order.id);
			return next;
		});
		setIsAddOrderOpen(false);
		setNewOrder({ ...emptyNewOrderForm });
	}, [newOrder]);

	const toggleOrderExpanded = useCallback((orderId: string) => {
		setExpandedOrders((prev) => {
			const next = new Set(prev);
			if (next.has(orderId)) next.delete(orderId); else next.add(orderId);
			return next;
		});
	}, []);

	const setOrderFilter = useCallback((orderId: string, value: string) => {
		setOrderFilters((prev) => ({ ...prev, [orderId]: value }));
	}, []);

	const normalize = (v: string) => v.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

	const filteredOrders = useMemo(() => {
		if (!globalMaterialsFilter.trim()) return materialOrders;
		const q = normalize(globalMaterialsFilter);
		return materialOrders
			.map((order) => ({
				...order,
				items: order.items.filter((it) =>
					normalize(it.material).includes(q) ||
					normalize(it.unidad).includes(q)
				),
			}))
			.filter((order) =>
				normalize(order.nroOrden).includes(q) ||
				normalize(order.solicitante).includes(q) ||
				normalize(order.gestor).includes(q) ||
				normalize(order.proveedor).includes(q) ||
				order.items.length > 0
			);
	}, [materialOrders, globalMaterialsFilter]);

	const getOrderItemsFiltered = useCallback((order: MaterialOrder): MaterialItem[] => {
		const of = orderFilters[order.id]?.trim() ?? "";
		if (!of) return order.items;
		const q = normalize(of);
		return order.items.filter((it) =>
			normalize(it.material).includes(q) || normalize(it.unidad).includes(q)
		);
	}, [orderFilters]);

	const getOrderTotal = useCallback((items: MaterialItem[]) => {
		return items.reduce((acc, it) => acc + it.cantidad * it.precioUnitario, 0);
	}, []);

	// Load persisted material orders (if any)
	const refreshMaterialOrders = useCallback(async () => {
		if (!obraId) return;
		try {
			const res = await fetch(`/api/obras/${obraId}/materials`);
			if (!res.ok) {
				// If the endpoint fails, keep current state (don't re-introduce any fake data)
				return;
			}
			const data = await res.json();
			const orders = (data?.orders || []) as Array<any>;

			const mapped: MaterialOrder[] = orders.map((o: any) => ({
				id: String(o.id),
				nroOrden: String(o.nroOrden || o.id),
				solicitante: String(o.solicitante || ""),
				gestor: String(o.gestor || ""),
				proveedor: String(o.proveedor || ""),
				docPath: o.docPath,
				docBucket: o.docBucket,
				items: (o.items || []).map((it: any, idx: number) => ({
					id: `${o.id}-i-${idx}`,
					cantidad: Number(it.cantidad || 0),
					unidad: String(it.unidad || ""),
					material: String(it.material || ""),
					precioUnitario: Number(it.precioUnitario || 0),
				})),
			}));

			// Always replace materialOrders with whatever the backend returns
			setMaterialOrders(mapped);

			// Build persistent doc mapping from API response (or clear it if there are no orders)
			setOrderDocPaths(() => {
				const acc: Record<string, { segments: string[]; name: string; mime?: string }> = {};
				for (const o of orders) {
					if (o.docPath && typeof o.docPath === 'string') {
						const full = o.docPath as string;
						const obraPrefix = `${String(obraId)}/`;
						const rel = full.startsWith(obraPrefix) ? full.slice(obraPrefix.length) : full;
						const parts = rel.split('/').filter(Boolean);
						if (parts.length >= 1) {
							const name = parts[parts.length - 1];
							const segments = parts.slice(0, -1);
							acc[String(o.id)] = { segments, name };
						}
					}
				}
				return acc;
			});
		} catch {
			// no-op
		}
	}, [obraId]);

	useEffect(() => {
		void refreshMaterialOrders();
	}, [refreshMaterialOrders]);



	// Documents (Supabase Storage) state and handlers
	const DOCUMENTS_BUCKET = "obra-documents";
	const [docPathSegments, setDocPathSegments] = useState<string[]>([]);
	const currentDocsPath = useMemo(() => {
		if (!obraId) return "";
		const base = String(obraId);
		if (docPathSegments.length === 0) return base;
		return `${base}/${docPathSegments.join('/')}`;
	}, [obraId, docPathSegments]);

	type StorageListItem = {
		name: string;
		id?: string;
		updated_at?: string;
		created_at?: string;
		last_accessed_at?: string;
		metadata?: { size?: number; mimetype?: string } | null;
	};

	const [docsLoading, setDocsLoading] = useState(false);
	const [docsError, setDocsError] = useState<string | null>(null);
	const [docItems, setDocItems] = useState<StorageListItem[]>([]);
	const [pendingAutoOpen, setPendingAutoOpen] = useState<{ segments: string[] } | null>(null);

	const listDocuments = useCallback(async () => {
		if (!obraId) return;
		try {
			setDocsLoading(true);
			setDocsError(null);
			const supabase = createSupabaseBrowserClient();
			const { data, error } = await supabase.storage
				.from(DOCUMENTS_BUCKET)
				.list(currentDocsPath, { limit: 1000, sortBy: { column: 'name', order: 'asc' } });
			if (error) throw error;
			setDocItems(data as unknown as StorageListItem[]);
		} catch (err) {
			console.error(err);
			setDocsError("No se pudieron cargar los documentos (verifica que exista el bucket)");
		} finally {
			setDocsLoading(false);
		}
	}, [obraId, currentDocsPath]);

	useEffect(() => {
		if (obraId) {
			void listDocuments();
		}
	}, [obraId, listDocuments]);

	const goToFolder = useCallback((folder: string) => {
		setDocPathSegments((prev) => {
			const next = [...prev, folder];
			return next;
		});
	}, []);

	const goToIndex = useCallback((index: number) => {
		setDocPathSegments((prev) => prev.slice(0, index));
	}, []);

	const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
	const [newFolderName, setNewFolderName] = useState("");

	const handleCreateFolder = useCallback(async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const folder = newFolderName.trim().replaceAll(/\/+|\\+/g, "-");
		if (!folder) return;
		try {
			const supabase = createSupabaseBrowserClient();
			const prefix = currentDocsPath ? `${currentDocsPath}/` : "";
			const key = `${prefix}${folder}/.keep`;
			const { error } = await supabase.storage
				.from(DOCUMENTS_BUCKET)
				.upload(key, new Blob([""], { type: "text/plain" }), { upsert: false });
			if (error) throw error;
			setIsCreateFolderOpen(false);
			setNewFolderName("");
			await listDocuments();
			toast.success("Carpeta creada");
		} catch (err) {
			console.error(err);
			toast.error("No se pudo crear la carpeta");
		}
	}, [newFolderName, currentDocsPath, listDocuments]);

	const uploadInputRef = useRef<HTMLInputElement | null>(null);
	const triggerUpload = useCallback(() => {
		uploadInputRef.current?.click();
	}, []);

	const handleUploadFiles = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = e.target.files;
		if (!files || files.length === 0) return;
		try {
			const supabase = createSupabaseBrowserClient();
			const prefix = currentDocsPath ? `${currentDocsPath}/` : "";
			await Promise.all(
				Array.from(files).map(async (file) => {
					const key = `${prefix}${file.name}`;
					const { error } = await supabase.storage
						.from(DOCUMENTS_BUCKET)
						.upload(key, file, { upsert: false });
					if (error) throw error;
				})
			);
			await listDocuments();
			toast.success("Archivos subidos");
		} catch (err) {
			console.error(err);
			toast.error("No se pudieron subir los archivos");
		} finally {
			if (uploadInputRef.current) uploadInputRef.current.value = "";
		}
	}, [currentDocsPath, listDocuments]);

	const [preview, setPreview] = useState<{ name: string; url: string } | null>(null);
	const previewFile = useCallback(async (name: string, mimetype?: string, overrideSegments?: string[]) => {
		try {
			const supabase = createSupabaseBrowserClient();
			const base = obraId ? String(obraId) : "";
			const path = overrideSegments && overrideSegments.length > 0
				? `${base}/${overrideSegments.join('/')}/${name}`
				: `${currentDocsPath}/${name}`;
			const { data, error } = await supabase.storage
				.from(DOCUMENTS_BUCKET)
				.createSignedUrl(path, 60);
			if (error) throw error;
			setPreview({ name, url: data.signedUrl });
		} catch (err) {
			console.error(err);
			toast.error("No se pudo previsualizar");
		}
	}, [obraId, currentDocsPath]);

	// When user clicked "Ver documento" from materiales, open the stored doc
	useEffect(() => {
		if (activeTab !== 'documentos') return;
		if (!pendingOpenDoc) return;
		const want = pendingOpenDoc.segments.join('/');
		const curr = docPathSegments.join('/');
		if (want !== curr) {
			setDocPathSegments(pendingOpenDoc.segments);
			return;
		}
		void (async () => {
			await previewFile(pendingOpenDoc.name);
			setPendingOpenDoc(null);
		})();
	}, [activeTab, pendingOpenDoc, docPathSegments, previewFile]);

	// Sync documents view with URL
	useEffect(() => {
		if (activeTab === 'documentos') {
			// Prefer full doc path if provided
			const docParam = searchParams.get('doc') || '';
			if (docParam.includes('/')) {
				const parts = docParam.split('/').filter(Boolean);
				const name = parts[parts.length - 1] || '';
				const segs = parts.slice(0, -1);
				if (segs.join('/') !== docPathSegments.join('/')) {
					setDocPathSegments(segs);
				}
				if (name && (!preview || preview.name !== name)) {
					void previewFile(name, undefined, segs);
				}
			} else {
				// Back-compat: use docsPath + doc name
				const path = searchParams.get('docsPath') || '';
				const segs = path.split('/').filter(Boolean);
				if (segs.join('/') !== docPathSegments.join('/')) {
					setDocPathSegments(segs);
				}
				const file = docParam;
				if (file && (!preview || preview.name !== file)) {
					void previewFile(file);
				}
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [searchParams, preview, docPathSegments]);

	// After navigating to a folder via fallback, auto-open first file if available
	useEffect(() => {
		if (!pendingAutoOpen) return;
		const want = pendingAutoOpen.segments.join('/');
		if (docPathSegments.join('/') !== want) return;
		const firstFile = (docItems || []).find((it) => !!it.metadata);
		if (firstFile) {
			void previewFile(firstFile.name, firstFile.metadata?.mimetype as any, pendingAutoOpen.segments);
			setPendingAutoOpen(null);
		}
	}, [pendingAutoOpen, docPathSegments, docItems, previewFile]);

	// Write tab/docsPath/doc to URL after state changes
	useEffect(() => {
		const params = new URLSearchParams(searchParams?.toString?.() || "");
		let changed = false;
		const currTab = params.get('tab') || '';
		if (activeTab && activeTab !== currTab) { params.set('tab', activeTab); changed = true; }
		const wantPath = activeTab === 'documentos' ? docPathSegments.join('/') : '';
		const currPath = params.get('docsPath') || '';
		if ((wantPath || currPath) && wantPath !== currPath) {
			if (wantPath) params.set('docsPath', wantPath); else params.delete('docsPath');
			changed = true;
		}
		const wantDoc = activeTab === 'documentos' && preview ? `${docPathSegments.join('/')}${docPathSegments.length ? '/' : ''}${preview.name}` : '';
		const currDoc = params.get('doc') || '';
		if ((wantDoc || currDoc) && wantDoc !== currDoc) {
			if (wantDoc) params.set('doc', wantDoc); else params.delete('doc');
			changed = true;
		}
		if (changed) {
			const qs = params.toString();
			router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [activeTab, docPathSegments, preview]);

	const downloadFile = useCallback(async (name: string) => {
		try {
			const supabase = createSupabaseBrowserClient();
			const path = `${currentDocsPath}/${name}`;
			const { data, error } = await supabase.storage
				.from(DOCUMENTS_BUCKET)
				.createSignedUrl(path, 60);
			if (error) throw error;
			window.open(data.signedUrl, "_blank");
		} catch (err) {
			console.error(err);
			toast.error("No se pudo descargar");
		}
	}, [currentDocsPath]);

	const form = useForm({
		defaultValues: emptyObra,
		validators: {
			onChange: obraSchema,
		},
		onSubmit: async ({ value }) => {
			if (!obraId || obraId === "undefined") {
				setRouteError("Obra no encontrada");
				return;
			}
			try {
				const payload: Obra = {
					...value,
					id: obraId,
					onFinishSecondSendAt: toIsoDateTime(value.onFinishSecondSendAt ?? null) ?? null,
				};
				const response = await fetch(`/api/obras/${obraId}`, {
					method: "PUT",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify(payload),
				});

				if (!response.ok) {
					const result = await response.json().catch(() => ({}));
					throw new Error(result.error ?? "No se pudo actualizar la obra");
				}

				toast.success("Obra actualizada correctamente");

				try {
					const refresh = await fetch(`/api/obras/${obraId}`);
					if (refresh.ok) {
						const refreshed = await refresh.json();
						applyObraToForm(refreshed.obra as Obra);
					}
				} catch (refreshError) {
					console.error("Error refrescando la obra", refreshError);
				}
			} catch (error) {
				console.error(error);
				toast.error(
					error instanceof Error
						? error.message
						: "No se pudo actualizar la obra"
				);
			}
		},
	});

	useEffect(() => {
		mountedRef.current = true;
		return () => {
			mountedRef.current = false;
		};
	}, []);

	useEffect(() => {
		void (async () => {
			try {
				const supabase = createSupabaseBrowserClient();
				const { data } = await supabase.auth.getUser();
				setCurrentUserId(data.user?.id ?? null);
			} catch {
				// no-op
			}
		})();
	}, []);

	const getErrorMessage = useCallback((errors: unknown): string => {
		if (!errors) return "";
		if (Array.isArray(errors)) {
			const first = errors[0] as any;
			if (typeof first === "string") return first;
			if (first && typeof first === "object" && "message" in first) return String(first.message);
			return JSON.stringify(first);
		}
		if (typeof errors === "object" && errors !== null) {
			const anyErr: any = errors;
			if ("message" in anyErr) return String(anyErr.message);
			return JSON.stringify(anyErr);
		}
		return String(errors);
	}, []);

	const applyObraToForm = useCallback(
		(raw: Obra) => {
			const normalized: Obra = {
				...emptyObra,
				...raw,
				onFinishSecondSendAt: toLocalDateTimeValue(raw.onFinishSecondSendAt ?? null),
			};

			(Object.keys(normalized) as (keyof Obra)[]).forEach((key) => {
				form.setFieldValue(key, normalized[key]);
			});
		},
		[form]
	);

	const handleNewCertificateChange = useCallback(
		(field: keyof NewCertificateFormState, value: string) => {
			setNewCertificate((prev) => ({ ...prev, [field]: value }));
		},
		[]
	);

	const handleToggleAddCertificate = useCallback(() => {
		setCreateCertificateError(null);
		setIsAddingCertificate((prev) => {
			const next = !prev;
			if (!next) {
				setNewCertificate({ ...certificateFormDefault });
			}
			return next;
		});
	}, []);

	const updatePendingDoc = useCallback((index: number, field: keyof PendingDoc, value: string | boolean | number) => {
		setPendingDocs((prev) => {
			const next = [...prev];
			next[index] = { ...next[index], [field]: value } as PendingDoc;
			return next;
		});
	}, []);

	const scheduleReminderForDoc = useCallback(async (doc: PendingDoc) => {
		if (!obraId || obraId === "undefined") return;
		if (doc.dueMode !== "fixed" || !doc.dueDate) return;
		try {
			const res = await fetch("/api/doc-reminders", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					obraId,
					obraName: null,
					documentName: doc.name || "Documento",
					dueDate: doc.dueDate,
					notifyUserId: currentUserId,
					pendienteId: doc.id && /[0-9a-f-]{36}/i.test(doc.id) ? doc.id : null,
				}),
			});
			if (!res.ok) throw new Error("Failed to schedule");
			toast.success("Recordatorio programado");
		} catch (err) {
			console.error(err);
			toast.error("No se pudo programar el recordatorio");
		}
	}, [obraId, currentUserId]);

	const loadPendientes = useCallback(async () => {
		if (!obraId || obraId === "undefined") return;
		try {
			const res = await fetch(`/api/obras/${obraId}/pendientes`);
			if (!res.ok) throw new Error("No se pudieron cargar los pendientes");
			const data = await res.json();
			const list = (data?.pendientes ?? []).map((p: any) => ({
				id: p.id as string,
				name: String(p.name ?? ""),
				poliza: String(p.poliza ?? ""),
				dueMode: (p.dueMode ?? "fixed") as "fixed" | "after_completion",
				dueDate: String(p.dueDate ?? ""),
				offsetDays: Number(p.offsetDays ?? 0),
				done: Boolean(p.done ?? false),
			})) as PendingDoc[];
			if (list.length > 0) setPendingDocs(list);
		} catch (err) {
			console.error(err);
		}
	}, [obraId]);

	useEffect(() => {
		loadPendientes();
	}, [loadPendientes]);

	const savePendingDoc = useCallback(async (doc: PendingDoc, index: number) => {
		if (!obraId || obraId === "undefined") return;
		try {
			const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(doc.id);
			const method = isUuid ? "PUT" : "POST";
			const res = await fetch(`/api/obras/${obraId}/pendientes`, {
				method,
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					id: isUuid ? doc.id : undefined,
					name: doc.name,
					poliza: doc.poliza || null,
					dueMode: doc.dueMode,
					dueDate: doc.dueMode === "fixed" ? (doc.dueDate || null) : null,
					offsetDays: doc.dueMode === "after_completion" ? Number(doc.offsetDays || 0) : null,
					done: doc.done,
				}),
			});
			if (!res.ok) throw new Error("No se pudo guardar");
			const json = await res.json().catch(() => ({}));
			let effectiveDoc = doc;
			if (!isUuid && json?.pendiente?.id) {
				const newId = String(json.pendiente.id);
				effectiveDoc = { ...doc, id: newId };
				setPendingDocs((prev) => {
					const next = [...prev];
					next[index] = effectiveDoc;
					return next;
				});
			}
			toast.success("Pendiente actualizado");
			if (effectiveDoc.dueMode === "fixed" && effectiveDoc.dueDate) {
				await scheduleReminderForDoc(effectiveDoc);
			}
		} catch (err) {
			console.error(err);
			toast.error("No se pudo guardar el pendiente");
		}
	}, [obraId, scheduleReminderForDoc]);

	const deletePendingDoc = useCallback(async (doc: PendingDoc, index: number) => {
		if (!obraId || obraId === "undefined") return;

		// If it's a temporary (unsaved) doc, just remove it from the list
		const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(doc.id);
		if (!isUuid) {
			setPendingDocs((prev) => prev.filter((_, i) => i !== index));
			return;
		}

		try {
			const res = await fetch(`/api/obras/${obraId}/pendientes?id=${doc.id}`, {
				method: "DELETE",
			});
			if (!res.ok) throw new Error("No se pudo eliminar");
			setPendingDocs((prev) => prev.filter((_, i) => i !== index));
			toast.success("Pendiente eliminado");
		} catch (err) {
			console.error(err);
			toast.error("No se pudo eliminar el pendiente");
		}
	}, [obraId]);

	// Flujo Actions functions
	const loadFlujoActions = useCallback(async () => {
		if (!obraId || obraId === "undefined") return;
		setIsLoadingFlujoActions(true);
		try {
			const res = await fetch(`/api/flujo-actions?obraId=${obraId}`);
			if (!res.ok) throw new Error("Failed to load flujo actions");
			const data = await res.json();
			setFlujoActions(data.actions || []);
		} catch (err) {
			console.error("Error loading flujo actions:", err);
			toast.error("No se pudieron cargar las acciones de flujo");
		} finally {
			setIsLoadingFlujoActions(false);
		}
	}, [obraId]);

	useEffect(() => {
		loadFlujoActions();
	}, [loadFlujoActions]);

	// Load roles and users for this obra's tenant to power the flujo recipients selector
	useEffect(() => {
		if (!obraId || obraId === "undefined") return;
		let cancelled = false;
		(async () => {
			try {
				const res = await fetch(`/api/obra-recipients?obraId=${obraId}`);
				if (!res.ok) return;
				const data = await res.json();
				if (cancelled) return;
				setObraRoles(data.roles ?? []);
				setObraUsers(data.users ?? []);
				setObraUserRoles(data.userRoles ?? []);
			} catch (error) {
				console.error("Error loading obra recipients", error);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [obraId]);

	const saveFlujoAction = useCallback(async () => {
		if (!obraId || obraId === "undefined") return;
		if (!newFlujoAction.title) {
			toast.error("El título es requerido");
			return;
		}

		try {
			// Derive recipient user IDs from explicit selection and optional role
			let recipientUserIds: string[] = [];
			if (selectedRecipientUserId) {
				recipientUserIds.push(selectedRecipientUserId);
			}
			if (selectedRecipientRoleId) {
				const roleId = selectedRecipientRoleId;
				const roleUserIds = obraUserRoles
					.filter((ur) => ur.role_id === roleId)
					.map((ur) => ur.user_id);
				recipientUserIds.push(...roleUserIds);
			}

			recipientUserIds = Array.from(new Set(recipientUserIds));

			const res = await fetch("/api/flujo-actions", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					obraId,
					actionType: newFlujoAction.action_type,
					timingMode: newFlujoAction.timing_mode,
					offsetValue: newFlujoAction.offset_value,
					offsetUnit: newFlujoAction.offset_unit,
					scheduledDate: newFlujoAction.scheduled_date,
					title: newFlujoAction.title,
					message: newFlujoAction.message,
					recipientUserIds,
					notificationTypes: (newFlujoAction.notification_types ??
						["in_app"]) as ("in_app" | "email")[],
				}),
			});

			if (!res.ok) throw new Error("Failed to save flujo action");
			const data = await res.json();
			setFlujoActions((prev) => [...prev, data.action]);
			setNewFlujoAction({
				action_type: 'email',
				timing_mode: 'immediate',
				offset_value: 1,
				offset_unit: 'days',
				title: '',
				message: '',
				recipient_user_ids: [],
				notification_types: ["in_app"],
				enabled: true,
			});
			setSelectedRecipientUserId("");
			setSelectedRecipientRoleId("");
			setIsAddingFlujoAction(false);
			toast.success("Acción de flujo creada");
		} catch (err) {
			console.error("Error saving flujo action:", err);
			toast.error("No se pudo guardar la acción de flujo");
		}
	}, [obraId, newFlujoAction, obraUserRoles, selectedRecipientRoleId, selectedRecipientUserId]);

	const deleteFlujoAction = useCallback(async (actionId: string) => {
		if (!obraId || obraId === "undefined") return;

		try {
			const res = await fetch(`/api/flujo-actions?id=${actionId}`, {
				method: "DELETE",
			});
			if (!res.ok) throw new Error("Failed to delete flujo action");
			setFlujoActions((prev) => prev.filter((a) => a.id !== actionId));
			toast.success("Acción de flujo eliminada");
		} catch (err) {
			console.error("Error deleting flujo action:", err);
			toast.error("No se pudo eliminar la acción de flujo");
		}
	}, [obraId]);

	const toggleFlujoAction = useCallback(async (actionId: string, enabled: boolean) => {
		if (!obraId || obraId === "undefined") return;

		try {
			const res = await fetch("/api/flujo-actions", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ id: actionId, enabled }),
			});
			if (!res.ok) throw new Error("Failed to toggle flujo action");
			setFlujoActions((prev) =>
				prev.map((a) => (a.id === actionId ? { ...a, enabled } : a))
			);
			toast.success(enabled ? "Acción activada" : "Acción desactivada");
		} catch (err) {
			console.error("Error toggling flujo action:", err);
			toast.error("No se pudo actualizar la acción");
		}
	}, [obraId]);

	const refreshCertificates = useCallback(async () => {
		if (!obraId || obraId === "undefined") {
			return;
		}

		if (mountedRef.current) {
			setCertificatesLoading(true);
		}

		try {
			const response = await fetch(`/api/obras/${obraId}/certificates`);
			if (!response.ok) {
				throw new Error("Failed to load certificates");
			}

			const data = await response.json();

			if (!mountedRef.current) {
				return;
			}

			setCertificates(data.certificates || []);
			setCertificatesTotal(data.total || 0);
		} catch (error) {
			console.error("Error loading certificates:", error);
		} finally {
			if (mountedRef.current) {
				setCertificatesLoading(false);
			}
		}
	}, [obraId]);

	const handleCreateCertificate = useCallback(
		async (event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();

			if (!obraId || obraId === "undefined") {
				setRouteError("Obra no encontrada");
				return;
			}

			const trimmedExp = newCertificate.n_exp.trim();
			const trimmedMes = newCertificate.mes.trim();
			const certificadoRaw = newCertificate.n_certificado.trim();
			const montoRaw = newCertificate.monto.trim();
			const nCertNumber = Number(newCertificate.n_certificado);
			const montoNumber = Number(newCertificate.monto);

			if (!trimmedExp) {
				setCreateCertificateError("El número de expediente es obligatorio");
				return;
			}

			if (!certificadoRaw || Number.isNaN(nCertNumber)) {
				setCreateCertificateError("El número de certificado debe ser un número");
				return;
			}

			if (!montoRaw || Number.isNaN(montoNumber)) {
				setCreateCertificateError("El monto debe ser un número");
				return;
			}

			if (!trimmedMes) {
				setCreateCertificateError("El mes es obligatorio");
				return;
			}

			setCreateCertificateError(null);
			setIsCreatingCertificate(true);

			try {
				const response = await fetch(`/api/obras/${obraId}/certificates`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						n_exp: trimmedExp,
						n_certificado: nCertNumber,
						monto: montoNumber,
						mes: trimmedMes,
						estado: newCertificate.estado.trim() || "CERTIFICADO",
					}),
				});

				if (!response.ok) {
					const result = await response.json().catch(() => ({}));
					throw new Error(result.error ?? "No se pudo crear el certificado");
				}

				toast.success("Certificado agregado correctamente");
				setNewCertificate({ ...certificateFormDefault });
				await refreshCertificates();
			} catch (error) {
				console.error("Error creating certificate:", error);
				const message =
					error instanceof Error
						? error.message
						: "No se pudo crear el certificado";
				setCreateCertificateError(message);
				toast.error(message);
			} finally {
				setIsCreatingCertificate(false);
			}
		},
		[obraId, newCertificate, refreshCertificates]
	);

	useEffect(() => {
		if (!obraId || obraId === "undefined") {
			setRouteError("Obra no encontrada");
			setIsLoading(false);
			return;
		}

		let isMounted = true;

		async function loadObra() {
			setIsLoading(true);
			try {
				const response = await fetch(`/api/obras/${obraId}`);
				if (!response.ok) {
					const result = await response.json().catch(() => ({}));
					throw new Error(result.error ?? "No se pudo cargar la obra");
				}

				const data = await response.json();
				if (!isMounted) return;

				applyObraToForm(data.obra as Obra);

				setLoadError(null);
			} catch (error) {
				console.error(error);
				if (isMounted) {
					setLoadError(
						error instanceof Error ? error.message : "No se pudo cargar la obra"
					);
				}
			} finally {
				if (isMounted) {
					setIsLoading(false);
				}
			}
		}

		void loadObra();

		return () => {
			isMounted = false;
		};
	}, [obraId, applyObraToForm]);

	useEffect(() => {
		void refreshCertificates();
	}, [refreshCertificates]);

	return (
		<div className="min-h-screen bg-gradient-to-b from-background to-muted/20 "		>
			<div className="container max-w-full mx-auto px-6">
				{/* Header */}
				<ExcelPageTabs />
				{/* <motion.div
					initial={{ opacity: 0, y: -20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.3 }}
					className="flex items-center justify-between"
				>
					<div className="space-y-1"> */}
				{/* <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
							<Link href="/excel" className="gap-2">
								<ArrowLeft className="h-4 w-4" />
								Volver al listado
							</Link>
						</Button> */}
				{/* <h1 className="text-4xl font-bold tracking-tight">Detalle de Obra</h1>
						<p className="text-muted-foreground">Gestiona la información y configuración de correos</p> */}
				{/* </div>
				</motion.div> */}

				{routeError ? (
					<motion.div
						initial={{ opacity: 0, scale: 0.95 }}
						animate={{ opacity: 1, scale: 1 }}
						className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-destructive"
					>
						<p className="font-medium">{routeError}</p>
					</motion.div>
				) : isLoading ? (
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						className="flex items-center justify-center py-12"
					>
						<div className="space-y-2 text-center">
							<div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
							<p className="text-sm text-muted-foreground">Cargando obra...</p>
						</div>
					</motion.div>
				) : loadError ? (
					<motion.div
						initial={{ opacity: 0, scale: 0.95 }}
						animate={{ opacity: 1, scale: 1 }}
						className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-destructive"
					>
						<p className="font-medium">{loadError}</p>
					</motion.div>
				) : (
					<Tabs value={activeTab} className="space-y-6">
						<TabsContent value="general" className="space-y-6 relative">
							{/* Edit/Preview Toggle Button */}
							<motion.div
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								className="flex justify-end absolute right-0 -mt-13"
							>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() => setIsGeneralTabEditMode(!isGeneralTabEditMode)}
									className="gap-2"
								>
									{isGeneralTabEditMode ? (
										<>
											<Eye className="h-4 w-4" />
											Modo Vista Previa
										</>
									) : (
										<>
											<Pencil className="h-4 w-4" />
											Modo Edición
										</>
									)}
								</Button>
							</motion.div>

							{isGeneralTabEditMode ? (
								<motion.form
									initial={{ opacity: 0, y: 20 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ duration: 0.4 }}
									className="space-y-6"
									onSubmit={(event) => {
										event.preventDefault();
										event.stopPropagation();
										form.handleSubmit();
									}}
								>
									{/* Key Metrics Cards */}
									<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
										<motion.div
											initial={{ opacity: 0, scale: 0.95 }}
											animate={{ opacity: 1, scale: 1 }}
											transition={{ delay: 0.1 }}
											className="rounded-lg border bg-card p-4 shadow-sm"
										>
											<form.Field name="porcentaje">
												{(field) => (
													<>
														<div className="flex items-center gap-2 text-muted-foreground mb-2">
															<Percent className="h-4 w-4" />
															<span className="text-sm font-medium">Avance</span>
														</div>
														<div className="text-3xl font-bold">
															{field.state.value}%
														</div>
														<div className="mt-3">
															<Input
																type="number"
																step="0.01"
																value={field.state.value}
																onChange={(e) => field.handleChange(Number(e.target.value))}
																onBlur={field.handleBlur}
																className="text-right"
															/>
														</div>
														{getErrorMessage(field.state.meta.errors) && (
															<p className="mt-1 text-xs text-red-500">
																{getErrorMessage(field.state.meta.errors)}
															</p>
														)}
													</>
												)}
											</form.Field>
										</motion.div>

										<motion.div
											initial={{ opacity: 0, scale: 0.95 }}
											animate={{ opacity: 1, scale: 1 }}
											transition={{ delay: 0.15 }}
											className="rounded-lg border bg-card p-4 shadow-sm"
										>
											<form.Field name="n">
												{(field) => (
													<>
														<div className="flex items-center gap-2 text-muted-foreground mb-2">
															<FileText className="h-4 w-4" />
															<span className="text-sm font-medium">N° de Obra</span>
														</div>
														<div className="text-3xl font-bold">
															#{field.state.value}
														</div>
														<div className="mt-3">
															<Input
																type="number"
																value={field.state.value}
																onChange={(e) => field.handleChange(Number(e.target.value))}
																onBlur={field.handleBlur}
																className="text-right"
															/>
														</div>
														{getErrorMessage(field.state.meta.errors) && (
															<p className="mt-1 text-xs text-red-500">
																{getErrorMessage(field.state.meta.errors)}
															</p>
														)}
													</>
												)}
											</form.Field>
										</motion.div>

										<motion.div
											initial={{ opacity: 0, scale: 0.95 }}
											animate={{ opacity: 1, scale: 1 }}
											transition={{ delay: 0.2 }}
											className="rounded-lg border bg-card p-4 shadow-sm"
										>
											<form.Field name="supDeObraM2">
												{(field) => (
													<>
														<div className="flex items-center gap-2 text-muted-foreground mb-2">
															<TrendingUp className="h-4 w-4" />
															<span className="text-sm font-medium">Superficie</span>
														</div>
														<div className="text-3xl font-bold">
															{field.state.value.toLocaleString('es-AR')}
														</div>
														<div className="text-xs text-muted-foreground mb-2">m²</div>
														<div className="mt-2">
															<Input
																type="number"
																value={field.state.value}
																onChange={(e) => field.handleChange(Number(e.target.value))}
																onBlur={field.handleBlur}
																className="text-right"
															/>
														</div>
														{getErrorMessage(field.state.meta.errors) && (
															<p className="mt-1 text-xs text-red-500">
																{getErrorMessage(field.state.meta.errors)}
															</p>
														)}
													</>
												)}
											</form.Field>
										</motion.div>
									</div>

									{/* Main Information Section */}
									<motion.section
										initial={{ opacity: 0, y: 20 }}
										animate={{ opacity: 1, y: 0 }}
										transition={{ delay: 0.25 }}
										className="rounded-lg border bg-card shadow-sm overflow-hidden"
									>
										<div className="bg-muted/50 px-6 py-4 border-b">
											<div className="flex items-center gap-2">
												<Building2 className="h-5 w-5 text-primary" />
												<h2 className="text-lg font-semibold">Información General</h2>
											</div>
										</div>
										<div className="p-6 space-y-6">
											<form.Field name="designacionYUbicacion">
												{(field) => (
													<div>
														<label className="flex items-center gap-2 text-sm font-medium mb-2">
															<MapPin className="h-4 w-4 text-muted-foreground" />
															Designación y ubicación
														</label>
														<textarea
															value={field.state.value}
															onChange={(e) => field.handleChange(e.target.value)}
															onBlur={field.handleBlur}
															className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-[100px] resize-none"
															placeholder="Describe la ubicación y características principales de la obra..."
														/>
														{getErrorMessage(field.state.meta.errors) && (
															<p className="mt-1 text-xs text-red-500">
																{getErrorMessage(field.state.meta.errors)}
															</p>
														)}
													</div>
												)}
											</form.Field>

											<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
												<form.Field name="entidadContratante">
													{(field) => (
														<div>
															<label className="flex items-center gap-2 text-sm font-medium mb-2">
																<Building2 className="h-4 w-4 text-muted-foreground" />
																Entidad contratante
															</label>
															<Input
																type="text"
																value={field.state.value}
																onChange={(e) => field.handleChange(e.target.value)}
																onBlur={field.handleBlur}
																placeholder="Nombre de la entidad"
															/>
															{getErrorMessage(field.state.meta.errors) && (
																<p className="mt-1 text-xs text-red-500">
																	{getErrorMessage(field.state.meta.errors)}
																</p>
															)}
														</div>
													)}
												</form.Field>

												<form.Field name="mesBasicoDeContrato">
													{(field) => (
														<div>
															<label className="flex items-center gap-2 text-sm font-medium mb-2">
																<Calendar className="h-4 w-4 text-muted-foreground" />
																Mes básico de contrato
															</label>
															<Input
																type="text"
																value={field.state.value}
																onChange={(e) => field.handleChange(e.target.value)}
																onBlur={field.handleBlur}
																placeholder="Ej: Enero 2024"
															/>
															{getErrorMessage(field.state.meta.errors) && (
																<p className="mt-1 text-xs text-red-500">
																	{getErrorMessage(field.state.meta.errors)}
																</p>
															)}
														</div>
													)}
												</form.Field>

												<form.Field name="iniciacion">
													{(field) => (
														<div>
															<label className="flex items-center gap-2 text-sm font-medium mb-2">
																<Calendar className="h-4 w-4 text-muted-foreground" />
																Fecha de iniciación
															</label>
															<Input
																type="text"
																value={field.state.value}
																onChange={(e) => field.handleChange(e.target.value)}
																onBlur={field.handleBlur}
																placeholder="Ej: 01/01/2024"
															/>
															{getErrorMessage(field.state.meta.errors) && (
																<p className="mt-1 text-xs text-red-500">
																	{getErrorMessage(field.state.meta.errors)}
																</p>
															)}
														</div>
													)}
												</form.Field>
											</div>
										</div>
									</motion.section>

									{/* Financial Section */}
									<motion.section
										initial={{ opacity: 0, y: 20 }}
										animate={{ opacity: 1, y: 0 }}
										transition={{ delay: 0.3 }}
										className="rounded-lg border bg-card shadow-sm overflow-hidden"
									>
										<div className="bg-muted/50 px-6 py-4 border-b">
											<div className="flex items-center gap-2">
												<DollarSign className="h-5 w-5 text-primary" />
												<h2 className="text-lg font-semibold">Datos Financieros</h2>
											</div>
										</div>
										<div className="p-6 space-y-4">
											<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
												<form.Field name="contratoMasAmpliaciones">
													{(field) => (
														<div>
															<label className="block text-sm font-medium text-muted-foreground mb-2">
																Contrato más ampliaciones
															</label>
															<div className="relative">
																<span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
																	$
																</span>
																<Input
																	type="number"
																	value={field.state.value}
																	onChange={(e) => field.handleChange(Number(e.target.value))}
																	onBlur={field.handleBlur}
																	className="text-right pl-8 font-mono"
																	placeholder="0.00"
																/>
															</div>
														</div>
													)}
												</form.Field>

												<form.Field name="certificadoALaFecha">
													{(field) => (
														<div>
															<label className="block text-sm font-medium text-muted-foreground mb-2">
																Certificado a la fecha
															</label>
															<div className="relative">
																<span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
																	$
																</span>
																<Input
																	type="number"
																	value={field.state.value}
																	onChange={(e) => field.handleChange(Number(e.target.value))}
																	onBlur={field.handleBlur}
																	className="text-right pl-8 font-mono"
																	placeholder="0.00"
																/>
															</div>
														</div>
													)}
												</form.Field>

												<form.Field name="saldoACertificar">
													{(field) => (
														<div>
															<label className="block text-sm font-medium text-muted-foreground mb-2">
																Saldo a certificar
															</label>
															<div className="relative">
																<span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
																	$
																</span>
																<Input
																	type="number"
																	value={field.state.value}
																	onChange={(e) => field.handleChange(Number(e.target.value))}
																	onBlur={field.handleBlur}
																	className="text-right pl-8 font-mono"
																	placeholder="0.00"
																/>
															</div>
														</div>
													)}
												</form.Field>
											</div>

											<Separator />

											<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
												<form.Field name="segunContrato">
													{(field) => (
														<div>
															<label className="block text-sm font-medium text-muted-foreground mb-2">
																Según contrato
															</label>
															<div className="relative">
																<Input
																	type="number"
																	value={field.state.value}
																	onChange={(e) => field.handleChange(Number(e.target.value))}
																	onBlur={field.handleBlur}
																	className="text-right pr-14"
																	placeholder="0"
																/>
																<span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
																	meses
																</span>
															</div>
														</div>
													)}
												</form.Field>

												<form.Field name="prorrogasAcordadas">
													{(field) => (
														<div>
															<label className="block text-sm font-medium text-muted-foreground mb-2">
																Prórrogas acordadas
															</label>
															<div className="relative">
																<Input
																	type="number"
																	value={field.state.value}
																	onChange={(e) => field.handleChange(Number(e.target.value))}
																	onBlur={field.handleBlur}
																	className="text-right pr-14"
																	placeholder="0"
																/>
																<span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
																	meses
																</span>
															</div>
														</div>
													)}
												</form.Field>

												<form.Field name="plazoTotal">
													{(field) => (
														<div>
															<label className="block text-sm font-medium text-muted-foreground mb-2">
																Plazo total
															</label>
															<div className="relative">
																<Input
																	type="number"
																	value={field.state.value}
																	onChange={(e) => field.handleChange(Number(e.target.value))}
																	onBlur={field.handleBlur}
																	className="text-right pr-14"
																	placeholder="0"
																/>
																<span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
																	meses
																</span>
															</div>
														</div>
													)}
												</form.Field>

												<form.Field name="plazoTransc">
													{(field) => (
														<div>
															<label className="block text-sm font-medium text-muted-foreground mb-2">
																Transcurrido
															</label>
															<div className="relative">
																<Input
																	type="number"
																	value={field.state.value}
																	onChange={(e) => field.handleChange(Number(e.target.value))}
																	onBlur={field.handleBlur}
																	className="text-right pr-14"
																	placeholder="0"
																/>
																<span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
																	meses
																</span>
															</div>
														</div>
													)}
												</form.Field>
											</div>
										</div>
									</motion.section>

									{/* Action Buttons */}
									<motion.div
										initial={{ opacity: 0 }}
										animate={{ opacity: 1 }}
										transition={{ delay: 0.35 }}
										className="flex justify-end gap-3 pt-4"
									>
										<Button asChild variant="outline">
											<Link href="/excel">Cancelar</Link>
										</Button>
										<form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
											{([canSubmit, isSubmitting]) => (
												<Button type="submit" disabled={!canSubmit} className="min-w-[140px]">
													{isSubmitting ? "Guardando..." : "Guardar cambios"}
												</Button>
											)}
										</form.Subscribe>
									</motion.div>
								</motion.form>
							) : (
								/* Preview Mode */
								<div className="space-y-6">
									{/* Key Metrics Cards */}
									<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
										<motion.div
											initial={{ opacity: 0, scale: 0.95 }}
											animate={{ opacity: 1, scale: 1 }}
											transition={{ delay: 0.1 }}
											className="rounded-lg border bg-card p-4 shadow-sm"
										>
											<div className="flex items-center gap-2 text-muted-foreground mb-2">
												<Percent className="h-4 w-4" />
												<span className="text-sm font-medium">Avance</span>
											</div>
											<div className="text-3xl font-bold">
												{form.state.values.porcentaje}%
											</div>
										</motion.div>

										<motion.div
											initial={{ opacity: 0, scale: 0.95 }}
											animate={{ opacity: 1, scale: 1 }}
											transition={{ delay: 0.15 }}
											className="rounded-lg border bg-card p-4 shadow-sm"
										>
											<div className="flex items-center gap-2 text-muted-foreground mb-2">
												<FileText className="h-4 w-4" />
												<span className="text-sm font-medium">N° de Obra</span>
											</div>
											<div className="text-3xl font-bold">
												#{form.state.values.n}
											</div>
										</motion.div>

										<motion.div
											initial={{ opacity: 0, scale: 0.95 }}
											animate={{ opacity: 1, scale: 1 }}
											transition={{ delay: 0.2 }}
											className="rounded-lg border bg-card p-4 shadow-sm"
										>
											<div className="flex items-center gap-2 text-muted-foreground mb-2">
												<TrendingUp className="h-4 w-4" />
												<span className="text-sm font-medium">Superficie</span>
											</div>
											<div className="text-3xl font-bold">
												{form.state.values.supDeObraM2.toLocaleString('es-AR')}
											</div>
											<div className="text-xs text-muted-foreground">m²</div>
										</motion.div>
									</div>

									{/* Main Information Section */}
									<motion.section
										initial={{ opacity: 0, y: 20 }}
										animate={{ opacity: 1, y: 0 }}
										transition={{ delay: 0.25 }}
										className="rounded-lg border bg-card shadow-sm overflow-hidden"
									>
										<div className="bg-muted/50 px-6 py-4 border-b">
											<div className="flex items-center gap-2">
												<Building2 className="h-5 w-5 text-primary" />
												<h2 className="text-lg font-semibold">Información General</h2>
											</div>
										</div>
										<div className="p-6 space-y-6">
											<div>
												<label className="flex items-center gap-2 text-sm font-medium mb-2 text-muted-foreground">
													<MapPin className="h-4 w-4" />
													Designación y ubicación
												</label>
												<p className="text-sm min-h-[100px]">
													{form.state.values.designacionYUbicacion || 'No especificado'}
												</p>
											</div>

											<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
												<div>
													<label className="flex items-center gap-2 text-sm font-medium mb-2 text-muted-foreground">
														<Building2 className="h-4 w-4" />
														Entidad contratante
													</label>
													<p className="text-sm">
														{form.state.values.entidadContratante || 'No especificado'}
													</p>
												</div>

												<div>
													<label className="flex items-center gap-2 text-sm font-medium mb-2 text-muted-foreground">
														<Calendar className="h-4 w-4" />
														Mes básico de contrato
													</label>
													<p className="text-sm">
														{form.state.values.mesBasicoDeContrato || 'No especificado'}
													</p>
												</div>

												<div>
													<label className="flex items-center gap-2 text-sm font-medium mb-2 text-muted-foreground">
														<Calendar className="h-4 w-4" />
														Fecha de iniciación
													</label>
													<p className="text-sm">
														{form.state.values.iniciacion || 'No especificado'}
													</p>
												</div>
											</div>
										</div>
									</motion.section>

									{/* Financial Section */}
									<motion.section
										initial={{ opacity: 0, y: 20 }}
										animate={{ opacity: 1, y: 0 }}
										transition={{ delay: 0.3 }}
										className="rounded-lg border bg-card shadow-sm overflow-hidden"
									>
										<div className="bg-muted/50 px-6 py-4 border-b">
											<div className="flex items-center gap-2">
												<DollarSign className="h-5 w-5 text-primary" />
												<h2 className="text-lg font-semibold">Datos Financieros</h2>
											</div>
										</div>
										<div className="p-6 space-y-4">
											<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
												<div>
													<label className="block text-sm font-medium text-muted-foreground mb-2">
														Contrato más ampliaciones
													</label>
													<p className="text-sm font-mono">
														$ {form.state.values.contratoMasAmpliaciones.toLocaleString('es-AR')}
													</p>
												</div>

												<div>
													<label className="block text-sm font-medium text-muted-foreground mb-2">
														Certificado a la fecha
													</label>
													<p className="text-sm font-mono">
														$ {form.state.values.certificadoALaFecha.toLocaleString('es-AR')}
													</p>
												</div>

												<div>
													<label className="block text-sm font-medium text-muted-foreground mb-2">
														Saldo a certificar
													</label>
													<p className="text-sm font-mono">
														$ {form.state.values.saldoACertificar.toLocaleString('es-AR')}
													</p>
												</div>
											</div>

											<Separator />

											<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
												<div>
													<label className="block text-sm font-medium text-muted-foreground mb-2">
														Según contrato
													</label>
													<p className="text-sm">
														{form.state.values.segunContrato} meses
													</p>
												</div>

												<div>
													<label className="block text-sm font-medium text-muted-foreground mb-2">
														Prórrogas acordadas
													</label>
													<p className="text-sm">
														{form.state.values.prorrogasAcordadas} meses
													</p>
												</div>

												<div>
													<label className="block text-sm font-medium text-muted-foreground mb-2">
														Plazo total
													</label>
													<p className="text-sm">
														{form.state.values.plazoTotal} meses
													</p>
												</div>

												<div>
													<label className="block text-sm font-medium text-muted-foreground mb-2">
														Transcurrido
													</label>
													<p className="text-sm">
														{form.state.values.plazoTransc} meses
													</p>
												</div>
											</div>
										</div>
									</motion.section>
								</div>
							)}
						</TabsContent>

						{/* Flujo Tab */}
						<TabsContent value="flujo" className="space-y-6">
							<motion.section
								initial={{ opacity: 0, y: 20 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ duration: 0.4 }}
								className="rounded-lg border bg-card shadow-sm overflow-hidden"
							>
								<div className="bg-muted/50 px-6 py-4 border-b">
									<div className="flex items-center justify-between">
										<div>
											<div className="flex items-center gap-2">
												<Mail className="h-5 w-5 text-primary" />
												<h2 className="text-lg font-semibold">Flujo de Finalización</h2>
											</div>
											<p className="text-sm text-muted-foreground mt-1">
												Configura acciones automáticas al alcanzar el 100% de la obra
											</p>
										</div>
										<Button
											variant={isAddingFlujoAction ? "outline" : "default"}
											onClick={() => setIsAddingFlujoAction(!isAddingFlujoAction)}
											size="sm"
										>
											<Plus className="h-4 w-4 mr-2" />
											{isAddingFlujoAction ? "Cancelar" : "Nueva Acción"}
										</Button>
									</div>
								</div>

								<div className="p-6 space-y-6">
									{/* Add New Action Form */}
									{isAddingFlujoAction && (
										<motion.div
											initial={{ opacity: 0, height: 0 }}
											animate={{ opacity: 1, height: "auto" }}
											exit={{ opacity: 0, height: 0 }}
											className="rounded-lg border bg-muted/30 p-4 space-y-4"
										>
											<h3 className="text-sm font-semibold">Nueva Acción</h3>

											{/* Action Type */}
											<div>
												<label className="text-sm font-medium mb-2 block">Tipo de acción</label>
												<div className="flex gap-2">
													<Button
														type="button"
														variant={newFlujoAction.action_type === 'email' ? 'default' : 'outline'}
														size="sm"
														onClick={() => setNewFlujoAction({ ...newFlujoAction, action_type: 'email' })}
													>
														<Mail className="h-4 w-4 mr-2" />
														Email
													</Button>
													<Button
														type="button"
														variant={newFlujoAction.action_type === 'calendar_event' ? 'default' : 'outline'}
														size="sm"
														onClick={() => setNewFlujoAction({ ...newFlujoAction, action_type: 'calendar_event' })}
													>
														<Calendar className="h-4 w-4 mr-2" />
														Evento de Calendario
													</Button>
												</div>
											</div>

											{/* Timing Mode */}
											<div>
												<label className="text-sm font-medium mb-2 block">¿Cuándo ejecutar?</label>
												<div className="flex gap-2 flex-wrap">
													<Button
														type="button"
														variant={newFlujoAction.timing_mode === 'immediate' ? 'default' : 'outline'}
														size="sm"
														onClick={() => setNewFlujoAction({ ...newFlujoAction, timing_mode: 'immediate' })}
													>
														Inmediato
													</Button>
													<Button
														type="button"
														variant={newFlujoAction.timing_mode === 'offset' ? 'default' : 'outline'}
														size="sm"
														onClick={() => setNewFlujoAction({ ...newFlujoAction, timing_mode: 'offset' })}
													>
														Después de X tiempo
													</Button>
													<Button
														type="button"
														variant={newFlujoAction.timing_mode === 'scheduled' ? 'default' : 'outline'}
														size="sm"
														onClick={() => setNewFlujoAction({ ...newFlujoAction, timing_mode: 'scheduled' })}
													>
														Fecha específica
													</Button>
												</div>
											</div>

											{/* Timing Details */}
											{newFlujoAction.timing_mode === 'offset' && (
												<div className="flex gap-2 items-end">
													<div className="flex-1">
														<label className="text-sm font-medium mb-2 block">Cantidad</label>
														<Input
															type="number"
															min="1"
															value={newFlujoAction.offset_value || 1}
															onChange={(e) => setNewFlujoAction({ ...newFlujoAction, offset_value: parseInt(e.target.value) || 1 })}
														/>
													</div>
													<div className="flex-1">
														<label className="text-sm font-medium mb-2 block">Unidad</label>
														<select
															className="w-full rounded-md border px-3 py-2 text-sm"
															value={newFlujoAction.offset_unit || 'days'}
															onChange={(e) => setNewFlujoAction({ ...newFlujoAction, offset_unit: e.target.value as any })}
														>
															<option value="minutes">Minutos</option>
															<option value="hours">Horas</option>
															<option value="days">Días</option>
															<option value="weeks">Semanas</option>
															<option value="months">Meses</option>
														</select>
													</div>
												</div>
											)}

											{newFlujoAction.timing_mode === 'scheduled' && (
												<div>
													<label className="text-sm font-medium mb-2 block">Fecha y hora</label>
													<Input
														type="datetime-local"
														value={newFlujoAction.scheduled_date || ''}
														onChange={(e) => setNewFlujoAction({ ...newFlujoAction, scheduled_date: e.target.value })}
													/>
												</div>
											)}

											{/* Title */}
											<div>
												<label className="text-sm font-medium mb-2 block">Título *</label>
												<Input
													type="text"
													placeholder="Ej: Revisión de documentación final"
													value={newFlujoAction.title || ''}
													onChange={(e) => setNewFlujoAction({ ...newFlujoAction, title: e.target.value })}
												/>
											</div>

											{/* Message */}
											<div>
												<label className="text-sm font-medium mb-2 block">Mensaje</label>
												<textarea
													className="w-full rounded-md border px-3 py-2 text-sm min-h-[100px]"
													placeholder="Mensaje detallado de la acción..."
													value={newFlujoAction.message || ''}
													onChange={(e) => setNewFlujoAction({ ...newFlujoAction, message: e.target.value })}
												/>
											</div>

											{/* Recipients */}
											<div className="space-y-2">
												<label className="text-sm font-medium mb-1 block">
													Destinatarios
												</label>
												<p className="text-xs text-muted-foreground">
													Si no seleccionás nada, se notificará solo al usuario actual. Podés elegir
													un usuario específico, un rol, o ambos.
												</p>
												<div className="grid gap-3 md:grid-cols-2">
													<div>
														<label className="text-xs font-medium mb-1 block">
															Usuario específico
														</label>
														<Select
															value={selectedRecipientUserId || "none"}
															onValueChange={(value) =>
																setSelectedRecipientUserId(
																	value === "none" ? "" : value
																)
															}
														>
															<SelectTrigger className="w-full text-xs">
																<SelectValue placeholder="Seleccionar usuario" />
															</SelectTrigger>
															<SelectContent>
																<SelectItem value="none">
																	<span className="text-xs text-muted-foreground">
																		Ninguno (solo vos)
																	</span>
																</SelectItem>
																{obraUsers.map((u) => (
																	<SelectItem key={u.id} value={u.id}>
																		<span className="text-xs">
																			{u.full_name || u.id}
																		</span>
																	</SelectItem>
																))}
															</SelectContent>
														</Select>
													</div>
													<div>
														<label className="text-xs font-medium mb-1 block">
															Rol
														</label>
														<Select
															value={selectedRecipientRoleId || "none"}
															onValueChange={(value) =>
																setSelectedRecipientRoleId(
																	value === "none" ? "" : value
																)
															}
														>
															<SelectTrigger className="w-full text-xs">
																<SelectValue placeholder="Seleccionar rol" />
															</SelectTrigger>
															<SelectContent>
																<SelectItem value="none">
																	<span className="text-xs text-muted-foreground">
																		Ninguno
																	</span>
																</SelectItem>
																{obraRoles.map((r) => (
																	<SelectItem key={r.id} value={r.id}>
																		<span className="text-xs">
																			{r.name || r.key}
																		</span>
																	</SelectItem>
																))}
															</SelectContent>
														</Select>
													</div>
												</div>
											</div>

											{/* Notification Types */}
											<div>
												<label className="text-sm font-medium mb-2 block">Tipo de notificación</label>
												<div className="space-y-2">
													<div className="flex items-center gap-2">
														<input
															type="checkbox"
															id="notif-in-app"
															className="h-4 w-4 rounded border-gray-300"
															checked={newFlujoAction.notification_types?.includes('in_app') || false}
															onChange={(e) => {
																const current = (newFlujoAction.notification_types ||
																	[]) as ("in_app" | "email")[];
																const updated: ("in_app" | "email")[] = e.target.checked
																	? [...current.filter((t) => t !== "in_app"), "in_app"]
																	: current.filter((t) => t !== "in_app");
																setNewFlujoAction({
																	...newFlujoAction,
																	notification_types:
																		updated.length > 0 ? updated : ["in_app"],
																});
															}}
														/>
														<label htmlFor="notif-in-app" className="text-sm cursor-pointer">
															Notificación en la aplicación
														</label>
													</div>
													<div className="flex items-center gap-2">
														<input
															type="checkbox"
															id="notif-email"
															className="h-4 w-4 rounded border-gray-300"
															checked={newFlujoAction.notification_types?.includes('email') || false}
															onChange={(e) => {
																const current = (newFlujoAction.notification_types ||
																	[]) as ("in_app" | "email")[];
																const updated: ("in_app" | "email")[] = e.target.checked
																	? [...current.filter((t) => t !== "email"), "email"]
																	: current.filter((t) => t !== "email");
																setNewFlujoAction({
																	...newFlujoAction,
																	notification_types:
																		updated.length > 0 ? updated : ["in_app"],
																});
															}}
														/>
														<label htmlFor="notif-email" className="text-sm cursor-pointer">
															Notificación por correo electrónico
														</label>
													</div>
												</div>
												<p className="text-xs text-muted-foreground mt-1">
													Selecciona cómo deseas recibir las notificaciones de esta acción
												</p>
											</div>

											{/* Actions */}
											<div className="flex justify-end gap-2">
												<Button
													type="button"
													variant="outline"
													size="sm"
													onClick={() => {
														setIsAddingFlujoAction(false);
														setNewFlujoAction({
															action_type: 'email',
															timing_mode: 'immediate',
															offset_value: 1,
															offset_unit: 'days',
															title: '',
															message: '',
															recipient_user_ids: [],
															notification_types: ["in_app"],
															enabled: true,
														});
													}}
												>
													Cancelar
												</Button>
												<Button
													type="button"
													size="sm"
													onClick={saveFlujoAction}
												>
													Guardar Acción
												</Button>
											</div>
										</motion.div>
									)}

									{/* List of Existing Actions */}
									<div className="space-y-3">
										{isLoadingFlujoActions ? (
											<p className="text-sm text-muted-foreground text-center py-8">Cargando acciones...</p>
										) : flujoActions.length === 0 ? (
											<p className="text-sm text-muted-foreground text-center py-8">
												No hay acciones configuradas. Crea una nueva acción para comenzar.
											</p>
										) : (
											flujoActions.map((action, idx) => (
												<motion.div
													key={action.id}
													initial={{ opacity: 0, y: 8 }}
													animate={{ opacity: 1, y: 0 }}
													transition={{ delay: idx * 0.05 }}
													className={`rounded-lg border p-4 ${!action.enabled ? 'opacity-50' : ''}`}
												>
													<div className="flex items-start justify-between">
														<div className="flex-1">
															<div className="flex items-center gap-2 mb-2">
																{action.action_type === 'email' ? (
																	<Mail className="h-4 w-4 text-primary" />
																) : (
																	<Calendar className="h-4 w-4 text-primary" />
																)}
																<h4 className="font-semibold text-sm">{action.title}</h4>
																<span className={`text-xs px-2 py-0.5 rounded-full ${action.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
																	{action.enabled ? 'Activa' : 'Inactiva'}
																</span>
															</div>
															{action.message && (
																<p className="text-sm text-muted-foreground mb-2">{action.message}</p>
															)}
															<div className="flex items-center gap-4 text-xs text-muted-foreground">
																<span>
																	{action.action_type === 'email' ? 'Email' : 'Evento de Calendario'}
																</span>
																<span>•</span>
																<span>
																	{action.timing_mode === 'immediate' && 'Inmediato'}
																	{action.timing_mode === 'offset' && `${action.offset_value} ${action.offset_unit} después`}
																	{action.timing_mode === 'scheduled' && `Fecha: ${new Date(action.scheduled_date!).toLocaleDateString()}`}
																</span>
																{action.notification_types && action.notification_types.length > 0 && (
																	<>
																		<span>•</span>
																		<span className="flex items-center gap-1">
																			{action.notification_types.includes('in_app') && (
																				<span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">App</span>
																			)}
																			{action.notification_types.includes('email') && (
																				<span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">Email</span>
																			)}
																		</span>
																	</>
																)}
															</div>
														</div>
														<div className="flex items-center gap-2">
															<Button
																type="button"
																variant="ghost"
																size="sm"
																onClick={() => toggleFlujoAction(action.id, !action.enabled)}
															>
																{action.enabled ? 'Desactivar' : 'Activar'}
															</Button>
															<Button
																type="button"
																variant="ghost"
																size="sm"
																onClick={() => deleteFlujoAction(action.id)}
																className="text-destructive hover:text-destructive hover:bg-destructive/10"
															>
																<Trash2 className="h-4 w-4" />
															</Button>
														</div>
													</div>
												</motion.div>
											))
										)}
									</div>
								</div>
							</motion.section>
						</TabsContent>

						{/* Certificates Tab */}
						<TabsContent value="certificates" className="space-y-6">
							<motion.section
								initial={{ opacity: 0, y: 20 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ duration: 0.4 }}
								className="rounded-lg border bg-card shadow-sm overflow-hidden"
							>
								<div className="bg-muted/50 px-6 py-4 border-b">
									<div className="flex items-center justify-between">
										<div>
											<div className="flex items-center gap-2">
												<Receipt className="h-5 w-5 text-primary" />
												<h2 className="text-lg font-semibold">Certificados de Obra</h2>
											</div>
											<p className="text-sm text-muted-foreground mt-1">
												{certificates.length} {certificates.length === 1 ? 'certificado registrado' : 'certificados registrados'}
											</p>
										</div>
										<Button
											variant={isAddingCertificate ? "outline" : "default"}
											onClick={handleToggleAddCertificate}
											disabled={isCreatingCertificate}
											className="gap-2"
										>
											{isAddingCertificate ? (
												"Cancelar"
											) : (
												<>
													<Plus className="h-4 w-4" />
													Agregar certificado
												</>
											)}
										</Button>
									</div>
								</div>

								<div className="p-6 space-y-6">
									{isAddingCertificate && (
										<motion.div
											initial={{ opacity: 0, height: 0 }}
											animate={{ opacity: 1, height: "auto" }}
											exit={{ opacity: 0, height: 0 }}
											className="overflow-hidden"
										>
											<form onSubmit={handleCreateCertificate} className="space-y-4 p-4 rounded-lg bg-muted/50 border">
												<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
													<div>
														<label className="block text-sm font-medium mb-2">
															N° de expediente
														</label>
														<Input
															type="text"
															value={newCertificate.n_exp}
															onChange={(event) =>
																handleNewCertificateChange("n_exp", event.target.value)
															}
															placeholder="Ej: EXP-2024-001"
															required
														/>
													</div>
													<div>
														<label className="block text-sm font-medium mb-2">
															N° de certificado
														</label>
														<Input
															type="number"
															value={newCertificate.n_certificado}
															onChange={(event) =>
																handleNewCertificateChange("n_certificado", event.target.value)
															}
															placeholder="1"
															required
														/>
													</div>
													<div>
														<label className="block text-sm font-medium mb-2">
															Monto
														</label>
														<div className="relative">
															<span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
																$
															</span>
															<Input
																type="number"
																step="0.01"
																value={newCertificate.monto}
																onChange={(event) =>
																	handleNewCertificateChange("monto", event.target.value)
																}
																className="pl-8 text-right font-mono"
																placeholder="0.00"
																required
															/>
														</div>
													</div>
													<div>
														<label className="block text-sm font-medium mb-2">
															Mes
														</label>
														<Input
															type="text"
															value={newCertificate.mes}
															onChange={(event) =>
																handleNewCertificateChange("mes", event.target.value)
															}
															placeholder="Ej: Enero 2024"
															required
														/>
													</div>
													<div className="md:col-span-2"></div>
													<label className="block text-sm font-medium mb-2">
														Estado
													</label>
													<Input
														type="text"
														value={newCertificate.estado}
														onChange={(event) =>
															handleNewCertificateChange("estado", event.target.value)
														}
														placeholder="CERTIFICADO"
													/>
												</div>
												{createCertificateError && (
													<div className="p-3 rounded-md bg-destructive/10 border border-destructive/50">
														<p className="text-sm text-destructive">{createCertificateError}</p>
													</div>
												)}
												<div className="flex justify-end gap-3 pt-2">
													<Button
														type="button"
														variant="outline"
														onClick={handleToggleAddCertificate}
														disabled={isCreatingCertificate}
													>
														Cancelar
													</Button>
													<Button type="submit" disabled={isCreatingCertificate} className="min-w-[140px]">
														{isCreatingCertificate ? "Guardando..." : "Guardar certificado"}
													</Button>
												</div>
											</form>
										</motion.div>
									)}

									{certificatesLoading ? (
										<div className="flex items-center justify-center py-12">
											<div className="space-y-2 text-center">
												<div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto" />
												<p className="text-sm text-muted-foreground">Cargando certificados...</p>
											</div>
										</div>
									) : certificates.length === 0 && !isAddingCertificate ? (
										<div className="text-center py-12">
											<Receipt className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
											<p className="text-sm text-muted-foreground mb-1">No hay certificados registrados</p>
											<p className="text-xs text-muted-foreground">Agregá el primer certificado para esta obra</p>
										</div>
									) : certificates.length > 0 ? (
										<div className="space-y-4">
											<div className="overflow-x-auto rounded-lg border">
												<table className="w-full text-sm">
													<thead className="bg-muted/50">
														<tr>
															<th className="text-left font-medium py-3 px-4 border-b">N° EXP.</th>
															<th className="text-left font-medium py-3 px-4 border-b">N° Certificado</th>
															<th className="text-right font-medium py-3 px-4 border-b">Monto</th>
															<th className="text-left font-medium py-3 px-4 border-b">Mes</th>
															<th className="text-left font-medium py-3 px-4 border-b">Estado</th>
														</tr>
													</thead>
													<tbody>
														{certificates.map((cert, index) => (
															<motion.tr
																key={cert.id}
																initial={{ opacity: 0, y: 10 }}
																animate={{ opacity: 1, y: 0 }}
																transition={{ delay: index * 0.05 }}
																className="border-b last:border-0 hover:bg-muted/30 transition-colors"
															>
																<td className="py-3 px-4 font-medium">{cert.n_exp}</td>
																<td className="py-3 px-4">{cert.n_certificado}</td>
																<td className="py-3 px-4 text-right font-mono">
																	$ {Number(cert.monto).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
																</td>
																<td className="py-3 px-4">{cert.mes}</td>
																<td className="py-3 px-4">
																	<span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
																		{cert.estado}
																	</span>
																</td>
															</motion.tr>
														))}
													</tbody>
												</table>
											</div>

											{/* Total Summary */}
											<div className="flex justify-between items-center p-4 rounded-lg bg-muted/50 border">
												<div className="flex items-center gap-2">
													<DollarSign className="h-5 w-5 text-muted-foreground" />
													<span className="font-semibold">Total Certificado</span>
												</div>
												<span className="text-xl font-bold font-mono">
													$ {Number(certificatesTotal).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
												</span>
											</div>
										</div>
									) : null}
								</div>
							</motion.section>
						</TabsContent>

						{/* Documentos Tab - Unified File Manager */}
						<TabsContent value="documentos" className="space-y-6">
							<FileManager
								obraId={String(obraId)}
								materialOrders={materialOrders}
								onRefreshMaterials={refreshMaterialOrders}
							/>
						</TabsContent>

						{/* OLD - Materiales Tab - Temporarily disabled */}
						<TabsContent value="materiales-old" className="space-y-6 hidden">
							<motion.section
								initial={{ opacity: 0, y: 20 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ duration: 0.4 }}
								className="rounded-lg border bg-card shadow-sm overflow-hidden"
							>
								<div className="bg-muted/50 px-6 py-4 border-b">
									<div className="flex items-center justify-between gap-4 flex-wrap">
										<div>
											<div className="flex items-center gap-2">
												<FileText className="h-5 w-5 text-primary" />
												<h2 className="text-lg font-semibold">Materiales</h2>
											</div>
											<p className="text-sm text-muted-foreground mt-1">Órdenes de materiales enviadas a la obra</p>
										</div>
										<div className="w-full sm:w-auto flex items-center gap-2">
											<Input
												placeholder="Filtrar por material, proveedor, solicitante o gestor"
												value={globalMaterialsFilter}
												onChange={(e) => setGlobalMaterialsFilter(e.target.value)}
											/>
											<Button variant="outline" className="whitespace-nowrap gap-2" onClick={triggerImportMaterials} disabled={isImportingMaterials}>
												<Upload className="h-4 w-4" />
												{isImportingMaterials ? "Importando..." : "Importar OC"}
											</Button>
											<input ref={importInputRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={handleImportMaterials} />
											<Button className="whitespace-nowrap gap-2" onClick={() => setIsAddOrderOpen(true)}>
												<Plus className="h-4 w-4" />
												Nueva orden
											</Button>
										</div>
									</div>
								</div>

								<div className="p-6 space-y-4">
									{filteredOrders.length === 0 ? (
										<div className="text-center py-10 text-muted-foreground text-sm">
											No se encontraron órdenes con el filtro aplicado
										</div>
									) : (
										<div className="space-y-3">
											{filteredOrders.map((order, idx) => {
												const itemsFiltered = getOrderItemsFiltered(order);
												const totalOrden = getOrderTotal(itemsFiltered);
												const isOpen = expandedOrders.has(order.id);
												return (
													<div key={order.id} className="border rounded-lg overflow-hidden">
														<button
															onClick={() => toggleOrderExpanded(order.id)}
															className="w-full text-left bg-muted/40 px-4 py-3 flex items-center justify-between hover:bg-muted/60 transition-colors"
														>
															<div className="flex flex-col sm:flex-row sm:items-center gap-3">
																<div className="font-semibold">N° de orden: {order.nroOrden}</div>
																<div className="text-sm text-muted-foreground">Solicitante: {order.solicitante}</div>
																<div className="text-sm text-muted-foreground">Gestor: {order.gestor}</div>
																<div className="text-sm text-muted-foreground">Proveedor: {order.proveedor}</div>
															</div>
															<div className="text-sm font-semibold font-mono">
																$ {totalOrden.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
															</div>
														</button>
														<motion.div
															initial={false}
															animate={{ height: isOpen ? 'auto' : 0, opacity: isOpen ? 1 : 0 }}
															transition={{ duration: 0.25 }}
															className="overflow-hidden"
														>
															<div className="p-4 space-y-4">
																<div className="flex items-center justify-between gap-3 flex-wrap">
																	<div className="text-sm text-muted-foreground">
																		{order.items.length} ítems en la orden
																	</div>
																	<div className="w-full sm:w-auto flex items-center gap-3">
																		{(() => {
																			const info = orderDocPaths[order.id];
																			return (
																				<button
																					type="button"
																					className="text-xs underline text-primary whitespace-nowrap"
																					onClick={() => {
																						setQueryParams({ tab: 'documentos' });
																						console.log('info', info);
																						if (info) {
																							setDocPathSegments(info.segments);
																							setPendingOpenDoc({ segments: info.segments, name: info.name, mime: info.mime });
																							void previewFile(info.name, undefined, info.segments);
																						} else {
																							// Fallback: try materiales folder and open first file if present
																							const fallbackSegs = ['materiales'];
																							setDocPathSegments(fallbackSegs);
																							setPendingAutoOpen({ segments: fallbackSegs });
																						}
																					}}
																				>
																					{info ? 'Ver documento' : 'Ver documentos'}
																				</button>
																			);
																		})()}


																		<Input
																			placeholder="Filtrar materiales de esta orden"
																			value={orderFilters[order.id] ?? ""}
																			onChange={(e) => setOrderFilter(order.id, e.target.value)}
																		/>
																	</div>
																</div>

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
																			{itemsFiltered.map((it, iidx) => (
																				<motion.tr
																					key={it.id}
																					initial={{ opacity: 0, y: 8 }}
																					animate={{ opacity: 1, y: 0 }}
																					transition={{ delay: (idx * 0.03) + (iidx * 0.02) }}
																					className="border-b last:border-0 hover:bg-muted/30 transition-colors"
																				>
																					<td className="py-3 px-4">{it.cantidad.toLocaleString('es-AR')}</td>
																					<td className="py-3 px-4">{it.unidad}</td>
																					<td className="py-3 px-4">{it.material}</td>
																					<td className="py-3 px-4 text-right font-mono">$ {it.precioUnitario.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
																					<td className="py-3 px-4 text-right font-mono">$ {(it.precioUnitario * it.cantidad).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
																				</motion.tr>
																			))}
																		</tbody>
																	</table>
																</div>

																<div className="flex justify-end items-center p-4 rounded-lg bg-muted/40 border">
																	<span className="mr-3 text-sm text-muted-foreground">Total de la orden</span>
																	<span className="text-lg font-bold font-mono">$ {totalOrden.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
																</div>
															</div>
															{/* Import preview dialog */}
															<Dialog open={isImportPreviewOpen} onOpenChange={setIsImportPreviewOpen}>
																<DialogContent className="max-w-4xl">
																	<DialogHeader>
																		<DialogTitle>Revisar orden importada</DialogTitle>
																	</DialogHeader>
																	{/* link to document removed in preview: requested only in table */}
																	{importPreviewOrder && (
																		<form onSubmit={async (ev) => {
																			ev.preventDefault();
																			if (!obraId) return;
																			try {
																				const normalizedItems = importPreviewOrder.items
																					.filter((it) => (it.material?.trim() ?? '').length > 0 && Number(it.cantidad) > 0)
																					.map((it) => ({
																						cantidad: Number(it.cantidad) || 0,
																						unidad: it.unidad.trim(),
																						material: it.material.trim(),
																						precioUnitario: Number(it.precioUnitario) || 0,
																					}));
																				const res = await fetch(`/api/obras/${obraId}/materials`, {
																					method: 'POST',
																					headers: { 'Content-Type': 'application/json' },
																					body: JSON.stringify({
																						nroOrden: importPreviewOrder.nroOrden.trim() || undefined,
																						solicitante: importPreviewOrder.solicitante.trim() || undefined,
																						gestor: importPreviewOrder.gestor.trim() || undefined,
																						proveedor: importPreviewOrder.proveedor.trim() || undefined,
																						items: normalizedItems,
																						docBucket: 'obra-documents',
																						docPath: (lastUploadedDocRef.current ? `${String(obraId)}/${lastUploadedDocRef.current.segments.join('/')}/${lastUploadedDocRef.current.name}` : undefined),
																					}),
																				});
																				if (!res.ok) throw new Error((await res.json()).error || 'No se pudo guardar');
																				const data = await res.json();
																				await refreshMaterialOrders();
																				if (lastUploadedDocRef.current && data?.order?.id) {
																					setOrderDocPaths((prev) => ({ ...prev, [String(data.order.id)]: lastUploadedDocRef.current! }));
																				}
																				setIsImportPreviewOpen(false);
																				setImportPreviewOrder(null);
																				lastUploadedDocRef.current = null;
																				toast.success('Orden guardada');
																			} catch (saveErr) {
																				console.error(saveErr);
																				toast.error(saveErr instanceof Error ? saveErr.message : 'No se pudo guardar');
																			}
																		}} className="space-y-4">
																			<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
																				<div>
																					<label className="block text-sm font-medium mb-1">Nº de orden</label>
																					<Input value={importPreviewOrder.nroOrden} onChange={(e) => setImportPreviewOrder((prev) => prev ? { ...prev, nroOrden: e.target.value } : prev)} placeholder="OC-000X" />
																				</div>
																				<div>
																					<label className="block text-sm font-medium mb-1">Solicitante</label>
																					<Input value={importPreviewOrder.solicitante} onChange={(e) => setImportPreviewOrder((prev) => prev ? { ...prev, solicitante: e.target.value } : prev)} placeholder="Nombre del solicitante" />
																				</div>
																				<div>
																					<label className="block text-sm font-medium mb-1">Gestor</label>
																					<Input value={importPreviewOrder.gestor} onChange={(e) => setImportPreviewOrder((prev) => prev ? { ...prev, gestor: e.target.value } : prev)} placeholder="Nombre del gestor" />
																				</div>
																				<div>
																					<label className="block text-sm font-medium mb-1">Proveedor</label>
																					<Input value={importPreviewOrder.proveedor} onChange={(e) => setImportPreviewOrder((prev) => prev ? { ...prev, proveedor: e.target.value } : prev)} placeholder="Proveedor" />
																				</div>
																			</div>

																			<div className="overflow-x-auto rounded-lg border">
																				<table className="w-full text-sm">
																					<thead className="bg-muted/50">
																						<tr>
																							<th className="text-left font-medium py-2 px-3 border-b">Cantidad</th>
																							<th className="text-left font-medium py-2 px-3 border-b">Unidad</th>
																							<th className="text-left font-medium py-2 px-3 border-b">Material</th>
																							<th className="text-right font-medium py-2 px-3 border-b">Precio unitario</th>
																							<th className="py-2 px-3 border-b" />
																						</tr>
																					</thead>
																					<tbody>
																						{importPreviewOrder.items.map((it, i) => (
																							<tr key={i} className="border-b last:border-0">
																								<td className="py-2 px-3 min-w-[110px]"><Input type="number" step="0.01" value={it.cantidad} onChange={(e) => setImportPreviewOrder((prev) => { if (!prev) return prev; const items = [...prev.items]; items[i] = { ...items[i], cantidad: e.target.value }; return { ...prev, items }; })} placeholder="0" /></td>
																								<td className="py-2 px-3 min-w-[110px]"><Input type="text" value={it.unidad} onChange={(e) => setImportPreviewOrder((prev) => { if (!prev) return prev; const items = [...prev.items]; items[i] = { ...items[i], unidad: e.target.value }; return { ...prev, items }; })} placeholder="u / m / m²" /></td>
																								<td className="py-2 px-3 min-w-[220px]"><Input type="text" value={it.material} onChange={(e) => setImportPreviewOrder((prev) => { if (!prev) return prev; const items = [...prev.items]; items[i] = { ...items[i], material: e.target.value }; return { ...prev, items }; })} placeholder="Descripción" /></td>
																								<td className="py-2 px-3 min-w-[160px]"><Input className="text-right" type="number" step="0.01" value={it.precioUnitario} onChange={(e) => setImportPreviewOrder((prev) => { if (!prev) return prev; const items = [...prev.items]; items[i] = { ...items[i], precioUnitario: e.target.value }; return { ...prev, items }; })} placeholder="0.00" /></td>
																								<td className="py-2 px-3 text-right">
																									<Button type="button" variant="ghost" onClick={() => setImportPreviewOrder((prev) => { if (!prev) return prev; const items = prev.items.slice(); items.splice(i, 1); return { ...prev, items: items.length ? items : [{ cantidad: '', unidad: '', material: '', precioUnitario: '' }] }; })}>Eliminar</Button>
																								</td>
																							</tr>
																						))}
																					</tbody>
																				</table>
																			</div>
																			<DialogFooter>
																				<Button type="button" variant="outline" onClick={() => { setIsImportPreviewOpen(false); setImportPreviewOrder(null); lastUploadedDocRef.current = null; }}>Cancelar</Button>
																				<Button type="submit" className="min-w-[140px]">Guardar</Button>
																			</DialogFooter>
																		</form>
																	)}
																</DialogContent>
															</Dialog>
														</motion.div>
													</div>
												);
											})}
										</div>
									)}

									<Dialog open={isAddOrderOpen} onOpenChange={setIsAddOrderOpen}>
										<DialogContent>
											<DialogHeader>
												<DialogTitle>Nueva orden de materiales</DialogTitle>
											</DialogHeader>
											<form onSubmit={handleCreateOrder} className="space-y-4">
												<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
													<div>
														<label className="block text-sm font-medium mb-1">Nº de orden</label>
														<Input value={newOrder.nroOrden} onChange={(e) => updateNewOrderMeta("nroOrden", e.target.value)} placeholder="OC-0003" />
													</div>
													<div>
														<label className="block text-sm font-medium mb-1">Solicitante</label>
														<Input value={newOrder.solicitante} onChange={(e) => updateNewOrderMeta("solicitante", e.target.value)} placeholder="Nombre del solicitante" />
													</div>
													<div>
														<label className="block text-sm font-medium mb-1">Gestor</label>
														<Input value={newOrder.gestor} onChange={(e) => updateNewOrderMeta("gestor", e.target.value)} placeholder="Nombre del gestor" />
													</div>
													<div>
														<label className="block text-sm font-medium mb-1">Proveedor</label>
														<Input value={newOrder.proveedor} onChange={(e) => updateNewOrderMeta("proveedor", e.target.value)} placeholder="Proveedor" />
													</div>
												</div>

												<div className="space-y-2">
													<div className="flex items-center justify-between">
														<h3 className="text-sm font-semibold">Ítems</h3>
														<Button type="button" variant="outline" className="h-8 px-2 text-xs" onClick={addNewOrderItem}>Agregar ítem</Button>
													</div>
													<div className="overflow-x-auto rounded-lg border">
														<table className="w-full text-sm">
															<thead className="bg-muted/50">
																<tr>
																	<th className="text-left font-medium py-2 px-3 border-b">Cantidad</th>
																	<th className="text-left font-medium py-2 px-3 border-b">Unidad</th>
																	<th className="text-left font-medium py-2 px-3 border-b">Material</th>
																	<th className="text-right font-medium py-2 px-3 border-b">Precio unitario</th>
																	<th className="py-2 px-3 border-b" />
																</tr>
															</thead>
															<tbody>
																{newOrder.items.map((it, i) => (
																	<tr key={i} className="border-b last:border-0">
																		<td className="py-2 px-3 min-w-[110px]"><Input type="number" step="0.01" value={it.cantidad} onChange={(e) => updateNewOrderItem(i, "cantidad", e.target.value)} placeholder="0" /></td>
																		<td className="py-2 px-3 min-w-[110px]"><Input type="text" value={it.unidad} onChange={(e) => updateNewOrderItem(i, "unidad", e.target.value)} placeholder="u / m / m²" /></td>
																		<td className="py-2 px-3 min-w-[220px]"><Input type="text" value={it.material} onChange={(e) => updateNewOrderItem(i, "material", e.target.value)} placeholder="Descripción" /></td>
																		<td className="py-2 px-3 min-w-[160px]"><Input className="text-right" type="number" step="0.01" value={it.precioUnitario} onChange={(e) => updateNewOrderItem(i, "precioUnitario", e.target.value)} placeholder="0.00" /></td>
																		<td className="py-2 px-3 text-right">
																			<Button type="button" variant="ghost" onClick={() => removeNewOrderItem(i)}>Eliminar</Button>
																		</td>
																	</tr>
																))}
															</tbody>
														</table>
													</div>
												</div>

												<DialogFooter>
													<Button type="button" variant="outline" onClick={() => { setIsAddOrderOpen(false); setNewOrder({ ...emptyNewOrderForm }); }}>Cancelar</Button>
													<Button type="submit" className="min-w-[140px]">Guardar orden</Button>
												</DialogFooter>
											</form>
										</DialogContent>
									</Dialog>
								</div>
							</motion.section>
						</TabsContent>

						{/* OLD - Documentos Tab - Removed and merged into FileManager above */}
						<TabsContent value="documentos-old" className="space-y-6 hidden">
							<motion.section
								initial={{ opacity: 0, y: 20 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ duration: 0.4 }}
								className="rounded-lg border bg-card shadow-sm overflow-hidden"
							>
								<div className="bg-muted/50 px-6 py-4 border-b">
									<div className="flex items-center justify-between gap-4 flex-wrap">
										<div className="flex items-center gap-2">
											<FileText className="h-5 w-5 text-primary" />
											<h2 className="text-lg font-semibold">Documentos</h2>
										</div>
										<div className="flex items-center gap-2">
											<Button variant="outline" className="gap-2" onClick={() => setIsCreateFolderOpen(true)}>
												<FolderPlus className="h-4 w-4" />
												Nueva carpeta
											</Button>
											<Button className="gap-2" onClick={triggerUpload}>
												<Upload className="h-4 w-4" />
												Subir archivos
											</Button>
											<input ref={uploadInputRef} type="file" className="hidden" multiple onChange={handleUploadFiles} />
										</div>
									</div>

									<div className="px-6 pt-4">
										{/* Breadcrumbs */}
										<div className="flex items-center flex-wrap gap-1 text-sm">
											<button className="text-muted-foreground hover:text-foreground transition" onClick={() => setDocPathSegments([])}>Obra</button>
											{docPathSegments.map((seg, i) => (
												<div key={`${seg}-${i}`} className="flex items-center gap-1">
													<span className="text-muted-foreground">/</span>
													<button className="text-muted-foreground hover:text-foreground transition" onClick={() => goToIndex(i + 1)}>{seg}</button>
												</div>
											))}
										</div>

										<div className="p-6 pt-4 space-y-4">
											{docsError && (
												<div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-destructive text-sm">{docsError}</div>
											)}
											{docsLoading ? (
												<div className="flex items-center justify-center py-12">
													<div className="space-y-2 text-center">
														<div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto" />
														<p className="text-sm text-muted-foreground">Cargando...</p>
													</div>
												</div>
											) : (
												<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
													{(docItems || []).sort((a, b) => {
														const aIsFolder = !a.metadata;
														const bIsFolder = !b.metadata;
														if (aIsFolder !== bIsFolder) return aIsFolder ? -1 : 1;
														return a.name.localeCompare(b.name);
													})
														.map((item, idx) => {
															const isFolder = !item.metadata;
															const mime = item.metadata?.mimetype;
															const isImage = typeof mime === 'string' && mime.startsWith('image/');
															return (
																<motion.button
																	key={`${item.name}-${idx}`}
																	initial={{ opacity: 0, y: 8 }}
																	animate={{ opacity: 1, y: 0 }}
																	transition={{ delay: idx * 0.02 }}
																	onClick={() => {
																		if (isFolder) {
																			goToFolder(item.name);
																		} else {
																			void previewFile(item.name, mime);
																		}
																	}}
																	className="group rounded-md border p-3 text-left hover:bg-muted/40 transition-colors"
																>
																	<div className="flex items-center justify-center h-16 mb-2 bg-muted/30 rounded-sm">
																		{isFolder ? (
																			<Folder className="h-7 w-7 text-muted-foreground" />
																		) : isImage ? (
																			<ImageIcon className="h-7 w-7 text-muted-foreground" />
																		) : (
																			<FileIcon className="h-7 w-7 text-muted-foreground" />
																		)}
																	</div>
																	<div className="truncate text-sm font-medium">{item.name}</div>
																	{!isFolder && (
																		<div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
																			<span>{item.metadata?.size ? `${(item.metadata.size / 1024).toFixed(1)} KB` : ''}</span>
																			<button type="button" className="opacity-70 hover:opacity-100" onClick={(ev) => { ev.stopPropagation(); void downloadFile(item.name); }}>
																				<Download className="h-4 w-4" />
																			</button>
																		</div>
																	)}
																</motion.button>
															);
														})}
												</div>
											)}
										</div>
									</div>
								</div>
							</motion.section>

							{/* Create folder dialog */}
							<Dialog open={isCreateFolderOpen} onOpenChange={setIsCreateFolderOpen}>
								<DialogContent>
									<DialogHeader>
										<DialogTitle>Nueva carpeta</DialogTitle>
									</DialogHeader>
									<form onSubmit={handleCreateFolder} className="space-y-4">
										<div>
											<label className="block text-sm font-medium mb-1">Nombre de la carpeta</label>
											<Input value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="Carpeta" />
										</div>
										<DialogFooter>
											<Button type="button" variant="outline" onClick={() => setIsCreateFolderOpen(false)}>Cancelar</Button>
											<Button type="submit" className="min-w-[120px]">Crear</Button>
										</DialogFooter>
									</form>
								</DialogContent>
							</Dialog>

							{/* Preview dialog */}
							<Dialog open={!!preview} onOpenChange={(open) => { if (!open) { setPreview(null); setQueryParams({ doc: null }); } }}>
								<DialogContent className="max-w-3xl">
									<DialogHeader>
										<DialogTitle>{preview?.name}</DialogTitle>
									</DialogHeader>
									<div className="p-2">
										{preview?.url ? (
											<img src={preview.url} alt={preview.name} className="max-h-[70vh] w-auto rounded-md" />
										) : null}
									</div>
								</DialogContent>
							</Dialog>
						</TabsContent>

					</Tabs>
				)}
			</div>
		</div >
	);
}
