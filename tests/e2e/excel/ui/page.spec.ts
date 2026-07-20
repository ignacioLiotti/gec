import { expect, test } from "@playwright/test";
import {
	buildExcelObraName,
	createObraViaBulkApi,
	deleteObrasByNames,
} from "../../helpers/obras";

test.describe("Excel page microflows", () => {
	test.use({
		viewport: { width: 1440, height: 960 },
	});

	const createdNames: string[] = [];
	const obraInput = (page: import("@playwright/test").Page, field: string) =>
		page.locator(`input[data-field="${field}"]`).first();

	test.afterEach(async () => {
		await deleteObrasByNames(createdNames.splice(0));
	});

	test("creates and saves a new obra from /excel", async ({ page }) => {
		const designacionYUbicacion = buildExcelObraName("UI Save");
		createdNames.push(designacionYUbicacion);

		await page.goto("/excel");

		await expect(
			page.getByRole("heading", { name: /panel de obras/i }),
		).toBeVisible();
		await page.waitForLoadState("networkidle");

		await page.getByTestId("form-table-add-row").click();

		await expect(obraInput(page, "designacionYUbicacion")).toBeVisible();

		await obraInput(page, "designacionYUbicacion").fill(designacionYUbicacion);
		await obraInput(page, "entidadContratante").fill("UI Save Tenant");
		await obraInput(page, "mesBasicoDeContrato").fill("01/01/2025");
		await obraInput(page, "iniciacion").fill("15/01/2025");
		await obraInput(page, "iniciacion").press("Tab");

		const saveButton = page.getByTestId("form-table-save");
		await expect(saveButton).toBeEnabled();

		const saveRequest = page.waitForResponse((response) => {
			const request = response.request();
			return (
				response.url().includes("/api/obras") &&
				request.method() === "PUT" &&
				response.ok()
			);
		});

		await Promise.all([
			saveRequest,
			saveButton.click(),
		]);

		await page.reload();
		await page.waitForLoadState("networkidle");
		await page.getByTestId("form-table-search").fill(designacionYUbicacion);

		await expect(obraInput(page, "designacionYUbicacion")).toHaveValue(
			designacionYUbicacion,
		);
	});

	test("search and tabs isolate in-process vs completed obras", async ({
		page,
		request,
	}) => {
		const nameBase = buildExcelObraName("UI Filter");
		const inProcessName = `${nameBase} InProcess`;
		const completedName = `${nameBase} Completed`;
		createdNames.push(inProcessName, completedName);

		await createObraViaBulkApi(request, {
			designacionYUbicacion: inProcessName,
			porcentaje: 25,
		});
		await createObraViaBulkApi(request, {
			designacionYUbicacion: completedName,
			porcentaje: 100,
		});

		await page.goto("/excel");
		await page.waitForLoadState("networkidle");

		const searchInput = page.getByTestId("form-table-search");
		await searchInput.fill(nameBase);

		await expect(page.getByRole("cell", { name: inProcessName })).toBeVisible();
		await expect(page.getByRole("cell", { name: completedName })).toBeVisible();

		await page.getByRole("tab", { name: /en proceso/i }).click();
		await expect(page.getByRole("cell", { name: inProcessName })).toBeVisible();
		await expect(page.getByRole("cell", { name: completedName })).toHaveCount(0);

		await page.getByRole("tab", { name: /completadas/i }).click();
		await expect(page.getByRole("cell", { name: completedName })).toBeVisible();
		await expect(page.getByRole("cell", { name: inProcessName })).toHaveCount(0);
	});

	test("expands Excel toolbar labels with fast shared easing", async ({ page }) => {
		await page.goto("/excel");
		await page.waitForLoadState("networkidle");

		const controls = [
			{ button: page.getByRole("button", { name: "Filtros", exact: true }), label: "Filtros" },
			{ button: page.getByRole("button", { name: "Columnas", exact: true }), label: "Columnas" },
			{ button: page.getByRole("button", { name: "Exportar tabla", exact: true }), label: "Exportar tabla" },
		];
		await Promise.all(controls.map(({ button }) => expect(button).toBeVisible()));

		for (const { button, label } of controls) {
			const collapsedBox = await button.boundingBox();
			expect(collapsedBox).not.toBeNull();
			expect(collapsedBox!.width).toBe(32);

			await button.hover();
			await expect.poll(async () => (await button.boundingBox())?.width ?? 0).toBeGreaterThan(32);

			const labelMotion = await button.getByText(label, { exact: true }).evaluate((element) => {
				const labelShell = element.parentElement;
				if (!labelShell) throw new Error("Expandable label shell is missing");
				const style = getComputedStyle(labelShell);
				const textStyle = getComputedStyle(element);
				return {
					gridTemplateColumns: style.gridTemplateColumns,
					transitionDelay: style.transitionDelay,
					transitionDuration: style.transitionDuration,
					transitionTimingFunction: style.transitionTimingFunction,
					textTranslate: textStyle.translate,
				};
			});
			expect(Number.parseFloat(labelMotion.gridTemplateColumns)).toBeGreaterThan(0);
			expect(labelMotion.transitionDelay).toBe("0s");
			expect(labelMotion.transitionDuration).toBe("0.18s");
			expect(labelMotion.transitionTimingFunction).toBe("cubic-bezier(0.4, 0, 0.2, 1)");
			expect(labelMotion.textTranslate).toBe("none");

			await page.mouse.move(0, 0);
			await expect.poll(async () => (await button.boundingBox())?.width ?? 0).toBe(32);
		}

		const filtersButton = controls[0].button;
		await filtersButton.hover();
		await page.waitForTimeout(200);
		const expandedWidth = (await filtersButton.boundingBox())?.width ?? 0;
		await page.mouse.move(0, 0);
		await page.waitForTimeout(40);
		const interruptedExitWidth = (await filtersButton.boundingBox())?.width ?? 0;
		expect(interruptedExitWidth).toBeGreaterThan(32);
		expect(interruptedExitWidth).toBeLessThan(expandedWidth);
		await filtersButton.hover();
		await expect.poll(async () => (await filtersButton.boundingBox())?.width ?? 0).toBeCloseTo(expandedWidth, 0);
		await page.mouse.move(0, 0);
		await expect.poll(async () => (await filtersButton.boundingBox())?.width ?? 0).toBe(32);

		await controls[1].button.click();
		await expect.poll(async () => (await controls[1].button.boundingBox())?.width ?? 0).toBeGreaterThan(32);
		await expect(page.getByText("Configurar columnas", { exact: true })).toBeVisible();
	});

	test("uses the shared ease-out curve for the Columns menu", async ({ page }) => {
		await page.goto("/excel");
		await page.waitForLoadState("networkidle");

		const columnsButton = page.getByRole("button", { name: "Columnas", exact: true });
		await columnsButton.click();

		const menu = page.locator('[data-slot="dropdown-menu-content"]:visible');
		await expect(menu).toBeVisible();
		const triggerBox = await columnsButton.boundingBox();
		expect(triggerBox).not.toBeNull();

		const motion = await menu.evaluate((element) => {
			const style = getComputedStyle(element);
			const rect = element.getBoundingClientRect();
			return {
				animationDuration: style.animationDuration,
				animationTimingFunction: style.animationTimingFunction,
				transformOrigin: style.transformOrigin,
				rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
			};
		});

		expect(motion.animationDuration).toBe("0.15s");
		expect(motion.animationTimingFunction).toBe("cubic-bezier(0.23, 1, 0.32, 1)");
		const [originX, originY] = motion.transformOrigin.split(" ").map(Number.parseFloat);
		const originPoint = { x: motion.rect.x + originX, y: motion.rect.y + originY };
		const menuCenter = {
			x: motion.rect.x + motion.rect.width / 2,
			y: motion.rect.y + motion.rect.height / 2,
		};
		const triggerCenter = {
			x: triggerBox!.x + triggerBox!.width / 2,
			y: triggerBox!.y + triggerBox!.height / 2,
		};
		const distanceToTrigger = (point: { x: number; y: number }) =>
			Math.hypot(point.x - triggerCenter.x, point.y - triggerCenter.y);
		expect(Math.hypot(originX - motion.rect.width / 2, originY - motion.rect.height / 2)).toBeGreaterThan(1);
		expect(distanceToTrigger(originPoint)).toBeLessThan(distanceToTrigger(menuCenter));

		await page.keyboard.press("Escape");
		await expect(menu).toBeHidden();
		await expect(columnsButton).toBeFocused();
	});
});
