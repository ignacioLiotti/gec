import {
	applySubmissionAction,
	createBusinessAccountAction,
	createContactAction,
	createFlowAction,
	createManualFormAction,
	createRecurringAssignmentAction,
	createStarterFlowsAction,
	createTemplateAction,
	updateUsagePolicyAction,
} from "./actions";
import type React from "react";
import Link from "next/link";
import {
	AlertTriangle,
	BarChart3,
	CalendarDays,
	CheckCircle2,
	Clock3,
	FileText,
	FormInput,
	Inbox,
	MessageCircle,
	Phone,
	Settings,
	ShieldCheck,
	SlidersHorizontal,
	Tags,
	UploadCloud,
	UserPlus,
	Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { resolveTenantMembership } from "@/lib/tenant-selection";
import { cn } from "@/lib/utils";
import { createClient } from "@/utils/supabase/server";

type PageProps = {
	searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type AdminTab = "historial" | "contactos" | "templates" | "flows" | "asignaciones" | "uso" | "configuracion";

type TablaOption = {
	id: string;
	name: string;
	obras?:
		| { n?: number | null; designacion_y_ubicacion?: string | null }
		| { n?: number | null; designacion_y_ubicacion?: string | null }[]
		| null;
};

type ObraOption = {
	id: string;
	n: number | null;
	designacion_y_ubicacion: string | null;
};

type Account = {
	id: string;
	provider: string | null;
	phone_number_id: string;
	display_phone_number: string | null;
	business_account_id: string | null;
	status: string | null;
	created_at: string | null;
};

type Contact = {
	id: string;
	phone_e164: string;
	display_name: string | null;
	status: string | null;
	can_upload_documents: boolean | null;
	can_submit_forms: boolean | null;
	can_query_data: boolean | null;
	allowed_obra_ids: string[] | null;
	created_at: string | null;
};

type UsagePolicy = {
	tenant_id: string;
	monthly_budget_cents: number | null;
	service_messages_limit: number | null;
	utility_templates_limit: number | null;
	marketing_templates_limit: number | null;
	authentication_templates_limit: number | null;
	file_uploads_limit: number | null;
	storage_bytes_limit: number | null;
	data_queries_limit: number | null;
	manual_submissions_limit: number | null;
	recurring_contacts_limit: number | null;
	recurring_reminders_per_contact_per_week: number | null;
};

type Template = {
	id: string;
	name: string;
	display_name: string | null;
	category: string | null;
	language: string | null;
	status: string | null;
	trigger_purpose: string | null;
	body: string | null;
	variables: unknown;
	meta_template_id: string | null;
	document_generation_template_id?: string | null;
	document_type?: string | null;
	target_folder_path?: string | null;
	result_mode?: string | null;
	field_mapping?: unknown;
	created_at: string | null;
};

type DocumentTemplate = {
	id: string;
	key: string;
	name: string;
	document_type: string;
	target_folder_path: string | null;
	status: string | null;
	version: number | null;
	tenant_id: string | null;
};

type Assignment = {
	id: string;
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
	status: string | null;
	next_run_at: string | null;
	last_run_at: string | null;
	created_at: string | null;
};

type ChatAction = {
	id: string;
	contact_id: string | null;
	source_message_id: string | null;
	action_type: string | null;
	status: string | null;
	obra_id: string | null;
	folder_path: string | null;
	whatsapp_template_id: string | null;
	document_generation_template_id: string | null;
	result_summary: string | null;
	error_message: string | null;
	user_prompt: string | null;
	created_at: string | null;
	resolved_at: string | null;
};

type WhatsAppForm = {
	id: string;
	name: string;
	status: string | null;
	trigger_mode: string | null;
	schedule: unknown;
	tabla_id: string | null;
	folder_path: string | null;
	template_name: string | null;
	whatsapp_flow_id: string | null;
	created_at: string | null;
};

type WhatsAppFlow = {
	id: string;
	name: string;
	slug: string;
	description: string | null;
	status: string | null;
	flow_type: string | null;
	meta_flow_id: string | null;
	version: number | null;
	definition: unknown;
	created_at: string | null;
};

type Message = {
	id: string;
	contact_id?: string | null;
	direction?: string | null;
	from_phone: string | null;
	to_phone?: string | null;
	message_type: string | null;
	text_body: string | null;
	status: string | null;
	error_message: string | null;
	created_at: string | null;
};

type Upload = {
	id: string;
	obra_id: string | null;
	folder_path: string | null;
	storage_path: string | null;
	file_name: string | null;
	uploaded_bytes: number | null;
	status: string | null;
	created_at: string | null;
};

type Submission = {
	id: string;
	status: string | null;
	tabla_id: string | null;
	parsed_values: unknown;
	validation_errors: unknown;
	created_at: string | null;
};

type ChatThread = {
	id: string;
	title: string;
	phone: string;
	lastMessage: string;
	lastStatus: string | null;
	lastAt: string | null;
	count: number;
	actionCount: number;
	lastAction?: ChatAction;
};

const statusLabels: Record<string, string> = {
	active: "Activo",
	archived: "Archivado",
	blocked: "Bloqueado",
	cancelled: "Cancelado",
	completed: "Completado",
	delivered: "Entregado",
	disabled: "Deshabilitado",
	draft: "Borrador",
	failed: "Error",
	ignored: "Ignorado",
	in_progress: "En progreso",
	needs_review: "Revisar",
	paused: "Pausado",
	pending: "Pendiente",
	processed: "Procesado",
	read: "Leido",
	received: "Recibido",
	rejected: "Rechazado",
	sent: "Enviado",
	applied: "Aplicado",
	approved: "Aprobado",
};

const DEFAULT_WHATSAPP_POLICY: UsagePolicy = {
	tenant_id: "",
	monthly_budget_cents: 2000,
	service_messages_limit: null,
	utility_templates_limit: 400,
	marketing_templates_limit: 0,
	authentication_templates_limit: 0,
	file_uploads_limit: 300,
	storage_bytes_limit: 2 * 1024 * 1024 * 1024,
	data_queries_limit: 300,
	manual_submissions_limit: 300,
	recurring_contacts_limit: 25,
	recurring_reminders_per_contact_per_week: 1,
};

const tabs: { key: AdminTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
	{ key: "historial", label: "Historial", icon: Inbox },
	{ key: "contactos", label: "Contactos", icon: Users },
	{ key: "templates", label: "Templates", icon: Tags },
	{ key: "flows", label: "Flows", icon: SlidersHorizontal },
	{ key: "asignaciones", label: "Asignaciones", icon: CalendarDays },
	{ key: "uso", label: "Uso", icon: BarChart3 },
	{ key: "configuracion", label: "Configuracion", icon: Settings },
];

export default async function WhatsAppAdminPage({ searchParams }: PageProps) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) return <div className="p-6 text-sm">Inicia sesion primero.</div>;

	const { data: memberships } = await supabase
		.from("memberships")
		.select("tenant_id, role")
		.eq("user_id", user.id)
		.in("role", ["owner", "admin"])
		.order("created_at", { ascending: true });

	const { tenantId } = await resolveTenantMembership(
		(memberships ?? []) as { tenant_id: string | null; role: string | null }[],
	);
	const resolvedSearch = (await searchParams) ?? {};
	const requestedTenant = Array.isArray(resolvedSearch.tenantId)
		? resolvedSearch.tenantId[0]
		: resolvedSearch.tenantId;
	const activeTenantId =
		requestedTenant &&
		(memberships ?? []).some((membership) => membership.tenant_id === requestedTenant)
			? requestedTenant
			: tenantId;
	const requestedTab = Array.isArray(resolvedSearch.tab) ? resolvedSearch.tab[0] : resolvedSearch.tab;
	const activeTab = normalizeTab(requestedTab);

	if (!activeTenantId) {
		return (
			<div className="p-6 text-sm">
				Necesitas ser administrador de una organizacion para configurar WhatsApp.
			</div>
		);
	}

	const now = new Date();
	const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
	const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
	const [
		tenantResult,
		accountsResult,
		contactsResult,
		usagePolicyResult,
		templatesResult,
		documentTemplatesResult,
		flowsResult,
		assignmentsResult,
		chatActionsResult,
		messagesResult,
		monthlyMessagesResult,
		uploadsResult,
		monthlyUploadsResult,
		formsResult,
		submissionsResult,
		monthlySubmissionsResult,
		tablasResult,
		obrasResult,
	] = await Promise.all([
		supabase.from("tenants").select("id, name").eq("id", activeTenantId).maybeSingle(),
		supabase
			.from("whatsapp_business_accounts")
			.select("id, provider, phone_number_id, display_phone_number, business_account_id, status, created_at")
			.eq("tenant_id", activeTenantId)
			.order("created_at", { ascending: false }),
		supabase
			.from("whatsapp_contacts")
			.select("id, phone_e164, display_name, status, can_upload_documents, can_submit_forms, can_query_data, allowed_obra_ids, created_at")
			.eq("tenant_id", activeTenantId)
			.order("created_at", { ascending: false }),
		supabase
			.from("whatsapp_usage_policies")
			.select("tenant_id, monthly_budget_cents, service_messages_limit, utility_templates_limit, marketing_templates_limit, authentication_templates_limit, file_uploads_limit, storage_bytes_limit, data_queries_limit, manual_submissions_limit, recurring_contacts_limit, recurring_reminders_per_contact_per_week")
			.eq("tenant_id", activeTenantId)
			.maybeSingle(),
		supabase
			.from("whatsapp_templates")
			.select("id, name, display_name, category, language, status, trigger_purpose, body, variables, meta_template_id, document_generation_template_id, document_type, target_folder_path, result_mode, field_mapping, created_at")
			.eq("tenant_id", activeTenantId)
			.order("created_at", { ascending: false }),
		supabase
			.from("document_generation_templates")
			.select("id, key, name, document_type, target_folder_path, status, version, tenant_id")
			.or(`tenant_id.is.null,tenant_id.eq.${activeTenantId}`)
			.in("status", ["active", "draft"])
			.order("name", { ascending: true }),
		supabase
			.from("whatsapp_flows")
			.select("id, name, slug, description, status, flow_type, meta_flow_id, version, definition, created_at")
			.eq("tenant_id", activeTenantId)
			.order("created_at", { ascending: false }),
		supabase
			.from("whatsapp_recurring_assignments")
			.select("id, contact_id, whatsapp_template_id, document_generation_template_id, obra_id, folder_path, result_mode, frequency, weekday, day_of_month, time_of_day, timezone, status, next_run_at, last_run_at, created_at")
			.eq("tenant_id", activeTenantId)
			.order("created_at", { ascending: false }),
		supabase
			.from("whatsapp_chat_actions")
			.select("id, contact_id, source_message_id, action_type, status, obra_id, folder_path, whatsapp_template_id, document_generation_template_id, result_summary, error_message, user_prompt, created_at, resolved_at")
			.eq("tenant_id", activeTenantId)
			.order("created_at", { ascending: false })
			.limit(100),
		supabase
			.from("whatsapp_messages")
			.select("id, contact_id, direction, from_phone, to_phone, message_type, text_body, status, error_message, created_at")
			.eq("tenant_id", activeTenantId)
			.order("created_at", { ascending: false })
			.limit(80),
		supabase
			.from("whatsapp_messages")
			.select("id, direction, message_type, status, created_at")
			.eq("tenant_id", activeTenantId)
			.gte("created_at", monthStart)
			.lt("created_at", monthEnd)
			.limit(5000),
		supabase
			.from("whatsapp_document_uploads")
			.select("id, obra_id, folder_path, storage_path, file_name, uploaded_bytes, status, created_at")
			.eq("tenant_id", activeTenantId)
			.order("created_at", { ascending: false })
			.limit(30),
		supabase
			.from("whatsapp_document_uploads")
			.select("id, uploaded_bytes, status, created_at")
			.eq("tenant_id", activeTenantId)
			.gte("created_at", monthStart)
			.lt("created_at", monthEnd)
			.limit(5000),
		supabase
			.from("whatsapp_manual_forms")
			.select("id, name, status, trigger_mode, schedule, tabla_id, folder_path, template_name, whatsapp_flow_id, created_at")
			.eq("tenant_id", activeTenantId)
			.order("created_at", { ascending: false }),
		supabase
			.from("whatsapp_manual_submissions")
			.select("id, status, tabla_id, parsed_values, validation_errors, created_at")
			.eq("tenant_id", activeTenantId)
			.order("created_at", { ascending: false })
			.limit(30),
		supabase
			.from("whatsapp_manual_submissions")
			.select("id, status, created_at")
			.eq("tenant_id", activeTenantId)
			.gte("created_at", monthStart)
			.lt("created_at", monthEnd)
			.limit(5000),
		supabase
			.from("obra_tablas")
			.select("id, name, obra_id, source_type, settings, obras!inner(id, tenant_id, deleted_at, n, designacion_y_ubicacion)")
			.eq("obras.tenant_id", activeTenantId)
			.is("obras.deleted_at", null)
			.order("created_at", { ascending: false })
			.limit(150),
		supabase
			.from("obras")
			.select("id, n, designacion_y_ubicacion")
			.eq("tenant_id", activeTenantId)
			.is("deleted_at", null)
			.order("n", { ascending: true })
			.limit(250),
	]);

	const tenantName = tenantResult.data?.name ?? "Organizacion";
	const accounts = (accountsResult.data ?? []) as Account[];
	const contacts = (contactsResult.data ?? []) as Contact[];
	const usagePolicy = {
		...DEFAULT_WHATSAPP_POLICY,
		...((usagePolicyResult.data as UsagePolicy | null) ?? {}),
		tenant_id: activeTenantId,
	};
	const templates = (templatesResult.data ?? []) as Template[];
	const documentTemplates = (documentTemplatesResult.data ?? []) as DocumentTemplate[];
	const flows = (flowsResult.data ?? []) as WhatsAppFlow[];
	const assignments = (assignmentsResult.data ?? []) as Assignment[];
	const chatActions = (chatActionsResult.data ?? []) as ChatAction[];
	const messages = (messagesResult.data ?? []) as Message[];
	const monthlyMessages = (monthlyMessagesResult.data ?? []) as Message[];
	const uploads = (uploadsResult.data ?? []) as Upload[];
	const monthlyUploads = (monthlyUploadsResult.data ?? []) as Upload[];
	const forms = (formsResult.data ?? []) as WhatsAppForm[];
	const submissions = (submissionsResult.data ?? []) as Submission[];
	const monthlySubmissions = (monthlySubmissionsResult.data ?? []) as Submission[];
	const tablas = (tablasResult.data ?? []) as TablaOption[];
	const obras = (obrasResult.data ?? []) as ObraOption[];
	const primaryAccount = accounts[0];
	const activeContacts = contacts.filter((contact) => contact.status === "active");
	const pendingSubmissions = submissions.filter((submission) => submission.status !== "applied");
	const monthlyUploadBytes = monthlyUploads.reduce(
		(total, upload) => total + Number(upload.uploaded_bytes ?? 0),
		0,
	);
	const monthlyInboundMessages = monthlyMessages.filter((message) => message.direction === "inbound").length;
	const monthlyOutboundMessages = monthlyMessages.filter((message) => message.direction === "outbound").length;
	const approvedTemplates = templates.filter((template) => template.status === "approved").length;
	const activeFlows = flows.filter((flow) => flow.status === "active").length;
	const activeAssignments = assignments.filter((assignment) => assignment.status === "active").length;
	const chatThreads = buildChatThreads(messages, contacts, chatActions);
	const hasWebhook = Boolean(process.env.WHATSAPP_VERIFY_TOKEN);
	const hasToken = Boolean(process.env.WHATSAPP_ACCESS_TOKEN);
	const hasAppSecret = Boolean(process.env.WHATSAPP_APP_SECRET);

	return (
		<div className="space-y-6 p-6">
			<header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
				<div className="max-w-3xl space-y-2">
					<div className="flex flex-wrap items-center gap-2">
						<h1 className="text-2xl font-semibold">WhatsApp</h1>
						<StatusBadge status={primaryAccount?.status ?? "draft"} />
					</div>
					<p className="text-sm text-foreground/70">
						Operacion de WhatsApp para {tenantName}: historial de chats, contactos, templates conectados a documentos,
						asignaciones recurrentes, uso y configuracion tecnica.
					</p>
				</div>
				<div className="rounded-md border bg-foreground/[0.03] px-4 py-3 text-sm">
					<p className="font-medium">{primaryAccount?.display_phone_number ?? "Sin numero activo"}</p>
					<p className="mt-1 text-xs text-foreground/60">
						{primaryAccount?.business_account_id
							? `WABA ${primaryAccount.business_account_id}`
							: "Agrega la cuenta cuando Meta termine la verificacion."}
					</p>
				</div>
			</header>

			<section className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
				<Metric icon={Phone} label="Cuenta" value={primaryAccount ? statusLabel(primaryAccount.status) : "Sin configurar"} />
				<Metric icon={ShieldCheck} label="Contactos activos" value={activeContacts.length} />
				<Metric icon={Tags} label="Templates aprobados" value={approvedTemplates} />
				<Metric icon={SlidersHorizontal} label="Flows activos" value={activeFlows} />
				<Metric icon={CalendarDays} label="Asignaciones" value={activeAssignments} />
				<Metric icon={FormInput} label="Pendientes" value={pendingSubmissions.length} />
			</section>

			<TabNav activeTab={activeTab} tenantId={requestedTenant} />

			{activeTab === "historial" && (
				<section className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
					<ActivityPanel icon={Inbox} title="Conversaciones">
						<div className="grid grid-cols-3 gap-2 text-sm">
							<MiniStat label="Entrantes" value={monthlyInboundMessages} />
							<MiniStat label="Salientes" value={monthlyOutboundMessages} />
							<MiniStat label="Threads" value={chatThreads.length} />
						</div>
						<ChatThreadList threads={chatThreads} />
					</ActivityPanel>
					<div className="grid gap-4">
						<ActivityPanel icon={MessageCircle} title="Acciones del bot">
							<ChatActionList
								actions={chatActions}
								contacts={contacts}
								templates={templates}
								documentTemplates={documentTemplates}
								obras={obras}
							/>
						</ActivityPanel>
						<section className="grid gap-4 xl:grid-cols-3">
							<ActivityPanel icon={Inbox} title="Mensajes recientes">
								<ActivityList
									empty="Todavia no entraron mensajes."
									items={messages.map((message) => ({
										id: message.id,
										title: `${message.from_phone ?? message.to_phone ?? "Sin telefono"} · ${message.message_type ?? "mensaje"}`,
										description: message.text_body ?? message.error_message ?? statusLabel(message.status),
										meta: formatDate(message.created_at),
										status: message.status,
									}))}
								/>
							</ActivityPanel>
							<ActivityPanel icon={UploadCloud} title="Archivos subidos">
								<ActivityList
									empty="Todavia no se subieron archivos desde WhatsApp."
									items={uploads.map((upload) => ({
										id: upload.id,
										title: upload.file_name ?? "Archivo sin nombre",
										description: upload.folder_path ?? upload.storage_path ?? "Sin carpeta",
										meta: `${formatBytes(upload.uploaded_bytes)} · ${statusLabel(upload.status)}`,
										status: upload.status,
									}))}
								/>
							</ActivityPanel>
							<ActivityPanel icon={FileText} title="Datos manuales">
								<SubmissionList
									submissions={submissions}
									tenantId={activeTenantId}
								/>
							</ActivityPanel>
						</section>
					</div>
				</section>
			)}

			{activeTab === "contactos" && (
				<ConfigPanel
					icon={UserPlus}
					title="Contactos autorizados"
					description="Define quien puede subir archivos, responder formularios o consultar datos desde WhatsApp."
				>
					<form action={createContactAction} className="grid gap-3">
						<input type="hidden" name="tenantId" value={activeTenantId} />
						<div className="grid gap-3 md:grid-cols-2">
							<Field name="displayName" label="Nombre" placeholder="Ej. Jefe de obra" />
							<Field name="phone" label="Telefono" placeholder="+549379..." />
							<Select
								name="status"
								label="Estado"
								defaultValue="active"
								options={[
									["active", "Activo"],
									["pending", "Pendiente"],
									["blocked", "Bloqueado"],
								]}
							/>
							<Field
								name="allowedObraIds"
								label="Obras permitidas"
								placeholder="Vacio = todas. UUIDs separados por coma."
							/>
						</div>
						<div className="grid gap-2 rounded-md border bg-foreground/[0.02] p-3 sm:grid-cols-3">
							<Checkbox name="canUploadDocuments" label="Subir archivos" defaultChecked />
							<Checkbox name="canSubmitForms" label="Responder formularios" defaultChecked />
							<Checkbox name="canQueryData" label="Consultar datos" />
						</div>
						<Field name="notes" label="Notas internas" placeholder="Contexto operativo, obra habitual, restricciones." />
						<div>
							<Button type="submit" size="sm">
								Agregar contacto
							</Button>
						</div>
					</form>
					<ContactTable contacts={contacts} assignments={assignments} />
				</ConfigPanel>
			)}

			{activeTab === "templates" && (
				<section className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
					<ConfigPanel
						icon={Tags}
						title="Templates y documentos"
						description="Vincula el template aprobado en Meta con un template real de /document-generation y un destino permitido."
					>
						<div className="grid gap-3 md:grid-cols-3">
							<MiniStat label="Registradas" value={templates.length} />
							<MiniStat label="Aprobadas" value={approvedTemplates} />
							<MiniStat label="Documentos disponibles" value={documentTemplates.length} />
						</div>
						<form action={createTemplateAction} className="grid gap-3">
							<input type="hidden" name="tenantId" value={activeTenantId} />
							<div className="grid gap-3 lg:grid-cols-3">
								<Field name="name" label="Nombre tecnico" placeholder="factura_recordatorio_lunes" />
								<Field name="displayName" label="Nombre visible" placeholder="Recordatorio facturas" />
								<Select
									name="category"
									label="Categoria Meta"
									defaultValue="utility"
									options={[
										["utility", "Utility"],
										["marketing", "Marketing"],
										["authentication", "Authentication"],
										["service", "Service"],
									]}
								/>
								<Select
									name="status"
									label="Estado"
									defaultValue="draft"
									options={[
										["draft", "Borrador"],
										["pending", "Pendiente Meta"],
										["approved", "Aprobada"],
										["rejected", "Rechazada"],
										["paused", "Pausada"],
										["disabled", "Deshabilitada"],
									]}
								/>
								<Field name="language" label="Idioma" defaultValue="es_AR" />
								<Field name="metaTemplateId" label="Meta Template ID" placeholder="Opcional" />
								<DocumentTemplateSelect documentTemplates={documentTemplates} />
								<Select
									name="resultMode"
									label="Resultado"
									defaultValue="manual_submission"
									options={resultModeOptions()}
								/>
								<Field name="targetFolderPath" label="Carpeta destino" placeholder="Se puede inferir del template" />
								<Field name="documentType" label="Tipo documento" placeholder="Opcional" />
								<Field name="triggerPurpose" label="Uso" placeholder="Recordatorio semanal de facturas" />
								<Field name="variables" label="Variables Meta" placeholder="obra, fecha, formulario" />
							</div>
							<label className="space-y-1 text-sm">
								<span className="font-medium">Texto del mensaje</span>
								<textarea
									name="body"
									rows={3}
									placeholder="Hola {{1}}, carga el avance de facturas de {{2}}."
									className="w-full rounded-md border bg-background px-3 py-2 text-sm"
								/>
							</label>
							<label className="space-y-1 text-sm">
								<span className="font-medium">Mapping de campos JSON</span>
								<textarea
									name="fieldMapping"
									rows={3}
									placeholder='{"fecha":"invoice_date","monto":"amount","tipo":"invoice_type"}'
									className="w-full rounded-md border bg-background px-3 py-2 font-mono text-xs"
								/>
							</label>
							<div>
								<Button type="submit" size="sm">
									Guardar template
								</Button>
							</div>
						</form>
						<TemplateTable templates={templates} documentTemplates={documentTemplates} />
					</ConfigPanel>

					<ConfigPanel
						icon={FormInput}
						title="Formularios manuales"
						description="Mantiene los formularios actuales para cargar datos sin documento."
					>
						<form action={createManualFormAction} className="grid gap-3">
							<input type="hidden" name="tenantId" value={activeTenantId} />
							<div className="grid gap-3">
								<Field name="name" label="Nombre del formulario" placeholder="Factura semanal" />
								<label className="space-y-1 text-sm">
									<span className="font-medium">Tabla destino</span>
									<select name="tablaId" className="h-9 w-full rounded-md border bg-background px-3 text-sm">
										{tablas.map((tabla) => (
											<option key={tabla.id} value={tabla.id}>
												{tablaLabel(tabla)}
											</option>
										))}
									</select>
								</label>
								<Field name="folderPath" label="Carpeta asociada" placeholder="Opcional, se puede inferir" />
								<Select
									name="triggerMode"
									label="Modo"
									defaultValue="both"
									options={[
										["on_demand", "A pedido"],
										["scheduled", "Recurrente"],
										["both", "A pedido y recurrente"],
									]}
								/>
								<Select
									name="status"
									label="Estado"
									defaultValue="draft"
									options={[
										["draft", "Borrador"],
										["active", "Activo"],
										["paused", "Pausado"],
										["archived", "Archivado"],
									]}
								/>
								<Field name="weekday" label="Dia recurrente" placeholder="monday" />
								<Field name="time" label="Hora" placeholder="09:00" />
								<Field name="templateName" label="Template WhatsApp" placeholder="Opcional" />
								<Field name="whatsappFlowId" label="WhatsApp Flow ID" placeholder="Opcional" />
							</div>
							<Field name="description" label="Descripcion" placeholder="Que se le pide al usuario y cuando se revisa." />
							<div>
								<Button type="submit" size="sm">
									Crear formulario
								</Button>
							</div>
						</form>
						<FormTable forms={forms} />
					</ConfigPanel>
				</section>
			)}

			{activeTab === "flows" && (
				<section className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
					<ConfigPanel
						icon={SlidersHorizontal}
						title="Editor de WhatsApp Flows"
						description="Crea flows editables en Sintesis. Los activos aparecen cuando un contacto autorizado manda hola al bot."
					>
						<form action={createFlowAction} className="grid gap-3">
							<input type="hidden" name="tenantId" value={activeTenantId} />
							<div className="grid gap-3 lg:grid-cols-3">
								<Field name="name" label="Nombre" placeholder="Confirmar orden de compra" />
								<Field name="slug" label="Slug" placeholder="confirmar_oc" />
								<Select
									name="flowType"
									label="Tipo"
									defaultValue="boolean_checklist"
									options={[
										["boolean_checklist", "Checklist booleano"],
										["data_entry", "Carga de datos"],
										["review", "Revision"],
										["selection", "Seleccion"],
										["upload_request", "Pedido archivo"],
									]}
								/>
								<Select
									name="status"
									label="Estado"
									defaultValue="active"
									options={[
										["draft", "Borrador"],
										["active", "Activo"],
										["paused", "Pausado"],
										["archived", "Archivado"],
									]}
								/>
								<Field name="metaFlowId" label="Meta Flow ID" placeholder="Opcional para Flow nativo" />
								<Field name="description" label="Descripcion" placeholder="Se muestra en el menu de prueba" />
							</div>
							<label className="space-y-1 text-sm">
								<span className="font-medium">Definicion JSON</span>
								<textarea
									name="definition"
									rows={12}
									defaultValue={defaultFlowDefinition()}
									className="w-full rounded-md border bg-background px-3 py-2 font-mono text-xs"
								/>
							</label>
							<label className="space-y-1 text-sm">
								<span className="font-medium">Settings JSON</span>
								<textarea
									name="settings"
									rows={4}
									defaultValue={'{"showInTestMenu":true}'}
									className="w-full rounded-md border bg-background px-3 py-2 font-mono text-xs"
								/>
							</label>
							<div>
								<Button type="submit" size="sm">
									Guardar flow
								</Button>
							</div>
						</form>
					</ConfigPanel>

					<ActivityPanel icon={SlidersHorizontal} title="Flows activos y pruebas">
						<div className="grid grid-cols-3 gap-2 text-sm">
							<MiniStat label="Flows" value={flows.length} />
							<MiniStat label="Activos" value={activeFlows} />
							<MiniStat label="Menu hola" value={Math.min(activeFlows, 3)} />
						</div>
						<form action={createStarterFlowsAction}>
							<input type="hidden" name="tenantId" value={activeTenantId} />
							<Button type="submit" size="sm" variant="outline">
								Crear 3 flows de prueba
							</Button>
						</form>
						<FlowTable flows={flows} />
					</ActivityPanel>
				</section>
			)}

			{activeTab === "asignaciones" && (
				<ConfigPanel
					icon={CalendarDays}
					title="Asignaciones recurrentes"
					description="Define a que contacto se le manda que template, con que frecuencia, y a que obra/carpeta va el resultado."
				>
					<form action={createRecurringAssignmentAction} className="grid gap-3">
						<input type="hidden" name="tenantId" value={activeTenantId} />
						<div className="grid gap-3 lg:grid-cols-4">
							<OptionSelect name="contactId" label="Contacto" options={contacts.map((contact) => [contact.id, contactLabel(contact)])} />
							<OptionSelect name="whatsappTemplateId" label="Template" options={templates.map((template) => [template.id, template.display_name ?? template.name])} />
							<OptionSelect name="obraId" label="Obra destino" options={obras.map((obra) => [obra.id, obraLabel(obra)])} />
							<DocumentTemplateSelect documentTemplates={documentTemplates} />
							<Field name="folderPath" label="Carpeta destino" placeholder="Opcional, hereda del template" />
							<Select name="resultMode" label="Resultado" defaultValue="manual_submission" options={resultModeOptions()} />
							<Select
								name="frequency"
								label="Frecuencia"
								defaultValue="weekly"
								options={[
									["once", "Una vez"],
									["daily", "Diaria"],
									["weekly", "Semanal"],
									["monthly", "Mensual"],
								]}
							/>
							<Field name="weekday" label="Dia semana" placeholder="monday" />
							<Field name="dayOfMonth" label="Dia mes" placeholder="1-31" />
							<Field name="timeOfDay" label="Hora" placeholder="09:00" />
							<Field name="timezone" label="Zona horaria" defaultValue="America/Argentina/Buenos_Aires" />
							<Select
								name="status"
								label="Estado"
								defaultValue="active"
								options={[
									["active", "Activo"],
									["paused", "Pausado"],
									["archived", "Archivado"],
								]}
							/>
						</div>
						<div>
							<Button type="submit" size="sm">
								Crear asignacion
							</Button>
						</div>
					</form>
					<AssignmentTable
						assignments={assignments}
						contacts={contacts}
						templates={templates}
						documentTemplates={documentTemplates}
						obras={obras}
					/>
				</ConfigPanel>
			)}

			{activeTab === "uso" && (
				<ConfigPanel
					icon={BarChart3}
					title="Uso y limites"
					description="Presupuesto recomendado para mantener el costo mensual cerca de USD 20 por tenant."
				>
					<form action={updateUsagePolicyAction} className="grid gap-4">
						<input type="hidden" name="tenantId" value={activeTenantId} />
						<div className="grid gap-3 md:grid-cols-3">
							<Field
								name="monthlyBudgetUsd"
								label="Presupuesto USD"
								defaultValue={String(Math.round((usagePolicy.monthly_budget_cents ?? 2000) / 100))}
							/>
							<Field name="utilityTemplatesLimit" label="Templates utility" defaultValue={String(usagePolicy.utility_templates_limit ?? 400)} />
							<Field name="marketingTemplatesLimit" label="Templates marketing" defaultValue={String(usagePolicy.marketing_templates_limit ?? 0)} />
							<Field name="authenticationTemplatesLimit" label="Templates auth" defaultValue={String(usagePolicy.authentication_templates_limit ?? 0)} />
							<Field
								name="serviceMessagesLimit"
								label="Mensajes service"
								placeholder="Vacio = sin limite"
								defaultValue={usagePolicy.service_messages_limit == null ? "" : String(usagePolicy.service_messages_limit)}
							/>
							<Field name="fileUploadsLimit" label="Archivos" defaultValue={String(usagePolicy.file_uploads_limit ?? 300)} />
							<Field name="storageGbLimit" label="Storage GB" defaultValue={formatGbInput(usagePolicy.storage_bytes_limit)} />
							<Field name="dataQueriesLimit" label="Consultas datos" defaultValue={String(usagePolicy.data_queries_limit ?? 300)} />
							<Field name="manualSubmissionsLimit" label="Formularios" defaultValue={String(usagePolicy.manual_submissions_limit ?? 300)} />
							<Field name="recurringContactsLimit" label="Contactos recurrentes" defaultValue={String(usagePolicy.recurring_contacts_limit ?? 25)} />
							<Field
								name="recurringRemindersPerContactPerWeek"
								label="Recordatorios/semana"
								defaultValue={String(usagePolicy.recurring_reminders_per_contact_per_week ?? 1)}
							/>
						</div>
						<div>
							<Button type="submit" size="sm">
								Guardar limites
							</Button>
						</div>
					</form>
					<div className="grid gap-3 md:grid-cols-2">
						<LimitBar
							label="Templates pagos"
							value={monthlyOutboundMessages}
							limit={(usagePolicy.utility_templates_limit ?? 0) + (usagePolicy.marketing_templates_limit ?? 0) + (usagePolicy.authentication_templates_limit ?? 0)}
							helper="Cuenta operativa para mensajes iniciados por la empresa."
						/>
						<LimitBar label="Archivos" value={monthlyUploads.length} limit={usagePolicy.file_uploads_limit ?? 300} />
						<LimitBar label="Storage WhatsApp" value={monthlyUploadBytes} limit={usagePolicy.storage_bytes_limit ?? 0} format={formatBytes} />
						<LimitBar label="Formularios manuales" value={monthlySubmissions.length} limit={usagePolicy.manual_submissions_limit ?? 300} />
						<LimitBar label="Contactos recurrentes" value={activeAssignments} limit={usagePolicy.recurring_contacts_limit ?? 25} />
						<LimitBar label="Consultas datos" value={0} limit={usagePolicy.data_queries_limit ?? 300} />
					</div>
				</ConfigPanel>
			)}

			{activeTab === "configuracion" && (
				<section className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
					<ConfigPanel
						icon={Phone}
						title="Cuenta WhatsApp Business"
						description="Guarda los IDs de Meta. Los campos tecnicos quedan juntos para que no contaminen el flujo diario."
					>
						<form action={createBusinessAccountAction} className="grid gap-3">
							<input type="hidden" name="tenantId" value={activeTenantId} />
							<div className="grid gap-3 sm:grid-cols-2">
								<Field name="displayPhoneNumber" label="Numero visible" placeholder="+54 9 379 569 6575" defaultValue={primaryAccount?.display_phone_number ?? ""} />
								<Select
									name="status"
									label="Estado"
									defaultValue={primaryAccount?.status ?? "draft"}
									options={[
										["draft", "Borrador"],
										["active", "Activo"],
										["paused", "Pausado"],
										["disabled", "Deshabilitado"],
									]}
								/>
								<Field name="phoneNumberId" label="Phone Number ID" defaultValue={primaryAccount?.phone_number_id ?? ""} />
								<Field name="businessAccountId" label="WABA ID" defaultValue={primaryAccount?.business_account_id ?? ""} />
								<Select
									name="provider"
									label="Proveedor"
									defaultValue={primaryAccount?.provider ?? "meta_cloud"}
									options={[
										["meta_cloud", "Meta Cloud API"],
										["twilio", "Twilio"],
										["360dialog", "360Dialog"],
									]}
								/>
							</div>
							<div>
								<Button type="submit" size="sm">
									Guardar cuenta
								</Button>
							</div>
						</form>
						<EntityList
							empty="Todavia no hay cuentas guardadas."
							items={accounts.map((account) => ({
								id: account.id,
								title: account.display_phone_number ?? account.phone_number_id,
								description: `${providerLabel(account.provider)} · ${account.phone_number_id}`,
								meta: statusLabel(account.status),
							}))}
						/>
					</ConfigPanel>

					<section className="rounded-md border bg-card">
						<div className="grid gap-0 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
							<div className="space-y-4 p-5">
								<SectionHeader
									icon={SlidersHorizontal}
									title="Estado del canal"
									description="Checklist minimo para operar con el bot en produccion."
								/>
								<div className="grid gap-3 sm:grid-cols-2">
									<ReadinessItem done={Boolean(primaryAccount)} title="Cuenta de Meta registrada" description={primaryAccount?.phone_number_id ?? "Falta guardar Phone Number ID."} />
									<ReadinessItem done={hasWebhook} title="Webhook verificable" description="El endpoint responde el challenge de Meta." />
									<ReadinessItem done={hasToken} title="Token de envio" description="Necesario para responder mensajes y descargar archivos." />
									<ReadinessItem done={hasAppSecret} title="Firma de webhook" description="Recomendado antes de produccion." />
									<ReadinessItem done={activeContacts.length > 0} title="Contactos autorizados" description={`${activeContacts.length} contactos con permisos.`} />
									<ReadinessItem done={templates.length > 0} title="Templates cargados" description={`${templates.length} templates locales registrados.`} />
								</div>
							</div>
							<div className="border-t bg-foreground/[0.02] p-5 lg:border-l lg:border-t-0">
								<SectionHeader
									icon={AlertTriangle}
									title="Pendientes tecnicos"
									description="Lo que todavia requiere integracion fuera de la UI."
								/>
								<ol className="mt-4 space-y-3 text-sm">
									<StepItem done={false} text="Sincronizar/crear templates reales en Meta y guardar su nombre aprobado." />
									<StepItem done={true} text="Endpoint recurrente disponible: /api/whatsapp/recurring/dispatch con x-cron-secret." />
									<StepItem done={true} text="El webhook registra acciones operativas en whatsapp_chat_actions para uploads y formularios." />
								</ol>
							</div>
						</div>
					</section>
				</section>
			)}
		</div>
	);
}

