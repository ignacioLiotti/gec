import { isSameDay } from "date-fns";

import type { CalendarEvent, EventColor } from "@/components/event-calendar";

/**
 * Get CSS classes for event colors
 */
export function getEventColorClasses(color?: EventColor | string): string {
	const eventColor = color || "sky";

	switch (eventColor) {
		case "sky":
			return "border border-sky-200 bg-sky-100/80 text-sky-900 hover:bg-sky-100";
		case "amber":
			return "border border-amber-200 bg-amber-100/80 text-amber-900 hover:bg-amber-100";
		case "violet":
			return "border border-violet-200 bg-violet-100/80 text-violet-900 hover:bg-violet-100";
		case "rose":
			return "border border-rose-200 bg-rose-100/80 text-rose-900 hover:bg-rose-100";
		case "emerald":
			return "border border-emerald-200 bg-emerald-100/80 text-emerald-900 hover:bg-emerald-100";
		case "orange":
			return "border border-orange-200 bg-orange-100/80 text-orange-900 hover:bg-orange-100";
		default:
			return "border border-sky-200 bg-sky-100/80 text-sky-900 hover:bg-sky-100";
	}
}

/**
 * Get CSS classes for border radius based on event position in multi-day events
 */
export function getBorderRadiusClasses(
	isFirstDay: boolean,
	isLastDay: boolean,
): string {
	if (isFirstDay && isLastDay) {
		return "rounded"; // Both ends rounded
	} else if (isFirstDay) {
		return "rounded-l rounded-r-none"; // Only left end rounded
	} else if (isLastDay) {
		return "rounded-r rounded-l-none"; // Only right end rounded
	} else {
		return "rounded-none"; // No rounded corners
	}
}

/**
 * Check if an event is a multi-day event
 */
export function isMultiDayEvent(event: CalendarEvent): boolean {
	const eventStart = new Date(event.start);
	const eventEnd = new Date(event.end);
	return event.allDay || eventStart.getDate() !== eventEnd.getDate();
}

/**
 * Filter events for a specific day
 */
export function getEventsForDay(
	events: CalendarEvent[],
	day: Date,
): CalendarEvent[] {
	return events
		.filter((event) => {
			const eventStart = new Date(event.start);
			return isSameDay(day, eventStart);
		})
		.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
}

/**
 * Sort events with multi-day events first, then by start time
 */
export function sortEvents(events: CalendarEvent[]): CalendarEvent[] {
	return [...events].sort((a, b) => {
		const aIsMultiDay = isMultiDayEvent(a);
		const bIsMultiDay = isMultiDayEvent(b);

		if (aIsMultiDay && !bIsMultiDay) return -1;
		if (!aIsMultiDay && bIsMultiDay) return 1;

		return new Date(a.start).getTime() - new Date(b.start).getTime();
	});
}

/**
 * Get multi-day events that span across a specific day (but don't start on that day)
 */
export function getSpanningEventsForDay(
	events: CalendarEvent[],
	day: Date,
): CalendarEvent[] {
	return events.filter((event) => {
		if (!isMultiDayEvent(event)) return false;

		const eventStart = new Date(event.start);
		const eventEnd = new Date(event.end);

		// Only include if it's not the start day but is either the end day or a middle day
		return (
			!isSameDay(day, eventStart) &&
			(isSameDay(day, eventEnd) || (day > eventStart && day < eventEnd))
		);
	});
}

/**
 * Get all events visible on a specific day (starting, ending, or spanning)
 */
export function getAllEventsForDay(
	events: CalendarEvent[],
	day: Date,
): CalendarEvent[] {
	return events.filter((event) => {
		const eventStart = new Date(event.start);
		const eventEnd = new Date(event.end);
		return (
			isSameDay(day, eventStart) ||
			isSameDay(day, eventEnd) ||
			(day > eventStart && day < eventEnd)
		);
	});
}

/**
 * Get all events for a day (for agenda view)
 */
export function getAgendaEventsForDay(
	events: CalendarEvent[],
	day: Date,
): CalendarEvent[] {
	return events
		.filter((event) => {
			const eventStart = new Date(event.start);
			const eventEnd = new Date(event.end);
			return (
				isSameDay(day, eventStart) ||
				isSameDay(day, eventEnd) ||
				(day > eventStart && day < eventEnd)
			);
		})
		.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
}
