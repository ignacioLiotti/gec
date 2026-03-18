# API Reference

tags: #api #routes #reference

## Convention

All API routes:
- Live under `app/api/`
- Use Next.js App Router route handlers (`route.ts`)
- Require Supabase auth session (except public routes)
- Resolve tenant via `resolveTenantMembership()`
- Are RLS-protected at DB level

---

## Obras

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/obras` | List obras (`?q=`, `?limit=`, `?page=`) |
| POST | `/api/obras` | Create obra |
| POST | `/api/obras/bulk` | Bulk import obras |
| GET | `/api/obras/[id]` | Get obra |
| PATCH | `/api/obras/[id]` | Update obra |
| DELETE | `/api/obras/[id]` | Delete obra |
| GET | `/api/obras/[id]/certificates` | Obra's certificates |
| GET | `/api/obras/[id]/documents-tree` | File tree for obra |
| GET | `/api/obras/[id]/findings` | AI findings for obra |
| POST | `/api/obras/[id]/findings/evaluate` | Run findings evaluation |
| GET | `/api/obras/[id]/materials` | Material orders |
| POST | `/api/obras/[id]/materials` | Create material order |
| POST | `/api/obras/[id]/materials/import` | OCR import materials |
| GET | `/api/obras/[id]/memoria` | Get obra notes |
| PATCH | `/api/obras/[id]/memoria` | Update obra notes |
| GET | `/api/obras/[id]/pendientes` | Get pending items |
| POST | `/api/obras/[id]/pendientes` | Create pendiente |
| PATCH | `/api/obras/[id]/pendientes` | Update pendiente |
| GET | `/api/obras/[id]/rules` | Get obra rules |
| GET | `/api/obras/[id]/signals` | Get computed signals |
| POST | `/api/obras/[id]/signals/recompute` | Recompute signals |
| GET | `/api/obras/[id]/tables` | Get obra tables summary |

### Tablas
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/obras/[id]/tablas` | List tablas |
| POST | `/api/obras/[id]/tablas` | Create tabla |
| GET | `/api/obras/[id]/tablas/[tablaId]` | Get tabla schema |
| PATCH | `/api/obras/[id]/tablas/[tablaId]` | Update tabla |
| DELETE | `/api/obras/[id]/tablas/[tablaId]` | Delete tabla |
| GET | `/api/obras/[id]/tablas/[tablaId]/rows` | Get rows |
| POST | `/api/obras/[id]/tablas/[tablaId]/rows` | Add row |
| PATCH | `/api/obras/[id]/tablas/[tablaId]/rows` | Bulk update |
| POST | `/api/obras/[id]/tablas/[tablaId]/import/ocr` | OCR import |
| POST | `/api/obras/[id]/tablas/[tablaId]/import/csv` | CSV import |
| GET | `/api/obras/[id]/tablas/[tablaId]/documents` | Linked docs |
| GET | `/api/obras/[id]/tablas/ocr-links` | All OCR links |
| POST | `/api/obras/[id]/tablas/import/ocr-multi` | Multi-tabla OCR |
| POST | `/api/obras/[id]/tablas/import/spreadsheet-multi` | Multi spreadsheet |
| POST | `/api/obras/[id]/extracted-data/cleanup` | Cleanup orphans |

---

## Certificates
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/certificados` | List all certificates |
| POST | `/api/certificados` | Create certificate |
| GET | `/api/certificados/[id]` | Get certificate |
| PATCH | `/api/certificados/[id]` | Update certificate |
| DELETE | `/api/certificados/[id]` | Delete certificate |

---

## Macro Tables
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/macro-tables` | List macro tables |
| POST | `/api/macro-tables` | Create macro table |
| GET | `/api/macro-tables/templates` | List template tablas |
| GET | `/api/macro-tables/[id]` | Get macro table |
| PATCH | `/api/macro-tables/[id]` | Update macro table |
| DELETE | `/api/macro-tables/[id]` | Delete macro table |
| GET | `/api/macro-tables/[id]/rows` | Get aggregated rows |
| PATCH | `/api/macro-tables/[id]/rows` | Update custom values |
| GET | `/api/macro-tables/[id]/sidebar` | Sidebar config |
| GET | `/api/sidebar-macro-tables` | Sidebar-enabled tables |

---

## Admin
| Method | Path | Description |
|--------|------|-------------|
| GET/PATCH | `/api/main-table-config` | Main table column config |
| GET/POST | `/api/obra-defaults` | Obra default templates |
| POST | `/api/obra-defaults/apply` | Apply defaults to obras |
| GET/POST | `/api/obra-recipients` | Notification recipients |
| GET/POST | `/api/ocr-templates` | OCR extraction templates |
| POST | `/api/ocr-playground` | Test OCR extraction |
| GET/POST | `/api/tenant-secrets` | Tenant webhook secrets |
| GET | `/api/tenant-usage` | Usage stats |
| GET | `/api/maintenance/orphans` | Find orphaned records |

---

## Notifications & Calendar
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/notifications/emit` | External notification emit |
| GET/POST | `/api/calendar-events` | Calendar events CRUD |
| POST | `/api/events/reminders` | Create reminder events |
| POST | `/api/doc-reminders` | Fire document reminder |
| POST | `/api/schedules/dispatch` | Run scheduled jobs |
| POST | `/api/jobs/run` | Run specific job |

---

## Workflow
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/flujo-actions` | Trigger flujo action |
| POST | `/api/workflow-test` | Test workflow (admin) |

---

## Auth & Tenants
| Method | Path | Description |
|--------|------|-------------|
| GET | `/auth/callback` | OAuth callback |
| POST | `/api/tenants/[id]/switch` | Switch active tenant |
| POST | `/api/impersonate/start` | Start impersonation |
| POST | `/api/impersonate/stop` | Stop impersonation |

---

## APS (Autodesk)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/aps/token` | Get APS viewer token |
| POST | `/api/aps/upload` | Upload 3D model |
| GET | `/api/aps/status` | Check translation status |
| GET | `/api/aps/models` | List models |

---

## Reports & Export
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/reports/templates` | Report templates |
| GET/POST | `/api/reports/presets` | Filter presets |
| POST | `/api/reports/share` | Generate share token |
| POST | `/api/pdf-render` | Generate PDF |

---

## Misc
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/contact` | Contact form |
| POST | `/api/whatsapp/webhook` | WhatsApp incoming |

---

## Related Notes

- [[01 - Architecture Overview]]
- [[24 - Database Schema]]
