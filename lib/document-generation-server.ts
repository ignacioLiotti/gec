import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";
import {
  documentPermissionsFromPermissionSimulation,
  type PermissionSimulation,
} from "@/lib/permission-simulation";
import { ensureTablaDataType } from "@/lib/tablas";
import { resolveDocumentSeries } from "@/lib/document-ai/continuity/resolve-document-series";
import type { DocumentAiRow } from "@/lib/document-ai/schemas/types";

import {
  buildInitialInputData,
  buildDocumentGenerationExtractionRows,
  applyDocumentAiContextInputData,
  type FolderFieldSuggestion,
  type DocumentTemplateSummary,
  type DocumentType,
  type DocumentAiHydrationResult,
  type DocumentAiSourceRow,
  DOCUMENT_TYPES,
  type ExtractionTableColumn,
  getTemplateNextSequenceNumber,
  getTemplateSequenceFieldKeys,
  normalizeDocumentType,
  normalizeFolderGenerationPath,
  normalizeTemplateSchema,
  type TemplateSchema,
  type TemplateSelectOption,
  type FolderGenerationConfig,
} from "@/lib/document-generation";

type AccessContext = {
  supabase: SupabaseClient;
  tenantId: string;
  userId: string | null;
  permissionSimulation?: PermissionSimulation | null;
};

type TemplateRow = {
  id: string;
  tenant_id?: string | null;
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
  updated_at?: string | null;
};

type WorkSummary = {
  id: string;
  n: number | null;
  designacion_y_ubicacion: string | null;
};

type FolderConfigRecord = {
  path: string;
  name: string;
  allowedDocumentTypes: Set<DocumentType>;
};

type ExtractionTarget = {
  tablaId: string;
  columns: ExtractionTableColumn[];
};

export type DocumentGenerationPermissionKey =
  | "documents:review"
  | "documents:templates";

export type DocumentGenerationPermissionMap = {
  canSeeNavigation: boolean;
  canCreate: boolean;
  canReview: boolean;
  canManageTemplates: boolean;
  canViewAllDrafts: boolean;
};

export type DocumentActorSummary = {
  id: string;
  fullName: string | null;
  email: string | null;
  label: string;
};

export function canEditGeneratedDocument(params: {
  canCreate: boolean;
  userId: string | null;
  status: string | null;
}) {
  return (
    params.canCreate &&
    Boolean(params.userId) &&
    ["GENERATED", "UNDER_REVIEW", "REJECTED"].includes(params.status ?? "")
  );
}

function normalizeDocumentTypeList(value: unknown): DocumentType[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => normalizeDocumentType(typeof entry === "string" ? entry.trim().toUpperCase() : entry))
    .filter((entry): entry is DocumentType => entry != null);
}

function tryCoerceDocumentTypesFromLegacy(value: unknown): DocumentType[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry): DocumentType | null => {
      if (typeof entry !== "string") return null;
      const normalized = entry.trim().toLowerCase();
      switch (normalized) {
        case "certificado":
        case "certificado de obra":
          return "CERTIFICATE" as const;
        case "orden de compra":
        case "ordenes de compra":
          return "PURCHASE_ORDER" as const;
        case "factura":
        case "factura interna":
          return "INVOICE" as const;
        case "remito":
          return "DELIVERY_NOTE" as const;
        case "solicitud de cotizacion":
        case "solicitud de cotización":
          return "QUOTE_REQUEST" as const;
        case "acta":
          return "ACT" as const;
        default:
          return null;
      }
    })
    .filter((entry): entry is DocumentType => entry != null);
}

function mergeDocumentTypes(settings: Record<string, unknown>): DocumentType[] {
  const canonical = [
    ...normalizeDocumentTypeList(settings.documentTypes),
    ...normalizeDocumentTypeList(settings.extractionDocumentTypes),
  ];
  const legacy = [
    ...tryCoerceDocumentTypesFromLegacy(settings.documentTypes),
    ...tryCoerceDocumentTypesFromLegacy(settings.extractionDocumentTypes),
  ];
  return Array.from(new Set([...canonical, ...legacy]));
}

function readSettings(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? ({ ...(value as Record<string, unknown>) })
    : {};
}

