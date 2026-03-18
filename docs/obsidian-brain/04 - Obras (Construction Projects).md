# Obras (Construction Projects)

tags: #obras #core-entity #crud

## What is an Obra?

An **obra** (Spanish for "construction work/project") is the **central entity** of the entire application. Everything else — tablas, documents, certificates, materials, workflows — belongs to an obra.

Think of an obra as a construction project record with:
- Identity data (name, location, client)
- Financial data (budget, certified amounts, invoiced, collected)
- Progress data (percentage complete, timeline dates)
- Linked assets (documents, tablas, materials, certificates)

---

## Obra Data Fields

Actual DB column names (snake_case):

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `tenant_id` | UUID | Owning tenant |
| `n` | number | Project number (unique per tenant) |
| `designacion_y_ubicacion` | text | Project name + location description |
| `sup_de_obra_m2` | number | Surface area (m²) |
| `entidad_contratante` | text | Contracting entity/client |
| `mes_basico_de_contrato` | text | Base contract month |
| `iniciacion` | text | Start date |
| `contrato_mas_ampliaciones` | currency | Total contract value inc. amendments |
| `certificado_a_la_fecha` | currency | Amount certified to date |
| `saldo_a_certificar` | currency | Remaining to certify |
| `segun_contrato` | currency | Amount per contract |
| `prorrogas_acordadas` | number | Extension months agreed |
| `plazo_total` | number | Total project duration (months) |
| `plazo_transc` | number | Elapsed time (months) |
| `porcentaje` | number 0-100 | **Completion %** — KEY FIELD, triggers completion at 100 |
| `custom_data` | JSONB | Tenant-specific custom fields |
| `on_finish_first_message` | text | Completion email message 1 |
| `on_finish_second_message` | text | Follow-up email message |
| `on_finish_second_send_at` | timestamp | When to send follow-up |
| `deleted_at` | timestamp | Soft delete |
| `updated_at` | timestamp | Last update |

---

## Obra Lifecycle

```
Create obra (POST /api/obras)
    ↓
applyObraDefaults() — seeds default folders + tablas from admin templates
    ↓
Active obra — user works in /excel/[obraId]
    ↓ adds documents, fills tablas, tracks materials, certificates
    ↓
Mark obra complete
    ↓
Completion workflow triggers (emails, notifications, calendar events)
    ↓
Archived obra
```

---

## API Routes

All routes are tenant-scoped (RLS).

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/obras` | List obras (with `?q=`, `?limit=`, `?page=`) |
| POST | `/api/obras` | Create obra |
| GET | `/api/obras/[id]` | Get single obra |
| PATCH | `/api/obras/[id]` | Update obra fields |
| DELETE | `/api/obras/[id]` | Delete obra |
| POST | `/api/obras/bulk` | Bulk import obras |

### Query Parameters
- `?q=` — full-text search
- `?limit=` — pagination limit (default 50)
- `?page=` — page number
- Returns `{ detalleObras: [...] }` shape

---

## Obra Defaults (Template Seeding)

When a new obra is created, `applyObraDefaults()` runs:

```
lib/obra-defaults.ts
lib/obra-defaults/apply-default-folder.ts
lib/obra-defaults/remove-default-folder.ts
```

**What gets seeded:**
- Default folder structure in Supabase storage
- Default tablas (with pre-defined column schemas)
- OCR-enabled folders linked to specific tablas

Admin configures defaults at `/admin/obra-defaults`.

---

## Obra Completion

Triggered when `porcentaje` transitions to `100` (via PATCH/PUT):
1. Emits `obra.completed` event via notification engine
2. `workflows/obra-complete.ts` (Temporal workflow) runs:
   - Sends initial completion email (immediately)
   - Sleeps until `on_finish_second_send_at`
   - Sends follow-up email
3. Creates calendar events for recipients
4. Schedules pendiente reminders (4-stage: -7d, -3d, -1d, 0d)
5. If `porcentaje` reverts back to < 100: calendar events cleaned up

When obra reverts from 100% to <100%:
- Outstanding workflow runs cancelled via `lib/workflow/cancel.ts`

Recipients defined via `/api/obra-recipients` — admins configure who gets notified.

---

## Related Notes

- [[05 - Tablas (Data Tables)]]
- [[06 - Excel View]]
- [[08 - Certificados (Certificates)]]
- [[09 - Materials & Orders]]
- [[10 - Documents & File Manager]]
- [[11 - Quick Actions]]
- [[12 - Workflow & Flujo System]]
