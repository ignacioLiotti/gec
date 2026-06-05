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
	MessageCircle,
	Settings2,
	ShieldCheck,
	Table2,
	Users,
	Wallet,
	Waypoints,
} from "lucide-react";
import Link, { useLinkStatus } from "next/link";
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
	useSidebar,
} from "@/components/ui/sidebar";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import UserMenu from "@/components/auth/user-menu";
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
import type { DocumentGenerationPermissionMap } from "@/lib/document-generation-server";
import { usePrefetchObra } from "@/lib/use-prefetch-obra";

type NavItem = {
	title: string;
	href: string;
	icon: React.ComponentType<{ className?: string }>;
	requiredPermissions?: string[];
	items?: {
		title: string;
		href: string;
		requiredPermissions?: string[];
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
		title: "Data-flow general",
		href: "/excel/data-flow",
		icon: Waypoints,
		requiredPermissions: ["data-flow:read"],
	},
	{
		title: "Notificaciones",
		href: "/notifications",
		icon: Bell,
	},
];

const documentNavItems: NavItem[] = [
	{
		title: "Generar Documentos",
		href: "/document-generation",
		icon: FileText,
	},
	{
		title: "Historial",
		href: "/document-generation/drafts",
		icon: FileText,
	},
	{
		title: "Revision",
		href: "/document-generation/review",
		icon: FileText,
	},
	{
		title: "Configuracion",
		href: "/document-generation/config",
		icon: FileText,
	},
];

