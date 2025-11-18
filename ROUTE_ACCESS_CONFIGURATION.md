# Route Access Control Configuration Guide

## Overview

This guide explains exactly where and how to configure route access control and sidebar navigation in your multi-tenant application.

## Configuration Files

### 1. Route Access Control (Which routes require which roles)

**File: `lib/route-access.ts`**

This file controls which routes are protected and which roles can access them.

**Location:** `lib/route-access.ts` - Lines 39-57

**To add a new protected route:**

```typescript
export const ROUTE_ACCESS_CONFIG: RouteAccessConfig[] = [
  {
    path: "/certificados",
    allowedRoles: ["admin", "contable"],
  },
  {
    path: "/excel",
    allowedRoles: ["admin", "contable"],
  },
  {
    path: "/excel/[obraId]",
    allowedRoles: ["admin", "contable"],
  },
  // ADD YOUR NEW ROUTE HERE:
  {
    path: "/your-new-route",
    allowedRoles: ["admin", "contable"], // or ["admin"] for admin-only
  },
];
```

**Important Notes:**
- Routes NOT listed here are accessible by ALL authenticated users
- Routes with empty array `[]` are accessible by ALL authenticated users
- `admin` role ALWAYS has access to everything (checked separately)
- Dynamic routes use `[param]` syntax (e.g., `/excel/[obraId]` matches `/excel/123`)

---

### 2. Sidebar Navigation (Which menu items appear)

**File: `components/app-sidebar.tsx`**

This file controls what appears in the sidebar navigation menu.

**Location:** `components/app-sidebar.tsx` - Lines 50-89

**To add a new navigation item:**

```typescript
// Main navigation (shown to all users, filtered by role access)
const navItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/",
    icon: Home,
  },
  // ADD YOUR NEW ITEM HERE:
  {
    title: "Your New Page",
    href: "/your-new-page",
    icon: YourIcon, // Import from lucide-react
  },
];

// Admin section (only shown to admins/superadmins)
const adminItems: NavItem[] = [
  {
    title: "Users",
    href: "/admin/users",
    icon: Users,
  },
  // ADD ADMIN-ONLY ITEMS HERE
];
```

**Important Notes:**
- Items in `navItems` are filtered based on route access config
- Items in `adminItems` are ONLY shown to admins/superadmins
- Items in `devItems` are shown to everyone (typically for development)

---

### 3. User Roles Display (Debugging)

**File: `components/auth/user-menu.tsx`**

The user dropdown menu now shows the current user's roles for debugging purposes.

**Location:** `components/auth/user-menu.tsx` - Lines 133-159

Roles are automatically displayed as colored badges:
- **SuperAdmin** (purple badge)
- **Admin** (blue badge) 
- **Role names** (orange badges, e.g., "contable")
- **No roles** (gray badge)

---

## How It Works

1. **Route Protection:**
   - Routes configured in `lib/route-access.ts` are checked
   - If you add middleware back, unauthorized users are redirected
   - Currently middleware is disabled (was causing 404s)

2. **Sidebar Filtering:**
   - Sidebar automatically filters items based on user roles
   - Uses the same `ROUTE_ACCESS_CONFIG` to determine visibility
   - Admin items are always hidden from non-admins

3. **Role Hierarchy:**
   - SuperAdmin > Admin > Custom Roles (e.g., "contable")
   - Admins can access everything
   - Custom roles can only access routes they're assigned to

---

## Quick Reference

| What to Configure | File | Lines |
|------------------|------|-------|
| **Route Access Control** | `lib/route-access.ts` | 39-57 |
| **Sidebar Navigation** | `components/app-sidebar.tsx` | 50-89 |
| **User Roles Display** | `components/auth/user-menu.tsx` | 133-159 |
| **Layout (passes roles)** | `app/layout.tsx` | 49-50, 78 |

---

## Example: Adding a New Protected Route

1. **Add route to access config** (`lib/route-access.ts`):
```typescript
{
  path: "/reports",
  allowedRoles: ["admin", "contable"],
}
```

2. **Add to sidebar** (`components/app-sidebar.tsx`):
```typescript
{
  title: "Reports",
  href: "/reports",
  icon: FileText, // or any icon from lucide-react
}
```

3. **Create the page** (`app/reports/page.tsx`):
```typescript
export default function ReportsPage() {
  return <div>Reports Page</div>;
}
```

That's it! The route will be protected and the sidebar item will only show to users with the required roles.


