# Database Migrations

tags: #database #migrations #schema #history

## Overview

86 Supabase migrations document the complete evolution of the database schema. They are the canonical truth of what exists in production.

> **Location:** `supabase/migrations/`
> **Format:** `{number}_{description}.sql`
> **Applied via:** `supabase db push` / Supabase CLI

---

## Migration Timeline

### Phase 1 — Core Foundation (0001–0010)

| # | File | What it does |
|---|------|-------------|
| 0001 | `base_schema.sql` | Core tables: `tenants`, `profiles`, `memberships` (owner/admin/member roles) |
| 0002 | `dev_rls.sql` | Development RLS policies (permissive for local dev) |
| 0003 | `roles_permissions.sql` | Custom roles system: `roles`, `user_roles` tables |
| 0004 | `profiles_trigger.sql` | Auto-creates `profiles` row when `auth.users` row inserted (trigger) |
| 0005 | `memberships_admin_read.sql` | RLS: admins can read all memberships in their tenant |
| 0006 | `onboarding.sql` | Onboarding support (tenant creation flow) |
| 0007 | `membership_self_join.sql` | Users can read their own memberships |
| 0008 | `obras_table.sql` | Core `obras` table with all project fields |
| 0009 | `obras_table.sql` | Extends obras table (additional columns or indexes) |
| 0010 | `obras_finish_config.sql` | Adds `on_finish_first_message`, `on_finish_second_message`, `on_finish_second_send_at` to obras |

### Phase 2 — Core Features (0011–0030)

| # | File | What it does |
|---|------|-------------|
| 0011 | `certificates_table.sql` | `certificates` table (n_exp, n_certificado, monto, estado) |
| 0012 | `notifications_table.sql` | `notifications` table (in-app notifications) |
| 0013 | `materials_tables.sql` | `material_orders` + `material_order_items` tables |
| 0014 | `storage_obra_documents.sql` | Creates `obra-documents` Supabase Storage bucket + RLS policies |
| 0015 | `add_material_orders_doc_ref.sql` | Adds `doc_bucket`, `doc_path` to `material_orders` |
| 0016 | `obra_pendientes.sql` | `obra_pendientes` table (pending items with due dates) |
| 0017 | `certificates_extras.sql` | Adds invoice/payment fields to certificates (`facturado`, `cobrado`, `fecha_facturacion`, etc.) |
| 0018 | `notifications_realtime.sql` | Enables Supabase Realtime on `notifications` table |
| 0019 | `pendientes_notifications_link.sql` | Links pendientes to notification system |
| 0020 | `pendientes_due_time.sql` | Adds `due_time` / scheduling fields to pendientes |
| 0021 | `add_aps_urn_to_materials.sql` | Adds `aps_urn` to material orders (Autodesk 3D model URN) |
| 0022 | `aps_models_table.sql` | `aps_models` table (APS upload tracking: urn, status, obra link) |
| 0023 | `obra_flujo_actions.sql` | `obra_flujo_actions` table (automation configs per obra) |
| 0024 | `add_notification_type_to_flujo_actions.sql` | Adds `notification_types[]` array to flujo actions |
| 0025–0030 | placeholders | Reserved migration slots (no-ops) |

### Phase 3 — Auth & Security Hardening (0031–0039)

| # | File | What it does |
|---|------|-------------|
| 0031 | `invitations_table.sql` | `invitations` table (email, token, expires_at, tenant_id) |
| 0032 | `fix_superadmin_functions.sql` | Fixes helper functions for superadmin role detection |
| 0033 | `check_email_is_member.sql` | Adds RPC `check_email_is_member()` for invitation validation |
| 0034 | `grant_auth_users_permissions.sql` | Grants select on `auth.users` to service role |
| 0035 | `fix_permissions_rls.sql` | Fixes RLS policies on permissions tables |
| 0036 | `fix_user_roles_rls_recursion.sql` | **Critical:** Fixes RLS recursion on `user_roles` (was causing stack overflow) |
| 0037 | `fix_invitations_profile_relationship.sql` | Fixes FK between invitations and profiles |
| 0038 | `optimize_rls_policies_prevent_stack_overflow.sql` | Major RLS optimization to prevent recursion in complex permission checks |
| 0039 | `fix_helper_functions_security_definer.sql` | Marks helper functions as `SECURITY DEFINER` to avoid RLS bypass issues |

