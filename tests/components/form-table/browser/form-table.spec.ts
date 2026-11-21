import { expect, test, type Page } from "@playwright/test";

const cell = (page: Page, row: string, column: string) =>
	page.locator(`td[data-row-id="${row}"][data-column-id="${column}"]`);
async function open(page: Page, query = "") {
	await page.goto(`/${query}`);
	await expect(page.locator('td[data-column-id="name"]').first()).toBeVisible();
	await page.waitForFunction(() => Boolean(window.table?.rows.currentRows.length));
}

test.beforeEach(async ({ page }) => {
	page.on("pageerror", (error) => {
		throw error;
	});
});

test("edits, saves and discards without changing row identity", async ({ page }) => {
	await open(page);
	await cell(page, "row-0", "name").click();
	await cell(page, "row-0", "name").locator("textarea").fill("Obra editada");
	await page.locator("#outside").click();
	await page.getByTestId("form-table-save").click();
	await expect.poll(() => page.evaluate(() => window.saved.length)).toBe(1);
	expect(await page.evaluate(() => window.saved[0].dirtyRows.map((row) => row.id))).toEqual([
		"row-0",
	]);
	await cell(page, "row-0", "name").click();
	await cell(page, "row-0", "name").locator("textarea").fill("Descartar esto");
	await page.locator("#outside").click();
	await page.getByTestId("form-table-discard").click();
	await expect(cell(page, "row-0", "name")).toContainText("Obra editada");
});

test("searches, sorts and pages", async ({ page }) => {
	await open(page);
	await page.getByRole("button", { name: "Siguiente", exact: true }).click();
	await expect(cell(page, "row-25", "name")).toBeVisible();
	await page.getByTestId("form-table-search").fill("00079");
	await expect(cell(page, "row-79", "name")).toBeVisible();
	await expect(page.locator('td[data-column-id="name"]')).toHaveCount(1);
});

test("records large-table render cost and keeps DOM bounded", async ({ page }, info) => {
	await open(page, "?scenario=large&rows=10000");
	expect(await page.locator('td[data-column-id="name"]').count()).toBeLessThan(50);
	await page.evaluate(() => {
		window.measures = [];
		window.renderCount = 0;
	});
	await cell(page, "row-0", "name").click();
	await cell(page, "row-0", "name").locator("textarea").fill("Nueva obra");
	await page.locator("#outside").click();
	const metrics = await page.evaluate(() => ({
		durations: window.measures,
		renderCount: window.renderCount,
	}));
	expect(metrics.renderCount).toBeLessThan(10);
	expect(await page.evaluate(() => window.table.rows.currentRows[0].name)).toBe("Nueva obra");
	await info.attach("large-table-metrics", {
		body: JSON.stringify(metrics),
		contentType: "application/json",
	});
	console.log("LARGE_TABLE_METRICS", JSON.stringify(metrics));
});

test("keeps failed saves dirty and allows retry", async ({ page }) => {
	await open(page);
	await page.evaluate(() => {
		window.failSave = true;
		window.table.rows.setCellValue("row-0", "name", "Cambio");
	});
	await page.getByTestId("form-table-save").click();
	await expect(page.getByText("Error de guardado simulado").first()).toBeVisible();
	expect(await page.evaluate(() => window.table.meta.hasUnsavedChanges)).toBe(true);
	await page.evaluate(() => {
		window.failSave = false;
	});
	await page.getByTestId("form-table-save").click();
	await expect.poll(() => page.evaluate(() => window.saved.length)).toBe(1);
	await expect(page.getByTestId("form-table-save")).toBeDisabled();
});

test("preserves edits made while an earlier save is in flight", async ({ page }) => {
	await open(page);
	await page.evaluate(() => {
		window.saveDelay = 250;
		window.table.rows.setCellValue("row-0", "name", "Primero");
	});
	await page.getByTestId("form-table-save").click();
	await page.evaluate(() => window.table.rows.setCellValue("row-0", "name", "Segundo"));
	await expect.poll(() => page.evaluate(() => window.saved.length)).toBe(1);
	expect(await page.evaluate(() => window.saved[0].dirtyRows[0].name)).toBe("Primero");
	expect(await page.evaluate(() => window.table.rows.currentRows[0].name)).toBe("Segundo");
	await expect(page.getByTestId("form-table-save")).toBeEnabled();
});

