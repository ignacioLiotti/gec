"use client";

import * as React from "react";
import {
	Home,
	Users,
	ShieldCheck,
	ChevronDown,
	ChevronRight,
	FileText,
	Bell,
	Database,
	KeyRound,
	Settings2,
	PlusCircle,
	Check,
	Building2,
	Loader2,
	Table2,
	FolderCogIcon,
	TableIcon,
	Columns3Cog,
	Columns3,
	Layers,
	Wallet,
	Globe2,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

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
import { getRouteAccessConfig, type Role } from "@/lib/route-access";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type NavItem = {
	title: string;
	href: string;
	icon: React.ComponentType<{ className?: string }>;
	badge?: string;
	items?: {
		title: string;
		href: string;
	}[];
};

/**
 * ============================================================================
 * SIDEBAR NAVIGATION CONFIGURATION
 * ============================================================================
 * 
 * THIS IS WHERE YOU CONFIGURE THE SIDEBAR NAVIGATION ITEMS
 * 
 * File: components/app-sidebar.tsx
 * 
 * To add a new navigation item:
 * 1. Add a new entry to navItems, adminItems, or devItems array below
 * 2. The item will automatically be filtered based on user roles
 * 3. Make sure the route is also configured in lib/route-access.ts if it needs protection
 * 
 * Navigation Sections:
 * - navItems: Main navigation (shown to all users, filtered by role access)
 * - adminItems: Admin section (only shown to admins/superadmins)
 * - devItems: Development section (shown to all, typically for dev/testing)
 * 
 * ============================================================================
 */

// Navigation structure for your multi-tenant app
const navItems: NavItem[] = [
	{
		title: "Dashboard",
		href: "/",
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
		title: "Configuración de Obras",
		href: "/admin/obra-defaults",
		icon: Settings2,
	},
	{
		title: "Tabla Principal",
		href: "/admin/main-table-config",
		icon: Columns3Cog,
	},

	{
		title: "Auditoría",
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

// const devItems: NavItem[] = [
// 	{
// 		title: "Bootstrap",
// 		href: "/dev/bootstrap",
// 		icon: Wrench,
// 	},
// 	{
// 		title: "Prueba de Notificaciones",
// 		href: "/dev/notifications-playground",
// 		icon: Play,
// 	},
// 	{
// 		title: "Demo de Permisos",
// 		href: "/permissions-demo",
// 		icon: ShieldCheck,
// 	},
// 	{
// 		title: "Páginas de Prueba",
// 		href: "#",
// 		icon: FileText,
// 		items: [
// 			{ title: "Prueba 1", href: "/test" },
// 			{ title: "Prueba 2", href: "/test2" },
// 		],
// 	},
// ];

type SidebarMacroTable = {
	id: string;
	name: string;
	position: number;
};

export function AppSidebar({
	user,
	userRoles,
	tenants,
	sidebarMacroTables,
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
}) {
	const pathname = usePathname();
	const router = useRouter();
	const { state } = useSidebar();
	const [switchingTenantId, setSwitchingTenantId] = React.useState<string | null>(null);
	const tenantOptions = tenants ?? [];
	const activeTenantId = userRoles?.tenantId ?? null;

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
				setSwitchingTenantId((current) => (current === tenantId ? null : current));
			}
		},
		[router]
	);
	const activeTenant =
		tenantOptions.find((tenant) => tenant.id === activeTenantId) ??
		tenantOptions[0] ??
		null;

	// Helper function to check if user can access a route
	const canAccessRoute = React.useCallback(
		(href: string): boolean => {
			// Admin and superadmin can access everything
			if (userRoles?.isAdmin || userRoles?.isSuperAdmin) {
				return true;
			}

			// Check route access config
			const config = getRouteAccessConfig(href);
			console.log("config", config);
			if (!config) {
				// Route not protected, allow access
				return true;
			}

			// If no roles required, allow access
			if (config.allowedRoles.length === 0) {
				return true;
			}

			// Check if user has any of the required roles
			return config.allowedRoles.some((role) =>
				userRoles?.roles.includes(role)
			);
		},
		[userRoles]
	);

	// Filter navigation items based on user roles
	const filteredNavItems = React.useMemo(
		() => navItems.filter((item) => canAccessRoute(item.href)),
		[canAccessRoute]
	);
	console.log("NavItems", navItems);
	console.log("filteredNavItems", filteredNavItems);

	// Filter admin items (only show to admins)
	const filteredAdminItems = React.useMemo(
		() =>
			userRoles?.isAdmin || userRoles?.isSuperAdmin
				? adminItems
				: [],
		[userRoles]
	);

	// Filter Ignacio items (only show to superadmin or ignacioliotti@gmail.com)
	const filteredIgnacioItems = React.useMemo(
		() =>
			userRoles?.isSuperAdmin || user?.email === "ignacioliotti@gmail.com"
				? ignacioItems
				: [],
		[userRoles, user?.email]
	);

	// Filter dev items (only show to admins)
	// const filteredDevItems = React.useMemo(
	// 	() =>
	// 		userRoles?.isAdmin || userRoles?.isSuperAdmin
	// 			? devItems
	// 			: [],
	// 	[userRoles]
	// );

	return (
		<Sidebar collapsible="icon" {...props}>
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<div className="space-y-2">
							<SidebarMenuButton size="lg" asChild>
								<Link href="/" className="flex w-full items-center gap-3 px-2 py-1.5">
									{/* if sidebar is closed make logo smaller */}
									<div
										className={`bg-orange-primary text-sidebar-primary-foreground flex aspect-square items-center justify-center rounded-full ${state === "collapsed" ? "size-8" : "size-10"
											}`}
									/>
									<div className="grid flex-1 text-left text-sm leading-tight">
										<span className="truncate font-semibold font-mono text-lg leading-[16px]">
											Sintesis
										</span>
										<span className="truncate text-xs">Plataforma de gestión</span>
									</div>
								</Link>
							</SidebarMenuButton>
							{tenantOptions.length > 0 ? (
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										{state === "collapsed" ? (
											<button
												className="flex w-full items-center justify-center rounded-md border bg-sidebar-accent/40 py-2.5"
												type="button"
												title={activeTenant?.name ?? "Seleccionar organización"}
											>
												<Building2 className="size-5 text-muted-foreground" />
											</button>
										) : (
											<button
												className="flex w-full items-center justify-between rounded-md border bg-sidebar-accent/40 px-3 py-2.5 text-left text-sm font-medium "
												type="button"
											>
												<div className="min-w-0">
													<p className="text-xs font-normal text-muted-foreground">Organización</p>
													<p className="truncate">{activeTenant?.name ?? "Seleccionar"}</p>
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
											<Link href="/tenants/new" className="flex items-center gap-2">
												<PlusCircle className="size-4" />
												<span>Crear organización</span>
											</Link>
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							) : (
								state === "collapsed" ? (
									<Link
										href="/tenants/new"
										className="flex items-center justify-center rounded-md border border-dashed p-2 text-muted-foreground hover:bg-sidebar-accent/40"
										title="Crear organización"
									>
										<PlusCircle className="size-5" />
									</Link>
								) : (
									<Link
										href="/tenants/new"
										className="block rounded-md border border-dashed px-3 py-2 text-center text-xs font-medium text-muted-foreground hover:bg-sidebar-accent/40"
									>
										Crear organización
									</Link>
								)
							)}
						</div>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>

			<SidebarContent>
				{/* Main Navigation */}
				{filteredNavItems.length > 0 && (
					<SidebarGroup>
						<SidebarGroupLabel>Principal</SidebarGroupLabel>
						<SidebarGroupContent>
							<SidebarMenu>
								{filteredNavItems.map((item, index) => {
									const isActive = pathname === item.href;
									const showTablasBeforeThis = item.href === "/notifications" && sidebarMacroTables && sidebarMacroTables.length > 0;

									return (
										<React.Fragment key={item.title}>
											{/* Tablas dropdown - inserted before Notifications */}
											{showTablasBeforeThis && (
												state === "collapsed" ? (
													<SidebarMenuItem>
														<DropdownMenu>
															<DropdownMenuTrigger asChild>
																<SidebarMenuButton tooltip="Tablas">
																	<Table2 className="size-4" />
																</SidebarMenuButton>
															</DropdownMenuTrigger>
															<DropdownMenuContent side="right" align="start" className="w-72">
																<DropdownMenuLabel>Tablas</DropdownMenuLabel>
																<DropdownMenuSeparator />
																{sidebarMacroTables.map((table) => {
																	const isTableActive = pathname === `/macro/${table.id}`;
																	return (
																		<DropdownMenuItem key={table.id} asChild>
																			<Link
																				href={`/macro/${table.id}`}
																				className={isTableActive ? "font-semibold" : undefined}
																			>
																				<Columns3 className="size-4" />
																				<span className="truncate">{table.name}</span>
																			</Link>
																		</DropdownMenuItem>
																	);
																})}
															</DropdownMenuContent>
														</DropdownMenu>
													</SidebarMenuItem>
												) : (
													<Collapsible defaultOpen className="group/collapsible">
														<SidebarMenuItem>
															<CollapsibleTrigger asChild>
																<SidebarMenuButton tooltip="Tablas">
																	<Table2 className="size-4" />
																	<span>Tablas</span>
																	<ChevronRight className="ml-auto size-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
																</SidebarMenuButton>
															</CollapsibleTrigger>
															<CollapsibleContent>
																<SidebarMenuSub>
																	{sidebarMacroTables.map((table) => {
																		const isTableActive = pathname === `/macro/${table.id}`;
																		return (
																			<SidebarMenuSubItem key={table.id}>
																				<SidebarMenuSubButton asChild isActive={isTableActive}>
																					<Link href={`/macro/${table.id}`}>
																						<Columns3 className="size-4" />
																						{table.name}
																					</Link>
																				</SidebarMenuSubButton>
																			</SidebarMenuSubItem>
																		);
																	})}
																</SidebarMenuSub>
															</CollapsibleContent>
														</SidebarMenuItem>
													</Collapsible>
												)
											)}
											<SidebarMenuItem>
												<SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
													<Link href={item.href}>
														<item.icon className="size-4" />
														<span>{item.title}</span>
													</Link>
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

						{/* Admin Navigation */}
						<SidebarGroup>
							<SidebarGroupLabel>Administración</SidebarGroupLabel>
							<SidebarGroupContent>
								<SidebarMenu>
									{filteredAdminItems.map((item) => {
										const isActive = pathname === item.href || pathname.startsWith(item.href);
										return (
											<SidebarMenuItem key={item.title}>
												<SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
													<Link href={item.href}>
														<item.icon className="size-4" />
														<span>{item.title}</span>
													</Link>
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

						{/* Ignacio Navigation */}
						<SidebarGroup className="bg-purple-500/20 rounded-lg p-2">
							<SidebarGroupLabel>Ignacio</SidebarGroupLabel>
							<SidebarGroupContent>
								<SidebarMenu>
									{filteredIgnacioItems.map((item) => {
										const isActive = pathname === item.href || pathname.startsWith(item.href);
										return (
											<SidebarMenuItem key={item.title}>
												<SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
													<Link href={item.href}>
														<item.icon className="size-4" />
														<span>{item.title}</span>
													</Link>
												</SidebarMenuButton>
											</SidebarMenuItem>
										);
									})}
								</SidebarMenu>
							</SidebarGroupContent>
						</SidebarGroup>
					</>
				)}

				{/* {filteredDevItems.length > 0 && (
					<>
						<Separator />

						
						<SidebarGroup>
							<SidebarGroupLabel>Desarrollo</SidebarGroupLabel>
							<SidebarGroupContent>
								<SidebarMenu>
									{filteredDevItems.map((item) => {
										const isActive = pathname === item.href;
										const hasSubItems = item.items && item.items.length > 0;

										if (hasSubItems) {
											return (
												<SidebarMenuItem key={item.title}>
													<SidebarMenuButton tooltip={item.title}>
														<item.icon className="size-4" />
														<span>{item.title}</span>
														<ChevronDown className="ml-auto size-4 transition-transform group-data-[state=open]:rotate-180" />
													</SidebarMenuButton>
													<SidebarMenuSub>
														{item.items?.map((subItem) => {
															const isSubActive = pathname === subItem.href;
															return (
																<SidebarMenuSubItem key={subItem.title}>
																	<SidebarMenuSubButton asChild isActive={isSubActive}>
																		<Link href={subItem.href}>{subItem.title}</Link>
																	</SidebarMenuSubButton>
																</SidebarMenuSubItem>
															);
														})}
													</SidebarMenuSub>
												</SidebarMenuItem>
											);
										}

										return (
											<SidebarMenuItem key={item.title}>
												<SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
													<Link href={item.href}>
														<item.icon className="size-4" />
														<span>{item.title}</span>
													</Link>
												</SidebarMenuButton>
											</SidebarMenuItem>
										);
									})}
								</SidebarMenu>
							</SidebarGroupContent>
						</SidebarGroup>
					</>
				)} */}
			</SidebarContent>

			<SidebarFooter>
				{user && (
					<SidebarMenu>
						<SidebarMenuItem>
							<SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
								<div className="bg-muted flex aspect-square size-8 items-center justify-center rounded-lg">
									<span className="text-xs font-semibold">
										{user.email?.[0].toUpperCase() || "U"}
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
				)}
			</SidebarFooter>
		</Sidebar >
	);
}
