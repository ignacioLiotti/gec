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
	 * Optional audience metadata used by higher-level apps (e.g. notifications).
	 * - If audienceType is "me", the event is meant only for the creator.
	 * - If "role", it targets all users with the given role ID in the tenant.
	 */
	audienceType?: "me" | "role";
	audienceRoleId?: string;
}

export type EventColor =
	| "sky"
	| "amber"
	| "violet"
	| "rose"
	| "emerald"
	| "orange";
