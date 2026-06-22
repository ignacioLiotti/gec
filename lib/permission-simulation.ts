import type { DocumentGenerationPermissionMap } from "@/lib/document-generation-server";

export const PERMISSION_SIMULATION_COOKIE = "permission_simulation";

const COOKIE_PREFIX = "v1:";
const MAX_PERMISSION_KEYS = 200;

export type PermissionSimulation = {
	permissionKeys: string[];
};

export type PermissionOption = {
	key: string;
	displayName: string;
	category: string | null;
};

export function normalizePermissionSimulationKeys(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	const seen = new Set<string>();
	const keys: string[] = [];

	for (const item of value) {
		if (typeof item !== "string") continue;
		const key = item.trim();
		if (!/^[a-z0-9:-]+$/i.test(key)) continue;
		if (seen.has(key)) continue;
		seen.add(key);
		keys.push(key);
		if (keys.length >= MAX_PERMISSION_KEYS) break;
	}

	return keys.sort((left, right) => left.localeCompare(right));
}

export function buildPermissionSimulationCookieValue(permissionKeys: string[]) {
	return `${COOKIE_PREFIX}${encodeURIComponent(
		JSON.stringify({
			permissionKeys: normalizePermissionSimulationKeys(permissionKeys),
		}),
	)}`;
}

export function parsePermissionSimulationCookie(
	rawValue: string | null | undefined,
): PermissionSimulation | null {
	if (!rawValue?.startsWith(COOKIE_PREFIX)) return null;

	try {
		const parsed = JSON.parse(
			decodeURIComponent(rawValue.slice(COOKIE_PREFIX.length)),
		) as { permissionKeys?: unknown };
		return {
			permissionKeys: normalizePermissionSimulationKeys(parsed.permissionKeys),
		};
	} catch {
		return null;
	}
}

export function permissionSimulationHas(
	simulation: PermissionSimulation | null | undefined,
	permissionKey: string,
) {
	return Boolean(simulation?.permissionKeys.includes(permissionKey));
}

export function documentPermissionsFromPermissionSimulation(
	simulation: PermissionSimulation,
): DocumentGenerationPermissionMap {
	return {
		canSeeNavigation: true,
		canCreate: true,
		canReview: permissionSimulationHas(simulation, "documents:review"),
		canManageTemplates: permissionSimulationHas(
			simulation,
			"documents:templates",
		),
		canViewAllDrafts: false,
	};
}
