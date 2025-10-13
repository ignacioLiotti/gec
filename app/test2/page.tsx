import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import InstrumentsTable from "@/app/test2/instruments-table";

const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000001";

async function addInstrument(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const instrumentName = String(formData.get("name") ?? "").trim();
  if (!instrumentName) return;

  await supabase
    .from("instruments")
    .insert({ name: instrumentName, tenant_id: DEFAULT_TENANT_ID });

  revalidatePath("/test2");
}

export default async function Page() {
  const supabase = await createClient();
  const { data: instruments } = await supabase
    .from("instruments")
    .select()
    .eq("tenant_id", DEFAULT_TENANT_ID)
    .order("created_at", { ascending: false });

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Instruments</h1>
      <InstrumentsTable instruments={instruments ?? []} addInstrument={addInstrument} />
    </div>
  );
}


