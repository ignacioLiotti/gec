# RLS & Security Policies

tags: #security #rls #database #postgresql

## Overview

**Row Level Security (RLS)** is the primary data isolation mechanism. Every table in the app has RLS enabled. The policies form a layered system: tenant isolation + superadmin overrides + special cases.

---

## Policy Layers

### Layer 1: Tenant Isolation (all tables)
```sql
-- Standard pattern on every table
CREATE POLICY "tenant_isolation" ON {table}
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM memberships
      WHERE user_id = auth.uid()
    )
  );
```
This ensures users only see data from tenants they belong to.

### Layer 2: Superadmin Override (all tables, migration 0056)
```sql
CREATE POLICY "superadmin_all" ON {table}
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_superadmin = true
    )
  );
```
Superadmins bypass all tenant restrictions.

### Layer 3: Admin Read (selected tables, migration 0005)
```sql
-- Admins can see all memberships in their tenant
CREATE POLICY "admin_read" ON memberships
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM memberships
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );
```

### Layer 4: Self-Access (profiles, migration 0007)
```sql
-- Users can always read/update their own profile
CREATE POLICY "self_access" ON profiles
  FOR ALL USING (id = auth.uid());
```

---

## The RLS Recursion Problem

**Problem (migrations 0036, 0038, 0039):**

The `user_roles` table had a circular dependency:
1. Checking if user can read `user_roles` required checking their permissions
2. Checking permissions required reading `user_roles`
3. PostgreSQL hit stack depth limit → 500 error

**Solution:**
- Helper functions marked `SECURITY DEFINER` (run as function owner, bypass RLS)
- Two-step lookups in application code (get role_ids first, then get role details separately)
- Optimized policies using `EXISTS` subqueries instead of `IN` for better query planning

**In application code (`lib/route-guard.ts`):**
```typescript
// Step 1: Get role IDs (uses security definer function)
const { data: userRoleIds } = await supabase
  .from("user_roles")
  .select("role_id")
  .eq("user_id", userId);

// Step 2: Get role details (filtered by known IDs, no circular RLS)
const { data: roles } = await supabase
  .from("roles")
  .select("id, name")
  .in("id", roleIds)
  .eq("tenant_id", tenantId);
```

---

## SECURITY DEFINER Functions

These functions run with elevated privileges (bypass RLS):

| Function | Purpose | Migration |
|----------|---------|-----------|
| `handle_new_user()` | Auto-creates profile on signup | 0004 |
| `check_email_is_member()` | Validates invitation email | 0033 |
| `workflow_insert_notification()` | Inserts notifications from Temporal | 0052 |
| `get_active_tenant_secret()` | Reads signing secrets (for request verification) | 0045 |
| `get_tenant_usage()` | Reads usage across tables | 0066 |
| `has_permission()` | Resolves tenant-scoped user and role grants/denies without role RLS recursion | 0039, 0122, 0123 |
| `create_tenant_from_blueprint()` | Atomically creates a tenant owned by the authenticated caller and applies an allowed setup blueprint | 0126 |
| `accept_tenant_invitation()` | Validates token + authenticated email, creates membership, and consumes the invitation atomically | 0126 |
| `acquire_flow_lock()` | Distributed lock for flow engine | 0074 |
| `cleanup_orphan_records()` | Maintenance cleanup | — |
| `rotate_tenant_api_secret()` | Secret rotation | 0045 |

---

## Storage Bucket RLS (migrations 0014, 0101)

`obra-documents` bucket policies:
```sql
-- Users can only access files whose first path segment is an obra
-- belonging to one of their tenant memberships.
CREATE POLICY "obra-documents read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'obra-documents' AND
    EXISTS (
      SELECT 1
      FROM obras o
      WHERE o.id::text = (storage.foldername(name))[1]
        AND public.is_member_of(o.tenant_id)
    )
  );

-- INSERT/UPDATE also require the target obra to be active
-- (`deleted_at IS NULL` and `purged_at IS NULL`).
-- SELECT/UPDATE/DELETE also exclude paths with active rows in
-- `obra_document_deletes`, including children of deleted folders.
-- App UX should still use soft-delete APIs instead of direct Storage deletion.
```

---

## Notifications Realtime (migration 0018)

```sql
-- Enable Supabase Realtime for notifications table
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
```

RLS on notifications restricts Realtime events to:
```sql
CREATE POLICY "own_notifications" ON notifications
  FOR SELECT USING (user_id = auth.uid());
```

So each client only receives their own notification events via websocket.

---

## Audit Log Triggers (migrations 0044, 0083–0086)

```sql
-- Generic audit trigger function
CREATE FUNCTION record_audit_log()
RETURNS trigger AS $$
BEGIN
  INSERT INTO audit_log (
    tenant_id, actor_id, actor_email,
    table_name, action, row_pk,
    changed_keys, before_data, after_data
  )
  VALUES (
    -- extracts tenant_id from OLD/NEW row
    -- extracts user from auth.uid()
    -- captures before/after JSONB
  );
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Applied to each table:
CREATE TRIGGER audit_{table}
  AFTER INSERT OR UPDATE OR DELETE ON {table}
  FOR EACH ROW EXECUTE FUNCTION record_audit_log();
```

Migration 0086 adds filtering to reduce noise (e.g., skip `updated_at`-only changes).

---

## Service Role vs Anon Key

| Client | Key | Bypasses RLS | Used for |
|--------|-----|-------------|---------|
| `createClient()` server | Anon key | No | Normal API routes |
| `createAdminClient()` | Service role | **Yes** | Admin operations, workflow steps, bootstrap |

`createAdminClient()` should only be used when RLS would incorrectly block a legitimate server-side operation.

---

## Related Notes

- [[02 - Multi-Tenancy & Auth]]
- [[20 - Permissions System]]
- [[21 - Tenant Secrets & Security]]
- [[28 - Database Migrations]]
- [[24 - Database Schema]]
