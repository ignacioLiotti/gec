"use client";

import { useEffect, useMemo, useState, type MouseEvent } from "react";
import Link from "next/link";
import { ShieldCheck, ShieldOff, SlidersHorizontal } from "lucide-react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { HydratedDateText } from "@/components/ui/hydrated-date-text";
import { cn } from "@/lib/utils";
import type {
	PermissionOption,
	PermissionSimulation,
} from "@/lib/permission-simulation";

type UserMenuProps = {
	email?: string | null;
	demoLabel?: string | null;
	demoMode?: boolean;
	userRoles?: {
		roles: string[];
		isAdmin: boolean;
		isSuperAdmin: boolean;
		tenantId: string | null;
		actualIsSuperAdmin?: boolean;
		permissionSimulation?: PermissionSimulation | null;
	} | null;
	permissionOptions?: PermissionOption[];
	variant?: "default" | "sidebar";
};

type MenuNotification = {
	id: string;
	title: string;
	body: string | null;
	type: string;
	created_at: string;
	read_at: string | null;
	action_url: string | null;
};

export default function UserMenu({
	email,
	demoLabel,
	demoMode = false,
	userRoles,
	permissionOptions = [],
	variant = "default",
}: UserMenuProps) {
	const [menuOpen, setMenuOpen] = useState(false);
	const [dialogOpen, setDialogOpen] = useState(false);
	const [simulationDialogOpen, setSimulationDialogOpen] = useState(false);
	const [selectedPermissionKeys, setSelectedPermissionKeys] = useState<string[]>(
		[],
	);
	const [simulationSaving, setSimulationSaving] = useState(false);
	const [simulationError, setSimulationError] = useState<string | null>(null);
	const [notifications, setNotifications] = useState<MenuNotification[]>([]);
	const [loading, setLoading] = useState(false);
	const isAuthed = Boolean(email);
	const isDemo = demoMode && !isAuthed;
	const canManagePermissionSimulation = Boolean(userRoles?.actualIsSuperAdmin);
	const permissionSimulation = userRoles?.permissionSimulation ?? null;
	const isPermissionSimulationActive = Boolean(permissionSimulation);

	const [demoNotifications, setDemoNotifications] = useState<MenuNotification[]>([]);

	useEffect(() => {
		if (!isDemo) return;
		const now = Date.now();
		setDemoNotifications([
			{
				id: "demo-1",
				title: "Bienvenido a la aplicacion",
				body: "Aqui hay algunos consejos rapidos para comenzar.",
				type: "info",
				created_at: new Date(now - 1000 * 60 * 5).toISOString(),
				read_at: null,
				action_url: "#",
			},
			{
				id: "demo-2",
				title: "Recordatorio de documento",
				body: "Un documento requiere tu atencion.",
				type: "warning",
				created_at: new Date(now - 1000 * 60 * 60).toISOString(),
				read_at: null,
				action_url: "#",
			},
			{
				id: "demo-3",
				title: "Resumen semanal listo",
				body: "Tu resumen de actividad semanal esta disponible.",
				type: "success",
				created_at: new Date(now - 1000 * 60 * 60 * 24).toISOString(),
				read_at: new Date(now - 1000 * 60 * 30).toISOString(),
				action_url: "#",
			},
		]);
	}, [isDemo]);

	useEffect(() => {
		setSelectedPermissionKeys(permissionSimulation?.permissionKeys ?? []);
	}, [permissionSimulation]);

	async function handleLogout() {
		setMenuOpen(false);
		const supabase = createSupabaseBrowserClient();
		await supabase.auth.signOut();
	}

	const handlePopoverChange = (nextOpen: boolean) => {
		if (!isAuthed) return;
		setMenuOpen(nextOpen);
	};

	const handleTriggerClick = (event: MouseEvent<HTMLButtonElement>) => {
		if (isDemo) {
			event.preventDefault();
			return;
		}
		if (isAuthed) return;
		event.preventDefault();
		window.dispatchEvent(new Event("open-auth"));
	};

	useEffect(() => {
		if (!dialogOpen || !isAuthed) return;
		let aborted = false;
		(async () => {
			setLoading(true);
			try {
				const supabase = createSupabaseBrowserClient();
				const { data: userRes } = await supabase.auth.getUser();
				const userId = userRes.user?.id;
				if (!userId) return;
				const { data, error } = await supabase
					.from("notifications")
					.select("id,title,body,type,created_at,read_at,action_url")
					.eq("user_id", userId)
					.order("created_at", { ascending: false })
					.limit(50);
				if (error) throw error;
				if (!aborted) {
					const items = data ?? [];
					setNotifications(items.length ? items : demoNotifications);
				}
			} catch {
				// Keep fallback UX simple.
			} finally {
				if (!aborted) setLoading(false);
			}
		})();
		return () => {
			aborted = true;
		};
	}, [dialogOpen, isAuthed, demoNotifications]);

	const unreadCount = useMemo(
		() => notifications.filter((n) => !n.read_at).length,
		[notifications],
	);

	const selectedPermissionKeySet = useMemo(
		() => new Set(selectedPermissionKeys),
		[selectedPermissionKeys],
	);
	const simulationLabel = isPermissionSimulationActive
		? permissionSimulation?.permissionKeys.length
			? `${permissionSimulation.permissionKeys.length} permisos`
			: "Sin permisos"
		: null;

	function togglePermissionKey(permissionKey: string, checked: boolean) {
		setSelectedPermissionKeys((current) => {
			if (checked) {
				return current.includes(permissionKey)
					? current
					: [...current, permissionKey].sort((left, right) =>
							left.localeCompare(right),
						);
			}
			return current.filter((key) => key !== permissionKey);
		});
	}

	async function updatePermissionSimulation(permissionKeys: string[] | null) {
		setSimulationSaving(true);
		setSimulationError(null);
		try {
			const response = await fetch("/api/admin/permission-simulation", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(
					permissionKeys == null
						? { active: false }
						: { permissionKeys },
				),
			});
			if (!response.ok) {
				throw new Error("No se pudo actualizar la simulacion");
			}
			window.location.reload();
		} catch (error) {
			setSimulationError(
				error instanceof Error
					? error.message
					: "No se pudo actualizar la simulacion",
			);
		} finally {
			setSimulationSaving(false);
		}
	}

	return (
		<>
			<Popover
				open={isAuthed ? menuOpen : false}
				onOpenChange={handlePopoverChange}
			>
				<PopoverTrigger asChild>
					<button
						type="button"
						onClick={handleTriggerClick}
						className={cn(
							"inline-flex items-center gap-2 rounded-md border text-sm hover:bg-foreground/10",
							variant === "sidebar"
								? "h-12 w-full overflow-hidden px-2 py-1.5 text-left transition-[width,height,padding,gap,color,background-color,box-shadow,transform] duration-300 ease-(--sidebar-motion-ease) group-data-[collapsible=icon]:h-12 group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:p-0"
								: "px-2 py-1",
						)}
					>
						<div
							className={cn(
								"shrink-0 rounded-full bg-orange-primary",
								variant === "sidebar" ? "size-8" : "size-6",
							)}
						/>
						<span
							className={cn(
								"truncate",
								variant === "sidebar"
									? "min-w-0 max-w-full transition-[opacity,transform] duration-200 ease-(--sidebar-motion-ease) group-data-[collapsible=icon]:-translate-x-1 group-data-[collapsible=icon]:opacity-0"
									: "max-w-[160px]",
							)}
						>
							{email ?? (isDemo ? (demoLabel ?? "Sesion demo") : "Iniciar sesion")}
						</span>
					</button>
				</PopoverTrigger>
				{isAuthed && (
					<PopoverContent
						align="end"
						side={variant === "sidebar" ? "right" : "bottom"}
						sideOffset={8}
						className="w-64 overflow-hidden p-0"
					>
						<div className="px-3 py-2">
							<div className="text-sm text-foreground/70">{email}</div>
							{userRoles && (
								<div className="mt-1 flex flex-wrap gap-1">
									{(userRoles.actualIsSuperAdmin ||
										userRoles.isSuperAdmin) && (
										<span className="inline-flex items-center rounded-full bg-purple-500/20 px-2 py-0.5 text-xs font-medium text-purple-700 dark:text-purple-300">
											SuperAdministrador
										</span>
									)}
									{isPermissionSimulationActive && (
										<span className="inline-flex items-center rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
											Simulando: {simulationLabel}
										</span>
									)}
									{userRoles.isAdmin && !userRoles.isSuperAdmin && (
										<span className="inline-flex items-center rounded-full bg-blue-500/20 px-2 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-300">
											Administrador
										</span>
									)}
									{userRoles.roles
										.filter((role) => {
											if (
												role === "admin" &&
												userRoles.isAdmin &&
												!userRoles.isSuperAdmin
											) {
												return false;
											}
											return true;
										})
										.map((role) => (
											<span
												key={role}
												className="inline-flex items-center rounded-full bg-orange-500/20 px-2 py-0.5 text-xs font-medium text-orange-700 dark:text-orange-300"
											>
												{role}
											</span>
										))}
									{!userRoles.isAdmin &&
										!userRoles.isSuperAdmin &&
										userRoles.roles.filter((role) => role !== "admin")
											.length === 0 && (
											<span className="inline-flex items-center rounded-full bg-stone-500/20 px-2 py-0.5 text-xs font-medium text-stone-700 dark:text-stone-300">
												Sin roles
											</span>
										)}
								</div>
							)}
						</div>
						<Separator />
						<Link
							href="/profile"
							onClick={() => setMenuOpen(false)}
							className="block w-full px-3 py-2 text-left text-sm hover:bg-foreground/10"
						>
							Perfil
						</Link>
						{canManagePermissionSimulation && (
							<button
								onClick={() => {
									setSimulationDialogOpen(true);
									setMenuOpen(false);
								}}
								className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-foreground/10"
							>
								<span>Simular permisos</span>
								{simulationLabel && (
									<span className="truncate text-xs text-muted-foreground">
										{simulationLabel}
									</span>
								)}
							</button>
						)}
						<button
							onClick={() => {
								setDialogOpen(true);
								setMenuOpen(false);
							}}
							className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-foreground/10"
						>
							<span>Notificaciones</span>
							{unreadCount > 0 && (
								<span className="ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-orange-primary px-1.5 text-xs text-white">
									{unreadCount}
								</span>
							)}
						</button>
						<button
							onClick={handleLogout}
							className="block w-full px-3 py-2 text-left text-sm hover:bg-foreground/10"
						>
							Cerrar sesion
						</button>
					</PopoverContent>
				)}
			</Popover>
			<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							Notificaciones
							{unreadCount > 0 && (
								<span className="inline-flex min-w-5 items-center justify-center rounded-full bg-orange-primary px-1.5 text-xs text-white">
									{unreadCount}
								</span>
							)}
						</DialogTitle>
						<DialogDescription>
							Ultima actividad relacionada con tu cuenta.
						</DialogDescription>
					</DialogHeader>
					<div className="max-h-[60vh] overflow-auto p-4">
						{loading ? (
							<div className="py-6 text-center text-sm text-muted-foreground">
								Cargando?
							</div>
						) : notifications.length === 0 ? (
							<div className="py-6 text-center text-sm text-muted-foreground">
								Sin notificaciones
							</div>
						) : (
							<ul className="flex flex-col gap-3">
								{notifications.map((n) => (
									<li key={n.id} className="rounded-md border p-3">
										<div className="flex items-start justify-between gap-3">
											<div className="min-w-0">
												<div className="flex items-center gap-2">
													<span className="font-medium">{n.title}</span>
													{!n.read_at && (
														<span className="inline-flex size-1.5 rounded-full bg-orange-primary" />
													)}
												</div>
												{n.body && (
													<p className="mt-1 truncate text-sm text-foreground/80">
														{n.body}
													</p>
												)}
											</div>
											<HydratedDateText
												value={n.created_at}
												className="shrink-0 text-xs text-muted-foreground"
											/>
										</div>
										{n.action_url && (
											<div className="mt-2">
												<a
													href={n.action_url}
													className="text-orange-primary hover:underline"
												>
													Ver detalles
												</a>
											</div>
										)}
									</li>
								))}
							</ul>
						)}
					</div>
				</DialogContent>
			</Dialog>
			<Dialog
				open={simulationDialogOpen}
				onOpenChange={setSimulationDialogOpen}
			>
				<DialogContent className="sm:max-w-xl">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<SlidersHorizontal className="size-4" />
							Simular permisos
						</DialogTitle>
						<DialogDescription>
							Vista efectiva para esta sesion de superadmin.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 p-4 pt-0">
						<div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
							<Button
								type="button"
								variant="outline"
								onClick={() => void updatePermissionSimulation([])}
								disabled={simulationSaving}
								className="justify-start"
							>
								<ShieldOff className="size-4" />
								Sin permisos
							</Button>
							<Button
								type="button"
								variant="outline"
								onClick={() => void updatePermissionSimulation(null)}
								disabled={simulationSaving || !isPermissionSimulationActive}
								className="justify-start"
							>
								<ShieldCheck className="size-4" />
								Desactivar
							</Button>
						</div>
						<div className="flex items-center justify-between gap-3">
							<div className="text-sm font-medium">Permisos especificos</div>
							<div className="text-xs text-muted-foreground">
								{selectedPermissionKeys.length} seleccionados
							</div>
						</div>
						<div className="max-h-[46vh] overflow-auto rounded-md border">
							{permissionOptions.length === 0 ? (
								<div className="px-3 py-6 text-center text-sm text-muted-foreground">
									No hay permisos disponibles
								</div>
							) : (
								<ul className="divide-y">
									{permissionOptions.map((permission) => {
										const checked = selectedPermissionKeySet.has(permission.key);
										return (
											<li key={permission.key}>
												<label className="flex cursor-pointer items-start gap-3 px-3 py-2 hover:bg-foreground/5">
													<Checkbox
														checked={checked}
														onCheckedChange={(value) =>
															togglePermissionKey(
																permission.key,
																value === true,
															)
														}
														className="mt-0.5"
													/>
													<span className="min-w-0 flex-1">
														<span className="block truncate text-sm font-medium">
															{permission.displayName}
														</span>
														<span className="block truncate font-mono text-xs text-muted-foreground">
															{permission.key}
														</span>
													</span>
													{permission.category && (
														<span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">
															{permission.category}
														</span>
													)}
												</label>
											</li>
										);
									})}
								</ul>
							)}
						</div>
						{simulationError && (
							<div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
								{simulationError}
							</div>
						)}
						<div className="flex justify-end gap-2">
							<Button
								type="button"
								variant="outline"
								onClick={() => setSimulationDialogOpen(false)}
								disabled={simulationSaving}
							>
								Cancelar
							</Button>
							<Button
								type="button"
								onClick={() =>
									void updatePermissionSimulation(selectedPermissionKeys)
								}
								disabled={simulationSaving}
							>
								Aplicar seleccion
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
}
