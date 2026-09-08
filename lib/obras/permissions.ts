import type { SupabaseClient } from "@supabase/supabase-js";

// Existing obra edits are baseline tenant-member access. Creation still needs
// obras:edit because it also materializes default folders and extraction tables.
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
