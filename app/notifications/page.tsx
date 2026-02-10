import { createClient } from "@/utils/supabase/server";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { parseLocalDate, formatLocalDate } from "@/utils/date";
import { NotificationsTable } from "./_components/notifications-table";
import { revalidatePath } from "next/cache";
import { addHours } from "date-fns";
import { PendientesCalendar, type CalendarEventPayload } from "./_components/pendientes-calendar";
import { resolveTenantMembership } from "@/lib/tenant-selection";

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

  const sp = (await searchParams) ?? {};
  const tab = typeof sp.tab === "string" ? sp.tab : "calendar";

  // Plain select; we enrich with separate fetch using pendiente_id to avoid FK-name coupling
  const selectCols = "id,title,body,type,action_url,created_at,read_at,data,pendiente_id";
  const [allRes, unreadRes, remRes] = await Promise.all([
    supabase
      .from("notifications")
      .select(selectCols)
      .eq("user_id", userId)
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false }),
    supabase
      .from("notifications")
      .select(selectCols)
      .eq("user_id", userId)
      .eq("tenant_id", tenantId)
      .is("read_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("notifications")
      .select(selectCols)
      .eq("user_id", userId)
      .eq("tenant_id", tenantId)
      .eq("type", "reminder")
      .order("created_at", { ascending: false }),
  ]);

  const all = (allRes.data ?? []) as NotificationRow[];
  const unread = (unreadRes.data ?? []) as NotificationRow[];
  const reminders = (remRes.data ?? []) as NotificationRow[];

  // Fetch pendientes details for richer display
  // Derive pendiente ids from reminders set (task-related)
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

    // Fetch computed due date from schedules (stage = 'due_today') for offset-based pendientes
    const { data: schedRows } = await supabase
      .from("pendiente_schedules")
      .select("pendiente_id,run_at,stage")
      .in("pendiente_id", pendienteIds)
      .eq("tenant_id", tenantId)
      .eq("stage", "due_today");
    for (const s of schedRows ?? []) {
      // Extract date part from timestamp in local timezone
      const runAtDate = new Date((s as any).run_at);
      dueBySchedule[(s as any).pendiente_id] = formatLocalDate(runAtDate);
    }
  }

  // Fetch flujo actions for calendar view
  let flujoCalendarEvents: CalendarEventPayload[] = [];
  let availableRoles: { id: string; name: string | null }[] = [];
  let calendarEventRows: any[] = [];
  let obraNameById = new Map<string, string>();

  let calendarEvents: CalendarEventPayload[] = [];

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
    calendarEventRows = calendarRes.data ?? [];

    availableRoles = rolesData.map((r: any) => ({
      id: String(r.id),
      name: r.name ?? null,
    }));
    const roleNameById = new Map(
      rolesData.map((role: any) => [role.id as string, role.name as string])
    );

    // Get current user's role IDs in this tenant
    const userRoleIdSet = new Set(userRoleIds.map((ur) => ur.role_id));

    // We no longer surface calendar events directly from obra_flujo_actions.
    // Instead, when an obra completes, executeFlujoActions creates rows in
    // calendar_events for calendar_event actions at the correct relative time.

    // Filter calendar events based on audience and current user's roles
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

        let show = false;

        if (!audienceType || audienceType === "me") {
          show = row.created_by === userId;
        } else if (audienceType === "user") {
          show = targetUserId === userId;
        } else if (audienceType === "role") {
          show = Boolean(targetRoleId && userRoleIdSet.has(targetRoleId));
        } else if (audienceType === "tenant") {
          show = true;
        }

        console.log("[notifications/calendar] calendar_events visibility", {
          source: "calendar_events",
          id: row.id,
          title: row.title,
          audienceType,
          targetUserId,
          targetRoleId,
          currentUserId: userId,
          userRoleIds: Array.from(userRoleIdSet),
          show,
        });

        return show;
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

    // Combine pendientes and calendar_events rows
    calendarEvents = [
      ...calendarEventsFromTable,
    ];
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
  console.log("[notifications/calendar] pendienteCalendarEvents", pendienteCalendarEvents.map((ev) => ({
    source: "pendiente",
    id: ev.id,
    title: ev.title,
    start: ev.start,
    end: ev.end,
  })));

  calendarEvents = [
    ...pendienteCalendarEvents,
    ...calendarEvents,
  ];

  console.log("[notifications/calendar] final calendarEvents", calendarEvents.map((ev) => ({
    id: ev.id,
    title: ev.title,
    start: ev.start,
    end: ev.end,
  })));

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
    // Extract flujo action ID from event ID (format: "flujo-{action_id}")
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

    // Get the notification to check if it has a pendiente_id
    const { data: notification } = await s
      .from("notifications")
      .select("pendiente_id")
      .eq("id", id)
      .eq("user_id", me.user.id)
      .eq("tenant_id", tenantId)
      .single();

    if (!notification) return;

    // If this notification was linked to a pendiente, delete the pendiente first
    // This will cascade delete all notifications for that pendiente (including this one)
    if ((notification as any).pendiente_id) {
      await s
        .from("obra_pendientes")
        .delete()
        .eq("id", (notification as any).pendiente_id)
        .eq("tenant_id", tenantId);
    } else {
      // If no pendiente_id, just delete the notification
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

    // Verify the pendiente exists and user has access
    const { data: pendiente } = await s
      .from("obra_pendientes")
      .select("obra_id")
      .eq("id", pendienteId)
      .eq("tenant_id", tenantId)
      .single();

    if (!pendiente) return;

    // Manually delete related records first to avoid stack overflow from cascade
    // Delete notifications linked to this pendiente
    await s
      .from("notifications")
      .delete()
      .eq("pendiente_id", pendienteId);

    // Delete schedules linked to this pendiente
    await s
      .from("pendiente_schedules")
      .delete()
      .eq("pendiente_id", pendienteId)
      .eq("tenant_id", tenantId);

    // Now delete the pendiente itself
    await s
      .from("obra_pendientes")
      .delete()
      .eq("id", pendienteId)
      .eq("tenant_id", tenantId);

    revalidatePath("/notifications");
  }

  console.log("[notifications] availableRoles", availableRoles);

  return (
    <div className="p-6 space-y-6 min-h-svh flex flex-col">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Notificaciones</h1>
        <form action={markAllRead}>
          <Button variant="outline" size="sm">Marcar todas como leídas</Button>
        </form>
      </div>

      <Tabs defaultValue={tab} className="w-full flex-1 flex min-h-0 flex-col">
        {/* <TabsList> */}
        {/* <TabsTrigger value="calendar">Calendario</TabsTrigger> */}
        {/* <TabsTrigger value="all">Todas</TabsTrigger> */}
        {/* <TabsTrigger value="unread">No leídas</TabsTrigger> */}
        {/* <TabsTrigger value="pendientes">Pendientes</TabsTrigger> */}
        {/* <TabsTrigger value="test">Test</TabsTrigger> */}
        {/* </TabsList> */}

        {/* <TabsContent value="all" className="space-y-4 flex-1 min-h-0">
          <NotificationsTable rows={(all ?? []) as NotificationRow[]} markRead={markRead} deleteNotification={deleteNotification} />
        </TabsContent>

        <TabsContent value="unread" className="space-y-4 flex-1 min-h-0">
          <NotificationsTable rows={(unread ?? []) as NotificationRow[]} markRead={markRead} deleteNotification={deleteNotification} />
        </TabsContent>

        <TabsContent value="pendientes" className="space-y-4">
          <PendientesTable
            rows={(reminders ?? []) as NotificationRow[]}
            markRead={markRead}
            deleteNotification={deleteNotification}
            deletePendiente={deletePendiente}
            pendientesById={pendientesById}
            dueBySchedule={dueBySchedule}
          />
        </TabsContent> */}

        <TabsContent value="calendar" className="flex-1 min-h-0">
          <PendientesCalendar
            events={calendarEvents}
            onFlujoEventUpdate={updateFlujoCalendarEvent}
            onFlujoEventDelete={deleteFlujoCalendarEvent}
            availableRoles={availableRoles}
          />
        </TabsContent>
        {/* 
        <TabsContent value="test" className="space-y-4 flex-1 min-h-0">
          <NotificationsTable rows={(all ?? []) as NotificationRow[]} markRead={markRead} deleteNotification={deleteNotification} />
        </TabsContent> */}
      </Tabs>
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

function PendientesTable({
  rows,
  markRead,
  deleteNotification,
  deletePendiente,
  pendientesById,
  dueBySchedule,
}: {
  rows: NotificationRow[];
  markRead: (fd: FormData) => Promise<void>;
  deleteNotification: (fd: FormData) => Promise<void>;
  deletePendiente: (fd: FormData) => Promise<void>;
  pendientesById: Record<string, { name: string; obra_id: string | null; due_date: string | null }>;
  dueBySchedule: Record<string, string>;
}) {
  const parsed = parsePendienteRows(rows, pendientesById, dueBySchedule);

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const calendarEvents: CalendarEventPayload[] = parsed.map((item) => {
    const baseStart = item.dueDateObj
      ? new Date(item.dueDateObj)
      : new Date(item.created_at)
    const startDate = new Date(baseStart)
    const endDate = addHours(startDate, 1)
    const hasExplicitTime =
      item.dueDateObj &&
      (item.dueDateObj.getHours() !== 0 || item.dueDateObj.getMinutes() !== 0)
    const descriptionParts = []
    if (item.documentName) {
      descriptionParts.push(`Documento: ${item.documentName}`)
    }
    if (item.obraName) {
      descriptionParts.push(`Obra: ${item.obraName}`)
    }

    let color: CalendarEventPayload["color"] = "emerald"
    if (!item.dueDateObj) {
      color = "violet"
    } else if (item.dueDateObj < todayStart) {
      color = "rose"
    } else if (item.dueDateObj >= todayStart && item.dueDateObj < todayEnd) {
      color = "amber"
    }

    return {
      id: item.pendienteId ?? item.id,
      title: item.title,
      description: descriptionParts.join(" • ") || undefined,
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      allDay: !hasExplicitTime,
      color,
      location: item.obraName ?? undefined,
    }
  })

  // Group by date category: past, today, next

  const grouped = {
    past: [] as PendienteItem[],
    today: [] as PendienteItem[],
    next: [] as PendienteItem[],
    noDate: [] as PendienteItem[],
  };

  parsed.forEach((item) => {
    if (!item.dueDateObj) {
      grouped.noDate.push(item);
      return;
    }

    const dueDate = item.dueDateObj;
    if (dueDate < todayStart) {
      grouped.past.push(item);
    } else if (dueDate >= todayStart && dueDate < todayEnd) {
      grouped.today.push(item);
    } else {
      grouped.next.push(item);
    }
  });

  // Sort items within each group by due date
  const sortByDate = (a: PendienteItem, b: PendienteItem) => {
    if (!a.dueDateObj && !b.dueDateObj) return 0;
    if (!a.dueDateObj) return 1;
    if (!b.dueDateObj) return -1;
    return a.dueDateObj.getTime() - b.dueDateObj.getTime();
  };

  grouped.past.sort(sortByDate);
  grouped.today.sort(sortByDate);
  grouped.next.sort(sortByDate);
  grouped.noDate.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Group items by date for display
  const groupByDate = (items: PendienteItem[]) => {
    const dateGroups: Record<string, PendienteItem[]> = {};
    items.forEach((item) => {
      if (!item.dueDateObj) {
        if (!dateGroups["Sin fecha"]) {
          dateGroups["Sin fecha"] = [];
        }
        dateGroups["Sin fecha"].push(item);
        return;
      }

      const dateKey = formatLocalDate(item.dueDateObj);
      if (!dateGroups[dateKey]) {
        dateGroups[dateKey] = [];
      }
      dateGroups[dateKey].push(item);
    });
    return dateGroups;
  };

  const pastGroups = groupByDate(grouped.past);
  const todayGroups = groupByDate(grouped.today);
  const nextGroups = groupByDate(grouped.next);
  const noDateGroups = groupByDate(grouped.noDate);

  const formatDateHeader = (dateStr: string) => {
    if (dateStr === "Sin fecha") return dateStr;
    const date = parseLocalDate(dateStr) || new Date(dateStr);
    const day = date.getDate();
    const month = date.toLocaleDateString("es-ES", { month: "short" }).toUpperCase();
    const weekday = date.toLocaleDateString("es-ES", { weekday: "long" }).toUpperCase();
    return `${day} ${month}, ${weekday}`;
  };

  const formatTime = (date: Date) => {
    // Check if the date has a specific time (not midnight)
    const hours = date.getHours();
    const minutes = date.getMinutes();
    if (hours === 0 && minutes === 0) {
      return "Todo el día";
    }

    return date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "America/Argentina/Buenos_Aires" });
  };

  const getCardColor = (item: PendienteItem, section: "past" | "today" | "next" | "noDate") => {
    // Sin fecha (no date) - gray
    if (section === "noDate" || !item.dueDateObj) {
      return "bg-gray-50 dark:bg-gray-950/20";
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    // Calculate hours difference for more granular color mapping
    const hoursDiff = (item.dueDateObj.getTime() - now.getTime()) / (1000 * 60 * 60);

    // Today section - yellow with slight variations based on time
    if (section === "today") {
      // If item has specific time, we can add urgency variations
      if (item.dueDateObj.getHours() !== 0 || item.dueDateObj.getMinutes() !== 0) {
        const hoursUntil = (item.dueDateObj.getTime() - now.getTime()) / (1000 * 60 * 60);

        if (hoursUntil <= 0) {
          // Already passed today - orange-ish yellow
          return "bg-orange-100 dark:bg-orange-950/20";
        } else if (hoursUntil <= 1) {
          // Within next hour - bright yellow
          return "bg-yellow-200 dark:bg-yellow-950/30";
        } else if (hoursUntil <= 3) {
          // Within 3 hours - standard yellow
          return "bg-yellow-100 dark:bg-yellow-950/20";
        }
      }
      // Default today color
      return "bg-yellow-100 dark:bg-yellow-950/20";
    }

    // Past - red gradient based on how late
    if (section === "past") {
      const hoursPast = Math.abs(hoursDiff);
      const daysPast = Math.floor(hoursPast / 24);

      // More granular red shades
      if (hoursPast <= 1) {
        // Just missed (within last hour)
        return "bg-red-50 dark:bg-red-950/10";
      } else if (hoursPast <= 6) {
        // Missed today (1-6 hours)
        return "bg-red-100 dark:bg-red-950/20";
      } else if (daysPast <= 1) {
        // Yesterday
        return "bg-red-200 dark:bg-red-950/30";
      } else if (daysPast <= 3) {
        // 2-3 days ago
        return "bg-red-300 dark:bg-red-950/40";
      } else if (daysPast <= 7) {
        // 4-7 days ago
        return "bg-red-400 dark:bg-red-900/50 text-red-950 dark:text-red-100";
      } else if (daysPast <= 14) {
        // 1-2 weeks ago
        return "bg-red-500 dark:bg-red-900/60 text-white dark:text-red-50";
      } else if (daysPast <= 30) {
        // 2-4 weeks ago
        return "bg-red-600 dark:bg-red-900/70 text-white dark:text-red-50";
      } else {
        // Over a month - darkest red
        return "bg-red-700 dark:bg-red-950/80 text-white dark:text-red-50";
      }
    }

    // Next/Future - blue-green gradient based on proximity
    if (section === "next") {
      const hoursUntil = hoursDiff;
      const daysUntil = Math.floor(hoursUntil / 24);

      // Tomorrow (special case - darker blue)

      // More granular future shades
      if (daysUntil <= 2) {
        // Day after tomorrow
        return "bg-teal-100/80 dark:bg-blue-950/30";
      } else if (daysUntil <= 3) {
        // 3 days
        return "bg-teal-100/80 dark:bg-cyan-950/20";
      } else if (daysUntil <= 7) {
        // 4-7 days - blue-green transition
        return "bg-teal-100 dark:bg-teal-950/20";
      } else if (daysUntil <= 14) {
        // 1-2 weeks - green-ish blue
        return "bg-teal-200/80 dark:bg-emerald-950/10";
      } else if (daysUntil <= 30) {
        // 2-4 weeks - very light blue-green
        return "bg-emerald-300/50 dark:bg-green-950/10";
      } else {
        // Over a month - lightest shade
        return "bg-green-100/80 dark:bg-green-950/20";
      }
    }

    // Fallback
    return "bg-gray-50 dark:bg-gray-950/20";
  };

  // Map time distance to visual style (day-based) similar to the provided HTML demo
  const getVisualForItem = (item: PendienteItem): {
    bg: string;
    fg: string;
    iconBg: string;
    title: string;
    message: string;
    icon: string;
  } => {
    if (!item.dueDateObj) {
      return {
        bg: "rgba(243, 244, 246, 0.85)",
        fg: "#111827",
        iconBg: "rgba(229, 231, 235, 0.85)",
        title: item.documentName ?? item.title,
        message: "Sin fecha",
        icon: "📋",
      };
    }
    const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const todayStart = startOf(new Date()).getTime();
    const dueStart = startOf(item.dueDateObj).getTime();
    const dayMs = 24 * 60 * 60 * 1000;
    const dayDiff = Math.round((dueStart - todayStart) / dayMs); // negative => past, 0 today, positive => future

    let color = "#f3f4f6";
    let textColor = "#111827";
    let iconBg = "#e5e7eb";
    let message = "";
    let icon = "📅";
    let title = item.documentName ?? item.title;

    if (dayDiff < 0) {
      const daysLate = Math.abs(dayDiff);
      if (daysLate > 14) {
        color = "#800000"; textColor = "#ffffff"; iconBg = "#600000"; icon = "💀"; message = `hace ${daysLate} días`;
      } else if (daysLate > 7) {
        color = "#cc0000"; textColor = "#ffffff"; iconBg = "#990000"; icon = "🚨"; message = `hace ${daysLate} días`;
      } else if (daysLate > 3) {
        color = "#ff4444"; textColor = "#ffffff"; iconBg = "#cc0000"; icon = "❗"; message = `hace ${daysLate} días`;
      } else {
        color = "#ff9999"; textColor = "#7f0000"; iconBg = "#ff6666"; icon = "⚠️"; message = `hace ${daysLate} días`;
      }
    } else if (dayDiff === 0) {
      color = "#ffd700"; textColor = "#664d00"; iconBg = "#ffcc00"; icon = "⚡"; message = "Hoy";
    } else if (dayDiff === 1) {
      color = "#48d1cc"; textColor = "#0e4543"; iconBg = "#30a8a3"; icon = "📝"; message = "Mañana";
    } else if (dayDiff === 2) {
      color = "#40e0d0"; textColor = "#0a4d46"; iconBg = "#2cbab0"; icon = "📅"; message = "En 2 días";
    } else if (dayDiff === 3) {
      color = "#87ceeb"; textColor = "#1e4455"; iconBg = "#5fa9c9"; icon = "📆"; message = "En 3 días";
    } else if (dayDiff <= 7) {
      color = "#87cefa"; textColor = "#1a4460"; iconBg = "#5fa9d8"; icon = "📘"; message = `Esta semana (en ${dayDiff} días)`;
    } else {
      color = "#4682b4"; textColor = "#ffffff"; iconBg = "#36648b"; icon = "📌"; message = `En ${dayDiff} días`;
    }

    const withAlpha = (hex: string, alpha: number) => {
      const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      if (!m) return hex;
      const r = parseInt(m[1], 16);
      const g = parseInt(m[2], 16);
      const b = parseInt(m[3], 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    return { bg: withAlpha(color, 0.85), fg: textColor, iconBg: withAlpha(iconBg, 0.85), title, message, icon };
  };

  // Optional: Helper function to get urgency level for additional styling
  const getUrgencyLevel = (item: PendienteItem): "critical" | "high" | "medium" | "low" | "none" => {
    if (!item.dueDateObj) return "none";

    const now = new Date();
    const hoursDiff = (item.dueDateObj.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursDiff < -24) return "critical";  // Over a day late
    if (hoursDiff < 0) return "high";        // Late
    if (hoursDiff < 24) return "medium";     // Within 24 hours
    if (hoursDiff < 72) return "low";        // Within 3 days
    return "none";                           // More than 3 days away
  };

  // Optional: Get icon or badge based on timing
  const getTimingIcon = (item: PendienteItem): string => {
    if (!item.dueDateObj) return "📋";

    const now = new Date();
    const hoursDiff = (item.dueDateObj.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursDiff < -48) return "🚨";    // Very late
    if (hoursDiff < -24) return "❗";     // Late
    if (hoursDiff < 0) return "⚠️";      // Just late
    if (hoursDiff < 1) return "⚡";      // Very soon
    if (hoursDiff < 24) return "⏰";     // Today
    if (hoursDiff < 72) return "🔔";     // This week
    return "📅";                         // Future
  };

  // Helper functions for time display
  const getRelativeTime = (date: Date): string => {
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    const absDiff = Math.abs(diff);
    const hours = Math.floor(absDiff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (diff < 0) {
      if (days > 0) return `hace ${days} día${days > 1 ? 's' : ''}`;
      if (hours > 0) return `hace ${hours} hora${hours > 1 ? 's' : ''}`;
      return "hace menos de 1 hora";
    } else {
      if (days > 0) return `en ${days} día${days > 1 ? 's' : ''}`;
      if (hours > 0) return `en ${hours} hora${hours > 1 ? 's' : ''}`;
      return "en menos de 1 hora";
    }
  };

  const getTimeRemaining = (date: Date): string => {
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const getTimeProgress = (date: Date): number => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const total = date.getTime() - todayStart.getTime();
    const elapsed = now.getTime() - todayStart.getTime();
    const progress = (elapsed / total) * 100;
    return Math.min(Math.max(progress, 0), 100);
  };

  // Timing badge component
  const TimingBadge = ({ item }: { item: PendienteItem }) => {
    const icon = getTimingIcon(item);
    const urgency = getUrgencyLevel(item);

    const badgeColors = {
      critical: "bg-red-500 text-white",
      high: "bg-orange-500 text-white",
      medium: "bg-yellow-500 text-white",
      low: "bg-blue-500 text-white",
      none: "bg-gray-300 text-gray-700"
    };

    if (urgency === "none") return null;

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${badgeColors[urgency]}`}>
        <span>{icon}</span>
        {urgency === "critical" && "Muy atrasado"}
        {urgency === "high" && "Atrasado"}
        {urgency === "medium" && "Urgente"}
        {urgency === "low" && "Próximo"}
      </span>
    );
  };

  const renderDateGroup = (dateStr: string, items: PendienteItem[], section: "past" | "today" | "next" | "noDate") => {
    const actualSection = dateStr === "Sin fecha" ? "noDate" : section;
    return (
      <div key={dateStr} className="space-y-4">
        <h3 className="text-sm font-bold text-foreground/80 tracking-wide">
          {formatDateHeader(dateStr)}
        </h3>
        <div className="relative space-y-3">
          {/* vertical timeline line with multi-stop gradient */}
          {items.map((item) => {
            const v = getVisualForItem(item);
            const isLate = item.dueDateObj && item.dueDateObj < new Date();
            const isToday = section === "today";
            const isSoon = item.dueDateObj && (item.dueDateObj.getTime() - new Date().getTime()) / (1000 * 60 * 60) < 24;

            return (
              <div
                key={item.id}
                className="relative group flex w-full items-center gap-2 justify-start"
              >
                {/* timeline dot */}
                <div
                  className=" w-5 h-5 rounded-full bg-white border-4 transition-all"
                  style={{ borderColor: v.bg }}
                />
                <div
                  className="rounded-xl p-4 shadow-sm transition-all duration-300 hover:shadow-lg hover:translate-x-[5px] hover:scale-[1.02] cursor-pointer flex-1"
                  style={{ backgroundColor: v.bg, color: v.fg }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex gap-3">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0"
                        style={{ background: v.iconBg, color: v.fg }}
                      >
                        {v.icon}
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-base flex items-center gap-2">
                          {v.title}
                          {isLate && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-white/20">
                              Atrasado
                            </span>
                          )}
                          {isToday && !isLate && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-white/20">
                              Hoy
                            </span>
                          )}
                        </div>
                        <div className="text-xs/5 ">{v.message}</div>
                        {item.title && item.documentName !== item.title && (
                          <div className="text-xs font-semibold">{item.title}</div>
                        )}
                        {item.obraName && (
                          <div className="text-xs font-semibold">{item.obraName}</div>
                        )}
                        {item.dueDateObj && isSoon && !isLate && (
                          <div className="mt-2">
                            <div className="flex justify-between text-[11px] mb-1">
                              <span>Tiempo restante</span>
                              <span>{getTimeRemaining(item.dueDateObj)}</span>
                            </div>
                            <div className="w-full bg-black/10 rounded-full h-1.5">
                              <div
                                className="bg-linear-to-r from-blue-500 to-blue-400 h-1.5 rounded-full"
                                style={{ width: `${getTimeProgress(item.dueDateObj)}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {!item.read_at && (
                        <form action={markRead}>
                          <input type="hidden" name="id" value={item.id} />
                          <Button variant="ghost" size="sm">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Leída
                          </Button>
                        </form>
                      )}
                      {item.action_url ? (
                        <a
                          href={item.action_url + "?tab=pendientes"}
                          className="inline-flex items-center gap-1 text-xs font-medium bg-white/20 rounded-md px-2 py-1 hover:bg-white/30"
                          style={{ color: v.fg }}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                          Abrir
                        </a>
                      ) : null}
                      <form action={item.pendienteId ? deletePendiente : deleteNotification}>
                        {item.pendienteId ? (
                          <input type="hidden" name="pendiente_id" value={item.pendienteId} />
                        ) : (
                          <input type="hidden" name="id" value={item.id} />
                        )}
                        <Button variant="ghost" size="sm" type="submit" className="text-destructive hover:text-destructive hover:bg-destructive/10" title="Eliminar">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </Button>
                      </form>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    )
  };

  const renderSection = (
    title: string,
    groups: Record<string, PendienteItem[]>,
    emptyMessage: string
  ) => {
    const sortedDates = Object.keys(groups).sort((a, b) => {
      if (a === "Sin fecha") return 1;
      if (b === "Sin fecha") return -1;
      return a.localeCompare(b);
    });

    if (sortedDates.length === 0) return null;

    return (
      <div className="space-y-6 border border-dashed border-foreground/30 rounded-md p-4">
        <h2 className="text-2xl font-semibold text-foreground">{title}</h2>
        {sortedDates.map((dateStr) => {
          let section: "past" | "today" | "next" | "noDate" = "noDate";
          if (title === "Pasado") section = "past";
          else if (title === "Hoy") section = "today";
          else if (title === "Próximo") section = "next";
          else if (title === "Sin fecha") section = "noDate";
          return renderDateGroup(dateStr, groups[dateStr], section);
        })}
      </div>
    );
  };

  if (parsed.length === 0) {
    return (
      <div className="p-6 text-center text-foreground/60">
        Sin pendientes.
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {renderSection("Pasado", pastGroups, "Sin pendientes pasados")}
      {renderSection("Hoy", todayGroups, "Sin pendientes para hoy")}
      {renderSection("Próximo", nextGroups, "Sin pendientes próximos")}
      {renderSection("Sin fecha", noDateGroups, "Sin pendientes sin fecha")}
    </div>
  );
}

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

function buildFlujoCalendarEvents(flujoActions: any[]): CalendarEventPayload[] {
  return flujoActions.map((action) => {
    // Calculate the event date based on timing mode
    let eventDate = new Date();

    if (action.timing_mode === "scheduled" && action.scheduled_date) {
      eventDate = new Date(action.scheduled_date);
    } else if (action.timing_mode === "offset") {
      const offsetValue = action.offset_value || 0;
      const offsetUnit = action.offset_unit || "days";

      switch (offsetUnit) {
        case "minutes":
          eventDate = new Date(Date.now() + offsetValue * 60 * 1000);
          break;
        case "hours":
          eventDate = new Date(Date.now() + offsetValue * 60 * 60 * 1000);
          break;
        case "days":
          eventDate = new Date(Date.now() + offsetValue * 24 * 60 * 60 * 1000);
          break;
        case "weeks":
          eventDate = new Date(Date.now() + offsetValue * 7 * 24 * 60 * 60 * 1000);
          break;
        case "months":
          eventDate = new Date();
          eventDate.setMonth(eventDate.getMonth() + offsetValue);
          break;
      }
    }

    const startDate = new Date(eventDate);
    const endDate = addHours(startDate, 1);

    return {
      id: `flujo-${action.id}`,
      title: action.title,
      description: action.message || "Acción de flujo automática",
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      allDay: action.timing_mode === "offset",
      color: "sky" as const,
      location: undefined,
      pendingStatus: "upcoming" as const,
      completed: false,
    };
  });
}


