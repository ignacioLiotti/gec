"use client";

import * as React from "react";
import {
	Bell,
	Building2,
	Check,
	ChevronDown,
	ChevronRight,
	Columns3,
	Columns3Cog,
	Database,
	FileText,
	Globe2,
	Home,
	KeyRound,
	Layers,
	Loader2,
	PlusCircle,
	Settings2,
	ShieldCheck,
	Table2,
	Users,
	Wallet,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
	SidebarTrigger,
	useSidebar,
} from "@/components/ui/sidebar";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { getRouteAccessConfig, type Role } from "@/lib/route-access";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { hasDemoCapability, type DemoCapability } from "@/lib/demo-capabilities";
import { usePrefetchObra } from "@/lib/use-prefetch-obra";

type NavItem = {
	title: string;
	href: string;
	icon: React.ComponentType<{ className?: string }>;
	items?: {
		title: string;
		href: string;
	}[];
};

const navItems: NavItem[] = [
	{
		title: "Dashboard",
		href: "/dashboard",
		icon: Home,
	},
	{
		title: "Excel",
		href: "/excel",
		icon: Database,
	},
	{
		title: "Notificaciones",
		href: "/notifications",
		icon: Bell,
	},
];

const adminItems: NavItem[] = [
	{
		title: "Usuarios",
		href: "/admin/users",
		icon: Users,
	},
	{
		title: "Roles y Permisos",
		href: "/admin/roles",
		icon: ShieldCheck,
	},
	{
		title: "Facturacion",
		href: "/billing",
		icon: Wallet,
	},
	{
		title: "Configuracion de Obras",
		href: "/admin/obra-defaults",
		icon: Settings2,
	},
	{
		title: "Tabla Principal",
		href: "/admin/main-table-config",
		icon: Columns3Cog,
	},
	{
		title: "Demo Links",
		href: "/admin/demo-links",
		icon: KeyRound,
	},
	{
		title: "Auditoria",
		href: "/admin/audit-log",
		icon: FileText,
	},
	{
		title: "Macro Tablas",
		href: "/macro",
		icon: Layers,
	},
	{
		title: "Gastos API",
		href: "/admin/expenses",
		icon: Wallet,
	},
];

const ignacioItems: NavItem[] = [
	{
		title: "Organizaciones",
		href: "/admin/tenants",
		icon: Building2,
	},
	{
		title: "Secretos API",
		href: "/admin/tenant-secrets",
		icon: KeyRound,
	},
	{
		title: "Gastos Globales",
		href: "/admin/expenses/all",
		icon: Globe2,
	},
];

type SidebarMacroTable = {
	id: string;
	name: string;
	position: number;
};

type SidebarPrefetchLinkProps = React.ComponentProps<typeof Link>;

const SidebarPrefetchLink = React.forwardRef<
	HTMLAnchorElement,
	SidebarPrefetchLinkProps
