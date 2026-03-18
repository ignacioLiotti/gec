import type { Metadata } from "next";
import { Geist, Geist_Mono, Playfair_Display } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import SupabaseAuthListener from "@/components/auth/auth-listener";
import { createClient } from "@/utils/supabase/server";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";
import AuthController from "@/components/auth/auth-controller";
import AuthGate from "@/components/auth/auth-gate";
import { QueryClientProvider } from "@/lib/query-client-provider";
import NotificationsListener from "@/components/notifications/notifications-listener";
import { Toaster } from "sonner";
import { resolveTenantMembership, type MembershipLike } from "@/lib/tenant-selection";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import DomainMigrationGuard from "@/components/domain-migration-guard";
import { PathnameLayoutShell } from "@/components/pathname-layout-shell";

const DEBUG_AUTH = process.env.DEBUG_AUTH === "true";
const SUPERADMIN_USER_ID = "77b936fb-3e92-4180-b601-15c31125811e";
const ENABLE_REACT_SCAN = process.env.NEXT_PUBLIC_ENABLE_REACT_SCAN === "true";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const playfairDisplay = Playfair_Display({
  variable: "--font-geist-serif",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Sintesis | Digitalización y Control de Obras",
    template: "%s | Sintesis",
  },
  description:
    "Centralizá documentos, automatizá extracción de datos y monitoreá el avance de tus obras en una sola plataforma.",
  icons: {
    icon: process.env.NODE_ENV === "development" ? "/icon" : "/favicon.ico",
  },
};

type LayoutUserRoles = {
  roles: string[];
  roleIds: string[];
  isAdmin: boolean;
  isSuperAdmin: boolean;
  tenantId: string | null;
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  if (DEBUG_AUTH) {
    console.log("[LAYOUT] RootLayout rendering...");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (DEBUG_AUTH) {
    console.log("[LAYOUT] getUser result:", { hasUser: !!user, email: user?.email });
  }

  let userRoles: LayoutUserRoles = {
    roles: [],
    roleIds: [],
    isAdmin: false,
    isSuperAdmin: false,
    tenantId: null,
  };
  let tenants: { id: string; name: string }[] = [];

  if (user) {
    type MembershipRow = MembershipLike & {
      tenants?: { name: string | null } | { name: string | null }[] | null;
    };
    const getTenantName = (membership: MembershipRow) =>
      Array.isArray(membership.tenants)
        ? (membership.tenants[0]?.name ?? null)
        : (membership.tenants?.name ?? null);

    const [{ data: profile }, { data: memberships, error: membershipsError }] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("is_superadmin")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("memberships")
          .select("tenant_id, role, tenants(name)")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true }),
      ]);

    if (membershipsError) {
      console.error("Error fetching memberships:", membershipsError);
    }

    const isSuperAdmin =
      (profile?.is_superadmin ?? false) || user.id === SUPERADMIN_USER_ID;
    const resolvedMembership = await resolveTenantMembership(
      (memberships ?? []) as MembershipRow[],
      { isSuperAdmin }
    );
    const tenantId = resolvedMembership.tenantId;
    const membershipRole = resolvedMembership.activeMembership?.role ?? null;
    const isAdmin =
      membershipRole === "owner" || membershipRole === "admin" || isSuperAdmin;
    const roles: string[] = [];
    const roleIds: string[] = [];

    if (isAdmin || isSuperAdmin) {
      roles.push("admin");
    }

    if (tenantId && !isAdmin && !isSuperAdmin) {
      try {
        const { data: userRoleIds, error: userRoleIdsError } = await supabase
          .from("user_roles")
          .select("role_id")
          .eq("user_id", user.id);

        if (userRoleIdsError?.code === "54001") {
          console.warn(
            "Stack depth limit exceeded in layout user_roles query; skipping custom roles"
          );
        } else if (userRoleIdsError) {
          console.error("Error fetching user role IDs:", userRoleIdsError);
        } else if (userRoleIds && userRoleIds.length > 0) {
          const fetchedRoleIds = userRoleIds.map((row: { role_id: string }) => row.role_id);
          const { data: roleDetails, error: roleDetailsError } = await supabase
            .from("roles")
            .select("id, name, tenant_id")
            .in("id", fetchedRoleIds)
            .eq("tenant_id", tenantId);

          if (roleDetailsError) {
            console.error("Error fetching role details:", roleDetailsError);
          } else if (roleDetails) {
            for (const role of roleDetails as { id: string; name: string }[]) {
              if (role.id && !roleIds.includes(role.id)) {
                roleIds.push(role.id);
              }
              if (role.name && !roles.includes(role.name)) {
                roles.push(role.name);
              }
            }
          }
        }
      } catch (error) {
        console.error("Exception fetching user roles:", error);
      }
    }

    userRoles = {
      roles,
      roleIds,
      isAdmin,
      isSuperAdmin,
      tenantId,
    };

    const showAllOrgs = isSuperAdmin || user.email === "ignacioliotti@gmail.com";

    if (showAllOrgs) {
      const admin = createSupabaseAdminClient();
      const { data: allTenants } = await admin
        .from("tenants")
        .select("id, name")
        .order("name");

      tenants = (allTenants ?? []).map((tenant) => ({
        id: tenant.id,
        name: tenant.name ?? "Organización",
      }));

      if (DEBUG_AUTH) {
        console.log("[LAYOUT] allTenants", allTenants);
      }
    } else {
      tenants = ((memberships ?? []) as MembershipRow[])
        .map((membership) => ({
          id: membership.tenant_id ?? "",
          name: getTenantName(membership) ?? "Organización",
        }))
        .filter((tenant) => tenant.id.length > 0);
    }
  }

  if (DEBUG_AUTH) {
    console.log("[LAYOUT] userRoles:", userRoles);
  }

  return (
    <html lang="en">
      <head>
        {process.env.NODE_ENV === "development" && ENABLE_REACT_SCAN && (
          <Script
            crossOrigin="anonymous"
            src="https://unpkg.com/react-scan/dist/auto.global.js"
            strategy="lazyOnload"
          />
        )}
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${playfairDisplay.variable} antialiased`}
      >
        <SpeedInsights />
        <QueryClientProvider>
          <DomainMigrationGuard />
          <SupabaseAuthListener />
          <AuthController />
          <AuthGate />
          <Toaster position="bottom-right" richColors />
          <NotificationsListener />
          <PathnameLayoutShell
            user={user}
            userRoles={userRoles as any}
            tenants={tenants}
          >
            {children}
          </PathnameLayoutShell>
        </QueryClientProvider>
        <Analytics />
      </body>
    </html>
  );
}
