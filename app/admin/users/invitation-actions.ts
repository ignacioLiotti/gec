"use server";

import { createClient } from "@/utils/supabase/server";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";
import { auth } from "@/lib/auth";
import { resolveTenantMembership } from "@/lib/tenant-selection";
import { revalidatePath } from "next/cache";
import type { PostgrestError } from "@supabase/supabase-js";
import { sendInvitationEmail } from "@/lib/email/invitations";
import { isSuperAdminUser } from "@/lib/superadmin";

const INVITATIONS_TABLE_MISSING_CODE = "PGRST205";
const INVITATION_COLUMN_MISSING_CODES = new Set(["PGRST204", "42703"]);
const DEFAULT_INVITATION_BASE_URL = "https://sintesis.dev";
const isInvitationsTableMissing = (error?: PostgrestError | null) =>
	error?.code === INVITATIONS_TABLE_MISSING_CODE;
const isOperationalRoleSchemaMissing = (error?: PostgrestError | null) =>
	Boolean(
		error &&
			(INVITATION_COLUMN_MISSING_CODES.has(error.code) ||
				error.message.includes("invited_operational_role")),
	);

type Supabase = Awaited<ReturnType<typeof createClient>>;

type InvitationRow = {
	id: string;
	tenant_id?: string;
	email: string;
	token?: string;
	invited_by: string;
	invited_role: InvitedRole;
	invited_operational_role_id?: string | null;
	invited_operational_role_name?: string | null;
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

	const isSuperAdmin = isSuperAdminUser(
		user.id,
		profile?.is_superadmin,
		user.email,
	);
	const { tenantId, activeMembership } = await resolveTenantMembership(
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

	return {
		user,
		profile,
		tenantId: effectiveTenantId,
		isSuperAdmin,
		membershipRole: activeMembership?.role ?? null,
	};
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
	invited_operational_role_id?: string | null;
	invited_operational_role_name?: string | null;
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
	operationalRoleId,
}: {
	tenantId: string;
	email: string;
	role?: InvitedRole;
	operationalRoleId?: string | null;
}) {
	const session = await auth();
	if (!session.data.user) return { error: "Iniciá sesión para enviar invitaciones" };
	const supabase = await createClient();
	let authContext: Awaited<ReturnType<typeof requireUsersAdmin>>;
	try {
		authContext = await requireUsersAdmin(supabase, tenantId);
	} catch (error) {
		console.error("Unauthorized invitation send attempt:", error);
		return { error: "No tenés permiso para invitar personas" };
	}
	const { user, profile, membershipRole, isSuperAdmin } = authContext;
	if (
		role === "admin" &&
		!isSuperAdmin &&
		membershipRole !== "owner" &&
		membershipRole !== "admin"
	) {
		return { error: "Solo una persona propietaria o administradora puede invitar administradores" };
	}

	let validatedOperationalRoleId: string | null = null;
	if (role === "member" && operationalRoleId) {
		const { data: operationalRole, error: operationalRoleError } = await supabase
			.from("roles")
			.select("id")
			.eq("id", operationalRoleId)
			.eq("tenant_id", tenantId)
			.maybeSingle();
		if (operationalRoleError || !operationalRole) {
			return { error: "El rol de trabajo elegido ya no está disponible" };
		}
		validatedOperationalRoleId = operationalRole.id as string;
	}

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
		return { error: "No pudimos validar el correo de la invitación" };
	}
	if (isExistingMember) {
		return { error: "Ese correo ya pertenece a la organización" };
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
		return { error: "Ya hay una invitación pendiente para ese correo" };
	}

	// Create invitation
	const { data: invitation, error: insertError } = await supabase
		.from("invitations")
		.insert({
			tenant_id: tenantId,
			email: normalizedEmail,
			invited_by: user.id,
			invited_role: role,
			invited_operational_role_id: validatedOperationalRoleId,
			status: "pending",
		})
		.select("id, token")
		.single();

	if (insertError) {
		console.error("Error creating invitation:", insertError);
		return { error: "No pudimos crear la invitación" };
	}

	const baseUrl = getInvitationBaseUrl();
	const inviteLink = `${baseUrl}/invitations/${invitation.token}`;
	const { data: tenant } = await supabase
		.from("tenants")
		.select("name")
		.eq("id", tenantId)
		.maybeSingle();

	let emailSent = true;
	try {
		await sendInvitationEmail({
			to: normalizedEmail,
			inviteLink,
			tenantName: tenant?.name ?? "tu organización",
			inviterName: profile?.full_name ?? user.email ?? null,
		});
	} catch (emailError) {
		emailSent = false;
		console.error("Failed to send invitation email", emailError);
	}

	revalidatePath("/admin/users");

	return {
		success: true,
		invitationId: invitation.id,
		token: invitation.token,
		inviteLink,
		emailSent,
	};
}