test("adds and deletes rows with correct save payloads", async ({ page }) => {
	await open(page);
	await page.getByTestId("form-table-add-row").click();
	await expect(cell(page, "new-row", "name")).toBeVisible();
	await page
		.locator('tr[data-row-id="row-0"]')
		.getByRole("button", { name: "Eliminar fila" })
		.click();
	await page.getByTestId("form-table-save").click();
	await expect.poll(() => page.evaluate(() => window.saved.length)).toBe(1);
	const saved = await page.evaluate(() => window.saved[0]);
	expect(saved.deletedRowIds).toEqual(["row-0"]);
	expect(saved.dirtyRows.map((row) => row.id)).toEqual(["new-row"]);
});

test("discard restores removed rows and removes unsaved new rows", async ({ page }) => {
	await open(page);
	await page.getByTestId("form-table-add-row").click();
	await page.evaluate(() => window.table.rows.handleDelete("row-0"));
	await page.getByTestId("form-table-discard").click();
	await expect(cell(page, "row-0", "name")).toBeVisible();
	await expect(cell(page, "new-row", "name")).toHaveCount(0);
	await expect(page.getByTestId("form-table-save")).toBeDisabled();
});

test("read-only mode prevents mutation through the public actions", async ({ page }) => {
	await open(page, "?scenario=readonly");
	await cell(page, "row-0", "name").click();
	await expect(page.locator("textarea")).toHaveCount(0);
	await expect(page.getByTestId("form-table-save")).toHaveCount(0);
	await page.evaluate(async () => {
		window.table.rows.setCellValue("row-0", "name", "Forbidden");
		window.table.rows.handleDelete("row-0");
		window.table.actions.addRow();
		await window.table.actions.save();
	});
	expect(await page.evaluate(() => window.table.rows.currentRows.length)).toBe(80);
	expect(await page.evaluate(() => window.table.rows.currentRows[0].name)).toBe("Obra 00000");
	expect(await page.evaluate(() => window.saved.length)).toBe(0);
});

test("sorts ascending, descending and returns to the original order", async ({ page }) => {
	await open(page);
	const header = page.getByRole("button", { name: "Monto", exact: true });
	await header.click();
	await expect.poll(() => page.evaluate(() => window.table.sorting.state.direction)).toBe("asc");
	await header.click();
	await expect(page.locator('td[data-column-id="name"]').first()).toContainText("Obra 00079");
	await header.click();
	await expect(page.locator('td[data-column-id="name"]').first()).toContainText("Obra 00000");
	expect(await page.evaluate(() => window.table.sorting.state.columnId)).toBeNull();
});

test("honors a locked sort and page size", async ({ page }) => {
	await open(page, "?scenario=locked");
	await page.getByRole("button", { name: "Nombre", exact: true }).click();
	expect(await page.evaluate(() => window.table.sorting.state)).toEqual({
		columnId: "amount",
		direction: "desc",
	});
	await page.evaluate(() => window.table.pagination.setPageSize(100));
	expect(await page.evaluate(() => window.table.pagination.pageSize)).toBe(10);
	await expect(page.locator('td[data-column-id="name"]')).toHaveCount(10);
});

test("applies draft filters only after Aplicar and resets them", async ({ page }) => {
	await open(page);
	await page.getByRole("button", { name: "Filtros", exact: true }).click();
	await page.getByRole("checkbox", { name: "Solo activas" }).check();
	expect(await page.evaluate(() => window.table.pagination.datasetTotalCount)).toBe(80);
	await page.getByRole("button", { name: "Aplicar", exact: true }).click();
	await expect.poll(() => page.evaluate(() => window.table.pagination.datasetTotalCount)).toBe(40);
	await page.getByRole("button", { name: "Filtros", exact: true }).click();
	await page.getByRole("button", { name: "Reiniciar filtros" }).click();
	await expect.poll(() => page.evaluate(() => window.table.pagination.datasetTotalCount)).toBe(80);
});

test("tab counts follow search and persist the selected tab", async ({ page }) => {
	await open(page);
	await page.getByRole("tab", { name: "Activas" }).click();
	await expect.poll(() => page.evaluate(() => window.table.pagination.datasetTotalCount)).toBe(40);
	await page.reload();
	await expect(page.getByRole("tab", { name: "Activas" })).toHaveAttribute("aria-selected", "true");
	await page.getByTestId("form-table-search").fill("00002");
	await expect
		.poll(() => page.evaluate(() => window.table.tabs.counts))
		.toEqual({ all: 1, active: 1 });
});

