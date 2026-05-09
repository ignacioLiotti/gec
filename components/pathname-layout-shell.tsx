"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
	SidebarInset,
	SidebarProvider,
} from "@/components/ui/sidebar";
import {
	getDefaultDemoAppPath,
	isDemoPathAllowed,
	type DemoCapability,
} from "@/lib/demo-capabilities";
import type { DocumentGenerationPermissionMap } from "@/lib/document-generation-server";
import type { Role } from "@/lib/route-access";
import { cn } from "@/lib/utils";
import { track } from "@vercel/analytics";
import { NavigationProgress } from "./navigation-progress";

const DeferredAppSidebar = dynamic(
	() => import("@/components/app-sidebar").then((mod) => mod.AppSidebar),
	{
		loading: () => (
			<div className="hidden w-[var(--sidebar-width,16rem)] shrink-0 border-r bg-[#fafafa] xl:block" />
		),
	},
);

const DeferredImpersonateBanner = dynamic(
	() => import("@/app/admin/users/_components/impersonate-banner"),
	{
		loading: () => null,
	},
);

type SidebarMacroTable = {
	id: string;
	name: string;
	position: number;
};

type UserRolesShape = {
	roles: Role[];
	isAdmin: boolean;
	isSuperAdmin: boolean;
	tenantId: string | null;
	roleIds?: string[];
	actorType?: "user" | "demo";
	permissionKeys?: string[];
} | null;

type DocumentNavItem = {
	href: string;
	label: string;
	show: boolean;
};

function DocumentGenerationNav({
	documentPermissions,
	pathname,
}: {
	documentPermissions?: DocumentGenerationPermissionMap | null;
	pathname: string | null;
}) {
	if (!pathname?.startsWith("/document-generation")) return null;

	const permissions = documentPermissions;
	const items: DocumentNavItem[] = [
		{
			href: "/document-generation",
			label: "Generar",
			show: Boolean(permissions?.canCreate),
		},
		{
			href: "/document-generation/drafts",
			label: "Borradores",
			show: Boolean(permissions?.canCreate || permissions?.canViewAllDrafts),
		},
		{
			href: "/document-generation/review",
			label: "Revision",
			show: Boolean(permissions?.canReview),
		},
		{
			href: "/document-generation/config",
			label: "Configuracion",
			show: Boolean(permissions?.canManageTemplates),
		},
	].filter((item) => item.show);

	if (items.length === 0) return null;

	return (
		<header className="flex min-h-12 max-w-full shrink-0 flex-wrap items-center gap-2 border-b bg-[#fafafa] px-3 py-2 sm:px-4">
			<nav className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
				{items.map((item) => {
					const active = pathname === item.href;
					return (
						<Link
							key={item.href}
							href={item.href}
							className={cn(
								"inline-flex h-8 items-center rounded-md border px-3 text-sm font-medium transition",
								active
									? "border-stone-900 bg-stone-900 text-white"
									: "border-stone-200 bg-white text-stone-700 hover:bg-stone-50",
							)}
						>
							{item.label}
						</Link>
					);
				})}
			</nav>
			<div className="flex w-full items-center justify-end gap-2 sm:ml-auto sm:w-auto">
				<DeferredImpersonateBanner />
			</div>
		</header>
	);
}

export function PathnameLayoutShell({
	children,
	user,
	userRoles,
	documentPermissions,
	tenants,
	sidebarMacroTables,
	demoSession,
	demoCapabilities,
}: {
	children: React.ReactNode;
	user?: { email?: string | null } | null;
	userRoles?: UserRolesShape;
	documentPermissions?: DocumentGenerationPermissionMap | null;
	tenants?: { id: string; name: string | null }[];
	sidebarMacroTables?: SidebarMacroTable[];
	demoSession?: { label?: string | null; tenantName?: string | null } | null;
	demoCapabilities?: DemoCapability[];
}) {
	const pathname = usePathname();
	const router = useRouter();
  const { replace } = router;
	const isMarketingRoot = pathname === "/";
	const isStandaloneDemoRoute = pathname?.startsWith("/demo/") ?? false;
	const isDemoMode = userRoles?.actorType === "demo";
	const normalizedUser = user
		? { ...user, email: user.email ?? undefined }
		: null;

	useEffect(() => {
		if (isMarketingRoot && user?.email) {
			replace("/dashboard");
		}
	}, [isMarketingRoot, user?.email, router]);

	useEffect(() => {
		if (!pathname || pathname === "/") return;
		track("app_page_view", {
			path: pathname,
			section: "app",
		});
	}, [pathname]);

	useEffect(() => {
		if (!isDemoMode || !pathname) return;
		if (isStandaloneDemoRoute) return;
		if (isDemoPathAllowed(pathname, demoCapabilities)) return;
		replace(getDefaultDemoAppPath(demoCapabilities));
	}, [demoCapabilities, isDemoMode, isStandaloneDemoRoute, pathname, router]);

	if (isMarketingRoot || isStandaloneDemoRoute) {
		return <main>{children}</main>;
	}

	return (
		<div className="notranslate" translate="no">
			<NavigationProgress />
			<SidebarProvider defaultOpen={false}>
				<DeferredAppSidebar
					user={normalizedUser}
					userRoles={userRoles}
					documentPermissions={documentPermissions}
					tenants={tenants}
					sidebarMacroTables={sidebarMacroTables}
					demoMode={isDemoMode}
					demoLabel={demoSession?.label ?? demoSession?.tenantName ?? null}
					demoCapabilities={demoCapabilities}
				/>
				<SidebarInset>
					<DocumentGenerationNav
						documentPermissions={documentPermissions}
						pathname={pathname}
					/>
					<main className="flex flex-1 flex-col gap-4 bg-[#fafafa]">
						{children}
					</main>
				</SidebarInset>
			</SidebarProvider>
		</div>
	);
}
