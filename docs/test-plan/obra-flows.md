# Obra + Documentos + Notificaciones – Test Plan

This playbook defines the end-to-end QA flows the team can run manually (or automate later) to validate the most critical tenant scenarios: Obras lifecycle, certificates, documents, OCR extraction, flujo automation, and notification delivery (email + in-app + calendar).

## Prerequisites

1. **Local stack** – `npm run dev` and `npm run supabase:start` with a fresh database (`supabase db reset`) so IDs are predictable.
2. **Seed data** – Apply `supabase/seed.sql` and ensure at least one admin/member user exists; log into the app once to populate the session cookie.
3. **Service integrations**  
   - Configure Resend sandbox domain → use catch-all inbox to confirm emails.  
   - Configure a test push channel (Supabase Realtime or the in-app bell feed).  
   - Calendar notifications should surface on `/notifications?tab=calendar`.
4. **Test fixtures** – Prepare two sample PDFs/images (`factura.pdf`, `orden-compra.jpg`) containing obvious OCR content.
5. **Telemetry** – Enable the “Notifications” and “Emails” logging panels in the dev console for faster verification.

## High-Level Coverage Matrix

| ID | Flow | Purpose |
|----|------|---------|
| F1 | Create obra + fill detail rows | Validates CRUD + field bindings |
| F2 | Issue certificates tied to obra | Confirms certificates table + view |
| F3 | Manage folders and upload documents | Ensures storage tree + metadata |
| F4 | OCR extraction + data surfaces | Validates AI helper + extracted table |
| F5 | Instant flujo run (notifications) | Verifies immediate automation + email/push |
| F6 | Delayed flujo run (5 min) | Verifies scheduler + calendar visibility |

## Test Cases

### F1 – Create obra and populate rows
1. Sign in as an admin; open `/excel`.
2. Click **Agregar Fila** twice; ensure two new empty entries appear at the bottom.  
3. For the first obra, populate **all columns** (N°, Designación, Entidad, etc.) with unique values; set `%` to `75`.  
4. For the second obra, mark `% = 100` to simulate a completed project.  
5. Hit **Guardar Cambios**; expect success toast.  
6. Refresh the page – verify both obras persist and the tab filters show one record in “En proceso” and one in “Completadas”.  
7. (Optional) open `/api/obras?status=in-process` to confirm records exist server-side.

### F2 – Create certificados associated to the obra
1. Navigate to `/certificados`.  
2. Use **Nueva fila** (context menu → Duplicar works too) to create a certificate referencing the first obra’s name.  
3. Fill all certificate fields (ente, facturación dates, monto, concepto, etc.).  
4. Repeat for the second obra with slightly different amounts.  
5. Reload – certificates should stick and show in filters/search.  
6. Validate via Supabase SQL: `select count(*) from certificates where obra_id = '<obra-id>';` returns 2.  
7. Trigger the **Eliminar certificado** context action for one row; accept and confirm it disappears.

### F3 – Manage folders and upload documents
1. Open `/excel/[obraId]?tab=documentos` for the first obra.  
2. Hit **Nueva carpeta**, create `Contratos`, then repeat for `Facturas`.  
3. Select `Contratos`; click **Subir archivos** and upload `factura.pdf`.  
4. Switch to `Facturas`; upload `orden-compra.jpg`.  
5. Confirm the breadcrumb updates, file cards show correct mime/size, and downloads work.  
6. Validate storage via Supabase dashboard: bucket `obra-documents` should contain `{obraId}/Contratos/factura.pdf` etc.

### F4 – OCR extraction & data surfacing
1. From the documents tab, open `Facturas/orden-compra.jpg`.  
2. Click **Extraer datos (OCR)** (AI action).  
3. Wait for processing → expect a success toast and extracted table preview (line items, totals) under the viewer.  
4. Open the **Materiales** tab to confirm OCR’d values populate the table (e.g., supplier, quantity, unit cost).  
5. Inspect Supabase table `material_orders` – new rows linked to the obra and document should exist with `ocr_source = 'facturas'`.  
6. Re-run extraction to ensure idempotency (the UI should warn about overrides).

### F5 – Instant flujo automation (email + push)
1. Go to `/excel/[obraId]?tab=flujo`.  
2. Add a workflow: trigger = “Al completar obra”, timing = **Inmediato**, action = “Enviar email + notificación” to yourself.  
3. Ensure obra `%` >= 100, then click **Marcar como completada** (or update `%` from `/excel`).  
4. Expected results:  
   - Email arrives from Resend within ~1 min referencing obra name.  
   - In-app notification counter increments; entry appears under `/notifications?tab=feed`.  
   - Audit log (if enabled) lists the automation execution.  
5. Check Supabase `notifications` table: new row with audience pointing to your user.

### F6 – Scheduled flujo (5-minute delay) + calendar
1. Edit/create another workflow: trigger “Documento vencido” or manual start, timing = **Offset 5 minutos**, action = email + push + calendar entry.  
2. Trigger the workflow (e.g., upload document with `vencimiento` today).  
3. Use Supabase SQL to confirm `pendiente_schedules` contains a job with `run_at` ≈ now + 5m.  
4. Wait 5 minutes (or use supabase CLI to call the cron endpoint).  
5. Expected results:  
   - Email + in-app notification fire at ~5m mark.  
   - `/notifications?tab=calendar` shows the scheduled entry on the current day.  
   - `/api/schedules/dispatch` logs include the tenant_id for auditing.  
6. Mark the notification as done; verify status updates in DB to prevent re-delivery.

## Notes for Future Automation
- These cases map cleanly to Playwright flows once auth helpers + storage mocks are available.  
- Email assertions can be automated via Resend’s API (list last message to test inbox).  
- Push notifications already persist in Supabase; integration tests can poll `/api/notifications` to assert counts.  
- For OCR, inject a deterministic mock (AI helper already lives under `aiexample/`); wrap with feature flag so tests can bypass external APIs.
