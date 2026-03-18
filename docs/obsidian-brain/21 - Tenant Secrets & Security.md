# Tenant Secrets & Security

tags: #security #secrets #rate-limiting #signing

## Tenant Secrets

Tenants can store encrypted secrets for use with external webhook integrations.

**Managed at:** `/admin/tenant-secrets`
**Component:** `app/admin/tenant-secrets/tenant-secrets-panel.tsx`
**API:** `GET/POST /api/tenant-secrets`

**Use cases:**
- WhatsApp webhook verification
- External notification emitters
- Third-party integrations

**Storage:** `lib/security/secrets.ts` — encrypts before DB storage, decrypts on read.

---

## Request Signing (`lib/security/request-signing.ts`)

Incoming webhooks from external systems must be signed:

```
External system sends:
  POST /api/notifications/emit
  Headers:
    X-Tenant-Id: {tenantId}
    X-Timestamp: {unix-timestamp}
    X-Signature: {hmac-sha256 of body+timestamp}
```

**Verification:**
1. Load tenant secret from DB (decrypt)
2. Compute expected HMAC-SHA256 signature
3. Compare with `X-Signature` header
4. Check timestamp within acceptable window (prevents replay attacks)

---

## Rate Limiting (`lib/security/rate-limit.ts`)

Applied to sensitive API endpoints:

```typescript
type RateLimitConfig = {
  windowMs: number;    // time window
  maxRequests: number; // max requests in window
  keyFn: (req) => string;  // how to identify caller (IP, userId, tenantId)
}
```

Applied to:
- `/api/notifications/emit` — prevent notification spam
- `/api/ocr-*` — control AI spend
- `/api/auth/*` — brute force protection

Uses in-memory store (suitable for single-instance) or Supabase for distributed.

---

## Row Level Security (RLS)

Every Supabase table has RLS policies:

```sql
-- Example: obras table
CREATE POLICY "tenant_isolation" ON obras
  FOR ALL
  USING (
    tenant_id = (
      SELECT tenant_id FROM tenant_memberships
      WHERE user_id = auth.uid()
      AND tenant_id = obras.tenant_id
    )
  );
```

The `createAdminClient()` (service role) bypasses RLS — used only in trusted server contexts.

---

## Proxy / Middleware (`proxy.ts`)

The main middleware layer:

1. Checks Supabase auth session
2. Resolves tenant context
3. Enforces route access (ROUTE_ACCESS_CONFIG)
4. CSP headers
5. CSRF protection
6. Domain redirect guard

---

## Sentry Integration

`sentry.client.config.ts` — browser error tracking
`sentry.server.config.ts` — server error tracking
`sentry.edge.config.ts` — edge runtime error tracking
`instrumentation.ts` — OpenTelemetry instrumentation
`instrumentation-client.ts` — client-side instrumentation

---

## Maintenance

`GET /api/maintenance/orphans` — finds and reports orphaned DB records (rows without parent, files without DB entries).

---

## Related Notes

- [[02 - Multi-Tenancy & Auth]]
- [[13 - Notifications Engine]]
- [[16 - WhatsApp Integration]]
- [[19 - Admin Panel]]
