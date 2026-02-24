import Link from "next/link"
import { createClient } from "@/utils/supabase/server"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { resolveTenantMembership } from "@/lib/tenant-selection"
import { MomentCell } from "./_components/moment-cell"

const PAGE_SIZE = 50
const AUDIT_FETCH_CHUNK = 1000
const TECHNICAL_TABLES = [
  "obra_tablas",
  "obra_tabla_columns",
  "obra_default_folders",
  "obra_default_tablas",
  "obra_default_tabla_columns",
  "macro_table_sources",
  "macro_table_columns",
  "sidebar_macro_tables",
  "tenant_main_table_configs",
] as const

const TABLE_FILTERS: { label: string; value: string }[] = [
  { value: "", label: "Todas las tablas" },
  { value: "obras", label: "Obras" },
  { value: "obra_tablas", label: "Tablas OCR" },
  { value: "obra_tabla_columns", label: "Columnas OCR" },
  { value: "obra_tabla_rows", label: "Filas OCR" },
  { value: "ocr_document_processing", label: "Procesamiento OCR" },
  { value: "obra_document_uploads", label: "Subida de documentos" },
  { value: "macro_tables", label: "Meta tablas" },
  { value: "macro_table_sources", label: "Fuentes meta tabla" },
  { value: "macro_table_columns", label: "Columnas meta tabla" },
  { value: "macro_table_custom_values", label: "Valores personalizados meta tabla" },
  { value: "sidebar_macro_tables", label: "Sidebar meta tablas" },
  { value: "obra_default_folders", label: "Carpetas por defecto" },
  { value: "obra_default_tablas", label: "Tablas por defecto" },
  { value: "obra_default_tabla_columns", label: "Columnas tabla por defecto" },
  { value: "ocr_templates", label: "Plantillas OCR" },
  { value: "tenant_main_table_configs", label: "Configuración tabla principal" },
  { value: "obra_flujo_actions", label: "Flujos" },
  { value: "obra_pendientes", label: "Pendientes" },
  { value: "pendiente_schedules", label: "Recordatorios" },
  { value: "certificates", label: "Certificados" },
  { value: "calendar_events", label: "Calendario" },
]
const ACTION_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "Todas las acciones" },
  { value: "INSERT", label: "Creaciones" },
  { value: "UPDATE", label: "Actualizaciones" },
  { value: "DELETE", label: "Eliminaciones" },
]

type AuditLogRow = {
  id: string
  tenant_id: string | null
  actor_id: string | null
  actor_email: string | null
  table_name: string
  action: "INSERT" | "UPDATE" | "DELETE"
  row_pk: Record<string, string | null> | null
  changed_keys: string[] | null
  before_data: Record<string, unknown> | null
  after_data: Record<string, unknown> | null
  created_at: string
}

type AuditLogGroup = {
  key: string
  primary: AuditLogRow
  entries: AuditLogRow[]
}