test("controlled search accepts external replacements and typed commits", async ({ page }) => {
	await open(page, "?scenario=controlled");
	await page.evaluate(() => window.setQuery("00015"));
	await expect(cell(page, "row-15", "name")).toBeVisible();
	await page.getByTestId("form-table-search").fill("00022");
	await expect(cell(page, "row-22", "name")).toBeVisible();
	await expect(page.getByTestId("form-table-search")).toHaveValue("00022");
});

test("new rows clear the view constraints when revealNewRowOnAdd is enabled", async ({ page }) => {
	await open(page);
	await page.getByRole("tab", { name: "Activas" }).click();
	await page.getByTestId("form-table-search").fill("00020");
	await expect(cell(page, "row-20", "name")).toBeVisible();
	await page.getByTestId("form-table-add-row").click();
	await expect(cell(page, "new-row", "name")).toBeVisible();
	await expect(page.getByTestId("form-table-search")).toHaveValue("");
	expect(await page.evaluate(() => window.table.tabs.activeTab)).toBe("all");
});

test("hides and pins columns across reloads", async ({ page }) => {
	await open(page);
	await page.evaluate(() => {
		window.table.columns.setHiddenIds(["date"]);
		window.table.columns.togglePin("name");
	});
	await expect(cell(page, "row-0", "date")).toHaveCount(0);
	await expect(cell(page, "row-0", "name")).toHaveCSS("position", "sticky");
	await page.reload();
	await expect(cell(page, "row-0", "date")).toHaveCount(0);
	await expect(cell(page, "row-0", "name")).toHaveCSS("position", "sticky");
});

test("updates an unchanged row when a column renderer or editability changes", async ({ page }) => {
	await open(page);
	await page.evaluate(() =>
		window.setColumns(
			window.table.config.columns.map((column) =>
				column.id === "name"
					? {
							...column,
							editable: false,
							cellConfig: { renderReadOnly: () => "Nueva presentación" },
						}
					: column
			)
		)
	);
	await expect(cell(page, "row-0", "name")).toContainText("Nueva presentación");
	await cell(page, "row-0", "name").click();
	await expect(cell(page, "row-0", "name").locator("textarea")).toHaveCount(0);
});

test("arrow navigation commits the buffered value and skips hidden columns", async ({ page }) => {
	await open(page);
	await page.evaluate(() => window.table.columns.setHiddenIds(["amount"]));
	await cell(page, "row-0", "name").click();
	await cell(page, "row-0", "name").locator("textarea").fill("Navegando");
	await page.keyboard.press("ArrowRight");
	await expect
		.poll(() => page.evaluate(() => window.table.rows.activeCell))
		.toEqual({ rowId: "row-0", columnId: "active" });
	expect(await page.evaluate(() => window.table.rows.currentRows[0].name)).toBe("Navegando");
	await page.keyboard.press("ArrowDown");
	await expect.poll(() => page.evaluate(() => window.table.rows.activeCell?.rowId)).toBe("row-1");
});

test("clears and restores an edited cell through its context menu", async ({ page }) => {
	await open(page);
	await cell(page, "row-0", "name").click();
	await cell(page, "row-0", "name").click({ button: "right" });
	await page.getByRole("menuitem", { name: /Limpiar/ }).click();
	await expect.poll(() => page.evaluate(() => window.table.rows.currentRows[0].name)).toBe("");
	await cell(page, "row-0", "name").click({ button: "right" });
	await page.getByRole("menuitem", { name: /Restaurar/ }).click();
	await expect
		.poll(() => page.evaluate(() => window.table.rows.currentRows[0].name))
		.toBe("Obra 00000");
});

test("bulk selection uses visible sorted order and writes only the selected column", async ({
	page,
}) => {
	await open(page);
	await page.evaluate(() => {
		const column = window.table.config.columns[1];
		window.table.bulkSelection.beginDrag("row-1", column);
		window.table.bulkSelection.extendDrag("row-3", column);
		window.table.bulkSelection.endDrag();
	});
	await expect
		.poll(() => page.evaluate(() => window.table.bulkSelection.selectedRowIds))
		.toEqual(["row-1", "row-2", "row-3"]);
	await page.evaluate(() => window.table.bulkSelection.applyValue(123));
	expect(
		await page.evaluate(() => window.table.rows.currentRows.slice(0, 5).map((row) => row.amount))
	).toEqual([0, 123, 123, 123, 40]);
	expect(await page.evaluate(() => window.table.rows.currentRows[2].name)).toBe("Obra 00002");
});

