"use server";

import { revalidatePath } from "next/cache";
import { validateManualSubmission } from "@/lib/whatsapp/commands";
import { computeNextRunAt } from "@/lib/whatsapp/recurring";
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

function parseInteger(value: FormDataEntryValue | null, fallback = 0) {
	const raw = String(value ?? "").trim();
	if (!raw) return fallback;
	const parsed = Number.parseInt(raw, 10);
	return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
}

function parseNullableInteger(value: FormDataEntryValue | null) {
	const raw = String(value ?? "").trim();
	if (!raw) return null;
	const parsed = Number.parseInt(raw, 10);
	return Number.isFinite(parsed) ? Math.max(0, parsed) : null;
}

function parseStorageBytes(value: FormDataEntryValue | null, fallbackGb = 2) {
	const raw = String(value ?? "").trim();
	if (!raw) return Math.trunc(fallbackGb * 1024 * 1024 * 1024);
	const parsed = Number.parseFloat(raw.replace(",", "."));
	if (!Number.isFinite(parsed)) return Math.trunc(fallbackGb * 1024 * 1024 * 1024);
	return Math.max(0, Math.trunc(parsed * 1024 * 1024 * 1024));
}

function parseVariables(value: FormDataEntryValue | null) {
	return String(value ?? "")
		.split(",")
		.map((entry) => entry.trim())
		.filter(Boolean);
}

function parseOptionalUuid(value: FormDataEntryValue | null) {
	const raw = String(value ?? "").trim();
	return raw || null;
}

function parseJsonObject(value: FormDataEntryValue | null) {
	const raw = String(value ?? "").trim();
	if (!raw) return {};
	try {
		const parsed = JSON.parse(raw);
		return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
	} catch {
		return {};
	}
}

function slugify(value: string) {
	return value
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9]+/g, "_")
		.replace(/^_+|_+$/g, "")
		.slice(0, 80);
}

function nativePurchaseOrderFlowJson() {
	return {
		version: "7.3",
		screens: [
			{
				id: "CHECKLIST",
				title: "Orden de compra",
				terminal: true,
				success: true,
				data: {
					flow_run_id: { type: "string", __example__: "flow-run-id" },
					sintesis_flow_id: { type: "string", __example__: "flow-id" },
				},
				layout: {
					type: "SingleColumnLayout",
					children: [
						{ type: "TextHeading", text: "Confirmar recepcion" },
						{ type: "TextBody", text: "Marca si los items llegaron correctamente a la obra." },
						{
							type: "RadioButtonsGroup",
							name: "item_1_received",
							label: "Item 1 recibido",
							required: true,
							"data-source": [
								{ id: "true", title: "Si" },
								{ id: "false", title: "No" },
							],
						},
						{
							type: "RadioButtonsGroup",
							name: "item_2_received",
							label: "Item 2 recibido",
							required: true,
							"data-source": [
								{ id: "true", title: "Si" },
								{ id: "false", title: "No" },
							],
						},
						{
							type: "TextArea",
							name: "comment",
							label: "Comentario si algo no llego",
							required: false,
						},
						{
							type: "Footer",
							label: "Enviar",
							"on-click-action": {
								name: "complete",
								payload: {
									flow_run_id: "${data.flow_run_id}",
									sintesis_flow_id: "${data.sintesis_flow_id}",
									item_1_received: "${form.item_1_received}",
									item_2_received: "${form.item_2_received}",
									comment: "${form.comment}",
								},
							},
						},
					],
				},
			},
		],
	};
}

