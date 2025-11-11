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
		title: "Notifications",
		href: "/notifications",
		icon: Bell,
	},
	{
		title: "Onboarding",
		href: "/onboarding",
		icon: FileText,
	},
];

const adminItems: NavItem[] = [
	{
		title: "Users",
		href: "/admin/users",
		icon: Users,
	},
	{
		title: "Roles & Permissions",
		href: "/admin/roles",
		icon: ShieldCheck,
	},
];

const devItems: NavItem[] = [
	{
		title: "Bootstrap",
		href: "/dev/bootstrap",
		icon: Wrench,
	},
	{
		title: "Notifications Playground",
		href: "/dev/notifications-playground",
		icon: Play,
	},
	{
		title: "Permissions Demo",
		href: "/permissions-demo",
		icon: ShieldCheck,
	},
	{
		title: "Test Pages",
		href: "#",
		icon: FileText,
		items: [
			{ title: "Test 1", href: "/test" },
			{ title: "Test 2", href: "/test2" },
		],
	},
];

export function AppSidebar({
	user,
	...props
}: React.ComponentProps<typeof Sidebar> & {
	user?: { email?: string } | null;
}) {
	const pathname = usePathname();
	const { state } = useSidebar();

	return (
		<Sidebar collapsible="icon" {...props}>
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton size="lg" asChild>
							<Link href="/" className="container">
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
				<SidebarGroup>
					<SidebarGroupLabel>Main</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{navItems.map((item) => {
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

				<Separator />

				{/* Admin Navigation */}
				<SidebarGroup>
					<SidebarGroupLabel>Administration</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{adminItems.map((item) => {
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

				<Separator />

				{/* Development Navigation */}
				<SidebarGroup>
					<SidebarGroupLabel>Development</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{devItems.map((item) => {
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
		</Sidebar>
	);
}
