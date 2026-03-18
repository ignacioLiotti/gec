# Expenses & Usage Tracking

tags: #expenses #usage #ai-cost #billing

## Overview

The app tracks AI/LLM usage costs per tenant for billing and monitoring purposes. This enables transparent cost accounting and subscription plan enforcement.

---

## What's Tracked

Every AI call (OCR extraction) records:
- Which model was used (e.g., `claude-3-5-sonnet-20241022`)
- Input token count
- Output token count
- Estimated cost in USD
- Feature/use-case label
- Obra + tenant context

---

## AI Pricing (`lib/ai-pricing.ts`)

```typescript
// Pricing table per model
const MODEL_PRICING = {
  "claude-3-5-sonnet-20241022": {
    input: 3.00 / 1_000_000,   // $ per token
    output: 15.00 / 1_000_000,
  },
  // ... other models
}

function estimateCost(model, inputTokens, outputTokens): number {
  const pricing = MODEL_PRICING[model];
  return (inputTokens * pricing.input) + (outputTokens * pricing.output);
}
```

---

## Expense Records

`tenant_expenses` table:
```
id, tenant_id, obra_id
feature              — "ocr-tabla" | "ocr-materials" | "ai-eval"
model                — AI model used
input_tokens, output_tokens
cost_usd             — estimated cost
created_at
```

---

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/tenant-usage` | Usage summary for current tenant |
| GET | `/admin/expenses` | Admin view of expenses |
| GET | `/admin/expenses/all` | All tenant expenses (super-admin) |

---

## Expense UI

### `/admin/expenses`
`app/admin/expenses/page.tsx`

Shows for current tenant:
- Total AI spend this month
- Breakdown by feature (OCR vs materials)
- Per-obra breakdown
- Model usage distribution

### `/admin/expenses/all`
`app/admin/expenses/all/page.tsx`

Super-admin view across all tenants:
- `components/expenses/tenant-expense-table.tsx` — per-tenant summary
- `components/expenses/usage-event-log.tsx` — chronological event log

### Server Actions
`app/admin/expenses/all/actions.ts` — server-side data queries for expense reports.

---

## Subscription Plans (`lib/subscription-plans.ts`)

Defines plan tiers and limits:

```typescript
type SubscriptionPlan = {
  name: string;            // "starter" | "pro" | "enterprise"
  limits: {
    obras: number;         // max active obras
    ocr_calls_per_month: number;
    storage_gb: number;
  }
}
```

Plan is stored on the tenant record. Enforcement happens at API level before AI calls.

---

## Usage API (`/api/tenant-usage`)

Returns current usage vs plan limits:
```json
{
  "plan": "pro",
  "current_month": {
    "ocr_calls": 45,
    "total_cost_usd": 1.23,
    "obras_active": 12
  },
  "limits": {
    "ocr_calls_per_month": 500,
    "obras": 50
  }
}
```

---

## Related Notes

- [[18 - OCR Pipeline]]
- [[19 - Admin Panel]]
- [[01 - Architecture Overview]]
