"use client"

import Link from "next/link"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import {
  CalendarDays,
  Clock,
  FileText,
  MapPin,
  Users,
  UserCircle,
  CalendarPlus,
  CheckCircle2,
  Pencil,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { CalendarEvent, EventColor } from "@/components/event-calendar"

type EventViewDialogProps = {
  event: CalendarEvent | null
  isOpen: boolean
  onClose: () => void
  onEdit?: () => void
  onToggleComplete?: (completed: boolean) => void
  allowEdit?: boolean
}

const colorAccentMap: Record<EventColor, string> = {
  sky: "bg-sky-500",
  amber: "bg-amber-500",
  violet: "bg-violet-500",
  rose: "bg-rose-500",
  emerald: "bg-emerald-500",
  orange: "bg-orange-500",
}

const colorDotMap: Record<EventColor, string> = {
  sky: "bg-sky-400",
  amber: "bg-amber-400",
  violet: "bg-violet-400",
  rose: "bg-rose-400",
  emerald: "bg-emerald-400",
  orange: "bg-orange-400",
}

const colorBgMap: Record<EventColor, string> = {
  sky: "bg-sky-50 dark:bg-sky-950/30",
  amber: "bg-amber-50 dark:bg-amber-950/30",
  violet: "bg-violet-50 dark:bg-violet-950/30",
  rose: "bg-rose-50 dark:bg-rose-950/30",
  emerald: "bg-emerald-50 dark:bg-emerald-950/30",
  orange: "bg-orange-50 dark:bg-orange-950/30",
}

export function EventViewDialog({
  event,
  isOpen,
  onClose,
  onEdit,
  onToggleComplete,
  allowEdit = true,
}: EventViewDialogProps) {
  if (!event) {
    return null
  }

  const eventColor = (event.color as EventColor) || "sky"
  const startLabel = format(event.start, "PPP", { locale: es })
  const endLabel = format(event.end, "PPP", { locale: es })
  const timeLabel = event.allDay
    ? "Todo el día"
    : `${format(event.start, "p", { locale: es })} - ${format(event.end, "p", { locale: es })}`
  const dateLabel = startLabel === endLabel ? startLabel : `${startLabel} - ${endLabel}`
  const createdAtLabel = event.createdAt
    ? format(new Date(event.createdAt), "PPP p", { locale: es })
    : null

  const audienceLabel = (() => {
    if (event.audienceType === "tenant") return "Toda la organización"
    if (event.audienceType === "role") {
      return event.targetRoleName
        ? `Rol: ${event.targetRoleName}`
        : event.targetRoleId
          ? `Rol: ${event.targetRoleId}`
          : "Rol"
    }
    if (event.audienceType === "user") {
      return event.targetUserName
        ? `Usuario: ${event.targetUserName}`
        : event.targetUserId
          ? `Usuario: ${event.targetUserId}`
          : "Usuario"
    }
    return "Solo tú"
  })()

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[480px]">
        {/* Color accent strip */}
        <div className={`h-1.5 w-full ${colorAccentMap[eventColor]}`} />

        <DialogHeader className="sr-only">
          <DialogTitle>{event.title || "Evento"}</DialogTitle>
          <DialogDescription>
            {dateLabel} - {timeLabel}
          </DialogDescription>
        </DialogHeader>

        {/* Header section */}
        <div className="flex items-start gap-3 px-6 pt-5 pb-4">
          <div
            className={`mt-1.5 h-3 w-3 shrink-0 rounded-full ${colorDotMap[eventColor]}`}
          />
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold leading-snug text-foreground text-balance">
              {event.title || "Evento"}
            </h3>
            {event.completed && (
              <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                <CheckCircle2 className="size-3" />
                Completado
              </span>
            )}
          </div>
          {allowEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground -mr-2 -mt-1 size-8 shrink-0"
              onClick={onEdit}
              aria-label="Editar evento"
            >
              <Pencil className="size-4" />
            </Button>
          )}
        </div>

        {/* Details section */}
        <div className="flex flex-col gap-0.5 px-6 pb-4">
          {/* Date & Time */}
          <div className={`flex flex-col gap-2.5 rounded-lg p-3 ${colorBgMap[eventColor]}`}>
            <div className="flex items-center gap-3">
              <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">{dateLabel}</span>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="size-4 shrink-0 text-muted-foreground" />
              <span className="text-sm text-foreground">{timeLabel}</span>
            </div>
          </div>

          {/* Description */}
          {event.description && (
            <div className="flex items-start gap-3 rounded-lg p-3">
              <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                {event.description}
              </p>
            </div>
          )}

          {/* Obra / Location */}
          {(event.location || event.obraName || event.obraId) && (
            <div className="flex items-center gap-3 rounded-lg p-3">
              <MapPin className="size-4 shrink-0 text-muted-foreground" />
              {event.obraId ? (
                <Link
                  href={`/excel/${event.obraId}`}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  {event.obraName ?? event.obraId}
                </Link>
              ) : (
                <span className="text-sm text-foreground">
                  {event.location ?? event.obraName ?? "-"}
                </span>
              )}
            </div>
          )}

          {/* Audience */}
          <div className="flex items-center gap-3 rounded-lg p-3">
            <Users className="size-4 shrink-0 text-muted-foreground" />
            <span className="text-sm text-foreground">{audienceLabel}</span>
          </div>

          {/* Created by & Created at */}
          {(event.createdByName || event.createdById || createdAtLabel) && (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg p-3">
              {(event.createdByName || event.createdById) && (
                <div className="flex items-center gap-3">
                  <UserCircle className="size-4 shrink-0 text-muted-foreground" />
                  <span className="text-sm text-foreground">
                    {event.createdByName ?? event.createdById}
                  </span>
                </div>
              )}
              {createdAtLabel && (
                <div className="flex items-center gap-3">
                  <CalendarPlus className="size-4 shrink-0 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{createdAtLabel}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Complete toggle section */}
        <div className="mx-6 mb-6 flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-4 py-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-foreground">
              Marcar como completado
            </span>
            <span className="text-xs text-muted-foreground">
              Los eventos completados no aparecen como atrasados.
            </span>
          </div>
          <Checkbox
            checked={Boolean(event.completed)}
            onCheckedChange={(checked) => {
              onToggleComplete?.(Boolean(checked))
            }}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t bg-muted/20 px-6 py-3">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cerrar
          </Button>
          {allowEdit && (
            <Button size="sm" onClick={onEdit}>
              Editar evento
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
