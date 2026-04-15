import { NextResponse } from "next/server";
import { resolveRequestAccessContext } from "@/lib/demo-session";
import {
  clearTenantDefaultRuleConfig,
  getTenantDefaultRuleConfig,
  saveTenantDefaultRuleConfig,
} from "@/lib/reporting";
import type { ReportTable, ReportTableColumn, RuleConfig } from "@/lib/reporting/types";

function mapSourceType(value: string): ReportTable["sourceType"] {
  if (value === "manual" || value === "ocr" || value === "csv" || value === "macro") {
    return value;
  }
  return "default";
}

function getDefaultReportingTableName(
  rawName: unknown,
  settings: unknown,
  linkedFolderPath: unknown,
): string {
  const fallback = typeof rawName === "string" && rawName.trim().length > 0 ? rawName.trim() : "Tabla";
  const record = (settings ?? null) as Record<string, unknown> | null;
  const extractedTables = Array.isArray(record?.extractedTables) ? (record?.extractedTables as Array<Record<string, unknown>>) : [];
  const primaryExtractedName = extractedTables
    .map((entry) => (typeof entry.name === "string" ? entry.name.trim() : ""))
    .find((name) => name.length > 0);
  const folderSuffix =
    typeof linkedFolderPath === "string" && linkedFolderPath.trim().length > 0
      ? ` [${linkedFolderPath.trim()}]`
      : "";
  if (primaryExtractedName) {
    return `${primaryExtractedName}${folderSuffix}`;
  }
  return `${fallback}${folderSuffix}`;
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function hasTenantReportingAdminAccess(
  access: Awaited<ReturnType<typeof resolveRequestAccessContext>>,
) {
  if (access.actorType !== "user") return false;
  return (
    access.isSuperAdmin ||
    access.membershipRole === "owner" ||
    access.membershipRole === "admin"
  );
}

export async function GET() {
  try {
    const access = await resolveRequestAccessContext();
    const { supabase, user, tenantId } = access;
    if (!user || !tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasTenantReportingAdminAccess(access)) {
      return NextResponse.json(
        { error: "Only tenant admins can manage reporting defaults" },
        { status: 403 },
      );
    }

    const [{ config, hasTenantDefault }, tablasResult] = await Promise.all([
      getTenantDefaultRuleConfig(),
      supabase
        .from("obra_default_tablas")
        .select("id, name, source_type, linked_folder_path, settings")
        .eq("tenant_id", tenantId)
        .order("position", { ascending: true }),
    ]);

    if (tablasResult.error) {
      throw tablasResult.error;
    }

    const tablaIds = (tablasResult.data ?? []).map((row) => row.id as string);

    let columnsByTabla = new Map<string, ReportTableColumn[]>();
    if (tablaIds.length > 0) {
      const columnsResult = await supabase
        .from("obra_default_tabla_columns")
        .select("default_tabla_id, field_key, label, data_type")
        .in("default_tabla_id", tablaIds)
        .order("position", { ascending: true });

      if (columnsResult.error) {
        throw columnsResult.error;
      }

      columnsByTabla = new Map<string, ReportTableColumn[]>();
      for (const column of columnsResult.data ?? []) {
        const tableId = column.default_tabla_id as string;
        const list = columnsByTabla.get(tableId) ?? [];
        list.push({
          key: column.field_key as string,
          label: column.label as string,
          type: column.data_type as string,
        });
        columnsByTabla.set(tableId, list);
      }
    }

    const tables: ReportTable[] = (tablasResult.data ?? []).map((row) => ({
      id: row.id as string,
      name: getDefaultReportingTableName(row.name, row.settings, row.linked_folder_path),
      sourceType: mapSourceType(row.source_type as string),
      columns: columnsByTabla.get(row.id as string) ?? [],
    }));

    return NextResponse.json({
      config,
      hasTenantDefault,
      tables,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Failed to load tenant reporting defaults") },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const access = await resolveRequestAccessContext();
    const { user, tenantId } = access;
    if (!user || !tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasTenantReportingAdminAccess(access)) {
      return NextResponse.json(
        { error: "Only tenant admins can manage reporting defaults" },
        { status: 403 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const nextConfig = (body?.config ?? body) as RuleConfig;
    await saveTenantDefaultRuleConfig(nextConfig);

    const { config, hasTenantDefault } = await getTenantDefaultRuleConfig();
    return NextResponse.json({ ok: true, config, hasTenantDefault });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Failed to save tenant reporting defaults") },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const access = await resolveRequestAccessContext();
    const { user, tenantId } = access;
    if (!user || !tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasTenantReportingAdminAccess(access)) {
      return NextResponse.json(
        { error: "Only tenant admins can manage reporting defaults" },
        { status: 403 },
      );
    }

    await clearTenantDefaultRuleConfig();
    const { config, hasTenantDefault } = await getTenantDefaultRuleConfig();
    return NextResponse.json({ ok: true, config, hasTenantDefault });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Failed to clear tenant reporting defaults") },
      { status: 500 }
    );
  }
}
