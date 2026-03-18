# Superadmin Implementation

tags: #security #superadmin #admin #database

## Overview

The superadmin is a **hardcoded, elevated user** that bypasses all tenant restrictions. This is not a configurable role — it's a single UUID baked into triggers and functions.

---

## Hardcoded Identity

| Field | Value |
|-------|-------|
| User ID | `77b936fb-3e92-4180-b601-15c31125811e` |
| Email | `ignacioliotti@gmail.com` |
| Profile flag | `profiles.is_superadmin = true` |

---

## Auto-Enrollment in Every Tenant

Two database triggers enforce superadmin presence (migrations 0027, 0028):

### Trigger 1: Auto-add on new tenant creation
```sql
CREATE OR REPLACE FUNCTION add_superadmin_to_new_tenant()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO memberships (tenant_id, user_id, role)
  VALUES (NEW.id, '77b936fb-3e92-4180-b601-15c31125811e', 'owner')
  ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = 'owner';
  RETURN NEW;
END;
$$;

CREATE TRIGGER add_superadmin_to_tenant
  AFTER INSERT ON tenants
  FOR EACH ROW EXECUTE FUNCTION add_superadmin_to_new_tenant();
```

### Trigger 2: Force owner role — cannot be demoted
```sql
CREATE OR REPLACE FUNCTION ensure_superadmin_membership()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.user_id = '77b936fb-3e92-4180-b601-15c31125811e' THEN
    NEW.role := 'owner';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_superadmin_role
  BEFORE INSERT OR UPDATE ON memberships
  FOR EACH ROW EXECUTE FUNCTION ensure_superadmin_membership();
```

**Result:** Any attempt to set `role = 'member'` on the superadmin UUID is silently overridden to `'owner'`.

---

## RLS Bypass via Helper Functions

All three permission helper functions include a superadmin short-circuit:

```sql
-- is_member_of(tenant uuid)
SELECT COALESCE(
  (SELECT p.is_superadmin FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1),
  false
) OR EXISTS (
  SELECT 1 FROM public.memberships m
  WHERE m.tenant_id = tenant AND m.user_id = auth.uid()
);

-- is_admin_of(tenant uuid) — same pattern
-- has_permission(tenant uuid, perm_key text) — superadmin returns TRUE immediately
```

These functions are `SECURITY DEFINER SET search_path = public, pg_temp` to prevent both RLS recursion and schema injection attacks.

---

## RLS Policy Override (migration 0056)

In addition to function bypasses, a direct superadmin RLS policy was added to all tables:

```sql
CREATE POLICY "superadmin read tenants" ON public.tenants
  FOR SELECT USING (public.is_superadmin());

-- Applied to: tenants, obras, certificates, memberships, notifications,
-- macro_tables, obra_tablas, and all other major tables
```

This means superadmin queries never touch `memberships` subqueries.

---

## Impersonation (App-Level)

Beyond DB-level bypass, the app supports **tenant impersonation** without re-auth:

- Superadmin can switch to any tenant via the org switcher in the sidebar
- `ACTIVE_TENANT_COOKIE` is set to the target tenant ID
- All API calls then run under that tenant's context
- The `/admin` panel shows cross-tenant management views

**Server-side check pattern:**
```typescript
// lib/tenant-selection.ts
if (profile.is_superadmin) {
  // Allow any tenant_id in cookie
  return { tenantId: cookieTenantId, role: 'owner' };
}
```

---

## Admin Panel Access

Routes under `/admin/*` are superadmin-only:

```
/admin                    → Overview
/admin/tenants            → All tenants list
/admin/tenants/[id]       → Tenant details + impersonation
/admin/users              → All users across tenants
/admin/macro-tables       → Global macro table management
/admin/roles              → Role template management
```

Enforcement happens in page-level server components via `getUser()` + `is_superadmin` check.

---

## Design Trade-offs

| Trade-off | Decision |
|-----------|----------|
| Single superadmin vs multiple | Single hardcoded UUID — simpler, no management surface |
| DB-level vs app-level | Both — DB triggers prevent demotion, app checks allow impersonation |
| Visible in audit log | Yes — superadmin actions appear with their user_id as actor |
| Rate limiting bypass | No — superadmin is still subject to IP/tenant rate limits |

---

## Related Notes

- [[02 - Multi-Tenancy & Auth]]
- [[19 - Admin Panel]]
- [[20 - Permissions System]]
- [[31 - RLS & Security Policies]]
- [[28 - Database Migrations]]
