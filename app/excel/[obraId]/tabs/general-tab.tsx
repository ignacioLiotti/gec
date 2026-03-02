'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import type { ComponentType, ReactNode } from "react";
import { motion } from "framer-motion";
import {
	AlertCircle,
	AlertTriangle,
	BadgeDollarSign,
	Building2,
	Calendar,
	FileText,
	Hash,
	Landmark,
	LineChart as LineChartIcon,
	MapPin,
	Percent,
	Ruler,
	TrendingUp,
} from "lucide-react";
import {
	CartesianGrid,
	Line,
	LineChart,
	ReferenceLine,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";

import type { Obra } from "@/app/excel/schema";
import type { OcrTablaColumn } from "./file-manager/types";
import { QuickActionsPanel } from "@/components/quick-actions/quick-actions-panel";
import { TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { GlassyIcon } from "../../page";

type GeneralTabQuickActions = {
	obraId: string;
	quickActions: Array<{
		id: string;
		name: string;
		description?: string | null;
		folderPaths: string[];
	}>;
	folders: Array<{
		id: string;
		name: string;
		path: string;
		isOcr?: boolean;
		dataInputMethod?: "ocr" | "manual" | "both";
	}>;
	tablas: Array<{
		id: string;
		name: string;
		settings: Record<string, unknown>;
		columns: OcrTablaColumn[];
	}>;
	customStepRenderers?: Record<string, any>;
};

type ReportFinding = {
	id: string;
	rule_key: string;
	severity: "info" | "warn" | "critical";
	title: string;
	message: string | null;
	created_at: string;
};

type ReportCurvePoint = {
	label: string;
	planPct: number | null;
	realPct: number | null;
	sortOrder: number;
};

type GeneralTabReportsData = {
	findings: ReportFinding[];
	curve: {
		points: ReportCurvePoint[];
		planTableName: string;
		resumenTableName: string;
	} | null;
};

type GeneralTabProps = {
	form: any; // FormApi type requires 11-12 type arguments, using any for simplicity
	isGeneralTabEditMode: boolean;
	hasUnsavedChanges: () => boolean;
	isFieldDirty: (field: keyof Obra) => boolean;
	applyObraToForm: (obra: Obra) => void;
	initialFormValues: Obra;
	getErrorMessage: (errors: unknown) => string;
	quickActionsAllData?: GeneralTabQuickActions;
	reportsData?: GeneralTabReportsData;
};

const periodLabel = (period: string): string => {
	const [year, month] = period.split("-");
	const y = Number.parseInt(year, 10);
	const m = Number.parseInt(month, 10);
	if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return period;
	return new Date(y, m - 1, 1).toLocaleDateString("es-AR", {
		month: "short",
		year: "numeric",
	});
};

const CircularProgress = ({ value }: { value: number }) => {
	const clamped = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
	const radius = 80;
	const strokeWidth = 30;
	const circumference = 2 * Math.PI * radius;
	const offset = circumference - (clamped / 100) * circumference;

	return (
		<div className="relative mx-auto flex items-center justify-center h-full w-full">
			<svg
				width={(radius + strokeWidth) * 2}
				height={(radius + strokeWidth) * 2}
				viewBox={`0 0 ${(radius + strokeWidth) * 2} ${(radius + strokeWidth) * 2}`}
				className="drop-shadow-sm"
			>
				<circle
					className="text-muted/40 h-full w-full"
					stroke="currentColor"
					fill="transparent"
					strokeWidth={strokeWidth}
					r={radius}
					cx={radius + strokeWidth}
					cy={radius + strokeWidth}
				/>
				<motion.circle
					className="text-orange-primary/80 h-full w-full"
					stroke="currentColor"
					fill="transparent"
					strokeWidth={strokeWidth}
					strokeLinecap="round"
					r={radius}
					cx={radius + strokeWidth}
					cy={radius + strokeWidth}
					strokeDasharray={circumference}
					strokeDashoffset={offset}
					initial={{ strokeDashoffset: circumference }}
					animate={{ strokeDashoffset: offset }}
					transition={{ type: "spring", stiffness: 140, damping: 20 }}
				/>
			</svg>
			<div className="absolute flex flex-col items-center justify-center h-full w-full">
				<div className="text-4xl font-bold leading-none">
					{Number.isNaN(clamped) ? 0 : Math.round(clamped)}%
				</div>
				<div className="mt-1 text-xs text-muted-foreground">Completado</div>
			</div>
		</div>
	);
};

function ShellCard({
	title,
	icon: Icon,
	action,
	children,
	className,
	bodyClassName,
}: {
	title: string;
	icon: ComponentType<{ className?: string }>;
	action?: ReactNode;
	children: ReactNode;
	className?: string;
	bodyClassName?: string;
}) {
	return (
		<section
			className={cn(
				"overflow-hidden rounded-xl bg-white shadow-card",
				className
			)}
		>
			<header className="flex items-center justify-between gap-3 border-b border-[#f0f0f0] px-5 py-3.5">
				<div className="flex items-center gap-2.5">
					<GlassyIcon size={8} primaryVar="var(--color-orange-primary)" className="w-8">
						<Icon className={cn("size-4.5 text-primary", title === "Datos Financieros" && "size-5")} />
					</GlassyIcon>
					<h2 className="text-[18px] font-semibold text-[#1a1a1a]">{title}</h2>
				</div>
				{action}
			</header>
			<div className={cn("p-5", bodyClassName)}>{children}</div>
		</section>
	);
}

function KpiItem({ label, value }: { label: string; value: string }) {
	return (
		<div className="space-y-1">
			<p className="text-[11px] font-medium uppercase tracking-wide text-[#aaa]">{label}</p>
			<p className="text-xl font-semibold tabular-nums tracking-tight text-[#1a1a1a] sm:text-2xl">
				{value}
			</p>
		</div>
	);
}

function MiniField({
	icon: Icon,
	label,
	value,
	highlighted = false,
}: {
	icon: ComponentType<{ className?: string }>;
	label: string;
	value: string;
	highlighted?: boolean;
}) {
	return (
		<div
			className={cn(
				"rounded-lg border border-[#f0f0f0] p-3",
				highlighted && "border-[#f7b26a] bg-[#fff7ed]"
			)}
		>
			<div className="mb-1.5 flex items-center gap-1.5 text-[11px] text-[#aaa]">
				<Icon className="size-3.5" />
				<span>{label}</span>
			</div>
			<div className="text-[13px] font-medium leading-snug text-[#1a1a1a]">{value}</div>
		</div>
	);
}

const SURFACE_INPUT_CLASS =
	"h-10 rounded-lg border-[#e8e8e8] bg-white text-[#1a1a1a] shadow-[0_0_0_1px_#00000012,0_1px_0_0_#fff_inset] focus-visible:ring-2 focus-visible:ring-orange-200";

const formatNumber = (value: unknown, suffix = "") => {
	const num = Number(value ?? 0);
	const safe = Number.isFinite(num) ? num : 0;
	return `${safe.toLocaleString("es-AR")}${suffix}`;
};

const formatCurrency = (value: unknown) => `$ ${formatNumber(value)}`;

export const AdvanceCurveChart = ({
	points,
}: {
	points: ReportCurvePoint[];
}) => {
	if (points.length === 0) {
		return (
			<div className="rounded border border-dashed p-4 text-xs text-muted-foreground">
				No hay puntos de curva para graficar todavía.
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

	// Hold-last-value to keep continuous execution curve when a month has no value.
	const filledPoints = normalizedPoints.reduce<ReportCurvePoint[]>((acc, point, index) => {
		const prev = acc[index - 1];
		acc.push({
			...point,
			planPct: point.planPct ?? prev?.planPct ?? 0,
			realPct: point.realPct ?? prev?.realPct ?? 0,
		});
		return acc;
	}, []);

	const yMax = Math.max(
		100,
		...filledPoints.flatMap((point) => [point.planPct ?? 0, point.realPct ?? 0])
	);
	const chartData = filledPoints.map((point, index) => ({
		x: point.sortOrder,
		idx: index,
		label: point.label,
		planPct: point.planPct,
		realPct: point.realPct,
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

	return (
		<div className="space-y-2 pt-4 ">
			<div className="rounded-md border bg-stone-50 p-2">
				<div className="h-[320px] w-full pt-5 pb-2 px-3">
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
							<Tooltip
								formatter={(value: number, name: string) => [
									`${Number(value).toFixed(2)}%`,
									name === "planPct" ? "Curva Plan" : "PMC Resumen",
								]}
								labelFormatter={(value) => labelByX.get(Number(value)) ?? ""}
							/>
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
								connectNulls
								isAnimationActive={false}
							/>
							<Line
								type="monotone"
								dataKey="realPct"
								name="realPct"
								stroke="#ff5800"
								strokeWidth={2.5}
								dot={{ r: 3 }}
								connectNulls
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
						<span className="text-muted-foreground">PMC Resumen (avance físico acumulado)</span>
					</div>
					<div className="flex items-center gap-2">
						<span className="h-0.5 w-3 bg-amber-500" />
						<span className="text-muted-foreground">Hoy (tiempo transcurrido)</span>
					</div>
				</div>
			</div>
		</div>
	);
};

export function ObraGeneralTab({
	form,
	isGeneralTabEditMode,
	hasUnsavedChanges,
	isFieldDirty,
	applyObraToForm,
	initialFormValues,
	getErrorMessage,
	quickActionsAllData,
	reportsData,
}: GeneralTabProps) {
	return (
		<TabsContent value="general" className="space-y-6 pt-4">
			{isGeneralTabEditMode ? (
				<>
					<motion.form
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.4 }}
						className="space-y-5 rounded-2xl bg-[#f5f5f5] p-4 sm:p-5"
						onSubmit={(event) => {
							event.preventDefault();
							event.stopPropagation();
							form.handleSubmit();
						}}
					>
						<div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
							<motion.div
								initial={{ opacity: 0, scale: 0.95 }}
								animate={{ opacity: 1, scale: 1 }}
								transition={{ delay: 0.1 }}
								className="lg:col-span-4"
							>
								<ShellCard
									title="Avance"
									icon={Percent}
									action={
										<span className="text-[11px] font-semibold uppercase tracking-wide text-[#f97316]">
											Progreso
										</span>
									}
									className="h-full"
								>
									<form.Field name="porcentaje">
										{(field: any) => (
											<div className="flex h-full flex-col gap-4">
												<div className="mx-auto w-full max-w-[240px] sm:max-w-none">
													<CircularProgress value={Number(field.state.value) ?? 0} />
												</div>
												<div className="rounded-lg border border-[#f0f0f0] p-3">
													<p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[#aaa]">
														Editar avance
													</p>
													<Input
														type="number"
														step="0.01"
														value={field.state.value}
														onChange={(e) => field.handleChange(Number(e.target.value))}
														onBlur={field.handleBlur}
														className={cn(SURFACE_INPUT_CLASS, "text-right")}
													/>
													{getErrorMessage(field.state.meta.errors) && (
														<p className="mt-2 text-xs text-red-500">
															{getErrorMessage(field.state.meta.errors)}
														</p>
													)}
												</div>
											</div>
										)}
									</form.Field>
								</ShellCard>
							</motion.div>

							<motion.section
								initial={{ opacity: 0, y: 20 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ delay: 0.25 }}
								className="lg:col-span-8"
							>
								<ShellCard title="Información General" icon={Landmark} className="h-full">
									<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
										<form.Field name="designacionYUbicacion">
											{(field: any) => (
												<div className="sm:col-span-2">
													<label className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[#aaa]">
														<MapPin className="h-3.5 w-3.5" />
														Designación y ubicación
													</label>
													<Input
														type="text"
														value={field.state.value}
														onChange={(e) => field.handleChange(e.target.value)}
														onBlur={field.handleBlur}
														className={SURFACE_INPUT_CLASS}
														placeholder="Describe la ubicación y características principales de la obra..."
													/>
													{getErrorMessage(field.state.meta.errors) && (
														<p className="mt-2 text-xs text-red-500">
															{getErrorMessage(field.state.meta.errors)}
														</p>
													)}
												</div>
											)}
										</form.Field>
										<form.Field name="entidadContratante">
											{(field: any) => (
												<div>
													<label className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[#aaa]">
														<Building2 className="h-3.5 w-3.5" />
														Entidad contratante
													</label>
													<Input
														type="text"
														value={field.state.value}
														onChange={(e) => field.handleChange(e.target.value)}
														onBlur={field.handleBlur}
														className={SURFACE_INPUT_CLASS}
														placeholder="Nombre de la entidad"
													/>
												</div>
											)}
										</form.Field>
										<form.Field name="mesBasicoDeContrato">
											{(field: any) => (
												<div>
													<label className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[#aaa]">
														<Calendar className="h-3.5 w-3.5" />
														Mes básico
													</label>
													<Input
														type="text"
														value={field.state.value}
														onChange={(e) => field.handleChange(e.target.value)}
														onBlur={field.handleBlur}
														className={SURFACE_INPUT_CLASS}
													/>
												</div>
											)}
										</form.Field>
										<form.Field name="iniciacion">
											{(field: any) => (
												<div>
													<label className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[#aaa]">
														<Calendar className="h-3.5 w-3.5" />
														Iniciación
													</label>
													<Input
														type="text"
														value={field.state.value}
														onChange={(e) => field.handleChange(e.target.value)}
														onBlur={field.handleBlur}
														className={SURFACE_INPUT_CLASS}
													/>
												</div>
											)}
										</form.Field>
										<form.Field name="n">
											{(field: any) => (
												<div>
													<label className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[#aaa]">
														<Hash className="h-3.5 w-3.5" />
														N° de obra
													</label>
													<Input
														type="number"
														value={field.state.value}
														onChange={(e) => field.handleChange(Number(e.target.value))}
														onBlur={field.handleBlur}
														className={SURFACE_INPUT_CLASS}
													/>
												</div>
											)}
										</form.Field>
										<form.Field name="supDeObraM2">
											{(field: any) => (
												<div>
													<label className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[#aaa]">
														<Ruler className="h-3.5 w-3.5" />
														Superficie
													</label>
													<Input
														type="number"
														value={field.state.value}
														onChange={(e) => field.handleChange(Number(e.target.value))}
														onBlur={field.handleBlur}
														className={SURFACE_INPUT_CLASS}
													/>
												</div>
											)}
										</form.Field>
									</div>
								</ShellCard>
							</motion.section>
						</div>

						<motion.section
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.3 }}
						>
							<ShellCard title="Datos Financieros" icon={BadgeDollarSign}>
								<div className="space-y-5">
									<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
										<form.Field name="contratoMasAmpliaciones">
											{(field: any) => (
												<div>
													<label className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-[#aaa]">
														Contrato + ampliaciones
													</label>
													<Input
														type="number"
														value={field.state.value}
														onChange={(e) => field.handleChange(Number(e.target.value))}
														onBlur={field.handleBlur}
														className={cn(SURFACE_INPUT_CLASS, "text-right font-mono")}
														placeholder="0.00"
													/>
												</div>
											)}
										</form.Field>
										<form.Field name="certificadoALaFecha">
											{(field: any) => (
												<div>
													<label className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-[#aaa]">
														Certificado a la fecha
													</label>
													<Input
														type="number"
														value={field.state.value}
														onChange={(e) => field.handleChange(Number(e.target.value))}
														onBlur={field.handleBlur}
														className={cn(SURFACE_INPUT_CLASS, "text-right font-mono")}
														placeholder="0.00"
													/>
												</div>
											)}
										</form.Field>
										<form.Field name="saldoACertificar">
											{(field: any) => (
												<div>
													<label className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-[#aaa]">
														Saldo a certificar
													</label>
													<Input
														type="number"
														value={field.state.value}
														onChange={(e) => field.handleChange(Number(e.target.value))}
														onBlur={field.handleBlur}
														className={cn(SURFACE_INPUT_CLASS, "text-right font-mono")}
														placeholder="0.00"
													/>
												</div>
											)}
										</form.Field>
									</div>
									<div className="h-px bg-[#f0f0f0]" />
									<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
										<form.Field name="segunContrato">
											{(field: any) => (
												<div>
													<label className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-[#aaa]">
														Según contrato
													</label>
													<Input
														type="number"
														value={field.state.value}
														onChange={(e) => field.handleChange(Number(e.target.value))}
														onBlur={field.handleBlur}
														className={cn(SURFACE_INPUT_CLASS, "text-right")}
													/>
												</div>
											)}
										</form.Field>
										<form.Field name="prorrogasAcordadas">
											{(field: any) => (
												<div>
													<label className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-[#aaa]">
														Prórrogas
													</label>
													<Input
														type="number"
														value={field.state.value}
														onChange={(e) => field.handleChange(Number(e.target.value))}
														onBlur={field.handleBlur}
														className={cn(SURFACE_INPUT_CLASS, "text-right")}
													/>
												</div>
											)}
										</form.Field>
										<form.Field name="plazoTotal">
											{(field: any) => (
												<div>
													<label className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-[#aaa]">
														Plazo total
													</label>
													<Input
														type="number"
														value={field.state.value}
														onChange={(e) => field.handleChange(Number(e.target.value))}
														onBlur={field.handleBlur}
														className={cn(SURFACE_INPUT_CLASS, "text-right")}
													/>
												</div>
											)}
										</form.Field>
										<form.Field name="plazoTransc">
											{(field: any) => (
												<div>
													<label className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-[#aaa]">
														Transcurrido
													</label>
													<Input
														type="number"
														value={field.state.value}
														onChange={(e) => field.handleChange(Number(e.target.value))}
														onBlur={field.handleBlur}
														className={cn(SURFACE_INPUT_CLASS, "text-right")}
													/>
												</div>
											)}
										</form.Field>
									</div>
								</div>
							</ShellCard>
						</motion.section>
					</motion.form>
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ delay: 0.35 }}
						className="sticky bottom-0 left-0 z-10 flex w-full justify-end gap-3 rounded-xl border border-[#e8e8e8] bg-white/95 p-4 backdrop-blur"
					>
						<Button
							variant="outline"
							onClick={() => {
								applyObraToForm(initialFormValues);
							}}
						>
							Cancelar
						</Button>
						<form.Subscribe selector={(state: any) => [state.canSubmit, state.isSubmitting]}>
							{([canSubmit, isSubmitting]: [any, any]) => (
								<Button type="submit" disabled={!canSubmit} className="min-w-[140px]"
									onClick={(e) => {
										e.preventDefault();
										form.handleSubmit();
									}}
								>
									{isSubmitting ? "Guardando..." : "Guardar cambios"}
								</Button>
							)}
						</form.Subscribe>
					</motion.div>
				</>
			) : (
				<div className="space-y-5">
					<div className="flex flex-col lg:flex-row gap-4">
						<div className="flex-1 space-y-6 min-w-0">
							<div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
								<motion.div
									initial={{ opacity: 0, scale: 0.95 }}
									animate={{ opacity: 1, scale: 1 }}
									transition={{ delay: 0.1 }}
									className={cn(
										"lg:col-span-4",
										isFieldDirty("porcentaje") && "rounded-xl"
									)}
								>
									<ShellCard
										title="Avance"
										icon={Percent}
										className={cn(
											"h-full",
											isFieldDirty("porcentaje") && "border-[#f7b26a] bg-[#fffaf5]"
										)}
										action={
											isFieldDirty("porcentaje") ? (
												<span className="text-[11px] font-semibold text-[#f97316]">Sin guardar</span>
											) : (
												<span className="text-[11px] font-semibold uppercase tracking-wide text-[#f97316]">
													Progreso
												</span>
											)
										}
									>
										<div className="flex h-full flex-col items-center gap-4">
											<div className="mx-auto w-full max-w-[240px] sm:max-w-none">
												<CircularProgress value={form.state.values.porcentaje ?? 0} />
											</div>
											<div className="w-full rounded-lg border border-[#f0f0f0] p-3">
												<p className="text-[10px] font-semibold uppercase tracking-wide text-[#aaa]">
													Alertas detectadas
												</p>
												{(reportsData?.findings?.length ?? 0) === 0 ? (
													<p className="mt-1.5 text-[13px] text-[#999]">
														No hay alertas abiertas para esta obra.
													</p>
												) : (
													<div className="mt-2 space-y-2">
														{reportsData?.findings.slice(0, 4).map((finding) => {
															const tone =
																finding.severity === "critical"
																	? "border-red-200 bg-red-50 text-red-700"
																	: finding.severity === "warn"
																		? "border-amber-200 bg-amber-50 text-amber-700"
																		: "border-sky-200 bg-sky-50 text-sky-700";
															return (
																<div key={finding.id} className={cn("rounded-md border px-3 py-2", tone)}>
																	<div className="flex items-start gap-2">
																		<AlertTriangle className="mt-0.5 h-4 w-4" />
																		<div>
																			<p className="text-sm font-semibold">{finding.title}</p>
																			{finding.message ? (
																				<p className="mt-0.5 text-xs">{finding.message}</p>
																			) : null}
																		</div>
																	</div>
																</div>
															);
														})}
													</div>
												)}
											</div>
										</div>
									</ShellCard>
								</motion.div>

								<motion.section
									initial={{ opacity: 0, y: 20 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ delay: 0.25 }}
									className="lg:col-span-8"
								>
									<ShellCard
										title="Curva de avance"
										icon={LineChartIcon}
										bodyClassName="p-4"
										action={
											reportsData?.curve ? (
												<p className="text-[11px] text-[#bbb]">
													{reportsData.curve.planTableName} vs {reportsData.curve.resumenTableName}
												</p>
											) : undefined
										}
									>
										{reportsData?.curve ? (
											<AdvanceCurveChart points={reportsData.curve.points} />
										) : (
											<div className="flex h-[274px] flex-col rounded-lg border border-dashed border-[#e8e8e8] p-4">
												<div className="rounded-lg border border-[#f0f0f0] px-4 py-3 text-[13px] text-[#bbb]">
													No se detectaron tablas Curva Plan + PMC Resumen con datos suficientes.
												</div>
												<div className="mt-4 flex-1 rounded-lg bg-[linear-gradient(to_right,rgba(240,240,240,0.6)_1px,transparent_1px),linear-gradient(to_bottom,rgba(240,240,240,0.6)_1px,transparent_1px)] bg-[size:24px_24px]" />
											</div>
										)}
									</ShellCard>
								</motion.section>
							</div>

							<div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
								<motion.section
									initial={{ opacity: 0, y: 20 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ delay: 0.28 }}
									className="lg:col-span-6"
								>
									<ShellCard title="Información General" icon={Landmark}>
										<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
											<MiniField
												icon={MapPin}
												label="Designación y ubicación"
												value={form.state.values.designacionYUbicacion || "No especificado"}
												highlighted={isFieldDirty("designacionYUbicacion")}
											/>
											<MiniField
												icon={Building2}
												label="Entidad contratante"
												value={form.state.values.entidadContratante || "No especificado"}
												highlighted={isFieldDirty("entidadContratante")}
											/>
											<MiniField
												icon={Calendar}
												label="Mes básico"
												value={form.state.values.mesBasicoDeContrato || "No especificado"}
												highlighted={isFieldDirty("mesBasicoDeContrato")}
											/>
											<MiniField
												icon={Calendar}
												label="Iniciación"
												value={form.state.values.iniciacion || "No especificado"}
												highlighted={isFieldDirty("iniciacion")}
											/>
											<MiniField
												icon={Hash}
												label="N° de obra"
												value={`#${form.state.values.n ?? 0}`}
												highlighted={isFieldDirty("n")}
											/>
											<MiniField
												icon={Ruler}
												label="Superficie"
												value={`${formatNumber(form.state.values.supDeObraM2, " m²")}`}
												highlighted={isFieldDirty("supDeObraM2")}
											/>
										</div>
									</ShellCard>
								</motion.section>

								<motion.section
									initial={{ opacity: 0, y: 20 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ delay: 0.3 }}
									className="lg:col-span-6"
								>
									<ShellCard title="Datos Financieros" icon={BadgeDollarSign}>
										<div className="space-y-5">
											<div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
												<KpiItem
													label="Contrato + ampliaciones"
													value={formatCurrency(form.state.values.contratoMasAmpliaciones)}
												/>
												<KpiItem
													label="Certificado a la fecha"
													value={formatCurrency(form.state.values.certificadoALaFecha)}
												/>
												<KpiItem
													label="Saldo a certificar"
													value={formatCurrency(form.state.values.saldoACertificar)}
												/>
											</div>
											<div className="h-px bg-[#f0f0f0]" />
											<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
												<MiniField
													icon={FileText}
													label="Según contrato"
													value={`${formatNumber(form.state.values.segunContrato, " meses")}`}
													highlighted={isFieldDirty("segunContrato")}
												/>
												<MiniField
													icon={TrendingUp}
													label="Prórrogas"
													value={`${formatNumber(form.state.values.prorrogasAcordadas, " meses")}`}
													highlighted={isFieldDirty("prorrogasAcordadas")}
												/>
												<MiniField
													icon={Calendar}
													label="Plazo total"
													value={`${formatNumber(form.state.values.plazoTotal, " meses")}`}
													highlighted={isFieldDirty("plazoTotal")}
												/>
												<MiniField
													icon={Calendar}
													label="Transcurrido"
													value={`${formatNumber(form.state.values.plazoTransc, " meses")}`}
													highlighted={isFieldDirty("plazoTransc")}
												/>
											</div>
										</div>
									</ShellCard>
								</motion.section>
							</div>

							{hasUnsavedChanges() && (
								<motion.div
									initial={{ opacity: 0, y: 20 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ delay: 0.4 }}
									className="sticky bottom-0 left-0 z-10 flex flex-col items-end gap-3 rounded-xl border border-[#f7b26a] bg-[#fffaf5]/95 p-4 backdrop-blur"
								>
									<div className="flex items-center gap-2 text-orange-primary">
										<AlertCircle className="h-5 w-5" />
										<p className="text-sm font-semibold">Tenés cambios sin guardar</p>
									</div>
									<div className="flex gap-3 justify-end">
										<Button
											variant="outline"
											onClick={() => {
												applyObraToForm(initialFormValues);
											}}
										>
											Descartar cambios
										</Button>
										<form.Subscribe selector={(state: any) => [state.canSubmit, state.isSubmitting]}>
											{([canSubmit, isSubmitting]: [any, any]) => (
												<Button
													onClick={(e) => {
														e.preventDefault();
														form.handleSubmit();
													}}
													disabled={!canSubmit || isSubmitting}
													className="gap-2"
												>
													{isSubmitting ? (
														<>
															<svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
																<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
																<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
															</svg>
															Guardando...
														</>
													) : (
														<>
															<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>
															Guardar cambios
														</>
													)}
												</Button>
											)}
										</form.Subscribe>
									</div>
								</motion.div>
							)}
						</div>

						{quickActionsAllData && (
							<QuickActionsPanel
								obraId={quickActionsAllData.obraId}
								actions={quickActionsAllData.quickActions}
								folders={quickActionsAllData.folders}
								tablas={quickActionsAllData.tablas}
								customStepRenderers={quickActionsAllData.customStepRenderers}
							/>
						)}
					</div>
				</div>
			)}
		</TabsContent>
	);
}
