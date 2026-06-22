import { NextResponse } from "next/server";

import { resolveRequestAccessContext } from "@/lib/demo-session";
import { permissionSimulationHas } from "@/lib/permission-simulation";

const MAX_PERMISSION_KEYS = 50;

function parsePermissionKeys(request: Request) {
	const url = new URL(request.url);
	const rawKeys = [
		...url.searchParams.getAll("key"),
		...(url.searchParams.get("keys")?.split(",") ?? []),
	];
	return Array.from(
		new Set(
			rawKeys
				.map((key) => key.trim())
				.filter((key) => /^[a-z0-9:-]+$/i.test(key))
				.slice(0, MAX_PERMISSION_KEYS),
		),
	);
}

export async function GET(request: Request) {
	try {
		const access = await resolveRequestAccessContext();
		const { supabase, user, tenantId, actorType } = access;

		if (actorType !== "user" || !user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}
		if (!tenantId) {
			return NextResponse.json({ error: "No tenant" }, { status: 400 });
		}

		const keys = parsePermissionKeys(request);
		if (keys.length === 0) {
			return NextResponse.json({ permissions: {} });
		}

		if (access.permissionSimulation) {
			return NextResponse.json({
				permissions: Object.fromEntries(
					keys.map((key) => [
						key,
						permissionSimulationHas(access.permissionSimulation, key),
					]),
				),
			});
		}

		const entries = await Promise.all(
			keys.map(async (key) => {
				const { data, error } = await supabase.rpc("has_permission", {
					tenant: tenantId,
					perm_key: key,
				});
				if (error) throw error;
				return [key, data === true] as const;
			}),
		);

		return NextResponse.json({ permissions: Object.fromEntries(entries) });
	} catch (error) {
		console.error("[permissions:check]", error);
		const message =
			error instanceof Error ? error.message : "Error al verificar permisos";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
