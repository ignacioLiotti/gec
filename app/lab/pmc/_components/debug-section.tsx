"use client";

import { useState } from "react";
import { Bug, ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { useFlowEvents, type FlowEvent } from "../_hooks/use-flow-events";
import type { FlowStateResponse } from "../_hooks/use-flow-state";

interface DebugSectionProps {
	obraId: string | null;
	flowState: FlowStateResponse | undefined;
	onRefresh: () => void;
}

function StepStatesDebug({ flowState }: { flowState: FlowStateResponse }) {
	const [expanded, setExpanded] = useState<Record<string, boolean>>({});

	return (
		<div className="space-y-2">
			<h4 className="text-sm font-medium">Step States</h4>
			{flowState.steps.map((step) => (
				<Collapsible
					key={step.stepId}
					open={expanded[step.stepId]}
					onOpenChange={(open) =>
						setExpanded((prev) => ({ ...prev, [step.stepId]: open }))
					}
				>
					<CollapsibleTrigger className="flex w-full items-center gap-2 rounded border px-3 py-2 text-sm hover:bg-muted/50">
						{expanded[step.stepId] ? (
							<ChevronDown className="h-3 w-3" />
						) : (
							<ChevronRight className="h-3 w-3" />
						)}
						<span className="font-mono">{step.stepId}</span>
						<span className="text-muted-foreground">({step.status})</span>
					</CollapsibleTrigger>
					<CollapsibleContent>
						<pre className="mt-1 overflow-auto rounded bg-muted/50 p-3 text-xs">
							{JSON.stringify(step, null, 2)}
						</pre>
					</CollapsibleContent>
				</Collapsible>
			))}
		</div>
	);
}

function PlannedJobsTable({ jobs }: { jobs: FlowStateResponse["plannedJobs"] }) {
	if (!jobs || jobs.length === 0) {
		return (
			<div>
				<h4 className="text-sm font-medium mb-2">Planned Jobs</h4>
				<p className="text-xs text-muted-foreground">No planned jobs.</p>
			</div>
		);
	}

	return (
		<div>
			<h4 className="text-sm font-medium mb-2">Planned Jobs</h4>
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Type</TableHead>
						<TableHead>Step ID</TableHead>
						<TableHead>Run ID</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{jobs.map((job, i) => (
						<TableRow key={i}>
							<TableCell className="font-mono text-xs">{job.type}</TableCell>
							<TableCell className="font-mono text-xs">{job.stepId}</TableCell>
							<TableCell className="font-mono text-xs truncate max-w-[200px]">
								{job.runId}
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}

function EventsTable({ events }: { events: FlowEvent[] }) {
	if (events.length === 0) {
		return (
			<div>
				<h4 className="text-sm font-medium mb-2">Events (last 10)</h4>
				<p className="text-xs text-muted-foreground">No events found.</p>
			</div>
		);
	}

	return (
		<div>
			<h4 className="text-sm font-medium mb-2">Events (last 10)</h4>
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Type</TableHead>
						<TableHead>Dedupe Key</TableHead>
						<TableHead>Created At</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{events.map((event, i) => (
						<TableRow key={i}>
							<TableCell className="font-mono text-xs">{event.type}</TableCell>
							<TableCell className="font-mono text-xs truncate max-w-[200px]">
								{event.dedupe_key ?? "—"}
							</TableCell>
							<TableCell className="text-xs">
								{event.created_at
									? new Date(event.created_at).toLocaleString()
									: "—"}
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}

export function DebugSection({ obraId, flowState, onRefresh }: DebugSectionProps) {
	const [open, setOpen] = useState(false);
	const { data: eventsData } = useFlowEvents(obraId);
	const events = eventsData?.events ?? [];

	return (
		<Collapsible open={open} onOpenChange={setOpen}>
			<CollapsibleTrigger asChild>
				<Button variant="ghost" className="gap-2">
					<Bug className="h-4 w-4" />
					Debug
					{open ? (
						<ChevronDown className="h-3 w-3" />
					) : (
						<ChevronRight className="h-3 w-3" />
					)}
				</Button>
			</CollapsibleTrigger>
			<CollapsibleContent>
				<Card className="mt-2">
					<CardHeader>
						<div className="flex items-center justify-between">
							<CardTitle className="text-base">Debug Panel</CardTitle>
							<div className="flex gap-2">
								<Button variant="outline" size="sm" onClick={onRefresh}>
									<RefreshCw className="mr-2 h-3 w-3" />
									Force evaluate
								</Button>
								<Button variant="outline" size="sm" disabled>
									Reset run
								</Button>
							</div>
						</div>
					</CardHeader>
					<CardContent className="space-y-6">
						{flowState && <StepStatesDebug flowState={flowState} />}
						{flowState && <PlannedJobsTable jobs={flowState.plannedJobs} />}
						<EventsTable events={events} />
					</CardContent>
				</Card>
			</CollapsibleContent>
		</Collapsible>
	);
}