function TabNav({ activeTab, tenantId }: { activeTab: AdminTab; tenantId?: string }) {
	return (
		<nav className="flex flex-wrap gap-2 rounded-md border bg-card p-2">
			{tabs.map((tab) => {
				const Icon = tab.icon;
				const query = new URLSearchParams({ tab: tab.key });
				if (tenantId) query.set("tenantId", tenantId);
				return (
					<Link
						key={tab.key}
						href={`/admin/whatsapp?${query.toString()}`}
						className={cn(
							"inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium text-foreground/65 transition",
							activeTab === tab.key
								? "bg-foreground text-background"
								: "hover:bg-foreground/[0.06] hover:text-foreground",
						)}
					>
						<Icon className="size-4" />
						{tab.label}
					</Link>
				);
			})}
		</nav>
	);
}

function Metric({
	icon: Icon,
	label,
	value,
}: {
	icon: React.ComponentType<{ className?: string }>;
	label: string;
	value: React.ReactNode;
}) {
	return (
		<div className="rounded-md border bg-card p-4">
			<div className="flex items-center gap-2 text-xs font-medium uppercase text-foreground/55">
				<Icon className="size-4" />
				{label}
			</div>
			<p className="mt-2 text-2xl font-semibold">{value}</p>
		</div>
	);
}

