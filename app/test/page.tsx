import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';

async function addInstrument(formData: FormData) {
  'use server'
  const supabase = await createClient();
  const instrumentName = String(formData.get('name') ?? '').trim();
  if (!instrumentName) {
    return;
  }
  await supabase.from('instruments').insert({ name: instrumentName, tenant_id: DEFAULT_TENANT_ID });
  revalidatePath('/test');
}

export default async function Instruments() {
  const supabase = await createClient();
  const { data: instruments } = await supabase
    .from("instruments")
    .select()
    .eq('tenant_id', DEFAULT_TENANT_ID);
  return (
    <div className="p-4 space-y-4">
      <form action={addInstrument} className="flex items-center gap-2">
        <input
          type="text"
          name="name"
          placeholder="New instrument name"
          className="border rounded px-3 py-2 w-64"
        />
        <button
          type="submit"
          className="inline-flex items-center justify-center whitespace-nowrap rounded-md bg-black px-4 py-2 text-sm font-medium text-white shadow hover:bg-black/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-white/90"
        >
          Add
        </button>
      </form>
      <pre>{JSON.stringify(instruments, null, 2)}</pre>
    </div>
  );
}