>(function SidebarPrefetchLink(
	{ href, onMouseEnter, onFocus, onTouchStart, onPointerDown, ...props },
	ref,
) {
	const router = useRouter();
	const { prefetchObra } = usePrefetchObra();
	const prefetchedRef = React.useRef(false);
	const hrefValue = typeof href === "string" ? href : href.toString();
	const shouldIdlePrefetchExcel = hrefValue === "/excel";

	const runPrefetch = React.useCallback(() => {
		if (prefetchedRef.current || !hrefValue.startsWith("/")) return;
		prefetchedRef.current = true;

		router.prefetch(hrefValue);

		const obraMatch = hrefValue.match(/^\/excel\/([^/?#]+)$/);
		if (obraMatch?.[1]) {
			prefetchObra(obraMatch[1]);
		}
	}, [hrefValue, prefetchObra, router]);

	React.useEffect(() => {
		if (!shouldIdlePrefetchExcel) return;
		let cancelled = false;
		let idleHandle: number | null = null;
		let timeoutHandle: number | null = null;

		const trigger = () => {
			if (cancelled) return;
			runPrefetch();
		};

		if (
			typeof window !== "undefined" &&
			typeof window.requestIdleCallback === "function"
		) {
			idleHandle = window.requestIdleCallback(trigger, { timeout: 1500 });
		} else {
			timeoutHandle = window.setTimeout(trigger, 250);
		}

		return () => {
			cancelled = true;
			if (
				idleHandle != null &&
				typeof window !== "undefined" &&
				typeof window.cancelIdleCallback === "function"
			) {
				window.cancelIdleCallback(idleHandle);
			}
			if (timeoutHandle != null) {
				window.clearTimeout(timeoutHandle);
			}
		};
	}, [runPrefetch, shouldIdlePrefetchExcel]);

	return (
		<Link
			ref={ref}
			href={href}
			onMouseEnter={(event) => {
				onMouseEnter?.(event);
				runPrefetch();
			}}
			onFocus={(event) => {
				onFocus?.(event);
				runPrefetch();
			}}
			onTouchStart={(event) => {
				onTouchStart?.(event);
				runPrefetch();
			}}
			onPointerDown={(event) => {
				onPointerDown?.(event);
				runPrefetch();
			}}
			{...props}
			prefetch={false}
		/>
	);
});

export function AppSidebar({
	user,
	userRoles,
	tenants,
	sidebarMacroTables,
	demoMode = false,
	demoLabel = null,
	demoCapabilities = [],
	...props
}: React.ComponentProps<typeof Sidebar> & {
	user?: { email?: string } | null;
	userRoles?: {
		roles: Role[];
		isAdmin: boolean;
		isSuperAdmin: boolean;
		tenantId: string | null;
	} | null;
	tenants?: { id: string; name: string | null }[];
	sidebarMacroTables?: SidebarMacroTable[];
	demoMode?: boolean;
	demoLabel?: string | null;
	demoCapabilities?: DemoCapability[];
}) {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const router = useRouter();
	const { state } = useSidebar();
	const [switchingTenantId, setSwitchingTenantId] = React.useState<
		string | null
	>(null);
	const [macroTables, setMacroTables] = React.useState<SidebarMacroTable[]>(
		sidebarMacroTables ?? [],
	);
	const tenantOptions = tenants ?? [];
	const activeTenantId = userRoles?.tenantId ?? null;
	const activeMacroTableId = searchParams.get("macroId");

	React.useEffect(() => {
		setMacroTables(sidebarMacroTables ?? []);
	}, [sidebarMacroTables]);

	React.useEffect(() => {
		if (!userRoles?.tenantId) {
			setMacroTables([]);
			return;
		}
		if (sidebarMacroTables) return;

		let cancelled = false;
		(async () => {
			try {
				const response = await fetch("/api/sidebar-macro-tables", {
					cache: "no-store",
				});
				if (!response.ok) return;
				const payload = (await response.json()) as {
					tables?: SidebarMacroTable[];
				};
				if (!cancelled) {
					setMacroTables(Array.isArray(payload.tables) ? payload.tables : []);
				}
			} catch (error) {
				if (!cancelled) {
					console.error("[sidebar-macro-tables] client fetch failed", error);
				}
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [demoMode, sidebarMacroTables, userRoles?.tenantId]);

	const handleTenantSwitch = React.useCallback(
		async (tenantId: string) => {
			setSwitchingTenantId(tenantId);
			try {
				const response = await fetch(`/api/tenants/${tenantId}/switch`, {
					method: "POST",
				});
				if (!response.ok) {
					console.error("[tenant-switch] failed", response.status);
					return;
				}
				router.refresh();
			} catch (error) {
				console.error("[tenant-switch] error", error);
			} finally {
				setSwitchingTenantId((current) =>
					current === tenantId ? null : current,
				);
			}
		},
		[router],
	);
	const activeTenant =
		tenantOptions.find((tenant) => tenant.id === activeTenantId) ??
		tenantOptions[0] ??
		null;
	const isMacroTablesActive = Boolean(
		pathname === "/macro" &&
		activeMacroTableId &&
		macroTables.some((table) => table.id === activeMacroTableId),
	);

	const canAccessRoute = React.useCallback(
		(href: string): boolean => {
			if (demoMode) {
				if (href === "/dashboard") {
					return hasDemoCapability(demoCapabilities, "dashboard");
				}
				if (href === "/excel" || href.startsWith("/excel/")) {
					return hasDemoCapability(demoCapabilities, "excel");
				}
				if (href === "/macro" || href.startsWith("/macro/")) {
					return hasDemoCapability(demoCapabilities, "macro");
				}
				if (href === "/notifications" || href === "/profile") {
					return false;
				}
			}
			if (userRoles?.isAdmin || userRoles?.isSuperAdmin) {
				return true;
			}

			const config = getRouteAccessConfig(href);
			if (!config) {
				return true;
			}

			if (config.allowedRoles.length === 0) {
				return true;
			}

			return config.allowedRoles.some((role) =>
				userRoles?.roles.includes(role),
			);
		},
		[demoCapabilities, demoMode, userRoles],
	);

	const filteredNavItems = React.useMemo(
		() => navItems.filter((item) => canAccessRoute(item.href)),
		[canAccessRoute],
	);
	const macroTablesInsertionHref = React.useMemo(() => {
		if (macroTables.length === 0 || filteredNavItems.length === 0) return null;
		const notificationsItem = filteredNavItems.find(
			(item) => item.href === "/notifications",
		);
		if (notificationsItem) return notificationsItem.href;
		const excelItem = filteredNavItems.find((item) => item.href === "/excel");
		if (excelItem) return excelItem.href;
		return filteredNavItems[filteredNavItems.length - 1]?.href ?? null;
	}, [filteredNavItems, macroTables]);

	const filteredAdminItems = React.useMemo(
		() =>
			userRoles?.isAdmin || userRoles?.isSuperAdmin ? adminItems : [],
		[userRoles],
	);

	const filteredIgnacioItems = React.useMemo(
		() =>
			userRoles?.isSuperAdmin || user?.email === "ignacioliotti@gmail.com"
				? ignacioItems
				: [],
		[userRoles, user?.email],
	);

	const handleEnterRealApp = React.useCallback(async () => {
		try {
			await fetch("/api/demo/session/exit", {
				method: "POST",
			});
		} catch (error) {
			console.error("[demo-exit] failed to clear demo session", error);
		}
		window.location.assign("/dashboard?returnTo=%2Fdashboard");
	}, []);

	return (
		<Sidebar collapsible="icon" {...props}>
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<div className={state === "collapsed" ? "space-y-2" : ""}>
							<div
								className={
									state === "collapsed" ? "space-y-2" : "flex items-start gap-2"
								}
							>
								<SidebarMenuButton
									size="lg"
									asChild
									className={state === "collapsed" ? "" : "min-w-0 flex-1"}
								>
									<SidebarPrefetchLink
										href="/"
										className="flex w-full min-w-0 items-center gap-3 px-2 py-1.5"
									>
										<div
											className={`bg-orange-primary text-sidebar-primary-foreground flex aspect-square items-center justify-center rounded-full ${state === "collapsed" ? "size-8" : "size-10"
												}`}
										/>
										<div className="grid flex-1 text-left text-sm leading-tight">
											<span className="truncate font-mono text-lg font-semibold leading-[16px]">
												Sintesis
											</span>
											<span className="truncate text-xs">
												Plataforma de gestion
											</span>
										</div>
									</SidebarPrefetchLink>
								</SidebarMenuButton>
								<SidebarTrigger
									className={`shrink-0 border bg-sidebar-accent/40 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground ${state === "collapsed" ? "mx-auto flex" : "mt-1"
										}`}
								/>
							</div>
							{demoMode && activeTenant ? (
								state === "collapsed" ? (
									<div
										className="flex w-full items-center justify-center rounded-md border bg-sidebar-accent/40 py-2.5"
										title={activeTenant.name ?? "Demo"}
									>
										<Building2 className="size-5 text-muted-foreground" />
									</div>
								) : (
									<div className="flex w-full items-center justify-between rounded-md border bg-sidebar-accent/40 px-3 py-2.5 text-left text-sm font-medium">
										<div className="min-w-0">
											<p className="text-xs font-normal text-muted-foreground">
												Demo
											</p>
											<p className="truncate">
												{activeTenant.name ?? "Organizacion demo"}
											</p>
										</div>
									</div>
								)
							) : tenantOptions.length > 0 ? (
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										{state === "collapsed" ? (
											<button
												className="flex w-full items-center justify-center rounded-md border bg-sidebar-accent/40 py-2.5"
												type="button"
												title={activeTenant?.name ?? "Seleccionar organizacion"}
											>
												<Building2 className="size-5 text-muted-foreground" />
											</button>
										) : (
											<button
												className="flex w-full items-center justify-between rounded-md border bg-sidebar-accent/40 px-3 py-2.5 text-left text-sm font-medium"
												type="button"
											>
												<div className="min-w-0">
													<p className="text-xs font-normal text-muted-foreground">
														Organizacion
													</p>
													<p className="truncate">
														{activeTenant?.name ?? "Seleccionar"}
													</p>
												</div>
												<ChevronDown className="ml-2 size-4 text-muted-foreground" />
											</button>
										)}
									</DropdownMenuTrigger>
									<DropdownMenuContent
										align="start"
										side="bottom"
										className="w-64"
									>
										<DropdownMenuLabel>Tus organizaciones</DropdownMenuLabel>
										<DropdownMenuSeparator />
										{tenantOptions.map((tenant) => {
											const isActive = tenant.id === activeTenantId;
											const isPending = switchingTenantId === tenant.id;
											return (
												<DropdownMenuItem
													key={tenant.id}
													onSelect={(event) => {
														event.preventDefault();
														if (!isPending) {
															void handleTenantSwitch(tenant.id);
														}
													}}
													className="cursor-pointer"
													disabled={isPending}
												>
													<div className="flex w-full items-center gap-2">
														<span className="truncate">
															{tenant.name ?? "Sin nombre"}
														</span>
														{isPending ? (
															<Loader2 className="ml-auto size-4 animate-spin text-muted-foreground" />
														) : (
															isActive && (
																<Check className="ml-auto size-4 text-primary" />
															)
														)}
													</div>
												</DropdownMenuItem>
											);
										})}
										<DropdownMenuSeparator />
										<DropdownMenuItem asChild>
											<SidebarPrefetchLink
												href="/tenants/new"
												className="flex items-center gap-2"
											>
												<PlusCircle className="size-4" />
												<span>Crear organizacion</span>
											</SidebarPrefetchLink>
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							) : state === "collapsed" ? (
								<SidebarPrefetchLink
									href="/tenants/new"
									className="flex items-center justify-center rounded-md border border-dashed p-2 text-muted-foreground hover:bg-sidebar-accent/40"
									title="Crear organizacion"
								>
									<PlusCircle className="size-5" />
								</SidebarPrefetchLink>
							) : (
								<SidebarPrefetchLink
									href="/tenants/new"
									className="block rounded-md border border-dashed px-3 py-2 text-center text-xs font-medium text-muted-foreground hover:bg-sidebar-accent/40"
								>
									Crear organizacion
								</SidebarPrefetchLink>
							)}
						</div>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>

			<SidebarContent>
				{filteredNavItems.length > 0 && (
					<SidebarGroup>
						<SidebarGroupLabel>Principal</SidebarGroupLabel>
						<SidebarGroupContent>
							<SidebarMenu>
								{filteredNavItems.map((item) => {
									const isActive = pathname === item.href;
									const showTablasBeforeThis =
										item.href === macroTablesInsertionHref;

									return (
										<React.Fragment key={item.title}>
											{showTablasBeforeThis &&
												(state === "collapsed" ? (
													<SidebarMenuItem>
														<DropdownMenu>
															<DropdownMenuTrigger asChild>
																<SidebarMenuButton
																	asChild
																	isActive={isMacroTablesActive}
																	tooltip="Tablas"
																>
																	<button type="button">
																		<Table2 className="size-4" />
																	</button>
																</SidebarMenuButton>
															</DropdownMenuTrigger>
															<DropdownMenuContent
																side="right"
																align="start"
																className="w-72"
															>
																<DropdownMenuLabel>
																	Tablas
																</DropdownMenuLabel>
																<DropdownMenuSeparator />
																{macroTables.map((table) => {
																	const tableHref = `/macro?macroId=${encodeURIComponent(table.id)}`;
																	const isTableActive =
																		pathname === "/macro" &&
																		activeMacroTableId === table.id;
																	return (
																		<DropdownMenuItem key={table.id} asChild>
																			<SidebarPrefetchLink
																				href={tableHref}
																				className={
																					isTableActive ? "font-semibold" : undefined
																				}
																			>
																				<Columns3 className="size-4" />
																				<span className="truncate">
																					{table.name}
																				</span>
																			</SidebarPrefetchLink>
																		</DropdownMenuItem>
																	);
																})}
															</DropdownMenuContent>
														</DropdownMenu>
													</SidebarMenuItem>
												) : (
													<Collapsible
														defaultOpen
														className="group/collapsible"
													>
														<SidebarMenuItem>
															<CollapsibleTrigger asChild>
																<SidebarMenuButton
																	asChild
																	isActive={isMacroTablesActive}
																	tooltip="Tablas"
																>
																	<button type="button">
																		<Table2 className="size-4" />
																		<span>Tablas</span>
																		<ChevronRight className="ml-auto size-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
																	</button>
																</SidebarMenuButton>
															</CollapsibleTrigger>
															<CollapsibleContent>
																<SidebarMenuSub>
																	{macroTables.map((table) => {
																		const tableHref = `/macro?macroId=${encodeURIComponent(table.id)}`;
																		const isTableActive =
																			pathname === "/macro" &&
																			activeMacroTableId === table.id;
																		return (
																			<SidebarMenuSubItem key={table.id}>
																				<SidebarMenuSubButton
																					asChild
																					isActive={isTableActive}
																				>
																					<SidebarPrefetchLink href={tableHref}>
																						<Columns3 className="size-4" />
																						{table.name}
																					</SidebarPrefetchLink>
																				</SidebarMenuSubButton>
																			</SidebarMenuSubItem>
																		);
																	})}
																</SidebarMenuSub>
															</CollapsibleContent>
														</SidebarMenuItem>
													</Collapsible>
												))}
											<SidebarMenuItem>
												<SidebarMenuButton
													asChild
													isActive={isActive}
													tooltip={item.title}
												>
													<SidebarPrefetchLink href={item.href}>
														<item.icon className="size-4" />
														<span>{item.title}</span>
													</SidebarPrefetchLink>
												</SidebarMenuButton>
											</SidebarMenuItem>
										</React.Fragment>
									);
								})}
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				)}

				{filteredAdminItems.length > 0 && (
					<>
						<Separator />
						<SidebarGroup>
							<SidebarGroupLabel>Administracion</SidebarGroupLabel>
							<SidebarGroupContent>
								<SidebarMenu>
									{filteredAdminItems.map((item) => {
										const isActive =
											pathname === item.href || pathname.startsWith(item.href);
										return (
											<SidebarMenuItem key={item.title}>
												<SidebarMenuButton
													asChild
													isActive={isActive}
													tooltip={item.title}
												>
													<SidebarPrefetchLink href={item.href}>
														<item.icon className="size-4" />
														<span>{item.title}</span>
													</SidebarPrefetchLink>
												</SidebarMenuButton>
											</SidebarMenuItem>
										);
									})}
								</SidebarMenu>
							</SidebarGroupContent>
						</SidebarGroup>
					</>
				)}

				{filteredIgnacioItems.length > 0 && (
					<>
						<Separator />
						<SidebarGroup className="rounded-lg bg-purple-500/20 p-2">
							<SidebarGroupLabel>Ignacio</SidebarGroupLabel>
							<SidebarGroupContent>
								<SidebarMenu>
									{filteredIgnacioItems.map((item) => {
										const isActive =
											pathname === item.href || pathname.startsWith(item.href);
										return (
											<SidebarMenuItem key={item.title}>
												<SidebarMenuButton
													asChild
													isActive={isActive}
													tooltip={item.title}
												>
													<SidebarPrefetchLink href={item.href}>
														<item.icon className="size-4" />
														<span>{item.title}</span>
													</SidebarPrefetchLink>
												</SidebarMenuButton>
											</SidebarMenuItem>
										);
									})}
								</SidebarMenu>
							</SidebarGroupContent>
						</SidebarGroup>
					</>
				)}
			</SidebarContent>

			<SidebarFooter>
				{user ? (
					<SidebarMenu>
						<SidebarMenuItem>
							<SidebarMenuButton
								size="lg"
								className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
							>
								<div className="bg-muted flex aspect-square size-8 items-center justify-center rounded-lg">
									<span className="text-xs font-semibold">
										{user.email?.[0]?.toUpperCase() || "U"}
									</span>
								</div>
								<div className="grid flex-1 text-left text-sm leading-tight">
									<span className="truncate font-semibold">
										{user.email?.split("@")[0] || "User"}
									</span>
									<span className="truncate text-xs">{user.email}</span>
								</div>
							</SidebarMenuButton>
						</SidebarMenuItem>
					</SidebarMenu>
				) : demoMode ? (
					<SidebarMenu>
						<SidebarMenuItem>
							<div className="space-y-2">
								<SidebarMenuButton size="lg" className="pointer-events-none">
									<div className="bg-orange-primary/15 flex aspect-square size-8 items-center justify-center rounded-lg text-orange-700">
										<span className="text-xs font-semibold">D</span>
									</div>
									<div className="grid flex-1 text-left text-sm leading-tight">
										<span className="truncate font-semibold">
											{demoLabel ?? "Sesion demo"}
										</span>
										<span className="truncate text-xs">Acceso compartido</span>
									</div>
								</SidebarMenuButton>
								<button
									type="button"
									onClick={handleEnterRealApp}
									className={`flex w-full items-center justify-center gap-2 rounded-md border border-sidebar-border bg-sidebar-accent/40 px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent ${state === "collapsed" ? "px-2" : ""
										}`}
									title="Ingresar a la app real"
								>
									<KeyRound className="size-4 shrink-0" />
									{state === "collapsed" ? null : <span>Ingresar con mi cuenta</span>}
								</button>
							</div>
						</SidebarMenuItem>
					</SidebarMenu>
				) : null}
			</SidebarFooter>
		</Sidebar>
	);
}