test("accordion fields participate in dirty tracking and saving", async ({ page }) => {
	await open(page, "?scenario=accordion");
	await page.getByRole("textbox", { name: "Detalle row-0" }).fill("Detalle modificado");
	await page.getByTestId("form-table-save").click();
	await expect.poll(() => page.evaluate(() => window.saved.length)).toBe(1);
	expect(await page.evaluate(() => window.saved[0].dirtyRows[0].detail)).toBe("Detalle modificado");
	await expect(page.getByTestId("form-table-save")).toBeDisabled();
});

test("server pagination, search and stale response handling", async ({ page }) => {
	await open(page, "?scenario=server");
	await page.getByRole("button", { name: "Siguiente", exact: true }).click();
	await expect(cell(page, "row-25", "name")).toBeVisible();
	await page.getByTestId("form-table-search").fill("slow");
	await expect
		.poll(() => page.evaluate(() => window.requests.some((request) => request.search === "slow")))
		.toBe(true);
	await page.getByTestId("form-table-search").fill("00022");
	await expect(cell(page, "row-22", "name")).toBeVisible();
	await page.waitForTimeout(650); // let the known delayed stale response finish
	await expect(cell(page, "row-22", "name")).toBeVisible();
	expect(await page.evaluate(() => window.table.pagination.page)).toBe(1);
});

test("shows server failures and recovers on the next query", async ({ page }) => {
	await open(page, "?scenario=server");
	await page.getByTestId("form-table-search").fill("error");
	await expect(page.getByText("Error de consulta simulado")).toBeVisible();
	await page.getByTestId("form-table-search").fill("00007");
	await expect(cell(page, "row-7", "name")).toBeVisible();
	await expect(page.getByText("Error de consulta simulado")).toHaveCount(0);
});

test("external refresh only reloads the addressed table", async ({ page }) => {
	await open(page, "?scenario=server");
	const before = await page.evaluate(() => window.requests.length);
	await page.evaluate(() =>
		window.dispatchEvent(new CustomEvent("form-table:refresh", { detail: { tableId: "other" } }))
	);
	expect(await page.evaluate(() => window.requests.length)).toBe(before);
	await page.evaluate(() =>
		window.dispatchEvent(
			new CustomEvent("form-table:refresh", { detail: { tableId: "form-table-test" } })
		)
	);
	await expect.poll(() => page.evaluate(() => window.requests.length)).toBe(before + 1);
});

test("exports all filtered rows and omits hidden columns", async ({ page }) => {
	await open(page);
	await page.evaluate(() => window.table.columns.setHiddenIds(["date"]));
	const downloaded = page.waitForEvent("download");
	await page.getByRole("button", { name: "Exportar", exact: true }).click();
	const download = await downloaded;
	const stream = await download.createReadStream();
	const parts: Buffer[] = [];
	for await (const part of stream!) parts.push(Buffer.from(part));
	const csv = Buffer.concat(parts).toString("utf8");
	expect(csv.split("\n")).toHaveLength(81);
	expect(csv.split("\n")[0]).not.toContain("Fecha");
	expect(csv).toContain("Obra 00079");
});

for (const scenario of ["grouped", "always"])
	test(`renders and edits the ${scenario} layout`, async ({ page }) => {
		await open(page, `?scenario=${scenario}&actions=start`);
		await cell(page, "row-0", "name").click();
		await cell(page, "row-0", "name").locator("textarea").fill("Cambio");
		await page.locator("#outside").click();
		await expect(page.getByTestId("form-table-save")).toBeEnabled();
		if (scenario === "grouped")
			await expect(page.getByRole("columnheader", { name: "Datos" })).toBeVisible();
	});

test("clicking another cell commits the previous text editor", async ({ page }) => {
	await open(page);
	await cell(page, "row-0", "name").click();
	await cell(page, "row-0", "name").locator("textarea").fill("Conservar al cambiar");
	await cell(page, "row-1", "name").click();
	await expect
		.poll(() => page.evaluate(() => window.table.rows.currentRows[0].name))
		.toBe("Conservar al cambiar");
});

test("numeric and checkbox editors preserve typed values", async ({ page }) => {
	await open(page);
	await cell(page, "row-0", "amount").click();
	await cell(page, "row-0", "amount").locator("input").fill("1250.5");
	await page.locator("#outside").click();
	await cell(page, "row-0", "active").click();
	await cell(page, "row-0", "active").getByRole("checkbox").uncheck();
	await page.locator("#outside").click();
	await page.getByTestId("form-table-save").click();
	await expect.poll(() => page.evaluate(() => window.saved.length)).toBe(1);
	expect(
		await page.evaluate(() => ({
			amount: window.saved[0].dirtyRows[0].amount,
			active: window.saved[0].dirtyRows[0].active,
		}))
	).toEqual({ amount: 1250.5, active: false });
});

