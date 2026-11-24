import { NextRequest, NextResponse } from "next/server";

import { estimateUsdForTokens } from "@/lib/ai-pricing";
import { resolveRequestAccessContext } from "@/lib/demo-session";
import {
  runTemplateAssistant,
  TEMPLATE_ASSISTANT_DEFAULT_EFFORT,
  TEMPLATE_ASSISTANT_DEFAULT_MODEL,
  type AssistantAttachment,
  type AssistantMessage,
} from "@/lib/document-template-assistant";
import { loadDocumentGenerationPermissions } from "@/lib/document-generation-server";
import { loadReferenceSourceCatalog } from "@/lib/document-reference-sources";
import type { TemplateSpec } from "@/lib/document-template-spec";
import { fetchTenantPlan, type SubscriptionPlanLimits } from "@/lib/subscription-plans";
import { incrementTenantUsage, logTenantUsageEvent } from "@/lib/tenant-usage";

/**
 * POST { spec, messages: [{ role, content }], attachment?: { name, mimeType, dataUrl } }
 * -> { reply, changes, spec | null } with a spec that already passed validation.
 * Nothing is saved; the builder publishes through /api/document-generation/templates.
 */
export const maxDuration = 300;

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const ATTACHMENT_TYPES = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp", "image/gif"]);
const TOKEN_RESERVE = 30_000;

function readMessages(raw: unknown): AssistantMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => entry as { role?: unknown; content?: unknown })
    .filter((entry) => (entry.role === "user" || entry.role === "assistant") && typeof entry.content === "string" && entry.content.trim())
    .map((entry) => ({ role: entry.role as AssistantMessage["role"], content: String(entry.content).trim().slice(0, 4000) }));
}

function readAttachment(raw: unknown): AssistantAttachment | null | "invalid" {
  if (raw == null) return null;
  const candidate = raw as Partial<AssistantAttachment>;
  if (typeof candidate.dataUrl !== "string" || typeof candidate.mimeType !== "string" || !ATTACHMENT_TYPES.has(candidate.mimeType)) return "invalid";
  if (!candidate.dataUrl.startsWith(`data:${candidate.mimeType};base64,`)) return "invalid";
  const base64Length = candidate.dataUrl.length - candidate.dataUrl.indexOf(",") - 1;
  if (base64Length * 0.75 > MAX_ATTACHMENT_BYTES) return "invalid";
  return { name: typeof candidate.name === "string" ? candidate.name.slice(0, 120) : "documento", mimeType: candidate.mimeType, dataUrl: candidate.dataUrl };
}

export async function POST(request: NextRequest) {
  const access = await resolveRequestAccessContext();
  const { user, tenantId, supabase } = access;
  if (!user?.id || !tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const accessContext = { supabase, tenantId, userId: user.id, permissionSimulation: access.permissionSimulation };
  const permissions = await loadDocumentGenerationPermissions(accessContext);
  if (!permissions.canManageTemplates) {
    return NextResponse.json({ error: "Sin permisos para administrar plantillas." }, { status: 403 });
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "El asistente no está configurado (falta OPENAI_API_KEY)." }, { status: 503 });

  const body = (await request.json().catch(() => null)) as { spec?: unknown; messages?: unknown; attachment?: unknown } | null;
  const messages = readMessages(body?.messages);
  if (messages.at(-1)?.role !== "user") return NextResponse.json({ error: "Escribí un pedido." }, { status: 400 });
  const spec = body?.spec as TemplateSpec | undefined;
  if (!spec || typeof spec !== "object" || !Array.isArray(spec.sections)) {
    return NextResponse.json({ error: "Falta la plantilla actual." }, { status: 400 });
  }
  const attachment = readAttachment(body?.attachment);
  if (attachment === "invalid") {
    return NextResponse.json({ error: "Adjuntá un PDF o una imagen (PNG, JPG o WebP) de hasta 10 MB." }, { status: 400 });
  }

  // Reserve tokens up front so a tenant over its AI quota gets a clear error.
  let limits: SubscriptionPlanLimits | null = null;
  let reserved = 0;
  try {
    const plan = await fetchTenantPlan(supabase, tenantId);
    limits = plan.limits;
    if (typeof limits.aiTokens === "number" && limits.aiTokens > 0) {
      await incrementTenantUsage(supabase, tenantId, { aiTokens: TOKEN_RESERVE }, limits);
      reserved = TOKEN_RESERVE;
    }
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "ai_limit_exceeded") {
      return NextResponse.json({ error: "Tu organización no tiene tokens de IA disponibles este mes." }, { status: 402 });
    }
    console.warn("[document-generation/assistant] usage reservation skipped", error);
  }

  const model = process.env.DOCUMENT_TEMPLATE_ASSISTANT_MODEL || TEMPLATE_ASSISTANT_DEFAULT_MODEL;
  const effort = process.env.DOCUMENT_TEMPLATE_ASSISTANT_EFFORT || TEMPLATE_ASSISTANT_DEFAULT_EFFORT;
  let usedTokens = 0;
  try {
    const catalog = await loadReferenceSourceCatalog(accessContext);
    const startedAt = Date.now();
    const result = await runTemplateAssistant({ apiKey, model, effort, spec, messages, attachment, catalog });
    usedTokens = result.usage.totalTokens;
    console.info("[document-generation/assistant]", {
      model,
      effort,
      attempts: result.attempts,
      ms: Date.now() - startedAt,
      tokens: result.usage,
      ok: result.ok,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error, issues: result.issues }, { status: 422 });
    }
    return NextResponse.json({ reply: result.reply, changes: result.changes, spec: result.spec });
  } catch (error) {
    console.error("[document-generation/assistant]", error);
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    return NextResponse.json(
      { error: timedOut ? "El asistente tardó demasiado. Probá con un pedido más corto." : "El asistente no pudo responder. Probá de nuevo." },
      { status: 502 },
    );
  } finally {
    if (limits && reserved > 0 && usedTokens !== reserved) {
      await incrementTenantUsage(supabase, tenantId, { aiTokens: usedTokens - reserved }, limits).catch(() => undefined);
    }
    if (usedTokens > 0) {
      await logTenantUsageEvent(supabase, {
        tenantId,
        kind: "ai_tokens",
        amount: usedTokens,
        context: "document-template-assistant",
        metadata: { model, effort, attachment: Boolean(attachment), costUsd: estimateUsdForTokens(model, usedTokens) },
      });
    }
  }
}
