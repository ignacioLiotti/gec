import type { Metadata } from "next";
import { Geist, Geist_Mono, Playfair_Display } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import SupabaseAuthListener from "@/components/auth/auth-listener";
import AuthModal from "@/components/auth/auth-modal";
import { createClient } from "@/utils/supabase/server";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";
import AuthController from "@/components/auth/auth-controller";
import AuthGate from "@/components/auth/auth-gate";
import { QueryClientProvider } from "@/lib/query-client-provider";
import NotificationsListener from "@/components/notifications/notifications-listener";
import { Toaster } from "sonner";
import { getUserRoles } from "@/lib/route-guard";
import { SpeedInsights } from "@vercel/speed-insights/next"
import { Analytics } from "@vercel/analytics/next";
import DomainMigrationGuard from "@/components/domain-migration-guard";
import { PathnameLayoutShell } from "@/components/pathname-layout-shell";

const DEBUG_AUTH = process.env.DEBUG_AUTH === "true";

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
    default: "Synthesis | Digitalización y Control de Obras",
    template: "%s | Synthesis",
  },
  description:
    "Centralizá documentos, automatizá extracción de datos y monitoreá el avance de tus obras en una sola plataforma.",
  icons: {
    icon: process.env.NODE_ENV === "development" ? "/icon" : "/favicon.ico",
  },
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

  // Get user roles for sidebar filtering
  const userRoles = await getUserRoles();
  if (DEBUG_AUTH) {
    console.log("[LAYOUT] userRoles:", userRoles);
  }

  // Check if user should see all organizations
  const showAllOrgs = userRoles?.isSuperAdmin || user?.email === "ignacioliotti@gmail.com";

  let tenants: { id: string; name: string }[] = [];
  if (user && showAllOrgs) {
    // Superadmin or ignacio sees ALL organizations (use admin client to bypass RLS)
    const admin = createSupabaseAdminClient();
    const { data: allTenants } = await admin
      .from("tenants")
      .select("id, name")
      .order("name");
    tenants = (allTenants ?? []).map((t) => ({
      id: t.id,
      name: t.name ?? "Organización",
    }));
    if (DEBUG_AUTH) {
      console.log("[LAYOUT] allTenants", allTenants);
    }
  } else if (user) {
    // Regular users only see their memberships
    type TenantRow = {
      tenant_id: string;
      tenants: { name: string | null } | null;
    };
    const { data } = await supabase
      .from("memberships")
      .select("tenant_id, tenants(name)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });
    const tenantRows = (data ?? null) as TenantRow[] | null;
    tenants = tenantRows?.map((row) => ({
      id: row.tenant_id,
      name: row.tenants?.name ?? "Organización",
    })) ?? [];
  }

  // Fetch sidebar macro tables for user
  let sidebarMacroTables: { id: string; name: string; position: number }[] = [];
  if (user && userRoles?.tenantId) {
    const isAdminOrSuper = userRoles.isAdmin || userRoles.isSuperAdmin;

    // Fetch all sidebar tables for the tenant (with role_id for filtering)
    const { data: sidebarTables } = await supabase
      .from("sidebar_macro_tables")
      .select(`
        role_id,
        macro_table_id,
        position,
        macro_tables!inner(id, name, tenant_id)
      `)
      .eq("macro_tables.tenant_id", userRoles.tenantId)
      .order("position");

    if (sidebarTables && sidebarTables.length > 0) {
      // Filter based on user access - use roleIds from getUserRoles()
      const accessibleTables = isAdminOrSuper
        ? sidebarTables // Admins see all
        : sidebarTables.filter((t) => userRoles.roleIds.includes(t.role_id)); // Regular users see only their roles

      // Deduplicate by macro_table_id (a table might be assigned to multiple roles)
      const seen = new Set<string>();
      sidebarMacroTables = accessibleTables
        .filter((t) => {
          if (seen.has(t.macro_table_id)) return false;
          seen.add(t.macro_table_id);
          return true;
        })
        .map((t) => ({
          id: t.macro_table_id,
          name: (t.macro_tables as unknown as { name: string }).name,
          position: t.position,
        }));
    }
  }

  return (
    <html lang="en">
      <head>
        {process.env.NODE_ENV === "development" && (
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
            sidebarMacroTables={sidebarMacroTables}
          >
            {children}
          </PathnameLayoutShell>
        </QueryClientProvider>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
