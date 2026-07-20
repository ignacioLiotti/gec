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
	if (!pathname) return "Síntesis";
	if (pathname === "/dashboard") return "Inicio";
	if (pathname === "/excel") return "Obras";
	if (pathname === "/excel/data-flow") return "Flujo de información";
	if (pathname === "/excel/reporte") return "Reporte de obras";
	if (pathname === "/excel/papelera-obras") return "Papelera de obras";
	if (pathname.startsWith("/excel/")) return "Obra";
	if (pathname.startsWith("/document-ai")) return "Consultar documentos";
	if (pathname.startsWith("/document-generation")) return "Documentos";
	if (pathname.startsWith("/notifications")) return "Notificaciones";
	if (pathname.startsWith("/macro")) return "Macrotablas";
	if (pathname.startsWith("/billing")) return "Facturación";
	if (pathname.startsWith("/setup")) return "Puesta en marcha";
	if (pathname.startsWith("/help")) return "Ayuda";
	if (pathname.startsWith("/tenants/new")) return "Nueva organización";
	if (pathname.startsWith("/admin/tenants")) return "Organizaciones";
	if (pathname.startsWith("/admin/tenant-secrets")) return "Secretos API";
	if (pathname.startsWith("/admin/users")) return "Personas y accesos";
	if (pathname.startsWith("/admin/roles")) return "Roles";
	if (pathname.startsWith("/admin")) return "Administración";
	if (pathname.startsWith("/profile")) return "Perfil";
	return "Síntesis";
}

function MobileAppHeader({
	pathname,
	activeTenantName,
}: {
	pathname: string | null;
	activeTenantName: string | null;
}) {
	return (
		<header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b border-stroke-soft bg-surface/95 px-3 shadow-[0_1px_0_rgba(0,0,0,0.03)] backdrop-blur md:hidden">
			<SidebarTrigger className="size-10 rounded-lg border border-stroke bg-surface-recessed text-content shadow-none" />
			<div className="min-w-0 flex-1">
				<p className="truncate text-sm font-semibold text-content">
					{getMobileRouteTitle(pathname)}
				</p>
				<p className="truncate text-[11px] text-content-muted">
					{activeTenantName ?? "Síntesis"}
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
	const isStandaloneAccountRoute =
		pathname === "/onboarding" ||
		(pathname?.startsWith("/invitations/") ?? false) ||
		(pathname?.startsWith("/tenants/new") ?? false);
	const isDemoMode = userRoles?.actorType === "demo";
	const isExcelLandingRoute =
		pathname === "/excel" ||
		pathname === "/excel/formtext" ||
		pathname === "/excel/listtest";
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

	if (
		isMarketingRoot ||
		isLandingRoute ||
		isStandaloneDemoRoute ||
		isStandaloneAccountRoute
	) {
		return <main>{children}</main>;
	}

	return (
		<div
			className={isExcelLandingRoute ? "notranslate h-svh overflow-hidden" : "notranslate"}
			translate="no"
		>
			<NavigationProgress />
			<SidebarProvider
				defaultOpen={false}
				className={isExcelLandingRoute ? "h-full min-h-0 overflow-hidden" : undefined}
			>
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
				<SidebarInset className={isExcelLandingRoute ? "h-full min-h-0" : undefined}>
					<MobileAppHeader
						pathname={pathname}
						activeTenantName={activeTenantName}
					/>
					<ImpersonateBanner />
					<main
						className={
							isExcelLandingRoute
								? "flex min-h-0 flex-1 flex-col gap-4 overflow-hidden bg-[#f0f1f3]"
								: "flex min-h-[calc(100svh-3.5rem)] min-w-0 flex-1 flex-col gap-4 overflow-x-clip bg-canvas md:min-h-0"
						}
					>
						{children}
					</main>
				</SidebarInset>
			</SidebarProvider>
		</div>
	);
}
