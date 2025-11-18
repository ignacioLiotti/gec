import { Resend } from "resend";
import { renderObraCompletionEmail } from "./obras";

const resendKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.RESEND_FROM_EMAIL;

let resendClient: Resend | null = null;
if (resendKey) {
	resendClient = new Resend(resendKey);
}

export type SendEmailInput = {
	to: string;
	subject: string;
	html: string;
};

/**
 * Low-level email send helper backed by Resend.
 * This is safe to call from any server context (API route, server action, workflow step).
 */
export async function sendEmail({
	to,
	subject,
	html,
}: SendEmailInput): Promise<void> {
	if (!resendClient || !fromEmail) {
		console.warn("Email API: missing config, skipping send", {
			hasKey: Boolean(resendKey),
			hasFrom: Boolean(fromEmail),
		});
		return;
	}

	await resendClient.emails.send({
		from: fromEmail,
		to,
		subject,
		html,
	});
}

/**
 * Obra completion convenience helper that reuses the React email template.
 */
export async function sendObraCompletionEmail(options: {
	to: string;
	recipientName?: string | null;
	obras: { name: string; percentage: number }[];
	subject?: string;
	introMessage?: string;
}): Promise<void> {
	if (!options.obras.length) return;

	const subject =
		options.subject ??
		(options.obras.length === 1
			? `Obra completada: ${options.obras[0].name}`
			: "Obras completadas recientemente");

	const html = await renderObraCompletionEmail({
		recipientName: options.recipientName,
		obras: options.obras,
		introMessage: options.introMessage,
	});

	await sendEmail({
		to: options.to,
		subject,
		html,
	});
}
