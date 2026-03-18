# Admin Panel

tags: #admin #configuration #management

## Overview

The Admin Panel (`/admin`) is restricted to users with `owner` or `admin` membership roles. It provides all tenant-level configuration and management features.

---

## Admin Routes

| Route | Purpose |
|-------|---------|
| `/admin` | Admin dashboard |
| `/admin/users` | User management + invitations |
| `/admin/roles` | Role and permission management |
| `/admin/obra-defaults` | Default folder/tabla templates + quick actions |
| `/admin/macro-tables` | Macro table configuration |
| `/admin/macro-tables/new` | Create new macro table |
| `/admin/macro-tables/[id]` | Edit macro table columns/sources |
| `/admin/main-table-config` | Configure main obras list columns |
| `/admin/audit-log` | Audit trail viewer |
| `/admin/expenses` | AI usage + cost tracking |
| `/admin/expenses/all` | All expenses (super-admin) |
| `/admin/tenants` | Tenant management (super-admin only) |
| `/admin/tenant-secrets` | Webhook secrets management |

---

## Users Management (`/admin/users`)

`app/admin/users/`

**Features:**
- List all tenant members
- Invite new users (email-based token invitation)
- Change user membership role (owner/admin/member)
- Remove users from tenant
- User impersonation (start/stop)

**Invitation flow:**
1. Admin enters email → `invitation-actions.ts` creates token in DB
2. Resend email sent via `lib/email/invitations.ts`
3. Token valid for 72 hours
4. User clicks link → validates → creates membership
5. Pending invitations shown in `pending-invitations-list.tsx`

---

## Roles Management (`/admin/roles`)

`app/admin/roles/`

**Features:**
- Create custom roles (beyond owner/admin/member)
- Define role permissions via permission matrix
- Assign roles to users
- Per-user permission overrides

**Key components:**
- `permission-matrix.tsx` — grid of routes × permissions
- `user-assignments.tsx` — which users have which role
- `user-overrides.tsx` — grant/deny specific permissions to individual users
- `navigation-tree.tsx` — sidebar navigation preview per role
- `role-editor.tsx` — role name + description editor

---

## Obra Defaults (`/admin/obra-defaults`)

`app/admin/obra-defaults/`

Central configuration for what gets created when a new obra is made:

**Default Folders:**
- Define folder tree structure (e.g., "Contratos/", "Facturas/", "Planos/")
- Mark folders as OCR-enabled
- Set data input method per folder

**Default Tablas:**
- Define tabla templates with column schemas
- Link tablas to folders (OCR source → tabla destination)
- Schema synced to new obras on creation

**Quick Actions:**
- Create multi-step action sequences
- Order steps by folder selection
- See: [[11 - Quick Actions]]

**OCR Templates:**
- Configure AI extraction schemas per folder type
- `OcrTemplateConfigurator.tsx` — visual schema editor

---

## Main Table Config (`/admin/main-table-config`)

`app/admin/main-table-config/`

Allows admins to configure which columns appear in the main obras list table:
- Show/hide default columns
- Reorder columns
- Set column widths

Saved to `main_table_configs` DB table (per tenant).
API: `GET/PATCH /api/main-table-config`

`lib/main-table-columns.ts` — defines all available columns.

---

## Audit Log (`/admin/audit-log`)

`app/admin/audit-log/`

Queries `audit_log` table in Supabase.

**What's tracked:**
- Obra create/update/delete
- Certificate create/update
- User invite/remove
- Role changes
- Before + after data snapshots
- User attribution (who did it)
- Timestamp

`app/admin/audit-log/_components/moment-cell.tsx` — relative time display.

---

## Tenant Management (`/admin/tenants`)

Super-admin only.
- List all tenants in the system
- Create new tenants
- View tenant details/usage

---

## Tenant Secrets (`/admin/tenant-secrets`)

`app/admin/tenant-secrets/`

Manages secrets for webhook integrations:
- Each tenant can have named secrets (e.g., "whatsapp_webhook_secret")
- Secrets stored encrypted in DB
- Used for `X-Signature` HMAC verification on incoming webhooks
- API: `GET/POST /api/tenant-secrets`

`lib/security/secrets.ts` — encryption/decryption utilities.

---

## Related Notes

- [[02 - Multi-Tenancy & Auth]]
- [[20 - Permissions System]]
- [[21 - Tenant Secrets & Security]]
- [[22 - Expenses & Usage Tracking]]
- [[11 - Quick Actions]]
- [[07 - Macro Tables]]
