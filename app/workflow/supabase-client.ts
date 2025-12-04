import { createClient } from "@supabase/supabase-js";
import { getVersionedSecret } from "@/lib/security/secrets";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

const serviceRoleKey = getVersionedSecret("SUPABASE_SERVICE_ROLE_KEY").value;

if (!SUPABASE_URL) {
	throw new Error("NEXT_PUBLIC_SUPABASE_URL is not configured");
}

if (!serviceRoleKey) {
	throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
}

export const workflowSupabase = createClient(SUPABASE_URL, serviceRoleKey, {
	global: { fetch: (...args) => fetch(...args) },
	auth: { persistSession: false },
});
