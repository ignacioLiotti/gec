import { defineRule } from "./engine";
import { parseLocalDate } from "@/utils/date";

const appBaseUrl =
	process.env.NEXT_PUBLIC_APP_BASE_URL ??
	process.env.NEXT_PUBLIC_APP_URL ??
	(process.env.NEXT_PUBLIC_VERCEL_URL
		? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
		: process.env.VERCEL_URL
			? `https://${process.env.VERCEL_URL}`
			: "http://localhost:3000");

function getNotificationTypes(ctx: any): string[] {
	const raw = ctx.notificationTypes;
	if (Array.isArray(raw)) return raw as string[];
	if (!raw) return [];
	return [raw];
}

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
			when: (ctx) =>
				ctx.followUpAt
					? new Date(ctx.followUpAt)
					: new Date(Date.now() + 2 * 60 * 1000),
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
				const due = parseLocalDate(ctx.dueDate ?? null);
				if (!due) return null;
				const dayBefore = new Date(due.getTime() - 24 * 60 * 60 * 1000);
				dayBefore.setHours(9, 0, 0, 0);
				return dayBefore;
			},
            title: (ctx) => `Recordatorio: ${ctx.documentName} pendiente`,
      body: (ctx) => `Vence el documento de "${ctx.obraName ?? ""}" el ${ctx.dueDate ?? ""}.`,
			actionUrl: (ctx) => (ctx.obraId ? `/excel/${ctx.obraId}` : null),
			type: "reminder",
            data: (ctx) => ({
                stage: "due_1d",
                pendienteId: ctx.pendienteId ?? null,
                obraId: ctx.obraId ?? null,
                obraName: ctx.obraName ?? null,
                documentName: ctx.documentName ?? null,
        dueDate: ctx.dueDate ?? null,
            }),
		},
	],
});

defineRule("flujo.action.triggered", {
	recipients: async (ctx) => {
		const recipientId = ctx.recipientId as string | undefined;
		return recipientId ? [recipientId] : [];
	},
	effects: [
		{
			channel: "in-app",
			shouldSend: (ctx) => {
				const types = getNotificationTypes(ctx);
				return types.length === 0 || types.includes("in_app");
			},
			when: (ctx) => {
				if (!ctx.executeAt) return "now";
				const at = new Date(ctx.executeAt);
				return Number.isNaN(at.getTime()) ? "now" : at;
			},
			title: (ctx) => ctx.title || "Flujo action",
			body: (ctx) => ctx.message || "",
			actionUrl: (ctx) => (ctx.obraId ? `/excel/${ctx.obraId}` : null),
			type: "flujo_email",
			data: (ctx) => ({
				obraId: ctx.obraId ?? null,
				flujoActionId: ctx.actionId ?? null,
				scheduledFor: ctx.executeAt ?? null,
			}),
		},
		{
			channel: "email",
			shouldSend: (ctx) => {
				const types = getNotificationTypes(ctx);
				return types.includes("email");
			},
			when: (ctx) => {
				if (!ctx.executeAt) return "now";
				const at = new Date(ctx.executeAt);
				return Number.isNaN(at.getTime()) ? "now" : at;
			},
			subject: (ctx) => ctx.title || "Notificación",
			html: (ctx) => {
				const message = ctx.message || "";
				const obraPath = ctx.obraId ? `/excel/${ctx.obraId}` : "";
				const obraUrl = obraPath ? `${appBaseUrl}${obraPath}` : appBaseUrl;
				const linkMarkup = obraPath
					? `<p><a href="${obraUrl}">Ver obra</a></p>`
					: "";
				return `<p>${message}</p>${linkMarkup}`;
			},
		},
	],
});
