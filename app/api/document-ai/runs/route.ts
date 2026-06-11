import { NextRequest, NextResponse } from "next/server";

import { resolveRequestAccessContext } from "@/lib/demo-session";
import { runDocumentAi } from "@/lib/document-ai/orchestrate-run";
import { hasDocumentAiPermission } from "@/lib/document-ai/permissions";
import { DOCUMENT_AI_OUTPUT_TYPES, type DocumentAiOutputType } from "@/lib/document-ai/schemas/types";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";

type RunRequestBody = {
  obraId?: string | null;
  folderPath?: string | null;
  prompt?: string;
  outputType?: string;
};

function normalizeOutputType(value: unknown): DocumentAiOutputType {
  return typeof value === "string" && DOCUMENT_AI_OUTPUT_TYPES.includes(value as DocumentAiOutputType)
    ? (value as DocumentAiOutputType)
    : "summary";
}

function noStoreJson(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
      ...(init?.headers ?? {}),
    },
  });
}

export async function GET() {
  try {
    const access = await resolveRequestAccessContext();
    const { supabase, user, tenantId, actorType } = access;
    if (!user && actorType !== "demo") return noStoreJson({ error: "Unauthorized" }, { status: 401 });
    if (!tenantId || !user?.id) return noStoreJson({ error: "No tenant" }, { status: 400 });
    if (!(await hasDocumentAiPermission(access))) {
      return noStoreJson({ error: "Sin permisos para Document AI." }, { status: 403 });
    }

    const { data, error } = await supabase
      .from("document_ai_runs")
      .select("id, obra_id, prompt, output_type, status, intent, result, warnings, error, created_at, document_ai_outputs(id, output_type, file_name, storage_path, mime_type)")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw error;
    return noStoreJson({ runs: data ?? [] });
  } catch (error) {
    console.error("[document-ai/runs:get]", error);
    return noStoreJson({ error: error instanceof Error ? error.message : "Error al cargar runs" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await resolveRequestAccessContext();
    const { supabase, user, tenantId, actorType } = access;
    if (!user && actorType !== "demo") return noStoreJson({ error: "Unauthorized" }, { status: 401 });
    if (!tenantId || !user?.id) return noStoreJson({ error: "No tenant" }, { status: 400 });
    if (!(await hasDocumentAiPermission(access))) {
      return noStoreJson({ error: "Sin permisos para Document AI." }, { status: 403 });
    }

    const body = (await request.json().catch(() => ({}))) as RunRequestBody;
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    if (!prompt) return noStoreJson({ error: "El prompt es obligatorio." }, { status: 400 });

    const admin = createSupabaseAdminClient();
    const outputType = normalizeOutputType(body.outputType);
    const result = await runDocumentAi({
      supabase,
      admin,
      tenantId,
      userId: user.id,
      obraId: typeof body.obraId === "string" ? body.obraId : null,
      folderPath: typeof body.folderPath === "string" ? body.folderPath : null,
      prompt,
      outputType,
      pdfRenderer:
        outputType === "pdf"
          ? async (html) => {
              const pdfResponse = await fetch(new URL("/api/pdf-render", request.url), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  html,
                  options: {
                    companyName: "Sintesis",
                    reportTitle: "Document AI",
                    date: new Date().toLocaleDateString("es-AR"),
                    format: "A4",
                    landscape: false,
                  },
                }),
              });
              if (!pdfResponse.ok) {
                const payload = await pdfResponse.json().catch(() => ({}));
                throw new Error(typeof payload.error === "string" ? payload.error : "No se pudo renderizar PDF.");
              }
              return new Uint8Array(await pdfResponse.arrayBuffer());
            }
          : undefined,
    });

    return noStoreJson(result);
  } catch (error) {
    console.error("[document-ai/runs:post]", error);
    return noStoreJson({ error: error instanceof Error ? error.message : "Error al ejecutar Document AI" }, { status: 500 });
  }
}
