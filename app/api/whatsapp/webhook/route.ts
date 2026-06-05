import { NextRequest, NextResponse } from "next/server";
import { fetchTenantPlan } from "@/lib/subscription-plans";
import { incrementTenantUsage, logTenantUsageEvent } from "@/lib/tenant-usage";
import {
	findFolderCandidates,
	findObraCandidates,
	guessFileExtension,
	isObraAllowed,
	normalizePhone,
	parseUploadInstruction,
	sanitizeStorageFileName,
	validateManualSubmission,
} from "@/lib/whatsapp/commands";
import {
	downloadWhatsAppMedia,
	extractWebhookMessages,
	sendWhatsAppText,
	verifyMetaWebhookSignature,
	type WhatsAppWebhookMessage,
} from "@/lib/whatsapp/meta";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const WHATSAPP_APP_SECRET = process.env.WHATSAPP_APP_SECRET;
const GRAPH_API_VERSION = process.env.WHATSAPP_GRAPH_API_VERSION ?? "v25.0";
const DOCUMENTS_BUCKET = "obra-documents";

export async function GET(req: NextRequest) {
	const { searchParams } = new URL(req.url);
	const mode = searchParams.get("hub.mode");
	const token = searchParams.get("hub.verify_token");
	const challenge = searchParams.get("hub.challenge");

	if (mode === "subscribe" && token === VERIFY_TOKEN) {
		return new NextResponse(challenge ?? "", { status: 200 });
	}

	return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(req: NextRequest) {
	const rawBody = await req.text();
	const signature = verifyMetaWebhookSignature({
		appSecret: WHATSAPP_APP_SECRET,
		rawBody,
		signatureHeader: req.headers.get("x-hub-signature-256"),
	});
	if (!signature.ok) {
		return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
	}

	let body: unknown;
	try {
		body = rawBody ? JSON.parse(rawBody) : {};
	} catch {
		return NextResponse.json({ error: "invalid_json" }, { status: 400 });
	}

	const messages = extractWebhookMessages(body);
	if (messages.length === 0) {
		return NextResponse.json({ ok: true, status: "no_messages" });
	}

	const supabase = createSupabaseAdminClient();
	const results = [];
	for (const message of messages) {
		try {
			results.push(await handleMessage({ supabase, message }));
		} catch (error) {
			console.error("[whatsapp-webhook] message failed", {
				wamid: message.wamid,
				type: message.type,
				error,
			});
			results.push({ wamid: message.wamid, ok: false });
		}
	}

	return NextResponse.json({ ok: true, results });
}

async function handleMessage({
	supabase,
	message,
}: {
	supabase: ReturnType<typeof createSupabaseAdminClient>;
	message: WhatsAppWebhookMessage;
}) {
	const account = await resolveBusinessAccount({
		supabase,
		phoneNumberId: message.phoneNumberId,
		displayPhoneNumber: message.displayPhoneNumber,
	});
	if (!account) {
		console.warn("[whatsapp-webhook] no tenant account for phone_number_id", {
			phoneNumberId: message.phoneNumberId,
		});
		return { wamid: message.wamid, ok: false, status: "unknown_phone_number_id" };
	}

	const existing = await supabase
		.from("whatsapp_messages")
		.select("id, status")
		.eq("wamid", message.wamid)
		.maybeSingle();
	if (existing.data?.id) {
		return { wamid: message.wamid, ok: true, status: "duplicate" };
	}

	const contact = await resolveContact({
		supabase,
		tenantId: account.tenant_id,
		phone: message.from,
	});

	const inserted = await supabase
		.from("whatsapp_messages")
		.insert({
			tenant_id: account.tenant_id,
			business_account_id: account.id,
			contact_id: contact?.id ?? null,
			wamid: message.wamid,
			direction: "inbound",
			from_phone: normalizePhone(message.from),
			to_phone: message.to ?? null,
			message_type: message.type,
			text_body: message.textBody || null,
			media_id: message.media?.id ?? null,
			media_mime_type: message.media?.mimeType ?? null,
			media_sha256: message.media?.sha256 ?? null,
			media_filename: message.media?.fileName ?? null,
			status: "received",
			raw_payload: scrubRawPayload(message.raw),
		})
		.select("id")
		.single();
	if (inserted.error) throw inserted.error;
	const messageRowId = inserted.data.id as string;

	if (!contact || contact.status !== "active") {
		await markMessageFailed(supabase, messageRowId, "contact_not_authorized");
		await reply(
			message.from,
			account.phone_number_id,
			"No estas autorizado para operar con Sintesis por WhatsApp. Pedile a un administrador que habilite tu contacto.",
		);
		return { wamid: message.wamid, ok: false, status: "contact_not_authorized" };
	}

	if (message.media?.id) {
		return handleMediaUpload({
			supabase,
			account,
			contact,
			message,
			messageRowId,
		});
	}

	const flowSubmission = await handleManualFlowSubmission({
		supabase,
		account,
		contact,
		message,
		messageRowId,
	});
	if (flowSubmission) return flowSubmission;

	await reply(
		message.from,
		account.phone_number_id,
		"Mandame una foto, PDF o archivo con una instruccion como: subir a obra 12 carpeta certificados.",
	);
	await markMessageProcessed(supabase, messageRowId, "ignored");
	return { wamid: message.wamid, ok: true, status: "text_help" };
}

async function handleMediaUpload({
	supabase,
	account,
	contact,
	message,
	messageRowId,
}: {
	supabase: ReturnType<typeof createSupabaseAdminClient>;
	account: { id: string; tenant_id: string; phone_number_id: string };
	contact: {
		id: string;
		phone_e164: string;
		can_upload_documents: boolean;
		can_submit_forms?: boolean;
		allowed_obra_ids: string[] | null;
	};
	message: WhatsAppWebhookMessage;
	messageRowId: string;
}) {
	if (!contact.can_upload_documents) {
		await markMessageFailed(supabase, messageRowId, "missing_upload_permission");
		await reply(
			message.from,
			account.phone_number_id,
			"Tu contacto esta autorizado, pero no tiene permiso para subir documentos por WhatsApp.",
		);
		return { wamid: message.wamid, ok: false, status: "missing_upload_permission" };
	}

	const instruction = parseUploadInstruction(message.textBody);
	if (!instruction.obraQuery && instruction.obraNumber == null) {
		await markMessageFailed(supabase, messageRowId, "missing_obra");
		await reply(
			message.from,
			account.phone_number_id,
			"No encontre la obra en tu mensaje. Proba con: subir a obra 12 carpeta certificados.",
		);
		return { wamid: message.wamid, ok: false, status: "missing_obra" };
	}
	if (!instruction.folderQuery) {
		await markMessageFailed(supabase, messageRowId, "missing_folder");
		await reply(
			message.from,
			account.phone_number_id,
			"No encontre la carpeta destino. Proba con: subir a obra 12 carpeta certificados.",
		);
		return { wamid: message.wamid, ok: false, status: "missing_folder" };
	}

	const obras = await findObraCandidates({
		supabase,
		tenantId: account.tenant_id,
		query: instruction.obraQuery,
		number: instruction.obraNumber,
	});
	const allowedObras = obras.filter((obra) =>
		isObraAllowed(contact, String(obra.id)),
	);
	if (allowedObras.length === 0) {
		await markMessageFailed(supabase, messageRowId, "obra_not_found_or_forbidden");
		await reply(
			message.from,
			account.phone_number_id,
			obras.length > 0
				? "Encontre esa obra, pero tu contacto no tiene permiso para cargarle documentos."
				: `No encontre una obra para "${instruction.obraQuery ?? instruction.obraNumber}".`,
		);
		return { wamid: message.wamid, ok: false, status: "obra_not_found_or_forbidden" };
	}
	if (allowedObras.length > 1) {
		await createPendingSelection({
			supabase,
			tenantId: account.tenant_id,
			contactId: contact.id,
			messageRowId,
			actionType: "select_obra",
			prompt: "Encontre varias obras posibles.",
			options: allowedObras.map((obra) => ({
				id: obra.id,
				label: `${obra.n ?? ""} ${obra.designacion_y_ubicacion ?? ""}`.trim(),
			})),
			context: { instruction, media: message.media },
		});
		await reply(
			message.from,
			account.phone_number_id,
			`Encontre varias obras posibles: ${allowedObras
				.map((obra, index) => `${index + 1}. ${obra.designacion_y_ubicacion}`)
				.join(" / ")}. Respondeme con el numero correcto.`,
		);
		return { wamid: message.wamid, ok: true, status: "needs_obra_selection" };
	}

	const obra = allowedObras[0]!;
	const folders = await findFolderCandidates({
		supabase,
		tenantId: account.tenant_id,
		obraId: String(obra.id),
		query: instruction.folderQuery,
	});
	if (folders.length === 0) {
		await markMessageFailed(supabase, messageRowId, "folder_not_found");
		await reply(
			message.from,
			account.phone_number_id,
			`No encontre una carpeta parecida a "${instruction.folderQuery}" en esa obra.`,
		);
		return { wamid: message.wamid, ok: false, status: "folder_not_found" };
	}
	if (folders.length > 1) {
		await createPendingSelection({
			supabase,
			tenantId: account.tenant_id,
			contactId: contact.id,
			messageRowId,
			actionType: "select_folder",
			prompt: "Encontre varias carpetas posibles.",
			options: folders.map((folder) => ({
				id: folder.path,
				label: `${folder.label} (${folder.kind})`,
				kind: folder.kind,
			})),
			context: { instruction, obraId: obra.id, media: message.media },
		});
		await reply(
			message.from,
			account.phone_number_id,
			`Encontre varias carpetas: ${folders
				.map((folder, index) => `${index + 1}. ${folder.label}`)
				.join(" / ")}. Respondeme con el numero correcto.`,
		);
		return { wamid: message.wamid, ok: true, status: "needs_folder_selection" };
	}

	const folder = folders[0]!;
	const upload = await uploadMediaToFolder({
		supabase,
		tenantId: account.tenant_id,
		contactId: contact.id,
		messageRowId,
		obraId: String(obra.id),
		folderPath: folder.path,
		media: message.media!,
	});

	await markMessageProcessed(supabase, messageRowId, "processed");
	await reply(
		message.from,
		account.phone_number_id,
		`Listo. Subi el archivo a "${obra.designacion_y_ubicacion}" en la carpeta "${folder.label}".`,
	);
	return { wamid: message.wamid, ok: true, status: "uploaded", path: upload.storagePath };
}

async function handleManualFlowSubmission({
	supabase,
	account,
	contact,
	message,
	messageRowId,
}: {
	supabase: ReturnType<typeof createSupabaseAdminClient>;
	account: { id: string; tenant_id: string; phone_number_id: string };
	contact: {
		id: string;
		can_submit_forms?: boolean;
	};
	message: WhatsAppWebhookMessage;
	messageRowId: string;
}) {
	const flowValues = readFlowResponseValues(message.raw);
	if (!flowValues) return null;

	if (!contact.can_submit_forms) {
		await markMessageFailed(supabase, messageRowId, "missing_form_permission");
		await reply(
			message.from,
			account.phone_number_id,
			"Tu contacto no tiene permiso para cargar formularios por WhatsApp.",
		);
		return { wamid: message.wamid, ok: false, status: "missing_form_permission" };
	}

	const formId =
		readString(flowValues.formId) ??
		readString(flowValues.whatsappFormId) ??
		readString(flowValues.form_id);
	if (!formId) {
		await markMessageFailed(supabase, messageRowId, "flow_form_id_missing");
		return { wamid: message.wamid, ok: false, status: "flow_form_id_missing" };
	}

	const { data: form, error: formError } = await supabase
		.from("whatsapp_manual_forms")
		.select("id, obra_id, folder_path, tabla_id, status")
		.eq("id", formId)
		.eq("tenant_id", account.tenant_id)
		.maybeSingle();
	if (formError) throw formError;
	if (!form || form.status !== "active") {
		await markMessageFailed(supabase, messageRowId, "form_not_found_or_inactive");
		await reply(
			message.from,
			account.phone_number_id,
			"No encontre un formulario activo para esa respuesta.",
		);
		return { wamid: message.wamid, ok: false, status: "form_not_found_or_inactive" };
	}
	if (!form.tabla_id) {
		await markMessageFailed(supabase, messageRowId, "form_missing_table");
		return { wamid: message.wamid, ok: false, status: "form_missing_table" };
	}

	const values = { ...flowValues };
	delete values.formId;
	delete values.whatsappFormId;
	delete values.form_id;

	const validation = await validateManualSubmission({
		supabase,
		tablaId: String(form.tabla_id),
		values,
	});
	const status =
		validation.errors.length > 0 ? "needs_review" : "ready_to_apply";

	const { error: insertError } = await supabase
		.from("whatsapp_manual_submissions")
		.insert({
			tenant_id: account.tenant_id,
			form_id: form.id,
			contact_id: contact.id,
			source_message_id: messageRowId,
			obra_id: form.obra_id,
			folder_path: form.folder_path,
			tabla_id: form.tabla_id,
			raw_values: values,
			parsed_values: validation.parsed,
			validation_errors: validation.errors,
			status,
		});
	if (insertError) throw insertError;

	await markMessageProcessed(supabase, messageRowId, "processed");
	await reply(
		message.from,
		account.phone_number_id,
		status === "ready_to_apply"
			? "Recibi el formulario. Quedo listo para aplicar como fila manual."
			: "Recibi el formulario, pero necesita revision porque algunos campos no validaron.",
	);
	return { wamid: message.wamid, ok: true, status: "manual_submission_received" };
}

async function uploadMediaToFolder(args: {
	supabase: ReturnType<typeof createSupabaseAdminClient>;
	tenantId: string;
	contactId: string;
	messageRowId: string;
	obraId: string;
	folderPath: string;
	media: NonNullable<WhatsAppWebhookMessage["media"]>;
}) {
	if (!WHATSAPP_TOKEN) throw new Error("WHATSAPP_ACCESS_TOKEN is not configured");
	const downloaded = await downloadWhatsAppMedia({
		mediaId: args.media.id,
		accessToken: WHATSAPP_TOKEN,
		graphApiVersion: GRAPH_API_VERSION,
	});
	const mimeType = downloaded.mimeType || args.media.mimeType || "application/octet-stream";
	const baseName =
		sanitizeStorageFileName(args.media.fileName ?? downloaded.fileName ?? "") ||
		`whatsapp-${Date.now()}.${guessFileExtension(mimeType)}`;
	const storagePath = `${args.obraId}/${args.folderPath}/${baseName}`;
	const uploadedBytes = downloaded.bytes.byteLength;

	const plan = await fetchTenantPlan(args.supabase, args.tenantId);
	const { error: uploadError } = await args.supabase.storage
		.from(DOCUMENTS_BUCKET)
		.upload(storagePath, downloaded.bytes, {
			contentType: mimeType,
			upsert: false,
		});
	if (uploadError) throw uploadError;

	try {
		if (uploadedBytes > 0) {
			await incrementTenantUsage(
				args.supabase,
				args.tenantId,
				{ storageBytes: uploadedBytes },
				plan.limits,
			);
			await logTenantUsageEvent(args.supabase, {
				tenantId: args.tenantId,
				kind: "storage_bytes",
				amount: uploadedBytes,
				context: "whatsapp_document_upload",
				metadata: {
					obraId: args.obraId,
					path: storagePath,
					contactId: args.contactId,
				},
			});
		}
	} catch (usageError) {
		await args.supabase.storage.from(DOCUMENTS_BUCKET).remove([storagePath]);
		throw usageError;
	}

	const { error: trackingError } = await args.supabase
		.from("whatsapp_document_uploads")
		.insert({
			tenant_id: args.tenantId,
			contact_id: args.contactId,
			source_message_id: args.messageRowId,
			obra_id: args.obraId,
			folder_path: args.folderPath,
			storage_bucket: DOCUMENTS_BUCKET,
			storage_path: storagePath,
			file_name: baseName,
			mime_type: mimeType,
			uploaded_bytes: uploadedBytes,
		});
	if (trackingError) throw trackingError;

	return { storagePath };
}

async function resolveBusinessAccount(args: {
	supabase: ReturnType<typeof createSupabaseAdminClient>;
	phoneNumberId: string;
	displayPhoneNumber?: string | null;
}) {
	const { data, error } = await args.supabase
		.from("whatsapp_business_accounts")
		.select("id, tenant_id, phone_number_id, status")
		.eq("phone_number_id", args.phoneNumberId)
		.in("status", ["active", "draft"])
		.maybeSingle();
	if (error) throw error;
	if (data) return data as { id: string; tenant_id: string; phone_number_id: string };

	const fallbackTenantId = process.env.WHATSAPP_TENANT_ID;
	if (!fallbackTenantId) return null;
	const inserted = await args.supabase
		.from("whatsapp_business_accounts")
		.upsert(
			{
				tenant_id: fallbackTenantId,
				phone_number_id: args.phoneNumberId,
				display_phone_number: args.displayPhoneNumber ?? null,
				status: "draft",
				settings: { autoCreatedFromWebhook: true },
			},
			{ onConflict: "phone_number_id" },
		)
		.select("id, tenant_id, phone_number_id")
		.single();
	if (inserted.error) throw inserted.error;
	return inserted.data as { id: string; tenant_id: string; phone_number_id: string };
}

async function resolveContact(args: {
	supabase: ReturnType<typeof createSupabaseAdminClient>;
	tenantId: string;
	phone: string;
}) {
	const phone = normalizePhone(args.phone);
	const { data, error } = await args.supabase
		.from("whatsapp_contacts")
		.select("id, phone_e164, status, can_upload_documents, can_submit_forms, allowed_obra_ids")
		.eq("tenant_id", args.tenantId)
		.eq("phone_e164", phone)
		.maybeSingle();
	if (error) throw error;
	return data as
		| {
				id: string;
				phone_e164: string;
				status: string;
				can_upload_documents: boolean;
				can_submit_forms: boolean;
				allowed_obra_ids: string[] | null;
		  }
		| null;
}

async function reply(to: string, phoneNumberId: string, body: string) {
	if (!WHATSAPP_TOKEN) {
		console.warn("[whatsapp-webhook] WHATSAPP_ACCESS_TOKEN missing; reply skipped");
		return;
	}
	await sendWhatsAppText({
		phoneNumberId,
		accessToken: WHATSAPP_TOKEN,
		to,
		body,
		graphApiVersion: GRAPH_API_VERSION,
	});
}

async function markMessageFailed(
	supabase: ReturnType<typeof createSupabaseAdminClient>,
	messageRowId: string,
	errorMessage: string,
) {
	await supabase
		.from("whatsapp_messages")
		.update({
			status: "failed",
			error_message: errorMessage,
			processed_at: new Date().toISOString(),
		})
		.eq("id", messageRowId);
}

async function markMessageProcessed(
	supabase: ReturnType<typeof createSupabaseAdminClient>,
	messageRowId: string,
	status: "processed" | "ignored",
) {
	await supabase
		.from("whatsapp_messages")
		.update({ status, processed_at: new Date().toISOString() })
		.eq("id", messageRowId);
}

async function createPendingSelection(args: {
	supabase: ReturnType<typeof createSupabaseAdminClient>;
	tenantId: string;
	contactId: string;
	messageRowId: string;
	actionType: "select_obra" | "select_folder";
	prompt: string;
	options: unknown[];
	context: Record<string, unknown>;
}) {
	const { error } = await args.supabase.from("whatsapp_pending_actions").insert({
		tenant_id: args.tenantId,
		contact_id: args.contactId,
		source_message_id: args.messageRowId,
		action_type: args.actionType,
		prompt: args.prompt,
		options: args.options,
		context: args.context,
	});
	if (error) throw error;
}

function scrubRawPayload(raw: Record<string, unknown>) {
	const clone = { ...raw };
	delete clone.contacts;
	delete clone.profile;
	return clone;
}

function readFlowResponseValues(raw: Record<string, unknown>) {
	const interactive = readRecord(raw.interactive);
	const nfmReply = readRecord(interactive.nfm_reply);
	const responseJson = readString(nfmReply.response_json);
	if (!responseJson) return null;
	try {
		const parsed = JSON.parse(responseJson);
		return readRecord(parsed);
	} catch {
		return null;
	}
}

function readRecord(value: unknown): Record<string, unknown> {
	return value && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {};
}

function readString(value: unknown) {
	return typeof value === "string" && value.trim() ? value.trim() : null;
}