### Phase 4 — Calendar, Audit, & Secrets (0040–0050)

| # | File | What it does |
|---|------|-------------|
| 0040 | `calendar_events.sql` | `calendar_events` table (start_at, end_at, audience_type, target_user_id, target_role_id) |
| 0041 | `add_obra_to_calendar_events.sql` | Adds `obra_id` FK to calendar_events |
| 0042 | `remove_auto_default_tenant_assignment.sql` | Removes trigger that auto-assigned users to default tenant |
| 0043 | `obra_memoria_notes.sql` | `obra_memoria_notes` table (collaborative notes per obra) |
| 0044 | `audit_log.sql` | `audit_log` table + trigger function on all tracked tables |
| 0045 | `tenant_api_secrets.sql` | `tenant_api_secrets` table (versioned HMAC signing secrets) |
| 0046 | `soft_delete_and_cleanup.sql` | Adds `deleted_at` to obras, certificates, pendientes; cleanup RPC |
| 0047 | `pendiente_schedules_tenant.sql` | Adds `tenant_id` to `pendiente_schedules` table |
| 0048 | `obra_tablas.sql` | **Core:** `obra_tablas`, `obra_tabla_columns`, `obra_tabla_rows` (dynamic data tables) |
| 0049 | `obra_defaults.sql` | `obra_default_folders`, `obra_default_tablas`, `obra_default_tabla_columns` |
| 0050 | `ocr_templates.sql` | `ocr_templates` table (AI extraction region configs) |

### Phase 5 — Workflows & Macro Tables (0051–0060)

| # | File | What it does |
|---|------|-------------|
| 0051 | `flujo_execution_tracking.sql` | `obra_flujo_executions` table (status: pending/completed/failed, error_message) |
| 0052 | `workflow_notifications_function.sql` | `workflow_insert_notification()` RPC — used by Temporal workflow steps |
| 0053 | `workflow_run_id.sql` | Adds `workflow_run_id` to flujo_executions for cancellation |
| 0054 | `macro_tables.sql` | **Core:** `macro_tables`, `macro_table_sources`, `macro_table_columns`, `macro_table_custom_values` |
| 0055 | `onboarding_hardening.sql` | Prevents users from creating multiple tenants or bypassing onboarding |
| 0056 | `superadmin_rls_overrides.sql` | RLS: superadmins bypass all tenant restrictions |
| 0058 | `tenant_creation_policy.sql` | Policy: controls who can create new tenants |
| 0059 | `fix_tenant_insert_grant.sql` | Grants INSERT on tenants table to authenticated role |
| 0060 | `permissions_system.sql` | `permissions`, `role_permissions`, `user_permission_overrides` tables |

### Phase 6 — Sidebar, Usage & Billing (0061–0070)

| # | File | What it does |
|---|------|-------------|
| 0061 | `fix_default_tabla_columns.sql` | Bug fix: column ordering/defaults in obra_default_tabla_columns |
| 0062 | `sidebar_macro_tables.sql` | `sidebar_macro_tables` table (role-based sidebar visibility) |
| 0063 | `remove_role_key.sql` | Removes deprecated `role_key` column from roles table |
| 0064 | `tenant_api_expenses.sql` | `tenant_expenses` table (AI token usage, storage, WhatsApp tracking) |
| 0065 | `subscription_plans.sql` | `subscription_plans` + `tenant_subscriptions` tables |
| 0066 | `tenant_usage_enforcement.sql` | RPC `get_tenant_usage()` for plan limit checking |
| 0067 | `usage_event_logs.sql` | `tenant_usage_events` table (transactional usage log) |
| 0068 | `reset_subscription_limits.sql` | Data migration: resets limits to plan defaults |
| 0069 | `tenant_limit_overrides.sql` | Adds override columns to `tenant_subscriptions` (per-tenant limit customization) |
| 0070 | `obra_quick_actions.sql` | `obra_default_quick_actions` table (multi-step workflow templates) |

### Phase 7 — Reporting, Jobs & Audit Expansion (0071–0086)

