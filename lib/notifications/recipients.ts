import { createSupabaseAdminClient } from "@/utils/supabase/admin";

export async function getUserEmailById(userId: string): Promise<string | null> {
  try {
    const admin = createSupabaseAdminClient();
    const { data } = await admin.auth.admin.getUserById(userId);
    return data?.user?.email ?? null;
  } catch {
    return null;
  }
}



