'use client';

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { motion } from "framer-motion";
import { Calendar, Mail, Plus, Trash2, Clock, MessageSquare, User, Zap, Timer, CalendarClock, Check, Pencil } from "lucide-react";

import { TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";

import type { FlujoAction, ObraRole, ObraUser, ObraUserRole } from "./types";

const OFFSET_UNIT_LABELS: Record<NonNullable<FlujoAction["offset_unit"]>, string> = {
	minutes: "Minutos",
	hours: "Horas",
	days: "Días",
	weeks: "Semanas",
	months: "Meses",
};

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
	updateFlujoAction: (id: string, updates: Partial<FlujoAction>) => void | Promise<void>;
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
	updateFlujoAction,
	flujoActions,
	isLoadingFlujoActions,
}: FlujoTabProps) {
	const includeCalendarEvent = newFlujoAction.action_type === "calendar_event";
	const [editingActionId, setEditingActionId] = useState<string | null>(null);
	const [editingTitle, setEditingTitle] = useState("");
	const [editingMessage, setEditingMessage] = useState("");
	const [editingTimingMode, setEditingTimingMode] = useState<"immediate" | "offset" | "scheduled">("immediate");
	const [editingOffsetValue, setEditingOffsetValue] = useState<number>(1);
	const [editingOffsetUnit, setEditingOffsetUnit] = useState<"minutes" | "hours" | "days" | "weeks" | "months">("days");
	const [editingScheduledDate, setEditingScheduledDate] = useState<string>("");

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

	// Group actions by execution timing
	const groupedFlujoActions = useMemo(() => {
		const getOffsetInMinutes = (action: FlujoAction) => {
			if (action.timing_mode !== "offset" || !action.offset_value || !action.offset_unit) {
				return 0;
			}

			const value = action.offset_value;
			switch (action.offset_unit) {
				case "minutes": return value;
				case "hours": return value * 60;
				case "days": return value * 60 * 24;
				case "weeks": return value * 60 * 24 * 7;
				case "months": return value * 60 * 24 * 30; // Approximate
				default: return 0;
			}
		};

		const getTimingKey = (action: FlujoAction) => {
			if (action.timing_mode === "immediate") {
				return "immediate";
			}
			if (action.timing_mode === "offset") {
				return `offset-${getOffsetInMinutes(action)}`;
			}
			if (action.timing_mode === "scheduled" && action.scheduled_date) {
				return `scheduled-${action.scheduled_date}`;
			}
			return "unknown";
		};

		const getSortValue = (action: FlujoAction) => {
			if (action.timing_mode === "immediate") return 0;
			if (action.timing_mode === "offset") return getOffsetInMinutes(action);
			if (action.timing_mode === "scheduled" && action.scheduled_date) {
				return new Date(action.scheduled_date).getTime();
			}
			return Infinity;
		};

		// Group actions by timing
		const grouped = new Map<string, FlujoAction[]>();
		for (const action of flujoActions) {
			const key = getTimingKey(action);
			if (!grouped.has(key)) {
				grouped.set(key, []);
			}
			grouped.get(key)!.push(action);
		}

		// Convert to array and sort groups by timing
		return Array.from(grouped.entries())
			.sort(([keyA, actionsA], [keyB, actionsB]) => {
				const sortA = getSortValue(actionsA[0]);
				const sortB = getSortValue(actionsB[0]);
				return sortA - sortB;
			})
			.map(([key, actions]) => ({ key, actions }));
	}, [flujoActions]);

	return (
		<TabsContent
			value="flujo"
			className="relative space-y-6 pb-6 bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.12),_transparent_65%)]"
		>
			<motion.section
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.4 }}
				className="rounded-3xl border border-border/40 bg-gradient-to-br from-background via-card/80 to-background shadow-2xl shadow-primary/10 overflow-hidden backdrop-blur"
			>
				<div className="bg-gradient-to-r from-primary/15 via-transparent to-primary/5 px-6 py-6 border-b border-border/40 backdrop-blur-md">
					<div className="flex items-center justify-between">
						<div className="space-y-1.5">
							<div className="flex items-center gap-2.5">
								<div className="p-2 rounded-lg bg-primary/10 ring-1 ring-primary/20">
									<Mail className="h-5 w-5 text-primary" />
								</div>
								<h2 className="text-xl font-bold tracking-tight">Flujo de Finalización</h2>
							</div>
							<p className="text-sm text-muted-foreground ml-11">
								Configura acciones automáticas al alcanzar el 100% de la obra
							</p>
						</div>
						<Button
							variant={isAddingFlujoAction ? "outline" : "default"}
							onClick={() => setIsAddingFlujoAction((prev) => !prev)}
							size="sm"
							className="shadow-sm rounded-full"
						>
							<Plus className="h-4 w-4 mr-2" />
							{isAddingFlujoAction ? "Cancelar" : "Nueva Acción"}
						</Button>
					</div>
				</div>

				<div className="p-6 md:p-8 space-y-6 bg-gradient-to-b from-background/80 via-card/60 to-background">
					{isAddingFlujoAction && (
						<motion.div
							initial={{ opacity: 0, height: 0 }}
							animate={{ opacity: 1, height: "auto" }}
							exit={{ opacity: 0, height: 0 }}
							className="rounded-3xl border border-border/40 bg-gradient-to-br from-card via-background to-card shadow-xl shadow-primary/10 overflow-hidden max-w-lg"
						>
							{/* Header */}
							<div className="bg-gradient-to-r from-primary via-primary to-primary/90 px-6 py-5 shadow-inner shadow-primary/40">
								<div className="flex items-center gap-3">
									<div className="w-10 h-10 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
										<Plus className="h-5 w-5 text-white" />
									</div>
									<div>
										<h3 className="text-white font-semibold text-lg">Nueva Acción</h3>
										<p className="text-primary-foreground/80 text-sm">Configurar notificación automática</p>
									</div>
								</div>
							</div>

							{/* Content */}
							<div className="p-6 space-y-5">

								{/* Title */}
								<div className="space-y-2">
									<label className="text-sm font-semibold text-foreground flex items-center gap-1">
										<MessageSquare className="w-4 h-4 text-primary" />
										Título
										<span className="text-destructive">*</span>
									</label>
									<Input
										type="text"
										placeholder="Ej: Revisión de documentación final"
										value={newFlujoAction.title || ""}
										onChange={(e) =>
											setNewFlujoAction((prev) => ({ ...prev, title: e.target.value }))
										}
										className="text-base"
									/>
								</div>

								{/* Message */}
								<div className="space-y-2">
									<label className="text-sm font-semibold text-foreground flex items-center gap-2">
										<MessageSquare className="w-4 h-4 text-primary" />
										Mensaje
									</label>
									<div className="bg-muted/40 rounded-2xl border border-border/40 p-1 focus-within:ring-2 focus-within:ring-primary/30 transition-shadow">
										<textarea
											className="w-full rounded-md border-0 bg-transparent px-3 py-2 text-sm min-h-[100px] ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 placeholder:text-muted-foreground resize-none"
											placeholder="Mensaje detallado de la acción..."
											value={newFlujoAction.message || ""}
											onChange={(e) =>
												setNewFlujoAction((prev) => ({ ...prev, message: e.target.value }))
											}
										/>
									</div>
								</div>

								{/* Calendar Event Toggle */}
								<div className="flex gap-2 justify-center items-center">

									<div className="flex items-center justify-between px-4 py-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-none shadow-sm shadow-amber-500/20 w-full">
										<div className="flex items-center gap-3 flex-1">
											<Calendar className="w-5 h-5 text-amber-600 dark:text-amber-400" />
											<div>
												<label className="text-amber-700 dark:text-amber-300 text-sm font-medium block">
													Evento de calendario
												</label>
												<p className="text-amber-600/70 dark:text-amber-400/70 text-xs">
													Añadir evento al calendario
												</p>
											</div>
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

									<div className="flex items-center justify-between px-4 py-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-none shadow-sm shadow-blue-500/20 w-full">
									<div className="flex items-center gap-3 flex-1">
										<Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
										<div>
											<label className="text-blue-700 dark:text-blue-300 text-sm font-medium block">
												Notificar por Email
											</label>
											<p className="text-blue-600/70 dark:text-blue-400/70 text-xs">
												Siempre se notifica por App
											</p>
										</div>
									</div>
									<Switch
										checked={newFlujoAction.notification_types?.includes("email") || false}
										onCheckedChange={(checked) =>
											setNewFlujoAction((prev) => ({
												...prev,
												notification_types: checked ? ["in_app", "email"] : ["in_app"],
											}))
										}
									/>
								</div>

								</div>

								{/* Timing Section */}
								<div className="bg-muted/40 rounded-2xl border border-border/40 p-4 shadow-inner shadow-border/30">
									<div className="flex items-center gap-2 text-muted-foreground text-sm mb-3">
										<Clock className="w-4 h-4" />
										<span>¿Cuándo ejecutar?</span>
									</div>
									<div className="flex gap-2 flex-wrap">
										<Button
											type="button"
											variant={newFlujoAction.timing_mode === "immediate" ? "default" : "outline"}
											size="sm"
											onClick={() => setNewFlujoAction((prev) => ({ ...prev, timing_mode: "immediate" }))}
											className="transition-all hover:scale-105"
										>
											Inmediato
										</Button>
										<Button
											type="button"
											variant={newFlujoAction.timing_mode === "offset" ? "default" : "outline"}
											size="sm"
											onClick={() => setNewFlujoAction((prev) => ({ ...prev, timing_mode: "offset" }))}
											className="transition-all hover:scale-105"
										>
											Después de X tiempo
										</Button>
										<Button
											type="button"
											variant={newFlujoAction.timing_mode === "scheduled" ? "default" : "outline"}
											size="sm"
											onClick={() => setNewFlujoAction((prev) => ({ ...prev, timing_mode: "scheduled" }))}
											className="transition-all hover:scale-105"
										>
											Fecha específica
										</Button>
									</div>
								</div>

								{newFlujoAction.timing_mode === "offset" && (
									<motion.div
										initial={{ opacity: 0, y: -10 }}
										animate={{ opacity: 1, y: 0 }}
										className="bg-muted/40 rounded-2xl border border-border/40 p-4 shadow-inner shadow-border/30"
									>
										<div className="flex gap-3 items-end">
											<div className="flex-1">
												<label className="text-sm font-semibold text-foreground mb-2 block">Cantidad</label>
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
													className="text-base font-medium"
												/>
											</div>
											<div className="flex-1">
												<label className="text-sm font-semibold text-foreground mb-2 block">Unidad</label>
												<select
													className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
									</motion.div>
								)}

								{newFlujoAction.timing_mode === "scheduled" && (
									<motion.div
										initial={{ opacity: 0, y: -10 }}
										animate={{ opacity: 1, y: 0 }}
										className="bg-muted/40 rounded-2xl border border-border/40 p-4 shadow-inner shadow-border/30"
									>
										<label className="text-sm font-semibold text-foreground mb-2 block">Fecha y hora</label>
										<Input
											type="datetime-local"
											value={newFlujoAction.scheduled_date || ""}
											onChange={(e) =>
												setNewFlujoAction((prev) => ({ ...prev, scheduled_date: e.target.value }))
											}
											className="text-base font-medium"
										/>
									</motion.div>
								)}








								{/* Recipients */}
								<div className="bg-muted/40 rounded-2xl border border-border/40 p-4 shadow-sm">
									<div className="flex items-center gap-2 text-muted-foreground text-sm mb-3">
										<User className="w-4 h-4" />
										<span>Destinatarios</span>
									</div>
									<p className="text-xs text-muted-foreground mb-3 leading-relaxed">
										Si no seleccionás nada, se notificará solo al usuario actual. Podés elegir un
										usuario específico, un rol, o ambos.
									</p>
									<div className="grid gap-3 md:grid-cols-2">
										<div>
											<label className="text-xs font-semibold text-foreground mb-2 block">Usuario específico</label>
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
											<label className="text-xs font-semibold text-foreground mb-2 block">Rol</label>
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

								{/* Notification Type */}

							</div>

							{/* Footer Actions */}
							<div className="px-6 pb-6">
								<div className="flex gap-3">
									<Button
										type="button"
										variant="outline"
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
												notification_types: ["in_app", "email"],
												enabled: true,
											});
										}}
										className="flex-1 h-11 hover:bg-muted transition-colors"
									>
										Cancelar
									</Button>
									<Button
										type="button"
										onClick={saveFlujoAction}
										className="flex-1 h-11 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-sm"
									>
										<Plus className="h-4 w-4 mr-2" />
										Guardar Acción
									</Button>
								</div>
							</div>
						</motion.div>
					)}

					<div className="space-y-4">
						{isLoadingFlujoActions ? (
							<div className="flex flex-col items-center justify-center py-12 space-y-3 rounded-3xl border border-border/40 bg-card/80 shadow-inner shadow-primary/5">
								<div className="h-8 w-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
								<p className="text-sm font-medium text-muted-foreground">Cargando acciones...</p>
							</div>
						) : flujoActions.length === 0 ? (
							<div className="flex flex-col items-center justify-center py-12 space-y-3 rounded-3xl border-2 border-dashed border-border/50 bg-gradient-to-br from-background/80 to-muted/30 shadow-sm shadow-border/20">
								<Mail className="h-12 w-12 text-muted-foreground/40" />
								<p className="text-sm font-medium text-muted-foreground text-center max-w-md">
									No hay acciones configuradas. Crea una nueva acción para comenzar.
								</p>
							</div>
						) : (
							<div className="relative">
								{/* Vertical Timeline */}
								<div className="space-y-0">
									{groupedFlujoActions.map((group, groupIdx) => {
										const firstAction = group.actions[0];
										const timingSummary =
											firstAction.timing_mode === "immediate"
												? "Inmediato"
												: firstAction.timing_mode === "offset" && firstAction.offset_value && firstAction.offset_unit
													? `${firstAction.offset_value} ${OFFSET_UNIT_LABELS[firstAction.offset_unit] ?? firstAction.offset_unit}`
													: firstAction.timing_mode === "scheduled" && firstAction.scheduled_date
														? formatScheduledDate(firstAction.scheduled_date)
														: "Sin configuración";

										const isLast = groupIdx === groupedFlujoActions.length - 1;
										const isGroupCompleted = group.actions.every((a) => a.executed_at !== null);

										return (
											<div key={group.key} className="relative flex gap-6 pb-8">
												{/* Left Side: Timeline Step */}
												<div className="relative flex flex-col items-center pt-2">
													{/* Icon Circle */}
													<motion.div
														initial={{ scale: 0, opacity: 0 }}
														animate={{ scale: 1, opacity: 1 }}
														transition={{ delay: groupIdx * 0.1, type: "spring" }}
														className="relative z-10"
													>
														<div className={`w-12 h-12 rounded-full shadow-xl flex items-center justify-center ring-4 ring-background ${
															isGroupCompleted
																? "bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-emerald-500/30"
																: "bg-gradient-to-br from-primary to-primary/80 shadow-primary/30"
														}`}>
															{isGroupCompleted ? (
																<Check className="w-6 h-6 text-white" />
															) : firstAction.timing_mode === "immediate" ? (
																<Zap className="w-6 h-6 text-white" />
															) : firstAction.timing_mode === "offset" ? (
																<Timer className="w-6 h-6 text-white" />
															) : (
																<CalendarClock className="w-6 h-6 text-white" />
															)}
														</div>
													</motion.div>

													{/* Vertical Connector Line */}
													{!isLast && (
														<div className={`absolute top-14 bottom-0 left-1/2 -translate-x-1/2 w-1 rounded-full ${
															isGroupCompleted
																? "bg-gradient-to-b from-emerald-500/60 via-emerald-500/30 to-emerald-500/10"
																: "bg-gradient-to-b from-primary/60 via-primary/30 to-primary/10"
														}`} />
													)}

													{/* Timing Label */}
													<motion.div
														initial={{ opacity: 0, y: 10 }}
														animate={{ opacity: 1, y: 0 }}
														transition={{ delay: groupIdx * 0.1 + 0.1 }}
														className="mt-3 text-center min-w-[120px]"
													>
														<div className={`rounded-full px-3 py-1.5 border ${
															isGroupCompleted
																? "bg-emerald-500/10 border-emerald-500/20"
																: "bg-primary/10 border-primary/20"
														}`}>
															<p className={`text-xs font-semibold whitespace-nowrap ${
																isGroupCompleted ? "text-emerald-600 dark:text-emerald-400" : "text-primary"
															}`}>
																{timingSummary}
															</p>
														</div>
														<p className="text-[10px] text-muted-foreground mt-1 font-medium">
															{group.actions.length} {group.actions.length === 1 ? "acción" : "acciones"}
														</p>
													</motion.div>
												</div>

												{/* Right Side: Actions */}
												<div className="flex-1 flex flex-wrap items-start gap-4 pt-2">
													{group.actions.map((action, idx) => {
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
														const isExecuted = action.executed_at !== null;
														const isEditing = editingActionId === action.id;

														return (
															<motion.div
																key={action.id}
																initial={{ opacity: 0, y: 8 }}
																animate={{ opacity: 1, y: 0 }}
																transition={{ delay: (groupIdx * group.actions.length + idx) * 0.05 }}
																className="flex-shrink-0"
															>
																<Accordion type="multiple" className="w-full">
																	<AccordionItem
																		value={action.id}
																		className={`group rounded-none overflow-hidden transition-all max-w-sm ${!action.enabled ? "opacity-60" : ""}`}
																	>
																		{/* Header */}
																		<div className={isExecuted ? "bg-emerald-600" : "bg-primary"}>
																			<div className="flex items-center gap-3 pr-4">
																				<AccordionTrigger className="flex-1 hover:no-underline px-3 py-2">
																					<div className="flex items-center gap-3 flex-1">
																						<div className="w-8 h-8 bg-white/20 backdrop-blur rounded-full flex items-center justify-center">
																							{isExecuted ? (
																								<Check className="h-5 w-5 text-white" />
																							) : action.action_type === "calendar_event" ? (
																								<Calendar className="h-4 w-4 text-white" />
																							) : (
																								<Mail className="h-5 w-5 text-white" />
																							)}
																						</div>
																						<div className="flex flex-col items-start gap-0.5 flex-1">
																							<h4 className="font-semibold text-base text-white text-left">{action.title}</h4>
																							<p className={`text-xs text-left ${isExecuted ? "text-emerald-100/80" : "text-primary-foreground/80"}`}>
																								{isExecuted ? "Ejecutada" : "Notificación programada"}
																							</p>
																						</div>
																					</div>
																				</AccordionTrigger>
																				{isExecuted && (
																					<div className="px-2 py-1 rounded-full text-xs font-medium bg-white/20 text-white border border-white/30">
																						Completada
																					</div>
																				)}
																			</div>
																		</div>

																		{/* Content */}
																		<AccordionContent className="p-6 bg-gradient-to-b from-background/80 via-card/50 to-card">
																			<div className="space-y-4">
																				{/* Schedule Section */}
																				<div className="bg-muted/40 rounded-none border border-border/40 p-4 shadow-sm flex items-center justify-between">
																					<div>
																						<p className="text-foreground font-medium">{timingSummary}</p>
																						{action.offset_unit && (
																							<p className="text-muted-foreground text-sm">
																								{OFFSET_UNIT_LABELS[action.offset_unit] ?? action.offset_unit}
																							</p>
																						)}
																					</div>
																					{action.timing_mode === "offset" && action.offset_value ? (
																						<div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
																							<span className="text-primary font-bold text-lg">{action.offset_value}</span>
																						</div>
																					) : (
																						<div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
																							<Clock className="w-5 h-5 text-primary" />
																						</div>
																					)}
																				</div>

																				{/* Calendar Event Badge */}
																				{action.action_type === "calendar_event" && (
																					<div className="flex items-center gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl shadow-sm shadow-amber-500/20">
																						<Calendar className="w-5 h-5 text-amber-600 dark:text-amber-400" />
																						<span className="text-amber-700 dark:text-amber-300 text-sm font-medium">Evento de calendario</span>
																						<div className="ml-auto w-2 h-2 bg-amber-400 rounded-full" />
																					</div>
																				)}

																				{/* Message */}
																				{action.message && (
																					<div className="space-y-2">
																						<div className="flex items-center gap-2 text-muted-foreground text-sm">
																							<MessageSquare className="w-4 h-4" />
																							<span>Mensaje</span>
																						</div>
																						<div className="bg-muted/40 rounded-2xl border border-border/40 p-4 shadow-inner shadow-border/20">
																							<p className="text-foreground whitespace-pre-wrap">{action.message}</p>
																						</div>
																					</div>
																				)}

																				{/* Recipients */}
																				{recipients.length > 0 && (
																					<div className="space-y-2">
																						<div className="flex items-center gap-2 text-muted-foreground text-sm">
																							<User className="w-4 h-4" />
																							<span>Destinatarios</span>
																						</div>
																						<div className="space-y-2">
																							{recipients.map(({ userId, label }) => (
																								<div
																									key={`${action.id}-${userId}`}
																									className="flex items-center gap-3 px-4 py-3 bg-muted/40 rounded-2xl border border-border/40 shadow-sm"
																								>
																									<div className="w-8 h-8 bg-gradient-to-br from-primary to-primary/80 rounded-full flex items-center justify-center">
																										<span className="text-primary-foreground text-xs font-medium">
																											{label.charAt(0).toUpperCase()}
																										</span>
																									</div>
																									<span className="text-foreground text-sm">{label}</span>
																								</div>
																							))}
																						</div>
																					</div>
																				)}

																				{/* Notification Type */}
																				{notificationTypes.length > 0 && (
																					<div className="flex items-center justify-between px-4 py-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-2xl shadow-sm shadow-blue-500/20">
																						<div className="flex items-center gap-3">
																							<Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
																							<span className="text-blue-700 dark:text-blue-300 text-sm font-medium">Tipo de notificación</span>
																						</div>
																						<div className="flex gap-2">
																							{notificationTypes.includes("in_app") && (
																								<span className="text-blue-700 dark:text-blue-300 text-xs bg-blue-100 dark:bg-blue-900 px-3 py-1 rounded-lg font-medium">
																									App
																								</span>
																							)}
																							{notificationTypes.includes("email") && (
																								<span className="text-blue-700 dark:text-blue-300 text-xs bg-blue-100 dark:bg-blue-900 px-3 py-1 rounded-lg font-medium">
																									Email
																								</span>
																							)}
																						</div>
																					</div>
																				)}
																			</div>

																			{/* Scheduled execution time for triggered but not-yet-executed actions */}
																			{!isExecuted && action.scheduled_for && (
																				<div className="flex items-center gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl shadow-sm shadow-amber-500/20">
																					<Timer className="w-5 h-5 text-amber-600 dark:text-amber-400" />
																					<div>
																						<span className="text-amber-700 dark:text-amber-300 text-sm font-medium block">Programada para ejecutar</span>
																						<span className="text-amber-600/70 dark:text-amber-400/70 text-xs">
																							{formatScheduledDate(action.scheduled_for)}
																						</span>
																						{action.triggered_at && (
																							<span className="text-amber-600/50 dark:text-amber-400/50 text-xs block">
																								(Obra completada: {formatScheduledDate(action.triggered_at)})
																							</span>
																						)}
																					</div>
																				</div>
																			)}

																			{/* Execution Info for completed actions */}
																			{isExecuted && action.executed_at && (
																				<div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-2xl shadow-sm shadow-emerald-500/20">
																					<Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
																					<div>
																						<span className="text-emerald-700 dark:text-emerald-300 text-sm font-medium block">Ejecutada</span>
																						<span className="text-emerald-600/70 dark:text-emerald-400/70 text-xs">
																							{formatScheduledDate(action.executed_at)}
																						</span>
																					</div>
																				</div>
																			)}

																			{/* Edit Form for non-executed actions */}
																			{isEditing && !isExecuted && (
																				<div className="space-y-3 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl">
																					<div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 text-sm font-medium mb-2">
																						<Pencil className="w-4 h-4" />
																						<span>Editando acción</span>
																					</div>
																					<div className="space-y-2">
																						<label className="text-xs font-medium text-foreground">Título</label>
																						<Input
																							type="text"
																							value={editingTitle}
																							onChange={(e) => setEditingTitle(e.target.value)}
																							className="text-sm"
																							placeholder="Título de la acción"
																						/>
																					</div>
																					<div className="space-y-2">
																						<label className="text-xs font-medium text-foreground">Mensaje</label>
																						<textarea
																							className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 placeholder:text-muted-foreground resize-none"
																							value={editingMessage}
																							onChange={(e) => setEditingMessage(e.target.value)}
																							placeholder="Mensaje de la acción"
																						/>
																					</div>

																					{/* Timing Section */}
																					<div className="space-y-2">
																						<label className="text-xs font-medium text-foreground flex items-center gap-1">
																							<Clock className="w-3 h-3" />
																							¿Cuándo ejecutar?
																						</label>
																						<div className="flex gap-2 flex-wrap">
																							<Button
																								type="button"
																								variant={editingTimingMode === "immediate" ? "default" : "outline"}
																								size="sm"
																								onClick={(e) => {
																									e.stopPropagation();
																									setEditingTimingMode("immediate");
																								}}
																							>
																								Inmediato
																							</Button>
																							<Button
																								type="button"
																								variant={editingTimingMode === "offset" ? "default" : "outline"}
																								size="sm"
																								onClick={(e) => {
																									e.stopPropagation();
																									setEditingTimingMode("offset");
																								}}
																							>
																								Después de X tiempo
																							</Button>
																							<Button
																								type="button"
																								variant={editingTimingMode === "scheduled" ? "default" : "outline"}
																								size="sm"
																								onClick={(e) => {
																									e.stopPropagation();
																									setEditingTimingMode("scheduled");
																								}}
																							>
																								Fecha específica
																							</Button>
																						</div>
																					</div>

																					{editingTimingMode === "offset" && (
																						<div className="flex gap-2 items-end">
																							<div className="flex-1">
																								<label className="text-xs font-medium text-foreground mb-1 block">Cantidad</label>
																								<Input
																									type="number"
																									min="1"
																									value={editingOffsetValue}
																									onChange={(e) => setEditingOffsetValue(parseInt(e.target.value, 10) || 1)}
																									className="text-sm"
																								/>
																							</div>
																							<div className="flex-1">
																								<label className="text-xs font-medium text-foreground mb-1 block">Unidad</label>
																								<select
																									className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
																									value={editingOffsetUnit}
																									onChange={(e) => setEditingOffsetUnit(e.target.value as typeof editingOffsetUnit)}
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

																					{editingTimingMode === "scheduled" && (
																						<div className="space-y-1">
																							<label className="text-xs font-medium text-foreground">Fecha y hora</label>
																							<Input
																								type="datetime-local"
																								value={editingScheduledDate}
																								onChange={(e) => setEditingScheduledDate(e.target.value)}
																								className="text-sm"
																							/>
																						</div>
																					)}

																					<div className="flex gap-2 pt-2">
																						<Button
																							type="button"
																							size="sm"
																							onClick={(e) => {
																								e.stopPropagation();
																								updateFlujoAction(action.id, {
																									title: editingTitle,
																									message: editingMessage,
																									timing_mode: editingTimingMode,
																									offset_value: editingTimingMode === "offset" ? editingOffsetValue : null,
																									offset_unit: editingTimingMode === "offset" ? editingOffsetUnit : null,
																									scheduled_date: editingTimingMode === "scheduled" ? editingScheduledDate : null,
																								});
																								setEditingActionId(null);
																							}}
																							className="flex-1"
																						>
																							Guardar
																						</Button>
																						<Button
																							type="button"
																							variant="outline"
																							size="sm"
																							onClick={(e) => {
																								e.stopPropagation();
																								setEditingActionId(null);
																							}}
																							className="flex-1"
																						>
																							Cancelar
																						</Button>
																					</div>
																				</div>
																			)}

																			{/* Footer Actions */}
																			<div className="mt-6 flex gap-3 pt-4 border-t border-border/40">
																				{!isExecuted && !isEditing && (
																					<Button
																						type="button"
																						variant="outline"
																						onClick={(e) => {
																							e.stopPropagation();
																							setEditingActionId(action.id);
																							setEditingTitle(action.title);
																							setEditingMessage(action.message || "");
																							setEditingTimingMode(action.timing_mode);
																							setEditingOffsetValue(action.offset_value || 1);
																							setEditingOffsetUnit(action.offset_unit || "days");
																							setEditingScheduledDate(action.scheduled_date || "");
																						}}
																						className="flex-1 h-11 hover:bg-muted transition-colors"
																					>
																						<Pencil className="h-4 w-4 mr-2" />
																						Editar
																					</Button>
																				)}
																				{!isExecuted && (
																					<Button
																						type="button"
																						variant="outline"
																						onClick={(e) => {
																							e.stopPropagation();
																							toggleFlujoAction(action.id, !action.enabled);
																						}}
																						className="flex-1 h-11 hover:bg-muted transition-colors"
																					>
																						{action.enabled ? "Desactivar" : "Activar"}
																					</Button>
																				)}
																				<Button
																					type="button"
																					variant="ghost"
																					onClick={(e) => {
																						e.stopPropagation();
																						deleteFlujoAction(action.id);
																					}}
																					className={`${isExecuted ? "flex-1" : ""} h-11 text-destructive hover:text-destructive hover:bg-destructive/15 transition-colors`}
																				>
																					<Trash2 className="h-4 w-4 mr-2" />
																					Eliminar
																				</Button>
																			</div>
																		</AccordionContent>
																	</AccordionItem>
																</Accordion>
															</motion.div>
														);
													})}
												</div>
											</div>
										);
									})}
								</div>
							</div>
						)}
					</div>
				</div>
			</motion.section>
		</TabsContent >
	);
}
