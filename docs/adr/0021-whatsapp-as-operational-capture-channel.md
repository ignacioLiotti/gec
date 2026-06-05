# WhatsApp as operational capture channel

Status: accepted

WhatsApp is treated as an operational capture channel for tenant-authorized contacts, not as a standalone chatbot. The channel can ingest files, guide users through manual data submissions, and later answer controlled data queries, but every action must resolve tenant, contact, permission, obra, folder, and table context before mutating product data.

The implementation introduces tenant-scoped WhatsApp business accounts, contacts, message audit records, pending disambiguation actions, document-upload tracking, manual forms, and manual submissions. Webhook processing is idempotent by WhatsApp message id and stores bounded payload metadata for audit/debugging.

Document uploads from WhatsApp write to the same `obra-documents` storage layout used by the document manager, but keep a separate `whatsapp_document_uploads` audit row because external contacts may not always map to an authenticated Supabase user. Manual form answers are first captured as `whatsapp_manual_submissions`; applying a submission to `obra_tabla_rows` is an explicit validation/review step unless a future policy marks the form safe for auto-apply.

Group chat support is intentionally out of the initial contract. The stable baseline is direct 1:1 WhatsApp Business Platform messaging with templates and WhatsApp Flows for structured forms.
