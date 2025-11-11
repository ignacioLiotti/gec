import { start } from "workflow/api";
import { deliverEffectsWorkflow } from "./workflows";
import { getUserEmailById } from "./recipients";

export type EventContext = {
	tenantId?: string | null;
	actorId?: string | null;
	[k: string]: any;
};

export type EffectDef = {
	channel: "in-app" | "email";
	when: "now" | Date | ((ctx: EventContext) => Date | "now");
	title?: (ctx: EventContext) => string;
	body?: (ctx: EventContext) => string | null | undefined;
	subject?: (ctx: EventContext) => string | null | undefined;
	html?: (ctx: EventContext) => string | null | undefined;
	actionUrl?: (ctx: EventContext) => string | null | undefined;
	data?: (ctx: EventContext) => any;
	type?: string; // in-app type
};

export type Rule = {
	recipients: (ctx: EventContext) => Promise<string[]>; // array of user_ids
	effects: EffectDef[];
};

const registry = new Map<string, Rule>();

export function defineRule(eventType: string, rule: Rule) {
	registry.set(eventType, rule);
}

export async function emitEvent(
	eventType: string,
	ctx: EventContext
): Promise<void> {
	const expandedEffects = await expandEffectsForEvent(eventType, ctx);
	if (!expandedEffects.length) return;
	await start(deliverEffectsWorkflow, [expandedEffects]);
}

export function getRegistryForDebug() {
	return registry;
}

export async function expandEffectsForEvent(
	eventType: string,
	ctx: EventContext
) {
	const rule = registry.get(eventType);
	if (!rule) return [] as any[];
	const recipientIds = await rule.recipients(ctx);
	if (!recipientIds.length) return [] as any[];
	const expanded = await Promise.all(
		recipientIds.map(async (userId) => ({
			userId,
			email: await getUserEmailById(userId),
		}))
	);
	const expandedEffects = [] as any[];
	for (const eff of rule.effects) {
		for (const r of expanded) {
			expandedEffects.push({
				...eff,
				ctx,
				recipientId: r.userId,
				recipientEmail: r.email,
			});
		}
	}
	return expandedEffects;
}
