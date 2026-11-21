import type { SupabaseClient } from "@supabase/supabase-js";

import type { FixtureManifest } from "./manifest";

type AccessFixtureController = {
	expireInvitation(invitationId: string): Promise<void>;
};

function assertWrite(error: { message: string } | null, operation: string) {
	if (error) throw new Error(`${operation}: ${error.message}`);
}

export function createAccessFixtureController({
	admin,
	tenantId,
	namespace,
	manifest,
}: {
	admin: SupabaseClient;
	tenantId: string;
	namespace: string;
	manifest: FixtureManifest;
}): AccessFixtureController {
	return {
		async expireInvitation(invitationId) {
			const invitation = await admin
				.from("invitations")
				.select("id, tenant_id, email, invited_by, status")
				.eq("id", invitationId)
				.maybeSingle();
			assertWrite(invitation.error, "Inspect invitation expiry precondition");

			if (!invitation.data) {
				throw new Error("The invitation expiry precondition was not found.");
			}
			if (invitation.data.tenant_id !== tenantId) {
				throw new Error("Refusing to expire an invitation outside the fixture tenant.");
			}
			if (!manifest.ids("auth-user").includes(invitation.data.invited_by)) {
				throw new Error("Refusing to expire an invitation from an unowned inviter.");
			}
			if (!invitation.data.email.endsWith(`.${namespace}@e2e.invalid`)) {
				throw new Error("Refusing to expire an invitation for an unowned recipient.");
			}
			if (invitation.data.status !== "pending") {
				throw new Error(`Invitation must be pending before expiry, received ${invitation.data.status}.`);
			}

			const expiredAt = new Date(Date.now() - 60_000).toISOString();
			const updated = await admin
				.from("invitations")
				.update({ expires_at: expiredAt })
				.eq("id", invitationId)
				.eq("tenant_id", tenantId)
				.eq("status", "pending")
				.select("id, expires_at")
				.single();
			assertWrite(updated.error, "Age owned invitation past its deadline");
			if (
				!updated.data?.expires_at ||
				Date.parse(updated.data.expires_at) !== Date.parse(expiredAt)
			) {
				throw new Error("The invitation expiry precondition did not persist.");
			}
		},
	};
}

export type AccessFixture = ReturnType<typeof createAccessFixtureController>;
