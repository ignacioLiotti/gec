import { sleep } from "workflow";
import { sendObraCompletionEmail } from "@/lib/email/obras-simple";

type CompletedObra = {
	id?: string;
	name: string;
	percentage: number;
};

type WorkflowParams = {
	to: string;
	recipientName?: string | null;
	obra: CompletedObra;
	subject?: string;
	firstMessage?: string | null;
	secondMessage?: string | null;
	followUpSendAt?: string | null;
};

export async function sendObraCompletionWorkflow(params: WorkflowParams) {
	"use workflow";

	await sendInitialEmail(params);
	await waitForFollowUp(params.followUpSendAt);
	await sendFollowUpEmail(params);

	return { success: true };
}

async function sendInitialEmail(params: WorkflowParams) {
	"use step";
	await sendObraCompletionEmail({
		to: params.to,
		recipientName: params.recipientName,
		obras: [params.obra],
		subject: params.subject,
		introMessage: params.firstMessage ?? undefined,
	});
}

async function waitForFollowUp(targetIso?: string | null) {
	if (!targetIso) {
		await sleep("2m");
		return;
	}

	const target = new Date(targetIso);
	if (Number.isNaN(target.getTime())) {
		await sleep("2m");
		return;
	}

	if (target.getTime() <= Date.now()) {
		await sleep("2m");
		return;
	}

	await sleep(target);
}

async function sendFollowUpEmail(params: WorkflowParams) {
	"use step";
	await sendObraCompletionEmail({
		to: params.to,
		recipientName: params.recipientName,
		obras: [params.obra],
		subject: params.subject,
		introMessage:
			params.secondMessage ??
			"Recordatorio: esta obra fue completada recientemente.",
	});
}
