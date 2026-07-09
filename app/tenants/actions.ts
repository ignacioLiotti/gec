"use server";

import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { STANDARD_TENANT_BLUEPRINT_KEY } from "@/lib/tenant-blueprints/constants";
import { buildStandardConstructionBlueprint } from "@/lib/tenant-blueprints/standard-construction";
import { createClient } from "@/utils/supabase/server";

function redirectWithError(path: string, message: string): never {
	const params = new URLSearchParams({ error: message });
	const separator = path.includes("?") ? "&" : "?";
	redirect(`${path}${separator}${params.toString()}`);
}

async function resolveUser() {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		redirect("/");
	}

	return { supabase, user };
}

export async function createTenantAction(
	errorPath: string,
	formData: FormData,
) {
	const session = await auth();
	if (!session.data.user) redirect("/");
	const { supabase } = await resolveUser();
	const name = String(formData.get("name") ?? "").trim();
	const requestedBlueprint = String(
		formData.get("blueprint") ?? STANDARD_TENANT_BLUEPRINT_KEY,
	);

	if (name.length < 3) {
		redirectWithError(
			errorPath,
			"Elegí un nombre de al menos 3 caracteres.",
		);
	}

	if (requestedBlueprint !== STANDARD_TENANT_BLUEPRINT_KEY) {
		redirectWithError(
			errorPath,
			"El modelo de configuración elegido no está disponible.",
		);
	}

	const blueprint = buildStandardConstructionBlueprint();
	const { data, error } = await supabase.rpc("create_tenant_from_blueprint", {
		p_name: name,
		p_blueprint: blueprint,
	});

	if (error || !data) {
		let message = "No pudimos crear la organización. Probá de nuevo.";
		if (error?.code === "23505") {
			message = "Ya existe una organización con ese nombre.";
		} else if (
			error?.code === "PGRST202" ||
			error?.message?.includes("create_tenant_from_blueprint")
		) {
			message =
				"La configuración inicial todavía no está habilitada. Pedile ayuda al administrador del sistema.";
		}
		console.error("[tenants:create] blueprint provisioning failed", error);
		redirectWithError(errorPath, message);
	}

	const tenantId = String(data);
	redirect(
		`/api/tenants/${tenantId}/switch?next=${encodeURIComponent("/setup")}`,
	);
}
