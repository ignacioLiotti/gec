# Usage Metering & Subscriptions

tags: #billing #usage #subscriptions #limits

## Overview

The app tracks AI token consumption, storage, and WhatsApp messages per tenant. A subscription plan system defines budgets, with per-tenant overrides possible. Budget enforcement can happen at the database level via a stored function.

---

## Architecture: Three Tiers

```
subscription_plans          ← Named plan with default limits
       ↓
tenant_subscriptions        ← Tenant assigned to a plan + per-tenant overrides
       ↓
tenant_api_expenses         ← Monthly aggregated consumption buckets
       ↓
tenant_usage_events         ← Granular event log (each AI call, upload, etc.)
```

---

## Table Schemas

### subscription_plans (migration 0065)
```sql
CREATE TABLE public.subscription_plans (
  plan_key TEXT PRIMARY KEY,  -- e.g. 'free', 'pro', 'enterprise'
  name TEXT,
  storage_limit_bytes BIGINT,       -- NULL = unlimited (after 0068)
  ai_token_budget BIGINT,           -- NULL = unlimited (after 0068)
  whatsapp_message_budget BIGINT    -- NULL = unlimited (after 0068)
);
```

> **Note:** Migration 0068 reset all limits to NULL. Budget enforcement is currently soft — limits are tracked but not enforced at the DB level unless explicitly set.

### tenant_subscriptions (migration 0065, 0069)
```sql
CREATE TABLE public.tenant_subscriptions (
  tenant_id UUID PRIMARY KEY REFERENCES tenants(id),
  plan_key TEXT NOT NULL REFERENCES subscription_plans(plan_key),
  status TEXT DEFAULT 'active',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,

  -- Per-tenant limit overrides (0069)
  storage_limit_bytes_override BIGINT,
  ai_token_budget_override BIGINT,
  whatsapp_message_budget_override BIGINT
);
```

Override columns take precedence over the plan defaults when set.

### tenant_api_expenses (migration 0064)
```sql
CREATE TABLE public.tenant_api_expenses (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  billing_period_start DATE,
  billing_period_end DATE,

  -- Consumption counters
  supabase_storage_bytes BIGINT DEFAULT 0,
  supabase_storage_limit_bytes BIGINT DEFAULT 0,
  ai_tokens_used BIGINT DEFAULT 0,
  ai_token_budget BIGINT DEFAULT 0,
  whatsapp_api_messages BIGINT DEFAULT 0,
  whatsapp_api_budget BIGINT DEFAULT 0,

  UNIQUE (tenant_id, billing_period_start, billing_period_end)
);
```

One row per tenant per billing period. Updated atomically via UPSERT.

### tenant_usage_events (migration 0067)
```sql
CREATE TABLE public.tenant_usage_events (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  kind TEXT CHECK (kind IN ('storage_bytes', 'ai_tokens', 'whatsapp_messages')),
  amount BIGINT NOT NULL,
  context TEXT,      -- e.g. 'ocr_tablas', 'materials_ocr', 'whatsapp_reply'
  metadata JSONB     -- AI model, file path, etc.
);
```

Granular log for debugging and billing disputes.

---

## Enforcement Function

`increment_tenant_api_usage()` handles both recording and limit enforcement:

```sql
CREATE FUNCTION public.increment_tenant_api_usage(
  p_tenant uuid,
  p_storage_delta bigint DEFAULT 0,
  p_ai_tokens_delta bigint DEFAULT 0,
  p_whatsapp_delta bigint DEFAULT 0,
  p_storage_limit bigint DEFAULT NULL,
  p_ai_token_limit bigint DEFAULT NULL,
  p_whatsapp_limit bigint DEFAULT NULL
) RETURNS public.tenant_api_expenses AS $$
BEGIN
  -- Atomic UPSERT into monthly bucket
  INSERT INTO tenant_api_expenses (tenant_id, ...)
    VALUES (p_tenant, ...)
  ON CONFLICT (tenant_id, period) DO UPDATE SET
    ai_tokens_used = tenant_api_expenses.ai_tokens_used + p_ai_tokens_delta,
    supabase_storage_bytes = tenant_api_expenses.supabase_storage_bytes + p_storage_delta,
    whatsapp_api_messages = tenant_api_expenses.whatsapp_api_messages + p_whatsapp_delta;

  -- Enforce limits (only if limit is non-null)
  IF p_ai_token_limit IS NOT NULL AND v_result.ai_tokens_used > p_ai_token_limit THEN
    RAISE EXCEPTION 'ai_token_limit_exceeded'
      USING HINT = 'Superaste el límite de tokens de IA para este período';
  END IF;

  RETURN v_result;
END; $$;
```

If limits are NULL (current state after 0068), the RAISE never fires — tracking happens but operations are never blocked.

---

## Usage Event Context Values

| context | Description |
|---------|-------------|
| `ocr_tablas` | GPT-4o-mini call for tabla OCR |
| `materials_ocr` | Gemini 2.5 Flash call for material orders |
| `whatsapp_reply` | WhatsApp Cloud API message sent |
| `pdf_export` | Puppeteer PDF rendering |

---

## get_tenant_usage() RPC (migration 0066)

Returns current period consumption for a tenant:

```sql
CREATE FUNCTION public.get_tenant_usage(p_tenant_id uuid)
RETURNS TABLE (
  storage_bytes BIGINT,
  ai_tokens BIGINT,
  whatsapp_messages BIGINT
) SECURITY DEFINER AS $$
BEGIN
  -- Aggregates current period from tenant_api_expenses
  -- + live storage count from storage.objects
END; $$;
```

Used by the admin panel to display current usage stats.

---

## AI Cost Estimates

Based on documented rates in `22 - Expenses & Usage Tracking.md`:

| Model | Use | Cost approx. |
|-------|-----|-------------|
| GPT-4o-mini | Tabla OCR | ~$0.00015 / call |
| Gemini 2.5 Flash | Materials OCR | ~$0.000075 / call |
| WhatsApp Cloud API | Outbound message | ~$0.005 / message |

---

## Admin Panel: Expenses View

`/admin/tenants/[id]` shows:
- Current billing period consumption
- Storage used vs limit
- AI tokens used vs budget
- WhatsApp messages sent
- Usage event log (last 50 events)

Superadmins can also manually adjust the override columns to give a tenant a higher limit without changing their plan.

---

## Current State

- **Budget tracking:** Active — all AI/storage/WhatsApp usage is recorded
- **Limit enforcement:** Soft — migration 0068 nullified plan limits; overrides can be set per-tenant
- **Billing integration:** Not implemented — no payment processor, no invoice generation
- **Alerts:** No automated alerts when approaching limits

---

## Related Notes

- [[18 - OCR Pipeline]]
- [[16 - WhatsApp Integration]]
- [[19 - Admin Panel]]
- [[22 - Expenses & Usage Tracking]]
- [[28 - Database Migrations]]
