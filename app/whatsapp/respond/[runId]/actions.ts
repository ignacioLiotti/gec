"use server";

import { redirect } from "next/navigation";
import { verifyWhatsAppRunToken } from "@/lib/whatsapp/recurring";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";

export async function submitWhatsAppRunResponse(formData: FormData) {
	const runId = String(formData.get("runId") ?? "");
	const token = String(formData.get("token") ?? "");
	if (!verifyWhatsAppRunToken(runId, token)) {
		throw new Error("Respuesta no autorizada");
	}

	const supabase = createSupabaseAdminClient();
	const { data: run, error: runError } = await supabase
		.from("whatsapp_recurring_runs")
		.select("id, tenant_id, assignment_id, chat_action_id, status")
		.eq("id", runId)
		.maybeSingle();
	if (runError) throw runError;
	if (!run) throw new Error("Solicitud no encontrada");

	const { data: assignment, error: assignmentError } = await supabase
		.from("whatsapp_recurring_assignments")
		.select("id, tenant_id, contact_id, whatsapp_template_id, document_generation_template_id, obra_id, folder_path, result_mode")
		.eq("id", run.assignment_id)
		.eq("tenant_id", run.tenant_id)
		.maybeSingle();
	if (assignmentError) throw assignmentError;
	if (!assignment) throw new Error("Asignacion no encontrada");

	const values = parseResponseValues(formData);
	const { data: submission, error: submissionError } = await supabase
		.from("whatsapp_manual_submissions")
		.insert({
			tenant_id: run.tenant_id,
			contact_id: assignment.contact_id,
			obra_id: assignment.obra_id,
			folder_path: assignment.folder_path,
			raw_values: values,
			parsed_values: values,
			validation_errors: [],
			status: assignment.result_mode === "review_only" ? "needs_review" : "ready_to_apply",
		})
		.select("id")
		.single();
	if (submissionError) throw submissionError;

	await supabase
		.from("whatsapp_recurring_runs")
		.update({
			status: "completed",
			completed_at: new Date().toISOString(),
		})
		.eq("id", runId);

	if (run.chat_action_id) {
		await supabase
			.from("whatsapp_chat_actions")
			.update({
				status: assignment.result_mode === "review_only" ? "needs_review" : "completed",
				manual_submission_id: submission.id,
				result_summary: "Formulario respondido desde link de WhatsApp.",
				parsed_params: { responseValues: values },
				resolved_at: new Date().toISOString(),
			})
			.eq("id", run.chat_action_id);
	}

	redirect(`/whatsapp/respond/${runId}/thanks`);
}

function parseResponseValues(formData: FormData) {
	const values: Record<string, unknown> = {};
	for (const [key, value] of formData.entries()) {
		if (key === "runId" || key === "token") continue;
		if (key.startsWith("_")) continue;
		if (typeof value !== "string") continue;
		if (key.endsWith("__boolean")) {
			values[key.replace(/__boolean$/, "")] = value === "true";
			continue;
		}
		values[key] = value;
	}

	const booleanKeys = String(formData.get("_booleanKeys") ?? "")
		.split(",")
		.map((key) => key.trim())
		.filter(Boolean);
	for (const key of booleanKeys) {
		if (!(key in values)) values[key] = false;
	}
	return values;
}
