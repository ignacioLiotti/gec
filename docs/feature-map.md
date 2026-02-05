# Feature & Interaction Map

## Authentication & Tenant Context
- Supabase auth drives every request; `resolveTenantMembership` pulls the active tenant via cookie and is consumed by API helpers and the Excel UI.
- Middleware/route guards reuse the same context so navigation visibility and API access stay in sync.
- **Key files:** `app/onboarding/page.tsx`, `app/tenants/actions.ts`, `app/api/tenants/[tenantId]/switch/route.ts`, `lib/tenant-selection.ts`, `lib/route-guard.ts`

## Tenant Onboarding Lifecycle
- Users either create a new organization or join existing ones via server actions.
- After creation/join, `/api/tenants/:id/switch` stores the tenant cookie and redirects to the Excel dashboard.
- **Key files:** `app/onboarding/page.tsx`, `app/tenants/actions.ts`, `app/api/tenants/[tenantId]/switch/route.ts`

## User Management & Invitations
- Admin UI issues invitation tokens, sends Resend emails, and provides acceptance/decline flows that validate email + tenant.
- Accepted invitations create memberships so onboarding, guards, and permissions recognize the user.
- **Key files:** `app/admin/users/invitation-actions.ts`, `lib/email/invitations.ts`, `lib/email/api.ts`, `app/invitations/[token]/page.tsx`

## Route Access & Navigation Gating
- `lib/route-access.ts` defines visibility requirements for every route.
- `getUserRoles` resolves tenant roles/custom roles, and both middleware (`proxy.ts`) and the sidebar consume the same config to keep UI + API aligned.
- **Key files:** `lib/route-access.ts`, `lib/route-guard.ts`, `components/app-sidebar.tsx`, `proxy.ts`

## Obra Operations (“Excel” Panel)
- Spreadsheet-like CRUD is driven by `FormTable` configs and the Obras REST endpoints.
- `applyObraDefaults` seeds folders/tablas for each obra so downstream OCR/macros/workflows have structure.
- Completion events bubble into automation/workflow modules.
- **Key files:** `components/form-table/configs/obras-detalle.tsx`, `app/excel/page.tsx`, `app/api/obras/route.ts`, `lib/obra-defaults.ts`

## Document Storage, OCR & Defaults
- File manager (Documents tab) wraps Supabase storage and overlays OCR metadata derived from admin defaults.
- OCR-enabled folders automatically link uploaded documents to obra tablas, feeding macro tables and reminders.
- **Key files:** `app/excel/[obraId]/tabs/documents-tab.tsx`, `app/excel/[obraId]/tabs/file-manager/file-manager.tsx`, `app/admin/obra-defaults/page.tsx`, `app/api/ocr-templates/route.ts`, `lib/tablas.ts`

## Quick Actions (Acciones rápidas)
- Tenant admins configure multi-step actions from default folders; each action appears as a floating panel on the Obra General tab.
- Steps adapt to folder nature (upload, OCR import, or manual row entry) and refresh Documents after each step.
- **Key files:** `docs/quick-actions.md`, `app/admin/obra-defaults/page.tsx`, `components/quick-actions/quick-actions-panel.tsx`, `app/api/obra-defaults/route.ts`

## Material Orders & 3D Models
- OCR imports parse invoices via AI, persist orders/items, and display them beside project documents.
- If uploads are 3D models, they are sent through Autodesk Platform Services; stored URNs enable the viewer integrations.
- **Key files:** `app/excel/[obraId]/page.tsx`, `app/api/obras/[id]/materials/import/route.ts`, `app/excel/[obraId]/tabs/file-manager/file-manager.tsx`, `app/api/aps/upload/route.ts`, `app/api/aps/models/route.ts`

## Certificates & Financial Tracking
- Certificates view uses `FormTable` with REST endpoints to track billing/cash collection status per obra.
- Data feeds macro reports and notifications for overdue invoices.
- **Key files:** `app/certificados/page.tsx`, `components/form-table/configs/certificados.tsx`, `app/api/certificados/route.ts`

## Workflow Automation & Notifications
- Users configure Flujo actions inside each obra; on completion these actions schedule in-app/email/calendar effects.
- Notification engine + workflow steps deliver via Supabase RPCs or Resend emails.
- **Key files:** `app/excel/[obraId]/tabs/flujo-tab.tsx`, `app/api/obras/route.ts`, `lib/notifications/engine.ts`, `lib/notifications/rules.ts`, `lib/workflow/notifications.ts`, `lib/workflow/email.ts`, `workflows/obra-complete.ts`

## Document Reminders, Schedules & Inbox
- Each obra stores pendientes with due rules; reminders API schedules workflows or immediate inserts.
- Scheduled reminders trigger via `pendiente_schedules` dispatcher; `/notifications` merges pendientes, calendar events, and flujo items.
- **Key files:** `app/api/obras/[id]/pendientes/route.ts`, `app/api/doc-reminders/route.ts`, `app/api/schedules/dispatch/route.ts`, `workflows/document-reminder.ts`, `app/notifications/page.tsx`, `lib/events/reminders.ts`

## Calendar, Macro Reporting & Exports
- Calendar events target users/roles/tenants; obra completion workflows write to `calendar_events`.
- Macro tables aggregate multiple obra tablas (manual, CSV, OCR) into report views consumed in `/macro`.
- PDF render API converts any HTML report to downloadable files.
- **Key files:** `app/api/calendar-events/route.ts`, `app/macro/page.tsx`, `app/api/macro-tables/[id]/rows/route.ts`, `lib/macro-tables.ts`, `app/api/pdf-render/route.ts`

## Admin Observability & Security
- Audit log UI queries Supabase `audit_log`; tenant secrets power request-signing for external event emitters.
- Notification emit API plus rate limiting/CSRF/CSP in `proxy.ts` form the hardened perimeter.
- **Key files:** `app/admin/audit-log/page.tsx`, `app/admin/tenant-secrets/page.tsx`, `lib/security/request-signing.ts`, `app/api/notifications/emit/route.ts`, `lib/security/rate-limit.ts`, `proxy.ts`
