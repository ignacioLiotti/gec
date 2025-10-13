import { createClient } from "@/utils/supabase/server";

export default async function PermissionsDemoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <div className="p-6 text-sm">Sign in first.</div>;

  const { data: memberships } = await supabase
    .from("memberships")
    .select("tenant_id")
    .order("created_at", { ascending: true });
  const tenantId = memberships?.[0]?.tenant_id ?? null;
  if (!tenantId) return <div className="p-6 text-sm">Join or create a tenant.</div>;

  const canRead = await hasPerm(supabase, tenantId, "instruments:read");
  const canWrite = await hasPerm(supabase, tenantId, "instruments:write");
  const canAdmin = await hasPerm(supabase, tenantId, "admin:roles");

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Permissions Demo</h1>
      <DemoCard title="Read Instruments" allowed={canRead}>
        <p className="text-sm">This section would show the instruments table.</p>
      </DemoCard>
      <DemoCard title="Write Instruments" allowed={canWrite}>
        <p className="text-sm">This section would show a form to add/edit instruments.</p>
      </DemoCard>
      <DemoCard title="Admin Roles" allowed={canAdmin}>
        <p className="text-sm">This section would link to the Roles Admin panel.</p>
      </DemoCard>
    </div>
  );
}

async function hasPerm(supabase: any, tenantId: string, key: string) {
  const { data } = await supabase.rpc("has_permission", { tenant: tenantId, perm_key: key });
  return Boolean(data);
}

function DemoCard({ title, allowed, children }: { title: string; allowed: boolean; children: any }) {
  return (
    <div className={"rounded-md border p-4 " + (allowed ? "" : "opacity-40 blur-[1px]")}>
      <div className="mb-2 text-lg font-medium">{title}</div>
      {children}
      {!allowed && (
        <div className="mt-2 text-xs text-foreground/60">You do not have this permission. Section is blurred for demo.</div>
      )}
    </div>
  );
}