function formatActorLabel(actor: { fullName: string | null; email: string | null }) {
  if (actor.fullName && actor.email) return `${actor.fullName} · ${actor.email}`;
  if (actor.fullName) return actor.fullName;
  if (actor.email) return actor.email;
  return "Usuario";
}

export function formatWorkLabel(work: WorkSummary | { n: number | null; designacion_y_ubicacion: string | null }) {
  return [work.n != null ? String(work.n) : "", work.designacion_y_ubicacion ?? ""]
    .filter(Boolean)
    .join(" ")
    .trim();
}

export async function hasDocumentGenerationPermission(
  access: AccessContext,
  permissionKey: DocumentGenerationPermissionKey,
) {
  if (!access.tenantId || !access.userId) return false;
  const { data, error } = await access.supabase.rpc("has_permission", {
    tenant: access.tenantId,
    perm_key: permissionKey,
  });
  if (error) {
    console.warn("[document-generation/permissions] permission check failed", {
      code: error.code,
      message: error.message,
      permissionKey,
    });
    return false;
  }
  return Boolean(data);
}

export async function loadDocumentGenerationPermissions(
  access: AccessContext,
): Promise<DocumentGenerationPermissionMap> {
  if (access.permissionSimulation) {
    return documentPermissionsFromPermissionSimulation(access.permissionSimulation);
  }

  if (!access.userId) {
    return {
      canSeeNavigation: false,
      canCreate: false,
      canReview: false,
      canManageTemplates: false,
      canViewAllDrafts: false,
    };
  }

  const [canReview, canManageTemplates] =
    await Promise.all([
      hasDocumentGenerationPermission(access, "documents:review"),
      hasDocumentGenerationPermission(access, "documents:templates"),
    ]);

  return {
    canSeeNavigation: true,
    canCreate: true,
    canReview,
    canManageTemplates,
    canViewAllDrafts: false,
  };
}

export async function loadActorsByIds(userIds: string[]): Promise<Record<string, DocumentActorSummary>> {
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  if (ids.length === 0) return {};

  const admin = createSupabaseAdminClient();
  const { data: profiles, error: profilesError } = await admin
    .from("profiles")
    .select("user_id, full_name")
    .in("user_id", ids);
  if (profilesError) throw profilesError;

  const profileNameById = new Map(
    (profiles ?? []).map((profile) => [String(profile.user_id), profile.full_name as string | null]),
  );

  const users = await Promise.all(
    ids.map(async (userId) => {
      try {
        const { data } = await admin.auth.admin.getUserById(userId);
        const fullName =
          profileNameById.get(userId) ??
          data.user?.user_metadata?.display_name ??
          data.user?.user_metadata?.full_name ??
          null;
        const email = data.user?.email ?? null;
        return [
          userId,
          {
            id: userId,
            fullName,
            email,
            label: formatActorLabel({ fullName, email }),
          } satisfies DocumentActorSummary,
        ] as const;
      } catch (error) {
        console.error("[document-generation/actors] failed to load user", userId, error);
        const fullName = profileNameById.get(userId) ?? null;
        return [
          userId,
          {
            id: userId,
            fullName,
            email: null,
            label: formatActorLabel({ fullName, email: null }),
          } satisfies DocumentActorSummary,
        ] as const;
      }
    }),
  );

  return Object.fromEntries(users);
}

