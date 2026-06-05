import crypto from "node:crypto";

export type WhatsAppWebhookMessage = {
	phoneNumberId: string;
	displayPhoneNumber?: string | null;
	wamid: string;
	from: string;
	to?: string | null;
	type: string;
	textBody: string;
	media?: {
		id: string;
		mimeType?: string | null;
		sha256?: string | null;
		fileName?: string | null;
	};
	raw: Record<string, unknown>;
};

export function verifyMetaWebhookSignature(args: {
	appSecret: string | undefined;
	rawBody: string;
	signatureHeader: string | null;
}) {
	if (!args.appSecret) return { ok: true, skipped: true };
	if (!args.signatureHeader?.startsWith("sha256=")) {
		return { ok: false, skipped: false };
	}

	const provided = args.signatureHeader.slice("sha256=".length);
	const expected = crypto
		.createHmac("sha256", args.appSecret)
		.update(args.rawBody)
		.digest("hex");

	const providedBuffer = Buffer.from(provided, "hex");
	const expectedBuffer = Buffer.from(expected, "hex");
	if (providedBuffer.length !== expectedBuffer.length) {
		return { ok: false, skipped: false };
	}

	return {
		ok: crypto.timingSafeEqual(providedBuffer, expectedBuffer),
		skipped: false,
	};
}

export function extractWebhookMessages(body: unknown): WhatsAppWebhookMessage[] {
	const root = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
	const entries = Array.isArray(root.entry) ? root.entry : [];
	const messages: WhatsAppWebhookMessage[] = [];

	for (const entry of entries) {
		const entryRecord = asRecord(entry);
		const changes = Array.isArray(entryRecord.changes) ? entryRecord.changes : [];
		for (const change of changes) {
			const changeRecord = asRecord(change);
			const value = asRecord(changeRecord.value);
			const metadata = asRecord(value.metadata);
			const phoneNumberId =
				typeof metadata.phone_number_id === "string"
					? metadata.phone_number_id
					: "";
			if (!phoneNumberId) continue;
			const displayPhoneNumber =
				typeof metadata.display_phone_number === "string"
					? metadata.display_phone_number
					: null;

			const rawMessages = Array.isArray(value.messages) ? value.messages : [];
			for (const rawMessage of rawMessages) {
				const rawRecord = asRecord(rawMessage);
				const type =
					typeof rawRecord.type === "string" ? rawRecord.type : "unknown";
				const media = readMedia(type, rawRecord);
				messages.push({
					phoneNumberId,
					displayPhoneNumber,
					wamid: typeof rawRecord.id === "string" ? rawRecord.id : "",
					from: typeof rawRecord.from === "string" ? rawRecord.from : "",
					to: displayPhoneNumber,
					type,
					textBody: readTextBody(type, rawRecord),
					media,
					raw: rawRecord,
				});
			}
		}
	}

	return messages.filter((message) => message.wamid && message.from);
}

function asRecord(value: unknown): Record<string, unknown> {
	return value && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {};
}

function readTextBody(type: string, rawMessage: Record<string, unknown>) {
	if (type === "text") return String(asRecord(rawMessage.text).body ?? "");
	if (type === "image") return String(asRecord(rawMessage.image).caption ?? "");
	if (type === "video") return String(asRecord(rawMessage.video).caption ?? "");
	if (type === "document") return String(asRecord(rawMessage.document).caption ?? "");
	if (type === "button") return String(asRecord(rawMessage.button).text ?? "");
	if (type === "interactive") {
		const interactive = asRecord(rawMessage.interactive);
		const buttonReply = asRecord(interactive.button_reply);
		const listReply = asRecord(interactive.list_reply);
		const nfmReply = asRecord(interactive.nfm_reply);
		return String(
			buttonReply.title ??
				listReply.title ??
				nfmReply.body ??
				"",
		);
	}
	return "";
}

function readMedia(
	type: string,
	rawMessage: Record<string, unknown>,
): WhatsAppWebhookMessage["media"] {
	if (!["image", "document", "audio", "video"].includes(type)) return undefined;
	const source = asRecord(rawMessage[type]);
	const id = typeof source.id === "string" ? source.id : "";
	if (!id) return undefined;
	return {
		id,
		mimeType: typeof source.mime_type === "string" ? source.mime_type : null,
		sha256: typeof source.sha256 === "string" ? source.sha256 : null,
		fileName: typeof source.filename === "string" ? source.filename : null,
	};
}

export async function downloadWhatsAppMedia(args: {
	mediaId: string;
	accessToken: string;
	graphApiVersion?: string;
}): Promise<{ bytes: ArrayBuffer; mimeType: string; fileName?: string | null }> {
	const version = args.graphApiVersion ?? "v25.0";
	const metaRes = await fetch(`https://graph.facebook.com/${version}/${args.mediaId}`, {
		headers: { Authorization: `Bearer ${args.accessToken}` },
	});
	if (!metaRes.ok) {
		throw new Error(
			`whatsapp_media_metadata_failed:${metaRes.status}:${await metaRes.text()}`,
		);
	}

	const meta = (await metaRes.json()) as {
		url?: string;
		mime_type?: string;
		file_name?: string;
	};
	if (!meta.url) throw new Error("whatsapp_media_missing_url");

	const fileRes = await fetch(meta.url, {
		headers: { Authorization: `Bearer ${args.accessToken}` },
	});
	if (!fileRes.ok) {
		throw new Error(`whatsapp_media_download_failed:${fileRes.status}:${await fileRes.text()}`);
	}

	return {
		bytes: await fileRes.arrayBuffer(),
		mimeType: meta.mime_type ?? "application/octet-stream",
		fileName: meta.file_name ?? null,
	};
}

export async function sendWhatsAppText(args: {
	phoneNumberId: string;
	accessToken: string;
	to: string;
	body: string;
	graphApiVersion?: string;
}) {
	const version = args.graphApiVersion ?? "v25.0";
	const res = await fetch(
		`https://graph.facebook.com/${version}/${args.phoneNumberId}/messages`,
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${args.accessToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				messaging_product: "whatsapp",
				to: args.to,
				type: "text",
				text: { body: args.body },
			}),
		},
	);
	if (!res.ok) {
		throw new Error(`whatsapp_send_failed:${res.status}:${await res.text()}`);
	}
	return res.json() as Promise<unknown>;
}
