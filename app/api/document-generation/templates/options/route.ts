import { NextRequest, NextResponse } from "next/server";

import { resolveRequestAccessContext } from "@/lib/demo-session";
import {
  normalizeTemplateSchema,
  type TemplateField,
  type TemplateSchema,
  type TemplateSelectOption,
} from "@/lib/document-generation";
import { loadDocumentGenerationPermissions } from "@/lib/document-generation-server";
import { normalizeFieldKey } from "@/lib/tablas";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";

type OptionAddition = {
  fieldKey?: string;
  tableKey?: string;
  option?: {
    label?: string;
    value?: string;
    unit?: string | null;
  };
};

type TemplateRow = {
  id: string;
  tenant_id: string | null;
  key: string;
  name: string;
  description: string | null;
  document_type: string;
  target_folder_path: string | null;
  version: number;
  status: string;
  is_system: boolean;
  schema: unknown;
  content_html: string;
};

export async function POST(request: NextRequest) {
  try {
    const access = await resolveRequestAccessContext();
    const { user, tenantId, actorType } = access;
    if (!user && actorType !== "demo") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!tenantId) {
      return NextResponse.json({ error: "No tenant" }, { status: 400 });
    }

    const accessContext = {
      supabase: access.supabase,
      tenantId,
      userId: user?.id ?? null,
    };
    const permissions = await loadDocumentGenerationPermissions(accessContext);
    if (!permissions.canCreate) {
      return NextResponse.json({ error: "Sin permisos para actualizar opciones de documentos." }, { status: 403 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      templateId?: string;
      additions?: OptionAddition[];
    };
    const templateId = typeof body.templateId === "string" ? body.templateId.trim() : "";
    const additions = normalizeAdditions(body.additions);
    if (!templateId || additions.length === 0) {
      return NextResponse.json({ templateId, added: 0 });
    }

    const admin = createSupabaseAdminClient();
    const { data: baseTemplate, error: baseTemplateError } = await admin
      .from("document_generation_templates")
      .select("id, tenant_id, key, name, description, document_type, target_folder_path, version, status, is_system, schema, content_html")
      .eq("id", templateId)
      .maybeSingle();
    if (baseTemplateError) throw baseTemplateError;
    if (!baseTemplate) {
      return NextResponse.json({ error: "Template no encontrada." }, { status: 404 });
    }

    const base = baseTemplate as TemplateRow;
    if (base.tenant_id && base.tenant_id !== tenantId) {
      return NextResponse.json({ error: "Template no accesible para este tenant." }, { status: 403 });
    }

    const targetTemplate = await resolveWritableTemplate(admin, tenantId, base, user?.id ?? null);
    const schema = normalizeTemplateSchema(targetTemplate.schema);
    const { schema: nextSchema, added } = addOptionsToSchema(schema, additions);
    if (added === 0) {
      return NextResponse.json({ templateId: targetTemplate.id, added: 0 });
    }

    const { error: updateError } = await admin
      .from("document_generation_templates")
      .update({ schema: nextSchema })
      .eq("id", targetTemplate.id)
      .eq("tenant_id", tenantId);
    if (updateError) throw updateError;

    return NextResponse.json({ templateId: targetTemplate.id, added });
  } catch (error) {
    console.error("[document-generation/templates/options]", error);
    const message = error instanceof Error ? error.message : "Error al guardar opciones de plantilla";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function normalizeAdditions(value: unknown): Array<{ fieldKey: string; tableKey?: string; option: TemplateSelectOption }> {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry): { fieldKey: string; tableKey?: string; option: TemplateSelectOption } | null => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
      const addition = entry as OptionAddition;
      const fieldKey = normalizeFieldKey(addition.fieldKey ?? "");
      const tableKey = addition.tableKey ? normalizeFieldKey(addition.tableKey) : undefined;
      const rawValue = typeof addition.option?.value === "string" ? addition.option.value.trim() : "";
      const label =
        typeof addition.option?.label === "string" && addition.option.label.trim()
          ? addition.option.label.trim()
          : rawValue;
      const unit =
        typeof addition.option?.unit === "string" && addition.option.unit.trim()
          ? addition.option.unit.trim()
          : null;
      if (!fieldKey || !rawValue) return null;
      return { fieldKey, tableKey, option: { label, value: rawValue, unit } };
    })
    .filter((entry): entry is { fieldKey: string; tableKey?: string; option: TemplateSelectOption } => Boolean(entry));
}

async function resolveWritableTemplate(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  tenantId: string,
  base: TemplateRow,
  userId: string | null,
): Promise<TemplateRow> {
  if (base.tenant_id === tenantId) return base;

  const { data: existing, error: existingError } = await admin
    .from("document_generation_templates")
    .select("id, tenant_id, key, name, description, document_type, target_folder_path, version, status, is_system, schema, content_html")
    .eq("tenant_id", tenantId)
    .eq("key", base.key)
    .eq("version", base.version)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) return existing as TemplateRow;

  const { data: inserted, error: insertError } = await admin
    .from("document_generation_templates")
    .insert({
      tenant_id: tenantId,
      key: base.key,
      name: base.name,
      description: base.description,
      document_type: base.document_type,
      target_folder_path: base.target_folder_path,
      version: base.version,
      status: base.status,
      is_system: false,
      created_by: userId,
      schema: base.schema,
      content_html: base.content_html,
    })
    .select("id, tenant_id, key, name, description, document_type, target_folder_path, version, status, is_system, schema, content_html")
    .maybeSingle();
  if (insertError) throw insertError;
  if (!inserted) throw new Error("No se pudo crear la copia tenant de la template.");
  return inserted as TemplateRow;
}

function addOptionsToSchema(
  schema: TemplateSchema,
  additions: Array<{ fieldKey: string; tableKey?: string; option: TemplateSelectOption }>,
) {
  let added = 0;
  const addToField = (field: TemplateField, tableKey?: string): TemplateField => {
    if (field.type !== "select") return field;
    const matching = additions.filter(
      (addition) =>
        addition.fieldKey === field.key &&
        (!addition.tableKey || !tableKey || addition.tableKey === tableKey),
    );
    if (matching.length === 0) return field;
    const options = [...(field.options ?? [])];
    for (const addition of matching) {
      const exists = options.some(
        (option) =>
          option.value.trim().toLowerCase() === addition.option.value.trim().toLowerCase() ||
          option.label.trim().toLowerCase() === addition.option.label.trim().toLowerCase(),
      );
      if (!exists) {
        options.push(addition.option);
        added += 1;
      }
    }
    return { ...field, options };
  };

  return {
    schema: {
      fields: schema.fields.map((field) => {
        if (field.type === "table") {
          return {
            ...field,
            columns: (field.columns ?? []).map((column) => addToField(column, field.key)),
          };
        }
        return addToField(field);
      }),
    },
    added,
  };
}
