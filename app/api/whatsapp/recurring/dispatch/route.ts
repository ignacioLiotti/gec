import { NextResponse } from "next/server";
import { sendWhatsAppTemplate } from "@/lib/whatsapp/meta";
import {
	buildWhatsAppResponseUrl,
	computeNextRunAt,
	templateVariables,
} from "@/lib/whatsapp/recurring";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";

const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const GRAPH_API_VERSION = process.env.WHATSAPP_GRAPH_API_VERSION ?? "v25.0";
const MAX_ASSIGNMENTS_PER_RUN = 50;

type AssignmentRow = {
	id: string;
	tenant_id: string;
	contact_id: string;
	whatsapp_template_id: string;
	document_generation_template_id: string | null;
	obra_id: string;
	folder_path: string | null;
	result_mode: string | null;
	frequency: string | null;
	weekday: string | null;
	day_of_month: number | null;
	time_of_day: string | null;
	timezone: string | null;
	next_run_at: string | null;
};

function isAuthorized(request: Request) {
	const secret = process.env.CRON_SECRET;
	if (!secret) return process.env.NODE_ENV !== "production";
	return request.headers.get("x-cron-secret") === secret;
}

export async function POST(request: Request) {
	if (!isAuthorized(request)) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}
	if (!WHATSAPP_TOKEN) {
		return NextResponse.json({ error: "WHATSAPP_ACCESS_TOKEN is not configured" }, { status: 500 });
	}

	const supabase = createSupabaseAdminClient();
	const nowIso = new Date().toISOString();
	const { data: assignments, error } = await supabase
		.from("whatsapp_recurring_assignments")
		.select("id, tenant_id, contact_id, whatsapp_template_id, document_generation_template_id, obra_id, folder_path, result_mode, frequency, weekday, day_of_month, time_of_day, timezone, next_run_at")
		.eq("status", "active")
		.or(`next_run_at.is.null,next_run_at.lte.${nowIso}`)
		.order("next_run_at", { ascending: true, nullsFirst: true })
		.limit(MAX_ASSIGNMENTS_PER_RUN);
	if (error) return NextResponse.json({ error: error.message }, { status: 500 });

	let sent = 0;
	let failed = 0;
	for (const assignment of (assignments ?? []) as AssignmentRow[]) {
		const result = await dispatchAssignment(supabase, assignment);
		if (result.ok) sent += 1;
		else failed += 1;
	}

	return NextResponse.json({
		ok: true,
		picked: assignments?.length ?? 0,
		sent,
		failed,
	});
}

export async function GET(request: Request) {
	return POST(request);
}

