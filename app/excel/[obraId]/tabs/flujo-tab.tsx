'use client';

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { motion } from "framer-motion";
import { Calendar, Mail, Plus, Trash2, Clock, MessageSquare, User, Zap, Timer, CalendarClock, Check, Pencil, Loader2 } from "lucide-react";

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
	isSavingFlujoAction: boolean;
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
	isSavingFlujoAction,
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
			className="space-y-6"
		>
			<motion.section
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.4 }}
				className="rounded-lg border bg-card shadow-sm overflow-hidden"
			>
				<div className="bg-muted/50 px-6 py-4 border-b">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-3">
							<Mail className="h-5 w-5 text-primary" />
							<div>
								<h2 className="text-lg font-semibold">Flujo de Finalización</h2>
								<p className="text-sm text-muted-foreground">
									Configura acciones automáticas al alcanzar el 100% de la obra
								</p>
							</div>
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
							className="rounded-lg border bg-card shadow-sm overflow-hidden max-w-lg"
						>
							{/* Header */}
							<div className="bg-muted/50 px-4 py-3 border-b">
								<div className="flex items-center gap-3">
									<Plus className="h-5 w-5 text-primary" />
									<div>
										<h3 className="font-semibold">Nueva Acción</h3>
										<p className="text-muted-foreground text-sm">Configurar notificación automática</p>
									</div>
								</div>
							</div>

							{/* Content */}
							<div className="p-4 space-y-4">

								{/* Title */}
								<div className="space-y-1.5">
									<label className="text-sm font-medium text-foreground">
										Título <span className="text-destructive">*</span>
									</label>
									<Input
										type="text"
										placeholder="Ej: Revisión de documentación final"
										value={newFlujoAction.title || ""}
										onChange={(e) =>
											setNewFlujoAction((prev) => ({ ...prev, title: e.target.value }))
										}
									/>
								</div>

								{/* Message */}
								<div className="space-y-1.5">
									<label className="text-sm font-medium text-foreground">
										Mensaje
									</label>
									<textarea
										className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 placeholder:text-muted-foreground resize-none"
										placeholder="Mensaje detallado de la acción..."
										value={newFlujoAction.message || ""}
										onChange={(e) =>
											setNewFlujoAction((prev) => ({ ...prev, message: e.target.value }))
										}
									/>
								</div>

								{/* Toggles */}
								<div className="grid grid-cols-2 gap-3">
									<div className="flex items-center justify-between p-3 bg-muted/50 border rounded-md">
										<div className="flex items-center gap-2">
											<Calendar className="w-4 h-4 text-muted-foreground" />
											<span className="text-sm">Evento calendario</span>
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

									<div className="flex items-center justify-between p-3 bg-muted/50 border rounded-md">
										<div className="flex items-center gap-2">
											<Mail className="w-4 h-4 text-muted-foreground" />
											<span className="text-sm">Email</span>
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
								<div className="space-y-2">
									<label className="text-sm font-medium text-foreground flex items-center gap-1.5">
										<Clock className="w-4 h-4 text-muted-foreground" />
										¿Cuándo ejecutar?
									</label>
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
									<motion.div
										initial={{ opacity: 0, y: -10 }}
										animate={{ opacity: 1, y: 0 }}
										className="grid grid-cols-2 gap-3"
									>
										<div className="space-y-1.5">
											<label className="text-sm font-medium text-foreground">Cantidad</label>
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
										<div className="space-y-1.5">
											<label className="text-sm font-medium text-foreground">Unidad</label>
											<select
												className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
									</motion.div>
								)}

								{newFlujoAction.timing_mode === "scheduled" && (
									<motion.div
										initial={{ opacity: 0, y: -10 }}
										animate={{ opacity: 1, y: 0 }}
										className="space-y-1.5"
									>
										<label className="text-sm font-medium text-foreground">Fecha y hora</label>
										<Input
											type="datetime-local"
											value={newFlujoAction.scheduled_date || ""}
											onChange={(e) =>
												setNewFlujoAction((prev) => ({ ...prev, scheduled_date: e.target.value }))
											}
										/>
									</motion.div>
								)}








								{/* Recipients */}
								<div className="space-y-2">
									<label className="text-sm font-medium text-foreground flex items-center gap-1.5">
										<User className="w-4 h-4 text-muted-foreground" />
										Destinatarios
									</label>
									<p className="text-xs text-muted-foreground">
										Si no seleccionás nada, se notificará solo al usuario actual.
									</p>
									<div className="grid gap-3 grid-cols-2">
										<div className="space-y-1.5">
											<label className="text-xs font-medium text-foreground">Usuario</label>
											<Select
												value={selectedRecipientUserId || "none"}
												onValueChange={(value) =>
													setSelectedRecipientUserId(value === "none" ? "" : value)
												}
											>
												<SelectTrigger className="w-full text-sm">
													<SelectValue placeholder="Seleccionar" />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="none">
														<span className="text-muted-foreground">Ninguno</span>
													</SelectItem>
													{obraUsers.map((user) => (
														<SelectItem key={user.id} value={user.id}>
															{getUserLabel(user)}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>
										<div className="space-y-1.5">
											<label className="text-xs font-medium text-foreground">Rol</label>
											<Select
												value={selectedRecipientRoleId || "none"}
												onValueChange={(value) =>
													setSelectedRecipientRoleId(value === "none" ? "" : value)
												}
											>
												<SelectTrigger className="w-full text-sm">
													<SelectValue placeholder="Seleccionar" />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="none">
														<span className="text-muted-foreground">Ninguno</span>
													</SelectItem>
													{obraRoles.map((role) => (
														<SelectItem key={role.id} value={role.id}>
															{role.name}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>
									</div>
								</div>
							</div>

							{/* Footer Actions */}
							<div className="px-4 py-3 bg-muted/30 border-t flex gap-2">
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
											notification_types: ["in_app", "email"],
											enabled: true,
										});
									}}
									className="flex-1"
									disabled={isSavingFlujoAction}
								>
									Cancelar
								</Button>
								<Button
									type="button"
									onClick={saveFlujoAction}
									size="sm"
									className="flex-1"
									disabled={isSavingFlujoAction}
								>
									{isSavingFlujoAction ? (
										<>
											<Loader2 className="h-4 w-4 mr-1 animate-spin" />
											Guardando...
										</>
									) : (
										<>
											<Plus className="h-4 w-4 mr-1" />
											Guardar
										</>
									)}
								</Button>
							</div>
						</motion.div>
					)}

					<div className="space-y-4">
						{isLoadingFlujoActions ? (
							<div className="flex flex-col items-center justify-center py-12 space-y-3">
								<div className="h-6 w-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
								<p className="text-sm text-muted-foreground">Cargando acciones...</p>
							</div>
						) : flujoActions.length === 0 ? (
							<div className="flex flex-col items-center justify-center py-12 space-y-3 rounded-lg border-2 border-dashed">
								<Mail className="h-10 w-10 text-muted-foreground/40" />
								<p className="text-sm text-muted-foreground text-center">
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
											<div key={group.key} className="relative flex gap-4 pb-6">
												{/* Left Side: Timeline Step */}
												<div className="relative flex flex-col items-center pt-1">
													{/* Icon Circle */}
													<div className={`w-10 h-10 rounded-full flex items-center justify-center ${isGroupCompleted
														? "bg-emerald-500 text-white"
														: "bg-primary text-primary-foreground"
														}`}>
														{isGroupCompleted ? (
															<Check className="w-5 h-5" />
														) : firstAction.timing_mode === "immediate" ? (
															<Zap className="w-5 h-5" />
														) : firstAction.timing_mode === "offset" ? (
															<Timer className="w-5 h-5" />
														) : (
															<CalendarClock className="w-5 h-5" />
														)}
													</div>

													{/* Vertical Connector Line */}
													{!isLast && (
														<div className={`absolute top-12 bottom-0 left-1/2 -translate-x-1/2 w-0.5 ${isGroupCompleted
															? "bg-emerald-500/30"
															: "bg-border"
															}`} />
													)}

													{/* Timing Label */}
													<div className="mt-2 text-center min-w-[100px]">
														<p className={`text-xs font-medium ${isGroupCompleted ? "text-emerald-600" : "text-foreground"}`}>
															{timingSummary}
														</p>
														<p className="text-[10px] text-muted-foreground">
															{group.actions.length} {group.actions.length === 1 ? "acción" : "acciones"}
														</p>
													</div>
												</div>

												{/* Right Side: Actions */}
												<div className="flex-1 flex flex-wrap items-start gap-3 pt-1">
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
																		className={`rounded-lg border bg-card overflow-hidden max-w-sm ${!action.enabled ? "opacity-60" : ""}`}
																	>
																		{/* Header */}
																		<div className={`border-b ${isExecuted ? "bg-emerald-50 dark:bg-emerald-950/20" : "bg-muted/50"}`}>
																			<div className="flex items-center gap-2 pr-3">
																				<AccordionTrigger className="flex-1 hover:no-underline px-3 py-2">
																					<div className="flex items-center gap-2 flex-1">
																						<div className={`w-7 h-7 rounded-md flex items-center justify-center ${isExecuted ? "bg-emerald-500 text-white" : "bg-primary/10 text-primary"}`}>
																							{isExecuted ? (
																								<Check className="h-4 w-4" />
																							) : action.action_type === "calendar_event" ? (
																								<Calendar className="h-4 w-4" />
																							) : (
																								<Mail className="h-4 w-4" />
																							)}
																						</div>
																						<div className="flex flex-col items-start flex-1">
																							<h4 className="font-medium text-sm text-foreground text-left">{action.title}</h4>
																							<p className="text-xs text-muted-foreground text-left">
																								{isExecuted ? "Ejecutada" : timingSummary}
																							</p>
																						</div>
																					</div>
																				</AccordionTrigger>
																				{isExecuted && (
																					<span className="px-2 py-0.5 rounded text-xs font-medium bg-emerald-500 text-white">
																						Completada
																					</span>
																				)}
																			</div>
																		</div>

																		{/* Content */}
																		<AccordionContent className="p-4">
																			<div className="space-y-3">
																				{/* Calendar Event Badge */}
																				{action.action_type === "calendar_event" && (
																					<div className="flex items-center gap-2 p-2 bg-muted/50 border rounded-md text-sm">
																						<Calendar className="w-4 h-4 text-muted-foreground" />
																						<span>Evento de calendario</span>
																					</div>
																				)}

																				{/* Message */}
																				{action.message && (
																					<div className="space-y-1">
																						<p className="text-xs font-medium text-muted-foreground">Mensaje</p>
																						<p className="text-sm text-foreground whitespace-pre-wrap bg-muted/30 rounded-md p-2 border">{action.message}</p>
																					</div>
																				)}

																				{/* Recipients */}
																				{recipients.length > 0 && (
																					<div className="space-y-1">
																						<p className="text-xs font-medium text-muted-foreground">Destinatarios</p>
																						<div className="flex flex-wrap gap-1">
																							{recipients.map(({ userId, label }) => (
																								<span
																									key={`${action.id}-${userId}`}
																									className="inline-flex items-center gap-1 px-2 py-1 bg-muted/50 rounded text-xs"
																								>
																									<span className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-medium">
																										{label.charAt(0).toUpperCase()}
																									</span>
																									{label}
																								</span>
																							))}
																						</div>
																					</div>
																				)}

																				{/* Notification Type */}
																				{notificationTypes.length > 0 && (
																					<div className="flex items-center gap-2 text-xs text-muted-foreground">
																						<span>Notificar:</span>
																						{notificationTypes.includes("in_app") && (
																							<span className="px-1.5 py-0.5 bg-muted rounded">App</span>
																						)}
																						{notificationTypes.includes("email") && (
																							<span className="px-1.5 py-0.5 bg-muted rounded">Email</span>
																						)}
																					</div>
																				)}
																			</div>

																			{/* Scheduled execution time for triggered but not-yet-executed actions */}
																			{!isExecuted && action.scheduled_for && (
																				<div className="flex items-center gap-2 mt-3 p-2 bg-muted/50 border rounded-md text-sm">
																					<Timer className="w-4 h-4 text-muted-foreground" />
																					<div>
																						<span className="font-medium">Programada: </span>
																						<span className="text-muted-foreground">
																							{formatScheduledDate(action.scheduled_for)}
																						</span>
																					</div>
																				</div>
																			)}

																			{/* Execution Info for completed actions */}
																			{isExecuted && action.executed_at && (
																				<div className="flex items-center gap-2 mt-3 p-2 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-md text-sm">
																					<Check className="w-4 h-4 text-emerald-600" />
																					<span className="text-emerald-700 dark:text-emerald-300">
																						Ejecutada: {formatScheduledDate(action.executed_at)}
																					</span>
																				</div>
																			)}

																			{/* Edit Form for non-executed actions */}
																			{isEditing && !isExecuted && (
																				<div className="space-y-3 mt-3 p-3 bg-muted/30 border rounded-md">
																					<div className="flex items-center gap-2 text-sm font-medium">
																						<Pencil className="w-4 h-4 text-muted-foreground" />
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
																			<div className="mt-4 flex gap-2 pt-3 border-t">
																				{!isExecuted && !isEditing && (
																					<Button
																						type="button"
																						variant="outline"
																						size="sm"
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
																						className="flex-1"
																					>
																						<Pencil className="h-4 w-4 mr-2" />
																						Editar
																					</Button>
																				)}
																				{!isExecuted && (
																					<Button
																						type="button"
																						variant="outline"
																						size="sm"
																						onClick={(e) => {
																							e.stopPropagation();
																							toggleFlujoAction(action.id, !action.enabled);
																						}}
																						className="flex-1"
																					>
																						{action.enabled ? "Desactivar" : "Activar"}
																					</Button>
																				)}
																				<Button
																					type="button"
																					variant="ghost"
																					size="sm"
																					onClick={(e) => {
																						e.stopPropagation();
																						deleteFlujoAction(action.id);
																					}}
																					className="text-destructive hover:text-destructive hover:bg-destructive/10"
																				>
																					<Trash2 className="h-4 w-4" />
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
