"use client";

import { RefreshCw, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ObraCombobox } from "./obra-combobox";
import { PeriodInput } from "./period-input";
import type { FlowStateResponse } from "../_hooks/use-flow-state";

interface PmcHeaderProps {
	obraId: string | null;
	obraName: string | null;
	period: string;
	flowState: FlowStateResponse | undefined;
	isLoading: boolean;
	onSelectObra: (id: string, name: string) => void;
	onPeriodChange: (period: string) => void;
	onRefresh: () => void;
	onInitialize: () => void;
}

function RunBadge({ flowState }: { flowState: FlowStateResponse | undefined }) {
	if (!flowState) return null;

	const hasSteps = flowState.steps.length > 0;
	const hasDoneSteps = flowState.steps.some((s) => s.status === "done");

	if (hasSteps && (hasDoneSteps || flowState.steps.some((s) => s.status === "running"))) {
		return (
			<Badge className="bg-green-600 text-white">ACTIVE</Badge>
		);
	}

	return <Badge variant="secondary">NEW</Badge>;
}

export function PmcHeader({
	obraId,
	obraName,
	period,
	flowState,
	isLoading,
	onSelectObra,
	onPeriodChange,
	onRefresh,
	onInitialize,
}: PmcHeaderProps) {
	return (
		<Card>
			<CardContent className="pt-6">
				<div className="flex items-center justify-between mb-4">
					<h1 className="text-xl font-semibold">Lab: PMC Flow Playground</h1>
					<RunBadge flowState={flowState} />
				</div>
				<div className="grid gap-4 md:grid-cols-[1fr_200px_auto]">
					<div className="flex flex-col gap-1.5">
						<span className="text-sm font-medium">Obra</span>
						<ObraCombobox
							value={obraId}
							displayName={obraName}
							onSelect={onSelectObra}
						/>
					</div>
					<PeriodInput value={period} onChange={onPeriodChange} />
					<div className="flex items-end gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={onRefresh}
							disabled={!obraId || !period || isLoading}
						>
							<RefreshCw className="mr-2 h-4 w-4" />
							Refrescar estado
						</Button>
						{!flowState && (
							<Button
								size="sm"
								onClick={onInitialize}
								disabled={!obraId || !period || isLoading}
							>
								<Play className="mr-2 h-4 w-4" />
								Inicializar run
							</Button>
						)}
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
