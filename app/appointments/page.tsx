"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";

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
      }
    } catch (err) {
      console.error("Error cancelling event:", err);
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
          onClick={() => {
            // This would open a modal or navigate to a creation form
            alert("Feature coming soon: Create new appointment/meeting");
          }}
          className="rounded-md bg-orange-primary px-6 py-3 font-medium text-white hover:bg-orange-primary/90"
        >
          + Nueva cita o reunión
        </button>
      </div>
    </div>
  );
}
