import {
	applySubmissionAction,
	createBusinessAccountAction,
	createContactAction,
	createManualFormAction,
} from "./actions";
import type React from "react";
import {
	AlertTriangle,
	CheckCircle2,
	Clock3,
	FileUp,
	FormInput,
	Inbox,
	MessageCircle,
	Phone,
	ShieldCheck,
	SlidersHorizontal,
	UploadCloud,
	UserPlus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { resolveTenantMembership } from "@/lib/tenant-selection";
import { cn } from "@/lib/utils";
import { createClient } from "@/utils/supabase/server";

type PageProps = {
	searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type TablaOption = {
	id: string;
	name: string;
	obras?:
		| { n?: number | null; designacion_y_ubicacion?: string | null }
		| { n?: number | null; designacion_y_ubicacion?: string | null }[]
		| null;
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

type Message = {
	id: string;
	from_phone: string | null;
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

const statusLabels: Record<string, string> = {
	active: "Activo",
	archived: "Archivado",
	blocked: "Bloqueado",
	draft: "Borrador",
	disabled: "Deshabilitado",
	needs_review: "Revisar",
	paused: "Pausado",
	pending: "Pendiente",
	received: "Recibido",
	applied: "Aplicado",
};

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

	if (!activeTenantId) {
		return (
			<div className="p-6 text-sm">
				Necesitas ser administrador de una organizacion para configurar WhatsApp.
			</div>
		);
	}

	const [
		tenantResult,
		accountsResult,
		contactsResult,
		messagesResult,
		uploadsResult,
		formsResult,
		submissionsResult,
		tablasResult,
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
			.from("whatsapp_messages")
			.select("id, from_phone, message_type, text_body, status, error_message, created_at")
			.eq("tenant_id", activeTenantId)
			.order("created_at", { ascending: false })
			.limit(20),
		supabase
			.from("whatsapp_document_uploads")
			.select("id, obra_id, folder_path, storage_path, file_name, uploaded_bytes, status, created_at")
			.eq("tenant_id", activeTenantId)
			.order("created_at", { ascending: false })
			.limit(20),
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
			.limit(20),
		supabase
			.from("obra_tablas")
			.select("id, name, obra_id, source_type, settings, obras!inner(id, tenant_id, deleted_at, n, designacion_y_ubicacion)")
			.eq("obras.tenant_id", activeTenantId)
			.is("obras.deleted_at", null)
			.order("created_at", { ascending: false })
			.limit(150),
	]);

	const tenantName = tenantResult.data?.name ?? "Organizacion";
	const accounts = (accountsResult.data ?? []) as Account[];
	const contacts = (contactsResult.data ?? []) as Contact[];
	const messages = (messagesResult.data ?? []) as Message[];
	const uploads = (uploadsResult.data ?? []) as Upload[];
	const forms = (formsResult.data ?? []) as WhatsAppForm[];
	const submissions = (submissionsResult.data ?? []) as Submission[];
	const tablas = (tablasResult.data ?? []) as TablaOption[];
	const primaryAccount = accounts[0];
	const activeContacts = contacts.filter((contact) => contact.status === "active");
	const activeForms = forms.filter((form) => form.status === "active");
	const pendingSubmissions = submissions.filter((submission) => submission.status !== "applied");
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
						Configura el canal de captura para {tenantName}: archivos enviados por chat, contactos autorizados,
						formularios manuales y revision de datos antes de impactar tablas.
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

			<section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
				<Metric icon={Phone} label="Cuenta" value={primaryAccount ? statusLabel(primaryAccount.status) : "Sin configurar"} />
				<Metric icon={ShieldCheck} label="Contactos activos" value={activeContacts.length} />
				<Metric icon={FileUp} label="Archivos recibidos" value={uploads.length} />
				<Metric icon={FormInput} label="Submissions pendientes" value={pendingSubmissions.length} />
			</section>

			<section className="rounded-md border bg-card">
				<div className="grid gap-0 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
					<div className="space-y-4 p-5">
						<SectionHeader
							icon={SlidersHorizontal}
							title="Activacion del canal"
							description="Este es el camino minimo para pasar de pruebas a operacion real."
						/>
						<div className="grid gap-3 sm:grid-cols-2">
							<ReadinessItem
								done={Boolean(primaryAccount)}
								title="Cuenta de Meta registrada"
								description={primaryAccount?.phone_number_id ?? "Falta guardar Phone Number ID."}
							/>
							<ReadinessItem
								done={hasWebhook}
								title="Webhook verificable"
								description="El endpoint responde el challenge de Meta."
							/>
							<ReadinessItem
								done={hasToken}
								title="Token de envio"
								description="Necesario para responder mensajes y descargar archivos."
							/>
							<ReadinessItem
								done={hasAppSecret}
								title="Firma de webhook"
								description="Recomendado antes de produccion."
							/>
							<ReadinessItem
								done={activeContacts.length > 0}
								title="Contactos autorizados"
								description={`${activeContacts.length} contacto${activeContacts.length === 1 ? "" : "s"} con permisos.`}
							/>
							<ReadinessItem
								done={activeForms.length > 0}
								title="Formularios activos"
								description={`${activeForms.length} formulario${activeForms.length === 1 ? "" : "s"} listo${activeForms.length === 1 ? "" : "s"}.`}
							/>
						</div>
					</div>
					<div className="border-t bg-foreground/[0.02] p-5 lg:border-l lg:border-t-0">
						<SectionHeader
							icon={AlertTriangle}
							title="Codigo de verificacion"
							description="No conviene seguir pidiendo SMS durante el cooldown."
						/>
						<ol className="mt-4 space-y-3 text-sm">
							<StepItem done={false} text="Esperar que termine el bloqueo de 3 horas sin pedir mas codigos." />
							<StepItem done={false} text="Probar llamada de voz como siguiente intento, con el chip Claro activo y señal estable." />
							<StepItem done={false} text="Despues de verificar, generar token permanente y marcar la cuenta como activa." />
						</ol>
					</div>
				</div>
			</section>

			<section className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
				<ConfigPanel
					icon={Phone}
					title="Cuenta WhatsApp Business"
					description="Guarda los IDs de Meta. Los campos tecnicos quedan juntos para que no contaminen el resto del flujo."
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
					<ContactTable contacts={contacts} />
				</ConfigPanel>
			</section>

			<ConfigPanel
				icon={FormInput}
				title="Formularios manuales"
				description="Crea formularios para cargar datos sin documento: facturas, avances, partes semanales o controles recurrentes."
			>
				<form action={createManualFormAction} className="grid gap-3">
					<input type="hidden" name="tenantId" value={activeTenantId} />
					<div className="grid gap-3 lg:grid-cols-3">
						<Field name="name" label="Nombre del formulario" placeholder="Factura semanal" />
						<label className="space-y-1 text-sm lg:col-span-2">
							<span className="font-medium">Tabla destino</span>
							<select name="tablaId" className="h-9 w-full rounded-md border bg-background px-3 text-sm">
								{tablas.map((tabla) => (
									<option key={tabla.id} value={tabla.id}>
										{tablaLabel(tabla)}
									</option>
								))}
							</select>
						</label>
						<Field name="folderPath" label="Carpeta asociada" placeholder="Opcional, se puede inferir de la tabla" />
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

			<section className="grid gap-4 xl:grid-cols-3">
				<ActivityPanel icon={Inbox} title="Inbox reciente">
					<ActivityList
						empty="Todavia no entraron mensajes."
						items={messages.map((message) => ({
							id: message.id,
							title: `${message.from_phone ?? "Sin telefono"} · ${message.message_type ?? "mensaje"}`,
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
				<ActivityPanel icon={MessageCircle} title="Datos manuales">
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
										<input type="hidden" name="tenantId" value={activeTenantId} />
										<input type="hidden" name="submissionId" value={submission.id} />
										<Button type="submit" size="xs" variant="outline">
											Validar y aplicar fila
										</Button>
									</form>
								)}
							</li>
						))}
						{submissions.length === 0 && (
							<li className="rounded-md border border-dashed p-4 text-sm text-foreground/60">
								Todavia no hay respuestas manuales.
							</li>
						)}
					</ul>
				</ActivityPanel>
			</section>
		</div>
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
				{done ? (
					<CheckCircle2 className="size-4 text-green-700" />
				) : (
					<Clock3 className="size-4 text-amber-700" />
				)}
				<p className="text-sm font-medium">{title}</p>
			</div>
			<p className="mt-1 text-xs text-foreground/60">{description}</p>
		</div>
	);
}

