import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return redirect("/");

  const { data: tenants } = await supabase.from("tenants").select("id, name").order("created_at");

  async function createTenant(formData: FormData) {
    "use server";
    const s = await createClient();
    const name = String(formData.get("name") ?? "").trim();
    if (!name) return;
    const { data, error } = await s.from("tenants").insert({ name }).select("id").single();
    if (!error && data) {
      await s.from("memberships").insert({ tenant_id: data.id, user_id: user!.id, role: "owner" });
    }
    redirect("/");
  }

  async function joinTenant(formData: FormData) {
    "use server";
    const s = await createClient();
    const tenantId = String(formData.get("tenant_id") ?? "");
    if (!tenantId) return;
    await s.from("memberships").insert({ tenant_id: tenantId, user_id: user!.id, role: "member" });
    redirect("/");
  }

  return (
    <div className="p-6 space-y-8">
      <h1 className="text-2xl font-semibold">Choose your workspace</h1>
      <section className="space-y-3">
        <h2 className="text-lg font-medium">Join an existing tenant</h2>
        <form action={joinTenant} className="flex items-center gap-2">
          <select name="tenant_id" className="rounded-md border bg-background px-3 py-2 text-sm">
            {tenants?.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <button className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-black/90">Join</button>
        </form>
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-medium">Or create a new tenant</h2>
        <form action={createTenant} className="flex items-center gap-2">
          <input name="name" placeholder="Tenant name" className="w-64 rounded-md border bg-background px-3 py-2 text-sm" />
          <button className="rounded-md border px-4 py-2 text-sm hover:bg-foreground/10">Create</button>
        </form>
      </section>
    </div>
  );
}


