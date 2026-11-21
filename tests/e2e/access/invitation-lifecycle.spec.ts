import { expect, test } from "../fixtures/test";
import {
	issueInvitationThroughAdmin,
	readActorEmail,
	reopenInvitationForm,
	submitInvitation,
} from "./access-journeys";

test("an invited identity accepts once and keeps the tenant membership in a fresh session", async ({
	scenario,
}) => {
	const owner = await scenario.actor("owner");
	const recipient = await scenario.actor("otherOwner");
	const recipientEmail = await readActorEmail(recipient);
	const ownerPage = await owner.context.newPage();
	const invitation = await issueInvitationThroughAdmin({
		owner,
		page: ownerPage,
		tenantId: scenario.tenants.a,
		recipientEmail,
	});

	// The local runtime has no outbound email transport. The returned product link is the exercised handoff.
	const recipientPage = await recipient.context.newPage();
	await recipientPage.goto(invitation.path);
	await expect(recipientPage.getByText("Te invitaron a trabajar en Síntesis", { exact: true })).toBeVisible();
	await recipientPage.getByRole("button", { name: "Aceptar invitación" }).click();
	await recipientPage.waitForURL(/\/dashboard(?:\?|$)/);

	const membership = await recipient.db
		.from("memberships")
		.select("tenant_id, user_id, role")
		.eq("tenant_id", scenario.tenants.a)
		.eq("user_id", recipient.userId);
	expect(membership.error).toBeNull();
	expect(membership.data).toEqual([
		{ tenant_id: scenario.tenants.a, user_id: recipient.userId, role: "member" },
	]);

	const persistedInvitation = await owner.db
		.from("invitations")
		.select("status, accepted_by, accepted_at")
		.eq("id", invitation.id)
		.single();
	expect(persistedInvitation.error).toBeNull();
	expect(persistedInvitation.data).toMatchObject({
		status: "accepted",
		accepted_by: recipient.userId,
	});
	expect(persistedInvitation.data?.accepted_at).not.toBeNull();

	const freshContext = await scenario.newContext("otherOwner", {
		activeTenantId: scenario.tenants.a,
	});
	const freshPage = await freshContext.newPage();
	await freshPage.goto(invitation.path);
	await expect(freshPage.getByText("Invitación no válida", { exact: true })).toBeVisible();
	await freshContext.close();
});

test("a second pending invitation for the same tenant and email is denied", async ({
	scenario,
}) => {
	const owner = await scenario.actor("owner");
	const recipient = await scenario.actor("otherOwner");
	const recipientEmail = await readActorEmail(recipient);
	const page = await owner.context.newPage();
	await issueInvitationThroughAdmin({
		owner,
		page,
		tenantId: scenario.tenants.a,
		recipientEmail,
	});

	await reopenInvitationForm(page);
	await submitInvitation(page, recipientEmail);
	await expect(page.getByText("Ya hay una invitación pendiente para ese correo", { exact: true })).toBeVisible();

	const invitations = await owner.db
		.from("invitations")
		.select("id")
		.eq("tenant_id", scenario.tenants.a)
		.eq("email", recipientEmail)
		.eq("status", "pending");
	expect(invitations.error).toBeNull();
	expect(invitations.data).toHaveLength(1);
});

test("a mismatched identity cannot accept another recipient's invitation", async ({
	scenario,
}) => {
	const owner = await scenario.actor("owner");
	const mismatchedActor = await scenario.actor("admin");
	const recipient = await scenario.actor("otherOwner");
	const recipientEmail = await readActorEmail(recipient);
	const ownerPage = await owner.context.newPage();
	const invitation = await issueInvitationThroughAdmin({
		owner,
		page: ownerPage,
		tenantId: scenario.tenants.a,
		recipientEmail,
	});

	const mismatchedPage = await mismatchedActor.context.newPage();
	await mismatchedPage.goto(invitation.path);
	await expect(mismatchedPage.getByText(`Esta invitación fue enviada a ${recipientEmail}. Iniciá sesión con ese correo para aceptarla.`)).toBeVisible();
	await expect(mismatchedPage.getByRole("button", { name: "Aceptar invitación" })).toBeDisabled();

	const denied = await mismatchedActor.db.rpc("accept_tenant_invitation", {
		p_token: invitation.token,
	});
	expect(denied.error?.code).toBe("22023");
	const recipientMembership = await recipient.db
		.from("memberships")
		.select("tenant_id")
		.eq("tenant_id", scenario.tenants.a)
		.eq("user_id", recipient.userId);
	expect(recipientMembership.error).toBeNull();
	expect(recipientMembership.data).toEqual([]);

	const invitationAfterDenial = await owner.db
		.from("invitations")
		.select("status, accepted_by")
		.eq("id", invitation.id)
		.single();
	expect(invitationAfterDenial.error).toBeNull();
	expect(invitationAfterDenial.data).toEqual({ status: "pending", accepted_by: null });
});

test("an expired invitation is rejected without adding the recipient", async ({ scenario }) => {
	const owner = await scenario.actor("owner");
	const recipient = await scenario.actor("otherOwner");
	const recipientEmail = await readActorEmail(recipient);
	const ownerPage = await owner.context.newPage();
	const invitation = await issueInvitationThroughAdmin({
		owner,
		page: ownerPage,
		tenantId: scenario.tenants.a,
		recipientEmail,
	});

	await scenario.access.expireInvitation(invitation.id);
	const expireResult = await owner.db.rpc("expire_old_invitations");
	expect(expireResult.error).toBeNull();

	const recipientPage = await recipient.context.newPage();
	await recipientPage.goto(invitation.path);
	await expect(recipientPage.getByText("Invitación no válida", { exact: true })).toBeVisible();
	const denied = await recipient.db.rpc("accept_tenant_invitation", {
		p_token: invitation.token,
	});
	expect(denied.error?.code).toBe("22023");

	const membership = await recipient.db
		.from("memberships")
		.select("tenant_id")
		.eq("tenant_id", scenario.tenants.a)
		.eq("user_id", recipient.userId);
	expect(membership.error).toBeNull();
	expect(membership.data).toEqual([]);
	const persisted = await owner.db
		.from("invitations")
		.select("status, accepted_by")
		.eq("id", invitation.id)
		.single();
	expect(persisted.error).toBeNull();
	expect(persisted.data).toEqual({ status: "expired", accepted_by: null });
});
