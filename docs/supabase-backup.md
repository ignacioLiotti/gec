# Supabase Backup + Restore Drill

## Nightly backup
1. Run `supabase db dump --db-url "$SUPABASE_DATABASE_URL" --schema public --data` from CI.
2. Upload the dump to an encrypted bucket (S3/GCS) under `backups/supabase/YYYY/MM/DD/HH.sql`.
3. Tag each backup with the git SHA + environment.

## Weekly restore verification
1. Spin up a disposable Supabase project (`supabase projects create ...`).
2. Apply the repo migrations: `supabase db push --db-url $TEMP_DB_URL`.
3. Restore the latest dump: `psql $TEMP_DB_URL < backups/.../latest.sql`.
4. Run smoke tests: `npm run vitest -- RunMode=ci -- test/smoke/*.test.ts`.
5. Tear down the temporary project to avoid costs.

## Reporting
- Log the duration + result of each drill in `docs/runbooks/backup-log.md`.
- Investigate failures immediately (permissions, migration drift, etc.).
- Keep at least 30 days of encrypted backups for compliance.
