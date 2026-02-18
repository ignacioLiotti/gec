"use client"

import { useEffect, useMemo, useState } from "react"
import { RiCalendarLine, RiDeleteBinLine } from "@remixicon/react"
import { format, isBefore } from "date-fns"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type {
  CalendarEvent,
  EventColor,
} from "@/components/event-calendar"
import {
  DefaultEndHour,
  DefaultStartHour,
  EndHour,
  StartHour,
} from "@/components/event-calendar/constants"

interface EventDialogProps {
  event: CalendarEvent | null
  isOpen: boolean
  onClose: () => void
  onSave: (event: CalendarEvent) => void
  onDelete: (eventId: string) => void
  availableRoles?: { id: string; name: string | null }[]
}

const colorAccentMap: Record<EventColor, string> = {
  sky: "bg-sky-500",
  amber: "bg-amber-500",
  violet: "bg-violet-500",
  rose: "bg-rose-500",
  emerald: "bg-emerald-500",
  orange: "bg-orange-500",
}

export function EventDialog({
  event,
  isOpen,
  onClose,
  onSave,
  onDelete,
  availableRoles,
}: EventDialogProps) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [startDate, setStartDate] = useState<Date>(new Date())
  const [endDate, setEndDate] = useState<Date>(new Date())
  const [startTime, setStartTime] = useState(`${DefaultStartHour}:00`)
  const [endTime, setEndTime] = useState(`${DefaultEndHour}:00`)
  const [allDay, setAllDay] = useState(false)
  const [location, setLocation] = useState("")
  const [color, setColor] = useState<EventColor>("sky")
  const [completed, setCompleted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [startDateOpen, setStartDateOpen] = useState(false)
  const [endDateOpen, setEndDateOpen] = useState(false)
  const [audienceType, setAudienceType] = useState<"me" | "role" | "user" | "tenant">("me")
  const [audienceRoleId, setAudienceRoleId] = useState<string | "">("")

  useEffect(() => {
    if (event) {
      setTitle(event.title || "")
      setDescription(event.description || "")

      const start = new Date(event.start)
      const end = new Date(event.end)

      setStartDate(start)
      setEndDate(end)
      setStartTime(formatTimeForInput(start))
      setEndTime(formatTimeForInput(end))
      setAllDay(event.allDay || false)
      setLocation(event.location || "")
      setColor((event.color as EventColor) || "sky")
      setCompleted(!!event.completed)
      setAudienceType(event.audienceType ?? "me")
      setAudienceRoleId(event.audienceRoleId ?? "")
      setError(null)
    } else {
      resetForm()
    }
  }, [event])

  const resetForm = () => {
    setTitle("")
    setDescription("")
    setStartDate(new Date())
    setEndDate(new Date())
    setStartTime(`${DefaultStartHour}:00`)
    setEndTime(`${DefaultEndHour}:00`)
    setAllDay(false)
    setLocation("")
    setColor("sky")
    setCompleted(false)
    setAudienceType("me")
    setAudienceRoleId("")
    setError(null)
  }

  const formatTimeForInput = (date: Date) => {
    const hours = date.getHours().toString().padStart(2, "0")
    const minutes = Math.floor(date.getMinutes() / 15) * 15
    return `${hours}:${minutes.toString().padStart(2, "0")}`
  }

  const timeOptions = useMemo(() => {
    const options = []
    for (let hour = StartHour; hour <= EndHour; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        const formattedHour = hour.toString().padStart(2, "0")
        const formattedMinute = minute.toString().padStart(2, "0")
        const value = `${formattedHour}:${formattedMinute}`
        const date = new Date(2000, 0, 1, hour, minute)
        const label = format(date, "h:mm a")
        options.push({ value, label })
      }
    }
    return options
  }, [])

  const handleSave = () => {
    const start = new Date(startDate)
    const end = new Date(endDate)

    if (!allDay) {
      const [startHours = 0, startMinutes = 0] = startTime
        .split(":")
        .map(Number)
      const [endHours = 0, endMinutes = 0] = endTime.split(":").map(Number)

      if (
        startHours < StartHour ||
        startHours > EndHour ||
        endHours < StartHour ||
        endHours > EndHour
      ) {
        setError(
          `La hora seleccionada debe estar entre ${StartHour}:00 y ${EndHour}:00`
        )
        return
      }

      start.setHours(startHours, startMinutes, 0)
      end.setHours(endHours, endMinutes, 0)
    } else {
      start.setHours(0, 0, 0, 0)
      end.setHours(23, 59, 59, 999)
    }

    if (isBefore(end, start)) {
      setError("La fecha de fin no puede ser anterior a la fecha de inicio")
      return
    }

    const eventTitle = title.trim() ? title : "(no title)"

    onSave({
      id: event?.id || "",
      title: eventTitle,
      description,
      start,
      end,
      allDay,
      location,
      color,
      completed,
      audienceType,
      audienceRoleId: audienceType === "role" ? audienceRoleId || undefined : undefined,
      obraId: event?.obraId,
      obraName: event?.obraName,
    })
  }

  const handleDelete = () => {
    if (event?.id) {
      onDelete(event.id)
    }
  }

  const colorOptions: Array<{
    value: EventColor
    label: string
    bgClass: string
    borderClass: string
  }> = [
    {
      value: "sky",
      label: "Sky",
      bgClass: "bg-sky-400 data-[state=checked]:bg-sky-400",
      borderClass: "border-sky-400 data-[state=checked]:border-sky-400",
    },
    {
      value: "amber",
      label: "Amber",
      bgClass: "bg-amber-400 data-[state=checked]:bg-amber-400",
      borderClass: "border-amber-400 data-[state=checked]:border-amber-400",
    },
    {
      value: "violet",
      label: "Violet",
      bgClass: "bg-violet-400 data-[state=checked]:bg-violet-400",
      borderClass: "border-violet-400 data-[state=checked]:border-violet-400",
    },
    {
      value: "rose",
      label: "Rose",
      bgClass: "bg-rose-400 data-[state=checked]:bg-rose-400",
      borderClass: "border-rose-400 data-[state=checked]:border-rose-400",
    },
    {
      value: "emerald",
      label: "Emerald",
      bgClass: "bg-emerald-400 data-[state=checked]:bg-emerald-400",
      borderClass: "border-emerald-400 data-[state=checked]:border-emerald-400",
    },
    {
      value: "orange",
      label: "Orange",
      bgClass: "bg-orange-400 data-[state=checked]:bg-orange-400",
      borderClass: "border-orange-400 data-[state=checked]:border-orange-400",
    },
  ]

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[500px] md:max-w-[600px] max-h-[85vh]">
        {/* Color accent strip */}
        <div className={`h-1.5 w-full ${colorAccentMap[color]}`} />

        <DialogHeader className="px-6 pt-5 pb-2">
          <DialogTitle className="text-lg">
            {event?.id ? "Editar evento" : "Nuevo evento"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {event?.id
              ? "Edita los detalles de este evento"
              : "Añade un nuevo evento a tu calendario"}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="mx-6 rounded-md bg-destructive/15 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-6 overflow-y-auto px-6 pt-2 pb-6">
          {/* Section: Detalles */}
          <fieldset className="flex flex-col gap-4">
            <legend className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Detalles
            </legend>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="title">Título</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Nombre del evento"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Detalles opcionales..."
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="location">Ubicación</Label>
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Lugar o dirección"
              />
            </div>
          </fieldset>

          <div className="h-px bg-border" />

          {/* Section: Fecha y hora */}
          <fieldset className="flex flex-col gap-4">
            <legend className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Fecha y hora
            </legend>

            <div className="flex gap-3">
              <div className="min-w-0 flex-1 space-y-1.5">
                <Label htmlFor="start-date">Inicio</Label>
                <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      id="start-date"
                      variant="outline"
                      className={cn(
                        "group w-full justify-between bg-background px-3 font-normal hover:bg-background",
                        !startDate && "text-muted-foreground"
                      )}
                    >
                      <span className={cn("truncate", !startDate && "text-muted-foreground")}>
                        {startDate ? format(startDate, "PPP") : "Seleccionar"}
                      </span>
                      <RiCalendarLine size={16} className="shrink-0 text-muted-foreground/80" aria-hidden="true" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-2" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      defaultMonth={startDate}
                      onSelect={(date) => {
                        if (date) {
                          setStartDate(date)
                          if (isBefore(endDate, date)) {
                            setEndDate(date)
                          }
                          setError(null)
                          setStartDateOpen(false)
                        }
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {!allDay && (
                <div className="w-28 shrink-0 space-y-1.5">
                  <Label htmlFor="start-time">Hora</Label>
                  <Select value={startTime} onValueChange={setStartTime}>
                    <SelectTrigger id="start-time">
                      <SelectValue placeholder="Hora" />
                    </SelectTrigger>
                    <SelectContent>
                      {timeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <div className="min-w-0 flex-1 space-y-1.5">
                <Label htmlFor="end-date">Fin</Label>
                <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      id="end-date"
                      variant="outline"
                      className={cn(
                        "group w-full justify-between bg-background px-3 font-normal hover:bg-background",
                        !endDate && "text-muted-foreground"
                      )}
                    >
                      <span className={cn("truncate", !endDate && "text-muted-foreground")}>
                        {endDate ? format(endDate, "PPP") : "Seleccionar"}
                      </span>
                      <RiCalendarLine size={16} className="shrink-0 text-muted-foreground/80" aria-hidden="true" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-2" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      defaultMonth={endDate}
                      disabled={{ before: startDate }}
                      onSelect={(date) => {
                        if (date) {
                          setEndDate(date)
                          setError(null)
                          setEndDateOpen(false)
                        }
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {!allDay && (
                <div className="w-28 shrink-0 space-y-1.5">
                  <Label htmlFor="end-time">Hora</Label>
                  <Select value={endTime} onValueChange={setEndTime}>
                    <SelectTrigger id="end-time">
                      <SelectValue placeholder="Hora" />
                    </SelectTrigger>
                    <SelectContent>
                      {timeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="all-day"
                checked={allDay}
                onCheckedChange={(checked) => setAllDay(checked === true)}
              />
              <Label htmlFor="all-day" className="font-normal">Todo el día</Label>
            </div>
          </fieldset>

          <div className="h-px bg-border" />

          {/* Section: Destinatarios */}
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Destinatarios
            </legend>
            <RadioGroup
              className="flex flex-col gap-2"
              value={audienceType}
              onValueChange={(value: "me" | "role") => setAudienceType(value)}
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem id="audience-me" value="me" />
                <Label htmlFor="audience-me" className="font-normal">
                  Solo para mí
                </Label>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <RadioGroupItem id="audience-role" value="role" />
                  <Label htmlFor="audience-role" className="font-normal">
                    Para todos los usuarios con este rol
                  </Label>
                </div>
                {audienceType === "role" && (
                  <div className="pl-6">
                    <Label htmlFor="audience-role-select" className="sr-only">
                      Rol
                    </Label>
                    <Select
                      value={audienceRoleId}
                      onValueChange={(value: string) => setAudienceRoleId(value)}
                      disabled={!availableRoles?.length}
                    >
                      <SelectTrigger id="audience-role-select" className="w-full max-w-xs">
                        <SelectValue placeholder="Seleccionar rol" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableRoles?.map((role) => (
                          <SelectItem key={role.id} value={role.id}>
                            {role.name ?? role.id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </RadioGroup>
          </fieldset>

          <div className="h-px bg-border" />

          {/* Section: Apariencia y estado */}
          <fieldset className="flex flex-col gap-4">
            <legend className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Apariencia
            </legend>

            <div className="flex flex-col gap-2">
              <Label className="text-sm">Color</Label>
              <RadioGroup
                className="flex gap-2"
                defaultValue={colorOptions[0]?.value}
                value={color}
                onValueChange={(value: EventColor) => setColor(value)}
              >
                {colorOptions.map((colorOption) => (
                  <RadioGroupItem
                    key={colorOption.value}
                    id={`color-${colorOption.value}`}
                    value={colorOption.value}
                    aria-label={colorOption.label}
                    className={cn(
                      "size-8 shadow-none",
                      colorOption.bgClass,
                      colorOption.borderClass
                    )}
                  />
                ))}
              </RadioGroup>
            </div>

            <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3">
              <Checkbox
                id="completed"
                checked={completed}
                onCheckedChange={(checked) => setCompleted(checked === true)}
              />
              <div className="flex flex-col gap-0.5 leading-none">
                <Label htmlFor="completed" className="font-medium">
                  Marcar como completado
                </Label>
                <p className="text-xs text-muted-foreground">
                  Los eventos completados ya no aparecen como atrasados.
                </p>
              </div>
            </div>
          </fieldset>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 border-t bg-muted/20 px-6 py-3">
          <div>
            {event?.id && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                aria-label="Eliminar evento"
              >
                <RiDeleteBinLine size={16} aria-hidden="true" className="-ml-0.5" />
                Eliminar
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSave}>
              Guardar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
