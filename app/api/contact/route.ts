import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sendEmail } from "@/lib/email/api";
import { getClientIp, rateLimitByIp } from "@/lib/security/rate-limit";

const contactSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  company: z.string().trim().max(200).optional().default(""),
  phone: z.string().trim().max(80).optional().default(""),
  message: z.string().trim().min(5).max(4000),
  reason: z.string().trim().max(80).optional().default("contacto"),
  website: z.string().trim().max(200).optional().default(""), // honeypot
  sourcePath: z.string().trim().max(200).optional().default("/"),
});

function escapeHtml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    if (ip) {
      const rate = await rateLimitByIp(`${ip}:contact`);
      if (rate.pending) await rate.pending;
      if (!rate.success) {
        return NextResponse.json(
          { error: "Demasiados intentos. Intentá de nuevo en unos minutos." },
          { status: 429 },
        );
      }
    }

    const json = await req.json();
    const parsed = contactSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const data = parsed.data;

    // Honeypot: respond success but do nothing.
    if (data.website) {
      return NextResponse.json({ ok: true });
    }

    const configuredRecipient = process.env.CONTACT_EMAIL?.trim();
    const to =
      configuredRecipient ||
      (process.env.NODE_ENV !== "production"
        ? "ignacioliotti@gmail.com"
        : "");
    if (!to || !process.env.RESEND_FROM_EMAIL) {
      console.error("[contact][POST] missing email configuration", {
        hasContactEmail: Boolean(configuredRecipient),
        hasFromEmail: Boolean(process.env.RESEND_FROM_EMAIL),
      });
      return NextResponse.json(
        { error: "Configuración de email incompleta." },
        { status: 500 },
      );
    }
    const originHost =
      req.headers.get("x-forwarded-host") ??
      req.headers.get("host") ??
      "unknown";

    await sendEmail({
      to,
      subject: `Nuevo contacto landing - ${data.reason}`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.5;color:#222">
          <h2 style="margin:0 0 12px">Nuevo contacto desde landing</h2>
          <p style="margin:0 0 12px"><strong>Motivo:</strong> ${escapeHtml(data.reason)}</p>
          <table style="border-collapse:collapse;width:100%;max-width:720px">
            <tr><td style="padding:6px 0"><strong>Nombre</strong></td><td style="padding:6px 0">${escapeHtml(data.name)}</td></tr>
            <tr><td style="padding:6px 0"><strong>Email</strong></td><td style="padding:6px 0">${escapeHtml(data.email)}</td></tr>
            <tr><td style="padding:6px 0"><strong>Empresa</strong></td><td style="padding:6px 0">${escapeHtml(data.company || "-")}</td></tr>
            <tr><td style="padding:6px 0"><strong>Teléfono</strong></td><td style="padding:6px 0">${escapeHtml(data.phone || "-")}</td></tr>
            <tr><td style="padding:6px 0"><strong>Ruta</strong></td><td style="padding:6px 0">${escapeHtml(data.sourcePath || "/")}</td></tr>
            <tr><td style="padding:6px 0"><strong>Host</strong></td><td style="padding:6px 0">${escapeHtml(originHost)}</td></tr>
            <tr><td style="padding:6px 0"><strong>Fecha</strong></td><td style="padding:6px 0">${escapeHtml(new Date().toISOString())}</td></tr>
          </table>
          <div style="margin-top:16px;padding:12px;border:1px solid #e5e5e5;border-radius:8px;background:#fafafa;white-space:pre-wrap">${escapeHtml(data.message)}</div>
        </div>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[contact][POST] failed", error);
    return NextResponse.json(
      { error: "No se pudo enviar el mensaje." },
      { status: 500 },
    );
  }
}
