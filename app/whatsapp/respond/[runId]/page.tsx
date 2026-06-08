import { notFound } from "next/navigation";
import { submitWhatsAppRunResponse } from "./actions";
import { Button } from "@/components/ui/button";
import { verifyWhatsAppRunToken } from "@/lib/whatsapp/recurring";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";

type PageProps = {
	params: Promise<{ runId: string }>;
	searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type Field = {
	key: string;
	label: string;
	type: string;
	required: boolean;
	options: string[];
};

export default async function WhatsAppResponsePage({ params, searchParams }: PageProps) {
	const { runId } = await params;
	const resolvedSearch = (await searchParams) ?? {};
	const token = Array.isArray(resolvedSearch.token) ? resolvedSearch.token[0] : resolvedSearch.token;
	if (!verifyWhatsAppRunToken(runId, token)) notFound();

	const supabase = createSupabaseAdminClient();
	const { data: run } = await supabase
		.from("whatsapp_recurring_runs")
		.select("id, tenant_id, assignment_id, status")
		.eq("id", runId)
		.maybeSingle();
	if (!run) notFound();

	const { data: assignment } = await supabase
		.from("whatsapp_recurring_assignments")
		.select("id, tenant_id, contact_id, whatsapp_template_id, document_generation_template_id, obra_id, folder_path, result_mode")
		.eq("id", run.assignment_id)
		.eq("tenant_id", run.tenant_id)
		.maybeSingle();
	if (!assignment) notFound();

	const [templateResult, documentTemplateResult, contactResult, obraResult] = await Promise.all([
		supabase
			.from("whatsapp_templates")
			.select("id, display_name, name, trigger_purpose")
			.eq("id", assignment.whatsapp_template_id)
			.eq("tenant_id", run.tenant_id)
			.maybeSingle(),
		assignment.document_generation_template_id
			? supabase
					.from("document_generation_templates")
					.select("id, name, schema")
					.eq("id", assignment.document_generation_template_id)
					.maybeSingle()
			: Promise.resolve({ data: null }),
		supabase
			.from("whatsapp_contacts")
			.select("display_name, phone_e164")
			.eq("id", assignment.contact_id)
			.eq("tenant_id", run.tenant_id)
			.maybeSingle(),
		supabase
			.from("obras")
			.select("n, designacion_y_ubicacion")
			.eq("id", assignment.obra_id)
			.eq("tenant_id", run.tenant_id)
			.maybeSingle(),
	]);

	const template = templateResult.data;
	const documentTemplate = documentTemplateResult.data as { name?: string | null; schema?: unknown } | null;
	const fields = extractFields(documentTemplate?.schema);
	const booleanKeys = fields.filter((field) => field.type === "boolean").map((field) => field.key);
	const contact = contactResult.data;
	const obra = obraResult.data;
	const title = template?.display_name ?? template?.name ?? documentTemplate?.name ?? "Formulario";

	return (
		<main className="min-h-screen bg-neutral-50 px-4 py-8 text-neutral-950">
			<div className="mx-auto max-w-2xl space-y-5">
				<header className="rounded-md border bg-white p-5">
					<p className="text-xs font-medium uppercase text-neutral-500">Sintesis · WhatsApp</p>
					<h1 className="mt-2 text-2xl font-semibold">{title}</h1>
					<p className="mt-2 text-sm text-neutral-600">
						{obra ? obraLabel(obra) : "Obra asignada"} · {contact?.display_name ?? contact?.phone_e164 ?? "Contacto"}
					</p>
				</header>

				<form action={submitWhatsAppRunResponse} className="space-y-4 rounded-md border bg-white p-5">
					<input type="hidden" name="runId" value={runId} />
					<input type="hidden" name="token" value={token ?? ""} />
					<input type="hidden" name="_booleanKeys" value={booleanKeys.join(",")} />

					{fields.map((field) => (
						<FormField key={field.key} field={field} />
					))}

					{fields.length === 0 && (
						<>
							<FormField field={{ key: "received", label: "Llegó correctamente", type: "boolean", required: false, options: [] }} />
							<FormField field={{ key: "comment", label: "Comentario", type: "textarea", required: false, options: [] }} />
						</>
					)}

					<div className="pt-2">
						<Button type="submit">Enviar respuesta</Button>
					</div>
				</form>
			</div>
		</main>
	);
}

function FormField({ field }: { field: Field }) {
	if (field.type === "boolean") {
		return (
			<label className="flex items-center justify-between gap-3 rounded-md border bg-neutral-50 px-3 py-3 text-sm">
				<span className="font-medium">{field.label}</span>
				<select name={`${field.key}__boolean`} className="h-9 rounded-md border bg-white px-3">
					<option value="true">Si</option>
					<option value="false">No</option>
				</select>
			</label>
		);
	}
	if (field.type === "select" && field.options.length > 0) {
		return (
			<label className="space-y-1 text-sm">
				<span className="font-medium">{field.label}</span>
				<select name={field.key} required={field.required} className="h-10 w-full rounded-md border bg-white px-3">
					{field.options.map((option) => (
						<option key={option} value={option}>{option}</option>
					))}
				</select>
			</label>
		);
	}
	if (field.type === "textarea") {
		return (
			<label className="space-y-1 text-sm">
				<span className="font-medium">{field.label}</span>
				<textarea name={field.key} required={field.required} rows={4} className="w-full rounded-md border bg-white px-3 py-2" />
			</label>
		);
	}
	const inputType = field.type === "date" ? "date" : field.type === "number" || field.type === "money" ? "number" : "text";
	return (
		<label className="space-y-1 text-sm">
			<span className="font-medium">{field.label}</span>
			<input name={field.key} type={inputType} required={field.required} className="h-10 w-full rounded-md border bg-white px-3" />
		</label>
	);
}

function extractFields(schema: unknown): Field[] {
	const root = schema && typeof schema === "object" && !Array.isArray(schema) ? schema as Record<string, unknown> : {};
	const rawFields = Array.isArray(root.fields) ? root.fields : [];
	return rawFields
		.map((raw): Field | null => {
			const field = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
			const key = typeof field.key === "string" ? field.key : typeof field.name === "string" ? field.name : "";
			if (!key) return null;
			const options = Array.isArray(field.options)
				? field.options.map((option) => String(option)).filter(Boolean)
				: [];
			return {
				key,
				label: typeof field.label === "string" ? field.label : key,
				type: typeof field.type === "string" ? field.type : "text",
				required: field.required === true,
				options,
			};
		})
		.filter((field): field is Field => Boolean(field));
}

function obraLabel(obra: { n?: number | string | null; designacion_y_ubicacion?: string | null }) {
	return obra.n ? `#${obra.n} ${obra.designacion_y_ubicacion ?? ""}`.trim() : obra.designacion_y_ubicacion ?? "Obra";
}
