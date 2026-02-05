'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState, startTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useForm } from "@tanstack/react-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { obraSchema, type Obra } from "../schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useParams } from "next/navigation";
import { Pencil, Eye, StickyNote, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import { ExcelPageTabs } from "@/components/excel-page-tabs";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ObraDocumentsTab } from "./tabs/documents-tab";
// import { ObraCertificatesTab } from "./tabs/certificates-tab";
import { ObraFlujoTab } from "./tabs/flujo-tab";
import { ObraGeneralTab } from "./tabs/general-tab";
import { prefetchDocuments } from "./tabs/file-manager/hooks/useDocumentsStore";

import type {
	Certificate,
	NewCertificateFormState,
	MaterialOrder,
	MaterialItem,
	ObraRole,
	ObraUser,
	ObraUserRole,
	FlujoAction,
} from "./tabs/types";

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

const DOCUMENTS_BUCKET = "obra-documents";

// Query functions for React Query caching
async function fetchObraDetail(obraId: string): Promise<Obra> {
	const response = await fetch(`/api/obras/${obraId}`);
	if (!response.ok) {
		const result = await response.json().catch(() => ({}));
		throw new Error(result.error ?? "No se pudo cargar la obra");
	}
	const data = await response.json();
	return data.obra as Obra;
}

async function fetchMemoriaNotes(obraId: string): Promise<MemoriaNote[]> {
	const res = await fetch(`/api/obras/${obraId}/memoria`);
	if (!res.ok) return [];
	const out = await res.json();
	const items = Array.isArray(out?.notes) ? out.notes : [];
	return items.map((n: any) => ({
		id: String(n.id),
		text: String(n.text ?? ""),
		createdAt: String(n.createdAt ?? n.created_at ?? ""),
		userId: String(n.userId ?? n.user_id ?? ""),
		userName: typeof n.userName === "string" ? n.userName : n.user_name ?? null,
	}));
}

