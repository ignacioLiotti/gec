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



