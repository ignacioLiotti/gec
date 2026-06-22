"use server";

import { createClient } from "@/utils/supabase/server";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";
import { auth } from "@/lib/auth";
import { resolveTenantMembership } from "@/lib/tenant-selection";
import { revalidatePath } from "next/cache";
import type { PostgrestError } from "@supabase/supabase-js";
import { sendInvitationEmail } from "@/lib/email/invitations";

const INVITATIONS_TABLE_MISSING_CODE = "PGRST205";
const DEFAULT_INVITATION_BASE_URL = "https://sintesis.dev";
const isInvitationsTableMissing = (error?: PostgrestError | null) =>
	error?.code === INVITATIONS_TABLE_MISSING_CODE;
const SUPERADMIN_USER_ID = "77b936fb-3e92-4180-b601-15c31125811e";

type Supabase = Awaited<ReturnType<typeof createClient>>;

type InvitationRow = {
	id: string;
	tenant_id?: string;
	email: string;
	token?: string;
	invited_by: string;
	invited_role: InvitedRole;
	status: InvitationStatus;
	expires_at: string;
	created_at: string;
};

type InvitationWithDetails = InvitationRow & {
	tenant?: { name: string | null };
	inviter?: { full_name: string | null };
};

async function requireUsersAdmin(
	supabase: Supabase,
	requestedTenantId?: string
) {
	const {
		data: { user },
		error: authError,
	} = await supabase.auth.getUser();

	if (authError || !user) {
		throw new Error("Unauthorized");
	}

	const [{ data: memberships }, { data: profile }] = await Promise.all([
		supabase
			.from("memberships")
			.select("tenant_id, role")
			.eq("user_id", user.id)
			.order("created_at", { ascending: true }),
		supabase
			.from("profiles")
			.select("is_superadmin, full_name")
			.eq("user_id", user.id)
			.maybeSingle(),
	]);

	const isSuperAdmin =
		(profile?.is_superadmin ?? false) || user.id === SUPERADMIN_USER_ID;
	const { tenantId } = await resolveTenantMembership(
		(memberships ?? []) as { tenant_id: string | null; role: string | null }[],
		{ isSuperAdmin }
	);
	const effectiveTenantId = requestedTenantId ?? tenantId;

	if (!effectiveTenantId) {
		throw new Error("No active tenant");
	}
	if (requestedTenantId && requestedTenantId !== tenantId && !isSuperAdmin) {
		throw new Error("Forbidden");
	}

	if (!isSuperAdmin) {
		const { data: canAdmin, error } = await supabase.rpc("has_permission", {
			tenant: effectiveTenantId,
			perm_key: "admin:users",
		});
		if (error) throw error;
		if (!canAdmin) {
			throw new Error("Forbidden");
		}
	}

	return { user, profile, tenantId: effectiveTenantId, isSuperAdmin };
}

async function requireInvitationInTenant(
	supabase: Supabase,
	invitationId: string,
	tenantId: string
) {
	const { data: invitation, error } = await supabase
		.from("invitations")
		.select("id")
		.eq("id", invitationId)
		.eq("tenant_id", tenantId)
		.maybeSingle();
	if (error) throw error;
	if (!invitation) {
		throw new Error("Invitation not found");
	}
}

