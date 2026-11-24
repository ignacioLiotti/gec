import { NextRequest, NextResponse } from "next/server";

import { resolveRequestAccessContext } from "@/lib/demo-session";
import { applyTemplateFormulaInputData, renderDocumentHtml } from "@/lib/document-generation";
import { loadDocumentGenerationPermissions } from "@/lib/document-generation-server";
import { loadReferenceSourceCatalog } from "@/lib/document-reference-sources";
import {
  buildSpecSampleInput,
  buildTemplateSpecGuide,
  compileTemplateSpec,
  validateTemplateSpec,
  type TemplateSpec,
} from "@/lib/document-template-spec";

/**
 * Template Spec entry point for the builder and for LLM integrations.
 *
 * GET  -> guide: spec shape, field types, formula functions, the tenant's
 *         reference sources and a complete example.
 * POST { spec } -> validation (errors by path) and, when valid, the
 *         compiled schema and a preview with sample values. Nothing is saved;
 *         save with POST/PUT /api/document-generation/templates { spec }.
 */
async function resolveTemplateManager() {
  const access = await resolveRequestAccessContext();
  const { user, tenantId, actorType } = access;
  if (!user && actorType !== "demo") return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!tenantId) return { error: NextResponse.json({ error: "No tenant" }, { status: 400 }) };
  const accessContext = {
    supabase: access.supabase,
    tenantId,
    userId: user?.id ?? null,
    permissionSimulation: access.permissionSimulation,
  };
  const permissions = await loadDocumentGenerationPermissions(accessContext);
  if (!permissions.canManageTemplates) {
    return { error: NextResponse.json({ error: "Sin permisos para administrar plantillas." }, { status: 403 }) };
  }
  return { accessContext };
}

export async function GET() {
  try {
    const resolved = await resolveTemplateManager();
    if ("error" in resolved) return resolved.error;
    const catalog = await loadReferenceSourceCatalog(resolved.accessContext);
    return NextResponse.json(buildTemplateSpecGuide(catalog));
  } catch (error) {
    console.error("[document-generation/spec:get]", error);
    return NextResponse.json({ error: "No se pudo cargar la guía de plantillas." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const resolved = await resolveTemplateManager();
    if ("error" in resolved) return resolved.error;
    const body = (await request.json().catch(() => null)) as { spec?: unknown } | null;
    const catalog = await loadReferenceSourceCatalog(resolved.accessContext);
    const validation = validateTemplateSpec(body?.spec, catalog);
    if (!validation.ok) return NextResponse.json(validation, { status: 422 });

    const spec = body?.spec as TemplateSpec;
    const compiled = compileTemplateSpec(spec);
    const sample = applyTemplateFormulaInputData(compiled.schema, buildSpecSampleInput(spec));
    return NextResponse.json({
      ...validation,
      compiled: { ...compiled, schema: { ...compiled.schema, spec: undefined } },
      previewHtml: renderDocumentHtml(compiled.contentHtml, sample, { workName: "Obra de ejemplo" }),
    });
  } catch (error) {
    console.error("[document-generation/spec:post]", error);
    return NextResponse.json({ error: "No se pudo validar la plantilla." }, { status: 500 });
  }
}
