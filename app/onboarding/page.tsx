"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import { getMyPendingInvitations, acceptInvitation } from "@/app/admin/users/invitation-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, UserPlus, Loader2, CheckCircle2, Clock, Mail, Plus, HardHat } from "lucide-react";
import { toast } from "sonner";

interface PendingInvitation {
	id: string;
	token: string;
	tenant_id: string;
	invited_role: string;
	invited_operational_role_id: string | null;
	invited_operational_role_name: string | null;
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
	const { push } = router;
	const searchParams = useSearchParams();
	const queryParams = new URLSearchParams(searchParams);
	const [mode, setMode] = useState<Mode>("join");
	const [loading, setLoading] = useState(true);
	const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
	const [acceptingId, setAcceptingId] = useState<string | null>(null);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [invitationLoadWarning, setInvitationLoadWarning] = useState<string | null>(null);
	const [reloadKey, setReloadKey] = useState(0);

	const errorMessage = queryParams.get("error");
	const previewMode = queryParams.get("preview") === "1" || queryParams.get("preview") === "true";

	useEffect(() => {
		async function init() {
			setLoading(true);
			setLoadError(null);
			setInvitationLoadWarning(null);
			try {
				const supabase = createSupabaseBrowserClient();

				const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();

				if (userError) throw userError;
				if (!currentUser) {
					push("/");
					return;
				}

				const { data: memberships, error: membershipsError } = await supabase
					.from("memberships")
					.select("tenant_id")
					.eq("user_id", currentUser.id)
					.order("created_at", { ascending: true });
				if (membershipsError) throw membershipsError;

				if (memberships && memberships.length > 0 && !previewMode) {
					push(`/api/tenants/${memberships[0].tenant_id}/switch`);
					return;
				}

				const result = await getMyPendingInvitations();
				if (result.error) {
					setInvitations([]);
					setMode("create");
					setInvitationLoadWarning(result.error);
					return;
				}
				if (result.invitations) {
					setInvitations(result.invitations as unknown as PendingInvitation[]);
					if (result.invitations.length > 0) {
						setMode("join");
					} else {
						setMode("create");
					}
				} else {
					setMode("create");
				}
			} catch (error) {
				setLoadError(
					error instanceof Error
						? error.message
						: "No pudimos revisar tu acceso. Volvé a intentarlo.",
				);
			} finally {
				setLoading(false);
			}
		}

		void init();
	}, [push, previewMode, reloadKey]);

	const handleAcceptInvitation = async (invitation: PendingInvitation) => {
		setAcceptingId(invitation.id);
		try {
			const result = await acceptInvitation(invitation.token);
			if (result.error) {
				toast.error(result.error);
				return;
			}
			if (result.success) {
				toast.success(`¡Te uniste a ${result.tenantName}!`);
				push(`/api/tenants/${result.tenantId}/switch?next=${encodeURIComponent("/dashboard")}`);
			}
		} catch {
			toast.error("No pudimos aceptar la invitación. Volvé a intentarlo.");
		} finally {
			setAcceptingId(null);
		}
	};

