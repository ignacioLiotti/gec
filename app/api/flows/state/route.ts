import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { evaluate } from "@/lib/engine";
import type { FlowDefinition, FlowStepState } from "@/lib/engine";

function deriveActions(definition: FlowDefinition, steps: FlowStepState[]) {
	const statusById = new Map(steps.map((step) => [step.stepId, step.status]));
	const actions: string[] = [];
	const budgetStatus = statusById.get("budget_base");
	const measurementStatus = statusById.get("measurement");
	const certificateStatus = statusById.get("certificate");

	if (budgetStatus !== "done") actions.push("mark_budget_base");
	if (measurementStatus === "ready") actions.push("submit_measurement");
	if (certificateStatus === "ready") actions.push("generate_certificate");

	return actions;
}

export async function GET(request: NextRequest) {
	console.log("[api/flows/state] supabase url", process.env.NEXT_PUBLIC_SUPABASE_URL);
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { searchParams } = new URL(request.url);
	const obraId = searchParams.get("obraId");
	const period = searchParams.get("period");

	if (!obraId || !period) {
		return NextResponse.json(
			{ error: "obraId and period are required" },
			{ status: 400 },
		);
	}

	try {
		const flowState = await evaluate(obraId, period);
		const actions = deriveActions(flowState.definition, flowState.steps);
		return NextResponse.json({
			obraId,
			period: flowState.run?.period ?? period,
			definitionId: flowState.definition.id,
			steps: flowState.steps,
			actions,
			plannedJobs: flowState.plannedJobs,
		});
	} catch (error: any) {
		console.error("[api/flows/state]", error);
		return NextResponse.json(
			{ error: error?.message ?? "Failed to load flow state" },
			{ status: 500 },
		);
	}
}
