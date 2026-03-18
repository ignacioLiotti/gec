# API Secrets & Request Signing

tags: #security #hmac #api #webhooks #secrets

## Overview

External systems (Temporal workflow steps, WhatsApp webhooks) that call internal API endpoints must prove their identity via **HMAC-SHA256 request signing**. Tenants have versioned signing secrets stored in the database, supporting zero-downtime key rotation.

---

## Tenant API Secrets (migration 0045)

### Schema
```sql
CREATE TABLE public.tenant_api_secrets (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  version INT NOT NULL,
  secret TEXT NOT NULL,
  status TEXT CHECK (status IN ('pending', 'active', 'grace', 'revoked')),
  valid_from TIMESTAMPTZ,
  valid_to TIMESTAMPTZ,
  UNIQUE (tenant_id, version)
);
```

### Status Lifecycle
```
pending → active → grace → revoked
```

- **active** — currently valid key
- **grace** — old key still accepted during rotation window
- **revoked** — no longer accepted

### Key Rotation Function
```sql
CREATE FUNCTION public.rotate_tenant_api_secret(
  p_tenant_id UUID,
  p_new_secret TEXT DEFAULT encode(extensions.gen_random_bytes(32), 'hex'),
  p_grace_period INTERVAL DEFAULT INTERVAL '7 days'
) RETURNS public.tenant_api_secrets AS $$
BEGIN
  -- Move current active key to grace period
  UPDATE public.tenant_api_secrets
  SET status = 'grace', valid_to = now() + p_grace_period
  WHERE tenant_id = p_tenant_id AND status = 'active';

  -- Insert new active key with incremented version
  INSERT INTO public.tenant_api_secrets (tenant_id, version, secret, status)
  VALUES (p_tenant_id, next_version, p_new_secret, 'active')
  RETURNING *;
END; $$;
```

### Secret Lookup (accepts both active and grace)
```sql
CREATE FUNCTION public.get_active_tenant_secret(
  p_tenant_id UUID,
  p_version INT DEFAULT NULL
) RETURNS TABLE (version INT, secret TEXT, status TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT version, secret, status
  FROM tenant_api_secrets
  WHERE tenant_id = p_tenant_id
    AND (p_version IS NULL OR version = p_version)
    AND status IN ('active', 'grace')
  ORDER BY version DESC
  LIMIT 1;
END; $$;
```

This allows a client with the old key to keep working for 7 days after rotation.

---

## Environment Variable Versioning

In addition to database secrets, the `SUPABASE_SERVICE_ROLE_KEY` itself supports versioning via environment variables (no DB migration required):

```
SUPABASE_SERVICE_ROLE_KEY_VERSION=2
SUPABASE_SERVICE_ROLE_KEY_V1=<old_key>   ← still valid in grace period
SUPABASE_SERVICE_ROLE_KEY_V2=<new_key>   ← current active key
```

If `_VERSION` is not set, falls back to `SUPABASE_SERVICE_ROLE_KEY` directly.
Implemented in `lib/security/secrets.ts` → `requireVersionedSecret()`.

---

## Request Signing (HMAC-SHA256)

Inbound requests to `/api/notifications/emit` and similar endpoints are verified with HMAC signatures:

### Signing a Request
```typescript
// External system (e.g., Temporal step) signs the request:
const timestamp = Date.now().toString();
const payload = JSON.stringify(body);
const signature = hmacSHA256(secret, `${timestamp}.${payload}`);

headers['x-signature'] = `t=${timestamp},v1=${signature}`;
```

### Verification
```typescript
// lib/security/verify-request.ts
function verifyHmacSignature(req: Request, secret: string): boolean {
  const header = req.headers.get('x-signature');
  const { t: timestamp, v1: provided } = parseSignatureHeader(header);

  // Replay attack prevention
  const age = Date.now() - parseInt(timestamp);
  if (age > REQUEST_SIGNATURE_MAX_AGE_MS) return false;  // default 5 min

  const payload = await req.text();
  const expected = hmacSHA256(secret, `${timestamp}.${payload}`);
  return timingSafeEqual(expected, provided);
}
```

### Configuration
| Variable | Default | Notes |
|----------|---------|-------|
| `REQUEST_SIGNING_DISABLED` | `"0"` | Set to `"1"` to skip verification (dev only) |
| `REQUEST_SIGNATURE_MAX_AGE_MS` | `300000` (5 min) | Replay attack window |

---

## Rate Limiting (Upstash Redis)

All API routes are protected by sliding window rate limiting:

```typescript
// lib/rate-limit.ts
const rateLimiter = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(
    parseInt(RATE_LIMIT_IP ?? '120'),
    `${RATE_LIMIT_IP_WINDOW ?? 60000}ms`
  ),
});

// Per-request check
const { success, remaining } = await rateLimiter.limit(`ip:${ip}`);
if (!success) return new Response('Too Many Requests', { status: 429 });
```

### Limits
| Type | Env Var | Default |
|------|---------|---------|
| Per-IP | `RATE_LIMIT_IP` | 120 req/min |
| Per-IP window | `RATE_LIMIT_IP_WINDOW` | 60,000 ms |
| Per-tenant | `RATE_LIMIT_TENANT` | 2000 req |
| Per-tenant window | `RATE_LIMIT_TENANT_WINDOW` | 300,000 ms (5 min) |

If `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` are not set, rate limiting is **gracefully disabled** — requests pass through without limit checks.

---

## Cron Endpoint Protection

Scheduled jobs (`/api/jobs/run`, `/api/schedules/dispatch`, `/api/maintenance/orphans`) require:

```typescript
// x-cron-secret header must match CRON_SECRET env var
const cronSecret = req.headers.get('x-cron-secret');
if (cronSecret !== process.env.CRON_SECRET) {
  return new Response('Unauthorized', { status: 401 });
}
```

In development, `CRON_SECRET` can be unset — the check is skipped.

---

## Security Summary

| Threat | Mitigation |
|--------|-----------|
| Cross-tenant data access | RLS on every table |
| Replay attacks on webhooks | Timestamp + max age check (5 min window) |
| Key rotation downtime | Grace period (7 days) for old key |
| Brute-force API abuse | Sliding window rate limits (IP + tenant) |
| Cron endpoint abuse | `x-cron-secret` header required |
| Schema injection in SECURITY DEFINER functions | `SET search_path = public, pg_temp` |
| Superadmin demotion | DB trigger enforces owner role |

---

## Related Notes

- [[21 - Tenant Secrets & Security]]
- [[31 - RLS & Security Policies]]
- [[32 - Environment Variables & Config]]
- [[33 - Superadmin Implementation]]
- [[28 - Database Migrations]]