async function fetchMaterialOrders(obraId: string): Promise<MaterialOrder[]> {
	const res = await fetch(`/api/obras/${obraId}/materials`);
	if (!res.ok) return [];
	const data = await res.json();
	const orders = (data?.orders || []) as Array<any>;
	return orders.map((o: any) => ({
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
}

async function fetchCertificates(obraId: string): Promise<{ certificates: Certificate[]; total: number }> {
	const response = await fetch(`/api/obras/${obraId}/certificates`);
	if (!response.ok) {
		throw new Error("Failed to load certificates");
	}
	const data = await response.json();
	return { certificates: data.certificates || [], total: data.total || 0 };
}

async function fetchObraRecipients(obraId: string): Promise<{ roles: ObraRole[]; users: ObraUser[]; userRoles: ObraUserRole[] }> {
	const res = await fetch(`/api/obra-recipients?obraId=${obraId}`);
	if (!res.ok) return { roles: [], users: [], userRoles: [] };
	const data = await res.json();
	return {
		roles: data.roles ?? [],
		users: data.users ?? [],
		userRoles: data.userRoles ?? [],
	};
}

async function fetchFlujoActions(obraId: string): Promise<FlujoAction[]> {
	const res = await fetch(`/api/flujo-actions?obraId=${obraId}`);
	if (!res.ok) throw new Error("Failed to load flujo actions");
	const data = await res.json();
	return data.actions || [];
}

async function fetchPendientes(obraId: string): Promise<PendingDoc[]> {
	const res = await fetch(`/api/obras/${obraId}/pendientes`);
	if (!res.ok) return [];
	const data = await res.json();
	return (data?.pendientes ?? []).map((p: any) => ({
		id: p.id as string,
		name: String(p.name ?? ""),
		poliza: String(p.poliza ?? ""),
		dueMode: (p.dueMode ?? "fixed") as "fixed" | "after_completion",
		dueDate: String(p.dueDate ?? ""),
		offsetDays: Number(p.offsetDays ?? 0),
		done: Boolean(p.done ?? false),
	}));
}

type MemoriaNote = {
	id: string;
	text: string;
	createdAt: string;
	userId: string;
	userName: string | null;
};

type PendingDoc = {
	id: string;
	name: string;
	poliza: string;
	dueMode: "fixed" | "after_completion";
	dueDate: string;
	offsetDays: number;
	done: boolean
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
	const queryClient = useQueryClient();
	const obraId = useMemo(() => {
		const raw = (params as Record<string, string | string[] | undefined>)?.obraId;
		if (Array.isArray(raw)) return raw[0];
		return raw;
	}, [params]);

	// Prefetch documents in background when page loads (before user navigates to documents tab)
	useEffect(() => {
		if (obraId && obraId !== "undefined") {
			// Fire and forget - don't block anything, just start loading in background
			prefetchDocuments(obraId);
		}
	}, [obraId]);

	// React Query hooks for cached data fetching
	// Core obra data - always fetch
	const obraQuery = useQuery({
		queryKey: ['obra', obraId],
		queryFn: () => fetchObraDetail(obraId!),
		enabled: !!obraId && obraId !== "undefined",
		staleTime: 5 * 60 * 1000,
	});

	// Memoria notes - always fetch (lightweight)
	const memoriaQuery = useQuery({
		queryKey: ['obra', obraId, 'memoria'],
		queryFn: () => fetchMemoriaNotes(obraId!),
		enabled: !!obraId && obraId !== "undefined",
		staleTime: 5 * 60 * 1000,
	});

	// Materials - always fetch (cached by React Query)
	const materialsQuery = useQuery({
		queryKey: ['obra', obraId, 'materials'],
		queryFn: () => fetchMaterialOrders(obraId!),
		enabled: !!obraId && obraId !== "undefined",
		staleTime: 5 * 60 * 1000,
	});

	// Certificates - always fetch (cached by React Query)
	const certificatesQuery = useQuery({
		queryKey: ['obra', obraId, 'certificates'],
		queryFn: () => fetchCertificates(obraId!),
		enabled: !!obraId && obraId !== "undefined",
		staleTime: 5 * 60 * 1000,
	});

	// Recipients - always fetch (cached by React Query)
	const recipientsQuery = useQuery({
		queryKey: ['obra', obraId, 'recipients'],
		queryFn: () => fetchObraRecipients(obraId!),
		enabled: !!obraId && obraId !== "undefined",
		staleTime: 10 * 60 * 1000, // Recipients change less often
	});

	// Flujo actions - always fetch (cached by React Query)
	const flujoActionsQuery = useQuery({
		queryKey: ['obra', obraId, 'flujo-actions'],
		queryFn: () => fetchFlujoActions(obraId!),
		enabled: !!obraId && obraId !== "undefined",
		staleTime: 5 * 60 * 1000,
	});

	// Pendientes - always fetch (cached by React Query)
	const pendientesQuery = useQuery({
		queryKey: ['obra', obraId, 'pendientes'],
		queryFn: () => fetchPendientes(obraId!),
		enabled: !!obraId && obraId !== "undefined",
		staleTime: 5 * 60 * 1000,
	});

	// Derived state from queries
	const isLoading = obraQuery.isLoading;
	const loadError = obraQuery.error?.message ?? null;
	const routeError = !obraId || obraId === "undefined" ? "Obra no encontrada" : null;
	const certificates = certificatesQuery.data?.certificates ?? [];
	const certificatesTotal = certificatesQuery.data?.total ?? 0;
	const certificatesLoading = certificatesQuery.isLoading;
	const memoriaNotes = memoriaQuery.data ?? [];
	const materialOrders = materialsQuery.data ?? [];
	const obraRoles = recipientsQuery.data?.roles ?? [];
	const obraUsers = recipientsQuery.data?.users ?? [];
	const obraUserRoles = recipientsQuery.data?.userRoles ?? [];
	const flujoActions = flujoActionsQuery.data ?? [];
	const isLoadingFlujoActions = flujoActionsQuery.isLoading;

	// Local state for UI
	const [isAddingCertificate, setIsAddingCertificate] = useState(false);
	const [newCertificate, setNewCertificate] = useState<NewCertificateFormState>(
		() => ({ ...certificateFormDefault })
	);
	const [createCertificateError, setCreateCertificateError] = useState<string | null>(null);
	const [isCreatingCertificate, setIsCreatingCertificate] = useState(false);
	const mountedRef = useRef(true);
	const [currentUserId, setCurrentUserId] = useState<string | null>(null);
	const [isGeneralTabEditMode, setIsGeneralTabEditMode] = useState(false);
	const [initialFormValues, setInitialFormValues] = useState<Obra>(emptyObra);

	const [isMemoriaOpen, setIsMemoriaOpen] = useState(false);
	const [memoriaDraft, setMemoriaDraft] = useState("");

	const [pendingDocs, setPendingDocs] = useState<PendingDoc[]>([
		{ id: "doc-1", name: "", poliza: "", dueMode: "fixed", dueDate: "", offsetDays: 0, done: false },
		{ id: "doc-2", name: "", poliza: "", dueMode: "fixed", dueDate: "", offsetDays: 0, done: false },
		{ id: "doc-3", name: "", poliza: "", dueMode: "fixed", dueDate: "", offsetDays: 0, done: false },
	]);

	const [selectedRecipientUserId, setSelectedRecipientUserId] = useState<string>("");
	const [selectedRecipientRoleId, setSelectedRecipientRoleId] = useState<string>("");

	const [isSavingFlujoAction, setIsSavingFlujoAction] = useState(false);
	const [isAddingFlujoAction, setIsAddingFlujoAction] = useState(false);
	const [newFlujoAction, setNewFlujoAction] = useState<Partial<FlujoAction>>({
		action_type: 'email',
		timing_mode: 'immediate',
		offset_value: 1,
		offset_unit: 'days',
		title: '',
		message: '',
		recipient_user_ids: [],
		notification_types: ["in_app", "email"],
		enabled: true,
	});

	const [globalMaterialsFilter, setGlobalMaterialsFilter] = useState("");
	const [expandedOrders, setExpandedOrders] = useState<Set<string>>(() => new Set());
	const [orderFilters, setOrderFilters] = useState<Record<string, string>>(() => ({}));
const router = useRouter();
		const pathname = usePathname();
		const searchParams = useSearchParams();
		
		// Use local state for immediate tab switching, sync to URL in background
		const initialTab = searchParams?.get("tab") || "general";
		const [activeTab, setActiveTab] = useState(initialTab);
		
		// Sync URL when tab changes (low priority, non-blocking)
		const setQueryParams = useCallback((patch: Record<string, string | null | undefined>) => {
			const params = new URLSearchParams(searchParams?.toString() || "");
			for (const [key, value] of Object.entries(patch)) {
				if (value == null || value === "") params.delete(key); else params.set(key, value);
			}
			const qs = params.toString();
			// Use startTransition to mark URL update as low-priority
			startTransition(() => {
				router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
			});
		}, [router, pathname, searchParams]);
		
		// Handle tab change: update local state immediately, sync URL in background
		const handleTabChange = useCallback((value: string) => {
			setActiveTab(value); // Immediate state update
			setQueryParams({ tab: value }); // Background URL sync
		}, [setQueryParams]);

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

		queryClient.setQueryData<MaterialOrder[]>(
			['obra', obraId, 'materials'],
			(prev = []) => [order, ...prev]
		);
		setOrderFilters((prev) => ({ ...prev, [order.id]: "" }));
		setExpandedOrders((prev) => {
			const next = new Set(prev);
			next.add(order.id);
			return next;
		});
		setIsAddOrderOpen(false);
		setNewOrder({ ...emptyNewOrderForm });
	}, [newOrder, obraId, queryClient]);

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

	// Memoize normalize function to avoid recreation on every render
	const normalize = useCallback((v: string) => v.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase(), []);

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
	}, [materialOrders, globalMaterialsFilter, normalize]);

	const getOrderItemsFiltered = useCallback((order: MaterialOrder): MaterialItem[] => {
		const of = orderFilters[order.id]?.trim() ?? "";
		if (!of) return order.items;
		const q = normalize(of);
		return order.items.filter((it) =>
			normalize(it.material).includes(q) || normalize(it.unidad).includes(q)
		);
	}, [orderFilters, normalize]);

	const getOrderTotal = useCallback((items: MaterialItem[]) => {
		return items.reduce((acc, it) => acc + it.cantidad * it.precioUnitario, 0);
	}, []);

	// Invalidate material orders cache to trigger refetch
	const refreshMaterialOrders = useCallback(() => {
		queryClient.invalidateQueries({ queryKey: ['obra', obraId, 'materials'] });
	}, [obraId, queryClient]);

	const form = useForm({
		defaultValues: emptyObra,
		validators: {
			onChange: obraSchema,
		},
		onSubmit: async ({ value }) => {
			if (!obraId || obraId === "undefined") {
				toast.error("Obra no encontrada");
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

				// Invalidate cache and refetch
				queryClient.invalidateQueries({ queryKey: ['obra', obraId] });
				queryClient.invalidateQueries({ queryKey: ['obras-dashboard'] });
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

	// Helper to check if a field has unsaved changes
	const isFieldDirty = useCallback((fieldName: keyof Obra) => {
		const currentValue = form.state.values[fieldName];
		const initialValue = initialFormValues[fieldName];
		return currentValue !== initialValue;
	}, [form.state.values, initialFormValues]);

	// Helper to check if ANY field has unsaved changes
	const hasUnsavedChanges = useCallback(() => {
		return (Object.keys(form.state.values) as (keyof Obra)[]).some((key) => {
			return isFieldDirty(key);
		});
	}, [form.state.values, isFieldDirty]);

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

			// Store initial values for dirty tracking
			setInitialFormValues(normalized);
		},
		[form]
	);

	// Apply obra data to form when it loads
	useEffect(() => {
		if (obraQuery.data) {
			applyObraToForm(obraQuery.data);
		}
	}, [obraQuery.data, applyObraToForm]);

	// Apply pendientes data when it loads
	useEffect(() => {
		if (pendientesQuery.data && pendientesQuery.data.length > 0) {
			setPendingDocs(pendientesQuery.data);
		}
	}, [pendientesQuery.data]);

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

	// Pendientes are loaded via React Query (pendientesQuery) - no manual fetch needed

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

	// Recipients are now loaded via React Query (recipientsQuery) - no manual effect needed

	const saveFlujoAction = useCallback(async () => {
		if (!obraId || obraId === "undefined") return;
		if (!newFlujoAction.title) {
			toast.error("El título es requerido");
			return;
		}

		setIsSavingFlujoAction(true);

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

			// Get the created action from response
			const data = await res.json();
			const createdAction = data.action as FlujoAction;

			// Optimistic update - add the new action immediately
			if (createdAction) {
				queryClient.setQueryData<FlujoAction[]>(
					['obra', obraId, 'flujo-actions'],
					(prev = []) => [...prev, createdAction]
				);
			}

			// Reset form and close immediately
			setNewFlujoAction({
				action_type: 'email',
				timing_mode: 'immediate',
				offset_value: 1,
				offset_unit: 'days',
				title: '',
				message: '',
				recipient_user_ids: [],
				notification_types: ["in_app", "email"],
				enabled: true,
			});
			setSelectedRecipientUserId("");
			setSelectedRecipientRoleId("");
			setIsAddingFlujoAction(false);
			toast.success("Acción de flujo creada");
		} catch (err) {
			console.error("Error saving flujo action:", err);
			toast.error("No se pudo guardar la acción de flujo");
		} finally {
			setIsSavingFlujoAction(false);
		}
	}, [obraId, newFlujoAction, obraUserRoles, queryClient, selectedRecipientRoleId, selectedRecipientUserId]);

	const deleteFlujoAction = useCallback(async (actionId: string) => {
		if (!obraId || obraId === "undefined") return;

		try {
			const res = await fetch(`/api/flujo-actions?id=${actionId}`, {
				method: "DELETE",
			});
			if (!res.ok) throw new Error("Failed to delete flujo action");
			queryClient.setQueryData<FlujoAction[]>(
				['obra', obraId, 'flujo-actions'],
				(prev = []) => prev.filter((a) => a.id !== actionId)
			);
			toast.success("Acción de flujo eliminada");
		} catch (err) {
			console.error("Error deleting flujo action:", err);
			toast.error("No se pudo eliminar la acción de flujo");
		}
	}, [obraId, queryClient]);

	const toggleFlujoAction = useCallback(async (actionId: string, enabled: boolean) => {
		if (!obraId || obraId === "undefined") return;

		try {
			const res = await fetch("/api/flujo-actions", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ id: actionId, enabled }),
			});
			if (!res.ok) throw new Error("Failed to toggle flujo action");
			queryClient.setQueryData<FlujoAction[]>(
				['obra', obraId, 'flujo-actions'],
				(prev = []) => prev.map((a) => (a.id === actionId ? { ...a, enabled } : a))
			);
			toast.success(enabled ? "Acción activada" : "Acción desactivada");
		} catch (err) {
			console.error("Error toggling flujo action:", err);
			toast.error("No se pudo actualizar la acción");
		}
	}, [obraId, queryClient]);

	const updateFlujoAction = useCallback(async (actionId: string, updates: Partial<FlujoAction>) => {
		if (!obraId || obraId === "undefined") return;

		try {
			// Convert snake_case to camelCase for API
			// Also convert empty strings to null for optional fields
			const apiPayload: Record<string, unknown> = { id: actionId };
			if (updates.title !== undefined) apiPayload.title = updates.title;
			if (updates.message !== undefined) apiPayload.message = updates.message || null;
			if (updates.timing_mode !== undefined) apiPayload.timingMode = updates.timing_mode;
			if (updates.offset_value !== undefined) apiPayload.offsetValue = updates.offset_value;
			if (updates.offset_unit !== undefined) apiPayload.offsetUnit = updates.offset_unit;
			if (updates.scheduled_date !== undefined) apiPayload.scheduledDate = updates.scheduled_date || null;
			if (updates.enabled !== undefined) apiPayload.enabled = updates.enabled;
			if (updates.notification_types !== undefined) apiPayload.notificationTypes = updates.notification_types;

			// Check if timing is being changed - need to reload to get new scheduled_for
			const timingChanged = updates.timing_mode !== undefined ||
				updates.offset_value !== undefined ||
				updates.offset_unit !== undefined ||
				updates.scheduled_date !== undefined;

			const res = await fetch("/api/flujo-actions", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(apiPayload),
			});
			if (!res.ok) throw new Error("Failed to update flujo action");

			// If timing changed, reload all actions to get updated scheduled_for
			// Otherwise just update locally
			if (timingChanged) {
				await queryClient.invalidateQueries({ queryKey: ['obra', obraId, 'flujo-actions'] });
			} else {
				queryClient.setQueryData<FlujoAction[]>(
					['obra', obraId, 'flujo-actions'],
					(prev = []) => prev.map((a) => (a.id === actionId ? { ...a, ...updates } : a))
				);
			}
			toast.success("Acción actualizada correctamente");
		} catch (err) {
			console.error("Error updating flujo action:", err);
			toast.error("No se pudo actualizar la acción");
		}
	}, [obraId, queryClient]);

	const refreshCertificates = useCallback(async () => {
		if (!obraId || obraId === "undefined") {
			return;
		}
		await queryClient.invalidateQueries({ queryKey: ['obra', obraId, 'certificates'] });
	}, [obraId, queryClient]);

	const handleCreateCertificate = useCallback(
		async (event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();

			if (!obraId || obraId === "undefined") {
				toast.error("Obra no encontrada");
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

	// Certificates are loaded via React Query (certificatesQuery) - no manual refetch on mount needed

	return (
		<div className="container max-w-full mx-auto px-4 pt-2">
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
				<div className="flex flex-col lg:flex-row lg:items-start gap-4 lg:gap-6">
					<div className="flex-1 min-w-0">
<Tabs
								value={activeTab}
								onValueChange={handleTabChange}
								className="space-y-4"
							>
							<div className="flex items-center justify-between mb-2 gap-2">
								<ExcelPageTabs />
								<div className="flex items-center gap-2">

									<motion.div
										initial={{ opacity: 0 }}
										animate={{ opacity: 1 }}
										className="flex justify-end "
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
													<Pencil className="h-4 w-4" />
													Modo Edición
												</>
											) : (
												<>
													<Eye className="h-4 w-4" />
													Modo Vista Previa
												</>
											)}
										</Button>
									</motion.div>
									<Button
										type="button"
										variant={isMemoriaOpen ? "default" : "outline"}
										size="sm"
										onClick={() => setIsMemoriaOpen((open) => !open)}
										className="gap-2"
									>
										<StickyNote className="h-4 w-4" />
										<span>Memoria</span>
									</Button>
								</div>
							</div>

							<ObraGeneralTab
								form={form}
								isGeneralTabEditMode={isGeneralTabEditMode}
								hasUnsavedChanges={hasUnsavedChanges}
								isFieldDirty={isFieldDirty}
								applyObraToForm={applyObraToForm}
								initialFormValues={initialFormValues}
								getErrorMessage={getErrorMessage}
							/>

							<ObraFlujoTab
								isAddingFlujoAction={isAddingFlujoAction}
								setIsAddingFlujoAction={setIsAddingFlujoAction}
								isSavingFlujoAction={isSavingFlujoAction}
								newFlujoAction={newFlujoAction}
								setNewFlujoAction={setNewFlujoAction}
								selectedRecipientUserId={selectedRecipientUserId}
								setSelectedRecipientUserId={setSelectedRecipientUserId}
								selectedRecipientRoleId={selectedRecipientRoleId}
								setSelectedRecipientRoleId={setSelectedRecipientRoleId}
								obraUsers={obraUsers}
								obraRoles={obraRoles}
								obraUserRoles={obraUserRoles}
								saveFlujoAction={saveFlujoAction}
								toggleFlujoAction={toggleFlujoAction}
								deleteFlujoAction={deleteFlujoAction}
								updateFlujoAction={updateFlujoAction}
								flujoActions={flujoActions}
								isLoadingFlujoActions={isLoadingFlujoActions}
							/>

							{/* <ObraCertificatesTab
								certificates={certificates}
								certificatesTotal={certificatesTotal}
								certificatesLoading={certificatesLoading}
								isAddingCertificate={isAddingCertificate}
								isCreatingCertificate={isCreatingCertificate}
								createCertificateError={createCertificateError}
								newCertificate={newCertificate}
								handleToggleAddCertificate={handleToggleAddCertificate}
								handleCreateCertificate={handleCreateCertificate}
								handleNewCertificateChange={handleNewCertificateChange}
							/> */}

							<ObraDocumentsTab
								obraId={obraId}
								materialOrders={materialOrders}
								refreshMaterialOrders={refreshMaterialOrders}
							/>

						</Tabs>
					</div>
					<AnimatePresence>
						{isMemoriaOpen && (
							<motion.aside
								initial={{ x: 320, opacity: 0 }}
								animate={{ x: 0, opacity: 1 }}
								exit={{ x: 320, opacity: 0 }}
								transition={{ duration: 0.25, ease: "easeOut" }}
								className="w-full lg:w-80 shrink-0 rounded-lg border bg-card shadow-sm p-4 flex flex-col gap-4"
							>
								<div className="flex items-center justify-between gap-2">
									<div className="flex items-center gap-2">
										<StickyNote className="h-4 w-4 text-primary" />
										<h2 className="text-sm font-semibold">Memoria descriptiva de la obra</h2>
									</div>
									<Button
										type="button"
										variant="ghost"
										size="icon"
										onClick={() => setIsMemoriaOpen(false)}
									>
										<X className="h-4 w-4" />
									</Button>
								</div>

								<div className="space-y-2">
									<label className="text-xs font-medium text-muted-foreground">
										Nueva nota
									</label>
									<Textarea
										value={memoriaDraft}
										onChange={(e) => setMemoriaDraft(e.target.value)}
										placeholder="Escribe aquí notas, decisiones o contexto importante sobre esta obra..."
										className="min-h-[80px] text-sm"
									/>
									<div className="flex justify-end">
										<Button
											type="button"
											size="sm"
											disabled={!memoriaDraft.trim()}
											onClick={async () => {
												const text = memoriaDraft.trim();
												if (!text || !obraId || obraId === "undefined") return;
												try {
													const res = await fetch(`/api/obras/${obraId}/memoria`, {
														method: "POST",
														headers: { "Content-Type": "application/json" },
														body: JSON.stringify({ text }),
													});
													if (!res.ok) {
														const out = await res.json().catch(() => ({} as any));
														throw new Error(out?.error || "No se pudo guardar la nota");
													}
													const out = await res.json();
													const note = out?.note;
													if (note) {
														const newNote: MemoriaNote = {
															id: String(note.id),
															text: String(note.text ?? ""),
															createdAt: String(note.createdAt ?? note.created_at ?? ""),
															userId: String(note.userId ?? note.user_id ?? ""),
															userName:
																typeof note.userName === "string"
																	? note.userName
																	: note.user_name ?? null,
														};
														queryClient.setQueryData<MemoriaNote[]>(
															['obra', obraId, 'memoria'],
															(prev = []) => [newNote, ...prev]
														);
													}
													setMemoriaDraft("");
												} catch (err) {
													console.error(err);
													const message =
														err instanceof Error ? err.message : "No se pudo guardar la nota";
													toast.error(message);
												}
											}}
										>
											Guardar nota
										</Button>
									</div>
								</div>

								<Separator />

								<div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
									{memoriaNotes.length === 0 ? (
										<p className="text-xs text-muted-foreground">
											Todavía no hay notas para esta obra. Usa este espacio para registrar decisiones,
											aclaraciones o contexto importante.
										</p>
									) : (
										memoriaNotes.map((note) => (
											<div
												key={note.id}
												className="rounded-md border bg-background/60 px-3 py-2 text-xs space-y-1"
											>
												<div className="flex items-center justify-between gap-2">
													<div className="flex items-center gap-2">
														<div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-semibold text-primary capitalize">
															{(note.userName || "?")
																.split(" ")
																.filter(Boolean)
																.slice(0, 2)
																.map((part) => part[0])
																.join("")}
														</div>
														<div className="flex flex-col">
															<span className="font-medium text-foreground">
																{note.userName || "Usuario"}
															</span>
															{currentUserId === note.userId && (
																<span className="text-[10px] text-muted-foreground">
																	Tú
																</span>
															)}
														</div>
													</div>
													<p className="text-[10px] text-muted-foreground">
														{new Date(note.createdAt).toLocaleString()}
													</p>
												</div>
												<p className="whitespace-pre-wrap text-foreground">
													{note.text}
												</p>
											</div>
										))
									)}
								</div>
							</motion.aside>
						)}
					</AnimatePresence>
				</div>
			)}
		</div>
	);
}
