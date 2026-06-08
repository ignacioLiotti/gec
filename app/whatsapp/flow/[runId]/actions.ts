"use server";

import { redirect } from "next/navigation";
import { verifyWhatsAppRunToken } from "@/lib/whatsapp/recurring";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";

export async function submitWhatsAppFlowResponse(formData: FormData) {
	const runId = String(formData.get("runId") ?? "");
	const token = String(formData.get("token") ?? "");
	if (!verifyWhatsAppRunToken(runId, token)) {
		throw new Error("Respuesta no autorizada");
	}

	const supabase = createSupabaseAdminClient();
	const { data: run, error: runError } = await supabase
		.from("whatsapp_flow_runs")
		.select("id, tenant_id, flow_id, contact_id, chat_action_id, status")
		.eq("id", runId)
		.maybeSingle();
	if (runError) throw runError;
	if (!run) throw new Error("Flow no encontrado");

	const values = parseResponseValues(formData);
	const { data: submission, error: submissionError } = await supabase
		.from("whatsapp_manual_submissions")
		.insert({
			tenant_id: run.tenant_id,
			contact_id: run.contact_id,
			raw_values: values,
			parsed_values: values,
			validation_errors: [],
			status: "ready_to_apply",
		})
		.select("id")
		.single();
	if (submissionError) throw submissionError;

	await supabase
		.from("whatsapp_flow_runs")
		.update({
			status: "completed",
			response_values: values,
			manual_submission_id: submission.id,
			completed_at: new Date().toISOString(),
		})
		.eq("id", runId);

	if (run.chat_action_id) {
		await supabase
			.from("whatsapp_chat_actions")
			.update({
				status: "completed",
				manual_submission_id: submission.id,
				result_summary: "Flow de WhatsApp respondido desde Sintesis.",
				parsed_params: { responseValues: values },
				resolved_at: new Date().toISOString(),
			})
			.eq("id", run.chat_action_id);
	}

	redirect(`/whatsapp/flow/${runId}/thanks`);
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
