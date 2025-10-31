import ObraCompletionEmail from "@/emails/obra-completion";
import { render } from "@react-email/render";
import { Resend } from "resend";

type CompletedObra = {
  name: string;
  percentage: number;
};

// Render the email template to HTML (not used in workflow steps)
export async function renderObraCompletionEmail(options: {
  recipientName?: string | null;
  obras: CompletedObra[];
  introMessage?: string;
}): Promise<string> {
  return await render(
    <ObraCompletionEmail
      recipientName={options.recipientName}
      obras={options.obras}
      introMessage={options.introMessage}
    />
  );
}

// Send email function (can be used in workflow steps)
export async function sendObraCompletionEmail(options: {
  to: string;
  recipientName?: string | null;
  obras: CompletedObra[];
  subject?: string;
  introMessage?: string;
  html?: string; // Pre-rendered HTML to avoid React in workflow steps
}) {
  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;

  console.log("Email: sending obra completion email", {
    to: options.to,
    count: options.obras.length,
    subject: options.subject,
    introMessage: options.introMessage,
    recipientName: options.recipientName,
    obras: options.obras,
  });

  if (!resendKey || !fromEmail) {
    console.warn(
      "Email: missing config, skipping send",
      {
        hasKey: Boolean(resendKey),
        hasFrom: Boolean(fromEmail),
      }
    );
    return;
  }

  if (!options.obras.length) {
    console.info("Email: no obras to include, skipping send");
    return;
  }

  const resend = new Resend(resendKey);
  const subject =
    options.subject ??
    (options.obras.length === 1
      ? `Obra completada: ${options.obras[0].name}`
      : "Obras completadas recientemente");

  try {
    console.info("Email: sending obra completion email", {
      to: options.to,
      count: options.obras.length,
      subject,
    });

    // Use pre-rendered HTML if provided, otherwise render it now
    const html = options.html ?? await renderObraCompletionEmail({
      recipientName: options.recipientName,
      obras: options.obras,
      introMessage: options.introMessage,
    });

    await resend.emails.send({
      from: fromEmail,
      to: options.to,
      subject,
      html,
    });
    console.info("Email: obra completion email sent successfully");
  } catch (error) {
    console.error("Email: failed to send obra completion email", error);
  }
}