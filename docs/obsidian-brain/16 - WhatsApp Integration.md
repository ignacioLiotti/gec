# WhatsApp Integration

tags: #whatsapp #integration #webhook #messaging

## Overview

The app uses WhatsApp as an operational capture channel for field contacts. Authorized contacts can send files to obra document folders, submit structured manual data, and eventually query controlled obra data without logging into the web app.

The supported baseline is direct 1:1 WhatsApp Business Platform messaging. Group mention flows are intentionally outside the initial contract.

---

## Webhook

`POST /api/whatsapp/webhook`

Receives incoming WhatsApp Cloud API webhook messages.

**Security and tenant scope:**
- `GET` verifies the Meta webhook challenge with `WHATSAPP_VERIFY_TOKEN`.
- `POST` verifies `x-hub-signature-256` when `WHATSAPP_APP_SECRET` is configured.
- Incoming messages resolve tenant by `phone_number_id` in `whatsapp_business_accounts`.
- Mutations require an active `whatsapp_contacts` row for the sender.
- Webhook processing is idempotent by WhatsApp `wamid`.

---

## Current Implementation

The webhook supports media upload commands:

```text
obra [NAME or NUMBER] carpeta [FOLDER_NAME]
carpeta [FOLDER_NAME] de la obra [NAME or NUMBER]
```

Then the user attaches a file, photo, video, or audio media object.

### Processing Flow

```text
WhatsApp Cloud API -> POST /api/whatsapp/webhook
  -> verify optional Meta signature
  -> resolve tenant account by phone_number_id
  -> resolve authorized contact by from phone
  -> store inbound whatsapp_messages audit row
  -> parse obra/folder instruction
  -> resolve obra inside tenant and contact scope
  -> resolve regular or extraction folder candidates
  -> create pending selection when ambiguous
  -> download media from Graph API
  -> upload to obra-documents/{obraId}/{folderPath}/{filename}
  -> track usage and whatsapp_document_uploads
  -> reply with confirmation or permission/error guidance
```

### Admin Surface

`/admin/whatsapp`

The panel is an operational console, not only a raw settings form. It shows:
- Channel activation status and missing production requirements.
- Monthly WhatsApp usage policy and consumption against the USD budget target.
- Current Meta account metadata and provider.
- Authorized contacts, permissions, and obra scope.
- Recent chat threads grouped by authorized contact/phone, plus bot action outcomes.
- WhatsApp template registry for recurrent forms and business-initiated messages.
- Document-generation bindings so a WhatsApp template can target a `document_generation_templates` row, document type, folder path, and result mode.
- Recurring assignments that connect contact + WhatsApp template + obra + folder + frequency.
- Manual form definitions for on-demand or recurring capture.
- Recent inbound messages, WhatsApp-originated uploads, and manual submissions waiting for validation/review.

The activation checklist intentionally keeps `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET`, webhook readiness, authorized contacts, and active forms visible because failures in those items are the most likely reason the bot can receive but not process or respond correctly.

### Manual Data Capture

Manual or mixed extraction folders can be exposed as WhatsApp manual forms. Form answers are stored as `whatsapp_manual_submissions`, validated against `obra_tabla_columns`, and then applied to `obra_tabla_rows` with:

```text
source = whatsapp
lineage_row_key = whatsapp:{submissionId}
```

For production forms, WhatsApp Flows should provide typed fields such as date, number, boolean/select, and text. Scheduled forms should use approved WhatsApp templates to initiate the conversation.

### Template And Assignment Model

The WhatsApp admin UI separates Meta message templates from Sintesis document templates:

```text
whatsapp_templates
  -> optional document_generation_template_id
  -> document_type
  -> target_folder_path
  -> result_mode: manual_submission | generate_document | upload_request | review_only
  -> field_mapping
```

Recurring sends are configured through `whatsapp_recurring_assignments`:

```text
contact_id
whatsapp_template_id
document_generation_template_id
obra_id
folder_path
frequency / weekday / time_of_day / timezone
result_mode
```

Each run can later be tracked in `whatsapp_recurring_runs`. Bot-visible operations are written to `whatsapp_chat_actions` for the current upload and manual form flows so the admin history can show what the user asked, what the bot understood, and what file/document/submission was created or why it failed.

### Recurring Dispatch

`GET|POST /api/whatsapp/recurring/dispatch`

Runs due `whatsapp_recurring_assignments` and sends the configured approved Meta template. The endpoint is protected with `x-cron-secret: CRON_SECRET`, matching the existing cron routes. For each assignment it:

