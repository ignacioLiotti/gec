import { Resend } from "resend";
import { getVersionedSecret } from "@/lib/security/secrets";

type CompletedObra = {
  name: string;
  percentage: number;
};

function createEmailHtml(
  recipientName: string | null | undefined,
  obras: CompletedObra[],
  introMessage?: string
): string {
  const greeting = recipientName ? `Hola ${recipientName},` : "Hola,";
  const message = introMessage ?? "Te informamos que las siguientes obras alcanzaron el 100% de avance:";
  const obrasList = obras
    .map((obra) => `<li style="margin-bottom: 6px;"><strong>${obra.name}</strong> (${obra.percentage}%)</li>`)
    .join("");

  return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
  </head>
  <body style="background-color: #f6f9fc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0;">
    <div style="background-color: #ffffff; border-radius: 8px; padding: 24px; margin: 24px auto; max-width: 520px; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08);">
      <p style="font-size: 18px; font-weight: 600; color: #111827; margin-bottom: 12px;">${greeting}</p>
      <p style="font-size: 14px; color: #374151; line-height: 1.6; margin-bottom: 12px;">${message}</p>
      <ul style="margin: 0 0 16px; padding-left: 20px; color: #1f2937; font-size: 14px;">${obrasList}</ul>
      <p style="font-size: 14px; color: #374151; line-height: 1.6; margin-bottom: 12px;">
        ¡Felicitaciones por el progreso! Si necesitás revisar más detalles, podés hacerlo desde el panel de obras.
      </p>
      <p style="font-size: 14px; color: #374151; line-height: 1.6; margin-bottom: 12px;">Saludos,</p>
      <p style="font-size: 14px; color: #111827; font-weight: 600; margin-top: 8px;">Equipo Multi-Tenant</p>
    </div>
  </body>
</html>`.trim();
}

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

  const subject = options.subject ??
    (options.obras.length === 1
      ? `Obra completada: ${options.obras[0].name}`
      : "Obras completadas recientemente");

  const html = createEmailHtml(options.recipientName, options.obras, options.introMessage);

  const resend = new Resend(resendKey);
  await resend.emails.send({
    from: fromEmail,
    to: options.to,
    subject,
    html,
  });
}
