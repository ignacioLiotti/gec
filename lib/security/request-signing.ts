import crypto from "node:crypto";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";

const SIGNATURE_HEADER = "x-request-signature";
const TIMESTAMP_HEADER = "x-request-timestamp";
const TENANT_HEADER = "x-tenant-id";
const VERSION_HEADER = "x-secret-version";

const MAX_AGE_MS = Number.parseInt(
	process.env.REQUEST_SIGNATURE_MAX_AGE_MS ?? `${5 * 60 * 1000}`,
	10
);

const secretCache = new Map<
	string,
	{ secret: string; version: number; expiresAt: number }
>();

class RequestSignatureError extends Error {
	status: number;
	code: string;
	constructor(message: string, code: string = "invalid_signature", status = 401) {
		super(message);
		this.name = "RequestSignatureError";
		this.status = status;
		this.code = code;
	}
}

function timingSafeEqual(a: string, b: string) {
	const aBuf = Buffer.from(a, "utf8");
	const bBuf = Buffer.from(b, "utf8");
	if (aBuf.length !== bBuf.length) {
		return false;
	}
	return crypto.timingSafeEqual(aBuf, bBuf);
}

async function fetchTenantSecret(tenantId: string, version?: number) {
	const key = `${tenantId}:${version ?? "latest"}`;
	const now = Date.now();
	const cached = secretCache.get(key);
	if (cached && cached.expiresAt > now) {
		return cached;
	}

	const admin = createSupabaseAdminClient();
	const { data, error } = await admin.rpc("get_active_tenant_secret", {
		p_tenant_id: tenantId,
		p_version: version ?? null,
	});

	if (error) {
		throw new RequestSignatureError(
			`Failed to load tenant secret: ${error.message}`,
			"secret_lookup_failed",
			500
		);
	}

	const row = Array.isArray(data) ? data[0] : data;
	if (!row?.secret || !row?.version) {
		throw new RequestSignatureError(
			"No active signing secret configured for tenant",
			"secret_missing",
			403
		);
	}

	const entry = {
		secret: row.secret as string,
		version: Number(row.version),
		expiresAt: now + 60 * 1000,
	};
	secretCache.set(key, entry);
	return entry;
}

function assertFreshTimestamp(timestampHeader: string | null) {
	if (!timestampHeader) {
		throw new RequestSignatureError(
			`Missing ${TIMESTAMP_HEADER} header`,
			"missing_timestamp"
		);
	}

	const ts = Number(timestampHeader);
	if (!Number.isFinite(ts)) {
		throw new RequestSignatureError("Invalid request timestamp", "invalid_ts");
	}

	const now = Date.now();
	const skew = Math.abs(now - ts);
	if (skew > MAX_AGE_MS) {
		throw new RequestSignatureError(
			"Request timestamp outside allowable window",
			"expired",
			408
		);
	}

	return ts;
}

function coerceVersion(headerValue: string | null) {
	if (!headerValue) return undefined;
	const parsed = Number.parseInt(headerValue, 10);
	return Number.isFinite(parsed) ? parsed : undefined;
}

function buildPayload(timestamp: string, rawBody: string) {
	return `${timestamp}.${rawBody}`;
}

export type VerifiedSignedRequest<TBody = unknown> = {
	tenantId: string;
	secretVersion: number;
	rawBody: string;
	body: TBody;
};

export async function verifySignedJsonRequest<TBody = any>(
	request: Request
): Promise<VerifiedSignedRequest<TBody>> {
	const tenantId = request.headers.get(TENANT_HEADER);
	if (!tenantId) {
		throw new RequestSignatureError(
			`Missing ${TENANT_HEADER} header`,
			"missing_tenant"
		);
	}

	const signatureHeader = request.headers.get(SIGNATURE_HEADER);
	if (!signatureHeader) {
		throw new RequestSignatureError(
			`Missing ${SIGNATURE_HEADER} header`,
			"missing_signature"
		);
	}

	const timestampHeader = request.headers.get(TIMESTAMP_HEADER);
	const timestamp = assertFreshTimestamp(timestampHeader);
	const versionHeader = coerceVersion(request.headers.get(VERSION_HEADER));

	const rawBody = await request.text();
	const parsedBody = rawBody ? JSON.parse(rawBody) : {};

	const { secret, version } = await fetchTenantSecret(tenantId, versionHeader);
	const computed = crypto
		.createHmac("sha256", secret)
		.update(buildPayload(String(timestamp), rawBody))
		.digest("hex");

	if (!timingSafeEqual(computed, signatureHeader)) {
		throw new RequestSignatureError("Signature mismatch", "signature_mismatch");
	}

	return {
		tenantId,
		secretVersion: version,
		rawBody,
		body: parsedBody as TBody,
	};
}

export { RequestSignatureError };
