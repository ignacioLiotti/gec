import { NextRequest, NextResponse } from "next/server";

import { resolveRequestAccessContext } from "@/lib/demo-session";
import { composeReportFromContext } from "@/lib/document-ai/composer/compose-report";
import { hasDocumentAiPermission } from "@/lib/document-ai/permissions";
import { parseDocumentAiIntent } from "@/lib/document-ai/retrieval/parse-document-ai-intent";
import { retrieveDocumentAiContext } from "@/lib/document-ai/retrieval/retrieve-document-ai-context";

type QueryBody = {
  obraId?: string | null;
  folderPath?: string | null;
  prompt?: string;
  outputType?: string;
};

export async function POST(request: NextRequest) {
  try {
    const access = await resolveRequestAccessContext();
    const { supabase, user, tenantId, actorType } = access;
    if (!user && actorType !== "demo") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!tenantId || !user?.id) return NextResponse.json({ error: "No tenant" }, { status: 400 });
    if (!(await hasDocumentAiPermission(access))) {
      return NextResponse.json({ error: "Sin permisos para Document AI." }, { status: 403 });
    }

    const body = (await request.json().catch(() => ({}))) as QueryBody;
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    if (!prompt) return NextResponse.json({ error: "El prompt es obligatorio." }, { status: 400 });

    const intent = await parseDocumentAiIntent({
      prompt,
      outputType: body.outputType,
      obraId: typeof body.obraId === "string" ? body.obraId : null,
      folderPath: typeof body.folderPath === "string" ? body.folderPath : null,
    });
    const context = await retrieveDocumentAiContext({ supabase, tenantId, intent });
    const composition = composeReportFromContext(context);
    return NextResponse.json({ intent, context, composition });
  } catch (error) {
    console.error("[document-ai/query]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error en Document AI query" }, { status: 500 });
  }
}
