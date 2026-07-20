"use client";

import { useReducedMotion } from "framer-motion";
import {
	Bar,
	CartesianGrid,
	ComposedChart,
	Line,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";

export type OperationalTrendPoint = {
	label: string;
	expiring: number;
	atRisk: number;
};

function TrendTooltip({
	active,
	payload,
	label,
}: {
	active?: boolean;
	payload?: Array<{ dataKey?: string; value?: number }>;
	label?: string;
}) {
	if (!active || !payload?.length) return null;

	const expiring = payload.find((item) => item.dataKey === "expiring")?.value ?? 0;
	const atRisk = payload.find((item) => item.dataKey === "atRisk")?.value ?? 0;

	return (
		<div className="rounded-lg border border-stroke-soft bg-card px-3 py-2 shadow-lg">
			<p className="text-xs font-semibold capitalize text-content">{label}</p>
			<p className="mt-1 text-xs text-content-muted">Vencimientos: {expiring}</p>
			<p className="text-xs text-content-muted">Con riesgo: {atRisk}</p>
		</div>
	);
}

export function OperationalTrendChart({ data }: { data: OperationalTrendPoint[] }) {
	const reduceMotion = useReducedMotion();
	const hasActivity = data.some((point) => point.expiring > 0 || point.atRisk > 0);

	return (
		<div
			className="relative h-[248px] w-full sm:h-[290px]"
			role="img"
			aria-label="Vencimientos de polizas y polizas con riesgo durante los proximos doce meses"
		>
			<ResponsiveContainer width="100%" height="100%">
				<ComposedChart data={data} margin={{ top: 18, right: 6, bottom: 0, left: -24 }}>
					<CartesianGrid vertical={false} stroke="hsl(var(--border-soft))" strokeDasharray="3 5" />
					<XAxis
						dataKey="label"
						axisLine={false}
						tickLine={false}
						tick={{ fill: "hsl(var(--content-muted))", fontSize: 11 }}
						tickMargin={12}
					/>
					<YAxis
						allowDecimals={false}
						axisLine={false}
						tickLine={false}
						tick={{ fill: "hsl(var(--content-muted))", fontSize: 11 }}
					/>
					<Tooltip cursor={{ fill: "hsl(var(--surface-muted))", opacity: 0.5 }} content={<TrendTooltip />} />
					<Bar
						dataKey="expiring"
						name="Vencimientos"
						fill="hsl(var(--orange-primary))"
						fillOpacity={0.82}
						maxBarSize={18}
						radius={[5, 5, 2, 2]}
						isAnimationActive={!reduceMotion}
						animationBegin={620}
						animationDuration={720}
					/>
					<Line
						type="monotone"
						dataKey="atRisk"
						name="Con riesgo"
						stroke="var(--src-mixed)"
						strokeWidth={2.25}
						dot={{ r: 3, fill: "var(--layer-white)", strokeWidth: 2 }}
						activeDot={{ r: 4 }}
						isAnimationActive={!reduceMotion}
						animationBegin={760}
						animationDuration={760}
					/>
				</ComposedChart>
			</ResponsiveContainer>
			{!hasActivity ? (
				<div className="pointer-events-none absolute inset-0 grid place-items-center">
					<p className="rounded-full border border-stroke-soft bg-card/90 px-3 py-1.5 text-xs text-content-muted shadow-sm">
						Sin vencimientos programados en este periodo
					</p>
				</div>
			) : null}
		</div>
	);
}
