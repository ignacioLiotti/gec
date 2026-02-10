"use client"

import Link from "next/link"
import { format } from "date-fns"
import { es } from "date-fns/locale"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { CalendarEvent } from "@/components/event-calendar"
import { FileText } from "lucide-react"

type EventViewDialogProps = {
  event: CalendarEvent | null
  isOpen: boolean
  onClose: () => void
  onEdit?: () => void
  allowEdit?: boolean
}

export function EventViewDialog({
  event,
  isOpen,
  onClose,
  onEdit,
  allowEdit = true,
}: EventViewDialogProps) {
  if (!event) {
    return null
  }

  const startLabel = format(event.start, "PPP", { locale: es })
  const endLabel = format(event.end, "PPP", { locale: es })
  const timeLabel = event.allDay
    ? "Todo el día"
    : `${format(event.start, "p", { locale: es })} - ${format(event.end, "p", { locale: es })}`
  const dateLabel = startLabel === endLabel ? startLabel : `${startLabel} → ${endLabel}`
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
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{event.title || "Evento"}</DialogTitle>
          <DialogDescription>
            {dateLabel} · {timeLabel}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 text-sm px-6 py-4">
          {event.description && (
            <div className="grid gap-1">
              <span className="text-muted-foreground">Descripción</span>
              <p className="text-foreground whitespace-pre-wrap">{event.description}</p>
            </div>
          )}

          {(event.location || event.obraName || event.obraId) && (
            <div className="grid gap-1">
              <span className="text-muted-foreground">Obra</span>
              {event.obraId ? (
                <Link
                  href={`/excel/${event.obraId}`}
                  className="text-primary hover:underline text-base font-medium flex items-center gap-2"
                >
                  <FileText className="size-4" />
                  {event.obraName ?? event.obraId}
                </Link>
              ) : (
                <span className="text-foreground">
                  {event.location ?? event.obraName ?? "-"}
                </span>
              )}
            </div>
          )}

          <div className="flex gap-2 justify-between">
            {(event.createdByName || event.createdById) && (
              <div className="grid gap-1">
                <span className="text-muted-foreground">Creado por</span>
                <span className="text-foreground">
                  {event.createdByName ?? event.createdById}
                </span>
              </div>
            )}

            {createdAtLabel && (
              <div className="grid gap-1">
                <span className="text-muted-foreground">Creado</span>
                <span className="text-foreground">{createdAtLabel}</span>
              </div>
            )}
          </div>

          <div className="grid gap-1">
            <span className="text-muted-foreground">Audiencia</span>
            <span className="text-foreground">{audienceLabel}</span>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
          {allowEdit && (
            <Button onClick={onEdit}>
              Editar evento
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
