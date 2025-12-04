import { NextRequest, NextResponse } from "next/server";
import { start } from "workflow/api";
import { createClient } from "@/utils/supabase/server";
import {
	sendDelayedTestEmailWorkflow,
	sendImmediateTestEmailWorkflow,
} from "@/workflows/test-email";

type Variant = "immediate" | "delay";

function isFeatureEnabled() {
	return process.env.NODE_ENV !== "production";
}

export async function POST(request: NextRequest) {
	if (!isFeatureEnabled()) {
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	}

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

	const variant: Variant =
		payload?.variant === "delay" ? "delay" : "immediate";
	const subject =
		typeof payload?.subject === "string" ? payload.subject.trim() : "";
	const message =
		typeof payload?.message === "string" ? payload.message : "";
	const toCandidate =
		typeof payload?.recipient === "string"
			? payload.recipient.trim()
			: user.email ?? "";

	if (!toCandidate) {
		return NextResponse.json(
			{ error: "Recipient email is required" },
			{ status: 400 }
		);
	}

	try {
		const workflowPayload = {
			to: toCandidate,
			subject,
			message,
			triggeredBy: user.email ?? user.id,
		};
		const workflowFn =
			variant === "delay"
				? sendDelayedTestEmailWorkflow
				: sendImmediateTestEmailWorkflow;

		await start(workflowFn, [workflowPayload]);

		return NextResponse.json({
			success: true,
			variant,
		});
	} catch (error: any) {
		console.error("[api/workflow-test] failed to enqueue workflow", error);
		return NextResponse.json(
			{
				error: error?.message ?? "Failed to schedule workflow",
			},
			{ status: 500 }
		);
	}
}
