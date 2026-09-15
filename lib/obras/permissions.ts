import type { SupabaseClient } from "@supabase/supabase-js";

// Creation, additive default setup, and ordinary edits are tenant-member access.
// Full synchronization retains obras:edit because it can delete omitted obras.
export async function canUpdateObras(
	supabase: SupabaseClient,
	tenantId: string,
): Promise<boolean> {
	const { data, error } = await supabase.rpc("is_member_of", { tenant: tenantId });
	if (error) throw error;
	return data === true;
}

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
