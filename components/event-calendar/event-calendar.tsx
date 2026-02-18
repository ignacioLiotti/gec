"use client"

import { useEffect, useMemo, useState } from "react"
import { RiCalendarCheckLine } from "@remixicon/react"
import {
  addDays,
  addHours,
  addMonths,
  addWeeks,
  endOfWeek,
  format,
  isSameMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from "date-fns"
import { es } from "date-fns/locale"
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
} from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AgendaDaysToShow,
  AgendaView,
  CalendarDndProvider,
  CalendarEvent,
  CalendarView,
  DayView,
  EventDialog,
  EventViewDialog,
  EventGap,
  EventHeight,
  MonthView,
  WeekCellsHeight,
  WeekView,
} from "@/components/event-calendar"

export interface EventCalendarProps {
  events?: CalendarEvent[]
  onEventAdd?: (event: CalendarEvent) => void
  onEventUpdate?: (event: CalendarEvent) => void
  onEventDelete?: (eventId: string) => void
  className?: string
  initialView?: CalendarView
  readOnly?: boolean
  /**
   * Optional list of role options that can be used by higher-level
   * consumers (e.g. notifications calendar) to target events to roles.
   * Typically comes from the `roles` table (id + name).
   */
  availableRoles?: { id: string; name: string | null }[]
}