type ObraNameMap = Map<string, string>

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <div className="p-6 text-sm">Iniciá sesión para ver el historial de cambios.</div>
    )
  }

  const sp = (await searchParams) ?? {}
  const rawPage = Number.parseInt(
    typeof sp.page === "string" ? sp.page : "",
    10
  )
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1
  const groupOffset = (page - 1) * PAGE_SIZE
  const rawSearch = typeof sp.q === "string" ? sp.q : ""
  const sanitizedSearch = rawSearch.replace(/[,]/g, "").trim()
  const tableFilter = typeof sp.table === "string" ? sp.table : ""
  const actionFilter = typeof sp.action === "string" ? sp.action : ""
  const showTechnical = typeof sp.tech === "string" && sp.tech === "1"

  const { data: memberships } = await supabase
    .from("memberships")
    .select("tenant_id, role")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_superadmin")
    .eq("user_id", user.id)
    .maybeSingle()

  const isSuperAdmin = profile?.is_superadmin ?? false
  const { tenantId } = await resolveTenantMembership(
    (memberships ?? []) as { tenant_id: string | null; role: string | null }[],
    { isSuperAdmin }
  )

  if (!tenantId) {
    return (
      <div className="p-6 text-sm">
        No pudimos resolver una organización para mostrar el historial.
      </div>
    )
  }

  const { data: adminCheck, error: adminError } = await supabase.rpc("is_admin_of", {
    tenant: tenantId,
  })
  const canAdmin = !adminError && Boolean(adminCheck)

  if (!canAdmin) {
    if (adminError) {
      console.error("[admin/audit-log] failed to check admin permission", adminError)
    }
    return (
      <div className="p-6 text-sm">
        No tenés permisos para ver el historial de auditoría de tu organización.
      </div>
    )
  }

  const entries: AuditLogRow[] = []
  let from = 0
  let hasMoreRows = true
  let groupedEntriesAll: AuditLogGroup[] = []
  const groupsNeeded = groupOffset + PAGE_SIZE + 1

  while (hasMoreRows && groupedEntriesAll.length < groupsNeeded) {
    let chunkQuery = supabase
      .from("audit_log")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .range(from, from + AUDIT_FETCH_CHUNK - 1)

    if (tableFilter) {
      chunkQuery = chunkQuery.eq("table_name", tableFilter)
    } else if (!showTechnical) {
      chunkQuery = chunkQuery.not("table_name", "in", `(${TECHNICAL_TABLES.join(",")})`)
    }
    if (actionFilter) {
      chunkQuery = chunkQuery.eq("action", actionFilter)
    }
    if (sanitizedSearch) {
      const ilike = `%${sanitizedSearch}%`
      chunkQuery = chunkQuery.or(
        [
          `actor_email.ilike.${ilike}`,
          `table_name.ilike.${ilike}`,
          `row_pk->>id.ilike.${ilike}`,
          `row_pk->>obra_id.ilike.${ilike}`,
        ].join(",")
      )
    }

    const { data: chunkRows, error } = await chunkQuery
    if (error) {
      console.error("[admin/audit-log] failed to load audit log", error)
      return (
        <div className="p-6 text-sm">
          No se pudo cargar el historial de auditoría. Intentalo de nuevo más tarde.
        </div>
      )
    }

    const normalizedRows = (chunkRows ?? []) as AuditLogRow[]
    const filteredRows = normalizedRows.filter((entry) => !isMetadataOnlyUpdate(entry))
    entries.push(...filteredRows)
    groupedEntriesAll = groupAuditRows(entries)

    if (normalizedRows.length < AUDIT_FETCH_CHUNK) {
      hasMoreRows = false
      break
    }
    from += AUDIT_FETCH_CHUNK
  }

  const groupedEntries = groupedEntriesAll.slice(groupOffset, groupOffset + PAGE_SIZE)
  const hasNextPage = hasMoreRows || groupedEntriesAll.length > groupOffset + PAGE_SIZE
  const totalGroups = hasMoreRows ? null : groupedEntriesAll.length
  const totalPages = totalGroups === null ? null : Math.max(1, Math.ceil(totalGroups / PAGE_SIZE))
  const obraNamesById = await loadObraNamesMap(supabase, tenantId, groupedEntries)

  const baseParams = new URLSearchParams()
  if (rawSearch) baseParams.set("q", rawSearch)
  if (tableFilter) baseParams.set("table", tableFilter)
  if (actionFilter) baseParams.set("action", actionFilter)
  if (showTechnical) baseParams.set("tech", "1")

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Historial de cambios</h1>
          <p className="text-sm text-muted-foreground">
            Auditoría en tiempo real de obras, certificados, flujos y pendientes.
          </p>
        </div>
        <div className="text-sm text-muted-foreground">
          {totalGroups === null
            ? `Mostrando ${groupedEntries.length} grupos`
            : `Mostrando ${groupedEntries.length} de ${totalGroups} grupos`}
        </div>
      </header>

      <form className="grid gap-3 rounded-md border p-4 lg:grid-cols-4" method="get">
        <div className="lg:col-span-2">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="q">
            Buscar por usuario o ID
          </label>
          <Input id="q" name="q" placeholder="usuario@empresa.com, obra 12, etc." defaultValue={rawSearch} className="mt-1" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground" htmlFor="table">
            Tabla
          </label>
          <select
            id="table"
            name="table"
            defaultValue={tableFilter}
            className="mt-1 h-9 w-full rounded-md border-2 border-orange-primary/40 bg-transparent px-3 text-sm focus-visible:border-orange-primary focus-visible:ring-orange-primary/30 focus-visible:ring-[3px]"
          >
            {TABLE_FILTERS.map((opt) => (
              <option key={opt.value || "all"} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground" htmlFor="action">
            Acción
          </label>
          <select
            id="action"
            name="action"
            defaultValue={actionFilter}
            className="mt-1 h-9 w-full rounded-md border-2 border-orange-primary/40 bg-transparent px-3 text-sm focus-visible:border-orange-primary focus-visible:ring-orange-primary/30 focus-visible:ring-[3px]"
          >
            {ACTION_FILTERS.map((opt) => (
              <option key={opt.value || "all-actions"} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end justify-end gap-2 lg:col-span-4">
          <label className="mr-auto inline-flex items-center gap-2 text-xs text-muted-foreground">
            <input type="hidden" name="tech" value="0" />
            <input
              type="checkbox"
              name="tech"
              value="1"
              defaultChecked={showTechnical}
              className="h-4 w-4 rounded border-orange-primary/40"
            />
            Mostrar eventos técnicos/estructurales
          </label>
          <Button type="submit" className="min-w-28">
            Aplicar filtros
          </Button>
          {(rawSearch || tableFilter || actionFilter || showTechnical) && (
            <Button variant="ghost" type="button" asChild>
              <Link href="/admin/audit-log">Limpiar</Link>
            </Button>
          )}
        </div>
      </form>

      <div className="overflow-x-auto rounded-md border">
        <table className="min-w-[960px] text-sm">
          <thead className="bg-foreground/5 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Momento</th>
              <th className="px-3 py-2 font-medium">Tabla</th>
              <th className="px-3 py-2 font-medium">Acción</th>
              <th className="px-3 py-2 font-medium">Usuario</th>
              <th className="px-3 py-2 font-medium">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {groupedEntries.map((group) => (
              <tr key={group.key} className="border-t align-top">
                <MomentCell value={group.primary.created_at} />
                <td className="px-3 py-3">
                  <code className="rounded bg-muted/60 px-1.5 py-0.5 text-xs">
                    {group.primary.table_name}
                  </code>
                </td>
                <td className="px-3 py-3">
                  <Badge
                    variant={
                      group.primary.action === "DELETE"
                        ? "destructive"
                        : group.primary.action === "INSERT"
                        ? "secondary"
                        : "default"
                    }
                  >
                    {group.primary.action}
                  </Badge>
                </td>
                <td className="px-3 py-3">
                  <div className="font-medium">
                    {group.primary.actor_email ?? group.primary.actor_id ?? "Sistema"}
                  </div>
                  {group.primary.actor_id && group.primary.actor_email && (
                    <div className="text-xs text-muted-foreground">
                      {group.primary.actor_id}
                    </div>
                  )}
                </td>
                <td className="px-3 py-3">
                  <div className="text-sm font-medium">{buildGroupSummary(group, obraNamesById)}</div>
                  {renderGroupHighlights(group)}
                  {(group.primary.before_data || group.primary.after_data) && (
                    <details className="mt-2 text-xs">
                      <summary className="cursor-pointer text-muted-foreground">
                        Ver datos tecnicos
                      </summary>
                      <div className="mt-2 space-y-2 rounded-md bg-muted/40 p-2">
                        {group.entries.length === 1 ? (
                          <div className="text-[11px] text-muted-foreground">
                            Registro: {formatPrimaryKey(group.primary.row_pk)}
                          </div>
                        ) : (
                          <div className="text-[11px] text-muted-foreground">
                            Registros afectados:{" "}
                            {getUniqueTargets(group.entries).slice(0, 8).join(", ")}
                            {getUniqueTargets(group.entries).length > 8 ? ", ..." : ""}
                          </div>
                        )}
                        {group.entries.length > 1 && (
                          <div className="text-[11px] text-muted-foreground">
                            Incluye {group.entries.length} eventos agrupados.
                          </div>
                        )}
                        {group.primary.before_data && (
                          <div>
                            <div className="mb-1 font-medium">Antes</div>
                            <pre className="overflow-x-auto rounded bg-background/60 p-2 text-[11px] leading-relaxed">
                              {JSON.stringify(group.primary.before_data, null, 2)}
                            </pre>
                          </div>
                        )}
                        {group.primary.after_data && (
                          <div>
                            <div className="mb-1 font-medium">Después</div>
                            <pre className="overflow-x-auto rounded bg-background/60 p-2 text-[11px] leading-relaxed">
                              {JSON.stringify(group.primary.after_data, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </details>
                  )}
                </td>
              </tr>
            ))}
            {groupedEntries.length === 0 && (
              <tr>
                <td className="px-3 py-6 text-center text-sm text-muted-foreground" colSpan={5}>
                  No hay eventos que coincidan con los filtros seleccionados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <div>
          {totalPages === null ? `Página ${page}` : `Página ${page} de ${totalPages}`}
        </div>
        <div className="flex gap-2">
          <PaginationLink
            label="Anterior"
            page={page - 1}
            disabled={page <= 1}
            baseParams={baseParams}
          />
          <PaginationLink
            label="Siguiente"
            page={page + 1}
            disabled={!hasNextPage}
            baseParams={baseParams}
          />
        </div>
      </div>
    </div>
  )
}

function PaginationLink({
  label,
  page,
  disabled,
  baseParams,
}: {
  label: string
  page: number
  disabled: boolean
  baseParams: URLSearchParams
}) {
  if (disabled) {
    return (
      <span className="cursor-not-allowed rounded-md border px-3 py-1 text-muted-foreground/70">
        {label}
      </span>
    )
  }
  const params = new URLSearchParams(baseParams)
  params.set("page", String(page))
  return (
    <Button asChild variant="outline">
      <Link href={`/admin/audit-log?${params.toString()}`}>{label}</Link>
    </Button>
  )
}

function groupAuditRows(rows: AuditLogRow[]): AuditLogGroup[] {
  const groups = new Map<string, AuditLogGroup>()
  for (const row of rows) {
    const key = buildGroupKey(row)
    const existing = groups.get(key)
    if (existing) {
      existing.entries.push(row)
      continue
    }
    groups.set(key, {
      key,
      primary: row,
      entries: [row],
    })
  }
  return Array.from(groups.values())
}

function buildGroupKey(row: AuditLogRow): string {
  const actor = row.actor_id ?? row.actor_email ?? "system"
  const secondBucket = row.created_at.slice(0, 19)
  if (shouldUseBulkGrouping(row) && hasPrimaryKey(row)) {
    return `${secondBucket}|${actor}|${row.table_name}|${row.action}|bulk`
  }
  const target = buildTargetKey(row)
  return `${secondBucket}|${actor}|${row.table_name}|${row.action}|${target}`
}

function buildGroupSummary(group: AuditLogGroup, obraNamesById: ObraNameMap): string {
  if (group.entries.length === 1) return buildNaturalSummary(group.primary, obraNamesById)
  const uniqueTargets = getUniqueTargets(group.entries)
  return `${buildNaturalSummary(group.primary, obraNamesById)} (${group.entries.length} eventos, ${uniqueTargets.length} registros)`
}

function renderGroupHighlights(group: AuditLogGroup) {
  if (group.entries.length === 1) {
    return renderChangeHighlights(group.primary)
  }

  const unionCellChanges = new Set<string>()
  const unionKeys = new Set<string>()

  for (const entry of group.entries) {
    for (const cell of getRowDataChangedFields(entry.before_data, entry.after_data)) {
      unionCellChanges.add(cell)
    }
    for (const key of entry.changed_keys ?? []) {
      if (key !== "updated_at" && key !== "data") {
        unionKeys.add(key)
      }
    }
  }

  if (unionCellChanges.size > 0) {
    return (
      <div className="mt-1 text-xs text-muted-foreground">
        Celdas editadas: {Array.from(unionCellChanges).slice(0, 12).join(", ")}
      </div>
    )
  }

  if (unionKeys.size > 0) {
    return (
      <div className="mt-1 text-xs text-muted-foreground">
        Campos: {Array.from(unionKeys).slice(0, 12).join(", ")}
      </div>
    )
  }

  return (
    <div className="mt-1 text-xs text-muted-foreground">
      Se agruparon cambios similares en el mismo instante
    </div>
  )
}

function shouldUseBulkGrouping(entry: AuditLogRow): boolean {
  if (entry.action !== "UPDATE") return false
  const rowDataChanges = getRowDataChangedFields(entry.before_data, entry.after_data)
  if (rowDataChanges.length > 0) return false
  const relevantKeys = (entry.changed_keys ?? []).filter(
    (key) => key !== "updated_at" && key !== "data"
  )
  return relevantKeys.length === 0
}

function getUniqueTargets(entries: AuditLogRow[]): string[] {
  const unique = new Set<string>()
  for (const entry of entries) {
    unique.add(formatPrimaryKey(entry.row_pk))
  }
  return Array.from(unique)
}

async function loadObraNamesMap(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  groups: AuditLogGroup[]
): Promise<ObraNameMap> {
  const obraIds = new Set<string>()
  for (const group of groups) {
    for (const entry of group.entries) {
      const obraId = getObraIdFromEntry(entry)
      if (obraId) obraIds.add(obraId)
      if (entry.table_name === "obras") {
        const targetId = readString(entry.row_pk, "id")
        if (targetId) obraIds.add(targetId)
      }
    }
  }

  if (obraIds.size === 0) return new Map()

  const ids = Array.from(obraIds)
  const map = new Map<string, string>()
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200)
    const { data, error } = await supabase
      .from("obras")
      .select("id, n, designacion_y_ubicacion")
      .eq("tenant_id", tenantId)
      .in("id", chunk)

    if (error) {
      console.error("[admin/audit-log] failed to resolve obra names", error)
      return map
    }

    for (const obra of data ?? []) {
      const row = obra as { id: string; n: number | null; designacion_y_ubicacion: string | null }
      const name = normalizeObraName(row.designacion_y_ubicacion)
      if (name) {
        map.set(row.id, name)
      } else if (typeof row.n === "number") {
        map.set(row.id, `Obra #${row.n}`)
      } else {
        map.set(row.id, row.id)
      }
    }
  }
  return map
}

function buildNaturalSummary(entry: AuditLogRow, obraNamesById: ObraNameMap): string {
  if (entry.table_name === "obra_document_uploads") {
    return buildDocumentUploadSummary(entry, obraNamesById)
  }
  if (entry.table_name === "obra_tabla_rows") {
    if (entry.action === "INSERT") return "Agrego una fila de datos"
    if (entry.action === "DELETE") return "Elimino una fila de datos"
    return "Edito una fila de datos"
  }
  if (entry.table_name === "obra_tablas") {
    if (entry.action === "INSERT") return "Creo una tabla OCR"
    if (entry.action === "DELETE") return "Elimino una tabla OCR"
    return "Edito la configuracion de una tabla OCR"
  }
  if (entry.table_name === "obra_tabla_columns") {
    if (entry.action === "INSERT") return "Agrego una columna a una tabla OCR"
    if (entry.action === "DELETE") return "Elimino una columna de una tabla OCR"
    return "Edito una columna de una tabla OCR"
  }
  if (entry.table_name === "ocr_document_processing") {
    if (entry.action === "INSERT") return "Inicio un proceso de OCR"
    if (entry.action === "DELETE") return "Elimino un proceso de OCR"
    return "Actualizo el proceso de OCR"
  }
  if (entry.table_name === "obras") {
    return buildObraSummary(entry, obraNamesById)
  }

  const tableLabel = getTableLabel(entry.table_name)
  if (entry.action === "INSERT") return `Creo un registro en ${tableLabel}`
  if (entry.action === "DELETE") return `Elimino un registro de ${tableLabel}`
  return `Edito un registro en ${tableLabel}`
}

function buildObraSummary(entry: AuditLogRow, obraNamesById: ObraNameMap): string {
  const obraName = resolveObraName(entry, obraNamesById)
  const obraSuffix = obraName ? ` (${obraName})` : ""
  if (entry.action === "INSERT") return `Creo una obra${obraSuffix}`
  if (entry.action === "DELETE") return `Elimino una obra${obraSuffix}`

  const changed = getRelevantChangedKeys(entry)
  if (changed.length > 0) {
    return `Edito una obra (${changed.join(", ")})${obraSuffix}`
  }
  return `Edito una obra${obraSuffix}`
}

function buildDocumentUploadSummary(entry: AuditLogRow, obraNamesById: ObraNameMap): string {
  const data = entry.after_data ?? entry.before_data
  const fileName = readString(data, "file_name") ?? extractFileNameFromPath(readString(data, "storage_path"))
  const folder = extractFolderLabel(readString(data, "storage_path"))
  const obraName = resolveObraName(entry, obraNamesById)

  const filePart = fileName ? ` (${fileName})` : ""
  const folderPart = folder ? ` en la carpeta ${folder}` : ""
  const obraPart = obraName ? ` de la obra ${obraName}` : ""

  if (entry.action === "INSERT") {
    return `Subio un documento${filePart}${folderPart}${obraPart}`
  }
  if (entry.action === "DELETE") {
    return `Elimino un documento${filePart}${folderPart}${obraPart}`
  }
  return `Actualizo un documento${filePart}${folderPart}${obraPart}`
}

function resolveObraName(entry: AuditLogRow, obraNamesById: ObraNameMap): string | null {
  if (entry.table_name === "obras") {
    const direct =
      normalizeObraName(readString(entry.after_data, "designacion_y_ubicacion")) ??
      normalizeObraName(readString(entry.before_data, "designacion_y_ubicacion"))
    if (direct) return direct
  }
  const obraId = getObraIdFromEntry(entry)
  if (!obraId) return null
  return obraNamesById.get(obraId) ?? `(${obraId})`
}

function getObraIdFromEntry(entry: AuditLogRow): string | null {
  return (
    readString(entry.after_data, "obra_id") ??
    readString(entry.before_data, "obra_id") ??
    readString(entry.row_pk, "obra_id") ??
    null
  )
}

function extractFolderLabel(storagePath: string | null): string | null {
  if (!storagePath) return null
  const chunks = storagePath.split("/").filter(Boolean)
  if (chunks.length <= 1) return null
  const folder = chunks[chunks.length - 2]
  return folder || null
}

function extractFileNameFromPath(storagePath: string | null): string | null {
  if (!storagePath) return null
  const chunks = storagePath.split("/").filter(Boolean)
  if (chunks.length === 0) return null
  return chunks[chunks.length - 1] ?? null
}

function normalizeObraName(value: string | null): string | null {
  if (!value) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function getRelevantChangedKeys(entry: AuditLogRow): string[] {
  return (entry.changed_keys ?? []).filter(
    (key) => key !== "updated_at" && key !== "data" && key !== "created_at"
  )
}

function isMetadataOnlyUpdate(entry: AuditLogRow): boolean {
  if (entry.action !== "UPDATE") return false
  if (getRelevantChangedKeys(entry).length > 0) return false
  if (getRowDataChangedFields(entry.before_data, entry.after_data).length > 0) return false
  return true
}

function renderChangeHighlights(entry: AuditLogRow) {
  const rowDataChanges = getRowDataChangedFields(entry.before_data, entry.after_data)
  if (rowDataChanges.length > 0) {
    return (
      <div className="mt-1 text-xs text-muted-foreground">
        Celdas editadas: {rowDataChanges.join(", ")}
      </div>
    )
  }

  const relevantKeys = getRelevantChangedKeys(entry)
  if (relevantKeys.length > 0) {
    return (
      <div className="mt-1 text-xs text-muted-foreground">
        Campos: {relevantKeys.join(", ")}
      </div>
    )
  }

  return <div className="mt-1 text-xs text-muted-foreground">Sin detalle de campos</div>
}

function getRowDataChangedFields(
  beforeData: Record<string, unknown> | null,
  afterData: Record<string, unknown> | null
): string[] {
  const beforeRowData = asRecord(beforeData?.data)
  const afterRowData = asRecord(afterData?.data)
  if (!beforeRowData || !afterRowData) return []

  const keys = new Set([...Object.keys(beforeRowData), ...Object.keys(afterRowData)])
  const changed: string[] = []
  for (const key of keys) {
    if (beforeRowData[key] !== afterRowData[key]) {
      changed.push(key)
    }
  }
  return changed.slice(0, 8)
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function readString(
  source: Record<string, unknown> | Record<string, string | null> | null | undefined,
  key: string
): string | null {
  if (!source) return null
  const raw = source[key]
  if (typeof raw !== "string") return null
  const value = raw.trim()
  return value.length > 0 ? value : null
}

function hasPrimaryKey(entry: AuditLogRow): boolean {
  return Boolean(entry.row_pk && Object.keys(entry.row_pk).length > 0)
}

function buildTargetKey(entry: AuditLogRow): string {
  if (!entry.row_pk || Object.keys(entry.row_pk).length === 0) {
    return `audit:${entry.id}`
  }
  const normalized = Object.entries(entry.row_pk)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}:${value ?? ""}`)
    .join("|")
  return normalized || `audit:${entry.id}`
}

function getTableLabel(tableName: string) {
  const found = TABLE_FILTERS.find((item) => item.value === tableName)
  return found?.label.toLowerCase() ?? tableName
}


function formatPrimaryKey(rowPk: Record<string, string | null> | null) {
  if (!rowPk || Object.keys(rowPk).length === 0) return "—"
  const preferredKeys = ["id", "obra_id", "pendiente_id", "n"]
  for (const key of preferredKeys) {
    const value = rowPk[key]
    if (value) {
      return `${key}: ${value}`
    }
  }
  return Object.entries(rowPk)
    .map(([key, value]) => `${key}: ${value ?? ""}`)
    .join(", ")
}
