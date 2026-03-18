# Environment Variables & Config

tags: #config #environment #deployment #secrets

## Required Variables

| Variable | Used in | What breaks without it |
|----------|---------|----------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | All clients | App won't boot |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser client | Auth fails |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin client, workflows | Background ops fail |

---

## Versioned Service Role Key

Supports rolling rotation without downtime:

```
SUPABASE_SERVICE_ROLE_KEY_VERSION=2    ← current version number
SUPABASE_SERVICE_ROLE_KEY_V1=<old>     ← still valid during grace period
SUPABASE_SERVICE_ROLE_KEY_V2=<new>     ← current active key
```

If `_VERSION` is not set, falls back to `SUPABASE_SERVICE_ROLE_KEY` directly.
(`lib/security/secrets.ts` — `requireVersionedSecret()`)

---

## Email

| Variable | Required | Notes |
|----------|----------|-------|
| `RESEND_API_KEY` | For email delivery | Logs warning if missing, email silently fails |
| `RESEND_FROM_EMAIL` | For email delivery | Sender address |
| `CONTACT_EMAIL` | Contact form | Recipient for `/api/contact` submissions |

---

## Autodesk Platform Services (APS)

| Variable | Required | Notes |
|----------|----------|-------|
| `APS_CLIENT_ID` | For 3D model viewer | APS API client ID |
| `APS_CLIENT_SECRET` | For 3D model viewer | APS API client secret |

---

## WhatsApp

| Variable | Required | Notes |
|----------|----------|-------|
| `WHATSAPP_VERIFY_TOKEN` | Webhook subscription | Challenge verification |
| `WHATSAPP_ACCESS_TOKEN` | Sending replies | Cloud API bearer token |
| `WHATSAPP_PHONE_NUMBER_ID` | Sending replies | Business phone ID |

---

## Security & Rate Limiting

| Variable | Default | Notes |
|----------|---------|-------|
| `CRON_SECRET` | None | Required in prod for `/api/jobs/run`, `/api/schedules/dispatch`, `/api/maintenance/orphans` |
| `REQUEST_SIGNING_DISABLED` | `"0"` | Set to `"1"` to skip HMAC verification on `/api/notifications/emit` |
| `REQUEST_SIGNATURE_MAX_AGE_MS` | `300000` (5 min) | Replay attack window |
| `RATE_LIMIT_IP` | `120` | Requests per IP window |
| `RATE_LIMIT_IP_WINDOW` | `60000` (1 min) | IP window in ms |
| `RATE_LIMIT_TENANT` | `2000` | Requests per tenant window |
| `RATE_LIMIT_TENANT_WINDOW` | `300000` (5 min) | Tenant window in ms |
| `UPSTASH_REDIS_REST_URL` | None | Required for rate limiting (gracefully disabled if missing) |
| `UPSTASH_REDIS_REST_TOKEN` | None | Required for rate limiting |

---

## Workflow Engine (Temporal.io)

| Variable | Default | Notes |
|----------|---------|-------|
| `WORKFLOWS_ENABLED` | auto | Force enable workflow system |
| `WORKFLOWS_DISABLED` | `false` | Force disable (fallback to direct DB inserts) |
| `WORKFLOW_TEST_ENABLED` | `false` | Enable `/api/workflow-test` endpoint |
| `WORKFLOW_TEST_DISABLED` | `false` | Disable test endpoint even if enabled |

**Fallback mode** (when workflows disabled):
- Notifications are inserted directly to DB instead of via Temporal workflow
- Scheduled notifications (future dates) are lost

---

## Domain Split (Optional)

| Variable | Notes |
|----------|-------|
| `NEXT_PUBLIC_ENABLE_DOMAIN_SPLIT` | `"true"` to enable marketing/app domain separation |
| `NEXT_PUBLIC_APP_HOST` | e.g. `app.sintesis.dev` |
| `NEXT_PUBLIC_MARKETING_HOST` | e.g. `sintesis.dev` |

---

## PDF Rendering

| Variable | Notes |
|----------|-------|
| `PUPPETEER_EXECUTABLE_PATH` | Custom Chrome path (auto-detected on Vercel via `@sparticuz/chromium`) |

---

## Observability

| Variable | Notes |
|----------|-------|
| `SENTRY_DSN` | Sentry error tracking DSN |
| `NEXT_PUBLIC_SENTRY_DSN` | Client-side Sentry DSN |

---

## Supabase Config (`supabase/config.toml`)

Local development configuration for Supabase CLI:
- Project ref, API port, DB port
- Storage configuration
- Auth providers (Google OAuth configured)
- Realtime enabled on `notifications` table

---

## Related Notes

- [[01 - Architecture Overview]]
- [[21 - Tenant Secrets & Security]]
- [[12 - Workflow & Flujo System]]
