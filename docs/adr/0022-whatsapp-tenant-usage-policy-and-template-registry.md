# ADR 0022: WhatsApp Tenant Usage Policy And Template Registry

## Status

Accepted

## Context

WhatsApp has two different operating modes in this product:

- User-initiated service conversations, which are usually free inside the 24-hour customer-service window.
- Business-initiated templates, uploads, manual submissions, and recurring reminders, which need explicit guardrails because they can create tenant-specific cost or operational load.

The existing subscription model only had one aggregate `whatsapp_message_budget_override`. That is too coarse for a tenant target such as USD 20/month because a free service reply and a paid marketing template should not consume the same product budget.

## Decision

Add two tenant-scoped tables:

- `whatsapp_usage_policies`: stores WhatsApp-specific monthly budget and category limits. The default active policy targets USD 20/month with 400 utility templates, 0 marketing templates, 0 authentication templates, 300 file uploads, 2 GB WhatsApp storage, 300 data queries, 300 manual submissions, 25 recurring contacts, and one recurring reminder per contact per week.
- `whatsapp_templates`: stores the local registry of WhatsApp templates with category, language, status, body, variables, optional Meta template id, and optional binding to a `document_generation_templates` row.

Extend the WhatsApp operating model with:

- `whatsapp_chat_actions`: an explicit audit trail for what a user asked the bot to do and what the bot completed, failed, or left pending. This avoids inferring operational state from raw chat text.
- `whatsapp_recurring_assignments`: the scheduler configuration that connects contact, WhatsApp template, document template, obra, folder, result mode, and frequency.
- `whatsapp_recurring_runs`: future execution-level tracking for each scheduled outbound template and its inbound response/result.

The aggregate `tenant_subscriptions.whatsapp_message_budget_override` remains as a compatibility budget for existing usage enforcement, but `/admin/whatsapp` becomes the primary operational console for WhatsApp-specific quota configuration.

Recurring sends are executed by `/api/whatsapp/recurring/dispatch`, protected by `CRON_SECRET`. The first supported response path is a secure Sintesis form link embedded in the approved WhatsApp template variables. This avoids creating a new Meta Flow/template for every tenant-specific or order-specific data collection while preserving Meta's requirement that business-initiated conversations start from approved templates.

Add `whatsapp_flows` and `whatsapp_flow_runs` for tenant-scoped, Sintesis-hosted flow testing. Active flows can be exposed through a WhatsApp interactive list when an authorized contact sends a greeting/menu message. The selected flow creates a run and returns a signed Sintesis URL for the editable form. The local `meta_flow_id` field is reserved for future native Meta Flow publication/sync; the current implementation does not make Sintesis the source of truth for Meta-hosted Flow JSON.

## Consequences

- Admins can tune WhatsApp limits without changing the tenant's full subscription plan.
- The dashboard can show limits that map to real WhatsApp operations instead of a single ambiguous message counter.
- Template approval still happens in Meta. The local registry is not authoritative for Meta billing category or approval state until a sync is implemented.
- Sintesis-hosted flows can be changed immediately and tested with live WhatsApp contacts, but they open as signed web forms rather than native WhatsApp Flow screens.
- Future recurring jobs should read `whatsapp_usage_policies` before sending business-initiated templates.
- The admin history depends on webhook/job code writing `whatsapp_chat_actions`; until that is wired, the UI can show raw messages and uploads but not a complete "what the bot did" timeline.
- The scheduler is configurable in data and has a cron endpoint, but production still needs an external scheduler such as Vercel Cron, GitHub Actions, or another trusted caller to hit the endpoint with `x-cron-secret`.
- Meta template creation/approval remains outside this ADR. The local template name must match an approved Meta template until template-sync APIs are added.
