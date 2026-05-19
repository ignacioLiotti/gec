import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { resolveRequestAccessContext } from "@/lib/demo-session";
import {
  normalizeDocumentType,
  normalizeFolderGenerationPath,
  normalizeTemplateSchema,
  type TemplateField,
} from "@/lib/document-generation";
import {
  loadDocumentGenerationPermissions,
  loadFolderFieldSuggestions,
  loadFolderGenerationConfigs,
  loadTemplateCatalog,
} from "@/lib/document-generation-server";
import { normalizeFieldKey } from "@/lib/tablas";

type UpdateTemplateBody = {
  templateId?: string;
  name?: string;
  description?: string | null;
  documentType?: string;
  targetFolderPath?: string | null;
  status?: string;
  schema?: unknown;
  contentHtml?: string;
};

const TEMPLATE_STATUSES = new Set(["draft", "active", "inactive", "archived"]);

export async function GET(request: NextRequest) {
  try {
    const access = await resolveRequestAccessContext();
    const { user, tenantId, actorType } = access;

    if (!user && actorType !== "demo") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!tenantId) {
      return NextResponse.json({ error: "No tenant" }, { status: 400 });
    }

    const workId = request.nextUrl.searchParams.get("workId");
    const accessContext = {
      supabase: access.supabase,
      tenantId,
      userId: user?.id ?? null,
    };
    const permissions = await loadDocumentGenerationPermissions(accessContext);
    if (!permissions.canManageTemplates) {
      return NextResponse.json({ error: "Sin permisos para ver plantillas." }, { status: 403 });
    }

    const [templates, folderConfigs, folderFieldSuggestions] = await Promise.all([
      loadTemplateCatalog(accessContext),
      loadFolderGenerationConfigs(accessContext, workId),
      loadFolderFieldSuggestions(accessContext, workId),
    ]);

    return NextResponse.json({
      templates,
      folderConfigs,
      folderFieldSuggestions,
    });
  } catch (error) {
    console.error("[document-generation/templates:get]", error);
    const message = error instanceof Error ? error.message : "Error al cargar templates";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const access = await resolveRequestAccessContext();
    const { supabase, user, tenantId, actorType } = access;

    if (!user && actorType !== "demo") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!tenantId) {
      return NextResponse.json({ error: "No tenant" }, { status: 400 });
    }

    const accessContext = {
      supabase,
      tenantId,
      userId: user?.id ?? null,
    };
    const permissions = await loadDocumentGenerationPermissions(accessContext);
    if (!permissions.canManageTemplates) {
      return NextResponse.json({ error: "Sin permisos para editar plantillas." }, { status: 403 });
    }

    const body = (await request.json().catch(() => ({}))) as UpdateTemplateBody;
    const templateId = typeof body.templateId === "string" ? body.templateId.trim() : "";
    if (!templateId) {
      return NextResponse.json({ error: "Template requerida." }, { status: 400 });
    }

    const { data: baseTemplate, error: baseTemplateError } = await supabase
      .from("document_generation_templates")
      .select("id, tenant_id, key, version, is_system")
      .eq("id", templateId)
      .maybeSingle();
    if (baseTemplateError) throw baseTemplateError;
    if (!baseTemplate) {
      return NextResponse.json({ error: "Template no encontrada." }, { status: 404 });
    }

    if (baseTemplate.tenant_id && baseTemplate.tenant_id !== tenantId) {
      return NextResponse.json({ error: "Template no accesible para este tenant." }, { status: 403 });
    }

    const name = typeof body.name === "string" && body.name.trim().length > 0 ? body.name.trim() : null;
    const documentType = normalizeDocumentType(body.documentType);
    const status =
      typeof body.status === "string" && TEMPLATE_STATUSES.has(body.status)
        ? body.status
        : "active";
    const contentHtml =
      typeof body.contentHtml === "string" && body.contentHtml.trim().length > 0
        ? body.contentHtml
        : null;

    if (!name) {
      return NextResponse.json({ error: "El nombre de la template es obligatorio." }, { status: 400 });
    }
    if (!documentType) {
      return NextResponse.json({ error: "El tipo documental es obligatorio." }, { status: 400 });
    }
    if (!contentHtml) {
      return NextResponse.json({ error: "El HTML visual de la template es obligatorio." }, { status: 400 });
    }

    const schema = normalizeTemplateSchema(body.schema);
    const normalizedFields = schema.fields.map((field, index) => normalizeTemplateField(field, index));
    const uniqueKeys = new Set(normalizedFields.map((field) => field.key));
    if (uniqueKeys.size !== normalizedFields.length) {
      return NextResponse.json({ error: "Los campos deben tener key unica." }, { status: 400 });
    }

    const targetFolderPath = normalizeFolderGenerationPath(body.targetFolderPath);
    const schemaPayload = {
      fields: normalizedFields,
      documentNumberFieldKey: schema.documentNumberFieldKey ?? null,
      fileNamePattern: schema.fileNamePattern ?? null,
    };

    if (baseTemplate.tenant_id === tenantId) {
      const { data: updated, error: updateError } = await supabase
        .from("document_generation_templates")
        .update({
          name,
          description:
            typeof body.description === "string" && body.description.trim().length > 0
              ? body.description.trim()
              : null,
          document_type: documentType,
          target_folder_path: targetFolderPath || null,
          status,
          schema: schemaPayload,
          content_html: contentHtml,
        })
        .eq("id", baseTemplate.id)
        .eq("tenant_id", tenantId)
        .select("id")
        .maybeSingle();
      if (updateError) throw updateError;

      return await respondWithTemplate(supabase, tenantId, updated?.id ?? baseTemplate.id);
    }

    const { data: existingOverride, error: existingOverrideError } = await supabase
      .from("document_generation_templates")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("key", baseTemplate.key)
      .eq("version", baseTemplate.version)
      .maybeSingle();
    if (existingOverrideError) throw existingOverrideError;

    if (existingOverride?.id) {
      const { error: overrideUpdateError } = await supabase
        .from("document_generation_templates")
        .update({
          name,
          description:
            typeof body.description === "string" && body.description.trim().length > 0
              ? body.description.trim()
              : null,
          document_type: documentType,
          target_folder_path: targetFolderPath || null,
          status,
          schema: schemaPayload,
          content_html: contentHtml,
          is_system: false,
        })
        .eq("id", existingOverride.id)
        .eq("tenant_id", tenantId);
      if (overrideUpdateError) throw overrideUpdateError;

      return await respondWithTemplate(supabase, tenantId, existingOverride.id);
    }

    const { data: inserted, error: insertError } = await supabase
      .from("document_generation_templates")
      .insert({
        tenant_id: tenantId,
        key: baseTemplate.key,
        name,
        description:
          typeof body.description === "string" && body.description.trim().length > 0
            ? body.description.trim()
            : null,
        document_type: documentType,
        target_folder_path: targetFolderPath || null,
        version: baseTemplate.version,
        status,
        is_system: false,
        created_by: actorType === "user" ? user?.id ?? null : null,
        schema: schemaPayload,
        content_html: contentHtml,
      })
      .select("id")
      .maybeSingle();
    if (insertError) throw insertError;

    return await respondWithTemplate(supabase, tenantId, inserted?.id ?? "");
  } catch (error) {
    console.error("[document-generation/templates:put]", error);
    const message = error instanceof Error ? error.message : "Error al guardar template";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function normalizeTemplateField(field: TemplateField, index: number): TemplateField {
  const key = normalizeFieldKey(field.key || field.label || `campo_${index + 1}`);
  const type = field.type;
  return {
    key,
    label: field.label?.trim() || `Campo ${index + 1}`,
    type,
    required: Boolean(field.required),
    source: field.source === "folder" ? "folder" : "extra",
    description:
      typeof field.description === "string" && field.description.trim().length > 0
        ? field.description.trim()
        : null,
    defaultValue: field.defaultValue,
    options:
      type === "select" && Array.isArray(field.options)
        ? field.options
            .filter((option) => option && typeof option.value === "string")
            .map((option) => ({
              label: typeof option.label === "string" && option.label.trim().length > 0 ? option.label.trim() : option.value,
              value: option.value,
              unit: typeof option.unit === "string" && option.unit.trim().length > 0 ? option.unit.trim() : null,
            }))
        : undefined,
    selectMode:
      field.selectMode === "creatable" || field.selectMode === "strict"
        ? field.selectMode
        : undefined,
    optionSource:
      field.optionSource === "tenant_users" || field.optionSource === "manual"
        ? field.optionSource
        : undefined,
    optionUnitTargetKey:
      typeof field.optionUnitTargetKey === "string" && field.optionUnitTargetKey.trim().length > 0
        ? normalizeFieldKey(field.optionUnitTargetKey)
        : null,
    extractionFieldKey:
      typeof field.extractionFieldKey === "string" && field.extractionFieldKey.trim().length > 0
        ? normalizeFieldKey(field.extractionFieldKey)
        : null,
    autoPopulate: normalizeAutoPopulate(field.autoPopulate),
    repeatableGroup:
      typeof field.repeatableGroup === "string" && field.repeatableGroup.trim().length > 0
        ? normalizeFieldKey(field.repeatableGroup)
        : null,
    repeatableGroupLabel:
      typeof field.repeatableGroupLabel === "string" && field.repeatableGroupLabel.trim().length > 0
        ? field.repeatableGroupLabel.trim()
        : null,
    columns:
      type === "table" && Array.isArray(field.columns)
        ? field.columns.map((column, columnIndex) => normalizeTemplateField(column, columnIndex))
        : undefined,
  };
}

function normalizeAutoPopulate(value: TemplateField["autoPopulate"] | "work_id" | "work_label" | "next_document_number" | undefined) {
  if (value === "work_id") return "selected_context_id";
  if (value === "work_label") return "selected_context_label";
  if (value === "next_document_number") return "next_sequence_number";
  if (
    value === "none" ||
    value === "selected_context_id" ||
    value === "selected_context_label" ||
    value === "document_type" ||
    value === "next_sequence_number" ||
    value === "today"
  ) {
    return value;
  }
  return undefined;
}

async function respondWithTemplate(
  supabase: SupabaseClient,
  tenantId: string,
  templateId: string,
) {
  const accessContext = {
    supabase,
    tenantId,
    userId: null,
  };
  const templates = await loadTemplateCatalog(accessContext);
  const template = templates.find((entry) => entry.id === templateId) ?? null;
  return NextResponse.json({ template, templates });
}
