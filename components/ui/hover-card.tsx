"use client";

import * as React from "react";
import * as HoverCardPrimitive from "@radix-ui/react-hover-card";
import { cn } from "@/lib/utils";

const HoverCard = HoverCardPrimitive.Root;

const HoverCardTrigger = HoverCardPrimitive.Trigger;

const HoverCardContent = React.forwardRef<
	React.ElementRef<typeof HoverCardPrimitive.Content>,
	React.ComponentPropsWithoutRef<typeof HoverCardPrimitive.Content>
>(({ className, align = "center", side = "top", ...props }, ref) => (
	<HoverCardPrimitive.Content
		ref={ref}
		align={align}
		side={side}
		className={cn(
			"z-50 w-64 rounded-xl border border-stone-200 bg-white p-0 shadow-2xl outline-none",
			"data-[side=bottom]:animate-in data-[side=bottom]:slide-in-from-top-2",
			"data-[side=top]:animate-in data-[side=top]:slide-in-from-bottom-2",
			"data-[side=left]:animate-in data-[side=left]:slide-in-from-right-2",
			"data-[side=right]:animate-in data-[side=right]:slide-in-from-left-2",
			className
		)}
		{...props}
	/>
));
HoverCardContent.displayName = HoverCardPrimitive.Content.displayName;

export { HoverCard, HoverCardTrigger, HoverCardContent };
