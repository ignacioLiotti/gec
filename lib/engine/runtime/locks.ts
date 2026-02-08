import { randomUUID } from "crypto";
import type { DbClient } from "../adapters/db";
import { acquireFlowLock, releaseFlowLock } from "../adapters/db";

export async function withFlowLock<T>(
	supabase: DbClient,
	instanceId: string,
	fn: () => Promise<T>,
	options?: { ttlSeconds?: number },
): Promise<T> {
	const ttlSeconds = options?.ttlSeconds ?? 30;
	const lockToken = randomUUID();
	const acquired = await acquireFlowLock(
		supabase,
		instanceId,
		ttlSeconds,
		lockToken,
	);

	if (!acquired) {
		throw new Error("flow_lock_unavailable");
	}

	try {
		return await fn();
	} finally {
		await releaseFlowLock(supabase, instanceId, lockToken);
	}
}