const adminItems: NavItem[] = [
	{
		title: "Usuarios",
		href: "/admin/users",
		icon: Users,
		requiredPermissions: ["admin:users"],
	},
	{
		title: "Roles y Permisos",
		href: "/admin/roles",
		icon: ShieldCheck,
		requiredPermissions: ["admin:roles"],
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
		requiredPermissions: ["admin:obra-defaults"],
	},
	{
		title: "Flujos documentales",
		href: "/admin/document-flows",
		icon: Table2,
	},
	{
		title: "WhatsApp",
		href: "/admin/whatsapp",
		icon: MessageCircle,
		requiredPermissions: ["admin:whatsapp"],
	},
	{
		title: "Document Flow 2",
		href: "/admin/document-flows-2",
		icon: Waypoints,
	},
	{
		title: "Tabla Principal",
		href: "/admin/main-table-config",
		icon: Columns3Cog,
		requiredPermissions: ["admin:main-table-config"],
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
		requiredPermissions: ["admin:audit"],
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

type SidebarPrefetchLinkProps = React.ComponentProps<typeof Link> & {
	/** Icon element to show (will be replaced with spinner when navigating) */
	navIcon?: React.ReactNode;
};
const prefetchedSidebarHrefs = new Set<string>();

/**
 * Inner component that renders the link content with navigation status.
 * Must be a child of Link for useLinkStatus to work.
 */
function SidebarLinkContent({
	children,
	navIcon,
}: {
	children: React.ReactNode;
	navIcon?: React.ReactNode;
}) {
	const { pending } = useLinkStatus();

	return (
		<>
			{navIcon && !pending && navIcon}
			{navIcon && pending && (
				<Loader2 className="size-4 animate-spin" />
			)}
			{children}
		</>
	);
}

const SidebarPrefetchLink = React.forwardRef<
	HTMLAnchorElement,
	SidebarPrefetchLinkProps
>(function SidebarPrefetchLink(
	{ href, onMouseEnter, onFocus, onTouchStart, onPointerDown, navIcon, children, ...props },
	ref,
) {
	const router = useRouter();
	const { prefetch } = router;
	const { prefetchObra } = usePrefetchObra();
	const prefetchedRef = React.useRef(false);
	const hrefValue = typeof href === "string" ? href : href.toString();
	const shouldIdlePrefetchExcel = hrefValue === "/excel";

	const runPrefetch = React.useCallback(() => {
		if (
			prefetchedRef.current ||
			prefetchedSidebarHrefs.has(hrefValue) ||
			!hrefValue.startsWith("/")
		) return;
		prefetchedRef.current = true;
		prefetchedSidebarHrefs.add(hrefValue);

		void Promise.resolve(prefetch(hrefValue)).catch((error) => {
			console.warn("[sidebar-prefetch] route prefetch failed", hrefValue, error);
		});

		const obraMatch = hrefValue.match(/^\/excel\/([^/?#]+)$/);
		if (obraMatch?.[1]) {
			prefetchObra(obraMatch[1]);
		}
	}, [hrefValue, prefetch, prefetchObra]);

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
		>
			<SidebarLinkContent navIcon={navIcon}>
				{children}
			</SidebarLinkContent>
		</Link>
	);
});

export function AppSidebar({
	user,
	userRoles,
	documentPermissions,
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
		permissionKeys?: string[];
	} | null;
	documentPermissions?: DocumentGenerationPermissionMap | null;
	tenants?: { id: string; name: string | null }[];
	sidebarMacroTables?: SidebarMacroTable[];
	demoMode?: boolean;
	demoLabel?: string | null;
	demoCapabilities?: DemoCapability[];
}) {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const queryParams = new URLSearchParams(searchParams);
	const getSearchParam = (key: string): string | null => queryParams.get(key);
	const router = useRouter();
	const { refresh } = router;
	const { state } = useSidebar();
	const [switchingTenantId, setSwitchingTenantId] = React.useState<
		string | null
	>(null);
	const [macroTables, setMacroTables] = React.useState<SidebarMacroTable[]>(
		sidebarMacroTables ?? [],
	);
	const tenantOptions = tenants ?? [];
	const canCreateTenant = Boolean(user && !demoMode);
	const activeTenantId = userRoles?.tenantId ?? null;
	const activeMacroTableId = getSearchParam("macroId");
	const permissionKeySet = React.useMemo(
		() => new Set(userRoles?.permissionKeys ?? []),
		[userRoles?.permissionKeys],
	);

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
				refresh();
			} catch (error) {
				console.error("[tenant-switch] error", error);
			} finally {
				setSwitchingTenantId((current) =>
					current === tenantId ? null : current,
				);
			}
		},
		[refresh],
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
	const isDocumentSectionActive = pathname?.startsWith("/document-generation") ?? false;

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

			if (config.allowedRoles.length > 0) {
				if (
					config.requiredPermissions?.length &&
					config.requiredPermissions.every((permissionKey) =>
						permissionKeySet.has(permissionKey),
					)
				) {
					return true;
				}
				return config.allowedRoles.some((role) =>
					userRoles?.roles.includes(role),
				);
			}

			if (config.requiredPermissions?.length) {
				return config.requiredPermissions.every((permissionKey) =>
					permissionKeySet.has(permissionKey),
				);
			}

			return true;
		},
		[demoCapabilities, demoMode, permissionKeySet, userRoles],
	);

	const canAccessDocumentNav = React.useCallback(
		(href: string): boolean => {
			if (!href.startsWith("/document-generation")) return true;
			if (demoMode) return false;
			if (userRoles?.isAdmin || userRoles?.isSuperAdmin) return true;

			switch (href) {
				case "/document-generation":
				case "/document-generation/drafts":
					return Boolean(user && activeTenantId);
				case "/document-generation/review":
					return Boolean(documentPermissions?.canReview);
				case "/document-generation/config":
					return Boolean(documentPermissions?.canManageTemplates);
				default:
					return false;
			}
		},
		[activeTenantId, demoMode, documentPermissions, user, userRoles],
	);

	const filteredNavItems = React.useMemo(
		() =>
			navItems.filter(
				(item) =>
					canAccessRoute(item.href) &&
					canAccessDocumentNav(item.href) &&
					(!item.requiredPermissions?.length ||
						userRoles?.isAdmin ||
						userRoles?.isSuperAdmin ||
						item.requiredPermissions.every((permissionKey) =>
							permissionKeySet.has(permissionKey),
						)),
			),
		[canAccessDocumentNav, canAccessRoute, permissionKeySet, userRoles],
	);
	const filteredDocumentItems = React.useMemo(
		() =>
			documentNavItems.filter(
				(item) =>
					canAccessRoute(item.href) &&
					canAccessDocumentNav(item.href) &&
					(!item.requiredPermissions?.length ||
						userRoles?.isAdmin ||
						userRoles?.isSuperAdmin ||
						item.requiredPermissions.every((permissionKey) =>
							permissionKeySet.has(permissionKey),
						)),
			),
		[canAccessDocumentNav, canAccessRoute, permissionKeySet, userRoles],
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
			adminItems.filter((item) => {
				if (userRoles?.isAdmin || userRoles?.isSuperAdmin) return true;
				if (!canAccessRoute(item.href)) return false;
				if (!item.requiredPermissions?.length) return false;
				return item.requiredPermissions.every((permissionKey) =>
					permissionKeySet.has(permissionKey),
				);
			}),
		[canAccessRoute, permissionKeySet, userRoles],
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
						<div className="transition-[gap] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]">
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
											className={`bg-orange-primary text-sidebar-primary-foreground flex aspect-square items-center justify-center rounded-full transition-[width,height,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${state === "collapsed" ? "size-8 scale-95" : "size-10 scale-100"
												}`}
										/>
										<div className="grid flex-1 text-left text-sm leading-tight transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] group-data-[collapsible=icon]:-translate-x-1 group-data-[collapsible=icon]:opacity-0">
											<span className="truncate font-mono text-lg font-semibold leading-[16px]">
												Sintesis
											</span>
											<span className="truncate text-xs">
												Plataforma de gestion
											</span>
										</div>
									</SidebarPrefetchLink>
								</SidebarMenuButton>
							</div>
							{tenantOptions.length > 0 ? (
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
										<DropdownMenuLabel>Organizaciones</DropdownMenuLabel>
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
										{canCreateTenant && (
											<>
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
											</>
										)}
									</DropdownMenuContent>
								</DropdownMenu>
							) : canCreateTenant ? (
								state === "collapsed" ? (
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
								)
							) : null}
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
																				navIcon={<Columns3 className="size-4" />}
																			>
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
																					<SidebarPrefetchLink href={tableHref} navIcon={<Columns3 className="size-4" />}>
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
													<SidebarPrefetchLink href={item.href} navIcon={<item.icon className="size-4" />}>
														<span>{item.title}</span>
													</SidebarPrefetchLink>
												</SidebarMenuButton>
											</SidebarMenuItem>
										</React.Fragment>
									);
								})}
								{filteredDocumentItems.length > 0 &&
									(state === "collapsed" ? (
										<SidebarMenuItem>
											<DropdownMenu>
												<DropdownMenuTrigger asChild>
													<SidebarMenuButton
														asChild
														isActive={isDocumentSectionActive}
														tooltip="Documentos"
													>
														<button type="button">
															<FileText className="size-4" />
														</button>
													</SidebarMenuButton>
												</DropdownMenuTrigger>
												<DropdownMenuContent
													side="right"
													align="start"
													className="w-72"
												>
													<DropdownMenuLabel>Documentos</DropdownMenuLabel>
													<DropdownMenuSeparator />
													{filteredDocumentItems.map((item) => {
														const isActive = pathname === item.href;
														return (
															<DropdownMenuItem key={item.href} asChild>
																<SidebarPrefetchLink
																	href={item.href}
																	className={isActive ? "font-semibold" : undefined}
																	navIcon={<item.icon className="size-4" />}
																>
																	<span className="truncate">{item.title}</span>
																</SidebarPrefetchLink>
															</DropdownMenuItem>
														);
													})}
												</DropdownMenuContent>
											</DropdownMenu>
										</SidebarMenuItem>
									) : (
										<Collapsible
											defaultOpen={isDocumentSectionActive}
											className="group/collapsible"
										>
											<SidebarMenuItem>
												<CollapsibleTrigger asChild>
													<SidebarMenuButton
														asChild
														isActive={isDocumentSectionActive}
														tooltip="Documentos"
													>
														<button type="button">
															<FileText className="size-4" />
															<span>Documentos</span>
															<ChevronRight className="ml-auto size-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
														</button>
													</SidebarMenuButton>
												</CollapsibleTrigger>
												<CollapsibleContent>
													<SidebarMenuSub>
														{filteredDocumentItems.map((item) => {
															const isActive = pathname === item.href;
															return (
																<SidebarMenuSubItem key={item.href}>
																	<SidebarMenuSubButton
																		asChild
																		isActive={isActive}
																	>
																		<SidebarPrefetchLink href={item.href} navIcon={<item.icon className="size-4" />}>
																			{item.title}
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
													<SidebarPrefetchLink href={item.href} navIcon={<item.icon className="size-4" />}>
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
													<SidebarPrefetchLink href={item.href} navIcon={<item.icon className="size-4" />}>
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
							<UserMenu
								email={user.email}
								userRoles={userRoles}
								variant="sidebar"
							/>
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
									className={`flex w-full items-center justify-center gap-2 overflow-hidden rounded-md border border-sidebar-border bg-sidebar-accent/40 px-3 py-2 text-sm font-medium text-sidebar-foreground transition-[background-color,padding,gap] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-sidebar-accent ${state === "collapsed" ? "gap-0 px-2" : ""
										}`}
									title="Ingresar a la app real"
								>
									<KeyRound className="size-4 shrink-0" />
									<span className="truncate transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] group-data-[collapsible=icon]:-translate-x-1 group-data-[collapsible=icon]:opacity-0">
										Ingresar con mi cuenta
									</span>
								</button>
							</div>
						</SidebarMenuItem>
					</SidebarMenu>
				) : null}
			</SidebarFooter>
		</Sidebar>
	);
}
