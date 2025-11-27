import { Resend } from "resend";
import { getVersionedSecret } from "@/lib/security/secrets";
import {
	renderObraCompletionHtml,
	resolveObraCompletionSubject,
	type ObraEmailTemplateInput,
} from "@/lib/email/templates/obra-completion";

type CompletedObra = {
	name: string;
	percentage: number;
};

export async function sendObraCompletionEmail(options: {
	to: string;
	recipientName?: string | null;
	obras: CompletedObra[];
	subject?: string;
	introMessage?: string;
}) {
	const { value: resendKey } = getVersionedSecret("RESEND_API_KEY");
	const fromEmail = process.env.RESEND_FROM_EMAIL;

	if (!resendKey || !fromEmail || !options.obras.length) {
		return;
	}

	const subject = resolveObraCompletionSubject(
		options.subject,
		options.obras
	);

	const html = renderObraCompletionHtml({
		recipientName: options.recipientName,
		obras: options.obras,
		introMessage: options.introMessage,
	});

	const resend = new Resend(resendKey);
	await resend.emails.send({
		from: fromEmail,
		to: options.to,
		subject,
		html,
	});
}

export type { CompletedObra, ObraEmailTemplateInput };
