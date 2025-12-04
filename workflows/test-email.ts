import { sleep } from "workflow";
import { sendSimpleEmailEdge } from "@/lib/workflow/email";

type TestEmailPayload = {
	to: string;
	subject?: string | null;
	message?: string | null;
	triggeredBy?: string | null;
};

async function deliverTestEmail(
	payload: TestEmailPayload,
	mode: "immediate" | "delayed"
) {
	const resolvedSubject =
		payload.subject?.trim() || `Workflow test (${mode}) - ${new Date().toISOString()}`;
	const resolvedMessage =
		payload.message?.trim() ||
		`This is a ${mode} workflow test email generated at ${new Date().toISOString()}.`;
	const triggeredBy = payload.triggeredBy
		? `<p style="margin-top:12px;font-size:12px;color:#555;">Trigger: ${payload.triggeredBy}</p>`
		: "";

	await sendSimpleEmailEdge({
		to: payload.to,
		subject: resolvedSubject,
		html: `<div style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.5;">
<p>${resolvedMessage}</p>
${triggeredBy}
</div>`,
	});
}

export async function sendImmediateTestEmailWorkflow(payload: TestEmailPayload) {
	"use workflow";
	console.info("[workflow/test-email] immediate workflow triggered", {
		to: payload.to,
		triggeredBy: payload.triggeredBy ?? null,
	});
	await deliverTestEmail(payload, "immediate");
}

export async function sendDelayedTestEmailWorkflow(payload: TestEmailPayload) {
	"use workflow";
	console.info("[workflow/test-email] delayed workflow scheduled", {
		to: payload.to,
		triggeredBy: payload.triggeredBy ?? null,
		delay: "5m",
	});
	await sleep("5m");
	await deliverTestEmail(payload, "delayed");
}
