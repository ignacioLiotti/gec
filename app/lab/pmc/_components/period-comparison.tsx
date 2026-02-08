"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFlowState } from "../_hooks/use-flow-state";

function getPreviousPeriod(period: string): string {
	const [yearStr, monthStr] = period.split("-");
	let year = Number(yearStr);
	let month = Number(monthStr);
	month -= 1;
	if (month < 1) {
		month = 12;
		year -= 1;
	}
	return `${year}-${String(month).padStart(2, "0")}`;
}

interface PeriodComparisonProps {
	obraId: string | null;
	period: string;
}

export function PeriodComparison({ obraId, period }: PeriodComparisonProps) {
	const prevPeriod = getPreviousPeriod(period);
	const { data: prevState } = useFlowState(obraId, prevPeriod);

	if (!prevState || prevState.steps.length === 0) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="text-base">Comparacion con periodo anterior</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-sm text-muted-foreground">
						No hay datos del periodo anterior ({prevPeriod}).
					</p>
				</CardContent>
			</Card>
		);
	}

	const prevMeasurement = prevState.steps.find((s) => s.stepId === "measurement");
	const prevTotal = prevMeasurement?.outputs
		? Object.keys(prevMeasurement.outputs).length
		: 0;

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">Comparacion con periodo anterior</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="grid grid-cols-3 gap-4">
					<div className="text-center">
						<p className="text-2xl font-bold">{prevPeriod}</p>
						<p className="text-xs text-muted-foreground">Periodo anterior</p>
						<p className="text-sm mt-1">{prevTotal} outputs</p>
					</div>
					<div className="text-center">
						<p className="text-2xl font-bold text-blue-600">-</p>
						<p className="text-xs text-muted-foreground">Delta</p>
					</div>
					<div className="text-center">
						<p className="text-2xl font-bold">{period}</p>
						<p className="text-xs text-muted-foreground">Periodo actual</p>
					</div>
				</div>
				{prevMeasurement?.status === "done" && (
					<p className="mt-3 text-xs text-muted-foreground">
						El periodo anterior tiene medicion completada.
					</p>
				)}
			</CardContent>
		</Card>
	);
}