export function EventCalendar({
  events = [],
  onEventAdd,
  onEventUpdate,
  onEventDelete,
  className,
  initialView = "month",
  readOnly = false,
  availableRoles,
}: EventCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<CalendarView>(initialView)
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false)
  const [isEventViewOpen, setIsEventViewOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const interactive = !readOnly

  // Add keyboard shortcuts for view switching
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if user is typing in an input, textarea or contentEditable element
      // or if the event dialog is open
      if (
        isEventDialogOpen ||
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      ) {
        return
      }

      switch (e.key.toLowerCase()) {
        case "m":
          setView("month")
          break
        case "w":
          setView("week")
          break
        case "d":
          setView("day")
          break
        case "a":
          setView("agenda")
          break
      }
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [isEventDialogOpen])

  const handlePrevious = () => {
    if (view === "month") {
      setCurrentDate(subMonths(currentDate, 1))
    } else if (view === "week") {
      setCurrentDate(subWeeks(currentDate, 1))
    } else if (view === "day") {
      setCurrentDate(addDays(currentDate, -1))
    } else if (view === "agenda") {
      // For agenda view, go back 30 days (a full month)
      setCurrentDate(addDays(currentDate, -AgendaDaysToShow))
    }
  }

  const handleNext = () => {
    if (view === "month") {
      setCurrentDate(addMonths(currentDate, 1))
    } else if (view === "week") {
      setCurrentDate(addWeeks(currentDate, 1))
    } else if (view === "day") {
      setCurrentDate(addDays(currentDate, 1))
    } else if (view === "agenda") {
      // For agenda view, go forward 30 days (a full month)
      setCurrentDate(addDays(currentDate, AgendaDaysToShow))
    }
  }

  const handleToday = () => {
    setCurrentDate(new Date())
  }

  const handleEventSelect = (event: CalendarEvent) => {
    if (!interactive) return
    setSelectedEvent(event)
    setIsEventViewOpen(true)
  }

  const handleEventCreate = (startTime: Date) => {
    if (!interactive) return

    // Snap to 15-minute intervals
    const minutes = startTime.getMinutes()
    const remainder = minutes % 15
    if (remainder !== 0) {
      if (remainder < 7.5) {
        // Round down to nearest 15 min
        startTime.setMinutes(minutes - remainder)
      } else {
        // Round up to nearest 15 min
        startTime.setMinutes(minutes + (15 - remainder))
      }
      startTime.setSeconds(0)
      startTime.setMilliseconds(0)
    }

    const newEvent: CalendarEvent = {
      id: "",
      title: "",
      start: startTime,
      end: addHours(startTime, 1),
      allDay: false,
    }
    setSelectedEvent(newEvent)
    setIsEventViewOpen(false)
    setIsEventDialogOpen(true)
  }

  const handleEventSave = (event: CalendarEvent) => {
    if (!interactive) return
    if (event.id) {
      onEventUpdate?.(event)
      // Show toast notification when an event is updated
      toast(`Evento "${event.title}" actualizado`, {
        description: capitalizeFirst(format(new Date(event.start), "MMM d, yyyy", { locale: es })),
        position: "bottom-left",
      })
    } else {
      onEventAdd?.({
        ...event,
        id: Math.random().toString(36).substring(2, 11),
      })
      // Show toast notification when an event is added
      toast(`Evento "${event.title}" añadido`, {
        description: capitalizeFirst(format(new Date(event.start), "MMM d, yyyy", { locale: es })),
        position: "bottom-left",
      })
    }
    setIsEventDialogOpen(false)
    setSelectedEvent(null)
  }

  const handleEventDelete = (eventId: string) => {
    if (!interactive) return
    const deletedEvent = events.find((e) => e.id === eventId)
    onEventDelete?.(eventId)
    setIsEventDialogOpen(false)
    setIsEventViewOpen(false)
    setSelectedEvent(null)

    // Show toast notification when an event is deleted
    if (deletedEvent) {
      toast(`Evento "${deletedEvent.title}" eliminado`, {
        description: capitalizeFirst(format(new Date(deletedEvent.start), "MMM d, yyyy", { locale: es })),
        position: "bottom-left",
      })
    }
  }

  const handleEventUpdate = (updatedEvent: CalendarEvent) => {
    if (!interactive) return
    onEventUpdate?.(updatedEvent)

    // Show toast notification when an event is updated via drag and drop
    toast(`Evento "${updatedEvent.title}" movido`, {
      description: capitalizeFirst(format(new Date(updatedEvent.start), "MMM d, yyyy", { locale: es })),
      position: "bottom-left",
    })
  }

  const capitalizeFirst = (str: string) => {
    // Capitalize first letter and any letter after space, comma, or dash
    return str.replace(/(^|[ ,-])([a-záéíóúñü])/g, (match, prefix, letter) => {
      return prefix + letter.toUpperCase()
    })
  }

  const viewTitle = useMemo(() => {
    if (view === "month") {
      return capitalizeFirst(format(currentDate, "MMMM yyyy", { locale: es }))
    } else if (view === "week") {
      const start = startOfWeek(currentDate, { weekStartsOn: 0 })
      const end = endOfWeek(currentDate, { weekStartsOn: 0 })
      if (isSameMonth(start, end)) {
        return capitalizeFirst(format(start, "MMMM yyyy", { locale: es }))
      } else {
        return `${capitalizeFirst(format(start, "MMM", { locale: es }))} - ${capitalizeFirst(format(end, "MMM yyyy", { locale: es }))}`
      }
    } else if (view === "day") {
      return (
        <>
          <span className="min-[480px]:hidden" aria-hidden="true">
            {capitalizeFirst(format(currentDate, "MMM d, yyyy", { locale: es }))}
          </span>
          <span className="max-[479px]:hidden min-md:hidden" aria-hidden="true">
            {capitalizeFirst(format(currentDate, "MMMM d, yyyy", { locale: es }))}
          </span>
          <span className="max-md:hidden">
            {capitalizeFirst(format(currentDate, "EEE MMMM d, yyyy", { locale: es }))}
          </span>
        </>
      )
    } else if (view === "agenda") {
      // Show the month range for agenda view
      const start = currentDate
      const end = addDays(currentDate, AgendaDaysToShow - 1)

      if (isSameMonth(start, end)) {
        return capitalizeFirst(format(start, "MMMM yyyy", { locale: es }))
      } else {
        return `${capitalizeFirst(format(start, "MMM", { locale: es }))} - ${capitalizeFirst(format(end, "MMM yyyy", { locale: es }))}`
      }
    } else {
      return capitalizeFirst(format(currentDate, "MMMM yyyy", { locale: es }))
    }
  }, [currentDate, view])

  return (
    <div
      className="flex flex-col rounded-lg border has-data-[slot=month-view]:flex-1 "
      style={
        {
          "--event-height": `${EventHeight}px`,
          "--event-gap": `${EventGap}px`,
          "--week-cells-height": `${WeekCellsHeight}px`,
        } as React.CSSProperties
      }
    >
      <CalendarDndProvider onEventUpdate={handleEventUpdate}>
        <div
          className={cn(
            "flex items-center justify-between p-2 sm:p-4",
            className
          )}
        >
          <div className="flex items-center gap-1 sm:gap-4">
            <Button
              variant="outline"
              className="max-[479px]:aspect-square max-[479px]:p-0!"
              onClick={handleToday}
            >
              <RiCalendarCheckLine
                className="min-[480px]:hidden"
                size={16}
                aria-hidden="true"
              />
              <span className="max-[479px]:sr-only">Hoy</span>
            </Button>
            <div className="flex items-center sm:gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={handlePrevious}
                aria-label="Anterior"
              >
                <ChevronLeftIcon size={16} aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleNext}
                aria-label="Siguiente"
              >
                <ChevronRightIcon size={16} aria-hidden="true" />
              </Button>
            </div>
            <h2 className="text-sm font-semibold sm:text-lg md:text-xl">
              {viewTitle}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-1.5 max-[479px]:h-8">
                  <span>
                    <span className="min-[480px]:hidden" aria-hidden="true">
                      {view === "month" ? "M" : view === "week" ? "S" : view === "day" ? "D" : "A"}
                    </span>
                    <span className="max-[479px]:sr-only">
                      {view === "month" ? "Mes" : view === "week" ? "Semana" : view === "day" ? "Día" : "Agenda"}
                    </span>
                  </span>
                  <ChevronDownIcon
                    className="-me-1 opacity-60"
                    size={16}
                    aria-hidden="true"
                  />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-32">
                <DropdownMenuItem onClick={() => setView("month")}>
                  Mes <DropdownMenuShortcut>M</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setView("week")}>
                  Semana <DropdownMenuShortcut>W</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setView("day")}>
                  Día <DropdownMenuShortcut>D</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setView("agenda")}>
                  Agenda <DropdownMenuShortcut>A</DropdownMenuShortcut>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {interactive && (
              <Button
                className="max-[479px]:aspect-square max-[479px]:p-0!"
                onClick={() => {
                  setSelectedEvent(null) // Ensure we're creating a new event
                  setIsEventDialogOpen(true)
                }}
              >
                <PlusIcon
                  className="opacity-60 sm:-ms-1"
                  size={16}
                  aria-hidden="true"
                />
                <span className="max-sm:sr-only">Nuevo evento</span>
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-1 flex-col">
          {view === "month" && (
            <MonthView
              currentDate={currentDate}
              events={events}
              onEventSelect={handleEventSelect}
              onEventCreate={handleEventCreate}
              interactive={interactive}
            />
          )}
          {view === "week" && (
            <WeekView
              currentDate={currentDate}
              events={events}
              onEventSelect={handleEventSelect}
              onEventCreate={handleEventCreate}
              interactive={interactive}
            />
          )}
          {view === "day" && (
            <DayView
              currentDate={currentDate}
              events={events}
              onEventSelect={handleEventSelect}
              onEventCreate={handleEventCreate}
              interactive={interactive}
            />
          )}
          {view === "agenda" && (
            <AgendaView
              currentDate={currentDate}
              events={events}
              onEventSelect={handleEventSelect}
              interactive={interactive}
            />
          )}
        </div>

        {interactive && (
          <EventViewDialog
            event={selectedEvent}
            isOpen={isEventViewOpen}
            onClose={() => {
              setIsEventViewOpen(false)
            }}
            onToggleComplete={(completed) => {
              if (!selectedEvent) return
              handleEventUpdate({
                ...selectedEvent,
                completed,
              })
              setSelectedEvent((prev) =>
                prev ? { ...prev, completed } : prev
              )
            }}
            onEdit={() => {
              setIsEventViewOpen(false)
              setIsEventDialogOpen(true)
            }}
            allowEdit={interactive}
          />
        )}

        {interactive && (
          <EventDialog
            event={selectedEvent}
            isOpen={isEventDialogOpen}
            onClose={() => {
              setIsEventDialogOpen(false)
              setSelectedEvent(null)
            }}
            onSave={handleEventSave}
            onDelete={handleEventDelete}
            availableRoles={availableRoles}
          />
        )}
      </CalendarDndProvider>
    </div>
  )
}
