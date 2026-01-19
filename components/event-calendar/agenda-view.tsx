"use client"

import { useMemo } from "react"
import { RiCalendarEventLine } from "@remixicon/react"
import { addDays, format, isToday } from "date-fns"
import { es } from "date-fns/locale"

import {
  AgendaDaysToShow,
  CalendarEvent,
  EventItem,
  getAgendaEventsForDay,
} from "@/components/event-calendar"

interface AgendaViewProps {
  currentDate: Date
  events: CalendarEvent[]
  onEventSelect: (event: CalendarEvent) => void
  interactive?: boolean
}

export function AgendaView({
  currentDate,
  events,
  onEventSelect,
  interactive = true,
}: AgendaViewProps) {
  const capitalizeFirst = (str: string) => {
    // Capitalize first letter and any letter after space, comma, or dash
    return str.replace(/(^|[ ,-])([a-záéíóúñü])/g, (match, prefix, letter) => {
      return prefix + letter.toUpperCase()
    })
  }
  // Show events for the next days based on constant
  const days = useMemo(() => {
    console.log("Agenda view updating with date:", currentDate.toISOString())
    return Array.from({ length: AgendaDaysToShow }, (_, i) =>
      addDays(new Date(currentDate), i)
    )
  }, [currentDate])

  const handleEventClick = (event: CalendarEvent, e: React.MouseEvent) => {
    if (!interactive) return
    e.stopPropagation()
    console.log("Agenda view event clicked:", event)
    onEventSelect(event)
  }

  // Check if there are any days with events
  const hasEvents = days.some(
    (day) => getAgendaEventsForDay(events, day).length > 0
  )
  const hasPastIncomplete = useMemo(() => {
    return events.some(
      (event) => !event.completed && new Date(event.start) < currentDate
    )
  }, [events, currentDate])

  return (
    <div className="border-border/70 border-t px-4">
      {hasPastIncomplete && (
        <div className="text-destructive mb-4 mt-6 flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-1 text-xs font-medium">
          <span className="h-2 w-2 rounded-full bg-destructive" />
          Hay pendientes anteriores sin completar
        </div>
      )}
      {!hasEvents ? (
        <div className="flex min-h-[70svh] flex-col items-center justify-center py-16 text-center">
          <RiCalendarEventLine
            size={32}
            className="text-muted-foreground/50 mb-2"
          />
          <h3 className="text-lg font-medium">No se encontraron eventos</h3>
          <p className="text-muted-foreground">
            No hay eventos programados para este período.
          </p>
        </div>
      ) : (
        days.map((day) => {
          const dayEvents = getAgendaEventsForDay(events, day)

          if (dayEvents.length === 0) return null

          return (
            <div
              key={day.toString()}
              className="border-border/70 relative my-12 border-t"
            >
              <span
                className="bg-background absolute -top-3 left-0 flex h-6 items-center pe-4 text-[10px] uppercase data-today:font-medium sm:pe-4 sm:text-xs"
                data-today={isToday(day) || undefined}
              >
                {capitalizeFirst(format(day, "d MMM, EEEE", { locale: es }))}
              </span>
              <div className="mt-6 space-y-2">
                {dayEvents.map((event) => (
                  <EventItem
                    key={event.id}
                    event={event}
                    view="agenda"
                    onClick={(e) => handleEventClick(event, e)}
                  />
                ))}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