/**
 * Accept an invitation
 */
export async function acceptInvitation(token: string) {
	const session = await auth();
	if (!session.data.user) {
		return { error: "Iniciá sesión para aceptar la invitación" };
	}
	const supabase = await createClient();

	// Get current user
	const {
		data: { user },
		error: authError,
	} = await supabase.auth.getUser();

	if (authError || !user) {
		return { error: "Iniciá sesión para aceptar la invitación" };
	}

	// Get user email
	const userEmail = user.email?.toLowerCase().trim();
	if (!userEmail) {
		return { error: "No encontramos un correo en tu cuenta" };
	}

	// Get invitation details using the helper function
	const { data: invitationDetails, error: inviteError } = await supabase.rpc(
		"get_invitation_by_token",
		{ invitation_token: token }
	);

	if (inviteError || !invitationDetails || invitationDetails.length === 0) {
		return { error: "La invitación no es válida o ya venció" };
	}

	const invitation = invitationDetails[0];

	// Verify email matches
	if (invitation.email.toLowerCase() !== userEmail) {
		return {
			error: `La invitación fue enviada a ${invitation.email}. Iniciá sesión con ese correo para aceptarla.`,
		};
	}

	const { data: acceptedInvitations, error: acceptError } = await supabase.rpc(
		"accept_tenant_invitation",
		{ p_token: token },
	);
	const acceptedInvitation = Array.isArray(acceptedInvitations)
		? acceptedInvitations[0]
		: null;

	if (acceptError || !acceptedInvitation) {
		console.error("Error accepting invitation:", acceptError);
		return { error: "No pudimos incorporarte a la organización" };
	}

	revalidatePath("/");
	revalidatePath("/admin/users");

	return {
		success: true,
		tenantId: acceptedInvitation.tenant_id,
		tenantName: acceptedInvitation.tenant_name,
	};
}

/**
 * Decline an invitation
 */
