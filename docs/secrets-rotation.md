# Secrets Rotation Playbook

Multi-tenant deployments depend on four categories of secrets. Each one now supports versioned rotation with a grace period so you can roll out new credentials without downtime.

## 1. Resend API keys

Environment variables:

- `RESEND_API_KEY_VERSION` → currently active version number (e.g. `2`)
- `RESEND_API_KEY_V{N}` → value for each version (e.g. `RESEND_API_KEY_V2`)

Rotation steps:

1. Generate a new API key in the Resend dashboard.
2. Add it as `RESEND_API_KEY_V{next}` in your secrets store.
3. Update `RESEND_API_KEY_VERSION` to the new number.
4. Redeploy the app (the runtime reads the active version on boot).
5. Once email delivery is confirmed, remove the previous `RESEND_API_KEY_V{old}` entry.

All email helpers (`lib/email/*`) now resolve the active version transparently via `getVersionedSecret`.

## 2. OpenAI API keys

Follow the same pattern:

- Store each key under `OPENAI_API_KEY_V{N}`.
- Point `OPENAI_API_KEY_VERSION` at the active value.
- Redeploy to pick up the new key, then delete the retired version after validation.

## 3. Supabase service-role key

The server-side admin client (`utils/supabase/admin.ts`) now requires a versioned key:

- Populate `SUPABASE_SERVICE_ROLE_KEY_V{N}`.
- Set `SUPABASE_SERVICE_ROLE_KEY_VERSION` to the active version.

When rotating:

1. Create a new service-role key inside Supabase.
2. Add it as `SUPABASE_SERVICE_ROLE_KEY_V{next}`.
3. Update `_VERSION`, redeploy, and verify background jobs / admin routes.
4. Revoke the previous key.

If `_VERSION` is omitted the legacy `SUPABASE_SERVICE_ROLE_KEY` is still used, which keeps local development unblocked.

## 4. Tenant API signing secrets

Each tenant now owns versioned HMAC secrets stored in the new `tenant_api_secrets` table. Use the `/api/tenant-secrets` endpoints (authenticated admin only) to view metadata or rotate a secret. Rotation flow:

1. `POST /api/tenant-secrets` to insert the next version (optional `graceDays` enables dual-delivery).
2. Distribute the returned secret to the tenant’s automation services.
3. Update the clients to include the new version via the `X-Secret-Version` header.
4. After the grace period expires, the previous secret is automatically marked as `grace` and eventually `revoked`.

Signed requests must include:

```
X-Tenant-Id: <tenant uuid>
X-Request-Timestamp: <epoch ms>
X-Request-Signature: HMAC_SHA256(timestamp.body)
X-Secret-Version: <optional version, defaults to latest>
```

The server enforces a 5-minute replay window via `REQUEST_SIGNATURE_MAX_AGE_MS`.
