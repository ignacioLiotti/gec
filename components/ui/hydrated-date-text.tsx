"use client";

import * as React from "react";

type HydratedDateTextProps = {
	value: string | number | Date;
	format?: "datetime" | "relative";
	locale?: string;
	options?: Intl.DateTimeFormatOptions;
	titleLocale?: string;
	titleOptions?: Intl.DateTimeFormatOptions;
	fallback?: React.ReactNode;
	className?: string;
};

function formatRelativeDate(date: Date) {
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffMins = Math.floor(diffMs / 60000);
	const diffHours = Math.floor(diffMs / 3600000);
	const diffDays = Math.floor(diffMs / 86400000);

	if (diffMins < 1) return "Ahora";
	if (diffMins < 60) return `${diffMins}m`;
	if (diffHours < 24) return `${diffHours}h`;
	if (diffDays < 7) return `${diffDays}d`;
	return date.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

export function HydratedDateText({
	value,
	format = "datetime",
	locale = "es-AR",
	options,
	titleLocale,
	titleOptions,
	fallback = "-",
	className,
}: HydratedDateTextProps) {
	const [mounted, setMounted] = React.useState(false);

	React.useEffect(() => {
		setMounted(true);
	}, []);

	const date = mounted ? new Date(value) : null;
	const hasValidDate = date !== null && !Number.isNaN(date.getTime());
	const text =
		hasValidDate
			? format === "relative"
				? formatRelativeDate(date)
				: date.toLocaleString(locale, options)
			: fallback;
	const title =
		hasValidDate && titleLocale
			? date.toLocaleString(titleLocale, titleOptions)
			: undefined;

	return (
		<span className={className} title={title}>
			{text}
		</span>
	);
}