function normalizeBaseUrl(value: string) {
	const trimmed = value.trim().replace(/\/+$/, "");
	if (!trimmed) return null;
	if (/^https?:\/\//i.test(trimmed)) return trimmed;
	return `https://${trimmed}`;
}

function getInvitationBaseUrl() {
	const configured = [
		process.env.APP_URL,
		process.env.MARKETING_HOST,
		process.env.NEXT_PUBLIC_MARKETING_HOST,
		process.env.NEXT_PUBLIC_APP_URL,
	]
		.map((value) => (value ? normalizeBaseUrl(value) : null))
		.find((value): value is string => Boolean(value));
	if (configured) return configured;
	if (process.env.NODE_ENV === "production") return DEFAULT_INVITATION_BASE_URL;
	return "http://localhost:3000";
}

export type InvitationStatus =
	| "pending"
	| "accepted"
	| "declined"
	| "expired"
	| "cancelled";
export type InvitedRole = "member" | "admin";

export interface Invitation {
	id: string;
	tenant_id: string;
	email: string;
	invited_by: string;
	invited_role: InvitedRole;
	status: InvitationStatus;
	token: string;
	expires_at: string;
	created_at: string;
	accepted_at?: string;
	accepted_by?: string;
	tenant?: {
		name: string;
	};
	inviter?: {
		full_name: string;
	};
}

/**
 * Send an invitation to join a tenant
 */
export async function sendInvitation({
	tenantId,
	email,
	role = "member",
}: {
	tenantId: string;
	email: string;
	role?: InvitedRole;
}) {
	const session = await auth();
	if (!session.data.user) return { error: "Unauthorized" };
	const supabase = await createClient();
	let authContext: Awaited<ReturnType<typeof requireUsersAdmin>>;
	try {
		authContext = await requireUsersAdmin(supabase, tenantId);
	} catch (error) {
		console.error("Unauthorized invitation send attempt:", error);
		return { error: "Unauthorized" };
	}
	const { user, profile } = authContext;

	// Normalize email
	const normalizedEmail = email.toLowerCase().trim();

	const { data: isExistingMember, error: memberCheckError } = await supabase.rpc(
		"is_email_member_of_tenant",
		{
			tenant_id_param: tenantId,
			email_param: normalizedEmail,
		}
	);
	if (memberCheckError) {
		console.error("Error checking invited email membership:", memberCheckError);
		return { error: "Failed to validate invitation recipient" };
	}
	if (isExistingMember) {
		return { error: "This email is already a member of this organization" };
	}

	// Check for existing pending invitation
	const { data: existingInvitation } = await supabase
		.from("invitations")
		.select("id, email, status")
		.eq("tenant_id", tenantId)
		.eq("email", normalizedEmail)
		.eq("status", "pending")
		.maybeSingle();

	if (existingInvitation) {
		return { error: "An invitation has already been sent to this email" };
	}

	// Create invitation
	const { data: invitation, error: insertError } = await supabase
		.from("invitations")
		.insert({
			tenant_id: tenantId,
			email: normalizedEmail,
			invited_by: user.id,
			invited_role: role,
			status: "pending",
		})
		.select("id, token")
		.single();

	if (insertError) {
		console.error("Error creating invitation:", insertError);
		return { error: "Failed to create invitation" };
	}

	const baseUrl = getInvitationBaseUrl();
	const inviteLink = `${baseUrl}/invitations/${invitation.token}`;
	const { data: tenant } = await supabase
		.from("tenants")
		.select("name")
		.eq("id", tenantId)
		.maybeSingle();

	try {
		await sendInvitationEmail({
			to: normalizedEmail,
			inviteLink,
			tenantName: tenant?.name ?? "tu organización",
			inviterName: profile?.full_name ?? user.email ?? null,
		});
	} catch (emailError) {
		console.error("Failed to send invitation email", emailError);
	}

	revalidatePath("/admin/users");

	return {
		success: true,
		invitationId: invitation.id,
		token: invitation.token,
		inviteLink,
	};
}

/**
 * Accept an invitation
 */
export async function acceptInvitation(token: string) {
	const session = await auth();
	if (!session.data.user) {
		return { error: "You must be logged in to accept an invitation" };
	}
	const supabase = await createClient();

	// Get current user
	const {
		data: { user },
		error: authError,
	} = await supabase.auth.getUser();

	if (authError || !user) {
		return { error: "You must be logged in to accept an invitation" };
	}

	// Get user email
	const userEmail = user.email?.toLowerCase().trim();
	if (!userEmail) {
		return { error: "User email not found" };
	}

	// Get invitation details using the helper function
	const { data: invitationDetails, error: inviteError } = await supabase.rpc(
		"get_invitation_by_token",
		{ invitation_token: token }
	);

	if (inviteError || !invitationDetails || invitationDetails.length === 0) {
		return { error: "Invalid or expired invitation" };
	}

	const invitation = invitationDetails[0];

	// Verify email matches
	if (invitation.email.toLowerCase() !== userEmail) {
		return {
			error: `This invitation was sent to ${invitation.email}. Please log in with that email to accept.`,
		};
	}

	// Check if user is already a member
	const { data: existingMembership } = await supabase
		.from("memberships")
		.select("user_id")
		.eq("tenant_id", invitation.tenant_id)
		.eq("user_id", user.id)
		.maybeSingle();

	if (existingMembership) {
		// Mark invitation as accepted anyway
		await supabase
			.from("invitations")
			.update({
				status: "accepted",
				accepted_at: new Date().toISOString(),
				accepted_by: user.id,
			})
			.eq("id", invitation.id)
			.eq("tenant_id", invitation.tenant_id)
			.eq("email", userEmail)
			.eq("token", token)
			.eq("status", "pending");

		return {
			error: "You are already a member of this organization",
			alreadyMember: true,
			tenantId: invitation.tenant_id,
		};
	}

	// Create membership
	const { error: membershipError } = await supabase.from("memberships").insert({
		tenant_id: invitation.tenant_id,
		user_id: user.id,
		role: invitation.invited_role,
	});

	if (membershipError) {
		console.error("Error creating membership:", membershipError);
		return { error: "Failed to join organization" };
	}

	// Update invitation status
	const { error: updateError } = await supabase
		.from("invitations")
		.update({
			status: "accepted",
			accepted_at: new Date().toISOString(),
			accepted_by: user.id,
		})
		.eq("id", invitation.id)
		.eq("tenant_id", invitation.tenant_id)
		.eq("email", userEmail)
		.eq("token", token)
		.eq("status", "pending");

	if (updateError) {
		console.error("Error updating invitation:", updateError);
	}

	revalidatePath("/");
	revalidatePath("/admin/users");

	return {
		success: true,
		tenantId: invitation.tenant_id,
		tenantName: invitation.tenant_name,
	};
}

/**
 * Decline an invitation
 */
export async function declineInvitation(token: string) {
	const session = await auth();
	if (!session.data.user) {
		return { error: "You must be logged in to decline an invitation" };
	}
	const supabase = await createClient();

	// Get current user
	const {
		data: { user },
		error: authError,
	} = await supabase.auth.getUser();

	if (authError || !user) {
		return { error: "You must be logged in to decline an invitation" };
	}

	// Get user email
	const userEmail = user.email?.toLowerCase().trim();
	if (!userEmail) {
		return { error: "User email not found" };
	}

	// Get invitation
	const { data: invitation, error: inviteError } = await supabase
		.from("invitations")
		.select("id, tenant_id, email, status")
		.eq("token", token)
		.eq("status", "pending")
		.maybeSingle();

	if (inviteError || !invitation) {
		return { error: "Invalid or expired invitation" };
	}

	// Verify email matches
	if (invitation.email.toLowerCase() !== userEmail) {
		return { error: "This invitation was not sent to your email" };
	}

	// Update invitation status
	const { error: updateError } = await supabase
		.from("invitations")
		.update({ status: "declined" })
		.eq("id", invitation.id)
		.eq("tenant_id", invitation.tenant_id)
		.eq("email", userEmail)
		.eq("token", token)
		.eq("status", "pending");

	if (updateError) {
		console.error("Error declining invitation:", updateError);
		return { error: "Failed to decline invitation" };
	}

	return { success: true };
}

/**
 * Cancel an invitation (admin only)
 */
export async function cancelInvitation(invitationId: string, tenantId: string) {
	const session = await auth();
	if (!session.data.user) return { error: "Unauthorized" };
	const supabase = await createClient();
	try {
		await requireUsersAdmin(supabase, tenantId);
		await requireInvitationInTenant(supabase, invitationId, tenantId);
	} catch (error) {
		console.error("Unauthorized invitation cancellation attempt:", error);
		return { error: "Unauthorized" };
	}

	// Update invitation status
	const { error: updateError } = await supabase
		.from("invitations")
		.update({ status: "cancelled" })
		.eq("id", invitationId)
		.eq("tenant_id", tenantId)
		.eq("status", "pending");

	if (updateError) {
		console.error("Error cancelling invitation:", updateError);
		return { error: "Failed to cancel invitation" };
	}

	revalidatePath("/admin/users");

	return { success: true };
}

/**
 * List pending invitations for a tenant (admin only)
 */
export async function listPendingInvitations(tenantId: string) {
	const session = await auth();
	if (!session.data.user) return { error: "Unauthorized" };
	const supabase = await createClient();
	try {
		await requireUsersAdmin(supabase, tenantId);
	} catch (error) {
		console.error("Unauthorized pending invitation list attempt:", error);
		return { error: "Unauthorized" };
	}

	// Expire old invitations first
	const { error: expireError } = await supabase.rpc("expire_old_invitations");
	if (expireError) {
		console.warn("expire_old_invitations RPC failed:", expireError);
	}

	// Get pending invitations with manual profile join
	const { data: invitations, error } = await supabase
		.from("invitations")
		.select(
			`
      id,
      email,
      invited_role,
      status,
      expires_at,
      created_at,
      invited_by
    `
		)
		.eq("tenant_id", tenantId)
		.eq("status", "pending")
		.order("created_at", { ascending: false });

	let invitationRows: InvitationWithDetails[] = (invitations ?? []) as InvitationRow[];

	// Manually fetch inviter profiles if we have invitations
	if (!error && invitations && invitations.length > 0) {
		const inviterIds = invitations.map((inv) => inv.invited_by);
		const { data: profiles } = await supabase
			.from("profiles")
			.select("user_id, full_name")
			.in("user_id", inviterIds);

		// Create a map for quick lookup
		const profileMap = new Map(
			(profiles || []).map((p) => [p.user_id, p.full_name])
		);

		invitationRows = invitationRows.map((inv) => ({
			...inv,
			inviter: { full_name: profileMap.get(inv.invited_by) || null },
		}));
	}

	if (error) {
		if (isInvitationsTableMissing(error)) {
			console.warn(
				"Invitations table not found; skipping pending invitation list."
			);
			return { invitations: [] };
		}
		console.error("Error fetching invitations:", error);
		return { error: "Failed to fetch invitations" };
	}

	return { invitations: invitationRows };
}

/**
 * Get pending invitations for current user's email
 */
export async function getMyPendingInvitations() {
	const session = await auth();
	if (!session.data.user) {
		return { invitations: [] };
	}
	const supabase = await createClient();

	// Get current user
	const {
		data: { user },
		error: authError,
	} = await supabase.auth.getUser();

	if (authError || !user || !user.email) {
		return { invitations: [] };
	}

	// Expire old invitations first
	const { error: expireError } = await supabase.rpc("expire_old_invitations");
	if (expireError) {
		console.warn("expire_old_invitations RPC failed:", expireError);
	}

	const normalizedEmail = user.email.toLowerCase().trim();

	// Get pending invitations for user's email with manual joins.
	// Use case-insensitive match to avoid missing invites due to casing.
	const { data: invitations, error } = await supabase
		.from("invitations")
		.select(
			`
      id,
      token,
      tenant_id,
      invited_role,
      expires_at,
      created_at,
      invited_by
    `
		)
		.ilike("email", normalizedEmail)
		.eq("status", "pending")
		.gt("expires_at", new Date().toISOString())
		.order("created_at", { ascending: false });

	let invitationRows: InvitationWithDetails[] = (invitations ?? []) as InvitationRow[];
	let invitationError = error;

	// Fallback for stricter RLS setups: query with admin client after authenticating
	// current user and filter by normalized email server-side.
	if (invitationError || invitationRows.length === 0) {
		try {
			const admin = createSupabaseAdminClient();
			const { data: adminInvitations, error: adminError } = await admin
				.from("invitations")
				.select(
					`
          id,
          token,
          tenant_id,
          invited_role,
          expires_at,
          created_at,
          invited_by,
          email
        `
				)
				.eq("status", "pending")
				.gt("expires_at", new Date().toISOString())
				.order("created_at", { ascending: false });
			if (!adminError && adminInvitations) {
				invitationRows = (adminInvitations as InvitationRow[]).filter(
					(inv) =>
						typeof inv.email === "string" &&
						inv.email.toLowerCase().trim() === normalizedEmail
				);
				invitationError = null;
			}
		} catch (fallbackError) {
			console.warn("Admin fallback for invitations failed:", fallbackError);
		}
	}

	// Manually fetch related data if we have invitations
	if (!invitationError && invitationRows.length > 0) {
		// Fetch tenant names
		const tenantIds = [...new Set(invitationRows.map((inv) => inv.tenant_id))];
		const { data: tenants } = await supabase
			.from("tenants")
			.select("id, name")
			.in("id", tenantIds);

		const tenantMap = new Map((tenants || []).map((t) => [t.id, t.name]));

		// Fetch inviter profiles
		const inviterIds = invitationRows.map((inv) => inv.invited_by);
		const { data: profiles } = await supabase
			.from("profiles")
			.select("user_id, full_name")
			.in("user_id", inviterIds);

		const profileMap = new Map(
			(profiles || []).map((p) => [p.user_id, p.full_name])
		);

		invitationRows = invitationRows.map((inv) => ({
			...inv,
			tenant: { name: tenantMap.get(inv.tenant_id ?? "") || null },
			inviter: { full_name: profileMap.get(inv.invited_by) || null },
		}));
	}

	if (invitationError) {
		if (isInvitationsTableMissing(invitationError)) {
			console.warn(
				"Invitations table not found; skipping personal invitation list."
			);
			return { invitations: [] };
		}
		console.error("Error fetching user invitations:", invitationError);
		return { invitations: [] };
	}

	return { invitations: invitationRows };
}
