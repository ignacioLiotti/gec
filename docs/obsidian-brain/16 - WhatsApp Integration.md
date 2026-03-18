# WhatsApp Integration

tags: #whatsapp #integration #webhook #messaging

## Overview

The app has a WhatsApp webhook integration for receiving messages from construction site workers and supervisors. This allows field staff to interact with the system without needing to log in to the web app.

---

## Webhook

`POST /api/whatsapp/webhook`

Receives incoming WhatsApp messages from a WhatsApp Business API provider.

**Security:**
- Webhook verified via request signing (`lib/security/request-signing.ts`)
- Tenant secret used for HMAC verification

---

## Intended Use Cases (from Roadmap)

The WhatsApp integration is designed to allow:

1. **Add comments to obras** — send a WhatsApp message to add notes to a project
2. **Add items to Memoria Descriptiva** — voice/text notes converted to obra memoria
3. **Create/modify calendar events** — natural language event creation
4. **Scheduled check-in questions** — automated daily/weekly questions sent to site supervisors
   - "¿Cuál es el avance de hoy?"
   - "¿Hay algún problema a reportar?"
   - "¿Llegaron los materiales?"

---

## Current Implementation

The webhook handler **fully implements file upload via WhatsApp**:

### Instruction Format
Users send a WhatsApp message with:
```
obra [NAME or NUMBER] carpeta [FOLDER_NAME]
```
Then attach a file.

### Processing Flow
```
WhatsApp Cloud API → POST /api/whatsapp/webhook
    ↓
1. Verify x-hub-signature-256 (HMAC-SHA256 of body)
2. Parse message: "obra [NAME|N] carpeta [FOLDER]"
3. Download media from WhatsApp API
4. Find obra by name or number (n field) in DB
5. Upload to Supabase: obra-documents/{obraId}/{folderName}/{filename}
6. Generate signed URL (24h expiry)
7. Reply via WhatsApp API with confirmation + URL
```

### Environment Variables
- `WHATSAPP_VERIFY_TOKEN` — webhook subscription verification
- `WHATSAPP_ACCESS_TOKEN` — Cloud API bearer token
- `WHATSAPP_PHONE_NUMBER_ID` — business phone ID

### GET Handler
- WhatsApp subscription verification challenge
- Returns `hub.challenge` if `hub.verify_token` matches

---

## Related Notes

- [[13 - Notifications Engine]]
- [[04 - Obras (Construction Projects)]]
- [[21 - Tenant Secrets & Security]]