export async function declineInvitation(token: string) {
	const session = await auth();
	if (!session.data.user) {
		return { error: "Iniciá sesión para rechazar la invitación" };
	}
	const supabase = await createClient();
	const { data: declined, error } = await supabase.rpc(
		"decline_tenant_invitation",
		{ p_token: token },
	);

	if (error || declined !== true) {
		console.error("Error declining invitation:", error);
		return { error: "No pudimos rechazar la invitación. Puede haber vencido." };
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
	} catch (error) {
		console.error("Unauthorized invitation cancellation attempt:", error);
		return { error: "Unauthorized" };
	}

	const { data: cancelledInvitation, error: updateError } = await supabase.rpc(
		"cancel_tenant_invitation",
		{ p_invitation_id: invitationId },
	);

	if (updateError || cancelledInvitation !== true) {
		console.error("Error cancelling invitation:", updateError);
		return { error: "No pudimos cancelar la invitación. Puede haber vencido." };
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
	const invitationResult = await supabase
		.from("invitations")
		.select(
			`
      id,
      email,
      token,
      invited_role,
	  invited_operational_role_id,
	  invited_operational_role_name,
      status,
      expires_at,
      created_at,
      invited_by
    `
		)
		.eq("tenant_id", tenantId)
		.eq("status", "pending")
		.order("created_at", { ascending: false });

	let invitations = invitationResult.data;
	let invitationError = invitationResult.error;
	if (isOperationalRoleSchemaMissing(invitationError)) {
		const legacyResult = await supabase
			.from("invitations")
			.select(
				"id, email, token, invited_role, status, expires_at, created_at, invited_by",
			)
			.eq("tenant_id", tenantId)
			.eq("status", "pending")
			.order("created_at", { ascending: false });
		invitations = legacyResult.data as typeof invitations;
		invitationError = legacyResult.error;
	}

	let invitationRows: InvitationWithDetails[] = (invitations ?? []) as InvitationRow[];

	// Manually fetch inviter profiles if we have invitations
	if (!invitationError && invitations && invitations.length > 0) {
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
			inviteLink: inv.token ? `${getInvitationBaseUrl()}/invitations/${inv.token}` : null,
		}));
	}

	if (invitationError) {
		if (isInvitationsTableMissing(invitationError)) {
			console.warn(
				"Invitations table not found; skipping pending invitation list."
			);
			return { invitations: [] };
		}
		console.error("Error fetching invitations:", invitationError);
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
		return { error: "Iniciá sesión para revisar tus invitaciones" };
	}
	const supabase = await createClient();

	// Get current user
	const {
		data: { user },
		error: authError,
	} = await supabase.auth.getUser();

	if (authError || !user || !user.email) {
		return { error: "No pudimos verificar el correo de tu cuenta" };
	}

	// Expire old invitations first
	const { error: expireError } = await supabase.rpc("expire_old_invitations");
	if (expireError) {
		console.warn("expire_old_invitations RPC failed:", expireError);
	}

	const normalizedEmail = user.email.toLowerCase().trim();

	// Get pending invitations for user's email with manual joins.
	// Use case-insensitive match to avoid missing invites due to casing.
	const invitationResult = await supabase
		.from("invitations")
		.select(
			`
      id,
      token,
      tenant_id,
      invited_role,
	  invited_operational_role_id,
	  invited_operational_role_name,
      expires_at,
      created_at,
      invited_by
    `
		)
		.ilike("email", normalizedEmail)
		.eq("status", "pending")
		.gt("expires_at", new Date().toISOString())
		.order("created_at", { ascending: false });

	let invitationRows: InvitationWithDetails[] = (invitationResult.data ?? []) as InvitationRow[];
	let invitationError = invitationResult.error;
	if (isOperationalRoleSchemaMissing(invitationError)) {
		const legacyResult = await supabase
			.from("invitations")
			.select(
				"id, token, tenant_id, invited_role, expires_at, created_at, invited_by",
			)
			.ilike("email", normalizedEmail)
			.eq("status", "pending")
			.gt("expires_at", new Date().toISOString())
			.order("created_at", { ascending: false });
		invitationRows = (legacyResult.data ?? []) as InvitationRow[];
		invitationError = legacyResult.error;
	}

	// Fallback for stricter RLS setups: query with admin client after authenticating
	// current user and filter by normalized email server-side.
	if (invitationError || invitationRows.length === 0) {
		try {
			const admin = createSupabaseAdminClient();
			const adminResult = await admin
				.from("invitations")
				.select(
					`
          id,
          token,
          tenant_id,
          invited_role,
		  invited_operational_role_id,
		  invited_operational_role_name,
          expires_at,
          created_at,
          invited_by,
          email
        `
				)
				.ilike("email", normalizedEmail)
				.eq("status", "pending")
				.gt("expires_at", new Date().toISOString())
				.order("created_at", { ascending: false });
			let adminInvitations = adminResult.data;
			let adminError = adminResult.error;
			if (isOperationalRoleSchemaMissing(adminError)) {
				const legacyAdminResult = await admin
					.from("invitations")
					.select(
						"id, token, tenant_id, invited_role, expires_at, created_at, invited_by, email",
					)
					.ilike("email", normalizedEmail)
					.eq("status", "pending")
					.gt("expires_at", new Date().toISOString())
					.order("created_at", { ascending: false });
				adminInvitations = legacyAdminResult.data as typeof adminInvitations;
				adminError = legacyAdminResult.error;
			}
			if (!adminError && adminInvitations) {
				invitationRows = adminInvitations as InvitationRow[];
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
		return { error: "No pudimos cargar tus invitaciones. Volvé a intentarlo." };
	}

	return { invitations: invitationRows };
}
