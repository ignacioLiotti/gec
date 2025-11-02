import { sleep } from "workflow";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";
import { Resend } from "resend";

type ExpandedEffect = {
  channel: "in-app" | "email";
  when: "now" | Date | ((ctx: any) => Date | "now");
  title?: (ctx: any) => string;
  body?: (ctx: any) => string | null | undefined;
  subject?: (ctx: any) => string | null | undefined;
  html?: (ctx: any) => string | null | undefined;
  actionUrl?: (ctx: any) => string | null | undefined;
  data?: (ctx: any) => any;
  type?: string;
  ctx: any;
  recipientId?: string | null;
  recipientEmail?: string | null;
};

export async function deliverEffectsWorkflow(effects: ExpandedEffect[]) {
  "use workflow";

  for (const eff of effects) {
    const at = typeof eff.when === "function" ? eff.when(eff.ctx) : eff.when;
    if (at && at !== "now") {
      await sleep(new Date(at));
    }

    if (eff.channel === "in-app") {
      "use step";
      const s = createSupabaseAdminClient();
      await s.from("notifications").insert({
        user_id: eff.recipientId,
        tenant_id: eff.ctx?.tenantId ?? null,
        title: eff.title?.(eff.ctx) ?? "",
        body: eff.body?.(eff.ctx) ?? null,
        type: eff.type ?? "info",
        action_url: eff.actionUrl?.(eff.ctx) ?? null,
        data: eff.data?.(eff.ctx) ?? {},
      });
    } else if (eff.channel === "email") {
      "use step";
      const resendKey = process.env.RESEND_API_KEY;
      const fromEmail = process.env.RESEND_FROM_EMAIL;
      if (!resendKey || !fromEmail || !eff.recipientEmail) {
        continue;
      }
      const subject = eff.subject?.(eff.ctx) ?? "Notificación";
      const html =
        eff.html?.(eff.ctx) ??
        `<p>${eff.title?.(eff.ctx) ?? "Notificación"}</p><p>${
          eff.body?.(eff.ctx) ?? ""
        }</p>`;
      const resend = new Resend(resendKey);
      await resend.emails.send({
        from: fromEmail,
        to: eff.recipientEmail,
        subject,
        html,
      });
    }
  }
}



