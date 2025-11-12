"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type ScheduledEvent = {
  id: string;
  event_type: string;
  title: string;
  description: string | null;
  metadata: Record<string, any>;
  scheduled_at: string;
  delivered_at: string | null;
  status: string;
  notification_type: string | null;
  action_url: string | null;
  read_at: string | null;
  created_at: string;
};

export default function AppointmentsPage() {
  const [events, setEvents] = useState<ScheduledEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ALL" | "APPOINTMENT" | "MEETING">("ALL");
  const [user, setUser] = useState<any>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [eventType, setEventType] = useState<"APPOINTMENT" | "MEETING">("APPOINTMENT");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });
  }, []);

  useEffect(() => {
    if (!user) return;

    const fetchEvents = async () => {
      setLoading(true);
      try {
        const supabase = createSupabaseBrowserClient();

        let query = supabase
          .from("scheduled_events")
          .select("*")
          .eq("user_id", user.id)
          .in("event_type", ["APPOINTMENT", "MEETING"])
          .order("scheduled_at", { ascending: true });

        if (filter !== "ALL") {
          query = query.eq("event_type", filter);
        }

        const { data, error } = await query;

        if (error) {
          console.error("Error fetching events:", error);
        } else {
          setEvents(data ?? []);
        }
      } catch (err) {
        console.error("Error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [user, filter]);

  const handleCancelEvent = async (eventId: string) => {
    try {
      const response = await fetch("/api/events", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: eventId, status: "cancelled" }),
      });

      if (response.ok) {
        setEvents((prev) =>
          prev.map((e) => (e.id === eventId ? { ...e, status: "cancelled" } : e))
        );
        toast.success("Evento cancelado");
      }
    } catch (err) {
      console.error("Error cancelling event:", err);
      toast.error("Error al cancelar el evento");
    }
  };

  const handleCreateEvent = async () => {
    if (!title.trim()) {
      toast.error("El título es requerido");
      return;
    }

    if (!scheduledAt) {
      toast.error("La fecha y hora son requeridas");
      return;
    }

    setIsCreating(true);

    try {
      // First, emit the event through the rule engine
      const eventId = crypto.randomUUID();
      const eventData = {
        userId: user.id,
        ...(eventType === "APPOINTMENT" ? { appointmentId: eventId } : { meetingId: eventId }),
        title: title.trim(),
        ...(eventType === "APPOINTMENT"
          ? { appointmentAt: new Date(scheduledAt).toISOString() }
          : { meetingAt: new Date(scheduledAt).toISOString() }
        ),
        location: location.trim() || null,
        notes: notes.trim() || null,
        ...(eventType === "MEETING" ? {
          organizerId: user.id,
          participantIds: [user.id],
        } : {}),
      };

      const response = await fetch("/api/notifications/emit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: eventType === "APPOINTMENT" ? "appointment.created" : "meeting.scheduled",
          ctx: eventData,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create event");
      }

      toast.success(`${eventType === "APPOINTMENT" ? "Cita" : "Reunión"} creada exitosamente`);

      // Reset form
      setTitle("");
      setDescription("");
      setScheduledAt("");
      setLocation("");
      setNotes("");
      setCreateDialogOpen(false);

      // Refresh events
      const supabase = createSupabaseBrowserClient();
      let query = supabase
        .from("scheduled_events")
        .select("*")
        .eq("user_id", user.id)
        .in("event_type", ["APPOINTMENT", "MEETING"])
        .order("scheduled_at", { ascending: true });

      if (filter !== "ALL") {
        query = query.eq("event_type", filter);
      }

      const { data } = await query;
      if (data) {
        setEvents(data);
      }
    } catch (err) {
      console.error("Error creating event:", err);
      toast.error("Error al crear el evento");
    } finally {
      setIsCreating(false);
    }
  };

  const groupEventsByDate = (events: ScheduledEvent[]) => {
    const groups: Record<string, ScheduledEvent[]> = {};

    events.forEach((event) => {
      const date = new Date(event.scheduled_at);
      const dateKey = date.toLocaleDateString("es-AR", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(event);
    });

    return groups;
  };

  const groupedEvents = groupEventsByDate(events);

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-center text-muted-foreground">
          Por favor inicia sesión para ver tus citas y reuniones.
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="mb-2 text-3xl font-bold">Agenda</h1>
        <p className="text-muted-foreground">
          Gestiona tus citas, reuniones y eventos programados.
        </p>
      </div>

      {/* Filter buttons */}
      <div className="mb-6 flex gap-2">
        <button
          onClick={() => setFilter("ALL")}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            filter === "ALL"
              ? "bg-orange-primary text-white"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          Todos
        </button>
        <button
          onClick={() => setFilter("APPOINTMENT")}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            filter === "APPOINTMENT"
              ? "bg-orange-primary text-white"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          Citas
        </button>
        <button
          onClick={() => setFilter("MEETING")}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            filter === "MEETING"
              ? "bg-orange-primary text-white"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          Reuniones
        </button>
      </div>

      {/* Events list */}
      {loading ? (
        <div className="py-12 text-center text-muted-foreground">Cargando...</div>
      ) : events.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground">
            No tienes {filter === "ALL" ? "eventos" : filter === "APPOINTMENT" ? "citas" : "reuniones"} programados.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedEvents).map(([date, dateEvents]) => (
            <div key={date}>
              <h2 className="mb-3 text-lg font-semibold text-foreground/80">{date}</h2>
              <div className="space-y-3">
                {dateEvents.map((event) => {
                  const scheduledDate = new Date(event.scheduled_at);
                  const isPast = scheduledDate < new Date();
                  const isCancelled = event.status === "cancelled";

                  return (
                    <div
                      key={event.id}
                      className={`rounded-lg border p-4 transition-all ${
                        isCancelled
                          ? "border-muted bg-muted/20 opacity-60"
                          : isPast
                          ? "border-muted bg-card"
                          : "border-orange-primary/30 bg-card shadow-sm"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="mb-1 flex items-center gap-2">
                            <span
                              className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${
                                event.event_type === "APPOINTMENT"
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-purple-100 text-purple-700"
                              }`}
                            >
                              {event.event_type === "APPOINTMENT" ? "Cita" : "Reunión"}
                            </span>
                            {isCancelled && (
                              <span className="inline-flex items-center rounded-md bg-red-100 px-2 py-1 text-xs font-medium text-red-700">
                                Cancelado
                              </span>
                            )}
                          </div>
                          <h3 className="mb-1 text-lg font-semibold">{event.title}</h3>
                          {event.description && (
                            <p className="mb-2 text-sm text-muted-foreground">
                              {event.description}
                            </p>
                          )}
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                            <span>
                              🕒 {scheduledDate.toLocaleTimeString("es-AR", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                            {event.metadata?.location && (
                              <span>📍 {event.metadata.location}</span>
                            )}
                          </div>
                          {event.metadata?.notes && (
                            <p className="mt-2 text-sm italic text-muted-foreground">
                              {event.metadata.notes}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col gap-2">
                          {!isPast && !isCancelled && (
                            <button
                              onClick={() => handleCancelEvent(event.id)}
                              className="rounded-md bg-red-100 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-200"
                            >
                              Cancelar
                            </button>
                          )}
                          {event.action_url && (
                            <a
                              href={event.action_url}
                              className="rounded-md bg-orange-primary px-3 py-1.5 text-center text-xs font-medium text-white hover:bg-orange-primary/90"
                            >
                              Ver detalles
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create new event button */}
      <div className="mt-8 text-center">
        <button
          onClick={() => setCreateDialogOpen(true)}
          className="rounded-md bg-orange-primary px-6 py-3 font-medium text-white hover:bg-orange-primary/90"
        >
          + Nueva cita o reunión
        </button>
      </div>

      {/* Create Event Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Crear nueva cita o reunión</DialogTitle>
            <DialogDescription>
              Completa los detalles para programar un nuevo evento.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Event Type */}
            <div className="space-y-2">
              <Label>Tipo de evento</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEventType("APPOINTMENT")}
                  className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                    eventType === "APPOINTMENT"
                      ? "bg-blue-100 text-blue-700 border-2 border-blue-300"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  📅 Cita
                </button>
                <button
                  type="button"
                  onClick={() => setEventType("MEETING")}
                  className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                    eventType === "MEETING"
                      ? "bg-purple-100 text-purple-700 border-2 border-purple-300"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  👥 Reunión
                </button>
              </div>
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Título *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={eventType === "APPOINTMENT" ? "Ej: Consulta médica" : "Ej: Reunión de equipo"}
              />
            </div>

            {/* Date and Time */}
            <div className="space-y-2">
              <Label htmlFor="scheduled_at">Fecha y hora *</Label>
              <Input
                id="scheduled_at"
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            </div>

            {/* Location */}
            <div className="space-y-2">
              <Label htmlFor="location">Ubicación</Label>
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Ej: Oficina principal"
              />
            </div>

            {/* Description/Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notas</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Información adicional..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setCreateDialogOpen(false);
                setTitle("");
                setDescription("");
                setScheduledAt("");
                setLocation("");
                setNotes("");
              }}
              disabled={isCreating}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleCreateEvent}
              disabled={isCreating || !title.trim() || !scheduledAt}
            >
              {isCreating ? "Creando..." : "Crear evento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
