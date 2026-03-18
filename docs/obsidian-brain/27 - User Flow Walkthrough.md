# User Flow Walkthrough

tags: #user-flow #ux #journey #walkthrough

## User Types

| Type | Role | What They Do |
|------|------|-------------|
| Tenant Admin | owner/admin | Configure system, manage users, view all data |
| Regular User | member | Work on obras, input data, view reports |
| Super Admin | (system) | Manage tenants, view cross-tenant data |

---

## Flow 1: New User Onboarding

```
1. Admin sends invitation from /admin/users
      ↓ email arrives with token link

2. User clicks link → /invitations/[token]
      ↓ validates token + email match
      ↓ creates tenant membership
      ↓ redirects to login

3. User logs in → Supabase Auth session created

4. Redirected to /excel (obras list)
      ↓ resolveTenantMembership() picks tenant from cookie
      ↓ Sidebar rendered with role-filtered nav items
```

---

## Flow 2: Daily Obra Work

```
1. User navigates to /excel
      ↓ Sees list of all obras (FormTable, obras-detalle config)
      ↓ Filtered/sorted by preference

2. Clicks obra row → /excel/[obraId]
      ↓ Page loads obra + defaults + tablas

3. General Tab (default)
      ↓ Reviews/edits obra details (budget, dates, progress)
      ↓ Sees Quick Actions panel

4. Clicks a Quick Action (e.g., "Cargar Factura")
      ↓ Stepper opens: "Paso 1: Subir factura PDF"
      ↓ User uploads → OCR triggers → data extracted
      ↓ "Paso 2: Verificar datos" → review extracted rows
      ↓ Complete → Documents refresh

5. Navigates to "Facturas" tabla tab
      ↓ FormTable shows extracted rows
      ↓ User edits/corrects any OCR errors inline

6. Goes to Documents tab
      ↓ Sees uploaded PDF
      ↓ Views OCR extraction result alongside document

7. Updates certification progress on General tab
      ↓ Saves obra (PATCH /api/obras/[id])
```

---

## Flow 3: Admin Configures New Obra Template

```
1. Admin goes to /admin/obra-defaults

2. Creates default folders:
      "Contratos/" "Facturas/" "Planos/" "Certificados/"

3. Marks "Facturas/" as OCR-enabled
      → links to "Facturas" tabla template
      → sets extraction schema (what fields to extract)
      → data_input_method = "ocr"

4. Creates default tabla "Facturas"
      → adds columns: proveedor, fecha, monto, descripcion

5. Creates Quick Action "Cargar Factura"
      → selects folders: ["facturas"] in order
      → saves

6. Next time any obra is created:
      → applyObraDefaults() seeds these folders + tablas
      → Quick Action appears in all obras
```

---

## Flow 4: Certificate Tracking

```
1. User goes to /certificados
      ↓ All certificates across obras (FormTable)

2. Filters by obra or date range

3. Adds new certificate:
      ↓ Click "+" → new row in table
      ↓ Fills: obra, number, date, amount
      ↓ Saves (POST /api/certificados)

4. When invoice sent:
      ↓ Edits "facturado" column → marks as invoiced

5. When payment received:
      ↓ Edits "cobrado" column → marks as collected

6. Exports to Excel for accountant:
      ↓ "Export" button → XLSX download
```

---

## Flow 5: Macro Table Reporting

```
1. Admin creates macro table at /admin/macro-tables/new
      ↓ Names it "Resumen Facturas"
      ↓ Source mode: template → selects "Facturas" template
      ↓ Maps columns: proveedor, fecha, monto from source fields
      ↓ Enables in sidebar

2. Sidebar shows "Resumen Facturas" under Macro section

3. User clicks → /macro/[id]
      ↓ Sees all "Facturas" rows from ALL obras aggregated
      ↓ Each row shows: obra name, proveedor, fecha, monto

4. User filters by date range

5. Exports to PDF → sends to management
```

---

## Flow 6: Obra Completion + Notifications

```
1. User marks obra as complete (sets completed_at)
      ↓ PATCH /api/obras/[id] with completed_at: now()

2. Server detects completion
      ↓ Triggers obra-complete workflow

3. Workflow runs:
      ↓ Looks up notification recipients
      ↓ emitEvent("obra.complete", ctx)
      ↓ For each recipient:
           - In-app notification inserted → Supabase Realtime → toast shows
           - Email sent via Resend
      ↓ Calendar event created: "Obra completada: [name]"

4. Admin checks /notifications
      ↓ Sees "Obra [name] completada" notification
      ↓ Clicks → navigates to obra
```

---

## Flow 7: Document Reminder

```
1. User creates pendiente on obra:
      "Presentar certificado medioambiental"
      due_date: 2024-04-15
      reminder_rules: [-7, -3, -1, 0]
      assigned_to: [user_id]

2. System schedules reminders:
      POST /api/events/reminders
      → Creates pendiente_schedules entries for each rule

3. On 2024-04-08 (7 days before):
      POST /api/schedules/dispatch finds due schedule
      POST /api/doc-reminders fires
      → In-app notification: "Vence en 7 días: Certificado medioambiental"
      → Email to assigned user

4. User checks notification → marks pendiente complete
```

---

## Flow 8: Shared Report

```
1. User views obras report at /excel (with filters applied)

2. Clicks "Compartir"
      ↓ POST /api/reports/share
      ↓ Token generated, stored with filter state
      ↓ Share URL copied: https://app.com/r/{token}

3. Sends URL to external stakeholder (no login needed)

4. Stakeholder opens /r/{token}
      ↓ Token validated
      ↓ Report rendered read-only with saved filters
      ↓ Optional: export to PDF
```

---

## Flow 9: Admin Impersonating a User

```
1. Admin goes to /admin/users
2. Clicks impersonate button next to a user
      ↓ POST /api/impersonate/start { user_id: targetId }
      ↓ Server: saves admin's tokens in httpOnly "impersonator_session" cookie
      ↓ Server: generates magic link OTP for target user
      ↓ Server: exchanges OTP → sets target user's auth cookies
      ↓ Client: location.reload()

3. Admin is now acting as the target user
      ↓ Yellow "ImpersonateBanner" shows at top
      ↓ All actions (edits, saves) happen as the target user

4. Admin clicks "Volver a mi cuenta"
      ↓ POST /api/impersonate/stop
      ↓ Server: reads impersonator_session cookie
      ↓ Server: supabase.auth.setSession(originalTokens)
      ↓ Clears impersonation cookies
      ↓ Page reloads as original admin
```

---

## Navigation Mental Model

```
/                          → Marketing landing (→ /dashboard if logged in)
/dashboard                 → Dashboard (Home)
/excel                     → All obras (manage projects)
/excel/[id]                → One obra (do the work)
  ?tab=general             → Edit obra details
  ?tab=[tabla]             → View/edit tabla data
  ?tab=documents           → Manage files
  ?tab=materials           → Material orders
  ?tab=memoria             → Notes
/certificados              → Financial tracking
/macro/[id]                → Cross-obra reports
/notifications             → Inbox
/admin/*                   → Configuration (admin only)
```

---

## Related Notes

- [[01 - Architecture Overview]]
- [[03 - Routing & Navigation]]
- [[04 - Obras (Construction Projects)]]
- [[06 - Excel View]]
