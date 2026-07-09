# Agent Context: supabase

## Purpose

Local Supabase project configuration, SQL migrations, and seed data. Everything here shapes the database contract the entire app depends on — highest-impact folder in the repo.

## Main files

- `config.toml` — local stack configuration (API on `54321`, Postgres on `54322`).
- `migrations/` — ordered SQL migrations. **Read `supabase/migrations/AGENT_CONTEXT.md` before creating or editing any migration.**
- `seed.sql` — local seed data applied by `pnpm db:reset`.
- `snippets/` — saved SQL snippets for development.

## Local rules

- Schema, RLS, storage policies, and permissions are ADR-governed. Do not change them without checking `docs/adr/` and `CONTEXT.md` (Migration Run contract, compatibility taxonomy, destructive-approval rules).
- Migrations are append-only: never edit an applied migration; write a new one.
- Every tenant-scoped table needs RLS policies; verify against `docs/obsidian-brain/31 - RLS & Security Policies.md`.
- `pnpm db:reset` is destructive (local only). `pnpm db:push` / `db:push:remote` are high-impact — confirm intent first.

## Related documentation

- `supabase/migrations/AGENT_CONTEXT.md` (the detailed contract)
- `docs/obsidian-brain/24 - Database Schema.md`
- `docs/obsidian-brain/28 - Database Migrations.md`
- `docs/obsidian-brain/31 - RLS & Security Policies.md`
- `docs/supabase-backup.md`

## Validation

- `pnpm db:reset` locally and boot the app against it.
- Run targeted Vitest for helpers reading the changed tables.
