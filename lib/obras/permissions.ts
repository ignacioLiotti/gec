import type { SupabaseClient } from "@supabase/supabase-js";

export async function canEditObras(
	supabase: SupabaseClient,
	tenantId: string,
): Promise<boolean> {
	const { data, error } = await supabase.rpc("has_permission", {
		tenant: tenantId,
		perm_key: "obras:edit",
	});
	if (error) throw error;
	return data === true;
}
