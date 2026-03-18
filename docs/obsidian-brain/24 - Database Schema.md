# Database Schema

tags: #database #schema #supabase #postgresql

## Overview

PostgreSQL via Supabase. Every table has:
- `tenant_id` for multi-tenant isolation
- Row Level Security (RLS) policies
- Audit triggers on key tables

---

## Core Tables

### Identity & Auth
```sql
-- Supabase managed
auth.users (id, email, app_metadata)

profiles
  id (FK auth.users)
  email, full_name, avatar_url, updated_at

tenants
  id, name, settings, subscription_plan, created_at

tenant_memberships
  id, tenant_id, user_id, role (owner/admin/member), created_at
```

### Roles & Permissions
```sql
tenant_roles
  id, tenant_id, name, description, created_at

tenant_role_permissions
  id, role_id, route_path, can_access

tenant_user_roles
  user_id, role_id, tenant_id

tenant_user_permission_overrides
  id, user_id, tenant_id, route_path, can_access
```

### Obras (Projects)
```sql
obras
  id, tenant_id
  name, location, client, contractor
  budget, certified, invoiced, collected
  progress, start_date, end_date, actual_end
  status, notes
  completed_at, created_at, updated_at
```

### Tablas (Dynamic Data Tables)
```sql
obra_tablas
  id, obra_id, tenant_id
  name, folder_path
  schema_columns (JSONB)  -- TablaSchemaColumn[]
  is_ocr, data_input_method
  default_tabla_id       -- FK to obra_default_tablas (template)
  created_at, updated_at

obra_tabla_rows
  id, tabla_id, obra_id, tenant_id
  data (JSONB)           -- { fieldKey: value, ... }
  position, created_at, updated_at
```

### Documents
```sql
obra_documents
  id, obra_id, tenant_id
  storage_path           -- path in Supabase Storage
  folder_path, filename
  ocr_status, ocr_extracted_at
  created_at

obra_ocr_links
  id, document_id, tabla_id, row_id
  created_at
```

### Materials
```sql
obra_material_orders
  id, obra_id, tenant_id
  nro_orden, solicitante, gestor, proveedor
  created_at

obra_material_order_items
  id, order_id
  cantidad, unidad, material, precio_unitario
```

### Certificates
```sql
certificados
  id, obra_id, tenant_id
  numero, fecha, monto
  facturado, cobrado
  periodo, notas
  created_at, updated_at
```

### Notifications & Calendar
```sql
notifications
  id, tenant_id, user_id (recipient)
  title, body, type
  action_url, data (JSONB)
  read_at, created_at

calendar_events
  id, tenant_id
  title, description
  start_at, end_at, all_day
  target_type, target_id
  obra_id, created_by
  created_at
```

### Workflow & Scheduling
```sql
flujo_executions
  id, obra_id, tenant_id
  event_type, status
  executed_at

pendiente_schedules
  id, pendiente_id, obra_id, tenant_id
  fire_at, status
  workflow_run_id
  created_at

obra_pendientes
  id, obra_id, tenant_id
  title, due_date
  completed_at
  reminder_rules (JSONB)
  assigned_to (UUID[])
```

### Macro Tables
```sql
macro_tables
  id, tenant_id
  name, description, settings (JSONB)
  created_at, updated_at

macro_table_sources
  id, macro_table_id, obra_tabla_id
  position

macro_table_columns
  id, macro_table_id
  column_type, source_field_key
  label, data_type
  position, config (JSONB)

macro_table_custom_values
  id, macro_table_id, source_row_id, column_id
  value (JSONB)

sidebar_macro_tables
  id, tenant_id, macro_table_id
  enabled, position
```

### Admin Config
```sql
obra_default_tablas
  id, tenant_id
  name, folder_path
  schema_columns (JSONB)
  is_ocr, data_input_method
  ocr_template (JSONB)

obra_default_quick_actions
  id, tenant_id
  name, description
  folder_paths (TEXT[])
  position

main_table_configs
  id, tenant_id
  column_config (JSONB)

obra_recipients
  id, tenant_id, obra_id
  user_id, notification_types (TEXT[])
```

### Usage & Security
```sql
tenant_expenses
  id, tenant_id, obra_id
  feature, model
  input_tokens, output_tokens, cost_usd
  created_at

tenant_secrets
  id, tenant_id, name
  encrypted_value, created_at

audit_log
  id, tenant_id, user_id
  table_name, record_id, operation
  before_data, after_data (JSONB)
  created_at

invitations
  id, tenant_id
  email, token, role
  expires_at, accepted_at
  created_by
```

---

## Key Relationships Diagram

```
tenants
  └── tenant_memberships → profiles (users)
  └── obras
        └── obra_tablas
              └── obra_tabla_rows
              └── obra_ocr_links
        └── obra_documents
        └── obra_material_orders → obra_material_order_items
        └── certificados
        └── obra_pendientes → pendiente_schedules
        └── flujo_executions
  └── macro_tables
        └── macro_table_sources → obra_tablas
        └── macro_table_columns
  └── obra_default_tablas
  └── obra_default_quick_actions
  └── calendar_events
  └── notifications
  └── tenant_roles → tenant_role_permissions
  └── tenant_expenses
```

---

## Related Notes

- [[01 - Architecture Overview]]
- [[05 - Tablas (Data Tables)]]
- [[07 - Macro Tables]]
- [[02 - Multi-Tenancy & Auth]]