function nativeInvoiceFlowJson() {
	return {
		version: "7.3",
		screens: [
			{
				id: "INVOICE",
				title: "Carga de factura",
				terminal: true,
				success: true,
				data: {
					flow_run_id: { type: "string", __example__: "flow-run-id" },
					sintesis_flow_id: { type: "string", __example__: "flow-id" },
				},
				layout: {
					type: "SingleColumnLayout",
					children: [
						{ type: "TextHeading", text: "Nueva factura" },
						{ type: "TextBody", text: "Completa los datos principales de la factura." },
						{
							type: "DatePicker",
							name: "invoice_date",
							label: "Fecha de factura",
							required: true,
						},
						{
							type: "Dropdown",
							name: "invoice_type",
							label: "Tipo de factura",
							required: true,
							"data-source": [
								{ id: "A", title: "Factura A" },
								{ id: "B", title: "Factura B" },
								{ id: "C", title: "Factura C" },
							],
						},
						{
							type: "TextInput",
							name: "amount",
							label: "Monto",
							"input-type": "number",
							required: true,
						},
						{
							type: "TextArea",
							name: "comment",
							label: "Comentario",
							required: false,
						},
						{
							type: "Footer",
							label: "Enviar",
							"on-click-action": {
								name: "complete",
								payload: {
									flow_run_id: "${data.flow_run_id}",
									sintesis_flow_id: "${data.sintesis_flow_id}",
									invoice_date: "${form.invoice_date}",
									invoice_type: "${form.invoice_type}",
									amount: "${form.amount}",
									comment: "${form.comment}",
								},
							},
						},
					],
				},
			},
		],
	};
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

export async function updateUsagePolicyAction(formData: FormData) {
	const { supabase, user, tenantId } = await requireAdminTenant(formData);

	const utilityTemplatesLimit = parseInteger(formData.get("utilityTemplatesLimit"), 400);
	const marketingTemplatesLimit = parseInteger(formData.get("marketingTemplatesLimit"), 0);
	const authenticationTemplatesLimit = parseInteger(
		formData.get("authenticationTemplatesLimit"),
		0,
	);
	const storageBytesLimit = parseStorageBytes(formData.get("storageGbLimit"), 2);
	const payload = {
		tenant_id: tenantId,
		monthly_budget_cents: parseInteger(formData.get("monthlyBudgetUsd"), 20) * 100,
		service_messages_limit: parseNullableInteger(formData.get("serviceMessagesLimit")),
		utility_templates_limit: utilityTemplatesLimit,
		marketing_templates_limit: marketingTemplatesLimit,
		authentication_templates_limit: authenticationTemplatesLimit,
		file_uploads_limit: parseInteger(formData.get("fileUploadsLimit"), 300),
		storage_bytes_limit: storageBytesLimit,
		data_queries_limit: parseInteger(formData.get("dataQueriesLimit"), 300),
		manual_submissions_limit: parseInteger(formData.get("manualSubmissionsLimit"), 300),
		recurring_contacts_limit: parseInteger(formData.get("recurringContactsLimit"), 25),
		recurring_reminders_per_contact_per_week: parseInteger(
			formData.get("recurringRemindersPerContactPerWeek"),
			1,
		),
		created_by: user.id,
	};

	const { error } = await supabase.from("whatsapp_usage_policies").upsert(payload, {
		onConflict: "tenant_id",
	});
	if (error) throw error;

	const { error: subscriptionError } = await supabase.from("tenant_subscriptions").upsert(
		{
			tenant_id: tenantId,
			plan_key: "starter",
			whatsapp_message_budget_override:
				utilityTemplatesLimit + marketingTemplatesLimit + authenticationTemplatesLimit,
			storage_limit_bytes_override: storageBytesLimit,
		},
		{ onConflict: "tenant_id" },
	);
	if (subscriptionError) throw subscriptionError;

	revalidatePath("/admin/whatsapp");
}

export async function createTemplateAction(formData: FormData) {
	const { supabase, user, tenantId } = await requireAdminTenant(formData);
	const name = String(formData.get("name") ?? "").trim();
	if (!name) throw new Error("Falta nombre de plantilla");
	const documentGenerationTemplateId = parseOptionalUuid(formData.get("documentGenerationTemplateId"));
	let documentType = String(formData.get("documentType") ?? "").trim() || null;
	let targetFolderPath = String(formData.get("targetFolderPath") ?? "").trim() || null;

	if (documentGenerationTemplateId) {
		const { data: documentTemplate, error: documentTemplateError } = await supabase
			.from("document_generation_templates")
			.select("id, document_type, target_folder_path, tenant_id")
			.eq("id", documentGenerationTemplateId)
			.or(`tenant_id.is.null,tenant_id.eq.${tenantId}`)
			.maybeSingle();
		if (documentTemplateError) throw documentTemplateError;
		if (!documentTemplate) throw new Error("Template de documento no encontrado");
		documentType = documentType ?? documentTemplate.document_type;
		targetFolderPath = targetFolderPath ?? documentTemplate.target_folder_path;
	}

	const { error } = await supabase.from("whatsapp_templates").upsert(
		{
			tenant_id: tenantId,
			name,
			display_name: String(formData.get("displayName") ?? "").trim() || null,
			category: String(formData.get("category") ?? "utility"),
			language: String(formData.get("language") ?? "es_AR").trim() || "es_AR",
			status: String(formData.get("status") ?? "draft"),
			trigger_purpose: String(formData.get("triggerPurpose") ?? "").trim() || null,
			body: String(formData.get("body") ?? "").trim() || null,
			variables: parseVariables(formData.get("variables")),
			meta_template_id: String(formData.get("metaTemplateId") ?? "").trim() || null,
			document_generation_template_id: documentGenerationTemplateId,
			document_type: documentType,
			target_folder_path: targetFolderPath,
			result_mode: String(formData.get("resultMode") ?? "manual_submission"),
			field_mapping: parseJsonObject(formData.get("fieldMapping")),
			created_by: user.id,
		},
		{ onConflict: "tenant_id,name" },
	);
	if (error) throw error;
	revalidatePath("/admin/whatsapp");
}

export async function createRecurringAssignmentAction(formData: FormData) {
	const { supabase, user, tenantId } = await requireAdminTenant(formData);
	const contactId = parseOptionalUuid(formData.get("contactId"));
	const whatsappTemplateId = parseOptionalUuid(formData.get("whatsappTemplateId"));
	const obraId = parseOptionalUuid(formData.get("obraId"));
	if (!contactId || !whatsappTemplateId || !obraId) {
		throw new Error("Falta contacto, plantilla u obra");
	}

	const { data: contact, error: contactError } = await supabase
		.from("whatsapp_contacts")
		.select("id")
		.eq("tenant_id", tenantId)
		.eq("id", contactId)
		.maybeSingle();
	if (contactError) throw contactError;
	if (!contact) throw new Error("Contacto no encontrado");

	const { data: template, error: templateError } = await supabase
		.from("whatsapp_templates")
		.select("id, document_generation_template_id, target_folder_path, result_mode")
		.eq("tenant_id", tenantId)
		.eq("id", whatsappTemplateId)
		.maybeSingle();
	if (templateError) throw templateError;
	if (!template) throw new Error("Plantilla no encontrada");

	const { data: obra, error: obraError } = await supabase
		.from("obras")
		.select("id")
		.eq("tenant_id", tenantId)
		.eq("id", obraId)
		.is("deleted_at", null)
		.maybeSingle();
	if (obraError) throw obraError;
	if (!obra) throw new Error("Obra no encontrada");

	const documentGenerationTemplateId =
		parseOptionalUuid(formData.get("documentGenerationTemplateId")) ??
		(template.document_generation_template_id as string | null);
	const folderPath =
		String(formData.get("folderPath") ?? "").trim() ||
		((template.target_folder_path as string | null) ?? null);

	const { error } = await supabase.from("whatsapp_recurring_assignments").insert({
		tenant_id: tenantId,
		contact_id: contactId,
		whatsapp_template_id: whatsappTemplateId,
		document_generation_template_id: documentGenerationTemplateId,
		obra_id: obraId,
		folder_path: folderPath,
		result_mode: String(formData.get("resultMode") ?? template.result_mode ?? "manual_submission"),
		frequency: String(formData.get("frequency") ?? "weekly"),
		weekday: String(formData.get("weekday") ?? "").trim() || null,
		day_of_month: parseNullableInteger(formData.get("dayOfMonth")),
		time_of_day: String(formData.get("timeOfDay") ?? "").trim() || null,
		timezone:
			String(formData.get("timezone") ?? "").trim() ||
			"America/Argentina/Buenos_Aires",
		status: String(formData.get("status") ?? "active"),
		next_run_at: computeNextRunAt({
			frequency: String(formData.get("frequency") ?? "weekly"),
			weekday: String(formData.get("weekday") ?? "").trim() || null,
			dayOfMonth: parseNullableInteger(formData.get("dayOfMonth")),
			timeOfDay: String(formData.get("timeOfDay") ?? "").trim() || null,
			timezone:
				String(formData.get("timezone") ?? "").trim() ||
				"America/Argentina/Buenos_Aires",
		}),
		created_by: user.id,
	});
	if (error) throw error;
	revalidatePath("/admin/whatsapp");
}

export async function createFlowAction(formData: FormData) {
	const { supabase, user, tenantId } = await requireAdminTenant(formData);
	const name = String(formData.get("name") ?? "").trim();
	if (!name) throw new Error("Falta nombre del flow");
	const slug = slugify(String(formData.get("slug") ?? "").trim() || name);
	if (!slug) throw new Error("Falta slug del flow");
	const definition = parseJsonObject(formData.get("definition"));
	if (!Array.isArray(definition.fields)) {
		definition.fields = [];
	}

	const { error } = await supabase.from("whatsapp_flows").upsert(
		{
			tenant_id: tenantId,
			name,
			slug,
			description: String(formData.get("description") ?? "").trim() || null,
			status: String(formData.get("status") ?? "draft"),
			flow_type: String(formData.get("flowType") ?? "data_entry"),
			meta_flow_id: String(formData.get("metaFlowId") ?? "").trim() || null,
			definition,
			settings: parseJsonObject(formData.get("settings")),
			created_by: user.id,
		},
		{ onConflict: "tenant_id,slug" },
	);
	if (error) throw error;
	revalidatePath("/admin/whatsapp");
}

export async function createStarterFlowsAction(formData: FormData) {
	const { supabase, user, tenantId } = await requireAdminTenant(formData);
	const starterFlows = [
		{
			name: "Confirmar orden de compra",
			slug: "confirmar_orden_compra",
			description: "Checklist simple para confirmar si llegaron items a obra.",
			flow_type: "boolean_checklist",
			definition: {
				fields: [
					{ key: "item_1_received", label: "Item 1 recibido", type: "boolean", required: true },
					{ key: "item_2_received", label: "Item 2 recibido", type: "boolean", required: true },
					{ key: "comment", label: "Comentario si algo no llego", type: "textarea", required: false },
				],
			},
		},
		{
			name: "Carga de factura",
			slug: "carga_factura",
			description: "Formulario con fecha, tipo y monto para carga manual.",
			flow_type: "data_entry",
			definition: {
				fields: [
					{ key: "invoice_date", label: "Fecha de factura", type: "date", required: true },
					{ key: "invoice_type", label: "Tipo de factura", type: "select", required: true, options: ["A", "B", "C"] },
					{ key: "amount", label: "Monto", type: "number", required: true },
					{ key: "comment", label: "Comentario", type: "textarea", required: false },
				],
			},
		},
		{
			name: "Avance semanal",
			slug: "avance_semanal",
			description: "Relevamiento corto de avance y bloqueo semanal.",
			flow_type: "review",
			definition: {
				fields: [
					{ key: "progress_date", label: "Fecha de reporte", type: "date", required: true },
					{ key: "progress_percent", label: "Avance porcentual", type: "number", required: true },
					{ key: "has_blockers", label: "Hay bloqueos", type: "boolean", required: true },
					{ key: "blocker_comment", label: "Detalle de bloqueo", type: "textarea", required: false },
				],
			},
		},
	];

	const { error } = await supabase.from("whatsapp_flows").upsert(
		starterFlows.map((flow) => ({
			tenant_id: tenantId,
			...flow,
			status: "active",
			settings: { showInTestMenu: true, starter: true },
			created_by: user.id,
		})),
		{ onConflict: "tenant_id,slug" },
	);
	if (error) throw error;
	revalidatePath("/admin/whatsapp");
}

export async function createNativeStarterFlowsAction(formData: FormData) {
	const { supabase, user, tenantId } = await requireAdminTenant(formData);
	const nativeFlows = [
		{
			name: "Nativo - confirmar orden de compra",
			slug: "nativo_confirmar_orden_compra",
			description: "Flow nativo de WhatsApp para confirmar recepcion de items.",
			flow_type: "boolean_checklist",
			definition: {
				fields: [
					{ key: "item_1_received", label: "Item 1 recibido", type: "boolean", required: true },
					{ key: "item_2_received", label: "Item 2 recibido", type: "boolean", required: true },
					{ key: "comment", label: "Comentario", type: "textarea", required: false },
				],
			},
			settings: {
				showInTestMenu: true,
				native: {
					enabled: true,
					mode: "draft",
					cta: "Responder",
					screen: "CHECKLIST",
					flowJson: nativePurchaseOrderFlowJson(),
				},
			},
		},
		{
			name: "Nativo - carga de factura",
			slug: "nativo_carga_factura",
			description: "Flow nativo de WhatsApp para cargar fecha, tipo y monto.",
			flow_type: "data_entry",
			definition: {
				fields: [
					{ key: "invoice_date", label: "Fecha de factura", type: "date", required: true },
					{ key: "invoice_type", label: "Tipo de factura", type: "select", required: true, options: ["A", "B", "C"] },
					{ key: "amount", label: "Monto", type: "number", required: true },
					{ key: "comment", label: "Comentario", type: "textarea", required: false },
				],
			},
			settings: {
				showInTestMenu: true,
				native: {
					enabled: true,
					mode: "draft",
					cta: "Cargar",
					screen: "INVOICE",
					flowJson: nativeInvoiceFlowJson(),
				},
			},
		},
	];

	const { error } = await supabase.from("whatsapp_flows").upsert(
		nativeFlows.map((flow) => ({
			tenant_id: tenantId,
			...flow,
			status: "active",
			created_by: user.id,
		})),
		{ onConflict: "tenant_id,slug" },
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