```text
create whatsapp_recurring_runs row
build secure /whatsapp/respond/{runId}?token=... URL
send WhatsApp template with configured variables
write outbound whatsapp_messages row
write pending whatsapp_chat_actions row
advance assignment.next_run_at
```

The secure response page renders fields from the linked `document_generation_templates.schema.fields` when available. If no document template is linked, it falls back to a simple received/comment form. Submissions are saved as `whatsapp_manual_submissions` and linked back to the pending chat action.

### Sintesis Flow Editor And Test Menu

Admins can define tenant-scoped test flows in `/admin/whatsapp?tab=flows`.

```text
whatsapp_flows
  -> name / slug / description
  -> status: draft | active | paused | archived
  -> flow_type: data_entry | boolean_checklist | review | selection | upload_request
  -> optional meta_flow_id
  -> definition.fields[]
```

When an authorized contact sends `hola`, `menu`, `flow`, or `flows`, the webhook sends a WhatsApp interactive list with up to three active flows. Selecting one creates a `whatsapp_flow_runs` row, writes a pending `whatsapp_chat_actions` row, and replies with a secure `/whatsapp/flow/{runId}?token=...` URL. The response page is rendered from `whatsapp_flows.definition.fields` and saves the answer as a `whatsapp_manual_submissions` row linked back to the flow run and chat action.

This is intentionally a Sintesis-hosted flow editor/tester. It does not yet publish or sync native Meta WhatsApp Flows JSON. A future Meta Flow sync can reuse `whatsapp_flows.meta_flow_id`, `definition`, and `settings` once the tenant has approved Meta templates that open native flows.

### Environment Variables

- `WHATSAPP_VERIFY_TOKEN` - webhook subscription verification
- `WHATSAPP_ACCESS_TOKEN` - Cloud API bearer token
- `WHATSAPP_PHONE_NUMBER_ID` - optional business phone ID for single-number installs
- `WHATSAPP_APP_SECRET` - optional Meta webhook signature verification
- `WHATSAPP_GRAPH_API_VERSION` - Graph API version, defaults to `v25.0`
- `WHATSAPP_TENANT_ID` - development/bootstrap fallback when a `phone_number_id` has not been configured yet

## Current Meta Setup Snapshot

Captured from Meta Developers on 2026-06-05:

- App: `sintesis`
- App ID: `1380225343516875`
- Business ID: `818075907530280`
- WhatsApp Business Account ID: `2495778077603657`
- Phone Number ID: `1185395624654557`
- Phone: `+54 9 379 569 6575`
- Graph API shown by Meta: `v25.0`
- Status: phone is present in WhatsApp Manager but still shown as `Pendiente` in the phone numbers table.
- Verification note: Meta accepted an initial SMS attempt, but later SMS requests stopped arriving and triggered a three-hour cooldown. Do not request more SMS during the cooldown. On the next attempt, prefer voice call verification with the Claro chip active and stable signal.
- Webhook callback configured in Meta: `https://www.sintesis.dev/api/whatsapp/webhook`
- Webhook field subscription: `messages` subscribed on `v24.0`.
- App publishing: Meta requires a valid public privacy policy URL. The repo now has `/privacy`, but `https://www.sintesis.dev/privacy` must be deployed before Meta accepts it and enables publishing.
- Access token: the temporary token generated from the Meta console was valid for the logged-in Meta user but did not have permission to load the WABA or Phone Number ID while the phone remained disabled in the API sender selector. Do not treat that token as production-ready.
- Local dev tunnel used during setup: `https://require-chose-phoenix-imperial.trycloudflare.com` (temporary; do not rely on it for production).
- Pending external setup: deploy `/privacy`, publish the app, resolve the phone `Pendiente` state/API sender disablement, generate/store a valid WABA-scoped access token, configure `WHATSAPP_APP_SECRET`, and add a payment method for business-initiated messages.

Captured from production setup on 2026-06-07:

- Phone status in WhatsApp Manager: `Conectado`.
- App mode: active/published.
- WABA subscribed app state was missing even though the `messages` webhook field was subscribed. Calling `POST /{WABA_ID}/subscribed_apps` fixed delivery.
- Authorized test contact: `+54 9 379 479 1965`.
- Default policy for the active tenant targets USD 20/month: 400 utility templates, 0 marketing, 0 authentication, 300 file uploads, 2 GB WhatsApp storage, 300 data queries, 300 manual submissions, 25 recurring contacts, and one reminder per contact per week.

---

## Related Notes

- [[13 - Notifications Engine]]
- [[04 - Obras (Construction Projects)]]
- [[21 - Tenant Secrets & Security]]
- [[35 - Usage Metering & Subscriptions]]