async function dispatchAssignment(
	supabase: ReturnType<typeof createSupabaseAdminClient>,
	assignment: AssignmentRow,
) {
	const run = await supabase
		.from("whatsapp_recurring_runs")
		.insert({
			tenant_id: assignment.tenant_id,
			assignment_id: assignment.id,
			status: "scheduled",
			due_at: assignment.next_run_at ?? new Date().toISOString(),
		})
		.select("id")
		.single();
	if (run.error) {
		console.warn("[whatsapp-recurring] run create failed", run.error);
		return { ok: false };
	}
	const runId = run.data.id as string;

	try {
		const [accountResult, contactResult, templateResult, obraResult] = await Promise.all([
			supabase
				.from("whatsapp_business_accounts")
				.select("id, phone_number_id")
				.eq("tenant_id", assignment.tenant_id)
				.eq("status", "active")
				.order("created_at", { ascending: false })
				.limit(1)
				.maybeSingle(),
			supabase
				.from("whatsapp_contacts")
				.select("id, phone_e164, display_name, status")
				.eq("tenant_id", assignment.tenant_id)
				.eq("id", assignment.contact_id)
				.maybeSingle(),
			supabase
				.from("whatsapp_templates")
				.select("id, name, display_name, language, status, variables")
				.eq("tenant_id", assignment.tenant_id)
				.eq("id", assignment.whatsapp_template_id)
				.maybeSingle(),
			supabase
				.from("obras")
				.select("id, n, designacion_y_ubicacion")
				.eq("tenant_id", assignment.tenant_id)
				.eq("id", assignment.obra_id)
				.is("deleted_at", null)
				.maybeSingle(),
		]);

		if (accountResult.error) throw accountResult.error;
		if (contactResult.error) throw contactResult.error;
		if (templateResult.error) throw templateResult.error;
		if (obraResult.error) throw obraResult.error;
		const account = accountResult.data;
		const contact = contactResult.data;
		const template = templateResult.data;
		const obra = obraResult.data;
		if (!account) throw new Error("active_whatsapp_account_not_found");
		if (!contact || contact.status !== "active") throw new Error("contact_not_active");
		if (!template || template.status !== "approved") throw new Error("template_not_approved");
		if (!obra) throw new Error("obra_not_found");
		await assertTenantTemplateBudget(supabase, assignment.tenant_id);

		const responseUrl = buildWhatsAppResponseUrl(runId);
		const obraName = obra.n
			? `#${obra.n} ${obra.designacion_y_ubicacion ?? ""}`.trim()
			: obra.designacion_y_ubicacion;
		const result = await sendWhatsAppTemplate({
			phoneNumberId: account.phone_number_id,
			accessToken: WHATSAPP_TOKEN!,
			to: contact.phone_e164,
			templateName: template.name,
			language: template.language ?? "es_AR",
			bodyParameters: templateVariables({
				variables: template.variables,
				contactName: contact.display_name ?? contact.phone_e164,
				obraName,
				templateName: template.display_name ?? template.name,
				folderPath: assignment.folder_path,
				responseUrl,
			}),
			graphApiVersion: GRAPH_API_VERSION,
		});

		const outboundMessage = await supabase
			.from("whatsapp_messages")
			.insert({
				tenant_id: assignment.tenant_id,
				business_account_id: account.id,
				contact_id: contact.id,
				wamid: readOutboundMessageId(result),
				direction: "outbound",
				from_phone: account.phone_number_id,
				to_phone: contact.phone_e164,
				message_type: "template",
				text_body: template.display_name ?? template.name,
				status: "sent",
				raw_payload: {
					provider: "meta_cloud",
					template: template.name,
					runId,
					responseUrl,
					result,
				},
				processed_at: new Date().toISOString(),
			})
			.select("id")
			.single();
		if (outboundMessage.error) throw outboundMessage.error;

		const chatAction = await supabase
			.from("whatsapp_chat_actions")
			.insert({
				tenant_id: assignment.tenant_id,
				contact_id: contact.id,
				source_message_id: outboundMessage.data.id,
				action_type: "template_response",
				status: "pending",
				obra_id: assignment.obra_id,
				folder_path: assignment.folder_path,
				whatsapp_template_id: assignment.whatsapp_template_id,
				document_generation_template_id: assignment.document_generation_template_id,
				result_summary: `Template enviado. Esperando respuesta del formulario.`,
				parsed_params: { runId, responseUrl },
			})
			.select("id")
			.single();

		const nextRunAt = computeNextRunAt({
			frequency: assignment.frequency,
			weekday: assignment.weekday,
			dayOfMonth: assignment.day_of_month,
			timeOfDay: assignment.time_of_day,
			timezone: assignment.timezone,
			from: new Date(),
		});

		await supabase
			.from("whatsapp_recurring_runs")
			.update({
				outbound_message_id: outboundMessage.data.id,
				chat_action_id: chatAction.data?.id ?? null,
				status: "sent",
				sent_at: new Date().toISOString(),
			})
			.eq("id", runId);
		await supabase
			.from("whatsapp_recurring_assignments")
			.update({
				last_run_at: new Date().toISOString(),
				next_run_at: nextRunAt,
				status: nextRunAt ? "active" : "archived",
			})
			.eq("id", assignment.id);
		return { ok: true };
	} catch (error) {
		const message = error instanceof Error ? error.message : "unknown_error";
		await supabase
			.from("whatsapp_recurring_runs")
			.update({ status: "failed", error_message: message })
			.eq("id", runId);
		await supabase
			.from("whatsapp_recurring_assignments")
			.update({
				next_run_at: computeNextRunAt({
					frequency: assignment.frequency,
					weekday: assignment.weekday,
					dayOfMonth: assignment.day_of_month,
					timeOfDay: assignment.time_of_day,
					timezone: assignment.timezone,
					from: new Date(),
				}),
			})
			.eq("id", assignment.id);
		console.warn("[whatsapp-recurring] dispatch failed", {
			assignmentId: assignment.id,
			error: message,
		});
		return { ok: false };
	}
}

async function assertTenantTemplateBudget(
	supabase: ReturnType<typeof createSupabaseAdminClient>,
	tenantId: string,
) {
	const { data: policy, error: policyError } = await supabase
		.from("whatsapp_usage_policies")
		.select("utility_templates_limit, marketing_templates_limit, authentication_templates_limit")
		.eq("tenant_id", tenantId)
		.maybeSingle();
	if (policyError) throw policyError;
	if (!policy) return;
	const limit =
		Number(policy.utility_templates_limit ?? 0) +
		Number(policy.marketing_templates_limit ?? 0) +
		Number(policy.authentication_templates_limit ?? 0);
	if (limit <= 0) throw new Error("whatsapp_template_budget_disabled");

	const now = new Date();
	const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
	const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
	const { count, error } = await supabase
		.from("whatsapp_messages")
		.select("id", { count: "exact", head: true })
		.eq("tenant_id", tenantId)
		.eq("direction", "outbound")
		.eq("message_type", "template")
		.gte("created_at", monthStart)
		.lt("created_at", monthEnd);
	if (error) throw error;
	if ((count ?? 0) >= limit) throw new Error("whatsapp_template_budget_exhausted");
}

function readOutboundMessageId(result: unknown) {
	const root = readRecord(result);
	const messages = Array.isArray(root.messages) ? root.messages : [];
	const firstMessage = readRecord(messages[0]);
	return typeof firstMessage.id === "string" ? firstMessage.id : null;
}

function readRecord(value: unknown): Record<string, unknown> {
	return value && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {};
}
