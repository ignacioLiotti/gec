"use client";

import { CheckCircle2, Circle, Loader2, Lock, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { StepCard } from "./step-card";
import type { FlowStepData } from "../_hooks/use-flow-state";

const statusIcon: Record<string, { icon: typeof CheckCircle2; className: string }> = {
	done: { icon: CheckCircle2, className: "text-green-600" },
	ready: { icon: Circle, className: "text-blue-600" },
	running: { icon: Loader2, className: "text-amber-500 animate-spin" },
	blocked: { icon: Lock, className: "text-muted-foreground" },
	failed: { icon: XCircle, className: "text-red-600" },
};

interface FlowStepperProps {
	steps: FlowStepData[];
	actions: string[];
	onAction: (action: string, payload?: Record<string, unknown>) => void;
	onOpenMeasurement: () => void;
	obraId?: string | null;
}

export function FlowStepper({
	steps,
	actions,
	onAction,
	onOpenMeasurement,
	obraId,
}: FlowStepperProps) {
	if (steps.length === 0) {
		return (
			<div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
				No hay pasos en el flujo. Seleccione una obra y periodo, luego refresque el estado.
			</div>
		);
	}

	return (
		<div className="space-y-0">
			{steps.map((step, index) => {
				const iconConfig = statusIcon[step.status] ?? statusIcon.blocked;
				const Icon = iconConfig.icon;
				const isLast = index === steps.length - 1;

				return (
					<div key={step.stepId} className="flex gap-4">
						{/* Left column: icon + connector */}
						<div className="flex flex-col items-center">
							<div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-muted bg-background">
								<Icon className={cn("h-4 w-4", iconConfig.className)} />
							</div>
							{!isLast && (
								<div className="w-0.5 flex-1 bg-muted" />
							)}
						</div>

						{/* Right column: step card */}
						<div className={cn("flex-1 pb-6", isLast && "pb-0")}>
							<StepCard
								step={step}
								actions={actions}
								onAction={onAction}
								onOpenMeasurement={onOpenMeasurement}
								obraId={obraId ?? null}
							/>
						</div>
					</div>
				);
			})}
		</div>
	);
}
