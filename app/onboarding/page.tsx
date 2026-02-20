"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import { createTenantAction } from "@/app/tenants/actions";
import { getMyPendingInvitations, acceptInvitation } from "@/app/admin/users/invitation-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, UserPlus, Loader2, CheckCircle2, Clock, Mail, Plus } from "lucide-react";
import { toast } from "sonner";

interface PendingInvitation {
	id: string;
	token: string;
	tenant_id: string;
	invited_role: string;
	expires_at: string;
	created_at: string;
	tenant: {
		name: string;
	} | null;
	inviter: {
		full_name: string;
	} | null;
}

type Mode = "join" | "create";

function OnboardingPageContent() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const [mode, setMode] = useState<Mode>("join");
	const [user, setUser] = useState<any>(null);
	const [loading, setLoading] = useState(true);
	const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
	const [acceptingId, setAcceptingId] = useState<string | null>(null);
	const [creatingTenant, setCreatingTenant] = useState(false);
	const [tenantName, setTenantName] = useState("");
	const [nowMs, setNowMs] = useState(0);

	const errorMessage = searchParams?.get("error");
	const previewMode = searchParams?.get("preview") === "1" || searchParams?.get("preview") === "true";

	useEffect(() => {
		setNowMs(Date.now());
	}, []);

	useEffect(() => {
		async function init() {
			const supabase = createSupabaseBrowserClient();

			// Get current user
			const { data: { user: currentUser } } = await supabase.auth.getUser();

			if (!currentUser) {
				router.push("/");
				return;
			}

			setUser(currentUser);

			// Check if user already has memberships (unless preview mode)
			const { data: memberships } = await supabase
				.from("memberships")
				.select("tenant_id")
				.eq("user_id", currentUser.id)
				.order("created_at", { ascending: true });

			if (memberships && memberships.length > 0 && !previewMode) {
				// Redirect to first tenant
				router.push(`/api/tenants/${memberships[0].tenant_id}/switch`);
				return;
			}

			// Load pending invitations
			const result = await getMyPendingInvitations();
			if (result.invitations) {
				setInvitations(result.invitations as unknown as PendingInvitation[]);
				// If there are invitations, default to join mode
				if (result.invitations.length > 0) {
					setMode("join");
				} else {
					// No invitations, default to create mode
					setMode("create");
				}
			} else {
				setMode("create");
			}

			setLoading(false);
		}

		init();
	}, [router, previewMode]);

	const handleAcceptInvitation = async (invitation: PendingInvitation) => {
		setAcceptingId(invitation.id);
		const result = await acceptInvitation(invitation.token);

		if (result.error) {
			toast.error(result.error);
			setAcceptingId(null);
		} else if (result.success) {
			toast.success(`¡Te uniste a ${result.tenantName}!`);
			// Redirigir al tenant
			router.push("/");
			router.refresh();
		}
	};

	const handleCreateTenant = async (e: React.FormEvent) => {
		e.preventDefault();
		if (tenantName.trim().length < 3) {
			toast.error("El nombre de la organización debe tener al menos 3 caracteres");
			return;
		}

		setCreatingTenant(true);

		try {
			const formData = new FormData();
			formData.append("name", tenantName.trim());

			await createTenantAction("/onboarding", formData);

			// createTenantAction redirigirá, pero si no lo hace, mostrar éxito
			toast.success("¡Organización creada!");
		} catch (error: any) {
			toast.error(error?.message || "Error al crear la organización");
			setCreatingTenant(false);
		}
	};

	if (loading) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f0efea] to-[#e5e4df]">
				<Card className="w-full max-w-2xl">
					<CardContent className="flex items-center justify-center py-12">
						<Loader2 className="h-8 w-8 animate-spin text-[#444444]" />
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f0efea] via-white to-[#e8e7e2] p-4">
			<Card className="w-full max-w-2xl shadow-lg">
				<CardHeader className="text-center">
					<div className="flex justify-center mb-4">
						<div className="p-4 bg-[#fff0e6] rounded-full">
							<Building2 className="h-10 w-10 text-[#ff5800]" />
						</div>
					</div>
					<CardTitle className="text-2xl">Bienvenido a Síntesis</CardTitle>
					<CardDescription className="text-base">
						Configura tu espacio de trabajo para comenzar
					</CardDescription>
				</CardHeader>

				<CardContent className="space-y-6">
					{/* Banner de Modo Vista Previa */}
					{previewMode && (
						<div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
							<p className="text-sm text-amber-800">
								Modo vista previa: Ya tienes una organización pero estás viendo la página de incorporación.
							</p>
						</div>
					)}

					{/* Mensaje de Error */}
					{errorMessage && (
						<div className="bg-red-50 border border-red-200 rounded-lg p-3">
							<p className="text-sm text-red-700">{errorMessage}</p>
						</div>
					)}

					{/* Pestañas de Selección */}
					<div className="flex gap-2 p-1 bg-[#f0efea] rounded-lg">
						<button
							onClick={() => setMode("create")}
							className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-all ${mode === "create"
									? "bg-white text-[#444444] shadow-sm"
									: "text-[#666666] hover:text-[#444444]"
								}`}
						>
							<div className="flex items-center justify-center gap-2">
								<Plus className="h-4 w-4" />
								Crear Organización
							</div>
						</button>
						<button
							onClick={() => setMode("join")}
							className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-all ${mode === "join"
									? "bg-white text-[#444444] shadow-sm"
									: "text-[#666666] hover:text-[#444444]"
								}`}
						>
							<div className="flex items-center justify-center gap-2">
								<UserPlus className="h-4 w-4" />
								Unirse a Organización
								{invitations.length > 0 && (
									<span className="ml-1 px-1.5 py-0.5 text-xs font-bold bg-[#ff5800] text-white rounded-full">
										{invitations.length}
									</span>
								)}
							</div>
						</button>

					</div>

					{/* Área de Contenido */}
					{mode === "join" ? (
						<div className="space-y-4">
							<div>
								<h3 className="text-lg font-semibold mb-2 text-[#444444]">Invitaciones Pendientes</h3>
								<p className="text-sm text-[#666666] mb-4">
									Acepta una invitación para unirte a una organización existente
								</p>
							</div>

							{invitations.length === 0 ? (
								<div className="text-center py-12 bg-[#f0efea] rounded-lg border-2 border-dashed border-[#d4d3ce]">
									<Mail className="h-12 w-12 text-[#888888] mx-auto mb-3" />
									<p className="text-[#444444] font-medium mb-1">Sin invitaciones pendientes</p>
									<p className="text-sm text-[#666666]">
										Pide a un administrador que te invite, o crea tu propia organización.
									</p>
								</div>
							) : (
								<div className="space-y-3">
									{invitations.map((invitation) => {
										const expiresAt = new Date(invitation.expires_at);
										const timeRemaining = Math.max(0, Math.floor((expiresAt.getTime() - nowMs) / (1000 * 60 * 60)));

										return (
											<Card key={invitation.id} className="border-2 hover:border-[#ff5800]/30 transition-colors">
												<CardContent className="p-4">
													<div className="flex items-start justify-between gap-4">
														<div className="flex-1 space-y-2">
															<div className="flex items-center gap-2">
																<Building2 className="h-5 w-5 text-[#ff5800]" />
																<h4 className="font-semibold text-[#444444]">
																	{invitation.tenant?.name || "Organización"}
																</h4>
															</div>
															<div className="space-y-1 text-sm">
																<div className="flex items-center gap-2 text-[#666666]">
																	<UserPlus className="h-4 w-4" />
																	<span>
																		{invitation.inviter?.full_name
																			? `Invitado por ${invitation.inviter.full_name}`
																			: "Invitación de organización"}
																	</span>
																</div>
																<div className="flex items-center gap-2 text-[#666666]">
																	<CheckCircle2 className="h-4 w-4" />
																	<span className="capitalize">
																		Rol: {invitation.invited_role}
																	</span>
																</div>
																<div className="flex items-center gap-2 text-[#666666]">
																	<Clock className="h-4 w-4" />
																	<span>
																		Expira en{" "}
																		{timeRemaining < 24
																			? `${timeRemaining} horas`
																			: `${Math.floor(timeRemaining / 24)} días`}
																	</span>
																</div>
															</div>
														</div>
														<div className="flex flex-col gap-2">
															<Button
																onClick={() => handleAcceptInvitation(invitation)}
																disabled={acceptingId === invitation.id}
																className="bg-[#ff5800] hover:bg-[#e64f00]"
															>
																{acceptingId === invitation.id ? (
																	<>
																		<Loader2 className="mr-2 h-4 w-4 animate-spin" />
																		Uniéndose...
																	</>
																) : (
																	<>
																		<CheckCircle2 className="mr-2 h-4 w-4" />
																		Aceptar
																	</>
																)}
															</Button>
															<Button
																variant="outline"
																size="sm"
																onClick={() => router.push(`/invitations/${invitation.token}`)}
															>
																Ver Detalles
															</Button>
														</div>
													</div>
												</CardContent>
											</Card>
										);
									})}
								</div>
							)}
						</div>
					) : (
						<div className="space-y-4">
							<div>
								<h3 className="text-lg font-semibold mb-2 text-[#444444]">Crear Nueva Organización</h3>
								<p className="text-sm text-[#666666] mb-4">
									Inicia tu propio espacio de trabajo e invita a miembros del equipo después
								</p>
							</div>

							<form onSubmit={handleCreateTenant} className="space-y-4">
								<div className="space-y-2">
									<label htmlFor="tenantName" className="text-sm font-medium text-[#444444]">
										Nombre de la Organización
									</label>
									<input
										id="tenantName"
										type="text"
										value={tenantName}
										onChange={(e) => setTenantName(e.target.value)}
										placeholder="ej., Acme Inc, Equipo de Ingeniería"
										className="w-full px-4 py-2 border border-[#d4d3ce] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ff5800] focus:border-transparent"
										required
										minLength={3}
										disabled={creatingTenant}
									/>
									<p className="text-xs text-[#888888]">
										Mínimo 3 caracteres
									</p>
								</div>

								<Button
									type="submit"
									disabled={creatingTenant || tenantName.trim().length < 3}
									className="w-full bg-[#ff5800] hover:bg-[#e64f00]"
								>
									{creatingTenant ? (
										<>
											<Loader2 className="mr-2 h-4 w-4 animate-spin" />
											Creando Organización...
										</>
									) : (
										<>
											<Plus className="mr-2 h-4 w-4" />
											Crear Organización
										</>
									)}
								</Button>
							</form>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}

export default function OnboardingPage() {
	return (
		<Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#444444]" /></div>}>
			<OnboardingPageContent />
		</Suspense>
	);
}
