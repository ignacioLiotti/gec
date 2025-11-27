import { sendEmail } from "@/lib/email/api";

type InvitationEmailPayload = {
	to: string;
	inviteLink: string;
	tenantName: string;
	inviterName?: string | null;
};

function renderInvitationHtml({
	tenantName,
	inviterName,
	inviteLink,
}: InvitationEmailPayload) {
	const greeter = inviterName ? `${inviterName} te invitó` : "Fuiste invitado";
	return `
		<!DOCTYPE html>
		<html>
		<body style="font-family: Arial, sans-serif;">
			<h2>${greeter} a ${tenantName}</h2>
			<p>Hacé clic en el siguiente enlace para unirte:</p>
			<p><a href="${inviteLink}" target="_blank">${inviteLink}</a></p>
			<p>Si no solicitaste este acceso, podés ignorar este correo.</p>
		</body>
		</html>
	`;
}

export async function sendInvitationEmail(payload: InvitationEmailPayload) {
	await sendEmail({
		to: payload.to,
		subject: `Invitación a ${payload.tenantName}`,
		html: renderInvitationHtml(payload),
	});
}