test("select popovers and date input commit without losing focus state", async ({ page }) => {
	await open(page);
	await cell(page, "row-0", "category").click();
	await cell(page, "row-0", "category").getByRole("combobox").click();
	await page.getByRole("option", { name: "Privado", exact: true }).click();
	await cell(page, "row-0", "date").click();
	await cell(page, "row-0", "date").getByPlaceholder("dd/mm/aaaa").fill("21/10/2026");
	await page.locator("#outside").click();
	await expect
		.poll(() => page.evaluate(() => window.table.rows.currentRows[0].date))
		.toBe("2026-10-21");
	expect(await page.evaluate(() => window.table.rows.currentRows[0].category)).toBe(
		"category__privado"
	);
	await expect(cell(page, "row-0", "category")).toContainText("Privado");
});

test("mouse dragging selects a column range and releases outside the table", async ({ page }) => {
	await open(page);
	const from = (await cell(page, "row-1", "name").boundingBox())!;
	const to = (await cell(page, "row-3", "name").boundingBox())!;
	await page.mouse.move(from.x + 10, from.y + from.height / 2);
	await page.mouse.down();
	await page.mouse.move(to.x + 10, to.y + to.height / 2, { steps: 6 });
	// Opening the bulk-edit bar moves the table; target the row's new position.
	await expect.poll(() => page.evaluate(() => window.table.bulkSelection.isDragging)).toBe(true);
	const movedTarget = (await cell(page, "row-3", "name").boundingBox())!;
	await page.mouse.move(movedTarget.x + 10, movedTarget.y + movedTarget.height / 2, { steps: 3 });
	await page.mouse.move(10, 10);
	await page.mouse.up();
	await expect
		.poll(() => page.evaluate(() => window.table.bulkSelection.selectedRowIds))
		.toEqual(["row-1", "row-2", "row-3"]);
	expect(await page.evaluate(() => window.table.bulkSelection.isDragging)).toBe(false);
});

test("virtual scrolling reaches the final row while bounding mounted cells", async ({ page }) => {
	await open(page, "?scenario=large&rows=10000");
	await page.locator("table").evaluate((table) => {
		let parent = table.parentElement!;
		while (parent && parent.scrollHeight <= parent.clientHeight) parent = parent.parentElement!;
		parent.scrollTop = parent.scrollHeight;
	});
	await expect(cell(page, "row-9999", "name")).toBeVisible();
	expect(await page.locator('td[data-column-id="name"]').count()).toBeLessThan(50);
	await cell(page, "row-9999", "name").click();
	await cell(page, "row-9999", "name").locator("textarea").fill("Última editada");
	await page.locator("#outside").click();
	expect(await page.evaluate(() => window.table.rows.currentRows.at(-1)?.name)).toBe(
		"Última editada"
	);
});

test("group headers follow column visibility and retain sort menus", async ({ page }) => {
	await open(page, "?scenario=grouped");
	await page.evaluate(() => window.table.columns.setHiddenIds(["active"]));
	await expect(page.getByRole("columnheader", { name: "Datos", exact: true })).toHaveAttribute(
		"colspan",
		"1"
	);
	await page.getByRole("button", { name: "Monto", exact: true }).click({ button: "right" });
	await page.getByRole("menuitem", { name: "Orden descendente" }).click();
	await expect(page.locator('td[data-column-id="name"]').first()).toContainText("Obra 00079");
});

test("default layout exposes the same editing and pagination controls", async ({ page }) => {
	await open(page, "?scenario=default");
	await cell(page, "row-0", "name").click();
	await cell(page, "row-0", "name").locator("textarea").fill("Layout público");
	await page.locator("#outside").click();
	await page.getByTestId("form-table-save").click();
	await expect.poll(() => page.evaluate(() => window.saved.length)).toBe(1);
	await page.getByRole("button", { name: "Siguiente", exact: true }).click();
	await expect(cell(page, "row-25", "name")).toBeVisible();
});

test("extras toolbar opens its filter sheet", async ({ page }) => {
	await open(page, "?toolbar=extras");
	await page.getByRole("button", { name: "Extras", exact: true }).click();
	await page.getByRole("menuitem", { name: "Filtros", exact: true }).click();
	await expect(page.getByRole("checkbox", { name: "Solo activas" })).toBeVisible();
});