function ConfigPanel({
	icon,
	title,
	description,
	children,
}: {
	icon: React.ComponentType<{ className?: string }>;
	title: string;
	description: string;
	children: React.ReactNode;
}) {
	return (
		<section className="space-y-5 rounded-md border bg-card p-5">
			<SectionHeader icon={icon} title={title} description={description} />
			{children}
		</section>
	);
}

function ActivityPanel({
	icon,
	title,
	children,
}: {
	icon: React.ComponentType<{ className?: string }>;
	title: string;
	children: React.ReactNode;
}) {
	return (
		<section className="space-y-4 rounded-md border bg-card p-4">
			<SectionHeader icon={icon} title={title} />
			{children}
		</section>
	);
}

function SectionHeader({
	icon: Icon,
	title,
	description,
}: {
	icon: React.ComponentType<{ className?: string }>;
	title: string;
	description?: string;
}) {
	return (
		<div className="flex items-start gap-3">
			<div className="mt-0.5 flex size-8 items-center justify-center rounded-md border bg-background">
				<Icon className="size-4 text-foreground/70" />
			</div>
			<div>
				<h2 className="text-base font-semibold">{title}</h2>
				{description && <p className="mt-1 text-sm text-foreground/65">{description}</p>}
			</div>
		</div>
	);
}

