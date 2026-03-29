"use client";

import {
	CartesianGrid,
	Line,
	LineChart,
	ReferenceArea,
	ReferenceLine,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";

export type AdvanceCurvePoint = {
	label: string;
	planPct: number | null;
	realPct: number | null;
	sortOrder: number;
};

const periodLabel = (period: string): string => {
	const [year, month] = period.split("-");
	const y = Number.parseInt(year, 10);
	const m = Number.parseInt(month, 10);
	if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
		return period;
	}

	return new Date(y, m - 1, 1).toLocaleDateString("es-AR", {
		month: "short",
		year: "numeric",
	});
};

export function AdvanceCurveChart({
	points,
}: {
	points: AdvanceCurvePoint[];
}) {
	if (points.length === 0) {
		return (
			<div className="rounded border border-dashed p-4 text-xs text-muted-foreground">
				No hay puntos de curva para graficar todavia.
			</div>
		);
	}

	const toPct100 = (value: number | null): number | null => {
		if (value == null || !Number.isFinite(value)) return null;
		return Math.abs(value) <= 1 ? value * 100 : value;
	};

	const normalizedPoints = points.map((point) => ({
		...point,
		planPct: toPct100(point.planPct),
		realPct: toPct100(point.realPct),
	}));

	const hasRealData = normalizedPoints.some((point) => point.realPct != null);
	const yMax = Math.max(
		100,
		...normalizedPoints.flatMap((point) => [point.planPct ?? 0, point.realPct ?? 0]),
	);
	const chartData = normalizedPoints.map((point, index) => ({
		x: point.sortOrder,
		idx: index,
		label: point.label,
		planPct: point.planPct,
		realPct: point.realPct,
		missingReal: hasRealData && point.realPct == null,
	}));
	const now = new Date();
	const currentMonthOrder = now.getFullYear() * 12 + now.getMonth();
	const minX = Math.min(...chartData.map((d) => d.x));
	const maxX = Math.max(...chartData.map((d) => d.x));
	const markerX =
		Number.isFinite(currentMonthOrder)
			? Math.max(minX, Math.min(maxX, currentMonthOrder))
			: null;
	const timelineLabel = (() => {
		if (markerX == null) return null;
		const year = Math.floor(markerX / 12);
		const month = (markerX % 12) + 1;
		return `Hoy · ${periodLabel(`${year}-${String(month).padStart(2, "0")}`)}`;
	})();

	const yTicks = [0, 25, 50, 75, 100].filter((tick) => tick <= yMax || tick === 100);
	const labelStep = chartData.length > 12 ? Math.ceil(chartData.length / 12) : 1;
	const xTicks = chartData
		.filter((_, index) => index % labelStep === 0 || index === chartData.length - 1)
		.map((point) => point.x);
	const labelByX = new Map(chartData.map((point) => [point.x, point.label] as const));
	const pointByX = new Map(chartData.map((point) => [point.x, point] as const));
	const formatTooltipValue = (value: number | null | undefined, emptyLabel: string) =>
		value == null ? emptyLabel : `${Number(value).toFixed(2)}%`;
	const renderTooltip = ({
		active,
		label,
	}: {
		active?: boolean;
		label?: string | number;
	}) => {
		if (!active) return null;
		const x = Number(label);
		if (!Number.isFinite(x)) return null;
		const point = pointByX.get(x);
		if (!point) return null;

		return (
			<div className="min-w-[170px] rounded-md border border-[#d9d9d9] bg-white px-4 py-3 text-sm shadow-sm">
				<div className="mb-2 font-medium text-[#1a1a1a]">{point.label}</div>
				<div className="space-y-2">
					<div className="flex items-center justify-between gap-3">
						<span className="text-sky-500">Curva Plan</span>
						<span className="font-medium text-sky-500">
							{formatTooltipValue(point.planPct, "Sin dato")}
						</span>
					</div>
					<div className="flex items-center justify-between gap-3">
						<span className="text-[#ff5800]">PMC Resumen</span>
						<span className="font-medium text-[#ff5800]">
							{formatTooltipValue(point.realPct, "Sin certificado")}
						</span>
					</div>
				</div>
			</div>
		);
	};

	return (
		<div className="space-y-2 pt-4">
			<div className="rounded-md border bg-stone-50 p-2">
				<div className="h-[240px] w-full px-3 pb-2 pt-5">
					<ResponsiveContainer width="100%" height="100%">
						<LineChart
							data={chartData}
							margin={{ top: 12, right: 16, bottom: 30, left: 0 }}
						>
							<CartesianGrid stroke="currentColor" className="text-muted/30" vertical={false} />
							<XAxis
								dataKey="x"
								type="number"
								domain={[minX, maxX > minX ? maxX : minX + 1]}
								ticks={xTicks}
								tickLine={false}
								axisLine={false}
								tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
								tickFormatter={(value) => labelByX.get(Number(value)) ?? ""}
							/>
							<YAxis
								width={40}
								domain={[0, Math.ceil(yMax)]}
								ticks={yTicks}
								axisLine={false}
								tickLine={false}
								tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
								tickFormatter={(value) => `${value}%`}
							/>
							<Tooltip content={renderTooltip} />
							{chartData
								.filter((point) => point.missingReal)
								.map((point) => (
									<ReferenceArea
										key={`missing-real-${point.x}`}
										x1={point.x - 0.5}
										x2={point.x + 0.5}
										ifOverflow="extendDomain"
										fill="#ffedd5"
										fillOpacity={0.85}
										strokeOpacity={0}
									/>
								))}
							{markerX != null ? (
								<ReferenceLine
									x={markerX}
									stroke="#f59e0b"
									strokeWidth={1.5}
									strokeDasharray="5 4"
									label={
										timelineLabel
											? {
													value: timelineLabel,
													position: "top",
													fill: "#d97706",
													fontSize: 10,
											  }
											: undefined
									}
								/>
							) : null}
							<Line
								type="monotone"
								dataKey="planPct"
								name="planPct"
								stroke="#0ea5e9"
								strokeWidth={2.5}
								strokeDasharray="6 4"
								dot={{ r: 3 }}
								isAnimationActive={false}
							/>
							<Line
								type="monotone"
								dataKey="realPct"
								name="realPct"
								stroke="#ff5800"
								strokeWidth={2.5}
								dot={{ r: 3 }}
								isAnimationActive={false}
							/>
						</LineChart>
					</ResponsiveContainer>
				</div>
				<div className="-mt-5 ml-4 flex flex-wrap items-center gap-4 text-xs">
					<div className="flex items-center gap-2">
						<span className="h-2.5 w-2.5 rounded-full bg-sky-500" />
						<span className="text-muted-foreground">Curva Plan (avance acumulado)</span>
					</div>
					<div className="flex items-center gap-2">
						<span className="h-2.5 w-2.5 rounded-full bg-[#ff5800]" />
						<span className="text-muted-foreground">PMC Resumen (avance fisico acumulado)</span>
					</div>
					<div className="flex items-center gap-2">
						<span className="h-0.5 w-3 bg-amber-500" />
						<span className="text-muted-foreground">Hoy (tiempo transcurrido)</span>
					</div>
					<div className="flex items-center gap-2">
						<span className="h-2.5 w-3 rounded-sm bg-[#ffedd5]" />
						<span className="text-muted-foreground">Mes sin certificados</span>
					</div>
				</div>
			</div>
		</div>
	);
}
