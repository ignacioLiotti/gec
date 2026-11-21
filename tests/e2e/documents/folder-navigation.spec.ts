import type { BrowserContext, Page, Route } from "@playwright/test";

import {
	expect,
	test,
	type Actor,
} from "../fixtures/test";
import {
	buildExcelObraName,
	createObraViaBulkApi,
} from "../helpers/obras";

type FolderNavigationDeferred<T> = {
	promise: Promise<T>;
	resolve: (value: T) => void;
};

function folderNavigationDeferred<T>(): FolderNavigationDeferred<T> {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((next) => {
		resolve = next;
	});
	return { promise, resolve };
}

function folderNavigationExactLabel(label: string) {
	return new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
}

function folderNavigationIsListRequest(url: string, obraId: string, folderPath: string) {
	const parsed = new URL(url);
	return (
		parsed.pathname === `/api/obras/${obraId}/documents/list` &&
		parsed.searchParams.get("path") === folderPath
	);
}

async function folderNavigationSeedFile(
	actor: Actor,
	storagePath: string,
	contents: string,
) {
	const result = await actor.db.storage
		.from("obra-documents")
		.upload(storagePath, Buffer.from(contents), {
			contentType: "text/plain",
			upsert: false,
		});
	expect(result.error).toBeNull();
}

async function folderNavigationOpenDocuments(page: Page, obraId: string) {
	page.setDefaultTimeout(15_000);
	page.setDefaultNavigationTimeout(60_000);
	await page.goto(`/excel/${obraId}?tab=documentos`);
	await expect(
		page.getByRole("heading", { name: "Todos los documentos", exact: true }),
	).toBeVisible();
}

async function folderNavigationOpenFolder(page: Page, label: string) {
	await page.getByRole("button", { name: folderNavigationExactLabel(label) }).click();
	await expect(
		page.getByRole("heading", { name: folderNavigationExactLabel(label) }),
	).toBeVisible();
}

async function folderNavigationCloseContext(context: BrowserContext) {
	await context.close();
}

test.describe.configure({ timeout: 120_000 });

test("keeps the live folder selected when an older path-scoped refresh completes", async ({
	page,
	scenario,
}) => {
	const owner = await scenario.actor("owner");
	const suffix = scenario.namespace.slice(-8).toLowerCase();
	const obra = await createObraViaBulkApi(owner.request, {
		designacionYUbicacion: buildExcelObraName(`${scenario.namespace} scoped folder race`),
	});
	const alpha = {
		label: `Race Alpha ${suffix}`,
		path: `race-alpha-${suffix}`,
		fileName: `alpha-source-${suffix}.txt`,
	};
	const bravo = {
		label: `Race Bravo ${suffix}`,
		path: `race-bravo-${suffix}`,
		fileName: `bravo-current-${suffix}.txt`,
	};

	await Promise.all([
		folderNavigationSeedFile(
			owner,
			`${obra.id}/${alpha.path}/${alpha.fileName}`,
			"alpha source",
		),
		folderNavigationSeedFile(
			owner,
			`${obra.id}/${bravo.path}/${bravo.fileName}`,
			"bravo current",
		),
	]);

	await folderNavigationOpenDocuments(page, obra.id);

	const releaseAlphaRefresh = folderNavigationDeferred<void>();
	const continuedAlphaRefresh = folderNavigationDeferred<void>();
	const listRoutePattern = `**/api/obras/${obra.id}/documents/list**`;
	let didHoldAlphaRefresh = false;
	await page.route(listRoutePattern, async (route: Route) => {
		const request = route.request();
		if (
			!didHoldAlphaRefresh &&
			request.method() === "GET" &&
			folderNavigationIsListRequest(request.url(), obra.id, alpha.path)
		) {
			didHoldAlphaRefresh = true;
			await releaseAlphaRefresh.promise;
			try {
				await route.continue();
			} finally {
				continuedAlphaRefresh.resolve();
			}
			return;
		}
		await route.continue();
	});

	try {
		await folderNavigationOpenFolder(page, alpha.label);
		await expect.poll(() => didHoldAlphaRefresh, { timeout: 15_000 }).toBe(true);

		await page
			.getByRole("button", { name: "Volver a Todos los documentos", exact: true })
			.click();
		await expect(
			page.getByRole("heading", { name: "Todos los documentos", exact: true }),
		).toBeVisible();
		const bravoResponse = page.waitForResponse((response) =>
			response.request().method() === "GET" &&
			folderNavigationIsListRequest(response.url(), obra.id, bravo.path),
		);
		await folderNavigationOpenFolder(page, bravo.label);
		expect((await bravoResponse).status()).toBe(200);
		await expect(page.getByText(bravo.fileName, { exact: true }).first()).toBeVisible();

		const alphaResponse = page.waitForResponse((response) =>
			response.request().method() === "GET" &&
			folderNavigationIsListRequest(response.url(), obra.id, alpha.path),
		);
		releaseAlphaRefresh.resolve();
		expect((await alphaResponse).status()).toBe(200);
		await continuedAlphaRefresh.promise;

		await expect(
			page.getByRole("heading", { name: folderNavigationExactLabel(bravo.label) }),
		).toBeVisible();
		await expect(page.getByText(bravo.fileName, { exact: true }).first()).toBeVisible();
		await expect(page.getByText(alpha.fileName, { exact: true })).toHaveCount(0);
		await page.getByRole("button").filter({ hasText: bravo.fileName }).first().click();
		await expect(
			page.getByRole("heading", { name: bravo.fileName, exact: true }),
		).toBeVisible();
	} finally {
		releaseAlphaRefresh.resolve();
		if (didHoldAlphaRefresh) {
			await continuedAlphaRefresh.promise;
		}
		await page.unroute(listRoutePattern);
	}

	const freshContext = await scenario.newContext("owner");
	try {
		const freshPage = await freshContext.newPage();
		await folderNavigationOpenDocuments(freshPage, obra.id);
		await folderNavigationOpenFolder(freshPage, bravo.label);
		await expect(
			freshPage.getByText(bravo.fileName, { exact: true }).first(),
		).toBeVisible();

		await freshPage
			.getByRole("button", { name: "Volver a Todos los documentos", exact: true })
			.click();
		await folderNavigationOpenFolder(freshPage, alpha.label);
		await expect(
			freshPage.getByText(alpha.fileName, { exact: true }).first(),
		).toBeVisible();
	} finally {
		await folderNavigationCloseContext(freshContext);
	}
});