function ReadinessItem({
	done,
	title,
	description,
}: {
	done: boolean;
	title: string;
	description: string;
}) {
	return (
		<div className="rounded-md border bg-background p-3">
			<div className="flex items-center gap-2">
				{done ? <CheckCircle2 className="size-4 text-green-700" /> : <Clock3 className="size-4 text-amber-700" />}
				<p className="text-sm font-medium">{title}</p>
			</div>
			<p className="mt-1 text-xs text-foreground/60">{description}</p>
		</div>
	);
}

function StepItem({ done, text }: { done: boolean; text: string }) {
	return (
		<li className="flex items-start gap-2">
			{done ? <CheckCircle2 className="mt-0.5 size-4 text-green-700" /> : <Clock3 className="mt-0.5 size-4 text-amber-700" />}
			<span>{text}</span>
		</li>
	);
}

function Field({
	name,
	label,
	placeholder,
	defaultValue,
}: {
	name: string;
	label: string;
	placeholder?: string;
	defaultValue?: string;
}) {
	return (
		<label className="space-y-1 text-sm">
			<span className="font-medium">{label}</span>
			<input
				name={name}
				placeholder={placeholder}
				defaultValue={defaultValue}
				className="h-9 w-full rounded-md border bg-background px-3 text-sm"
			/>
		</label>
	);
}

