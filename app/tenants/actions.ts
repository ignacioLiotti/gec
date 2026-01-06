"use server";

import { redirect } from "next/navigation";
import type { PostgrestError } from "@supabase/supabase-js";

import { createClient } from "@/utils/supabase/server";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";

const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function normalizeErrorMessage(error?: PostgrestError | null) {
	if (!error) return undefined;
	if (error.code === "23505") {
		return "Ya estás asociado a esa organización.";
	}
	if (error.code === "23503") {
		return "La organización ya no existe.";
	}
	if (error.code === "42501") {
		return "No tenés permisos para unirte a esa organización.";
	}
	return undefined;
}

export async function createTenantAction(
	errorPath: string,
	formData: FormData
) {
	const { supabase, user } = await resolveUser();
	const name = String(formData.get("name") ?? "").trim();

	if (name.length < 3) {
		redirectWithError(
			errorPath,
			"Elegí un nombre de al menos 3 caracteres."
		);
	}

	// Use admin client to bypass RLS for bootstrapping operations
	const adminClient = createSupabaseAdminClient();

	const { data, error } = await adminClient
		.from("tenants")
		.insert({ name })
		.select("id")
		.single();

	if (error || !data) {
		let message = "No pudimos crear la organización, probá de nuevo.";
		if (error?.code === "23505") {
			message = "Ya existe una organización con ese nombre.";
		}
		console.error("[tenants:create] insert failed", error);
		redirectWithError(errorPath, message);
	}

	const { error: membershipError } = await adminClient
		.from("memberships")
		.insert({ tenant_id: data.id, user_id: user.id, role: "owner" });

	if (membershipError) {
		console.error(
			"[tenants:create] failed to assign owner membership",
			membershipError
		);
		redirectWithError(
			errorPath,
			"No pudimos asignarte como propietario. Escribinos para ayudarte."
		);
	}

		redirect(`/api/tenants/${data.id}/switch`);
}

export async function joinTenantAction(
	errorPath: string,
	formData: FormData
) {
	const { supabase, user } = await resolveUser();
	const tenantId = String(formData.get("tenant_id") ?? "").trim();

	if (!tenantId || !UUID_PATTERN.test(tenantId)) {
			redirectWithError(
				errorPath,
				"Ingresá una organización válida para continuar."
			);
	}

	const { data: existingMembership } = await supabase
		.from("memberships")
		.select("tenant_id")
		.eq("tenant_id", tenantId)
		.eq("user_id", user.id)
		.maybeSingle();

	if (existingMembership) {
		redirect(`/api/tenants/${tenantId}/switch`);
	}

	const { error } = await supabase
		.from("memberships")
		.insert({ tenant_id: tenantId, user_id: user.id, role: "member" });

	const normalized = normalizeErrorMessage(error);
	if (error || normalized) {
		console.error("[tenants:join] insert failed", error);
			redirectWithError(
				errorPath,
				normalized ?? "No pudimos sumarte a esa organización."
			);
	}

		redirect(`/api/tenants/${tenantId}/switch`);
}
