import Link from "next/link"
import { createClient } from "@/utils/supabase/server"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { resolveTenantMembership } from "@/lib/tenant-selection"
import { MomentCell } from "./_components/moment-cell"

const PAGE_SIZE = 50
const TABLE_FILTERS: { label: string; value: string }[] = [
  { value: "", label: "Todas las tablas" },
  { value: "obras", label: "Obras" },
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
  const offset = (page - 1) * PAGE_SIZE
  const rawSearch = typeof sp.q === "string" ? sp.q : ""
  const sanitizedSearch = rawSearch.replace(/[,]/g, "").trim()
  const tableFilter = typeof sp.table === "string" ? sp.table : ""
  const actionFilter = typeof sp.action === "string" ? sp.action : ""

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

  let query = supabase
    .from("audit_log")
    .select("*", { count: "exact" })
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  if (tableFilter) {
    query = query.eq("table_name", tableFilter)
  }
  if (actionFilter) {
    query = query.eq("action", actionFilter)
  }
  if (sanitizedSearch) {
    const ilike = `%${sanitizedSearch}%`
    query = query.or(
      [
        `actor_email.ilike.${ilike}`,
        `table_name.ilike.${ilike}`,
        `row_pk->>id.ilike.${ilike}`,
        `row_pk->>obra_id.ilike.${ilike}`,
      ].join(",")
    )
  }

  const { data: rows, error, count } = await query
  if (error) {
    console.error("[admin/audit-log] failed to load audit log", error)
    return (
      <div className="p-6 text-sm">
        No se pudo cargar el historial de auditoría. Intentalo de nuevo más tarde.
      </div>
    )
  }

  const entries = (rows ?? []) as AuditLogRow[]
  const total = count ?? entries.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const baseParams = new URLSearchParams()
  if (rawSearch) baseParams.set("q", rawSearch)
  if (tableFilter) baseParams.set("table", tableFilter)
  if (actionFilter) baseParams.set("action", actionFilter)

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
          Mostrando {entries.length} de {total} eventos
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
          <Button type="submit" className="min-w-28">
            Aplicar filtros
          </Button>
          {(rawSearch || tableFilter || actionFilter) && (
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
              <th className="px-3 py-2 font-medium">Registro</th>
              <th className="px-3 py-2 font-medium">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} className="border-t align-top">
                <MomentCell value={entry.created_at} />
                <td className="px-3 py-3">
                  <code className="rounded bg-muted/60 px-1.5 py-0.5 text-xs">
                    {entry.table_name}
                  </code>
                </td>
                <td className="px-3 py-3">
                  <Badge
                    variant={
                      entry.action === "DELETE"
                        ? "destructive"
                        : entry.action === "INSERT"
                        ? "secondary"
                        : "default"
                    }
                  >
                    {entry.action}
                  </Badge>
                </td>
                <td className="px-3 py-3">
                  <div className="font-medium">
                    {entry.actor_email ?? entry.actor_id ?? "Sistema"}
                  </div>
                  {entry.actor_id && entry.actor_email && (
                    <div className="text-xs text-muted-foreground">
                      {entry.actor_id}
                    </div>
                  )}
                </td>
                <td className="px-3 py-3 font-mono text-xs">
                  {formatPrimaryKey(entry.row_pk)}
                </td>
                <td className="px-3 py-3">
                  {entry.changed_keys && entry.changed_keys.length > 0 ? (
                    <div className="text-xs">
                      Campos: {entry.changed_keys.join(", ")}
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground">—</div>
                  )}
                  {(entry.before_data || entry.after_data) && (
                    <details className="mt-2 text-xs">
                      <summary className="cursor-pointer text-muted-foreground">
                        Ver datos
                      </summary>
                      <div className="mt-2 space-y-2 rounded-md bg-muted/40 p-2">
                        {entry.before_data && (
                          <div>
                            <div className="mb-1 font-medium">Antes</div>
                            <pre className="overflow-x-auto rounded bg-background/60 p-2 text-[11px] leading-relaxed">
                              {JSON.stringify(entry.before_data, null, 2)}
                            </pre>
                          </div>
                        )}
                        {entry.after_data && (
                          <div>
                            <div className="mb-1 font-medium">Después</div>
                            <pre className="overflow-x-auto rounded bg-background/60 p-2 text-[11px] leading-relaxed">
                              {JSON.stringify(entry.after_data, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </details>
                  )}
                </td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td className="px-3 py-6 text-center text-sm text-muted-foreground" colSpan={6}>
                  No hay eventos que coincidan con los filtros seleccionados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <div>
          Página {page} de {totalPages}
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
            disabled={page >= totalPages}
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
