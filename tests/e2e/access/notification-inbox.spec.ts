import { expect, test } from "../fixtures/test";
import {
	insertOwnNotification,
	notificationToast,
	readOwnNotification,
} from "./access-journeys";

test("the unread list and toast belong to their recipient, and dismissal survives reload", async ({
	scenario,
}) => {
	const owner = await scenario.actor("owner");
	const otherOwner = await scenario.actor("otherOwner");
	const suffix = scenario.namespace.slice(-8);
	const ownTitle = `Aviso propio ${suffix}`;
	const foreignTitle = `Aviso ajeno ${suffix}`;
	const ownNotification = await insertOwnNotification({
		actor: owner,
		tenantId: scenario.tenants.a,
		title: ownTitle,
		body: "Solo la persona destinataria puede leer este aviso.",
	});
	await insertOwnNotification({
		actor: otherOwner,
		tenantId: scenario.tenants.b,
		title: foreignTitle,
		body: "Este aviso pertenece a otra identidad.",
	});

	const page = await owner.context.newPage();
	await page.goto("/admin/dashboard");
	const ownToast = notificationToast(page, ownTitle);
	await expect(ownToast).toBeVisible();
	await expect(page.getByText(foreignTitle)).toHaveCount(0);
	await ownToast.getByRole("button", { name: "Descartar" }).click();
	await expect.poll(async () => (await readOwnNotification(owner, ownNotification.id)).read_at).not.toBeNull();

	await page.reload();
	await expect(page.getByText(ownTitle)).toHaveCount(0);
	await expect(page.getByText(foreignTitle)).toHaveCount(0);
	const persisted = await readOwnNotification(owner, ownNotification.id);
	expect(persisted.read_at).not.toBeNull();
});

test("a failed dismissal keeps the notification unread and eligible after reload", async ({
	scenario,
}) => {
	const owner = await scenario.actor("owner");
	const title = `Aviso reintentable ${scenario.namespace.slice(-8)}`;
	const notification = await insertOwnNotification({
		actor: owner,
		tenantId: scenario.tenants.a,
		title,
		body: "Debe volver a aparecer si no se pudo guardar el descarte.",
	});
	const page = await owner.context.newPage();
	await page.goto("/admin/dashboard");
	const notificationRest = "**/rest/v1/notifications*";
	const firstToast = notificationToast(page, title);
	await expect(firstToast).toBeVisible();
	await page.route(notificationRest, async (route) => {
		if (route.request().method() !== "PATCH") {
			await route.continue();
			return;
		}
		await route.fulfill({
			status: 503,
			contentType: "application/json",
			body: JSON.stringify({ message: "Synthetic notification write failure" }),
		});
	});
	const failedUpdate = page.waitForResponse(
		(response) =>
			response.request().method() === "PATCH" &&
			response.url().includes("/rest/v1/notifications") &&
			response.status() === 503,
	);
	await firstToast.getByRole("button", { name: "Descartar" }).click();
	await failedUpdate;
	await expect.poll(async () => (await readOwnNotification(owner, notification.id)).read_at).toBeNull();

	await page.unroute(notificationRest);
	await page.reload();
	await expect(notificationToast(page, title)).toBeVisible();
});

test("the active tenant hides another tenant's notification for the same identity", async ({
	scenario,
}) => {
	const owner = await scenario.actor("owner");
	await scenario.permissions.seedUserOverride("owner", "nav:notifications", {
		tenant: "b",
		decision: "grant",
	});
	const tenantBMembership = await owner.db
		.from("memberships")
		.select("tenant_id, user_id, role")
		.eq("tenant_id", scenario.tenants.b)
		.eq("user_id", owner.userId)
		.single();
	expect(tenantBMembership.error).toBeNull();
	expect(tenantBMembership.data).toEqual({
		tenant_id: scenario.tenants.b,
		user_id: owner.userId,
		role: "member",
	});
	const suffix = scenario.namespace.slice(-8);
	const foreignTitle = `Tenant B oculto ${suffix}`;
	const foreignNotification = await insertOwnNotification({
		actor: owner,
		tenantId: scenario.tenants.b,
		title: foreignTitle,
		body: "No debe aparecer mientras tenant A está activo.",
	});
	const activeTitle = `Tenant A visible ${suffix}`;
	const activeNotification = await insertOwnNotification({
		actor: owner,
		tenantId: scenario.tenants.a,
		title: activeTitle,
		body: "Confirma que el listener terminó de cargar los avisos pendientes.",
	});

	const page = await owner.context.newPage();
	await page.goto("/admin/dashboard");
	const activeToast = notificationToast(page, activeTitle);
	await expect(activeToast).toBeVisible();
	await expect(notificationToast(page, foreignTitle)).toHaveCount(0);
	await activeToast.getByRole("button", { name: "Descartar" }).click();
	await expect.poll(async () => (await readOwnNotification(owner, activeNotification.id)).read_at).not.toBeNull();

	const persisted = await readOwnNotification(owner, foreignNotification.id);
	expect(persisted).toMatchObject({
		tenant_id: scenario.tenants.b,
		user_id: owner.userId,
		read_at: null,
	});
});