function Select({
	name,
	label,
	options,
	defaultValue,
}: {
	name: string;
	label: string;
	options: [string, string][];
	defaultValue?: string;
}) {
	return (
		<label className="space-y-1 text-sm">
			<span className="font-medium">{label}</span>
			<select name={name} defaultValue={defaultValue} className="h-9 w-full rounded-md border bg-background px-3 text-sm">
				{options.map(([value, labelText]) => (
					<option key={value} value={value}>
						{labelText}
					</option>
				))}
			</select>
		</label>
	);
}

function OptionSelect({
	name,
	label,
	options,
}: {
	name: string;
	label: string;
	options: [string, string][];
}) {
	return (
		<label className="space-y-1 text-sm">
			<span className="font-medium">{label}</span>
			<select name={name} className="h-9 w-full rounded-md border bg-background px-3 text-sm">
				<option value="">Seleccionar</option>
				{options.map(([value, labelText]) => (
					<option key={value} value={value}>
						{labelText}
					</option>
				))}
			</select>
		</label>
	);
}

function DocumentTemplateSelect({ documentTemplates }: { documentTemplates: DocumentTemplate[] }) {
	return (
		<label className="space-y-1 text-sm">
			<span className="font-medium">Template documento</span>
			<select name="documentGenerationTemplateId" className="h-9 w-full rounded-md border bg-background px-3 text-sm">
				<option value="">Sin documento</option>
				{documentTemplates.map((template) => (
					<option key={template.id} value={template.id}>
						{template.name} · {template.document_type}
						{template.target_folder_path ? ` · ${template.target_folder_path}` : ""}
					</option>
				))}
			</select>
		</label>
	);
}

function Checkbox({
	name,
	label,
	defaultChecked,
}: {
	name: string;
	label: string;
	defaultChecked?: boolean;
}) {
	return (
		<label className="inline-flex items-center gap-2 text-sm">
			<input name={name} type="checkbox" defaultChecked={defaultChecked} className="size-4 rounded border" />
			<span>{label}</span>
		</label>
	);
}

