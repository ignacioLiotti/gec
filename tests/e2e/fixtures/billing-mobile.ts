import { randomInt, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FixtureManifest } from "./manifest";

function assertWrite(error: { message: string } | null, operation: string) {
	if (error) throw new Error(`${operation}: ${error.message}`);
}

export function createBillingMobileFixtureController({
	admin, tenantId, namespace, manifest,
}: {
	admin: SupabaseClient;
	tenantId: string;
	namespace: string;
	manifest: FixtureManifest;
}) {
	async function contact() {
		const contactId = randomUUID();
		manifest.add("whatsapp-contact", contactId);
		assertWrite((await admin.from("whatsapp_contacts").insert({
			id: contactId, tenant_id: tenantId, display_name: `${namespace} synthetic contact`,
			phone_e164: `+1999${randomInt(1000000, 9999999)}`,
			status: "active", can_submit_forms: true,
		})).error, "Seed signed form contact");
		return contactId;
	}
	return {
		async seedSubscription(input: { status: "active" | "pending" | "cancelled" | "paused"; periodEnd?: string; periodStart?: string }) {
			const planKey = `${namespace}-${randomUUID()}`;
			manifest.add("billing-plan", planKey);
			manifest.add("billing-subscription", tenantId);
			assertWrite((await admin.from("subscription_plans").insert({
				plan_key: planKey, name: `${namespace} local billing`,
				metadata: { mercado_pago_amount_ars: 1200, mercado_pago_frequency: 1, mercado_pago_frequency_type: "months" },
			})).error, "Seed local billing plan");
			assertWrite((await admin.from("tenant_subscriptions").upsert({
				tenant_id: tenantId, plan_key: planKey, status: input.status,
				current_period_start: input.periodStart ?? new Date().toISOString(),
				current_period_end: input.periodEnd ?? new Date(Date.now() + 30 * 86400000).toISOString(),
				metadata: {}, external_subscription_id: null,
			})).error, "Seed subscription access precondition");
			return { planKey };
		},
		async createFlow(input: { state: "open" | "expired" | "past_expiry" | "cancelled" }) {
			const contactId = await contact();
			const flowId = randomUUID();
			const runId = randomUUID();
			const chatActionId = randomUUID();
			const title = `${namespace} mobile checklist`;
			manifest.add("whatsapp-flow", flowId);
			manifest.add("whatsapp-flow-run", runId);
			manifest.add("whatsapp-chat-action", chatActionId);
			assertWrite((await admin.from("whatsapp_flows").insert({
				id: flowId, tenant_id: tenantId, name: title, slug: `${namespace}-${flowId}`, status: "active",
				definition: { fields: [
					{ key: "note", label: "Inspection note", type: "text", required: true },
					{ key: "confirmed", label: "Confirmed", type: "boolean" },
				] },
			})).error, "Seed mobile flow");
			assertWrite((await admin.from("whatsapp_chat_actions").insert({
				id: chatActionId, tenant_id: tenantId, contact_id: contactId,
				action_type: "manual_submission", status: "pending",
			})).error, "Seed mobile flow audit action");
			assertWrite((await admin.from("whatsapp_flow_runs").insert({
				id: runId, tenant_id: tenantId, flow_id: flowId, contact_id: contactId, chat_action_id: chatActionId,
				status: input.state === "open" || input.state === "past_expiry" ? "sent" : input.state,
				expires_at: new Date(Date.now() + (input.state === "past_expiry" || input.state === "expired" ? -86400000 : 86400000)).toISOString(),
			})).error, "Seed mobile flow run");
			return { runId, contactId, title, chatActionId };
		},
		async createRecurring(input: { resultMode: "manual_submission" | "review_only" }) {
			const contactId = await contact();
			const obraId = randomUUID();
			const templateId = randomUUID();
			const assignmentId = randomUUID();
			const runId = randomUUID();
			const chatActionId = randomUUID();
			const title = `${namespace} recurring response`;
			const folderPath = `${namespace}-responses`;
			manifest.add("obra", obraId);
			manifest.add("whatsapp-template", templateId);
			manifest.add("whatsapp-assignment", assignmentId);
			manifest.add("whatsapp-run", runId);
			manifest.add("whatsapp-chat-action", chatActionId);
			assertWrite((await admin.from("obras").insert({
				id: obraId, tenant_id: tenantId, n: randomInt(1000000, 9999999),
				designacion_y_ubicacion: title, entidad_contratante: "Synthetic mobile capture",
				mes_basico_de_contrato: "01/01/2026", iniciacion: "15/01/2026",
			})).error, "Seed recurring obra");
			assertWrite((await admin.from("whatsapp_templates").insert({
				id: templateId, tenant_id: tenantId, name: `${namespace}-${templateId}`, display_name: title, status: "approved",
			})).error, "Seed recurring template registry");
			assertWrite((await admin.from("whatsapp_recurring_assignments").insert({
				id: assignmentId, tenant_id: tenantId, contact_id: contactId, whatsapp_template_id: templateId,
				obra_id: obraId, folder_path: folderPath, result_mode: input.resultMode, frequency: "once",
			})).error, "Seed recurring assignment");
			assertWrite((await admin.from("whatsapp_chat_actions").insert({
				id: chatActionId, tenant_id: tenantId, contact_id: contactId, action_type: "template_response", status: "pending",
			})).error, "Seed response audit action");
			assertWrite((await admin.from("whatsapp_recurring_runs").insert({
				id: runId, tenant_id: tenantId, assignment_id: assignmentId, chat_action_id: chatActionId,
				status: "sent", sent_at: new Date().toISOString(),
			})).error, "Seed recurring sent run");
			return { runId, contactId, title, obraId, folderPath, chatActionId };
		},
	};
}
