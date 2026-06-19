"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
	ContextualWizard,
	type WizardFlow,
} from "@/components/ui/contextual-wizard";
import { cn } from "@/lib/utils";

type DemoPageTourProps = {
	flow: WizardFlow;
	showButton?: boolean;
	buttonLabel?: string;
	buttonClassName?: string;
	storageKey?: string;
	preserveQueryOnComplete?: boolean;
	finishLabel?: string;
	/** Al finalizar el tour navega a esta URL (permite encadenar tours entre páginas). */
	nextHref?: string;
};

export function DemoPageTour({
	flow,
	showButton = false,
	buttonLabel = "Guia",
	buttonClassName,
	finishLabel,
	storageKey,
	preserveQueryOnComplete = false,
	nextHref,
}: DemoPageTourProps) {
	const pathname = usePathname();
	const router = useRouter();
	const { replace } = router;
	const searchParams = useSearchParams();
	const [open, setOpen] = useState(false);
	const preserveClearRef = useRef(false);
	const activeTourId = searchParams.get("tour");
	const isActiveTour = activeTourId === flow.id;
	const isAnotherTourActive = Boolean(activeTourId) && !isActiveTour;
	const wizardOpen = isAnotherTourActive ? false : open || isActiveTour;

	const clearTourQuery = useCallback(() => {
		if (activeTourId !== flow.id) return;
		const params = new URLSearchParams(searchParams.toString());
		params.delete("tour");
		const nextUrl = params.size > 0 ? `${pathname}?${params.toString()}` : pathname;
		replace(nextUrl, { scroll: false });
	}, [activeTourId, flow.id, pathname, replace, searchParams]);

	const resolvedStorageKey = useMemo(
		() => storageKey ?? `demo-tour-${flow.id}`,
		[flow.id, storageKey],
	);

	return (
		<>
			{showButton ? (
				<Button
					type="button"
					size="sm"
					className={cn(
						"gap-1.5 border border-orange-200/80 bg-orange-50 text-orange-700 hover:bg-orange-100 hover:border-orange-300 active:scale-[0.97] transition-all duration-150",
						buttonClassName,
					)}
					onClick={() => setOpen(true)}
				>
					<Sparkles className="size-3.5" />
					{buttonLabel}
				</Button>
			) : null}
			<ContextualWizard
				open={wizardOpen}
				onOpenChange={(nextOpen) => {
					setOpen(nextOpen);
					if (!nextOpen) {
						if (preserveClearRef.current) {
							preserveClearRef.current = false;
							return;
						}
						clearTourQuery();
					}
				}}
				flow={flow}
				storageKey={resolvedStorageKey}
				finishLabel={finishLabel}
				onComplete={() => {
					if (nextHref) {
						preserveClearRef.current = true;
						router.push(nextHref);
						return;
					}
					if (preserveQueryOnComplete) {
						preserveClearRef.current = true;
						return;
					}
					clearTourQuery();
				}}
				onSkip={clearTourQuery}
			/>
		</>
	);
}
