import { createSupabaseBrowserClient } from "@/utils/supabase/client";

export async function fetchDocumentMutation(path: string, init: RequestInit) {
  const response = await fetch(path, init);
  if (response.status !== 401) return response;
  const { data, error } = await createSupabaseBrowserClient().auth.refreshSession().catch(() => ({ data: null, error: true }));
  if (!error && data?.session) return await fetch(path, init);
  throw new Error("La sesión venció. Volvé a iniciar sesión en otra pestaña y reintentá sin cerrar esta orden.");
}
