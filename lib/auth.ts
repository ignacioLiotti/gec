import { createClient } from "@/utils/supabase/server";

export async function auth() {
	const supabase = await createClient();
	return supabase.auth.getUser();
}
