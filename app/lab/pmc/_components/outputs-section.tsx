"use client";

import { Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FlowStepData } from "../_hooks/use-flow-state";

interface OutputsSectionProps {
	steps: FlowStepData[];
}

export function OutputsSection({ steps }: OutputsSectionProps) {
	const certStep = steps.find((s) => s.stepId === "certificate");
	const outputs = certStep?.outputs as Record<string, unknown> | null | undefined;

	if (!outputs || Object.keys(outputs).length === 0) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="text-base">Artefactos generados</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-sm text-muted-foreground">
						No hay artefactos generados aun. Complete el flujo para generar el certificado.
					</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">Artefactos generados</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="space-y-2">
					{Object.entries(outputs).map(([key, value]) => (
						<div
							key={key}
							className="flex items-center justify-between rounded-lg border p-3"
						>
							<div className="flex items-center gap-3">
								<FileText className="h-5 w-5 text-muted-foreground" />
								<div>
									<p className="text-sm font-medium">{key}</p>
									<p className="text-xs text-muted-foreground">
										{typeof value === "string" ? value : JSON.stringify(value)}
									</p>
								</div>
							</div>
							<div className="flex items-center gap-2">
								<Badge variant="outline">output</Badge>
								{typeof value === "string" && value.startsWith("http") && (
									<Button variant="ghost" size="sm" asChild>
										<a href={value} target="_blank" rel="noopener noreferrer">
											<Download className="h-4 w-4" />
										</a>
									</Button>
								)}
							</div>
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}
