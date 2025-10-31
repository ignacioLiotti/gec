'use client';

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "@tanstack/react-form";
import { obraSchema, type Obra } from "../schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
	TrendingUp
} from "lucide-react";
import { motion } from "framer-motion";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";

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

	type PendingDoc = { id: string; name: string; dueDate: string; done: boolean };
	const [pendingDocs, setPendingDocs] = useState<PendingDoc[]>([
		{ id: "doc-1", name: "", dueDate: "", done: false },
		{ id: "doc-2", name: "", dueDate: "", done: false },
		{ id: "doc-3", name: "", dueDate: "", done: false },
	]);

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

	const updatePendingDoc = useCallback((index: number, field: keyof PendingDoc, value: string | boolean) => {
		setPendingDocs((prev) => {
			const next = [...prev];
			next[index] = { ...next[index], [field]: value } as PendingDoc;
			return next;
		});
	}, []);

	const scheduleReminderForDoc = useCallback(async (doc: PendingDoc) => {
		if (!obraId || obraId === "undefined") return;
		if (!doc.dueDate) return;
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
				}),
			});
			if (!res.ok) throw new Error("Failed to schedule");
			toast.success("Recordatorio programado para el día anterior al vencimiento");
		} catch (err) {
			console.error(err);
			toast.error("No se pudo programar el recordatorio");
		}
	}, [obraId, currentUserId]);

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
		<div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
			<div className="container max-w-7xl mx-auto p-6 space-y-6">
				{/* Header */}
				<motion.div 
					initial={{ opacity: 0, y: -20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.3 }}
					className="flex items-center justify-between"
				>
					<div className="space-y-1">
						<Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
							<Link href="/excel" className="gap-2">
								<ArrowLeft className="h-4 w-4" />
								Volver al listado
							</Link>
						</Button>
						<h1 className="text-4xl font-bold tracking-tight">Detalle de Obra</h1>
						<p className="text-muted-foreground">Gestiona la información y configuración de correos</p>
					</div>
				</motion.div>

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
						<Tabs defaultValue="general" className="space-y-6">
							<form.Subscribe selector={(state) => [state.values.porcentaje]}>
								{([porcentaje]) => (
									<TabsList className="grid w-full max-w-[700px] grid-cols-4">
										<TabsTrigger value="general" className="gap-2">
											<Building2 className="h-4 w-4" />
											General
										</TabsTrigger>
										<TabsTrigger value="workflow" className="gap-2">
											<Mail className="h-4 w-4" />
											Workflow
										</TabsTrigger>
										<TabsTrigger value="certificates" className="gap-2">
											<Receipt className="h-4 w-4" />
											Certificados
										</TabsTrigger>
										<TabsTrigger value="pendientes" className="gap-2" disabled={(porcentaje as number) < 100}>
											<FileText className="h-4 w-4" />
											Pendientes
										</TabsTrigger>
									</TabsList>
								)}
							</form.Subscribe>

						<TabsContent value="general" className="space-y-6">
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
						</TabsContent>

						{/* Workflow Tab */}
						<TabsContent value="workflow" className="space-y-6">
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
								<motion.section 
									initial={{ opacity: 0, y: 20 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ delay: 0.1 }}
									className="rounded-lg border bg-card shadow-sm overflow-hidden"
								>
									<div className="bg-muted/50 px-6 py-4 border-b">
										<div className="flex items-center gap-2">
											<Mail className="h-5 w-5 text-primary" />
											<h2 className="text-lg font-semibold">Workflow de Finalización</h2>
										</div>
										<p className="text-sm text-muted-foreground mt-1">
											Configura los mensajes automáticos que se envían al alcanzar el 100% de la obra
										</p>
									</div>
									<div className="p-6 space-y-6">
										<form.Field name="onFinishFirstMessage">
											{(field) => (
												<div>
													<label className="flex items-center gap-2 text-sm font-medium mb-2">
														<Mail className="h-4 w-4 text-muted-foreground" />
														Mensaje del primer correo
													</label>
													<textarea
														value={field.state.value ?? ""}
														onChange={(e) =>
															field.handleChange(e.target.value ? e.target.value : null)
														}
														onBlur={field.handleBlur}
														className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-[120px] resize-none"
														placeholder="Escribe el mensaje que se enviará inmediatamente al completarse la obra..."
													/>
													<p className="mt-1 text-xs text-muted-foreground">
														Este correo se enviará automáticamente cuando la obra alcance el 100%
													</p>
												</div>
											)}
										</form.Field>

										<Separator />

										<form.Field name="onFinishSecondMessage">
											{(field) => (
												<div>
													<label className="flex items-center gap-2 text-sm font-medium mb-2">
														<Mail className="h-4 w-4 text-muted-foreground" />
														Mensaje del segundo correo (recordatorio)
													</label>
													<textarea
														value={field.state.value ?? ""}
														onChange={(e) =>
															field.handleChange(e.target.value ? e.target.value : null)
														}
														onBlur={field.handleBlur}
														className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-[120px] resize-none"
														placeholder="Escribe el mensaje de recordatorio..."
													/>
													<p className="mt-1 text-xs text-muted-foreground">
														Mensaje para el correo de seguimiento
													</p>
												</div>
											)}
										</form.Field>

										<form.Field name="onFinishSecondSendAt">
											{(field) => (
												<div>
													<label className="flex items-center gap-2 text-sm font-medium mb-2">
														<Calendar className="h-4 w-4 text-muted-foreground" />
														Fecha de envío del recordatorio
													</label>
													<Input
														type="datetime-local"
														value={field.state.value ?? ""}
														onChange={(e) =>
															field.handleChange(e.target.value ? e.target.value : null)
														}
														onBlur={field.handleBlur}
													/>
													<p className="mt-1 text-xs text-muted-foreground">
														Si no se define, el recordatorio se enviará según la configuración predeterminada del sistema
													</p>
												</div>
											)}
										</form.Field>
									</div>
								</motion.section>

								{/* Action Buttons */}
								<motion.div 
									initial={{ opacity: 0 }}
									animate={{ opacity: 1 }}
									transition={{ delay: 0.15 }}
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
													<div className="md:col-span-2">
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

						{/* Pendientes Tab */}
						<TabsContent value="pendientes" className="space-y-6">
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
												<FileText className="h-5 w-5 text-primary" />
												<h2 className="text-lg font-semibold">Documentos pendientes</h2>
											</div>
											<p className="text-sm text-muted-foreground mt-1">Lista de tareas al completar la obra</p>
										</div>
									</div>
								</div>

								<div className="p-6 space-y-4">
									<div className="overflow-x-auto rounded-lg border">
										<table className="w-full text-sm">
											<thead className="bg-muted/50">
												<tr>
													<th className="text-left font-medium py-3 px-4 border-b">Documento</th>
													<th className="text-left font-medium py-3 px-4 border-b">Vencimiento</th>
													<th className="text-left font-medium py-3 px-4 border-b">Hecho</th>
												</tr>
											</thead>
											<tbody>
												{pendingDocs.map((doc, idx) => (
													<motion.tr
														key={doc.id}
														initial={{ opacity: 0, y: 8 }}
														animate={{ opacity: 1, y: 0 }}
														transition={{ delay: idx * 0.05 }}
														className="border-b last:border-0"
													>
														<td className="py-3 px-4 min-w-[240px]">
															<Input
																type="text"
																placeholder="Nombre del documento"
																value={doc.name}
																onChange={(e) => updatePendingDoc(idx, "name", e.target.value)}
															/>
														</td>
														<td className="py-3 px-4 min-w-[200px]">
															<Input
																type="date"
																value={doc.dueDate}
																onChange={async (e) => {
																	const nextValue = e.target.value;
																	updatePendingDoc(idx, "dueDate", nextValue);
																	await scheduleReminderForDoc({ ...doc, dueDate: nextValue });
																}}
															/>
														</td>
														<td className="py-3 px-4">
															<input
																type="checkbox"
																checked={doc.done}
																onChange={(e) => updatePendingDoc(idx, "done", e.target.checked)}
																className="h-4 w-4"
															/>
														</td>
													</motion.tr>
												))}
											</tbody>
										</table>
									</div>
									<p className="text-xs text-muted-foreground">
										Al establecer una fecha, se agenda un recordatorio para el día anterior.
									</p>
								</div>
							</motion.section>
						</TabsContent>
					</Tabs>
				)}
			</div>
		</div>
	);
}
