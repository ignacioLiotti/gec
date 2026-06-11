import type { SupabaseClient } from "@supabase/supabase-js";
import { composeReportFromContext } from "@/lib/document-ai/composer/compose-report";
import { parseDocumentAiIntent } from "@/lib/document-ai/retrieval/parse-document-ai-intent";
import { retrieveDocumentAiContext } from "@/lib/document-ai/retrieval/retrieve-document-ai-context";
import { renderDocumentAiOutput } from "@/lib/document-ai/renderers/render-output";
import type { DocumentAiOutputType } from "@/lib/document-ai/schemas/types";
import {
  createDocumentAiRun,
  persistDocumentAiOutput,
  persistDocumentAiSources,
  updateDocumentAiRunState,
} from "@/lib/document-ai/audit/persist-document-ai-run";

export async function runDocumentAi(params: {
  supabase: SupabaseClient;
  admin: SupabaseClient;
  tenantId: string;
  userId: string;
  obraId?: string | null;
  folderPath?: string | null;
  prompt: string;
  outputType: DocumentAiOutputType;
  pdfRenderer?: (html: string) => Promise<Uint8Array>;
}) {
  const runId = await createDocumentAiRun({
    supabase: params.supabase,
    tenantId: params.tenantId,
    userId: params.userId,
    obraId: params.obraId,
    prompt: params.prompt,
    outputType: params.outputType,
  });

  try {
    await updateDocumentAiRunState({ supabase: params.supabase, runId, status: "retrieving" });
    const intent = await parseDocumentAiIntent({
      prompt: params.prompt,
      outputType: params.outputType,
      obraId: params.obraId,
      folderPath: params.folderPath,
    });
    const context = await retrieveDocumentAiContext({
      supabase: params.supabase,
      tenantId: params.tenantId,
      intent,
    });
    await updateDocumentAiRunState({
      supabase: params.supabase,
      runId,
      status: "composing",
      intent,
      retrievedContext: context,
      warnings: context.warnings,
    });
    const composition = composeReportFromContext(context);
    await persistDocumentAiSources({
      supabase: params.supabase,
      runId,
      tenantId: params.tenantId,
      context,
    });
    await updateDocumentAiRunState({
      supabase: params.supabase,
      runId,
      status: "rendering",
      result: composition,
      warnings: composition.warnings,
    });
    const output = await renderDocumentAiOutput({
      composition,
      outputType: params.outputType,
      pdfRenderer: params.pdfRenderer,
    });
    const outputRow = await persistDocumentAiOutput({
      supabase: params.supabase,
      admin: params.admin,
      runId,
      tenantId: params.tenantId,
      output,
      composition,
    });
    await updateDocumentAiRunState({
      supabase: params.supabase,
      runId,
      status: "completed",
      result: composition,
      warnings: composition.warnings,
    });
    return { runId, intent, context, composition, output: outputRow };
  } catch (error) {
    await updateDocumentAiRunState({
      supabase: params.supabase,
      runId,
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
}
