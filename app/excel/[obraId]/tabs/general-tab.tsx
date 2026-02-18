'use client';

import type { FormApi } from "@tanstack/react-form";
import { motion } from "framer-motion";
import { AlertCircle, AlertTriangle, Building2, Calendar, DollarSign, FileText, LineChart, MapPin, Percent, TrendingUp } from "lucide-react";

import type { Obra } from "@/app/excel/schema";
import type { OcrTablaColumn } from "./file-manager/types";
import { QuickActionsPanel } from "@/components/quick-actions/quick-actions-panel";
import { TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

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
					className="text-orange-primary h-full w-full"
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

function buildSvgPath(
	points: ReportCurvePoint[],
	valueKey: "planPct" | "realPct",
	xForIndex: (index: number) => number,
	yForValue: (value: number) => number
) {
	let path = "";
	let started = false;
	points.forEach((point, index) => {
		const value = point[valueKey];
		if (value == null || !Number.isFinite(value)) {
			started = false;
			return;
		}
		const x = xForIndex(index);
		const y = yForValue(value);
		if (!started) {
			path += `M ${x} ${y}`;
			started = true;
		} else {
			path += ` L ${x} ${y}`;
		}
	});
	return path;
}

const AdvanceCurveChart = ({ points }: { points: ReportCurvePoint[] }) => {
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

	const chartWidth = 880;
	const chartHeight = 300;
	const margin = { top: 16, right: 16, bottom: 56, left: 44 };
	const plotWidth = chartWidth - margin.left - margin.right;
	const plotHeight = chartHeight - margin.top - margin.bottom;

	const yMax = Math.max(
		100,
		...filledPoints.flatMap((point) => [point.planPct ?? 0, point.realPct ?? 0])
	);
	const xForIndex = (index: number) =>
		margin.left + (filledPoints.length <= 1 ? 0 : (index / (filledPoints.length - 1)) * plotWidth);
	const yForValue = (value: number) =>
		margin.top + plotHeight - (Math.max(0, value) / yMax) * plotHeight;

	const planPath = buildSvgPath(filledPoints, "planPct", xForIndex, yForValue);
	const realPath = buildSvgPath(filledPoints, "realPct", xForIndex, yForValue);

	const yTicks = [0, 25, 50, 75, 100].filter((tick) => tick <= yMax || tick === 100);
	const labelStep = filledPoints.length > 12 ? Math.ceil(filledPoints.length / 12) : 1;

	return (
		<div className="space-y-2 pt-4">

			<div className="overflow-x-auto rounded-md border">
				<svg
					viewBox={`0 0 ${chartWidth} ${chartHeight}`}
					className="min-w-[760px] w-full h-[320px] bg-white"
					role="img"
					aria-label="Comparación de curva de avance"
				>
					{yTicks.map((tick) => {
						const y = yForValue(tick);
						return (
							<g key={`y-${tick}`}>
								<line x1={margin.left} y1={y} x2={margin.left + plotWidth} y2={y} stroke="currentColor" className="text-muted/40" />
								<text x={margin.left - 8} y={y + 4} textAnchor="end" className="fill-muted-foreground text-[11px]">
									{tick}%
								</text>
							</g>
						);
					})}

					{planPath ? <path d={planPath} fill="none" stroke="#0ea5e9" strokeWidth={2.5} /> : null}
					{realPath ? <path d={realPath} fill="none" stroke="#8b1e1e" strokeWidth={2.5} /> : null}

					{filledPoints.map((point, index) => {
						const x = xForIndex(index);
						return (
							<g key={`${point.label}-${index}`}>
								{point.planPct != null ? (
									<circle cx={x} cy={yForValue(point.planPct)} r={3} fill="#0ea5e9" />
								) : null}
								{point.realPct != null ? (
									<circle cx={x} cy={yForValue(point.realPct)} r={3} fill="#8b1e1e" />
								) : null}
								{index % labelStep === 0 || index === filledPoints.length - 1 ? (
									<text
										x={x}
										y={chartHeight - 18}
										textAnchor="middle"
										className="fill-muted-foreground text-[10px]"
									>
										{point.label}
									</text>
								) : null}
							</g>
						);
					})}
				</svg>
			</div>
			<div className="flex flex-wrap items-center gap-4 text-xs">
				<div className="flex items-center gap-2">
					<span className="h-2.5 w-2.5 rounded-full bg-sky-500" />
					<span className="text-muted-foreground">Curva Plan (avance acumulado)</span>
				</div>
				<div className="flex items-center gap-2">
					<span className="h-2.5 w-2.5 rounded-full bg-[#8b1e1e]" />
					<span className="text-muted-foreground">PMC Resumen (avance físico acumulado)</span>
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
		<TabsContent value="general" className="space-y-6 pt-0">
			{isGeneralTabEditMode ? (
				<>
					<motion.form
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.4 }}
						className="space-y-6"
						onSubmit={(event) => {
							event.preventDefault();
							event.stopPropagation();
							form.handleSubmit();
						}}
					>
						<div className="flex flex-col lg:grid lg:grid-cols-1 lg:grid-cols-3 gap-4">
							<motion.div
								initial={{ opacity: 0, scale: 0.95 }}
								animate={{ opacity: 1, scale: 1 }}
								transition={{ delay: 0.1 }}
								className="rounded-lg border bg-card p-4 sm:p-5 shadow-sm flex flex-col col-span-1 row-span-1"
							>
								<form.Field name="porcentaje">
									{(field: any) => (
										<>
											<div className="flex items-center justify-between gap-2 text-muted-foreground mb-4 ">
												<div className="flex items-center gap-2">
													<Percent className="h-4 w-4" />
													<span className="text-sm font-medium">Avance</span>
												</div>
												<span className="text-xs uppercase tracking-wide text-orange-primary">
													Progreso
												</span>
											</div>
											<div className="mx-auto w-full max-w-[240px] sm:max-w-none">
												<CircularProgress value={Number(field.state.value) ?? 0} />
											</div>
											<div className="mt-4">
												<Input
													type="number"
													step="0.01"
													value={field.state.value}
													onChange={(e) => field.handleChange(Number(e.target.value))}
													onBlur={field.handleBlur}
													className="text-right"
												/>
											</div>
											{getErrorMessage(field.state.meta.errors) && (
												<p className="mt-1 text-xs text-red-500">
													{getErrorMessage(field.state.meta.errors)}
												</p>
											)}
										</>
									)}
								</form.Field>
							</motion.div>

							<motion.section
								initial={{ opacity: 0, y: 20 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ delay: 0.25 }}
								className="rounded-lg border bg-card shadow-sm overflow-hidden col-span-2 row-span-1"
							>
								<div className="bg-muted/50 px-4 sm:px-6 py-4 border-b">
									<div className="flex items-center gap-2">
										<Building2 className="h-5 w-5 text-primary" />
										<h2 className="text-base sm:text-lg font-semibold">Información General</h2>
									</div>
								</div>
								<div className="p-4 sm:p-6 space-y-5 sm:space-y-6">
									<form.Field name="designacionYUbicacion">
										{(field: any) => (
											<div>
												<label className="flex items-center gap-2 text-sm font-medium mb-2">
													<MapPin className="h-4 w-4 text-muted-foreground" />
													Designación y ubicación
												</label>
												<Input
													type="text"
													value={field.state.value}
													onChange={(e) => field.handleChange(e.target.value)}
													onBlur={field.handleBlur}
													className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
													placeholder="Describe la ubicación y características principales de la obra..."
												/>
												{getErrorMessage(field.state.meta.errors) && (
													<p className="mt-1 text-xs text-red-500">
														{getErrorMessage(field.state.meta.errors)}
													</p>
												)}
											</div>
										)}
									</form.Field>

									<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
										<form.Field name="entidadContratante">
											{(field: any) => (
												<div>
													<label className="flex items-center gap-2 text-sm font-medium mb-2">
														<Building2 className="h-4 w-4 text-muted-foreground" />
														Entidad contratante
													</label>
													<Input
														type="text"
														value={field.state.value}
														onChange={(e) => field.handleChange(e.target.value)}
														onBlur={field.handleBlur}
														placeholder="Nombre de la entidad"
													/>
													{getErrorMessage(field.state.meta.errors) && (
														<p className="mt-1 text-xs text-red-500">
															{getErrorMessage(field.state.meta.errors)}
														</p>
													)}
												</div>
											)}
										</form.Field>

										<form.Field name="mesBasicoDeContrato">
											{(field: any) => (
												<div>
													<label className="flex items-center gap-2 text-sm font-medium mb-2">
														<Calendar className="h-4 w-4 text-muted-foreground" />
														Mes básico de contrato
													</label>
													<Input
														type="text"
														value={field.state.value}
														onChange={(e) => field.handleChange(e.target.value)}
														onBlur={field.handleBlur}
														placeholder="Ej: Enero 2024"
													/>
													{getErrorMessage(field.state.meta.errors) && (
														<p className="mt-1 text-xs text-red-500">
															{getErrorMessage(field.state.meta.errors)}
														</p>
													)}
												</div>
											)}
										</form.Field>

										<form.Field name="iniciacion">
											{(field: any) => (
												<div>
													<label className="flex items-center gap-2 text-sm font-medium mb-2">
														<Calendar className="h-4 w-4 text-muted-foreground" />
														Fecha de iniciación
													</label>
													<Input
														type="text"
														value={field.state.value}
														onChange={(e) => field.handleChange(e.target.value)}
														onBlur={field.handleBlur}
														placeholder="Ej: 01/01/2024"
													/>
													{getErrorMessage(field.state.meta.errors) && (
														<p className="mt-1 text-xs text-red-500">
															{getErrorMessage(field.state.meta.errors)}
														</p>
													)}
												</div>
											)}
										</form.Field>

										<form.Field name="n">
											{(field: any) => (
												<div>
													<label className="flex items-center gap-2 text-sm font-medium mb-2">
														<FileText className="h-4 w-4 text-muted-foreground" />
														N° de Obra
													</label>
													<Input
														type="number"
														value={field.state.value}
														onChange={(e) => field.handleChange(Number(e.target.value))}
														onBlur={field.handleBlur}
														placeholder="Número de obra"
													/>
													{getErrorMessage(field.state.meta.errors) && (
														<p className="mt-1 text-xs text-red-500">
															{getErrorMessage(field.state.meta.errors)}
														</p>
													)}
												</div>
											)}
										</form.Field>

										<form.Field name="supDeObraM2">
											{(field: any) => (
												<div>
													<label className="flex items-center gap-2 text-sm font-medium mb-2">
														<TrendingUp className="h-4 w-4 text-muted-foreground" />
														Superficie (m²)
													</label>
													<Input
														type="number"
														value={field.state.value}
														onChange={(e) => field.handleChange(Number(e.target.value))}
														onBlur={field.handleBlur}
														placeholder="Superficie en m²"
													/>
													{getErrorMessage(field.state.meta.errors) && (
														<p className="mt-1 text-xs text-red-500">
															{getErrorMessage(field.state.meta.errors)}
														</p>
													)}
												</div>
											)}
										</form.Field>
									</div>
								</div>
							</motion.section>
						</div>


						<motion.section
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.3 }}
							className="rounded-lg border bg-card shadow-sm overflow-hidden"
						>
							<div className="bg-muted/50 px-4 sm:px-6 py-4 border-b">
								<div className="flex items-center gap-2">
									<DollarSign className="h-5 w-5 text-primary" />
									<h2 className="text-base sm:text-lg font-semibold">Datos Financieros</h2>
								</div>
							</div>
							<div className="p-4 sm:p-6 space-y-4">
								<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
									<form.Field name="contratoMasAmpliaciones">
										{(field: any) => (
											<div>
												<label className="block text-sm font-medium text-muted-foreground mb-2">
													Contrato más ampliaciones
												</label>
												<div className="relative">
													<span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
														$
													</span>
													<Input
														type="number"
														value={field.state.value}
														onChange={(e) => field.handleChange(Number(e.target.value))}
														onBlur={field.handleBlur}
														className="text-right pl-8 font-mono"
														placeholder="0.00"
													/>
												</div>
											</div>
										)}
									</form.Field>

									<form.Field name="certificadoALaFecha">
										{(field: any) => (
											<div>
												<label className="block text-sm font-medium text-muted-foreground mb-2">
													Certificado a la fecha
												</label>
												<div className="relative">
													<span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
														$
													</span>
													<Input
														type="number"
														value={field.state.value}
														onChange={(e) => field.handleChange(Number(e.target.value))}
														onBlur={field.handleBlur}
														className="text-right pl-8 font-mono"
														placeholder="0.00"
													/>
												</div>
											</div>
										)}
									</form.Field>

									<form.Field name="saldoACertificar">
										{(field: any) => (
											<div>
												<label className="block text-sm font-medium text-muted-foreground mb-2">
													Saldo a certificar
												</label>
												<div className="relative">
													<span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
														$
													</span>
													<Input
														type="number"
														value={field.state.value}
														onChange={(e) => field.handleChange(Number(e.target.value))}
														onBlur={field.handleBlur}
														className="text-right pl-8 font-mono"
														placeholder="0.00"
													/>
												</div>
											</div>
										)}
									</form.Field>
								</div>

								<Separator />

								<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
									<form.Field name="segunContrato">
										{(field: any) => (
											<div>
												<label className="block text-sm font-medium text-muted-foreground mb-2">
													Según contrato
												</label>
												<div className="relative">
													<Input
														type="number"
														value={field.state.value}
														onChange={(e) => field.handleChange(Number(e.target.value))}
														onBlur={field.handleBlur}
														className="text-right pr-14"
														placeholder="0"
													/>
													<span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
														meses
													</span>
												</div>
											</div>
										)}
									</form.Field>

									<form.Field name="prorrogasAcordadas">
										{(field: any) => (
											<div>
												<label className="block text-sm font-medium text-muted-foreground mb-2">
													Prórrogas acordadas
												</label>
												<div className="relative">
													<Input
														type="number"
														value={field.state.value}
														onChange={(e) => field.handleChange(Number(e.target.value))}
														onBlur={field.handleBlur}
														className="text-right pr-14"
														placeholder="0"
													/>
													<span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
														meses
													</span>
												</div>
											</div>
										)}
									</form.Field>

									<form.Field name="plazoTotal">
										{(field: any) => (
											<div>
												<label className="block text-sm font-medium text-muted-foreground mb-2">
													Plazo total
												</label>
												<div className="relative">
													<Input
														type="number"
														value={field.state.value}
														onChange={(e) => field.handleChange(Number(e.target.value))}
														onBlur={field.handleBlur}
														className="text-right pr-14"
														placeholder="0"
													/>
													<span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
														meses
													</span>
												</div>
											</div>
										)}
									</form.Field>

									<form.Field name="plazoTransc">
										{(field: any) => (
											<div>
												<label className="block text-sm font-medium text-muted-foreground mb-2">
													Transcurrido
												</label>
												<div className="relative">
													<Input
														type="number"
														value={field.state.value}
														onChange={(e) => field.handleChange(Number(e.target.value))}
														onBlur={field.handleBlur}
														className="text-right pr-14"
														placeholder="0"
													/>
													<span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
														meses
													</span>
												</div>
											</div>
										)}
									</form.Field>
								</div>
							</div>
						</motion.section>
					</motion.form>
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ delay: 0.35 }}
						className="flex justify-end gap-3 p-4 sticky bottom-0 left-0 w-full"
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
				<div className="space-y-6">
					<div className="flex flex-col lg:flex-row gap-4">
						<div className="flex-1 space-y-6 min-w-0">
							<div className="flex flex-col lg:grid lg:grid-cols-1 lg:grid-cols-3 gap-4 lg:auto-rows-fr">
								<motion.div
									initial={{ opacity: 0, scale: 0.95 }}
									animate={{ opacity: 1, scale: 1 }}
									transition={{ delay: 0.1 }}
									className={cn(
										"rounded-lg border bg-card p-4  sm:p-5 sm:pt-0 shadow-sm flex flex-col col-span-1 row-span-1 transition-colors",
										isFieldDirty("porcentaje") && "bg-orange-primary/5 border-orange-primary/40 border-2"
									)}
								>
									<div className="flex items-center justify-between gap-2 text-muted-foreground bg-muted/50 h-full -mx-5 p-5 pb-4">
										<div className="flex items-center gap-2">
											<Percent className="h-4 w-4" />
											<span className="text-base sm:text-lg font-semibold text-foreground">Avance</span>
										</div>
										{isFieldDirty("porcentaje") ? (
											<span className="text-xs text-orange-primary font-semibold">
												• Sin guardar
											</span>
										) : (
											<span className="text-xs uppercase tracking-wide text-orange-primary">
												Progreso
											</span>
										)}
									</div>
									<div className="mx-auto w-full max-w-[240px] sm:max-w-none">
										<CircularProgress value={form.state.values.porcentaje ?? 0} />
									</div>
									<div>
										<p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
											Alertas detectadas
										</p>
										{(reportsData?.findings?.length ?? 0) === 0 ? (
											<p className="text-sm text-muted-foreground">
												No hay alertas abiertas para esta obra.
											</p>
										) : (
											<div className="space-y-2">
												{reportsData?.findings.slice(0, 6).map((finding) => {
													const tone =
														finding.severity === "critical"
															? "border-red-200 bg-red-50 text-red-700"
															: finding.severity === "warn"
																? "border-amber-200 bg-amber-50 text-amber-700"
																: "border-sky-200 bg-sky-50 text-sky-700";
													return (
														<div key={finding.id} className={cn("rounded-md border px-3 py-2", tone)}>
															<div className="flex items-start gap-2">
																<AlertTriangle className="h-4 w-4 mt-0.5" />
																<div>
																	<p className="text-sm font-semibold">{finding.title}</p>
																	{finding.message ? (
																		<p className="text-xs mt-0.5">{finding.message}</p>
																	) : null}
																</div>
															</div>
														</div>
													);
												})}
											</div>
										)}
									</div>
								</motion.div>

								<motion.section
									initial={{ opacity: 0, y: 20 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ delay: 0.25 }}
									className="rounded-lg border bg-card shadow-sm overflow-hidden col-span-2 row-span-1"
								>
									<div className="bg-muted/50 px-4 sm:px-6 py-4 border-b">
										<div className="flex items-center gap-2">
											<div className="flex flex-wrap items-center justify-between gap-2 w-full">
												<div className="flex items-center gap-2">

													<LineChart className="h-5 w-5 text-primary" />
													<h2 className="text-base sm:text-lg font-semibold">Curva de avance</h2>
												</div>
												{reportsData?.curve ? (
													<p className="text-xs text-muted-foreground">
														{reportsData.curve.planTableName} vs {reportsData.curve.resumenTableName}
													</p>
												) : null}
											</div>
										</div>
									</div>
									<div className="p-4 sm:pt-2 sm:p-6 space-y-5">
										<div className="space-y-2">
											{reportsData?.curve ? (
												<AdvanceCurveChart points={reportsData.curve.points} />
											) : (
												<div className="rounded border border-dashed p-4 text-sm text-muted-foreground">
													No se detectaron tablas Curva Plan + PMC Resumen con datos suficientes.
												</div>
											)}
										</div>
									</div>
								</motion.section>
							</div>

							<div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
								<motion.section
									initial={{ opacity: 0, y: 20 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ delay: 0.28 }}
									className="rounded-lg border bg-card shadow-sm overflow-hidden"
								>
									<div className="bg-muted/50 px-4 sm:px-6 py-4 border-b">
										<div className="flex items-center gap-2">
											<Building2 className="h-5 w-5 text-primary" />
											<h2 className="text-base sm:text-lg font-semibold">Información General</h2>
										</div>
									</div>
									<div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
										<div className="rounded border p-3">
											<p className="text-xs text-muted-foreground mb-1">Designación y ubicación</p>
											<p className="text-sm">{form.state.values.designacionYUbicacion || "No especificado"}</p>
										</div>
										<div className="rounded border p-3">
											<p className="text-xs text-muted-foreground mb-1">Entidad contratante</p>
											<p className="text-sm">{form.state.values.entidadContratante || "No especificado"}</p>
										</div>
										<div className="rounded border p-3">
											<p className="text-xs text-muted-foreground mb-1">Mes básico</p>
											<p className="text-sm">{form.state.values.mesBasicoDeContrato || "No especificado"}</p>
										</div>
										<div className="rounded border p-3">
											<p className="text-xs text-muted-foreground mb-1">Iniciación</p>
											<p className="text-sm">{form.state.values.iniciacion || "No especificado"}</p>
										</div>
										<div className="rounded border p-3">
											<p className="text-xs text-muted-foreground mb-1">N° de obra</p>
											<p className="text-sm">#{form.state.values.n}</p>
										</div>
										<div className="rounded border p-3">
											<p className="text-xs text-muted-foreground mb-1">Superficie</p>
											<p className="text-sm">{form.state.values.supDeObraM2.toLocaleString("es-AR")} m²</p>
										</div>
									</div>
								</motion.section>

								<motion.section
									initial={{ opacity: 0, y: 20 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ delay: 0.3 }}
									className="rounded-lg border bg-card shadow-sm overflow-hidden"
								>
									<div className="bg-muted/50 px-4 sm:px-6 py-4 border-b">
										<div className="flex items-center gap-2">
											<DollarSign className="h-5 w-5 text-primary" />
											<h2 className="text-base sm:text-lg font-semibold">Datos Financieros</h2>
										</div>
									</div>
									<div className="p-4 sm:p-6 space-y-4">
										<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
											<div
												className={cn(
													"px-3 lg:p-3  rounded-md transition-colors",
													isFieldDirty("contratoMasAmpliaciones") && "bg-orange-primary/5 border-2 border-orange-primary/40"
												)}
											>
												<label className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
													Contrato más ampliaciones
													{isFieldDirty("contratoMasAmpliaciones") && (
														<span className="text-xs text-orange-primary font-semibold ml-auto">• Sin guardar</span>
													)}
												</label>
												<p className="text-sm font-mono">
													$ {form.state.values.contratoMasAmpliaciones.toLocaleString("es-AR")}
												</p>
											</div>

											<div
												className={cn(
													"px-3 lg:p-3  rounded-md transition-colors",
													isFieldDirty("certificadoALaFecha") && "bg-orange-primary/5 border-2 border-orange-primary/40"
												)}
											>
												<label className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
													Certificado a la fecha
													{isFieldDirty("certificadoALaFecha") && (
														<span className="text-xs text-orange-primary font-semibold ml-auto">• Sin guardar</span>
													)}
												</label>
												<p className="text-sm font-mono">
													$ {form.state.values.certificadoALaFecha.toLocaleString("es-AR")}
												</p>
											</div>

											<div
												className={cn(
													"px-3 lg:p-3  rounded-md transition-colors",
													isFieldDirty("saldoACertificar") && "bg-orange-primary/5 border-2 border-orange-primary/40"
												)}
											>
												<label className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
													Saldo a certificar
													{isFieldDirty("saldoACertificar") && (
														<span className="text-xs text-orange-primary font-semibold ml-auto">• Sin guardar</span>
													)}
												</label>
												<p className="text-sm font-mono">
													$ {form.state.values.saldoACertificar.toLocaleString("es-AR")}
												</p>
											</div>
										</div>

										<Separator />

										<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
											<div
												className={cn(
													"px-3 lg:p-3  rounded-md transition-colors",
													isFieldDirty("segunContrato") && "bg-orange-primary/5 border-2 border-orange-primary/40"
												)}
											>
												<label className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
													Según contrato
													{isFieldDirty("segunContrato") && (
														<span className="text-xs text-orange-primary font-semibold ml-auto">• Sin guardar</span>
													)}
												</label>
												<p className="text-sm">
													{form.state.values.segunContrato} meses
												</p>
											</div>

											<div
												className={cn(
													"px-3 lg:p-3  rounded-md transition-colors",
													isFieldDirty("prorrogasAcordadas") && "bg-orange-primary/5 border-2 border-orange-primary/40"
												)}
											>
												<label className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
													Prórrogas acordadas
													{isFieldDirty("prorrogasAcordadas") && (
														<span className="text-xs text-orange-primary font-semibold ml-auto">• Sin guardar</span>
													)}
												</label>
												<p className="text-sm">
													{form.state.values.prorrogasAcordadas} meses
												</p>
											</div>

											<div
												className={cn(
													"px-3 lg:p-3  rounded-md transition-colors",
													isFieldDirty("plazoTotal") && "bg-orange-primary/5 border-2 border-orange-primary/40"
												)}
											>
												<label className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
													Plazo total
													{isFieldDirty("plazoTotal") && (
														<span className="text-xs text-orange-primary font-semibold ml-auto">• Sin guardar</span>
													)}
												</label>
												<p className="text-sm">
													{form.state.values.plazoTotal} meses
												</p>
											</div>

											<div
												className={cn(
													"px-3 lg:p-3  rounded-md transition-colors",
													isFieldDirty("plazoTransc") && "bg-orange-primary/5 border-2 border-orange-primary/40"
												)}
											>
												<label className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
													Transcurrido
													{isFieldDirty("plazoTransc") && (
														<span className="text-xs text-orange-primary font-semibold ml-auto">• Sin guardar</span>
													)}
												</label>
												<p className="text-sm">
													{form.state.values.plazoTransc} meses
												</p>
											</div>
										</div>
									</div>
								</motion.section>
							</div>

							{hasUnsavedChanges() && (
								<motion.div
									initial={{ opacity: 0, y: 20 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ delay: 0.4 }}
									className="flex justify-center flex-col items-end gap-3 p-4 sticky bottom-0 left-0"
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
