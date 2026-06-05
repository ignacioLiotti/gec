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
- Current Meta account metadata and provider.
- Authorized contacts, permissions, and obra scope.
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

---

## Related Notes

- [[13 - Notifications Engine]]
- [[04 - Obras (Construction Projects)]]
- [[21 - Tenant Secrets & Security]]
- [[35 - Usage Metering & Subscriptions]]
