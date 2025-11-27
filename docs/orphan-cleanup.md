# Orphan Cleanup Job

- Endpoint: `POST /api/maintenance/orphans`
- Auth: `X-Cron-Secret` header (reuse `CRON_SECRET`). In non-production environments the secret is optional.
- Action: calls `public.cleanup_orphan_records()` which soft-deletes:
  - Certificates referencing removed obras
  - Pendientes referencing removed obras
  - Pendiente schedules referencing removed pendientes
  - Calendar events created for deleted obras

## Scheduling
Add a cron task (Supabase Edge Functions, GitHub Actions, or Render Cron) that executes hourly:

```bash
curl -s -X POST \
  -H "X-Cron-Secret: $CRON_SECRET" \
  https://app.yourdomain.com/api/maintenance/orphans
```

Responses return `{ ok: true, results: [{ entity, affected }] }` for observability.
