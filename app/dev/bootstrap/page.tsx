import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000001";

export default async function DevBootstrapPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="p-6">
        <p className="text-sm">Sign in first.</p>
      </div>
    );
  }

  async function grantOwner() {
    "use server";
    const s = await createClient();
    const { data: { user: currentUser } } = await s.auth.getUser();
    if (!currentUser) return;
    await s
      .from("memberships")
      .upsert({ tenant_id: DEFAULT_TENANT_ID, user_id: currentUser.id, role: "owner" }, { onConflict: "tenant_id,user_id" });
    revalidatePath("/dev/bootstrap");
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Dev Bootstrap</h1>
      <form action={grantOwner}>
        <button className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-black/90">
          Grant owner on default tenant
        </button>
      </form>
    </div>
  );
}


