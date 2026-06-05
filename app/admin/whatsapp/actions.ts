"use server";

import { revalidatePath } from "next/cache";
import { validateManualSubmission } from "@/lib/whatsapp/commands";
import { createClient } from "@/utils/supabase/server";

async function requireAdminTenant(formData: FormData) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) throw new Error("Unauthorized");

	const tenantId = String(formData.get("tenantId") ?? "");
	if (!tenantId) throw new Error("Falta tenantId");

	const { data, error } = await supabase
		.from("memberships")
		.select("tenant_id, role")
		.eq("tenant_id", tenantId)
		.eq("user_id", user.id)
		.in("role", ["owner", "admin"])
		.maybeSingle();
	if (error) throw error;
	if (!data) throw new Error("No tenes permisos para configurar WhatsApp");

	return { supabase, user, tenantId };
}

function boolFromForm(value: FormDataEntryValue | null) {
	return value === "on" || value === "true" || value === "1";
}

function splitUuidList(value: FormDataEntryValue | null) {
	return String(value ?? "")
		.split(",")
		.map((entry) => entry.trim())
		.filter(Boolean);
}

export async function createBusinessAccountAction(formData: FormData) {
	const { supabase, user, tenantId } = await requireAdminTenant(formData);
	const phoneNumberId = String(formData.get("phoneNumberId") ?? "").trim();
	if (!phoneNumberId) throw new Error("Falta phone_number_id");

	const { error } = await supabase.from("whatsapp_business_accounts").upsert(
		{
			tenant_id: tenantId,
			provider: String(formData.get("provider") ?? "meta_cloud"),
			phone_number_id: phoneNumberId,
			display_phone_number:
				String(formData.get("displayPhoneNumber") ?? "").trim() || null,
			business_account_id:
				String(formData.get("businessAccountId") ?? "").trim() || null,
			status: String(formData.get("status") ?? "draft"),
			created_by: user.id,
		},
		{ onConflict: "phone_number_id" },
	);
	if (error) throw error;
	revalidatePath("/admin/whatsapp");
}

export async function createContactAction(formData: FormData) {
	const { supabase, user, tenantId } = await requireAdminTenant(formData);
	const phone = String(formData.get("phone") ?? "").trim();
	if (!phone) throw new Error("Falta telefono");

	const { error } = await supabase.from("whatsapp_contacts").upsert(
		{
			tenant_id: tenantId,
			phone_e164: phone.startsWith("+") ? phone : `+${phone}`,
			display_name: String(formData.get("displayName") ?? "").trim() || null,
			status: String(formData.get("status") ?? "active"),
			can_upload_documents: boolFromForm(formData.get("canUploadDocuments")),
			can_submit_forms: boolFromForm(formData.get("canSubmitForms")),
			can_query_data: boolFromForm(formData.get("canQueryData")),
			allowed_obra_ids: splitUuidList(formData.get("allowedObraIds")),
			notes: String(formData.get("notes") ?? "").trim() || null,
			created_by: user.id,
		},
		{ onConflict: "tenant_id,phone_e164" },
	);
	if (error) throw error;
	revalidatePath("/admin/whatsapp");
}

export async function createManualFormAction(formData: FormData) {
	const { supabase, user, tenantId } = await requireAdminTenant(formData);
	const name = String(formData.get("name") ?? "").trim();
	const tablaId = String(formData.get("tablaId") ?? "").trim();
	if (!name || !tablaId) throw new Error("Falta nombre o tabla destino");

	const { data: tabla, error: tablaError } = await supabase
		.from("obra_tablas")
		.select("id, obra_id, settings, obras!inner(id, tenant_id, deleted_at)")
		.eq("id", tablaId)
		.eq("obras.tenant_id", tenantId)
		.is("obras.deleted_at", null)
		.maybeSingle();
	if (tablaError) throw tablaError;
	if (!tabla) throw new Error("Tabla no encontrada");

	const settings = (tabla.settings ?? {}) as Record<string, unknown>;
	const folderPath =
		String(formData.get("folderPath") ?? "").trim() ||
		(typeof settings.ocrFolder === "string" ? settings.ocrFolder : null);

	const { error } = await supabase.from("whatsapp_manual_forms").insert({
		tenant_id: tenantId,
		name,
		description: String(formData.get("description") ?? "").trim() || null,
		obra_id: tabla.obra_id,
		folder_path: folderPath || null,
		tabla_id: tablaId,
		status: String(formData.get("status") ?? "draft"),
		trigger_mode: String(formData.get("triggerMode") ?? "on_demand"),
		schedule: {
			weekday: String(formData.get("weekday") ?? "").trim() || null,
			time: String(formData.get("time") ?? "").trim() || null,
		},
		whatsapp_flow_id:
			String(formData.get("whatsappFlowId") ?? "").trim() || null,
		template_name: String(formData.get("templateName") ?? "").trim() || null,
		created_by: user.id,
	});
	if (error) throw error;
	revalidatePath("/admin/whatsapp");
}

export async function applySubmissionAction(formData: FormData) {
	const { supabase, user, tenantId } = await requireAdminTenant(formData);
	const submissionId = String(formData.get("submissionId") ?? "");
	if (!submissionId) throw new Error("Falta submissionId");

	const { data: submission, error: submissionError } = await supabase
		.from("whatsapp_manual_submissions")
		.select("id, tabla_id, parsed_values, raw_values, status")
		.eq("id", submissionId)
		.eq("tenant_id", tenantId)
		.maybeSingle();
	if (submissionError) throw submissionError;
	if (!submission?.tabla_id) throw new Error("Submission sin tabla destino");

	const values =
		((submission.parsed_values as Record<string, unknown>) ?? {}) ||
		((submission.raw_values as Record<string, unknown>) ?? {});
	const validation = await validateManualSubmission({
		supabase,
		tablaId: submission.tabla_id as string,
		values,
	});

	if (validation.errors.length > 0) {
		const { error } = await supabase
			.from("whatsapp_manual_submissions")
			.update({
				status: "needs_review",
				parsed_values: validation.parsed,
				validation_errors: validation.errors,
				reviewed_by: user.id,
				reviewed_at: new Date().toISOString(),
			})
			.eq("id", submissionId);
		if (error) throw error;
		revalidatePath("/admin/whatsapp");
		return;
	}

	const { data: row, error: rowError } = await supabase
		.from("obra_tabla_rows")
		.insert({
			tabla_id: submission.tabla_id,
			data: validation.parsed,
			source: "whatsapp",
			lineage_row_key: `whatsapp:${submissionId}`,
		})
		.select("id")
		.single();
	if (rowError) throw rowError;

	const { error } = await supabase
		.from("whatsapp_manual_submissions")
		.update({
			status: "applied",
			parsed_values: validation.parsed,
			validation_errors: [],
			applied_row_id: row.id,
			reviewed_by: user.id,
			reviewed_at: new Date().toISOString(),
		})
		.eq("id", submissionId);
	if (error) throw error;
	revalidatePath("/admin/whatsapp");
}
