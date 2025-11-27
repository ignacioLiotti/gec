import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export type RatelimitResult = {
	success: boolean;
	limit: number;
	remaining: number;
	reset: number;
	reason?: string;
	pending?: Promise<unknown>;
};

const upstashRedisUrl = process.env.UPSTASH_REDIS_REST_URL;
const upstashRedisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

const redisClient =
	upstashRedisUrl && upstashRedisToken
		? new Redis({
				url: upstashRedisUrl,
				token: upstashRedisToken,
		  })
		: null;

const ipLimit = Number.parseInt(process.env.RATE_LIMIT_IP ?? "120", 10);
const ipWindow = (process.env.RATE_LIMIT_IP_WINDOW ?? "1m") as any;

const tenantLimit = Number.parseInt(process.env.RATE_LIMIT_TENANT ?? "2000", 10);
const tenantWindow = (process.env.RATE_LIMIT_TENANT_WINDOW ?? "5m") as any;

const ipLimiter =
	redisClient && ipLimit > 0
		? new Ratelimit({
				redis: redisClient,
				limiter: Ratelimit.slidingWindow(ipLimit, ipWindow),
				prefix: "mt:rate:ip",
		  })
		: null;

const tenantLimiter =
	redisClient && tenantLimit > 0
		? new Ratelimit({
				redis: redisClient,
				limiter: Ratelimit.slidingWindow(tenantLimit, tenantWindow),
				prefix: "mt:rate:tenant",
		  })
		: null;

function asResult(result: RatelimitResult | null): RatelimitResult {
	if (result) return result;
	return {
		success: true,
		limit: Number.MAX_SAFE_INTEGER,
		remaining: Number.MAX_SAFE_INTEGER,
		reset: Date.now() + 60 * 1000,
	};
}

export async function rateLimitByIp(
	identifier: string
): Promise<RatelimitResult> {
	if (!ipLimiter) {
		return asResult(null);
	}
	try {
		const res = await ipLimiter.limit(identifier);
		return {
			success: res.success,
			limit: res.limit,
			remaining: res.remaining,
			reset: res.reset,
			reason: res.reason,
			pending: res.pending,
		};
	} catch (error) {
		console.error("[rate-limit] ip limiter failed", error);
		return asResult(null);
	}
}

export async function rateLimitByTenant(
	tenantId: string,
	scope: string = "default"
): Promise<RatelimitResult> {
	if (!tenantLimiter) {
		return asResult(null);
	}
	if (!tenantId) {
		return asResult(null);
	}
	try {
		const res = await tenantLimiter.limit(`${tenantId}:${scope}`);
		return {
			success: res.success,
			limit: res.limit,
			remaining: res.remaining,
			reset: res.reset,
			reason: res.reason,
			pending: res.pending,
		};
	} catch (error) {
		console.error("[rate-limit] tenant limiter failed", error);
		return asResult(null);
	}
}

export function getClientIp(request: Request & { ip?: string | null }) {
	const headerIp =
		request.headers.get("x-forwarded-for") ||
		request.headers.get("x-real-ip") ||
		request.headers.get("cf-connecting-ip");
	if (headerIp) {
		const candidate = headerIp.split(",")[0]?.trim();
		if (candidate) return candidate;
	}
	if ("ip" in request && request.ip) {
		return request.ip;
	}
	return null;
}