export async function loadTenantUserOptions(access: AccessContext): Promise<TemplateSelectOption[]> {
  const admin = createSupabaseAdminClient();
  const { data: memberships, error: membershipsError } = await admin
    .from("memberships")
    .select("user_id")
    .eq("tenant_id", access.tenantId);
  if (membershipsError) throw membershipsError;

  const userIds = Array.from(new Set((memberships ?? []).map((membership) => String(membership.user_id)).filter(Boolean)));
  if (userIds.length === 0) return [];

  const actors = await loadActorsByIds(userIds);
  return userIds
    .map((userId) => actors[userId])
    .filter((actor): actor is DocumentActorSummary => Boolean(actor))
    .map((actor) => ({
      label: actor.label,
      value: actor.fullName || actor.email || actor.label,
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

export async function assertWorkInTenant(
  supabase: SupabaseClient,
  tenantId: string,
  workId: string,
) {
  const { data, error } = await supabase
    .from("obras")
    .select("id, n, designacion_y_ubicacion")
    .eq("id", workId)
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  return (data as WorkSummary | null) ?? null;
}

export async function loadWorks(access: AccessContext) {
  const { data, error } = await access.supabase
    .from("obras")
    .select("id, n, designacion_y_ubicacion")
    .eq("tenant_id", access.tenantId)
    .is("deleted_at", null)
    .order("n", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as WorkSummary[]).map((work) => ({
    id: work.id,
    label: [work.n != null ? String(work.n) : "", work.designacion_y_ubicacion ?? ""]
      .filter(Boolean)
      .join(" ")
      .trim(),
  }));
}

export async function loadTemplates(access: AccessContext) {
  return loadTemplateCatalog(access, { activeOnly: true });
}

export async function loadTemplateCatalog(
  access: AccessContext,
  options?: { activeOnly?: boolean },
) {
  let query = access.supabase
    .from("document_generation_templates")
    .select(
      "id, tenant_id, key, name, description, document_type, target_folder_path, version, status, is_system, schema, content_html, updated_at",
    )
    .order("version", { ascending: false })
    .order("updated_at", { ascending: false });
  if (options?.activeOnly) {
    query = query.eq("status", "active");
  }

  const { data, error } = await query;
  if (error) throw error;

  const visibleRows = ((data ?? []) as TemplateRow[]).filter((row) =>
    isVisibleTemplate(access.tenantId, row),
  );
  const dedupedRows = pickPreferredTemplateRows(access.tenantId, visibleRows);

  return dedupedRows.map(toTemplateSummary);
}

function toTemplateSummary(row: TemplateRow): DocumentTemplateSummary {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description ?? null,
    documentType: normalizeDocumentType(row.document_type) ?? "CUSTOM",
    targetFolderPath: normalizeFolderGenerationPath(row.target_folder_path),
    version: Number(row.version) || 1,
    status: row.status,
    isSystem: Boolean(row.is_system),
    tenantScoped: Boolean(row.tenant_id),
    schema: normalizeTemplateSchema(row.schema),
    contentHtml: row.content_html,
  } satisfies DocumentTemplateSummary;
}

function pickPreferredTemplateRows(tenantId: string, rows: TemplateRow[]) {
  const preferredByKey = new Map<string, TemplateRow>();

  for (const row of rows) {
    const dedupeKey = `${row.key}::${Number(row.version) || 1}`;
    const current = preferredByKey.get(dedupeKey);
    if (!current) {
      preferredByKey.set(dedupeKey, row);
      continue;
    }

    const rowTenantMatch = row.tenant_id === tenantId;
    const currentTenantMatch = current.tenant_id === tenantId;
    if (rowTenantMatch && !currentTenantMatch) {
      preferredByKey.set(dedupeKey, row);
      continue;
    }
    if (rowTenantMatch === currentTenantMatch) {
      const currentUpdated = current.updated_at ? new Date(current.updated_at).getTime() : 0;
      const rowUpdated = row.updated_at ? new Date(row.updated_at).getTime() : 0;
      if (rowUpdated >= currentUpdated) {
        preferredByKey.set(dedupeKey, row);
      }
    }
  }

  return Array.from(preferredByKey.values()).sort((left, right) => {
    if (left.name !== right.name) return left.name.localeCompare(right.name);
    return (Number(left.version) || 1) - (Number(right.version) || 1);
  });
}

export async function loadFolderFieldSuggestions(
  access: AccessContext,
  workId?: string | null,
): Promise<Record<string, FolderFieldSuggestion[]>> {
  const folderMap = new Map<string, Map<string, FolderFieldSuggestion>>();

  const { data: defaultTablas, error: defaultTablasError } = await access.supabase
    .from("obra_default_tablas")
    .select("id, linked_folder_path")
    .eq("tenant_id", access.tenantId)
    .eq("source_type", "ocr");
  if (defaultTablasError) throw defaultTablasError;

  const defaultTablaIds = (defaultTablas ?? []).map((tabla) => tabla.id as string);
  const defaultFolderByTabla = new Map(
    (defaultTablas ?? []).map((tabla) => [
      tabla.id as string,
      normalizeFolderGenerationPath(tabla.linked_folder_path),
    ]),
  );

  if (defaultTablaIds.length > 0) {
    const { data: defaultColumns, error: defaultColumnsError } = await access.supabase
      .from("obra_default_tabla_columns")
      .select("default_tabla_id, field_key, label, data_type, required, config")
      .in("default_tabla_id", defaultTablaIds)
      .order("position", { ascending: true });
    if (defaultColumnsError) throw defaultColumnsError;

    for (const column of defaultColumns ?? []) {
      const folderPath = defaultFolderByTabla.get(column.default_tabla_id as string) ?? "";
      if (!folderPath) continue;
      registerFolderFieldSuggestion(folderMap, folderPath, {
        fieldKey: String(column.field_key ?? ""),
        label: String(column.label ?? column.field_key ?? ""),
        dataType: String(column.data_type ?? "text"),
        required: Boolean(column.required),
        description: readColumnDescription(column.config),
      });
    }
  }

  if (workId) {
    const { data: obraTablas, error: obraTablasError } = await access.supabase
      .from("obra_tablas")
      .select("id, settings")
      .eq("obra_id", workId)
      .eq("source_type", "ocr");
    if (obraTablasError) throw obraTablasError;

    const obraTablaIds = (obraTablas ?? []).map((tabla) => tabla.id as string);
    const obraFolderByTabla = new Map(
      (obraTablas ?? []).map((tabla) => {
        const settings = readSettings(tabla.settings);
        return [tabla.id as string, normalizeFolderGenerationPath(settings.ocrFolder)];
      }),
    );

    if (obraTablaIds.length > 0) {
      const { data: obraColumns, error: obraColumnsError } = await access.supabase
        .from("obra_tabla_columns")
        .select("tabla_id, field_key, label, data_type, required, config")
        .in("tabla_id", obraTablaIds)
        .order("position", { ascending: true });
      if (obraColumnsError) throw obraColumnsError;

      for (const column of obraColumns ?? []) {
        const folderPath = obraFolderByTabla.get(column.tabla_id as string) ?? "";
        if (!folderPath) continue;
        registerFolderFieldSuggestion(folderMap, folderPath, {
          fieldKey: String(column.field_key ?? ""),
          label: String(column.label ?? column.field_key ?? ""),
          dataType: String(column.data_type ?? "text"),
          required: Boolean(column.required),
          description: readColumnDescription(column.config),
        });
      }
    }
  }

  return Object.fromEntries(
    Array.from(folderMap.entries()).map(([folderPath, fields]) => [
      folderPath,
      Array.from(fields.values()),
    ]),
  );
}

function registerFolderFieldSuggestion(
  folderMap: Map<string, Map<string, FolderFieldSuggestion>>,
  folderPath: string,
  field: FolderFieldSuggestion,
) {
  const normalizedKey = field.fieldKey.trim();
  if (!folderPath || !normalizedKey) return;
  const fieldMap = folderMap.get(folderPath) ?? new Map<string, FolderFieldSuggestion>();
  if (!fieldMap.has(normalizedKey)) {
    fieldMap.set(normalizedKey, field);
  }
  folderMap.set(folderPath, fieldMap);
}

function readColumnDescription(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const description = (value as Record<string, unknown>).ocrDescription;
  return typeof description === "string" && description.trim().length > 0
    ? description.trim()
    : null;
}

function isVisibleTemplate(tenantId: string, row: TemplateRow & { tenant_id?: string | null }) {
  return !row.tenant_id || row.tenant_id === tenantId;
}

export async function loadFolderGenerationConfigs(
  access: AccessContext,
  workId?: string | null,
): Promise<FolderGenerationConfig[]> {
  const folderMap = new Map<string, FolderConfigRecord>();

  const { data: defaultFolders, error: defaultFoldersError } = await access.supabase
    .from("obra_default_folders")
    .select("path, name")
    .eq("tenant_id", access.tenantId)
    .order("position", { ascending: true });
  if (defaultFoldersError) throw defaultFoldersError;

  for (const folder of defaultFolders ?? []) {
    const path = normalizeFolderGenerationPath(folder.path);
    if (!path) continue;
    folderMap.set(path, {
      path,
      name: typeof folder.name === "string" && folder.name.trim() ? folder.name.trim() : path,
      allowedDocumentTypes: new Set<DocumentType>(),
    });
  }

  const { data: defaultTablas, error: defaultTablasError } = await access.supabase
    .from("obra_default_tablas")
    .select("linked_folder_path, settings")
    .eq("tenant_id", access.tenantId)
    .eq("source_type", "ocr");
  if (defaultTablasError) throw defaultTablasError;

  for (const tabla of defaultTablas ?? []) {
    const path = normalizeFolderGenerationPath(tabla.linked_folder_path);
    if (!path) continue;
    const settings = readSettings(tabla.settings);
    const existing = folderMap.get(path) ?? {
      path,
      name: path,
      allowedDocumentTypes: new Set<DocumentType>(),
    };
    for (const documentType of mergeDocumentTypes(settings)) {
      existing.allowedDocumentTypes.add(documentType);
    }
    folderMap.set(path, existing);
  }

  if (workId) {
    const { data: obraTablas, error: obraTablasError } = await access.supabase
      .from("obra_tablas")
      .select("settings")
      .eq("obra_id", workId)
      .eq("source_type", "ocr");
    if (obraTablasError) throw obraTablasError;

    for (const tabla of obraTablas ?? []) {
      const settings = readSettings(tabla.settings);
      const path = normalizeFolderGenerationPath(settings.ocrFolder);
      if (!path) continue;
      const existing = folderMap.get(path) ?? {
        path,
        name: humanizeFolderPath(path),
        allowedDocumentTypes: new Set<DocumentType>(),
      };
      for (const documentType of mergeDocumentTypes(settings)) {
        existing.allowedDocumentTypes.add(documentType);
      }
      folderMap.set(path, existing);
    }
  }

  return Array.from(folderMap.values()).map((entry) => {
    const allowedDocumentTypes = Array.from(entry.allowedDocumentTypes).filter((documentType) =>
      DOCUMENT_TYPES.includes(documentType),
    );
    return {
      path: entry.path,
      name: entry.name,
      allowedDocumentTypes,
      defaultDocumentType: allowedDocumentTypes.length === 1 ? allowedDocumentTypes[0] : null,
    } satisfies FolderGenerationConfig;
  });
}

export function resolveGenerationContext(args: {
  documentType: DocumentType | null;
  folderPath: string;
  folderConfigs: FolderGenerationConfig[];
  templates: DocumentTemplateSummary[];
}) {
  const normalizedFolderPath = normalizeFolderGenerationPath(args.folderPath);
  const folderConfig = args.folderConfigs.find((config) => config.path === normalizedFolderPath) ?? null;
  const allowedDocumentTypes =
    folderConfig?.allowedDocumentTypes?.length
      ? folderConfig.allowedDocumentTypes
      : args.documentType
        ? [args.documentType]
        : [];

  const resolvedDocumentType =
    args.documentType ??
    (allowedDocumentTypes.length === 1 ? allowedDocumentTypes[0] : null);

  const folderCandidates =
    resolvedDocumentType == null
      ? []
      : args.folderConfigs.filter((config) =>
          config.allowedDocumentTypes.length === 0 || config.allowedDocumentTypes.includes(resolvedDocumentType),
        );

  const resolvedFolderPath =
    normalizedFolderPath ||
    (folderCandidates.length === 1
      ? folderCandidates[0].path
      : (() => {
          const templateFolderMatch = args.templates.find(
            (template) =>
              template.documentType === resolvedDocumentType &&
              template.targetFolderPath &&
              folderCandidates.some((candidate) => candidate.path === template.targetFolderPath),
          );
          return templateFolderMatch?.targetFolderPath ?? "";
        })());

  const filteredTemplates = args.templates.filter((template) => {
    if (resolvedDocumentType && template.documentType !== resolvedDocumentType) return false;
    if (resolvedFolderPath && template.targetFolderPath && template.targetFolderPath !== resolvedFolderPath) {
      return false;
    }
    return true;
  });

  const selectedTemplate =
    filteredTemplates.length === 1
      ? filteredTemplates[0]
      : resolvedFolderPath
        ? filteredTemplates.find((template) => template.targetFolderPath === resolvedFolderPath) ?? null
        : null;

  return {
    folderConfig,
    allowedDocumentTypes,
    resolvedDocumentType,
    resolvedFolderPath,
    folderCandidates,
    filteredTemplates,
    selectedTemplate,
    initialInputData: buildInitialInputData(selectedTemplate?.schema ?? { fields: [] }),
  };
}

export async function validateGenerationTarget(
  access: AccessContext,
  args: {
    workId: string;
    folderPath: string;
    documentType: DocumentType;
  },
) {
  const normalizedFolderPath = normalizeFolderGenerationPath(args.folderPath);
  const folderConfigs = await loadFolderGenerationConfigs(access, args.workId);
  const folderConfig = folderConfigs.find((config) => config.path === normalizedFolderPath) ?? null;

  if (!folderConfig) {
    return {
      valid: false,
      error: "La carpeta destino no esta configurada para generacion documental.",
    };
  }

  if (
    folderConfig.allowedDocumentTypes.length > 0 &&
    !folderConfig.allowedDocumentTypes.includes(args.documentType)
  ) {
    return {
      valid: false,
      error: "El tipo documental no esta permitido para la carpeta destino.",
    };
  }

  return { valid: true, error: null };
}

export async function resolveGeneratedDocumentNextSequenceNumber(
  access: AccessContext,
  args: {
    workId: string;
    folderPath: string;
    documentType: DocumentType;
    schema: TemplateSchema;
    excludeGeneratedDocumentId?: string | null;
  },
) {
  if (getTemplateSequenceFieldKeys(args.schema).length === 0) return null;
  const normalizedFolderPath = normalizeFolderGenerationPath(args.folderPath);
  if (!normalizedFolderPath) return null;

  let query = access.supabase
    .from("generated_documents")
    .select("id, input_data", { count: "exact" })
    .eq("tenant_id", access.tenantId)
    .eq("obra_id", args.workId)
    .eq("folder_path", normalizedFolderPath)
    .eq("document_type", args.documentType)
    .range(0, 4999);

  if (args.excludeGeneratedDocumentId) {
    query = query.neq("id", args.excludeGeneratedDocumentId);
  }

  const { data, count, error } = await query;
  if (error) throw error;

  const inputRows = (data ?? [])
    .map((row) =>
      row.input_data && typeof row.input_data === "object" && !Array.isArray(row.input_data)
        ? (row.input_data as Record<string, unknown>)
        : {},
    );

  return getTemplateNextSequenceNumber(args.schema, inputRows, count ?? inputRows.length);
}

export async function insertGeneratedDocumentEvent(
  access: AccessContext,
  generatedDocumentId: string,
  eventType: string,
  payload: Record<string, unknown>,
  fromStatus?: string | null,
  toStatus?: string | null,
) {
  const { error } = await access.supabase.from("generated_document_events").insert({
    generated_document_id: generatedDocumentId,
    tenant_id: access.tenantId,
    event_type: eventType,
    from_status: fromStatus ?? null,
    to_status: toStatus ?? null,
    payload,
    created_by: access.userId,
  });
  if (error) throw error;
}

export async function syncGeneratedDocumentExtractionRows(params: {
  access: AccessContext;
  workId: string;
  folderPath: string;
  documentType: DocumentType;
  schema: TemplateSchema;
  inputData: Record<string, unknown>;
  documentMeta: {
    bucket: string;
    path: string;
    fileName: string;
  };
}) {
  const targets = await loadExtractionTargetsForGeneration(
    params.access,
    params.workId,
    params.folderPath,
    params.documentType,
  );

  for (const target of targets) {
    const rows = buildDocumentGenerationExtractionRows({
      schema: params.schema,
      inputData: params.inputData,
      columns: target.columns,
      documentMeta: params.documentMeta,
    });
    if (rows.length === 0) continue;

    const { error: deleteError } = await params.access.supabase
      .from("obra_tabla_rows")
      .delete()
      .eq("tabla_id", target.tablaId)
      .contains("data", { __docPath: params.documentMeta.path });
    if (deleteError) throw deleteError;

    const payload = rows.map((row) => ({
      tabla_id: target.tablaId,
      data: row,
      source: "import",
    }));
    const { error: insertError } = await params.access.supabase
      .from("obra_tabla_rows")
      .insert(payload);
    if (insertError) throw insertError;
  }

  return targets.length;
}

export async function buildDocumentAiInputFromExtractionContext(params: {
  access: AccessContext;
  workId: string;
  folderPath: string;
  documentType: DocumentType;
  schema: TemplateSchema;
  currentInputData: Record<string, unknown>;
}): Promise<DocumentAiHydrationResult> {
  const sourceRows = await loadDocumentAiSourceRows({
    access: params.access,
    workId: params.workId,
    folderPath: params.folderPath,
    documentType: params.documentType,
  });

  const hydrated = applyDocumentAiContextInputData({
    schema: params.schema,
    current: params.currentInputData,
    sourceRows,
  });
  if (params.documentType !== "CERTIFICATE") return hydrated;

  const series = resolveDocumentSeries(
    sourceRows.map((row) => ({
      id: row.id,
      tenantId: params.access.tenantId,
      obraId: params.workId,
      tableId: row.tablaId,
      tableName: row.tablaName ?? null,
      documentType: "certificado_avance",
      data: row.data,
      createdAt: row.createdAt ?? null,
      source: {
        kind: "obra_tabla_row",
        tenantId: params.access.tenantId,
        obraId: params.workId,
        tableId: row.tablaId,
        rowId: row.id,
        documentType: "certificado_avance",
        documentPath: row.documentPath ?? null,
        documentFileName: row.documentFileName ?? null,
        lineageRowKey: row.lineageRowKey ?? null,
        extractionId: row.extractionId ?? null,
        confidence: 0.8,
      },
    }) satisfies DocumentAiRow),
  );
  if (!series?.nextDraft) return hydrated;

  const nextInputData = applyCertificateSeriesDraftToInputData({
    schema: params.schema,
    inputData: hydrated.inputData,
    nextNumber: series.nextDraft.number,
    previousAccumulatedAmount: series.nextDraft.previousAccumulatedAmount,
  });
  const currentContext =
    nextInputData.__documentAi && typeof nextInputData.__documentAi === "object" && !Array.isArray(nextInputData.__documentAi)
      ? (nextInputData.__documentAi as Record<string, unknown>)
      : {};

  return {
    ...hydrated,
    inputData: {
      ...nextInputData,
      __documentAi: {
        ...currentContext,
        series,
      },
    },
  };
}

function hasInputValue(value: unknown) {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function fieldMatches(fieldKey: string, aliases: string[]) {
  const normalized = fieldKey
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return aliases.some((alias) => normalized.includes(alias));
}

function setFirstMatchingEmptyField(
  schema: TemplateSchema,
  inputData: Record<string, unknown>,
  aliases: string[],
  value: unknown,
) {
  if (value == null) return;
  const field = schema.fields.find(
    (entry) =>
      entry.type !== "table" &&
      !entry.repeatableGroup &&
      fieldMatches(`${entry.key} ${entry.label} ${entry.extractionFieldKey ?? ""}`, aliases),
  );
  if (!field || hasInputValue(inputData[field.key])) return;
  inputData[field.key] = value;
}

function applyCertificateSeriesDraftToInputData(params: {
  schema: TemplateSchema;
  inputData: Record<string, unknown>;
  nextNumber: number | null;
  previousAccumulatedAmount: number | null;
}) {
  const next = { ...params.inputData };
  setFirstMatchingEmptyField(params.schema, next, ["numero_certificado", "nro_certificado", "certificado"], params.nextNumber);
  setFirstMatchingEmptyField(
    params.schema,
    next,
    ["acumulado_anterior", "monto_anterior", "previous_accumulated"],
    params.previousAccumulatedAmount,
  );
  setFirstMatchingEmptyField(params.schema, next, ["monto_actual", "monto_certificado_actual"], null);
  return next;
}

async function loadDocumentAiSourceRows(params: {
  access: AccessContext;
  workId: string;
  folderPath: string;
  documentType: DocumentType;
}) {
  const normalizedFolderPath = normalizeFolderGenerationPath(params.folderPath);
  if (!normalizedFolderPath) return [] as DocumentAiSourceRow[];

  const { data: tablas, error: tablasError } = await params.access.supabase
    .from("obra_tablas")
    .select("id, name, settings")
    .eq("obra_id", params.workId)
    .eq("source_type", "ocr");
  if (tablasError) throw tablasError;

  const matchingTablas = (tablas ?? []).filter((tabla) => {
    const settings = readSettings(tabla.settings);
    const tablaFolderPath = normalizeFolderGenerationPath(settings.ocrFolder);
    if (tablaFolderPath !== normalizedFolderPath) return false;
    const allowedDocumentTypes = mergeDocumentTypes(settings);
    return allowedDocumentTypes.length === 0 || allowedDocumentTypes.includes(params.documentType);
  });
  if (matchingTablas.length === 0) return [] as DocumentAiSourceRow[];

  const tablaNameById = new Map(
    matchingTablas.map((tabla) => [
      String(tabla.id),
      typeof tabla.name === "string" ? tabla.name : null,
    ]),
  );
  const tablaIds = Array.from(tablaNameById.keys());
  const { data: rows, error: rowsError } = await params.access.supabase
    .from("obra_tabla_rows")
    .select("id, tabla_id, data, lineage_row_key, extraction_id, created_at")
    .in("tabla_id", tablaIds)
    .order("created_at", { ascending: false })
    .limit(200);
  if (rowsError) throw rowsError;

  return ((rows ?? []) as Array<Record<string, unknown>>)
    .map((row) => {
      const data =
        row.data && typeof row.data === "object" && !Array.isArray(row.data)
          ? (row.data as Record<string, unknown>)
          : {};
      return {
        id: String(row.id ?? ""),
        tablaId: String(row.tabla_id ?? ""),
        tablaName: tablaNameById.get(String(row.tabla_id ?? "")) ?? null,
        data,
        createdAt: typeof row.created_at === "string" ? row.created_at : null,
        lineageRowKey: typeof row.lineage_row_key === "string" ? row.lineage_row_key : null,
        extractionId: typeof row.extraction_id === "string" ? row.extraction_id : null,
        documentPath: typeof data.__docPath === "string" ? data.__docPath : null,
        documentFileName: typeof data.__docFileName === "string" ? data.__docFileName : null,
        documentBucket: typeof data.__docBucket === "string" ? data.__docBucket : null,
      } satisfies DocumentAiSourceRow;
    })
    .filter((row) => row.id && row.tablaId);
}

async function loadExtractionTargetsForGeneration(
  access: AccessContext,
  workId: string,
  folderPath: string,
  documentType: DocumentType,
) {
  const normalizedFolderPath = normalizeFolderGenerationPath(folderPath);
  if (!normalizedFolderPath) return [] as ExtractionTarget[];

  const { data: obraTablas, error: obraTablasError } = await access.supabase
    .from("obra_tablas")
    .select("id, settings")
    .eq("obra_id", workId)
    .eq("source_type", "ocr");
  if (obraTablasError) throw obraTablasError;

  const matchingTablas = (obraTablas ?? []).filter((tabla) => {
    const settings = readSettings(tabla.settings);
    const tablaFolderPath = normalizeFolderGenerationPath(settings.ocrFolder);
    if (tablaFolderPath !== normalizedFolderPath) return false;
    const allowedDocumentTypes = mergeDocumentTypes(settings);
    return allowedDocumentTypes.length === 0 || allowedDocumentTypes.includes(documentType);
  });
  if (matchingTablas.length === 0) return [] as ExtractionTarget[];

  const tablaIds = matchingTablas.map((tabla) => String(tabla.id));
  const { data: columns, error: columnsError } = await access.supabase
    .from("obra_tabla_columns")
    .select("tabla_id, field_key, data_type, config, position")
    .in("tabla_id", tablaIds)
    .order("position", { ascending: true });
  if (columnsError) throw columnsError;

  const columnsByTablaId = new Map<string, ExtractionTableColumn[]>();
  for (const column of columns ?? []) {
    const tablaId = String(column.tabla_id ?? "");
    if (!tablaId) continue;
    const current = columnsByTablaId.get(tablaId) ?? [];
    current.push({
      fieldKey: String(column.field_key ?? ""),
      dataType: ensureTablaDataType(column.data_type as string | undefined),
      config:
        column.config && typeof column.config === "object" && !Array.isArray(column.config)
          ? (column.config as Record<string, unknown>)
          : null,
    });
    columnsByTablaId.set(tablaId, current);
  }

  return matchingTablas
    .map((tabla) => ({
      tablaId: String(tabla.id),
      columns: columnsByTablaId.get(String(tabla.id)) ?? [],
    }))
    .filter((target) => target.columns.length > 0);
}

function humanizeFolderPath(path: string) {
  return path
    .split("/")
    .filter(Boolean)
    .map((segment) => segment.replace(/[-_]+/g, " "))
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" / ");
}
