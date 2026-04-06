export type DemoCapability = "dashboard" | "excel" | "macro";

const DEMO_CAPABILITY_ORDER: DemoCapability[] = ["dashboard", "excel", "macro"];

type DemoCapabilitySource =
	| { allowedCapabilities: DemoCapability[] }
	| DemoCapability[]
	| null
	| undefined;

export function normalizeDemoCapabilities(value: string[]): DemoCapability[] {
	return value.filter((capability): capability is DemoCapability =>
		DEMO_CAPABILITY_ORDER.includes(capability as DemoCapability),
	);
}

function readDemoCapabilities(value: DemoCapabilitySource): DemoCapability[] {
	if (!value) return [];
	if (Array.isArray(value)) return normalizeDemoCapabilities(value);
	return normalizeDemoCapabilities(value.allowedCapabilities);
}

export function hasDemoCapability(
	value: DemoCapabilitySource,
	capability: DemoCapability,
) {
	return readDemoCapabilities(value).includes(capability);
}

export function hasAnyDemoCapability(
	value: DemoCapabilitySource,
	capabilities: DemoCapability[],
) {
	const allowed = readDemoCapabilities(value);
	return capabilities.some((capability) => allowed.includes(capability));
}

export function getDefaultDemoAppPath(value: DemoCapabilitySource) {
	const allowed = readDemoCapabilities(value);
	for (const capability of DEMO_CAPABILITY_ORDER) {
		if (!allowed.includes(capability)) continue;
		if (capability === "dashboard") return "/dashboard";
		if (capability === "excel") return "/excel";
		if (capability === "macro") return "/macro";
	}
	return "/";
}

export function isDemoPathAllowed(pathname: string, value: DemoCapabilitySource) {
	if (!pathname.startsWith("/")) return false;
	if (pathname === "/dashboard") {
		return hasDemoCapability(value, "dashboard");
	}
	if (pathname === "/excel" || pathname.startsWith("/excel/")) {
		return hasDemoCapability(value, "excel");
	}
	if (pathname === "/macro" || pathname.startsWith("/macro/")) {
		return hasDemoCapability(value, "macro");
	}
	return false;
}
