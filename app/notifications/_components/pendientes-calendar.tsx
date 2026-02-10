"use client"

import { useEffect, useMemo, useState } from "react"

import {
  EventCalendar,
  type EventColor,
  type CalendarEvent,
  type PendienteStatus,
} from "@/components/event-calendar"

export type CalendarEventPayload = {
  id: string
  title: string
  description?: string
  start: string
  end: string
  allDay?: boolean
  color?: EventColor
  location?: string
  completed?: boolean
  pendingStatus?: PendienteStatus
  obraId?: string
  obraName?: string
  createdAt?: string
  createdById?: string
  createdByName?: string
  audienceType?: "me" | "user" | "role" | "tenant"
  targetUserId?: string
  targetUserName?: string
  targetRoleId?: string
  targetRoleName?: string
}

export function PendientesCalendar({
  events,
  onFlujoEventUpdate,
  onFlujoEventDelete,
  availableRoles,
}: {
  events: CalendarEventPayload[]
  onFlujoEventUpdate?: (eventId: string, title: string, description: string | undefined, start: string, end: string, allDay: boolean) => Promise<void>
  onFlujoEventDelete?: (eventId: string) => Promise<void>
  availableRoles?: { id: string; name: string | null }[]
}) {
  const parsedEvents = useMemo<CalendarEvent[]>(() => {
    return events.map((event) => ({
      ...event,
      start: new Date(event.start),
      end: new Date(event.end),
    }))
  }, [events])

  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>(parsedEvents)

  useEffect(() => {
    setCalendarEvents(parsedEvents)
  }, [parsedEvents])

  const scheduleReminderForEvent = async (event: CalendarEvent) => {
    try {
      await fetch("/api/calendar-events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: event.title,
          description: event.description ?? null,
          start: event.start.toISOString(),
          end: event.end.toISOString(),
          allDay: event.allDay ?? false,
          audienceType: event.audienceType ?? "me",
          audienceRoleId: event.audienceRoleId ?? null,
        }),
      })
    } catch (error) {
      console.error("Error al programar recordatorio para el evento:", error)
    }
  }

  const handleEventAdd = (event: CalendarEvent) => {
    const pendingStatus = event.pendingStatus ?? "upcoming"

    // Only schedule reminders for ad-hoc calendar events (not flujo-backed ones)
    if (!event.id.startsWith("flujo-")) {
      void scheduleReminderForEvent(event)
    }

    setCalendarEvents((prev) => {
      if (prev.some((ev) => ev.id === event.id)) return prev
      return [
        ...prev,
        {
          ...event,
          pendingStatus,
          completed: event.completed ?? false,
        },
      ]
    })
  }

  const handleEventUpdate = async (event: CalendarEvent) => {
    // Check if this is a flujo calendar event
    if (event.id.startsWith("flujo-") && onFlujoEventUpdate) {
      try {
        await onFlujoEventUpdate(
          event.id,
          event.title,
          event.description,
          event.start.toISOString(),
          event.end.toISOString(),
          event.allDay || false
        )
      } catch (error) {
        console.error("Error al actualizar evento de flujo:", error)
        return
      }
    }

    setCalendarEvents((prev) =>
      prev.map((existing) =>
        existing.id === event.id
          ? {
            ...existing,
            ...event,
            pendingStatus: event.pendingStatus ?? existing.pendingStatus,
            completed:
              typeof event.completed === "boolean"
                ? event.completed
                : existing.completed,
          }
          : existing
      )
    )
  }

  const handleEventDelete = async (eventId: string) => {
    // Check if this is a flujo calendar event
    if (eventId.startsWith("flujo-") && onFlujoEventDelete) {
      try {
        await onFlujoEventDelete(eventId)
      } catch (error) {
        console.error("Error al eliminar evento de flujo:", error)
        return
      }
    }

    setCalendarEvents((prev) => prev.filter((event) => event.id !== eventId))
  }

  // if (!events.length) {
  //   return (
  //     <div className="rounded-lg border bg-card p-6 text-center text-muted-foreground">
  //       No hay pendientes con fecha programada.
  //     </div>
  //   )
  // }

  return (
    <div className="rounded-lg border bg-card">
      <EventCalendar
        events={calendarEvents}
        onEventAdd={handleEventAdd}
        onEventUpdate={handleEventUpdate}
        onEventDelete={handleEventDelete}
        className="border-none"
        availableRoles={availableRoles}
      />
    </div>
  )
}
