import { createClient } from "@supabase/supabase-js";
import { requireVersionedSecret } from "@/lib/security/secrets";

export function createSupabaseAdminClient() {
	const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const serviceRoleKey = requireVersionedSecret(
		"SUPABASE_SERVICE_ROLE_KEY",
		"Supabase service role key"
	);
	if (!url) {
		throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
	}
	return createClient(url, serviceRoleKey, { auth: { persistSession: false } });
}
