"use client";

import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useFlowState } from "./_hooks/use-flow-state";
import { useFlowAction } from "./_hooks/use-flow-action";
import { PmcHeader } from "./_components/pmc-header";
import { FlowStepper } from "./_components/flow-stepper";
import { MeasurementSheet } from "./_components/measurement-sheet";
import { PeriodComparison } from "./_components/period-comparison";
import { OutputsSection } from "./_components/outputs-section";
import { DebugSection } from "./_components/debug-section";
import type { MeasurementRow } from "./_components/measurement-table";

interface PmcClientProps {
	initialPeriod: string;
}

export function PmcClient({ initialPeriod }: PmcClientProps) {
	const [obraId, setObraId] = useState<string | null>(null);
	const [obraName, setObraName] = useState<string | null>(null);
	const [period, setPeriod] = useState(initialPeriod);
	const [measurementOpen, setMeasurementOpen] = useState(false);

	const { data: flowState, isLoading, refetch } = useFlowState(obraId, period);
	const flowAction = useFlowAction(obraId, period);

	function handleSelectObra(id: string, name: string) {
		setObraId(id);
		setObraName(name);
	}

	function handleAction(action: string, payload?: Record<string, unknown>) {
		flowAction.mutate({ action, payload });
	}

	function handleSubmitMeasurement(rows: MeasurementRow[]) {
		flowAction.mutate({
			action: "submit_measurement",
			payload: { rows },
		});
	}

	function handleInitialize() {
		flowAction.mutate({ action: "open_period" });
	}

	const measurementStep = flowState?.steps.find((s) => s.stepId === "measurement");

	return (
		<div className="space-y-6">
			<PmcHeader
				obraId={obraId}
				obraName={obraName}
				period={period}
				flowState={flowState}
				isLoading={isLoading || flowAction.isPending}
				onSelectObra={handleSelectObra}
				onPeriodChange={setPeriod}
				onRefresh={() => refetch()}
				onInitialize={handleInitialize}
			/>

			{isLoading && obraId && (
				<div className="space-y-4">
					<Skeleton className="h-32 w-full" />
					<Skeleton className="h-32 w-full" />
					<Skeleton className="h-32 w-full" />
				</div>
			)}

			{!obraId && (
				<div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
					Seleccione una obra para comenzar.
				</div>
			)}

			{flowState && (
				<>
					<FlowStepper
						steps={flowState.steps}
						actions={flowState.actions ?? []}
						onAction={handleAction}
						onOpenMeasurement={() => setMeasurementOpen(true)}
						obraId={obraId}
					/>

					<MeasurementSheet
						open={measurementOpen}
						onOpenChange={setMeasurementOpen}
						measurementStep={measurementStep}
						onSubmit={handleSubmitMeasurement}
					/>

					<PeriodComparison obraId={obraId} period={period} />

					<OutputsSection steps={flowState.steps} />

					<DebugSection
						obraId={obraId}
						flowState={flowState}
						onRefresh={() => refetch()}
					/>
				</>
			)}
		</div>
	);
}
