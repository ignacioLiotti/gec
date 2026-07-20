"use client";

import * as React from "react";

import {
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
} from "@/components/ui/hover-card";

/**
 * Progressive-disclosure wrapper for dashboard rows. Renders its child
 * untouched during SSR and hydration, then upgrades to a hover card on the
 * client. Radix must stay out of the server render here: SSR-ing the trigger
 * drops rows from the HTML shell and desynchronizes hydration.
 */
export function Peek({
	children,
	content,
}: {
	children: React.ReactNode;
	content: React.ReactNode;
}) {
	const [interactive, setInteractive] = React.useState(false);

	React.useEffect(() => {
		setInteractive(true);
	}, []);

	if (!interactive) return <>{children}</>;

	return (
		<HoverCard openDelay={150} closeDelay={80}>
			<HoverCardTrigger asChild>{children}</HoverCardTrigger>
			<HoverCardContent
				align="start"
				className="w-72 rounded-lg border-stroke-soft bg-card p-3 shadow-lg"
			>
				{content}
			</HoverCardContent>
		</HoverCard>
	);
}