| # | File | What it does |
|---|------|-------------|
| 0071 | `report_presets.sql` | `report_presets` + `report_share_links` tables |
| 0074 | `engine_flow_lock_rpc.sql` | RPC `acquire_flow_lock()` — distributed locking for engine flows |
| 0075 | `ocr_templates_unique_active.sql` | Unique constraint: one active OCR template per folder per tenant |
| 0076 | `background_jobs.sql` | `background_jobs` table (type, payload, status, attempts, locked_at) |
| 0077 | `obra_reporting.sql` | `obra_reporting_snapshots` / `obra_findings` — reporting and signal tables |
| 0078 | `obra_signal_logs.sql` | `obra_signal_logs` table (computed KPI history per obra) |
| 0079 | `tenant_main_table_configs.sql` | `tenant_main_table_configs` table (per-tenant obras list column config) |
| 0080 | `obras_custom_data.sql` | Adds `custom_data JSONB` to obras (tenant-specific extra fields) |
| 0081 | `obra_quick_actions_scope.sql` | Scopes quick actions to specific obra-level context |
| 0082 | `obra_document_uploads.sql` | `obra_document_uploads` table (tracks files uploaded per obra) |
| 0083 | `audit_log_tablas.sql` | Adds audit triggers to obra_tablas, obra_tabla_rows |
| 0084 | `audit_log_templates_and_macro.sql` | Adds audit triggers to ocr_templates, macro_tables |
| 0085 | `audit_log_document_uploads.sql` | Adds audit trigger to obra_document_uploads |
| 0086 | `audit_log_noise_reduction.sql` | Filters out high-frequency low-value audit events |

---

## Key SQL Patterns

### Standard RLS Policy Pattern
```sql
-- Every table follows this pattern:
ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON {table}
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM memberships WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "superadmin_override" ON {table}
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_superadmin = true)
  );
```

### Auto-create Profile Trigger (0004)
```sql
CREATE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### workflow_insert_notification RPC (0052)
```sql
-- Called by Temporal workflow steps (bypasses RLS)
CREATE FUNCTION workflow_insert_notification(...)
RETURNS void SECURITY DEFINER AS $$
BEGIN
  INSERT INTO notifications (tenant_id, user_id, title, body, type, action_url, data)
  VALUES (...);
END;
$$ LANGUAGE plpgsql;
```

### RLS Recursion Fix (0036, 0038)
The `user_roles` table had circular RLS: checking permissions required reading user_roles, which itself required permission. Fixed by:
- Using `SECURITY DEFINER` helper functions
- Two-step permission lookups in app code
- Optimized policies avoiding self-referential subqueries

---

## Feature → Migration Map

| Feature | Migrations |
|---------|-----------|
| Multi-tenancy foundation | 0001, 0002, 0005, 0006, 0007 |
| User auth + profiles | 0004, 0027, 0032, 0034 |
| Obras (projects) | 0008, 0009, 0010, 0080 |
| Certificates | 0011, 0017 |
| Notifications (in-app) | 0012, 0018, 0019, 0052 |
| Materials + APS | 0013, 0015, 0021, 0022 |
| Storage bucket | 0014 |
| Pendientes + reminders | 0016, 0020, 0047 |
| Flujo/workflow | 0023, 0024, 0026, 0051, 0053 |
| Invitations | 0031, 0037 |
| Roles + permissions | 0003, 0035, 0036, 0038, 0060, 0063 |
| Calendar events | 0040, 0041 |
| Obra notes (memoria) | 0043 |
| Audit log | 0044, 0083, 0084, 0085, 0086 |
| Tenant secrets + signing | 0045 |
| Soft deletes | 0046 |
| Tablas (dynamic tables) | 0048 |
| Obra defaults templates | 0049 |
| OCR templates | 0050, 0075 |
| Macro tables | 0054 |
| Superadmin | 0027, 0028, 0032, 0056 |
| Permissions system | 0060 |
| Sidebar macro tables | 0062 |
| Usage + billing | 0064, 0065, 0066, 0067, 0068, 0069 |
| Quick actions | 0070, 0081 |
| Reports + share links | 0071 |
| Background jobs | 0076 |
| Reporting/signals | 0077, 0078 |
| Main table config | 0079 |
| Document uploads | 0082, 0085 |

---

## Related Notes

- [[24 - Database Schema]]
- [[02 - Multi-Tenancy & Auth]]
- [[05 - Tablas (Data Tables)]]
- [[07 - Macro Tables]]
- [[20 - Permissions System]]
