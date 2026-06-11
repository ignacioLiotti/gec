import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  DocumentAiOutputType,
  ReportComposition,
  RetrievedDocumentAiContext,
} from "@/lib/document-ai/schemas/types";
import type { RenderedDocumentAiOutput } from "@/lib/document-ai/renderers/render-output";

const OUTPUT_BUCKET = "document-ai-outputs";

export async function createDocumentAiRun(params: {
  supabase: SupabaseClient;
  tenantId: string;
  userId: string;
  obraId?: string | null;
  prompt: string;
  outputType: DocumentAiOutputType;
}) {
  const { data, error } = await params.supabase
    .from("document_ai_runs")
    .insert({
      tenant_id: params.tenantId,
      obra_id: params.obraId ?? null,
      user_id: params.userId,
      prompt: params.prompt,
      output_type: params.outputType,
      status: "pending",
    })
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return String(data?.id ?? "");
}

export async function updateDocumentAiRunState(params: {
  supabase: SupabaseClient;
  runId: string;
  status: string;
  intent?: unknown;
  retrievedContext?: unknown;
  result?: unknown;
  warnings?: string[];
  error?: string | null;
}) {
  const { error } = await params.supabase
    .from("document_ai_runs")
    .update({
      status: params.status,
      ...(params.intent !== undefined ? { intent: params.intent } : {}),
      ...(params.retrievedContext !== undefined ? { retrieved_context: params.retrievedContext } : {}),
      ...(params.result !== undefined ? { result: params.result } : {}),
      ...(params.warnings !== undefined ? { warnings: params.warnings } : {}),
      ...(params.error !== undefined ? { error: params.error } : {}),
    })
    .eq("id", params.runId);
  if (error) throw error;
}

export async function persistDocumentAiSources(params: {
  supabase: SupabaseClient;
  runId: string;
  tenantId: string;
  context: RetrievedDocumentAiContext;
}) {
  if (params.context.sources.length === 0) return;
  const payload = params.context.sources.slice(0, 300).map((source) => ({
    run_id: params.runId,
    tenant_id: params.tenantId,
    obra_id: source.obraId ?? null,
    document_id: source.documentId ?? null,
    table_id: source.tableId ?? null,
    row_id: source.rowId ?? null,
    field_key: source.fieldKey ?? null,
    source_value: null,
    normalized_value: null,
    confidence: source.confidence ?? 0,
    lineage: source,
  }));
  const { error } = await params.supabase.from("document_ai_sources").insert(payload);
  if (error) throw error;
}

export async function persistDocumentAiOutput(params: {
  supabase: SupabaseClient;
  admin: SupabaseClient;
  runId: string;
  tenantId: string;
  output: RenderedDocumentAiOutput;
  composition: ReportComposition;
}) {
  const storagePath = `${params.tenantId}/${params.runId}/${params.output.fileName}`;
  const { error: uploadError } = await params.admin.storage
    .from(OUTPUT_BUCKET)
    .upload(storagePath, params.output.bytes, {
      contentType: params.output.mimeType,
      upsert: true,
    });
  if (uploadError) throw uploadError;

  const { data, error } = await params.supabase
    .from("document_ai_outputs")
    .insert({
      run_id: params.runId,
      tenant_id: params.tenantId,
      output_type: params.output.outputType,
      storage_bucket: OUTPUT_BUCKET,
      storage_path: storagePath,
      file_name: params.output.fileName,
      mime_type: params.output.mimeType,
      preview: {
        title: params.composition.title,
        summary: params.composition.executiveSummary,
        chartCount: params.composition.charts.length,
        tableCount: params.composition.tables.length,
        warningCount: params.composition.warnings.length,
      },
    })
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data;
}
