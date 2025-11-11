import { defineRule } from "./engine";

// obra.completed -> notify actor now (in-app) and optional email follow-up
defineRule("obra.completed", {
  recipients: async (ctx) => {
    const ids: string[] = [];
    if (ctx.actorId) ids.push(ctx.actorId);
    return ids;
  },
  effects: [
    {
      channel: "in-app",
      when: "now",
      title: (ctx) => `Obra completada`,
      body: (ctx) => `La obra "${ctx.obra?.name ?? ""}" alcanzó el 100%.`,
      actionUrl: (ctx) => (ctx.obra?.id ? `/excel/${ctx.obra.id}` : null),
      type: "success",
    },
    {
      channel: "email",
      when: (ctx) => (ctx.followUpAt ? new Date(ctx.followUpAt) : new Date(Date.now() + 2 * 60 * 1000)),
      subject: (ctx) => `Seguimiento: ${ctx.obra?.name ?? "Obra"}`,
      html: (ctx) => {
        const name = ctx.obra?.name ?? "Obra";
        return `<p>Recordatorio: la obra <strong>${name}</strong> fue completada recientemente.</p>`;
      },
    },
  ],
});

// document.reminder.requested -> schedule in-app (and optionally email) the day before at 09:00
defineRule("document.reminder.requested", {
  recipients: async (ctx) => {
    const ids: string[] = [];
    if (ctx.notifyUserId) ids.push(ctx.notifyUserId);
    return ids;
  },
  effects: [
    {
      channel: "in-app",
      when: (ctx) => {
        const due = new Date(String(ctx.dueDate));
        const dayBefore = new Date(due.getTime() - 24 * 60 * 60 * 1000);
        dayBefore.setHours(9, 0, 0, 0);
        return dayBefore;
      },
      title: (ctx) => `Recordatorio: ${ctx.documentName} pendiente`,
      body: (ctx) => `Mañana vence el documento de "${ctx.obraName ?? ""}".`,
      actionUrl: (ctx) => (ctx.obraId ? `/excel/${ctx.obraId}` : null),
      type: "reminder",
    },
  ],
});

// ============================================================================
// APPOINTMENT AND MEETING EVENT TYPES
// ============================================================================

// appointment.created -> notify recipient immediately and send reminder 1 day before
defineRule("appointment.created", {
  recipients: async (ctx) => {
    const ids: string[] = [];
    if (ctx.userId) ids.push(ctx.userId);
    // Could also notify other attendees if ctx.attendeeIds is provided
    if (Array.isArray(ctx.attendeeIds)) {
      ids.push(...ctx.attendeeIds);
    }
    return ids;
  },
  effects: [
    {
      channel: "in-app",
      when: "now",
      title: (ctx) => `Nueva cita: ${ctx.title ?? "Sin título"}`,
      body: (ctx) => {
        const date = ctx.appointmentAt ? new Date(ctx.appointmentAt).toLocaleString("es-AR") : "";
        const location = ctx.location ? ` en ${ctx.location}` : "";
        return `${date}${location}`;
      },
      actionUrl: (ctx) => `/appointments/${ctx.appointmentId ?? ""}`,
      type: "info",
    },
    {
      channel: "in-app",
      when: (ctx) => {
        if (!ctx.appointmentAt) return "now";
        const apptTime = new Date(ctx.appointmentAt);
        const dayBefore = new Date(apptTime.getTime() - 24 * 60 * 60 * 1000);
        dayBefore.setHours(9, 0, 0, 0);
        return dayBefore;
      },
      title: (ctx) => `Recordatorio: ${ctx.title ?? "Cita mañana"}`,
      body: (ctx) => {
        const date = ctx.appointmentAt ? new Date(ctx.appointmentAt).toLocaleString("es-AR") : "";
        const location = ctx.location ? ` en ${ctx.location}` : "";
        return `Tu cita es mañana a las ${date}${location}`;
      },
      actionUrl: (ctx) => `/appointments/${ctx.appointmentId ?? ""}`,
      type: "reminder",
    },
    {
      channel: "email",
      when: (ctx) => {
        if (!ctx.appointmentAt) return "now";
        const apptTime = new Date(ctx.appointmentAt);
        const dayBefore = new Date(apptTime.getTime() - 24 * 60 * 60 * 1000);
        dayBefore.setHours(9, 0, 0, 0);
        return dayBefore;
      },
      subject: (ctx) => `Recordatorio: ${ctx.title ?? "Cita mañana"}`,
      html: (ctx) => {
        const title = ctx.title ?? "Tu cita";
        const date = ctx.appointmentAt ? new Date(ctx.appointmentAt).toLocaleString("es-AR") : "";
        const location = ctx.location ?? "";
        const notes = ctx.notes ?? "";
        return `
          <h2>${title}</h2>
          <p><strong>Fecha y hora:</strong> ${date}</p>
          ${location ? `<p><strong>Lugar:</strong> ${location}</p>` : ""}
          ${notes ? `<p><strong>Notas:</strong> ${notes}</p>` : ""}
        `;
      },
    },
  ],
});

// meeting.scheduled -> notify all participants
defineRule("meeting.scheduled", {
  recipients: async (ctx) => {
    const ids: string[] = [];
    if (ctx.organizerId) ids.push(ctx.organizerId);
    if (Array.isArray(ctx.participantIds)) {
      ids.push(...ctx.participantIds);
    }
    return [...new Set(ids)]; // Remove duplicates
  },
  effects: [
    {
      channel: "in-app",
      when: "now",
      title: (ctx) => `Reunión programada: ${ctx.title ?? "Sin título"}`,
      body: (ctx) => {
        const date = ctx.meetingAt ? new Date(ctx.meetingAt).toLocaleString("es-AR") : "";
        return `Reunión el ${date}`;
      },
      actionUrl: (ctx) => `/meetings/${ctx.meetingId ?? ""}`,
      type: "info",
    },
    {
      channel: "in-app",
      when: (ctx) => {
        if (!ctx.meetingAt) return "now";
        const meetingTime = new Date(ctx.meetingAt);
        // Reminder 1 hour before
        return new Date(meetingTime.getTime() - 60 * 60 * 1000);
      },
      title: (ctx) => `Reunión en 1 hora: ${ctx.title ?? ""}`,
      body: (ctx) => {
        const location = ctx.location ?? "Por confirmar";
        return `Ubicación: ${location}`;
      },
      actionUrl: (ctx) => `/meetings/${ctx.meetingId ?? ""}`,
      type: "reminder",
    },
  ],
});