	if (loading) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-canvas p-4">
				<Card className="w-full max-w-2xl">
					<CardContent className="flex items-center justify-center py-12">
						<Loader2 className="size-8 animate-spin text-[#444444]" />
					</CardContent>
				</Card>
			</div>
		);
	}

	if (loadError) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-canvas p-4">
				<Card className="w-full max-w-lg border-stroke-soft shadow-card">
					<CardHeader>
						<CardTitle>No pudimos revisar tu acceso</CardTitle>
						<CardDescription>{loadError}</CardDescription>
					</CardHeader>
					<CardContent>
						<Button type="button" className="w-full" onClick={() => setReloadKey((value) => value + 1)}>
							Volver a intentar
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="min-h-screen flex items-center justify-center bg-canvas p-4">
			<Card className="w-full max-w-2xl border-stroke-soft shadow-card">
				<CardHeader className="text-center">
					<div className="flex justify-center mb-4">
						<div className="rounded-xl border border-orange-primary/25 bg-orange-primary/10 p-4 text-orange-primary shadow-sm">
							<Building2 className="size-10" />
						</div>
					</div>
					<CardTitle className="text-2xl">Bienvenido a Síntesis</CardTitle>
					<CardDescription className="text-base">
						Configurá tu espacio de trabajo para empezar
					</CardDescription>
				</CardHeader>

				<CardContent className="space-y-6">
					{invitationLoadWarning ? (
						<div className="rounded-lg border border-warning/35 bg-warning/15 p-3 text-sm text-warning-foreground">
							<p>{invitationLoadWarning} Podés crear tu organización o volver a comprobar.</p>
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="mt-3"
								onClick={() => setReloadKey((value) => value + 1)}
							>
								Comprobar invitaciones
							</Button>
						</div>
					) : null}
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
					<div className="flex gap-2 rounded-lg border border-stroke-soft bg-surface-recessed p-1 shadow-inner">
						<button
							onClick={() => setMode("create")}
							className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-all ${mode === "create"
									? "bg-card text-content shadow-sm"
									: "text-content-secondary hover:text-content"
								}`}
						>
							<div className="flex items-center justify-center gap-2">
								<Plus className="size-4" />
								Crear organización
							</div>
						</button>
						<button
							onClick={() => setMode("join")}
							className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-all ${mode === "join"
									? "bg-card text-content shadow-sm"
									: "text-content-secondary hover:text-content"
								}`}
						>
							<div className="flex items-center justify-center gap-2">
								<UserPlus className="size-4" />
								Unirme a una organización
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
								<h3 className="mb-2 text-lg font-semibold text-content">Invitaciones pendientes</h3>
								<p className="mb-4 text-sm text-content-secondary">
									Aceptá una invitación para sumarte a una organización existente
								</p>
							</div>

							{invitations.length === 0 ? (
								<div className="text-center py-12 bg-[#f0efea] rounded-lg border-2 border-dashed border-[#d4d3ce]">
									<Mail className="size-12 text-[#888888] mx-auto mb-3" />
									<p className="text-[#444444] font-medium mb-1">Sin invitaciones pendientes</p>
									<p className="text-sm text-[#666666]">
										Pedile a una persona administradora que te invite, o creá tu propia organización.
									</p>
								</div>
							) : (
								<div className="space-y-3">
									{invitations.map((invitation) => {
										const expiresAt = new Date(invitation.expires_at);
										const expirationLabel = new Intl.DateTimeFormat("es-AR", {
											dateStyle: "medium",
											timeZone: "UTC",
										}).format(expiresAt);

										return (
											<Card key={invitation.id} className="border-2 hover:border-[#ff5800]/30 transition-colors">
												<CardContent className="p-4">
													<div className="flex items-start justify-between gap-4">
														<div className="flex-1 space-y-2">
															<div className="flex items-center gap-2">
																<Building2 className="size-5 text-[#ff5800]" />
																<h4 className="font-semibold text-[#444444]">
																	{invitation.tenant?.name || "Organización"}
																</h4>
															</div>
															<div className="space-y-1 text-sm">
																<div className="flex items-center gap-2 text-[#666666]">
																	<UserPlus className="size-4" />
																	<span>
																		{invitation.inviter?.full_name
																			? `Invitado por ${invitation.inviter.full_name}`
																			: "Invitación de organización"}
																	</span>
																</div>
																<div className="flex items-center gap-2 text-[#666666]">
																	<CheckCircle2 className="size-4" />
																<span className="capitalize">
																	Nivel: {invitation.invited_role === "admin" ? "Administrador" : "Miembro"}
																</span>
															</div>
															{invitation.invited_operational_role_name ? (
																<div className="flex items-center gap-2 text-[#666666]">
																	<HardHat className="size-4" />
																	<span>Trabajo: {invitation.invited_operational_role_name}</span>
																</div>
															) : null}
																<div className="flex items-center gap-2 text-[#666666]">
																	<Clock className="size-4" />
																								<span>Vence el {expirationLabel}</span>
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
																		<Loader2 className="mr-2 size-4 animate-spin" />
																		Uniéndose&hellip;
																	</>
																) : (
																	<>
																		<CheckCircle2 className="mr-2 size-4" />
																		Aceptar
																	</>
																)}
															</Button>
															<Button
																variant="outline"
																size="sm"
																onClick={() => push(`/invitations/${invitation.token}`)}
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
								<h3 className="mb-2 text-lg font-semibold text-content">Crear una organización</h3>
								<p className="text-sm text-[#666666] mb-4">
									Prepararemos carpetas, certificados, compras, roles y tableros. Después te guiaremos para crear tu primera obra.
								</p>
							</div>

							<div className="rounded-lg border border-[#d4d3ce] bg-white p-4 shadow-sm">
								<p className="text-sm leading-6 text-[#666666]">
									Solo te pediremos el nombre. El modelo recomendado se prepara automáticamente y después verás una lista corta para completar la primera obra.
								</p>
								<Button type="button" onClick={() => push("/tenants/new")} className="mt-4 w-full bg-[#ff5800] hover:bg-[#e64f00]">
									<Plus className="mr-2 size-4" />
									Crear mi organización
								</Button>
							</div>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}

export default function OnboardingPage() {
	return (
		<Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="size-8 animate-spin text-[#444444]" /></div>}>
			<OnboardingPageContent />
		</Suspense>
	);
}
