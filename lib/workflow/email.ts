import { fetch as workflowFetch } from "workflow";
import { getVersionedSecret } from "@/lib/security/secrets";
import {
	renderObraCompletionHtml,
	resolveObraCompletionSubject,
	type ObraEmailTemplateInput,
} from "@/lib/email/templates/obra-completion";

type EmailPayload = {
	to: string;
	subject: string;
	html: string;
};

const RESEND_API_BASE = "https://api.resend.com/emails";

async function sendResendEmailEdge(payload: EmailPayload) {
	"use step";
	const { value: resendKey } = getVersionedSecret("RESEND_API_KEY");
	const fromEmail = process.env.RESEND_FROM_EMAIL;
	if (!resendKey || !fromEmail) {
		console.warn("[workflow/email] missing Resend configuration");
		return;
	}

	const response = await workflowFetch(RESEND_API_BASE, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${resendKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			from: fromEmail,
			to: payload.to,
			subject: payload.subject,
			html: payload.html,
		}),
	});

	if (!response.ok) {
		const text = await response.text().catch(() => "");
		console.error("[workflow/email] Resend send failed", response.status, text);
	}
}

export async function sendObraCompletionEmailEdge(
	options: ObraEmailTemplateInput
) {
	if (!options.obras.length) return;
	const subject = resolveObraCompletionSubject(options.subject, options.obras);
	const html = renderObraCompletionHtml({
		recipientName: options.recipientName,
		obras: options.obras,
		introMessage: options.introMessage,
	});
	await sendResendEmailEdge({
		to: options.to,
		subject,
		html,
	});
}

export async function sendSimpleEmailEdge(payload: EmailPayload) {
	await sendResendEmailEdge(payload);
}
