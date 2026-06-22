import { describe, expect, it } from "vitest";

import {
	buildPermissionSimulationCookieValue,
	documentPermissionsFromPermissionSimulation,
	normalizePermissionSimulationKeys,
	parsePermissionSimulationCookie,
	permissionSimulationHas,
} from "@/lib/permission-simulation";

describe("permission simulation", () => {
	it("normalizes permission keys", () => {
		expect(
			normalizePermissionSimulationKeys([
				" documents:review ",
				"admin:roles",
				"documents:review",
				"",
				"bad key",
				42,
			]),
		).toEqual(["admin:roles", "documents:review"]);
	});

	it("round-trips through the cookie value", () => {
		const value = buildPermissionSimulationCookieValue([
			"document-ai:run",
			"documents:templates",
		]);

		expect(parsePermissionSimulationCookie(value)).toEqual({
			permissionKeys: ["document-ai:run", "documents:templates"],
		});
	});

	it("ignores invalid cookie values", () => {
		expect(parsePermissionSimulationCookie(null)).toBeNull();
		expect(parsePermissionSimulationCookie("v1:%7Bbad-json")).toBeNull();
		expect(parsePermissionSimulationCookie("legacy")).toBeNull();
	});

	it("checks selected permission keys", () => {
		const simulation = { permissionKeys: ["document-ai:run"] };

		expect(permissionSimulationHas(simulation, "document-ai:run")).toBe(true);
		expect(permissionSimulationHas(simulation, "document-ai:admin")).toBe(false);
	});

	it("derives document permissions from simulated keys", () => {
		expect(
			documentPermissionsFromPermissionSimulation({
				permissionKeys: ["documents:review"],
			}),
		).toMatchObject({
			canSeeNavigation: true,
			canCreate: true,
			canReview: true,
			canManageTemplates: false,
		});
	});
});
