import type { Page } from "@playwright/test";
import { z } from "zod";

import { expect, type Actor } from "../fixtures/test";

const invitationSchema = z.object({
	id: z.string().uuid(),
	tenant_id: z.string().uuid(),
	email: z.string().email(),
	token: z.string().min(1),
	status: z.enum(["pending", "accepted", "declined", "expired", "cancelled"]),
	expires_at: z.string(),
});

const notificationSchema = z.object({
	id: z.string().uuid(),
	tenant_id: z.string().uuid().nullable(),
	user_id: z.string().uuid(),
	title: z.string(),
	read_at: z.string().nullable(),
});

export type IssuedInvitation = z.infer<typeof invitationSchema> & {
	path: string;
};

export async function readActorEmail(actor: Actor) {
	const auth = await actor.db.auth.getUser();
	if (auth.error || !auth.data.user?.email) {
		throw new Error(`Could not read synthetic actor email: ${auth.error?.message ?? "email missing"}`);
	}
	return auth.data.user.email.toLowerCase();
}

async function openInvitationForm(page: Page) {
	const trigger = page.getByRole("button", { name: "Invitar persona", exact: true });
	await expect(trigger).toBeEnabled();
	await trigger.click();
	await expect(page.getByRole("dialog", { name: "Invitar Usuarios a la Organización" })).toBeVisible();
}

export function notificationToast(page: Page, title: string) {
	return page.locator("[data-sonner-toast]").filter({ hasText: title });
}

export async function submitInvitation(page: Page, email: string) {
	await page.getByLabel("Correo Electrónico").fill(email);
	await page.getByRole("button", { name: "Enviar Invitación" }).click();
}

export async function issueInvitationThroughAdmin({
	owner,
	page,
	tenantId,
	recipientEmail,
}: {
	owner: Actor;
	page: Page;
	tenantId: string;
	recipientEmail: string;
}): Promise<IssuedInvitation> {
	await page.goto("/admin/users");
	await openInvitationForm(page);
	await submitInvitation(page, recipientEmail);

	const linkInput = page.getByRole("textbox", {
		name: "Enlace de Invitación",
		exact: true,
	});
	await expect(linkInput).toBeVisible();
	const inviteLink = new URL(await linkInput.inputValue());
	expect(inviteLink.origin).toBe(new URL(page.url()).origin);
	const pathMatch = inviteLink.pathname.match(/^\/invitations\/([^/]+)$/);
	if (!pathMatch) throw new Error(`Unexpected invitation link: ${inviteLink.pathname}`);

	const result = await owner.db
		.from("invitations")
		.select("id, tenant_id, email, token, status, expires_at")
		.eq("tenant_id", tenantId)
		.eq("email", recipientEmail)
		.eq("status", "pending")
		.single();
	if (result.error) throw new Error(`Could not read issued invitation: ${result.error.message}`);
	const invitation = invitationSchema.parse(result.data);
	expect(invitation.token).toBe(pathMatch[1]);

	return { ...invitation, path: inviteLink.pathname };
}

export async function reopenInvitationForm(page: Page) {
	await page.getByRole("button", { name: "Invitar Otro" }).click();
	await expect(page.getByLabel("Correo Electrónico")).toBeVisible();
}

export async function insertOwnNotification({
	actor,
	tenantId,
	title,
	body,
}: {
	actor: Actor;
	tenantId: string;
	title: string;
	body: string;
}) {
	const result = await actor.db
		.from("notifications")
		.insert({
			user_id: actor.userId,
			tenant_id: tenantId,
			title,
			body,
			type: "info",
			data: { fixture: "access-notifications" },
		})
		.select("id, tenant_id, user_id, title, read_at")
		.single();
	if (result.error) throw new Error(`Could not insert actor notification: ${result.error.message}`);
	return notificationSchema.parse(result.data);
}

export async function readOwnNotification(actor: Actor, notificationId: string) {
	const result = await actor.db
		.from("notifications")
		.select("id, tenant_id, user_id, title, read_at")
		.eq("id", notificationId)
		.single();
	if (result.error) throw new Error(`Could not read actor notification: ${result.error.message}`);
	return notificationSchema.parse(result.data);
}
