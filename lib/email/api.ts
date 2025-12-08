import { Resend } from "resend";
import { getVersionedSecret } from "@/lib/security/secrets";

const { value: resendKey, version: resendVersion } =
	getVersionedSecret("RESEND_API_KEY");
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
 *
 * NOTE: This module intentionally does NOT depend on `@react-email/*` so it can
 * be safely bundled for workflows / edge-like environments.
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
			version: resendVersion ?? "legacy",
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
