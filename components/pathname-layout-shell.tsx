"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "@/components/ui/sidebar";
import {
	getDefaultDemoAppPath,
	isDemoPathAllowed,
	type DemoCapability,
} from "@/lib/demo-capabilities";
import type { DocumentGenerationPermissionMap } from "@/lib/document-generation-server";
import type {
	PermissionOption,
	PermissionSimulation,
} from "@/lib/permission-simulation";
import type { Role } from "@/lib/route-access";
import { track } from "@vercel/analytics";
import { NavigationProgress } from "./navigation-progress";
import { ImpersonateBanner } from "./auth/impersonate-banner";

const DeferredAppSidebar = dynamic(
	() => import("@/components/app-sidebar").then((mod) => mod.AppSidebar),
	{
		loading: () => (
			<div className="hidden w-[var(--sidebar-width,16rem)] shrink-0 border-r bg-[#fafafa] xl:block" />
		),
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
	deniedPermissionKeys?: string[];
	actualIsSuperAdmin?: boolean;
	permissionSimulation?: PermissionSimulation | null;
} | null;

function getMobileRouteTitle(pathname: string | null) {
	if (!pathname) return "Sintesis";
	if (pathname === "/dashboard") return "Dashboard";
	if (pathname === "/excel") return "Obras";
	if (pathname.startsWith("/excel/")) return "Obra";
	if (pathname.startsWith("/document-ai")) return "Document AI";
	if (pathname.startsWith("/document-generation")) return "Documentos";
	if (pathname.startsWith("/notifications")) return "Notificaciones";
	if (pathname.startsWith("/macro")) return "Macrotablas";
	if (pathname.startsWith("/billing")) return "Facturacion";
	if (pathname.startsWith("/admin/tenants")) return "Organizaciones";
	if (pathname.startsWith("/admin/tenant-secrets")) return "Secretos API";
	if (pathname.startsWith("/admin/users")) return "Usuarios";
	if (pathname.startsWith("/admin/roles")) return "Roles";
	if (pathname.startsWith("/admin")) return "Administracion";
	if (pathname.startsWith("/profile")) return "Perfil";
	return "Sintesis";
}

function MobileAppHeader({
	pathname,
	activeTenantName,
}: {
	pathname: string | null;
	activeTenantName: string | null;
}) {
	return (
		<header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b border-stone-200 bg-white/95 px-3 shadow-[0_1px_0_rgba(0,0,0,0.03)] backdrop-blur md:hidden">
			<SidebarTrigger className="size-10 rounded-lg border border-stone-200 bg-stone-50 text-stone-800 shadow-none" />
			<div className="min-w-0 flex-1">
				<p className="truncate text-sm font-semibold text-stone-950">
					{getMobileRouteTitle(pathname)}
				</p>
				<p className="truncate text-[11px] text-stone-500">
					{activeTenantName ?? "Sintesis"}
				</p>
			</div>
		</header>
	);
}

export function PathnameLayoutShell({
	children,
	user,
	userRoles,
	documentPermissions,
	permissionOptions,
	tenants,
	sidebarMacroTables,
	demoSession,
	demoCapabilities,
}: {
	children: React.ReactNode;
	user?: { email?: string | null } | null;
	userRoles?: UserRolesShape;
	documentPermissions?: DocumentGenerationPermissionMap | null;
	permissionOptions?: PermissionOption[];
	tenants?: { id: string; name: string | null }[];
	sidebarMacroTables?: SidebarMacroTable[];
	demoSession?: { label?: string | null; tenantName?: string | null } | null;
	demoCapabilities?: DemoCapability[];
}) {
	const pathname = usePathname();
	const router = useRouter();
	const { replace } = router;
	const isMarketingRoot = pathname === "/";
	const isLandingRoute = pathname?.startsWith("/landings") ?? false;
	const isStandaloneDemoRoute = pathname?.startsWith("/demo/") ?? false;
	const isDemoMode = userRoles?.actorType === "demo";
	const normalizedUser = user
		? { ...user, email: user.email ?? undefined }
		: null;
	const activeTenantName =
		tenants?.find((tenant) => tenant.id === userRoles?.tenantId)?.name ??
		demoSession?.tenantName ??
		demoSession?.label ??
		null;

	useEffect(() => {
		if (isMarketingRoot && user?.email) {
			replace("/dashboard");
		}
	}, [isMarketingRoot, replace, user?.email]);

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
	}, [demoCapabilities, isDemoMode, isStandaloneDemoRoute, pathname, replace]);

	if (isMarketingRoot || isLandingRoute || isStandaloneDemoRoute) {
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
					permissionOptions={permissionOptions}
					tenants={tenants}
					sidebarMacroTables={sidebarMacroTables}
					demoMode={isDemoMode}
					demoLabel={demoSession?.label ?? demoSession?.tenantName ?? null}
					demoCapabilities={demoCapabilities}
				/>
				<SidebarInset>
					<MobileAppHeader
						pathname={pathname}
						activeTenantName={activeTenantName}
					/>
					<ImpersonateBanner />
					<main className="flex min-h-[calc(100svh-3.5rem)] flex-1 flex-col gap-4 bg-[#fafafa] md:min-h-0">
						{children}
					</main>
				</SidebarInset>
			</SidebarProvider>
		</div>
	);
}
