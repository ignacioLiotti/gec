import crypto from "node:crypto";

const DEFAULT_TIMEZONE = "America/Argentina/Buenos_Aires";

export type RecurringScheduleInput = {
	frequency?: string | null;
	weekday?: string | null;
	dayOfMonth?: number | null;
	timeOfDay?: string | null;
	timezone?: string | null;
	from?: Date;
};

export function createWhatsAppRunToken(runId: string) {
	const secret = tokenSecret();
	return crypto.createHmac("sha256", secret).update(runId).digest("hex");
}

export function verifyWhatsAppRunToken(runId: string, token?: string | null) {
	if (!runId || !token) return false;
	const expected = createWhatsAppRunToken(runId);
	const provided = Buffer.from(token, "hex");
	const expectedBuffer = Buffer.from(expected, "hex");
	if (provided.length !== expectedBuffer.length) return false;
	return crypto.timingSafeEqual(provided, expectedBuffer);
}

export function getPublicAppUrl() {
	const configured =
		process.env.NEXT_PUBLIC_APP_URL ??
		process.env.APP_URL ??
		(process.env.NEXT_PUBLIC_VERCEL_URL
			? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
			: process.env.VERCEL_URL
				? `https://${process.env.VERCEL_URL}`
				: "http://localhost:3000");
	return configured.replace(/\/$/, "");
}

export function buildWhatsAppResponseUrl(runId: string) {
	const token = createWhatsAppRunToken(runId);
	return `${getPublicAppUrl()}/whatsapp/respond/${runId}?token=${token}`;
}

export function buildWhatsAppFlowResponseUrl(runId: string) {
	const token = createWhatsAppRunToken(runId);
	return `${getPublicAppUrl()}/whatsapp/flow/${runId}?token=${token}`;
}

export function computeNextRunAt(input: RecurringScheduleInput) {
	const from = input.from ?? new Date();
	const frequency = input.frequency ?? "weekly";
	if (frequency === "once") return null;

	const timezone = input.timezone || DEFAULT_TIMEZONE;
	const offsetMinutes = timezone === DEFAULT_TIMEZONE ? -180 : 0;
	const base = new Date(from.getTime() + offsetMinutes * 60_000);
	const [hour, minute] = parseTimeOfDay(input.timeOfDay);
	const candidate = new Date(Date.UTC(
		base.getUTCFullYear(),
		base.getUTCMonth(),
		base.getUTCDate(),
		hour,
		minute,
		0,
		0,
	));

	if (frequency === "daily") {
		if (candidate.getTime() <= base.getTime()) candidate.setUTCDate(candidate.getUTCDate() + 1);
		return fromLocalZone(candidate, offsetMinutes);
	}

	if (frequency === "monthly") {
		const day = Math.min(Math.max(input.dayOfMonth ?? 1, 1), 31);
		candidate.setUTCDate(Math.min(day, daysInMonth(candidate)));
		if (candidate.getTime() <= base.getTime()) {
			candidate.setUTCMonth(candidate.getUTCMonth() + 1, 1);
			candidate.setUTCDate(Math.min(day, daysInMonth(candidate)));
		}
		return fromLocalZone(candidate, offsetMinutes);
	}

	const weekday = weekdayIndex(input.weekday);
	const currentWeekday = candidate.getUTCDay();
	let addDays = (weekday - currentWeekday + 7) % 7;
	if (addDays === 0 && candidate.getTime() <= base.getTime()) addDays = 7;
	candidate.setUTCDate(candidate.getUTCDate() + addDays);
	return fromLocalZone(candidate, offsetMinutes);
}

export function templateVariables(args: {
	variables: unknown;
	contactName?: string | null;
	obraName?: string | null;
	templateName?: string | null;
	folderPath?: string | null;
	responseUrl?: string | null;
}) {
	const variableNames = Array.isArray(args.variables)
		? args.variables.filter((item): item is string => typeof item === "string")
		: [];
	const values = variableNames.length > 0
		? variableNames.map((name) => resolveVariable(name, args))
		: [args.contactName, args.obraName, args.responseUrl].filter(Boolean).map(String);
	return values.map((text) => ({ type: "text" as const, text }));
}

function resolveVariable(
	name: string,
	args: {
		contactName?: string | null;
		obraName?: string | null;
		templateName?: string | null;
		folderPath?: string | null;
		responseUrl?: string | null;
	},
) {
	const key = name.trim().toLowerCase();
	if (key === "contacto" || key === "contact" || key === "nombre" || key === "name") {
		return args.contactName ?? "";
	}
	if (key === "obra" || key === "work") return args.obraName ?? "";
	if (key === "template" || key === "formulario" || key === "form") return args.templateName ?? "";
	if (key === "carpeta" || key === "folder") return args.folderPath ?? "";
	if (key === "link" || key === "url" || key === "form_url" || key === "response_url") {
		return args.responseUrl ?? "";
	}
	return "";
}

function tokenSecret() {
	const secret = process.env.WHATSAPP_RESPONSE_SECRET ?? process.env.WHATSAPP_APP_SECRET ?? process.env.CRON_SECRET;
	if (!secret) {
		if (process.env.NODE_ENV === "production") {
			throw new Error("WHATSAPP_RESPONSE_SECRET is required in production");
		}
		return "dev-whatsapp-response-secret";
	}
	return secret;
}

function parseTimeOfDay(value?: string | null) {
	const match = String(value ?? "09:00").match(/^(\d{1,2}):(\d{2})/);
	const hour = match ? Number.parseInt(match[1]!, 10) : 9;
	const minute = match ? Number.parseInt(match[2]!, 10) : 0;
	return [Math.min(Math.max(hour, 0), 23), Math.min(Math.max(minute, 0), 59)];
}

function fromLocalZone(localDate: Date, offsetMinutes: number) {
	return new Date(localDate.getTime() - offsetMinutes * 60_000).toISOString();
}

function daysInMonth(date: Date) {
	return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
}

function weekdayIndex(value?: string | null) {
	const key = String(value ?? "monday").trim().toLowerCase();
	const map: Record<string, number> = {
		sunday: 0,
		domingo: 0,
		monday: 1,
		lunes: 1,
		tuesday: 2,
		martes: 2,
		wednesday: 3,
		miercoles: 3,
		thursday: 4,
		jueves: 4,
		friday: 5,
		viernes: 5,
		saturday: 6,
		sabado: 6,
	};
	return map[key] ?? 1;
}
