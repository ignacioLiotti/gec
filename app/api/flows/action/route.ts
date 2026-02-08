import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { emitEvent, evaluate } from "@/lib/engine";

const allowedActions = new Set([
	"open_period",
	"mark_budget_base",
	"submit_measurement",
	"generate_certificate",
]);

export async function POST(request: NextRequest) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	let payload: any = null;
	try {
		payload = await request.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
	}

	const obraId = typeof payload?.obraId === "string" ? payload.obraId : null;
	const period = typeof payload?.period === "string" ? payload.period : null;
	const action = typeof payload?.action === "string" ? payload.action : null;
	const actionPayload = payload?.payload ?? null;

	if (!obraId || !period || !action) {
		return NextResponse.json(
			{ error: "obraId, period, and action are required" },
			{ status: 400 },
		);
	}

	if (!allowedActions.has(action)) {
		return NextResponse.json(
			{ error: "Unsupported action" },
			{ status: 400 },
		);
	}

	try {
		switch (action) {
			case "open_period":
				break;
			case "mark_budget_base":
				await emitEvent(obraId, {
					type: "budget_base.marked",
					period,
					payload: actionPayload,
				});
				break;
			case "submit_measurement":
				await emitEvent(obraId, {
					type: "measurement.submitted",
					period,
					payload: actionPayload,
				});
				break;
			case "generate_certificate":
				await emitEvent(obraId, {
					type: "certificate.generate.requested",
					period,
					payload: actionPayload,
				});
				break;
		}

		const flowState = await evaluate(obraId, period);
		return NextResponse.json({
			obraId,
			period: flowState.run?.period ?? period,
			definitionId: flowState.definition.id,
			steps: flowState.steps,
			plannedJobs: flowState.plannedJobs,
		});
	} catch (error: any) {
		console.error("[api/flows/action]", error);
		return NextResponse.json(
			{ error: error?.message ?? "Failed to execute action" },
			{ status: 500 },
		);
	}
}