function StepItem({ done, text }: { done: boolean; text: string }) {
	return (
		<li className="flex items-start gap-2">
			{done ? (
				<CheckCircle2 className="mt-0.5 size-4 text-green-700" />
			) : (
				<Clock3 className="mt-0.5 size-4 text-amber-700" />
			)}
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
			<select
				name={name}
				defaultValue={defaultValue}
				className="h-9 w-full rounded-md border bg-background px-3 text-sm"
			>
				{options.map(([value, labelText]) => (
					<option key={value} value={value}>
						{labelText}
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

function ContactTable({ contacts }: { contacts: Contact[] }) {
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
						<th className="px-3 py-2 font-medium">Alcance</th>
					</tr>
				</thead>
				<tbody>
					{contacts.map((contact) => (
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
							<td className="px-3 py-3">
								<div className="flex items-center gap-2">
									<StatusBadge status={contact.status} />
									<span className="text-xs text-foreground/60">
										{contact.allowed_obra_ids?.length ? `${contact.allowed_obra_ids.length} obras` : "Todas las obras"}
									</span>
								</div>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
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

function StatusBadge({ status }: { status?: string | null }) {
	const value = status ?? "draft";
	const isPositive = value === "active" || value === "applied" || value === "received";
	const isWarning = value === "draft" || value === "pending" || value === "needs_review" || value === "paused";
	return (
		<Badge
			variant="outline"
			className={cn(
				"h-6 border-foreground/15 bg-background text-foreground/65",
				isPositive && "border-green-200 bg-green-50 text-green-700",
				isWarning && "border-amber-200 bg-amber-50 text-amber-800",
				value === "blocked" || value === "disabled" ? "border-red-200 bg-red-50 text-red-700" : null,
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

function tablaLabel(tabla: TablaOption) {
	const obra = Array.isArray(tabla.obras) ? tabla.obras[0] : tabla.obras;
	const obraName = obra?.designacion_y_ubicacion ?? "Obra";
	const obraNumber = obra?.n ? `${obra.n} · ` : "";
	return `${obraNumber}${obraName} / ${tabla.name}`;
}

function formatBytes(bytes?: number | null) {
	if (!bytes) return "0 B";
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
	return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(value?: string | null) {
	if (!value) return "Sin fecha";
	return new Intl.DateTimeFormat("es-AR", {
		day: "2-digit",
		month: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
	}).format(new Date(value));
}
