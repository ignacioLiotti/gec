"use client";

import * as React from "react";
import {
	Home,
	Users,
	ShieldCheck,
	Wrench,
	ChevronDown,
	FileText,
	Bell,
	FileCheck,
	Database,
	Play,
	User,
	KeyRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

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
import { Separator } from "@/components/ui/separator";
import { getRouteAccessConfig, type Role } from "@/lib/route-access";

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
		title: "Certificados",
		href: "/certificados",
		icon: FileCheck,
	},
	{
		title: "Notificaciones",
		href: "/notifications",
		icon: Bell,
	},
	{
		title: "Perfil",
		href: "/profile",
		icon: User,
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
		title: "Secretos API",
		href: "/admin/tenant-secrets",
		icon: KeyRound,
	},
	{
		title: "Auditoría",
		href: "/admin/audit-log",
		icon: FileText,
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

export function AppSidebar({
	user,
	userRoles,
	...props
}: React.ComponentProps<typeof Sidebar> & {
	user?: { email?: string } | null;
	userRoles?: {
		roles: Role[];
		isAdmin: boolean;
		isSuperAdmin: boolean;
		tenantId: string | null;
	} | null;
}) {
	const pathname = usePathname();
	const { state } = useSidebar();

	// Helper function to check if user can access a route
	const canAccessRoute = React.useCallback(
		(href: string): boolean => {
			// Admin and superadmin can access everything
			if (userRoles?.isAdmin || userRoles?.isSuperAdmin) {
				return true;
			}

			// Check route access config
			const config = getRouteAccessConfig(href);
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

	// Filter admin items (only show to admins)
	const filteredAdminItems = React.useMemo(
		() =>
			userRoles?.isAdmin || userRoles?.isSuperAdmin
				? adminItems
				: [],
		[userRoles]
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
						<SidebarMenuButton size="lg" asChild>
							<Link href="/" className='container'>
								{/* if sidebar is closed make logo smaller */}
								<div className={`bg-orange-primary text-sidebar-primary-foreground flex aspect-square items-center justify-center rounded-full ${state === 'collapsed' ? 'size-8' : 'size-10'}`} />
								<div className="grid flex-1 text-left text-sm leading-tight pt-[5px]">
									<span className="truncate font-semibold font-mono text-lg leading-[16px]">Sintesis</span>
									<span className="truncate text-xs">Plataforma de gestión</span>
								</div>
							</Link>
						</SidebarMenuButton>
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
								{filteredNavItems.map((item) => {
									const isActive = pathname === item.href;
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
