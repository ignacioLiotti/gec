import { NextRequest, NextResponse } from "next/server";
import { resolveRequestAccessContext } from "@/lib/demo-session";
import { persistDocumentAiOutput } from "@/lib/document-ai/audit/persist-document-ai-run";
import { renderDocumentAiOutput } from "@/lib/document-ai/renderers/render-output";
import { DOCUMENT_AI_OUTPUT_TYPES, type DocumentAiOutputType, type ReportComposition } from "@/lib/document-ai/schemas/types";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";

type RouteContext = { params: Promise<{ id: string }> };

function normalizeOutputType(value: unknown): DocumentAiOutputType {
  return typeof value === "string" && DOCUMENT_AI_OUTPUT_TYPES.includes(value as DocumentAiOutputType)
    ? (value as DocumentAiOutputType)
    : "pdf";
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const access = await resolveRequestAccessContext();
    const { supabase, user, tenantId, actorType } = access;
    if (!user && actorType !== "demo") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!tenantId || !user?.id) return NextResponse.json({ error: "No tenant" }, { status: 400 });

    const { data: run, error } = await supabase
      .from("document_ai_runs")
      .select("id, tenant_id, result")
      .eq("tenant_id", tenantId)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!run) return NextResponse.json({ error: "Run no encontrado." }, { status: 404 });

    const body = (await request.json().catch(() => ({}))) as { outputType?: string };
    const outputType = normalizeOutputType(body.outputType);
    const composition = run.result as ReportComposition;
    const admin = createSupabaseAdminClient();
    const rendered = await renderDocumentAiOutput({
      composition,
      outputType,
      pdfRenderer:
        outputType === "pdf"
          ? async (html) => {
              const pdfResponse = await fetch(new URL("/api/pdf-render", request.url), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ html, options: { companyName: "Sintesis", reportTitle: composition.title, format: "A4" } }),
              });
              if (!pdfResponse.ok) throw new Error("No se pudo renderizar PDF.");
              return new Uint8Array(await pdfResponse.arrayBuffer());
            }
          : undefined,
    });
    const output = await persistDocumentAiOutput({
      supabase,
      admin,
      runId: id,
      tenantId,
      output: rendered,
      composition,
    });
    return NextResponse.json({ output });
  } catch (error) {
    console.error("[document-ai/render]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error al renderizar output" }, { status: 500 });
  }
}
