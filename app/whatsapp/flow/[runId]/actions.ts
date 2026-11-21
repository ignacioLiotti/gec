"use server";

import { redirect } from "next/navigation";
import { verifyWhatsAppRunToken } from "@/lib/whatsapp/recurring";
import { flowResponseDenial } from "@/lib/whatsapp/flow-response";
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
		.select("id, tenant_id, flow_id, contact_id, chat_action_id, status, expires_at")
		.eq("id", runId)
		.maybeSingle();
	if (runError) throw runError;
	if (!run) throw new Error("Flow no encontrado");
	if (flowResponseDenial(run)) {
		redirect(`/whatsapp/flow/${runId}?token=${encodeURIComponent(token)}`);
	}

	const values = parseResponseValues(formData);
	const capture = { kind: "signed_flow", runId };
	const { error: submissionError } = await supabase
		.from("whatsapp_manual_submissions")
		.upsert({
			id: run.id,
			tenant_id: run.tenant_id,
			contact_id: run.contact_id,
			raw_values: { ...values, _capture: capture },
			parsed_values: values,
			validation_errors: [],
			status: "ready_to_apply",
		}, { onConflict: "id", ignoreDuplicates: true });
	if (submissionError) throw submissionError;

	let capturedResponse = supabase.from("whatsapp_manual_submissions")
		.select("id,parsed_values,created_at")
		.eq("id", run.id)
		.eq("tenant_id", run.tenant_id)
		.contains("raw_values", { _capture: capture });
	capturedResponse = run.contact_id === null
		? capturedResponse.is("contact_id", null)
		: capturedResponse.eq("contact_id", run.contact_id);
	const { data: submission, error: capturedError } = await capturedResponse.single();
	if (capturedError) throw capturedError;

	const { error: runUpdateError } = await supabase
		.from("whatsapp_flow_runs")
		.update({
			status: "completed",
			response_values: submission.parsed_values,
			manual_submission_id: submission.id,
			completed_at: submission.created_at,
		})
		.eq("id", runId)
		.eq("tenant_id", run.tenant_id);
	if (runUpdateError) throw runUpdateError;

	if (run.chat_action_id) {
		const { error: actionUpdateError } = await supabase
			.from("whatsapp_chat_actions")
			.update({
				status: "completed",
				manual_submission_id: submission.id,
				result_summary: "Flow de WhatsApp respondido desde Sintesis.",
				parsed_params: { responseValues: submission.parsed_values },
				resolved_at: submission.created_at,
			})
			.eq("id", run.chat_action_id)
			.eq("tenant_id", run.tenant_id);
		if (actionUpdateError) throw actionUpdateError;
	}

	redirect(`/whatsapp/flow/${runId}/thanks`);
}

function parseResponseValues(formData: FormData) {
	const values: Record<string, unknown> = {};
	for (const [key, value] of formData.entries()) {
		if (key === "runId" || key === "token") continue;
		if (key.startsWith("_")) continue;
		if (key.startsWith("$ACTION_")) continue;
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
