import { createClient } from "@/utils/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { parseLocalDate, formatLocalDate } from "@/utils/date";
import { revalidatePath } from "next/cache";
import { addHours } from "date-fns";
import { Info } from "lucide-react";
import { PendientesCalendar, type CalendarEventPayload } from "./_components/pendientes-calendar";
import { resolveTenantMembership } from "@/lib/tenant-selection";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

type NotificationRow = {
  id: string;
  title: string;
  body: string | null;
  type: string;
  action_url: string | null;
  created_at: string;
  read_at: string | null;
  data: any;
};

export default async function NotificationsIndexPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  const currentUserEmail = auth.user?.email ?? null;
  if (!userId) {
    return (
      <div className="p-6 text-sm">Inicia sesión para ver tus notificaciones.</div>
    );
  }

  const { data: memberships } = await supabase
    .from("memberships")
    .select("tenant_id, role")
    .eq("user_id", userId);
  const { tenantId } = await resolveTenantMembership(memberships);
  if (!tenantId) {
    return (
      <div className="p-6 text-sm">No se encontró una organización activa.</div>
    );
  }

  // Only fetch reminders — the only query actually used
  const selectCols = "id,title,body,type,action_url,created_at,read_at,data,pendiente_id";
  const { data: remData } = await supabase
    .from("notifications")
    .select(selectCols)
    .eq("user_id", userId)
    .eq("tenant_id", tenantId)
    .eq("type", "reminder")
    .order("created_at", { ascending: false });

  const reminders = (remData ?? []) as NotificationRow[];

  // Fetch pendientes details for richer display
  const pendienteIds = Array.from(new Set((reminders as any[]).map((n) => n.pendiente_id).filter(Boolean)));
  let pendientesById: Record<string, { name: string; obra_id: string | null; due_date: string | null }> = {};
  let dueBySchedule: Record<string, string> = {};
  if (pendienteIds.length) {
    const { data: pendRows } = await supabase
      .from("obra_pendientes")
      .select("id,name,obra_id,due_date")
      .in("id", pendienteIds)
      .eq("tenant_id", tenantId);
    for (const r of pendRows ?? []) {
      pendientesById[(r as any).id] = { name: (r as any).name, obra_id: (r as any).obra_id ?? null, due_date: (r as any).due_date ?? null };
    }

    const { data: schedRows } = await supabase
      .from("pendiente_schedules")
      .select("pendiente_id,run_at,stage")
      .in("pendiente_id", pendienteIds)
      .eq("tenant_id", tenantId)
      .eq("stage", "due_today");
    for (const s of schedRows ?? []) {
      const runAtDate = new Date((s as any).run_at);
      dueBySchedule[(s as any).pendiente_id] = formatLocalDate(runAtDate);
    }
  }

  // Fetch calendar events and supporting data
  let calendarEvents: CalendarEventPayload[] = [];
  let availableRoles: { id: string; name: string | null }[] = [];
  let obraNameById = new Map<string, string>();

  if (tenantId) {
    const [obrasRes, rolesRes, userRoleIdsRes, calendarRes, membershipUsersRes] = await Promise.all([
      supabase
        .from("obras")
        .select("id,designacion_y_ubicacion")
        .eq("tenant_id", tenantId),
      supabase
        .from("roles")
        .select("id,key,name")
        .eq("tenant_id", tenantId)
        .order("name"),
      supabase
        .from("user_roles")
        .select("role_id")
        .eq("user_id", userId),
      supabase
        .from("calendar_events")
        .select("*")
        .eq("tenant_id", tenantId),
      supabase
        .from("memberships")
        .select("user_id,users(email)")
        .eq("tenant_id", tenantId),
    ]);

    const obras = obrasRes.data ?? [];
    obraNameById = new Map(
      obras.map((obra: any) => [
        obra.id as string,
        (obra.designacion_y_ubicacion as string) ?? "",
      ])
    );
    const rolesData = rolesRes.data ?? [];
    const userRoleIds = (userRoleIdsRes.data ?? []) as { role_id: string }[];
    const calendarEventRows = calendarRes.data ?? [];

    availableRoles = rolesData.map((r: any) => ({
      id: String(r.id),
      name: r.name ?? null,
    }));
    const roleNameById = new Map(
      rolesData.map((role: any) => [role.id as string, role.name as string])
    );

    const userRoleIdSet = new Set(userRoleIds.map((ur) => ur.role_id));

    // Resolve user names for calendar events
    const userIds = new Set<string>();
    for (const row of calendarEventRows ?? []) {
      if (row.created_by) userIds.add(String(row.created_by));
      if (row.target_user_id) userIds.add(String(row.target_user_id));
    }
    const { data: profileRows } = userIds.size
      ? await supabase
        .from("profiles")
        .select("user_id,full_name")
        .in("user_id", Array.from(userIds))
      : { data: [] as any[] };
    const userNameById = new Map(
      (profileRows ?? []).map((p: any) => [p.user_id as string, p.full_name as string])
    );
    const membershipRows = (membershipUsersRes?.data ?? []) as any[];
    const userEmailById = new Map(
      membershipRows.map((row) => [row.user_id as string, row.users?.email as string])
    );

    const calendarEventsFromTable: CalendarEventPayload[] = (calendarEventRows ?? [])
      .filter((row) => {
        const audienceType = row.audience_type as string | null;
        const targetUserId = row.target_user_id as string | null;
        const targetRoleId = row.target_role_id as string | null;

        if (!audienceType || audienceType === "me") {
          return row.created_by === userId;
        } else if (audienceType === "user") {
          return targetUserId === userId;
        } else if (audienceType === "role") {
          return Boolean(targetRoleId && userRoleIdSet.has(targetRoleId));
        } else if (audienceType === "tenant") {
          return true;
        }
        return false;
      })
      .map((row) => ({
        id: row.id as string,
        title: String(row.title ?? ""),
        description: row.description ?? undefined,
        start: String(row.start_at),
        end: String(row.end_at),
        allDay: Boolean(row.all_day),
        color: (row.color ?? "emerald") as CalendarEventPayload["color"],
        location: row.location ?? undefined,
        completed: Boolean(row.completed),
        pendingStatus: "upcoming" as const,
        obraId: (row.obra_id as string | null) ?? undefined,
        obraName: row.obra_id ? obraNameById.get(row.obra_id as string) : undefined,
        audienceType: (row.audience_type as CalendarEventPayload["audienceType"]) ?? undefined,
        targetUserId: (row.target_user_id as string | null) ?? undefined,
        targetUserName: row.target_user_id
          ? (row.target_user_id === userId
            ? currentUserEmail ?? userNameById.get(row.target_user_id as string)
            : userNameById.get(row.target_user_id as string) ??
            userEmailById.get(row.target_user_id as string))
          : undefined,
        targetRoleId: (row.target_role_id as string | null) ?? undefined,
        targetRoleName: row.target_role_id
          ? roleNameById.get(row.target_role_id as string)
          : undefined,
        createdById: (row.created_by as string | null) ?? undefined,
        createdByName: row.created_by
          ? (row.created_by === userId
            ? currentUserEmail ?? userNameById.get(row.created_by as string)
            : userNameById.get(row.created_by as string) ??
            userEmailById.get(row.created_by as string))
          : undefined,
        createdAt: row.created_at ? String(row.created_at) : undefined,
      }));

    calendarEvents = [...calendarEventsFromTable];
  }

  const pendienteCalendarItems = parsePendienteRows(
    (reminders ?? []) as NotificationRow[],
    pendientesById,
    dueBySchedule
  );
  const pendienteCalendarEvents = buildCalendarEvents(
    pendienteCalendarItems,
    obraNameById
  );

  calendarEvents = [
    ...pendienteCalendarEvents,
    ...calendarEvents,
  ];

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);
  const next7Days = new Date(startOfToday);
  next7Days.setDate(next7Days.getDate() + 7);

  const totalPendientes = calendarEvents.filter((event) => !event.completed).length;
  const totalCompletados = calendarEvents.filter((event) => Boolean(event.completed)).length;
  const totalVencidos = calendarEvents.filter((event) => {
    const start = new Date(event.start);
    return !event.completed && start < startOfToday;
  }).length;
  const startCurrent7 = new Date(startOfToday);
  startCurrent7.setDate(startCurrent7.getDate() - 7);
  const startPrev7 = new Date(startCurrent7);
  startPrev7.setDate(startPrev7.getDate() - 7);

  const inRange = (date: Date, start: Date, end: Date) => date >= start && date < end;

  const getDeltaPct = (current: number, previous: number) => {
    if (previous === 0) {
      return current === 0 ? 0 : 100;
    }
    return Math.round(((current - previous) / previous) * 100);
  };

  const currentPendientes7 = calendarEvents.filter((event) => {
    const start = new Date(event.start);
    return !event.completed && inRange(start, startCurrent7, endOfToday);
  }).length;
  const prevPendientes7 = calendarEvents.filter((event) => {
    const start = new Date(event.start);
    return !event.completed && inRange(start, startPrev7, startCurrent7);
  }).length;

  const currentCompletados7 = calendarEvents.filter((event) => {
    const start = new Date(event.start);
    return Boolean(event.completed) && inRange(start, startCurrent7, endOfToday);
  }).length;
  const prevCompletados7 = calendarEvents.filter((event) => {
    const start = new Date(event.start);
    return Boolean(event.completed) && inRange(start, startPrev7, startCurrent7);
  }).length;

  const currentVencidos7 = calendarEvents.filter((event) => {
    const start = new Date(event.start);
    return !event.completed && start < startOfToday && inRange(start, startCurrent7, endOfToday);
  }).length;
  const prevVencidos7 = calendarEvents.filter((event) => {
    const start = new Date(event.start);
    return !event.completed && start < startCurrent7 && inRange(start, startPrev7, startCurrent7);
  }).length;

  const proximosEventosAll = calendarEvents
    .filter((event) => {
      const start = new Date(event.start);
      return start >= now && start < next7Days;
    })
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  const currentProximos7 = proximosEventosAll.length;
  const prevProximos7 = calendarEvents.filter((event) => {
    const start = new Date(event.start);
    return inRange(start, startPrev7, startCurrent7);
  }).length;

  const metrics = [
    {
      title: "Pendientes",
      subtitle: "Últimos 7 días",
      value: totalPendientes,
      delta: getDeltaPct(currentPendientes7, prevPendientes7),
      positiveColor: "bg-cyan-100 text-cyan-700",
      negativeColor: "bg-rose-100 text-rose-700",
    },
    {
      title: "Completados",
      subtitle: "Últimos 7 días",
      value: totalCompletados,
      delta: getDeltaPct(currentCompletados7, prevCompletados7),
      positiveColor: "bg-emerald-100 text-emerald-700",
      negativeColor: "bg-rose-100 text-rose-700",
    },
    {
      title: "Vencidos",
      subtitle: "Últimos 7 días",
      value: totalVencidos,
      delta: getDeltaPct(currentVencidos7, prevVencidos7),
      positiveColor: "bg-rose-100 text-rose-700",
      negativeColor: "bg-emerald-100 text-emerald-700",
    },
    {
      title: "Próximos eventos",
      subtitle: "Próximos 7 días",
      value: proximosEventosAll.length,
      delta: getDeltaPct(currentProximos7, prevProximos7),
      positiveColor: "bg-cyan-100 text-cyan-700",
      negativeColor: "bg-zinc-100 text-zinc-700",
    },
  ] as const;
  const proximosEventos = proximosEventosAll.slice(0, 3);

  async function markAllRead() {
    "use server";
    const s = await createClient();
    const { data: me } = await s.auth.getUser();
    if (!me.user) return;
    const { data: memberships } = await s
      .from("memberships")
      .select("tenant_id, role")
      .eq("user_id", me.user.id);
    const { tenantId } = await resolveTenantMembership(memberships);
    if (!tenantId) return;
    await s
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", me.user.id)
      .eq("tenant_id", tenantId)
      .is("read_at", null);
  }

  async function updateFlujoCalendarEvent(eventId: string, title: string, description: string | undefined, start: string, end: string, allDay: boolean) {
    "use server";
    const actionId = eventId.replace(/^flujo-/, "");

    const s = await createClient();
    const { data: me } = await s.auth.getUser();
    if (!me.user) return;

    const startDate = new Date(start);

    await s
      .from("obra_flujo_actions")
      .update({
        title,
        message: description || null,
        scheduled_date: startDate.toISOString(),
        timing_mode: "scheduled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", actionId);

    revalidatePath("/notifications");
  }

  async function deleteFlujoCalendarEvent(eventId: string) {
    "use server";
    const actionId = eventId.replace(/^flujo-/, "");

    const s = await createClient();
    const { data: me } = await s.auth.getUser();
    if (!me.user) return;

    await s
      .from("obra_flujo_actions")
      .delete()
      .eq("id", actionId);

    revalidatePath("/notifications");
  }

  async function markRead(formData: FormData) {
    "use server";
    const id = String(formData.get("id") ?? "");
    if (!id) return;
    const s = await createClient();
    const { data: me } = await s.auth.getUser();
    if (!me.user) return;
    const { data: memberships } = await s
      .from("memberships")
      .select("tenant_id, role")
      .eq("user_id", me.user.id);
    const { tenantId } = await resolveTenantMembership(memberships);
    if (!tenantId) return;
    await s
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", me.user.id)
      .eq("tenant_id", tenantId);
  }

  async function deleteNotification(formData: FormData) {
    "use server";
    const id = String(formData.get("id") ?? "");
    if (!id) return;
    const s = await createClient();
    const { data: me } = await s.auth.getUser();
    if (!me.user) return;
    const { data: memberships } = await s
      .from("memberships")
      .select("tenant_id, role")
      .eq("user_id", me.user.id);
    const { tenantId } = await resolveTenantMembership(memberships);
    if (!tenantId) return;

    const { data: notification } = await s
      .from("notifications")
      .select("pendiente_id")
      .eq("id", id)
      .eq("user_id", me.user.id)
      .eq("tenant_id", tenantId)
      .single();

    if (!notification) return;

    if ((notification as any).pendiente_id) {
      await s
        .from("obra_pendientes")
        .delete()
        .eq("id", (notification as any).pendiente_id)
        .eq("tenant_id", tenantId);
    } else {
      await s
        .from("notifications")
        .delete()
        .eq("id", id)
        .eq("user_id", me.user.id);
    }

    revalidatePath("/notifications");
  }

  async function deletePendiente(formData: FormData) {
    "use server";
    const pendienteId = String(formData.get("pendiente_id") ?? "");
    if (!pendienteId) return;
    const s = await createClient();
    const { data: me } = await s.auth.getUser();
    if (!me.user) return;
    const { data: memberships } = await s
      .from("memberships")
      .select("tenant_id, role")
      .eq("user_id", me.user.id);
    const { tenantId } = await resolveTenantMembership(memberships);
    if (!tenantId) return;

    const { data: pendiente } = await s
      .from("obra_pendientes")
      .select("obra_id")
      .eq("id", pendienteId)
      .eq("tenant_id", tenantId)
      .single();

    if (!pendiente) return;

    await s
      .from("notifications")
      .delete()
      .eq("pendiente_id", pendienteId);

    await s
      .from("pendiente_schedules")
      .delete()
      .eq("pendiente_id", pendienteId)
      .eq("tenant_id", tenantId);

    await s
      .from("obra_pendientes")
      .delete()
      .eq("id", pendienteId)
      .eq("tenant_id", tenantId);

    revalidatePath("/notifications");
  }

  const DS = {
    page: "bg-stone-100",
    frame: "rounded-3xl border border-stone-200/70 bg-white p-2 shadow-[0_1px_0_rgba(0,0,0,0.03)]",
    frameInner: "rounded-2xl border ",
    panel: "rounded-2xl border border-stone-200 bg-stone-50/60",
    card: "rounded-2xl border border-stone-200/80 bg-white shadow-[0_1px_0_rgba(0,0,0,0.03)]",
  };

  function Framed({
    className,
    innerClassName,
    children,
  }: {
    className?: string;
    innerClassName?: string;
    children: ReactNode;
  }) {
    return (
      <div className={cn(DS.frame, className)}>
        <div className={cn(DS.frameInner, innerClassName)}>{children}</div>
      </div>
    );
  }


  return (
    <div className="flex min-h-svh flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Notificaciones</h1>
        <form action={markAllRead}>
          <Button variant="outline" size="sm">Marcar todas como leídas</Button>
        </form>
      </div>

      <div className="rounded-3xl border border-stone-200/70 bg-white p-2 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
        <div className="no-scrollbar flex w-full gap-3 overflow-x-auto border-none bg-transparent flex-row shadow-[0_20px_60px_rgba(15,23,42,0.06)]" >
          {metrics.map((metric) => {
            const isPositive = metric.delta >= 0;
            const badgeClass = isPositive ? metric.positiveColor : metric.negativeColor;
            const deltaPrefix = metric.delta > 0 ? "+" : "";
            return (
              <Card
                key={metric.title}
                className="min-w-[250px] flex-1 rounded-2xl border border-zinc-200 bg-white shadow-none gap-0 "
              >
                <CardHeader className="space-y-0 pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xs font-medium text-zinc-700">{metric.title}</CardTitle>
                    <Info className="h-3.5 w-3.5 text-zinc-400" />
                  </div>
                  <p className="text-[11px] text-zinc-400">{metric.subtitle}</p>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-end justify-between gap-2">
                    <p className="text-3xl font-semibold tracking-tight text-zinc-900 tabular-nums">
                      {metric.value}
                    </p>
                    {metric.title !== "Próximos eventos" && (
                      <div className="mb-1 flex items-center gap-1.5">
                        <Badge className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badgeClass}`}>
                          {`${deltaPrefix}${metric.delta}%`}
                        </Badge>
                        <span className="text-[10px] text-zinc-400">vs 7d prev.</span>
                      </div>
                    )}
                    {metric.title === "Próximos eventos" && (
                      <div className="mt-2 space-y-1.5 pt-2 bg-muted/50 rounded-full p-2">
                        {proximosEventos.length === 0 ? (
                          <p className="text-[11px] text-zinc-400">Sin eventos programados.</p>
                        ) : (
                          proximosEventos.slice(0, 2).map((event) => (
                            <div
                              key={`preview-${event.id}`}
                              className="flex items-center justify-between gap-2 text-[11px] pl-1.5 pr-1"
                            >
                              <span className="truncate text-zinc-600">{event.title}</span>
                              <span className="shrink-0 tabular-nums text-zinc-400">
                                {new Date(event.start).toLocaleString("es-AR", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <PendientesCalendar
          events={calendarEvents}
          onFlujoEventUpdate={updateFlujoCalendarEvent}
          onFlujoEventDelete={deleteFlujoCalendarEvent}
          availableRoles={availableRoles}
        />
      </div>
    </div>
  );
}

type PendienteItem = {
  id: string;
  pendienteId: string | null;
  title: string;
  documentName: string | null;
  obraId: string | null;
  obraName: string | null;
  dueDate: string | null;
  dueDateObj: Date | null;
  created_at: string;
  read_at: string | null;
  action_url: string | null;
};

function parsePendienteRows(
  rows: NotificationRow[],
  pendientesById: Record<string, { name: string; obra_id: string | null; due_date: string | null }>,
  dueBySchedule: Record<string, string>
): PendienteItem[] {
  return rows.map((r) => {
    const pendienteId = (r as any).pendiente_id;
    const joined = (r as any).pending as { id: string; name: string; obra_id: string | null; due_date: string | null } | undefined;
    const dueDate = pendienteId
      ? (joined?.due_date ?? dueBySchedule[pendienteId] ?? pendientesById[pendienteId]?.due_date ?? r.data?.dueDate ?? null)
      : (r.data?.dueDate ?? null);
    const dueDateObj = parseLocalDate(dueDate);

    return {
      id: r.id,
      pendienteId: pendienteId ?? null,
      title: r.title,
      documentName: r.data?.documentName ?? null,
      obraId: pendienteId ? (pendientesById[pendienteId]?.obra_id ?? r.data?.obraId ?? null) : (r.data?.obraId ?? null),
      obraName: r.data?.obraName ?? null,
      dueDate,
      dueDateObj,
      created_at: r.created_at,
      read_at: r.read_at,
      action_url: r.action_url,
    };
  });
}

function buildCalendarEvents(
  items: PendienteItem[],
  obraNameById?: Map<string, string>
): CalendarEventPayload[] {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  return items.map((item) => {
    const resolvedObraName =
      item.obraName ?? (item.obraId ? obraNameById?.get(item.obraId) : undefined);
    const baseStart = item.dueDateObj ? new Date(item.dueDateObj) : new Date(item.created_at);
    const startDate = new Date(baseStart);
    const endDate = addHours(startDate, 1);
    const hasExplicitTime = item.dueDateObj && (item.dueDateObj.getHours() !== 0 || item.dueDateObj.getMinutes() !== 0);
    const descriptionParts = [];
    if (item.documentName) descriptionParts.push(`Documento: ${item.documentName}`);
    if (resolvedObraName) descriptionParts.push(`Obra: ${resolvedObraName}`);

    let color: CalendarEventPayload["color"] = "emerald";
    let pendingStatus: CalendarEventPayload["pendingStatus"] = "upcoming";
    if (!item.dueDateObj) {
      color = "violet";
      pendingStatus = "nodate";
    } else if (item.dueDateObj < todayStart) {
      color = "rose";
      pendingStatus = "overdue";
    } else if (item.dueDateObj >= todayStart && item.dueDateObj < todayEnd) {
      color = "amber";
      pendingStatus = "today";
    }

    return {
      id: item.pendienteId ?? item.id,
      title: item.title,
      description: descriptionParts.join(" • ") || undefined,
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      allDay: !hasExplicitTime,
      color,
      location: resolvedObraName ?? undefined,
      pendingStatus,
      completed: false,
      obraId: item.obraId ?? undefined,
      obraName: resolvedObraName ?? undefined,
    };
  });
}
