export type CalendarView = "month" | "week" | "day" | "agenda";

export type PendienteStatus = "overdue" | "today" | "upcoming" | "nodate";

export interface CalendarEvent {
	id: string;
	title: string;
	description?: string;
	start: Date;
	end: Date;
	allDay?: boolean;
	color?: EventColor;
	location?: string;
	completed?: boolean;
	pendingStatus?: PendienteStatus;
	/**
	 * Optional obra metadata (for events created from an obra context).
	 */
	obraId?: string;
	obraName?: string;
	/**
	 * Optional metadata for notifications/calendar events.
	 */
	createdAt?: string;
	createdById?: string;
	createdByName?: string;
	audienceType?: "me" | "user" | "role" | "tenant";
	targetUserId?: string;
	targetUserName?: string;
	targetRoleId?: string;
	targetRoleName?: string;
	/**
	 * Optional audience metadata used by higher-level apps (e.g. notifications).
	 * - If audienceType is "me", the event is meant only for the creator.
	 * - If "role", it targets all users with the given role ID in the tenant.
	 */
	audienceRoleId?: string;
}

export type EventColor =
	| "sky"
	| "amber"
	| "violet"
	| "rose"
	| "emerald"
	| "orange";
