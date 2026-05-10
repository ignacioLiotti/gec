"use client";

import dynamic from "next/dynamic";

export type { AdvanceCurvePoint } from "./advance-curve-chart-client";

import type { AdvanceCurvePoint } from "./advance-curve-chart-client";

type AdvanceCurveChartProps = {
	points: AdvanceCurvePoint[];
	focusedSeries?: "plan" | "real";
	highlightedSortOrder?: number | null;
};

const DynamicAdvanceCurveChart = dynamic(
	() =>
		import("./advance-curve-chart-client").then(
			(mod) => mod.AdvanceCurveChart,
		),
	{
		ssr: false,
		loading: () => (
			<div className="rounded border border-dashed p-4 text-xs text-muted-foreground">
				Cargando curva...
			</div>
		),
	},
);

export function AdvanceCurveChart(props: AdvanceCurveChartProps) {
	return <DynamicAdvanceCurveChart {...props} />;
}
