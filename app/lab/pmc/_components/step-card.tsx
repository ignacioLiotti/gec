"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import type { FlowStepData } from "../_hooks/use-flow-state";

const stepMeta: Record<string, { label: string; description: string }> = {
	budget_base: {
		label: "Presupuesto Base",
		description: "Marcar que el presupuesto base esta cargado y aprobado",
	},
	measurement: {
		label: "Medicion",
		description: "Registrar la medicion del periodo con cantidades ejecutadas",
	},
	certificate: {
		label: "Certificado",
		description: "Generar el certificado de obra a partir de la medicion",
	},
};

const statusBadgeMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className?: string }> = {
	done: { label: "Completado", variant: "default", className: "bg-green-600" },
	ready: { label: "Listo", variant: "default", className: "bg-blue-600" },
	running: { label: "En proceso", variant: "default", className: "bg-amber-500" },
	blocked: { label: "Bloqueado", variant: "secondary" },
	failed: { label: "Error", variant: "destructive" },
};

interface StepCardProps {
	step: FlowStepData;
	actions: string[];
	onAction: (action: string, payload?: Record<string, unknown>) => void;
	onOpenMeasurement: () => void;
	obraId?: string | null;
}

export function StepCard({
	step,
	actions,
	onAction,
	onOpenMeasurement,
	obraId,
}: StepCardProps) {
	const meta = stepMeta[step.stepId] ?? {
		label: step.stepId,
		description: "",
	};
	const badge = statusBadgeMap[step.status] ?? statusBadgeMap.blocked;
	const reason =
		step.reason && typeof step.reason === "object"
			? (step.reason as Record<string, unknown>)
			: null;

	return (
		<Card>
			<CardHeader className="pb-3">
				<div className="flex items-center justify-between">
					<CardTitle className="text-base">{meta.label}</CardTitle>
					<Badge variant={badge.variant} className={badge.className}>
						{badge.label}
					</Badge>
				</div>
				<CardDescription>{meta.description}</CardDescription>
			</CardHeader>
			<CardContent>
				{step.status === "done" && step.outputs && (
					<p className="text-sm text-muted-foreground">
						Outputs registrados: {Object.keys(step.outputs).length} campos
					</p>
				)}

				{step.stepId === "budget_base" && step.status !== "done" && actions.includes("mark_budget_base") && (
					<div className="space-y-3">
						<Button
							size="sm"
							onClick={() => onAction("mark_budget_base")}
						>
							Marcar presupuesto base
						</Button>
						{reason?.type === "budget_missing" && (
							<div className="text-xs text-muted-foreground">
								No se encontro un presupuesto. Subi el documento en Documentos y ejecuta OCR.
								{obraId && (
									<div className="mt-2">
										<Button size="sm" variant="outline" asChild>
											<Link href={`/excel/${obraId}?tab=documentos`}>
												Ir a Documentos
											</Link>
										</Button>
									</div>
								)}
							</div>
						)}
						{reason?.type === "budget_ocr_pending" && (
							<div className="text-xs text-muted-foreground">
								Presupuesto cargado pero OCR pendiente. Procesa el documento para continuar.
								{obraId && (
									<div className="mt-2">
										<Button size="sm" variant="outline" asChild>
											<Link href={`/excel/${obraId}?tab=documentos`}>
												Ir a Documentos
											</Link>
										</Button>
									</div>
								)}
							</div>
						)}
					</div>
				)}

				{step.stepId === "measurement" && step.status === "ready" && (
					<div className="flex gap-2">
						<Button size="sm" onClick={onOpenMeasurement}>
							Crear medicion
						</Button>
						{actions.includes("submit_measurement") && (
							<Button
								size="sm"
								variant="outline"
								onClick={() => onAction("submit_measurement")}
							>
								Confirmar sin detalle
							</Button>
						)}
					</div>
				)}

				{step.stepId === "certificate" && step.status === "ready" && actions.includes("generate_certificate") && (
					<Button
						size="sm"
						onClick={() => onAction("generate_certificate")}
					>
						Generar certificado
					</Button>
				)}

				{step.status === "failed" && step.reason != null && (
					<div className="mt-2 rounded bg-red-50 p-2 text-xs text-red-700">
						{typeof step.reason === "string"
							? step.reason
							: JSON.stringify(step.reason, null, 2)}
					</div>
				)}

				{step.status === "running" && (
					<p className="text-sm text-amber-600 animate-pulse">
						Procesando...
					</p>
				)}
			</CardContent>
		</Card>
	);
}
