"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
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
} | null;

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
					<ImpersonateBanner />
					<main className="flex flex-1 flex-col gap-4 bg-[#fafafa]">
						{children}
					</main>
				</SidebarInset>
			</SidebarProvider>
		</div>
	);
}
