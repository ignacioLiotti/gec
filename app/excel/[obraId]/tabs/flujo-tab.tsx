'use client';

import { useMemo, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { motion } from "framer-motion";
import { Calendar, Mail, Plus, Trash2 } from "lucide-react";

import { TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

import type { FlujoAction, ObraRole, ObraUser, ObraUserRole } from "./types";

const OFFSET_UNIT_LABELS: Record<NonNullable<FlujoAction["offset_unit"]>, string> = {
	minutes: "Minutos",
	hours: "Horas",
	days: "Días",
	weeks: "Semanas",
	months: "Meses",
};

const DetailField = ({ label, children }: { label: string; children: ReactNode }) => (
	<div className="space-y-1 rounded-md border border-dashed border-border/60 bg-background/50 p-3">
		<p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
		<div className="text-sm text-foreground">{children}</div>
	</div>
);

const formatScheduledDate = (value: string) => {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value;
	return date.toLocaleString();
};

type FlujoTabProps = {
	isAddingFlujoAction: boolean;
	setIsAddingFlujoAction: Dispatch<SetStateAction<boolean>>;
	newFlujoAction: Partial<FlujoAction>;
	setNewFlujoAction: Dispatch<SetStateAction<Partial<FlujoAction>>>;
	selectedRecipientUserId: string;
	setSelectedRecipientUserId: Dispatch<SetStateAction<string>>;
	selectedRecipientRoleId: string;
	setSelectedRecipientRoleId: Dispatch<SetStateAction<string>>;
	obraUsers: ObraUser[];
	obraRoles: ObraRole[];
	obraUserRoles: ObraUserRole[];
	saveFlujoAction: () => void | Promise<void>;
	toggleFlujoAction: (id: string, enabled: boolean) => void | Promise<void>;
	deleteFlujoAction: (id: string) => void | Promise<void>;
	flujoActions: FlujoAction[];
	isLoadingFlujoActions: boolean;
};

export function ObraFlujoTab({
	isAddingFlujoAction,
	setIsAddingFlujoAction,
	newFlujoAction,
	setNewFlujoAction,
	selectedRecipientUserId,
	setSelectedRecipientUserId,
	selectedRecipientRoleId,
	setSelectedRecipientRoleId,
	obraUsers,
	obraRoles,
	obraUserRoles,
	saveFlujoAction,
	toggleFlujoAction,
	deleteFlujoAction,
	flujoActions,
	isLoadingFlujoActions,
}: FlujoTabProps) {
	const includeCalendarEvent = newFlujoAction.action_type === "calendar_event";

	const getUserDisplayById = (userId: string) => {
		const user = obraUsers.find((u) => u.id === userId);
		if (!user) return null;
		return user.full_name || user.email || user.id;
	};

	const roleUserMap = useMemo(() => {
		const map = new Map<string, string[]>();
		for (const role of obraRoles) {
			map.set(role.id, []);
		}
		for (const relation of obraUserRoles) {
			const display = getUserDisplayById(relation.user_id);
			if (!display) continue;
			const existing = map.get(relation.role_id) ?? [];
			map.set(relation.role_id, [...existing, display]);
		}
		return map;
	}, [obraRoles, obraUserRoles, obraUsers]);

	const getUserLabel = (user: ObraUser) =>
		user.full_name || user.email || user.id;

	return (
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
							onClick={() => setIsAddingFlujoAction((prev) => !prev)}
							size="sm"
						>
							<Plus className="h-4 w-4 mr-2" />
							{isAddingFlujoAction ? "Cancelar" : "Nueva Acción"}
						</Button>
					</div>
				</div>

				<div className="p-6 space-y-6">
					{isAddingFlujoAction && (
						<motion.div
							initial={{ opacity: 0, height: 0 }}
							animate={{ opacity: 1, height: "auto" }}
							exit={{ opacity: 0, height: 0 }}
							className="rounded-lg border bg-muted/30 p-4 space-y-4"
						>
							<h3 className="text-sm font-semibold">Nueva Acción</h3>

							<div className="space-y-2 rounded-md border px-4 py-3">
								<div className="flex items-center justify-between gap-6">
									<div>
										<label className="text-sm font-medium block">Evento de calendario</label>
										<p className="text-xs text-muted-foreground">
											Activá esta opción para crear un evento en el calendario. Podés combinarlo con
											las notificaciones por email/app para avisar al mismo tiempo.
										</p>
									</div>
									<Switch
										checked={includeCalendarEvent}
										onCheckedChange={(checked) =>
											setNewFlujoAction((prev) => ({
												...prev,
												action_type: checked ? "calendar_event" : "email",
											}))
										}
									/>
								</div>
							</div>

							<div>
								<label className="text-sm font-medium mb-2 block">¿Cuándo ejecutar?</label>
								<div className="flex gap-2 flex-wrap">
									<Button
										type="button"
										variant={newFlujoAction.timing_mode === "immediate" ? "default" : "outline"}
										size="sm"
										onClick={() => setNewFlujoAction((prev) => ({ ...prev, timing_mode: "immediate" }))}
									>
										Inmediato
									</Button>
									<Button
										type="button"
										variant={newFlujoAction.timing_mode === "offset" ? "default" : "outline"}
										size="sm"
										onClick={() => setNewFlujoAction((prev) => ({ ...prev, timing_mode: "offset" }))}
									>
										Después de X tiempo
									</Button>
									<Button
										type="button"
										variant={newFlujoAction.timing_mode === "scheduled" ? "default" : "outline"}
										size="sm"
										onClick={() => setNewFlujoAction((prev) => ({ ...prev, timing_mode: "scheduled" }))}
									>
										Fecha específica
									</Button>
								</div>
							</div>

							{newFlujoAction.timing_mode === "offset" && (
								<div className="flex gap-2 items-end">
									<div className="flex-1">
										<label className="text-sm font-medium mb-2 block">Cantidad</label>
										<Input
											type="number"
											min="1"
											value={newFlujoAction.offset_value || 1}
											onChange={(e) =>
												setNewFlujoAction((prev) => ({
													...prev,
													offset_value: parseInt(e.target.value, 10) || 1,
												}))
											}
										/>
									</div>
									<div className="flex-1">
										<label className="text-sm font-medium mb-2 block">Unidad</label>
										<select
											className="w-full rounded-md border px-3 py-2 text-sm"
											value={newFlujoAction.offset_unit || "days"}
											onChange={(e) =>
												setNewFlujoAction((prev) => ({
													...prev,
													offset_unit: e.target.value as FlujoAction["offset_unit"],
												}))
											}
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

							{newFlujoAction.timing_mode === "scheduled" && (
								<div>
									<label className="text-sm font-medium mb-2 block">Fecha y hora</label>
									<Input
										type="datetime-local"
										value={newFlujoAction.scheduled_date || ""}
										onChange={(e) =>
											setNewFlujoAction((prev) => ({ ...prev, scheduled_date: e.target.value }))
										}
									/>
								</div>
							)}

							<div>
								<label className="text-sm font-medium mb-2 block">Título *</label>
								<Input
									type="text"
									placeholder="Ej: Revisión de documentación final"
									value={newFlujoAction.title || ""}
									onChange={(e) =>
										setNewFlujoAction((prev) => ({ ...prev, title: e.target.value }))
									}
								/>
							</div>

							<div>
								<label className="text-sm font-medium mb-2 block">Mensaje</label>
								<textarea
									className="w-full rounded-md border px-3 py-2 text-sm min-h-[100px]"
									placeholder="Mensaje detallado de la acción..."
									value={newFlujoAction.message || ""}
									onChange={(e) =>
										setNewFlujoAction((prev) => ({ ...prev, message: e.target.value }))
									}
								/>
							</div>

							<div className="space-y-2">
								<label className="text-sm font-medium mb-1 block">Destinatarios</label>
								<p className="text-xs text-muted-foreground">
									Si no seleccionás nada, se notificará solo al usuario actual. Podés elegir un
									usuario específico, un rol, o ambos.
								</p>
								<div className="grid gap-3 md:grid-cols-2">
									<div>
										<label className="text-xs font-medium mb-1 block">Usuario específico</label>
										<Select
											value={selectedRecipientUserId || "none"}
											onValueChange={(value) =>
												setSelectedRecipientUserId(value === "none" ? "" : value)
											}
										>
											<SelectTrigger className="w-full text-xs">
												<SelectValue placeholder="Seleccionar usuario" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="none">
													<span className="text-xs text-muted-foreground">Ninguno (solo vos)</span>
												</SelectItem>
												{obraUsers.map((user) => (
													<SelectItem key={user.id} value={user.id}>
														<div className="flex flex-col text-xs">
															<span className="font-medium">
																{getUserLabel(user)}
															</span>
															{user.full_name && user.email ? (
																<span className="text-[10px] text-muted-foreground">
																	{user.email}
																</span>
															) : null}
														</div>
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
									<div>
										<label className="text-xs font-medium mb-1 block">Rol</label>
										<Select
											value={selectedRecipientRoleId || "none"}
											onValueChange={(value) =>
												setSelectedRecipientRoleId(value === "none" ? "" : value)
											}
										>
											<SelectTrigger className="w-full text-xs">
												<SelectValue placeholder="Seleccionar rol" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="none">
													<span className="text-xs text-muted-foreground">Ninguno</span>
												</SelectItem>
												{obraRoles.map((role) => {
													const members = roleUserMap.get(role.id) ?? [];
													return (
														<SelectItem key={role.id} value={role.id}>
															<div className="flex flex-col text-xs">
																<span className="font-medium">
																	{role.name || role.key}
																</span>
																<span className="text-[10px] text-muted-foreground">
																	{members.length
																		? members.join(", ")
																		: "Sin usuarios asignados"}
																</span>
															</div>
														</SelectItem>
													);
												})}
											</SelectContent>
										</Select>
									</div>
								</div>
							</div>

							<div>
								<label className="text-sm font-medium mb-2 block">Tipo de notificación</label>
								<div className="space-y-2">
									<div className="flex items-center gap-2">
										<input
											type="checkbox"
											id="notif-in-app"
											className="h-4 w-4 rounded border-gray-300"
											checked={newFlujoAction.notification_types?.includes("in_app") || false}
											onChange={(e) =>
												setNewFlujoAction((prev) => {
													const current: ('in_app' | 'email')[] = prev.notification_types || [];
													const updated: ('in_app' | 'email')[] = e.target.checked
														? Array.from(new Set([...current.filter((t) => t !== "in_app"), "in_app" as const]))
														: current.filter((t) => t !== "in_app");
													return {
														...prev,
														notification_types: updated.length > 0 ? updated : (["in_app"] as const),
													};
												})
											}
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
											checked={newFlujoAction.notification_types?.includes("email") || false}
											onChange={(e) =>
												setNewFlujoAction((prev) => {
													const current: ('in_app' | 'email')[] = prev.notification_types || [];
													const updated: ('in_app' | 'email')[] = e.target.checked
														? Array.from(new Set([...current.filter((t) => t !== "email"), "email" as const]))
														: current.filter((t) => t !== "email");
													return {
														...prev,
														notification_types: updated.length > 0 ? updated : (["in_app"] as const),
													};
												})
											}
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

							<div className="flex justify-end gap-2">
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() => {
										setIsAddingFlujoAction(false);
										setNewFlujoAction({
											action_type: "email",
											timing_mode: "immediate",
											offset_value: 1,
											offset_unit: "days",
											title: "",
											message: "",
											recipient_user_ids: [],
											notification_types: ["in_app"],
											enabled: true,
										});
									}}
								>
									Cancelar
								</Button>
								<Button type="button" size="sm" onClick={saveFlujoAction}>
									Guardar Acción
								</Button>
							</div>
						</motion.div>
					)}

					<div className="space-y-3">
						{isLoadingFlujoActions ? (
							<p className="text-sm text-muted-foreground text-center py-8">Cargando acciones...</p>
						) : flujoActions.length === 0 ? (
							<p className="text-sm text-orange-primary/80 text-center py-8">
								No hay acciones configuradas. Crea una nueva acción para comenzar.
							</p>
						) : (
							flujoActions.map((action, idx) => {
								const recipients = (action.recipient_user_ids ?? []).map((userId) => ({
									userId,
									label: getUserDisplayById(userId) || `Usuario ${userId.slice(0, 6)}…`,
								}));
								const notificationTypes = action.notification_types ?? [];
								const timingSummary =
									action.timing_mode === "immediate"
										? "Inmediato"
										: action.timing_mode === "offset" && action.offset_value && action.offset_unit
											? `Después de ${action.offset_value} ${OFFSET_UNIT_LABELS[action.offset_unit] ?? action.offset_unit}`
											: action.timing_mode === "scheduled" && action.scheduled_date
												? `Fecha específica: ${formatScheduledDate(action.scheduled_date)}`
												: "Sin configuración";

								return (
									<motion.div
										key={action.id}
										initial={{ opacity: 0, y: 8 }}
										animate={{ opacity: 1, y: 0 }}
										transition={{ delay: idx * 0.05 }}
										className={`rounded-lg border p-4 ${!action.enabled ? "opacity-50" : ""}`}
									>
										<div className="flex flex-col gap-4">
											<div className="flex items-start justify-between gap-3">
												<div className="flex-1">
													<div className="flex flex-wrap items-center gap-2 mb-2">
														{action.action_type === "calendar_event" ? (
															<Calendar className="h-4 w-4 text-primary" />
														) : (
															<Mail className="h-4 w-4 text-primary" />
														)}
														<h4 className="font-semibold text-sm">{action.title}</h4>
														<span
															className={`text-xs px-2 py-0.5 rounded-full ${
																action.enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
															}`}
														>
															{action.enabled ? "Activa" : "Inactiva"}
														</span>
													</div>
												</div>
												<div className="flex items-center gap-2">
													<Button
														type="button"
														variant="ghost"
														size="sm"
														onClick={() => toggleFlujoAction(action.id, !action.enabled)}
													>
														{action.enabled ? "Desactivar" : "Activar"}
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

											<div className="grid gap-3 md:grid-cols-2">
												<DetailField label="Evento de calendario">
													{action.action_type === "calendar_event" ? "Sí" : "No"}
												</DetailField>
												<DetailField label="¿Cuándo ejecutar?">{timingSummary}</DetailField>
												{action.timing_mode === "offset" && action.offset_value && action.offset_unit ? (
													<>
														<DetailField label="Cantidad programada">{action.offset_value}</DetailField>
														<DetailField label="Unidad">
															{OFFSET_UNIT_LABELS[action.offset_unit] ?? action.offset_unit}
														</DetailField>
													</>
												) : null}
												{action.timing_mode === "scheduled" && action.scheduled_date ? (
													<DetailField label="Fecha programada">
														{formatScheduledDate(action.scheduled_date)}
													</DetailField>
												) : null}
											</div>

											<div className="grid gap-3 md:grid-cols-2">
												<DetailField label="Título">{action.title || "Sin título"}</DetailField>
												<DetailField label="Mensaje">
													{action.message ? (
														<p className="text-sm text-muted-foreground whitespace-pre-wrap">{action.message}</p>
													) : (
														<span className="text-sm text-muted-foreground">Sin mensaje</span>
													)}
												</DetailField>
											</div>

											<div className="grid gap-3 md:grid-cols-2">
												<DetailField label="Destinatarios">
													{recipients.length ? (
														<div className="flex flex-wrap gap-2">
															{recipients.map(({ userId, label }) => (
																<Badge variant="outline" key={`${action.id}-${userId}`}>
																	{label}
																</Badge>
															))}
														</div>
													) : (
														<span className="text-sm text-muted-foreground">
															Se notificará solo al creador de la acción
														</span>
													)}
												</DetailField>
												<DetailField label="Tipo de notificación">
													{notificationTypes.length ? (
														<div className="flex flex-wrap gap-2">
															{notificationTypes.includes("in_app") && (
																<Badge className="bg-blue-100 text-blue-700" variant="secondary">
																	App
																</Badge>
															)}
															{notificationTypes.includes("email") && (
																<Badge className="bg-purple-100 text-purple-700" variant="secondary">
																	Email
																</Badge>
															)}
														</div>
													) : (
														<span className="text-sm text-muted-foreground">No configurado</span>
													)}
												</DetailField>
											</div>
										</div>
									</motion.div>
								);
							})
						)}
					</div>
				</div>
			</motion.section>
		</TabsContent>
	);
}

