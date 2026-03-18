# Background Jobs

tags: #jobs #async #background #queue

## Overview

The app uses a **lightweight background job queue** backed by a Supabase table, processed by a cron endpoint. This handles long-running tasks that shouldn't block API requests.

---

## Database Table (migration 0076)

```sql
background_jobs
  id UUID
  type TEXT          — job type identifier
  payload JSONB      — job-specific data
  status TEXT        — "pending" | "running" | "done" | "failed"
  attempts INTEGER   — retry count
  locked_at TIMESTAMP — set when a worker picks it up
  error_message TEXT
  created_at, updated_at
```

---

## Job Types

| Type | What it does |
|------|-------------|
| `apply_default_folder` | Applies default folder template to existing obras |
| `remove_default_folder` | Removes a default folder from all obras |

---

## Processing Endpoint

`POST /api/jobs/run`

**Authorization:** Requires `x-cron-secret` header

**Algorithm:**
1. Fetch up to 25 `pending` jobs (ordered by created_at)
2. Lock each job: `SET status = 'running', locked_at = now()`
3. Execute job handler based on `type`
4. On success: `SET status = 'done'`
5. On failure: `SET status = 'failed', error_message = ...`
6. Returns `{ processed, failed, picked }`

**Note:** No automatic retry — failed jobs stay failed. Manual re-queue needed.

---

## Job Creation

Jobs are created by admin actions:

```
Admin changes default folder template
    ↓
INSERT INTO background_jobs (type: "apply_default_folder", payload: { folderId, tenantId })
    ↓
Next cron invocation picks it up
    ↓
Iterates all obras for tenant → applies folder structure changes
```

---

## Cron Schedule

Should be called frequently (every 1 minute) by external scheduler (Vercel Cron or similar):

```
# vercel.json or cron provider
POST /api/jobs/run   — every 1 min (with x-cron-secret header)
POST /api/schedules/dispatch — every 1 min (pendiente reminders)
```

---

## Related Notes

- [[12 - Workflow & Flujo System]]
- [[15 - Document Reminders & Pendientes]]
- [[19 - Admin Panel]]
- [[28 - Database Migrations]]
