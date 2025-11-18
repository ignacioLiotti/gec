import { start } from "workflow/api";
import { deliverEffectsWorkflow } from "./workflows";
import { getUserEmailById, getUserIdsByRoleKey } from "./recipients";

export type EventContext = {
	tenantId?: string | null;
	actorId?: string | null;
	[k: string]: any;
};

export type EffectDef = {
	channel: "in-app" | "email";
	// When to deliver the effect. `null` means "no delay" / treat as "now".
	when:
		| "now"
		| Date
		| null
		| ((ctx: EventContext) => Date | "now" | null);
	title?: (ctx: EventContext) => string;
	body?: (ctx: EventContext) => string | null | undefined;
	subject?: (ctx: EventContext) => string | null | undefined;
	html?: (ctx: EventContext) => string | null | undefined;
	actionUrl?: (ctx: EventContext) => string | null | undefined;
	data?: (ctx: EventContext) => any;
	// In-app notification type. Can be a static string or derived from context.
	type?: string | ((ctx: EventContext) => string | null | undefined);
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

	let recipientIds = await rule.recipients(ctx);

	// Optional: allow rule recipients to encode "role:<roleKey>" for expansion
	// so a rule can target all users with a given role key in the tenant.
	const expandedRoleIds: string[] = [];
	const directUserIds: string[] = [];

	for (const id of recipientIds) {
		if (id.startsWith("role:")) {
			const roleKey = id.slice("role:".length);
			const byRole = await getUserIdsByRoleKey({
				roleKey,
				tenantId: ctx.tenantId ?? null,
			});
			expandedRoleIds.push(...byRole);
		} else {
			directUserIds.push(id);
		}
	}

	recipientIds = Array.from(new Set([...directUserIds, ...expandedRoleIds]));
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