function ContactTable({ contacts, assignments }: { contacts: Contact[]; assignments: Assignment[] }) {
	if (contacts.length === 0) {
		return (
			<div className="rounded-md border border-dashed p-4 text-sm text-foreground/60">
				Agrega el primer contacto autorizado para poder operar desde WhatsApp.
			</div>
		);
	}
	return (
		<div className="overflow-hidden rounded-md border">
			<table className="w-full text-sm">
				<thead className="bg-foreground/5 text-left">
					<tr>
						<th className="px-3 py-2 font-medium">Contacto</th>
						<th className="px-3 py-2 font-medium">Permisos</th>
						<th className="px-3 py-2 font-medium">Asignaciones</th>
						<th className="px-3 py-2 font-medium">Alcance</th>
					</tr>
				</thead>
				<tbody>
					{contacts.map((contact) => {
						const contactAssignments = assignments.filter((assignment) => assignment.contact_id === contact.id);
						return (
							<tr key={contact.id} className="border-t">
								<td className="px-3 py-3">
									<p className="font-medium">{contact.display_name ?? contact.phone_e164}</p>
									<p className="text-xs text-foreground/60">{contact.phone_e164}</p>
								</td>
								<td className="px-3 py-3">
									<div className="flex flex-wrap gap-1">
										{contact.can_upload_documents && <SmallPill>Archivos</SmallPill>}
										{contact.can_submit_forms && <SmallPill>Formularios</SmallPill>}
										{contact.can_query_data && <SmallPill>Consultas</SmallPill>}
										{!contact.can_upload_documents && !contact.can_submit_forms && !contact.can_query_data && (
											<span className="text-xs text-foreground/50">Sin permisos</span>
										)}
									</div>
								</td>
								<td className="px-3 py-3 text-foreground/65">{contactAssignments.length}</td>
								<td className="px-3 py-3">
									<div className="flex items-center gap-2">
										<StatusBadge status={contact.status} />
										<span className="text-xs text-foreground/60">
											{contact.allowed_obra_ids?.length ? `${contact.allowed_obra_ids.length} obras` : "Todas las obras"}
										</span>
									</div>
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}

function TemplateTable({
	templates,
	documentTemplates,
}: {
	templates: Template[];
	documentTemplates: DocumentTemplate[];
}) {
	if (templates.length === 0) {
		return (
			<div className="rounded-md border border-dashed p-4 text-sm text-foreground/60">
				Todavia no hay plantillas registradas. Agrega las que vayas a crear o ya tengas aprobadas en Meta.
			</div>
		);
	}
	const docById = new Map(documentTemplates.map((template) => [template.id, template]));
	return (
		<div className="overflow-hidden rounded-md border">
			<table className="w-full text-sm">
				<thead className="bg-foreground/5 text-left">
					<tr>
						<th className="px-3 py-2 font-medium">Plantilla</th>
						<th className="px-3 py-2 font-medium">Documento</th>
						<th className="px-3 py-2 font-medium">Destino</th>
						<th className="px-3 py-2 font-medium">Estado</th>
					</tr>
				</thead>
				<tbody>
					{templates.map((template) => {
						const documentTemplate = template.document_generation_template_id
							? docById.get(template.document_generation_template_id)
							: null;
						return (
							<tr key={template.id} className="border-t">
								<td className="px-3 py-3">
									<p className="font-medium">{template.display_name ?? template.name}</p>
									<p className="text-xs text-foreground/60">
										{template.name} · {templateCategoryLabel(template.category)} · {template.language ?? "es_AR"}
									</p>
								</td>
								<td className="px-3 py-3">
									<p className="text-sm">{documentTemplate?.name ?? "Sin documento"}</p>
									<p className="text-xs text-foreground/60">{template.document_type ?? documentTemplate?.document_type ?? "Sin tipo"}</p>
								</td>
								<td className="px-3 py-3 text-foreground/65">
									<p>{resultModeLabel(template.result_mode)}</p>
									<p className="text-xs">{template.target_folder_path ?? documentTemplate?.target_folder_path ?? "Sin carpeta fija"}</p>
								</td>
								<td className="px-3 py-3">
									<StatusBadge status={template.status} />
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}

function AssignmentTable({
	assignments,
	contacts,
	templates,
	documentTemplates,
	obras,
}: {
	assignments: Assignment[];
	contacts: Contact[];
	templates: Template[];
	documentTemplates: DocumentTemplate[];
	obras: ObraOption[];
}) {
	if (assignments.length === 0) {
		return (
			<div className="rounded-md border border-dashed p-4 text-sm text-foreground/60">
				Todavia no hay asignaciones. Crea una para enviar templates recurrentes a un contacto.
			</div>
		);
	}
	const contactById = new Map(contacts.map((contact) => [contact.id, contact]));
	const templateById = new Map(templates.map((template) => [template.id, template]));
	const documentTemplateById = new Map(documentTemplates.map((template) => [template.id, template]));
	const obraById = new Map(obras.map((obra) => [obra.id, obra]));
	return (
		<div className="overflow-hidden rounded-md border">
			<table className="w-full text-sm">
				<thead className="bg-foreground/5 text-left">
					<tr>
						<th className="px-3 py-2 font-medium">Contacto</th>
						<th className="px-3 py-2 font-medium">Template</th>
						<th className="px-3 py-2 font-medium">Destino</th>
						<th className="px-3 py-2 font-medium">Frecuencia</th>
						<th className="px-3 py-2 font-medium">Estado</th>
					</tr>
				</thead>
				<tbody>
					{assignments.map((assignment) => {
						const contact = contactById.get(assignment.contact_id);
						const template = templateById.get(assignment.whatsapp_template_id);
						const documentTemplate = assignment.document_generation_template_id
							? documentTemplateById.get(assignment.document_generation_template_id)
							: null;
						const obra = obraById.get(assignment.obra_id);
						return (
							<tr key={assignment.id} className="border-t">
								<td className="px-3 py-3">
									<p className="font-medium">{contact ? contactLabel(contact) : "Contacto eliminado"}</p>
								</td>
								<td className="px-3 py-3">
									<p className="font-medium">{template?.display_name ?? template?.name ?? "Template eliminado"}</p>
									<p className="text-xs text-foreground/60">{documentTemplate?.name ?? resultModeLabel(assignment.result_mode)}</p>
								</td>
								<td className="px-3 py-3">
									<p>{obra ? obraLabel(obra) : "Obra eliminada"}</p>
									<p className="text-xs text-foreground/60">{assignment.folder_path ?? documentTemplate?.target_folder_path ?? "Sin carpeta fija"}</p>
								</td>
								<td className="px-3 py-3">
									<p>{scheduleLabel(assignment)}</p>
									<p className="text-xs text-foreground/60">Ultimo: {formatDate(assignment.last_run_at)}</p>
								</td>
								<td className="px-3 py-3"><StatusBadge status={assignment.status} /></td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}

function ChatThreadList({ threads }: { threads: ChatThread[] }) {
	if (threads.length === 0) {
		return (
			<div className="rounded-md border border-dashed p-4 text-sm text-foreground/60">
				Todavia no hay chats registrados.
			</div>
		);
	}
	return (
		<ul className="space-y-2">
			{threads.map((thread) => (
				<li key={thread.id} className="rounded-md border bg-background p-3 text-sm">
					<div className="flex items-start justify-between gap-3">
						<div>
							<p className="font-medium">{thread.title}</p>
							<p className="text-xs text-foreground/60">{thread.phone}</p>
						</div>
						<StatusBadge status={thread.lastAction?.status ?? thread.lastStatus} />
					</div>
					<p className="mt-2 line-clamp-2 text-xs text-foreground/70">{thread.lastMessage}</p>
					<p className="mt-2 text-xs text-foreground/50">
						{thread.count} mensajes · {thread.actionCount} acciones · {formatDate(thread.lastAt)}
					</p>
				</li>
			))}
		</ul>
	);
}

function ChatActionList({
	actions,
	contacts,
	templates,
	documentTemplates,
	obras,
}: {
	actions: ChatAction[];
	contacts: Contact[];
	templates: Template[];
	documentTemplates: DocumentTemplate[];
	obras: ObraOption[];
}) {
	if (actions.length === 0) {
		return (
			<div className="rounded-md border border-dashed p-4 text-sm text-foreground/60">
				Todavia no hay acciones registradas. El siguiente paso es escribir desde el webhook cada pedido y resultado del bot.
			</div>
		);
	}
	const contactById = new Map(contacts.map((contact) => [contact.id, contact]));
	const templateById = new Map(templates.map((template) => [template.id, template]));
	const documentTemplateById = new Map(documentTemplates.map((template) => [template.id, template]));
	const obraById = new Map(obras.map((obra) => [obra.id, obra]));
	return (
		<ul className="space-y-2">
			{actions.map((action) => {
				const contact = action.contact_id ? contactById.get(action.contact_id) : null;
				const template = action.whatsapp_template_id ? templateById.get(action.whatsapp_template_id) : null;
				const documentTemplate = action.document_generation_template_id ? documentTemplateById.get(action.document_generation_template_id) : null;
				const obra = action.obra_id ? obraById.get(action.obra_id) : null;
				return (
					<li key={action.id} className="rounded-md border bg-background p-3 text-sm">
						<div className="flex flex-wrap items-start justify-between gap-3">
							<div>
								<p className="font-medium">{actionTypeLabel(action.action_type)} · {contact ? contactLabel(contact) : "Contacto no vinculado"}</p>
								<p className="mt-1 text-xs text-foreground/60">
									{obra ? obraLabel(obra) : "Sin obra"} · {action.folder_path ?? "Sin carpeta"} · {formatDate(action.created_at)}
								</p>
							</div>
							<StatusBadge status={action.status} />
						</div>
						<p className="mt-2 text-sm text-foreground/75">
							{action.result_summary ?? action.error_message ?? action.user_prompt ?? "Sin resumen todavia"}
						</p>
						<div className="mt-2 flex flex-wrap gap-1">
							{template && <SmallPill>{template.display_name ?? template.name}</SmallPill>}
							{documentTemplate && <SmallPill>{documentTemplate.name}</SmallPill>}
						</div>
					</li>
				);
			})}
		</ul>
	);
}

function FormTable({ forms }: { forms: WhatsAppForm[] }) {
	if (forms.length === 0) {
		return (
			<div className="rounded-md border border-dashed p-4 text-sm text-foreground/60">
				No hay formularios todavia. Crea uno para que el bot pueda pedir datos estructurados por chat.
			</div>
		);
	}
	return (
		<div className="overflow-hidden rounded-md border">
			<table className="w-full text-sm">
				<thead className="bg-foreground/5 text-left">
					<tr>
						<th className="px-3 py-2 font-medium">Formulario</th>
						<th className="px-3 py-2 font-medium">Disparo</th>
						<th className="px-3 py-2 font-medium">Destino</th>
						<th className="px-3 py-2 font-medium">Estado</th>
					</tr>
				</thead>
				<tbody>
					{forms.map((form) => (
						<tr key={form.id} className="border-t">
							<td className="px-3 py-3">
								<p className="font-medium">{form.name}</p>
								<p className="text-xs text-foreground/60">{form.template_name ?? form.whatsapp_flow_id ?? "Sin template asociado"}</p>
							</td>
							<td className="px-3 py-3">{triggerLabel(form.trigger_mode)}</td>
							<td className="px-3 py-3 text-foreground/65">{form.folder_path ?? "Se infiere desde tabla"}</td>
							<td className="px-3 py-3"><StatusBadge status={form.status} /></td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

function FlowTable({ flows }: { flows: WhatsAppFlow[] }) {
	if (flows.length === 0) {
		return (
			<div className="rounded-md border border-dashed p-4 text-sm text-foreground/60">
				No hay flows todavia. Crea hasta tres activos para que aparezcan en el menu de prueba cuando un contacto mande hola.
			</div>
		);
	}
	return (
		<div className="overflow-hidden rounded-md border">
			<table className="w-full text-sm">
				<thead className="bg-foreground/5 text-left">
					<tr>
						<th className="px-3 py-2 font-medium">Flow</th>
						<th className="px-3 py-2 font-medium">Tipo</th>
						<th className="px-3 py-2 font-medium">Campos</th>
						<th className="px-3 py-2 font-medium">Estado</th>
					</tr>
				</thead>
				<tbody>
					{flows.map((flow) => (
						<tr key={flow.id} className="border-t align-top">
							<td className="px-3 py-3">
								<p className="font-medium">{flow.name}</p>
								<p className="text-xs text-foreground/60">{flow.slug}</p>
								{flow.meta_flow_id && <p className="mt-1 text-xs text-foreground/60">Meta: {flow.meta_flow_id}</p>}
							</td>
							<td className="px-3 py-3">{flowTypeLabel(flow.flow_type)}</td>
							<td className="px-3 py-3 text-foreground/65">{flowFieldSummary(flow.definition)}</td>
							<td className="px-3 py-3"><StatusBadge status={flow.status} /></td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

function SubmissionList({ submissions, tenantId }: { submissions: Submission[]; tenantId: string }) {
	if (submissions.length === 0) {
		return (
			<div className="rounded-md border border-dashed p-4 text-sm text-foreground/60">
				Todavia no hay respuestas manuales.
			</div>
		);
	}
	return (
		<ul className="space-y-2">
			{submissions.map((submission) => (
				<li key={submission.id} className="space-y-3 rounded-md border bg-background p-3 text-sm">
					<div className="flex items-start justify-between gap-3">
						<div>
							<p className="font-medium">{statusLabel(submission.status)}</p>
							<p className="text-xs text-foreground/60">{formatDate(submission.created_at)}</p>
						</div>
						<StatusBadge status={submission.status} />
					</div>
					<pre className="max-h-28 overflow-auto rounded-md bg-foreground/[0.04] p-2 text-xs">
						{JSON.stringify(submission.parsed_values ?? {}, null, 2)}
					</pre>
					{submission.status !== "applied" && (
						<form action={applySubmissionAction}>
							<input type="hidden" name="tenantId" value={tenantId} />
							<input type="hidden" name="submissionId" value={submission.id} />
							<Button type="submit" size="xs" variant="outline">
								Validar y aplicar fila
							</Button>
						</form>
					)}
				</li>
			))}
		</ul>
	);
}

function defaultFlowDefinition() {
	return JSON.stringify(
		{
			fields: [
				{ key: "item_1_received", label: "Item 1 recibido", type: "boolean", required: true },
				{ key: "item_2_received", label: "Item 2 recibido", type: "boolean", required: true },
				{ key: "comment", label: "Comentario si algo no llego", type: "textarea", required: false },
			],
		},
		null,
		2,
	);
}

function flowFieldSummary(definition: unknown) {
	const fields = extractFlowFields(definition);
	if (fields.length === 0) return "Sin campos";
	return fields
		.slice(0, 4)
		.map((field) => `${field.label} (${field.type})`)
		.join(" / ");
}

function extractFlowFields(definition: unknown) {
	const record = definition && typeof definition === "object" && !Array.isArray(definition)
		? (definition as Record<string, unknown>)
		: {};
	const fields = Array.isArray(record.fields) ? record.fields : [];
	return fields
		.map((field) => {
			if (!field || typeof field !== "object" || Array.isArray(field)) return null;
			const item = field as Record<string, unknown>;
			const key = typeof item.key === "string" ? item.key : "";
			if (!key) return null;
			return {
				key,
				label: typeof item.label === "string" ? item.label : key,
				type: typeof item.type === "string" ? item.type : "text",
			};
		})
		.filter((field): field is { key: string; label: string; type: string } => Boolean(field));
}

function flowTypeLabel(type?: string | null) {
	const labels: Record<string, string> = {
		boolean_checklist: "Checklist",
		data_entry: "Carga de datos",
		review: "Revision",
		selection: "Seleccion",
		upload_request: "Pedido archivo",
	};
	return labels[type ?? ""] ?? "Flow";
}

function EntityList({
	items,
	empty,
}: {
	items: { id: string; title: string; description: string; meta: string }[];
	empty: string;
}) {
	if (items.length === 0) {
		return <div className="rounded-md border border-dashed p-4 text-sm text-foreground/60">{empty}</div>;
	}
	return (
		<ul className="space-y-2">
			{items.map((item) => (
				<li key={item.id} className="flex items-start justify-between gap-3 rounded-md border bg-background p-3 text-sm">
					<div>
						<p className="font-medium">{item.title}</p>
						<p className="text-xs text-foreground/60">{item.description}</p>
					</div>
					<span className="text-xs text-foreground/60">{item.meta}</span>
				</li>
			))}
		</ul>
	);
}

function ActivityList({
	items,
	empty,
}: {
	items: { id: string; title: string; description: string; meta: string; status?: string | null }[];
	empty: string;
}) {
	if (items.length === 0) {
		return <div className="rounded-md border border-dashed p-4 text-sm text-foreground/60">{empty}</div>;
	}
	return (
		<ul className="space-y-2">
			{items.map((item) => (
				<li key={item.id} className="rounded-md border bg-background p-3 text-sm">
					<div className="flex items-start justify-between gap-3">
						<p className="font-medium">{item.title}</p>
						{item.status && <StatusBadge status={item.status} />}
					</div>
					<p className="mt-1 line-clamp-2 text-xs text-foreground/65">{item.description}</p>
					<p className="mt-2 text-xs text-foreground/50">{item.meta}</p>
				</li>
			))}
		</ul>
	);
}

function MiniStat({ label, value }: { label: string; value: React.ReactNode }) {
	return (
		<div className="rounded-md border bg-background p-3">
			<p className="text-xs font-medium text-foreground/55">{label}</p>
			<p className="mt-1 text-xl font-semibold">{value}</p>
		</div>
	);
}

function LimitBar({
	label,
	value,
	limit,
	helper,
	format = (input: number) => String(input),
}: {
	label: string;
	value: number;
	limit: number;
	helper?: string;
	format?: (input: number) => string;
}) {
	const safeLimit = Math.max(0, limit);
	const ratio = safeLimit > 0 ? Math.min(1, value / safeLimit) : 0;
	const percentage = Math.round(ratio * 100);
	const tone =
		percentage >= 95
			? "bg-red-600"
			: percentage >= 80
				? "bg-amber-600"
				: "bg-emerald-600";
	return (
		<div className="rounded-md border bg-background p-3">
			<div className="flex items-center justify-between gap-3 text-sm">
				<p className="font-medium">{label}</p>
				<p className="text-xs text-foreground/60">
					{format(value)} / {safeLimit > 0 ? format(safeLimit) : "sin limite"}
				</p>
			</div>
			<div className="mt-2 h-2 overflow-hidden rounded-full bg-foreground/10">
				<div className={cn("h-full rounded-full", tone)} style={{ width: `${percentage}%` }} />
			</div>
			{helper && <p className="mt-2 text-xs text-foreground/55">{helper}</p>}
		</div>
	);
}

function StatusBadge({ status }: { status?: string | null }) {
	const value = status ?? "draft";
	const isPositive = value === "active" || value === "applied" || value === "received" || value === "completed" || value === "approved";
	const isWarning = value === "draft" || value === "pending" || value === "needs_review" || value === "paused" || value === "in_progress";
	return (
		<Badge
			variant="outline"
			className={cn(
				"h-6 border-foreground/15 bg-background text-foreground/65",
				isPositive && "border-green-200 bg-green-50 text-green-700",
				isWarning && "border-amber-200 bg-amber-50 text-amber-800",
				value === "blocked" || value === "disabled" || value === "failed" || value === "rejected"
					? "border-red-200 bg-red-50 text-red-700"
					: null,
			)}
		>
			{statusLabel(value)}
		</Badge>
	);
}

function SmallPill({ children }: { children: React.ReactNode }) {
	return (
		<span className="rounded-full border bg-foreground/[0.03] px-2 py-1 text-xs text-foreground/70">
			{children}
		</span>
	);
}

function normalizeTab(tab?: string): AdminTab {
	if (tab && tabs.some((entry) => entry.key === tab)) return tab as AdminTab;
	return "historial";
}

function resultModeOptions(): [string, string][] {
	return [
		["manual_submission", "Guardar datos"],
		["generate_document", "Generar documento"],
		["upload_request", "Pedir archivo"],
		["review_only", "Revision manual"],
	];
}

function statusLabel(status?: string | null) {
	if (!status) return "Sin estado";
	return statusLabels[status] ?? status;
}

function providerLabel(provider?: string | null) {
	if (provider === "meta_cloud") return "Meta Cloud API";
	if (provider === "twilio") return "Twilio";
	if (provider === "360dialog") return "360Dialog";
	return provider ?? "Proveedor";
}

function triggerLabel(trigger?: string | null) {
	if (trigger === "on_demand") return "A pedido";
	if (trigger === "scheduled") return "Recurrente";
	if (trigger === "both") return "A pedido y recurrente";
	return trigger ?? "Sin modo";
}

function templateCategoryLabel(category?: string | null) {
	if (category === "utility") return "Utility";
	if (category === "marketing") return "Marketing";
	if (category === "authentication") return "Authentication";
	if (category === "service") return "Service";
	return category ?? "Sin categoria";
}

function resultModeLabel(mode?: string | null) {
	if (mode === "manual_submission") return "Guardar datos";
	if (mode === "generate_document") return "Generar documento";
	if (mode === "upload_request") return "Pedir archivo";
	if (mode === "review_only") return "Revision manual";
	return "Sin resultado";
}

function actionTypeLabel(type?: string | null) {
	if (type === "upload_file") return "Subida de archivo";
	if (type === "manual_submission") return "Carga manual";
	if (type === "generate_document") return "Generacion documento";
	if (type === "data_query") return "Consulta datos";
	if (type === "template_response") return "Respuesta template";
	if (type === "permission_check") return "Permisos";
	return "Accion";
}

function contactLabel(contact: Contact) {
	return contact.display_name ? `${contact.display_name} · ${contact.phone_e164}` : contact.phone_e164;
}

function obraLabel(obra: ObraOption) {
	return obra.n ? `#${obra.n} · ${obra.designacion_y_ubicacion ?? "Sin nombre"}` : (obra.designacion_y_ubicacion ?? obra.id);
}

function scheduleLabel(assignment: Assignment) {
	const time = assignment.time_of_day ? String(assignment.time_of_day).slice(0, 5) : "sin hora";
	if (assignment.frequency === "daily") return `Diaria · ${time}`;
	if (assignment.frequency === "weekly") return `Semanal · ${assignment.weekday ?? "sin dia"} · ${time}`;
	if (assignment.frequency === "monthly") return `Mensual · dia ${assignment.day_of_month ?? "-"} · ${time}`;
	if (assignment.frequency === "once") return `Una vez · ${formatDate(assignment.next_run_at)}`;
	return assignment.frequency ?? "Sin frecuencia";
}

function buildChatThreads(messages: Message[], contacts: Contact[], actions: ChatAction[]): ChatThread[] {
	const contactById = new Map(contacts.map((contact) => [contact.id, contact]));
	const byPhone = new Map<string, Contact>();
	for (const contact of contacts) byPhone.set(contact.phone_e164, contact);
	const threads = new Map<string, ChatThread>();

	for (const message of messages) {
		const phone = message.direction === "outbound"
			? (message.to_phone ?? "")
			: (message.from_phone ?? message.to_phone ?? "");
		const key = message.contact_id ?? (phone || message.id);
		const contact = message.contact_id ? contactById.get(message.contact_id) : byPhone.get(phone);
		const existing = threads.get(key);
		const lastMessage = message.text_body || message.error_message || statusLabel(message.status);
		if (!existing) {
			threads.set(key, {
				id: key,
				title: contact?.display_name ?? (phone || "Chat sin telefono"),
				phone,
				lastMessage,
				lastStatus: message.status,
				lastAt: message.created_at,
				count: 1,
				actionCount: 0,
			});
			continue;
		}
		existing.count += 1;
		const existingTime = existing.lastAt ? new Date(existing.lastAt).getTime() : 0;
		const messageTime = message.created_at ? new Date(message.created_at).getTime() : 0;
		if (messageTime >= existingTime) {
			existing.lastMessage = lastMessage;
			existing.lastStatus = message.status;
			existing.lastAt = message.created_at;
		}
	}

	for (const action of actions) {
		const key = action.contact_id ?? action.id;
		const contact = action.contact_id ? contactById.get(action.contact_id) : null;
		const existing = threads.get(key);
		const actionMessage = action.result_summary || action.error_message || action.user_prompt || actionTypeLabel(action.action_type);
		if (!existing) {
			threads.set(key, {
				id: key,
				title: contact?.display_name ?? "Accion sin chat",
				phone: contact?.phone_e164 ?? "",
				lastMessage: actionMessage,
				lastStatus: action.status,
				lastAt: action.created_at,
				count: 0,
				actionCount: 1,
				lastAction: action,
			});
			continue;
		}
		existing.actionCount += 1;
		const existingTime = existing.lastAt ? new Date(existing.lastAt).getTime() : 0;
		const actionTime = action.created_at ? new Date(action.created_at).getTime() : 0;
		if (actionTime >= existingTime) {
			existing.lastMessage = actionMessage;
			existing.lastStatus = action.status;
			existing.lastAt = action.created_at;
			existing.lastAction = action;
		}
	}

	return Array.from(threads.values()).sort((a, b) => {
		const at = a.lastAt ? new Date(a.lastAt).getTime() : 0;
		const bt = b.lastAt ? new Date(b.lastAt).getTime() : 0;
		return bt - at;
	});
}

function formatDate(value?: string | null) {
	if (!value) return "Sin fecha";
	try {
		return new Intl.DateTimeFormat("es-AR", {
			day: "2-digit",
			month: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
		}).format(new Date(value));
	} catch {
		return value;
	}
}

function formatBytes(value?: number | null) {
	const bytes = Number(value ?? 0);
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
	return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatGbInput(value?: number | null) {
	if (!value) return "";
	return String(Math.round((value / 1024 / 1024 / 1024) * 100) / 100);
}

function tablaLabel(tabla: TablaOption) {
	const obra = Array.isArray(tabla.obras) ? tabla.obras[0] : tabla.obras;
	const obraName = obra?.n
		? `#${obra.n} ${obra.designacion_y_ubicacion ?? ""}`.trim()
		: obra?.designacion_y_ubicacion;
	return obraName ? `${obraName} · ${tabla.name}` : tabla.name;
}
