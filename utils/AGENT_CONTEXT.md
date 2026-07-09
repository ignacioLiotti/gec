# Agent Context: utils

## Purpose

Low-level runtime utilities: Supabase client factories and timezone-safe date helpers. This folder is intentionally tiny — most shared logic belongs in `lib/**`.

## Main files

- `supabase/server.ts` — server-side Supabase client (`createClient()`), cookie-bound; the standard way to authenticate in server components and API routes (`supabase.auth.getUser()`).
- `supabase/client.ts` — browser client (`createSupabaseBrowserClient()`); used by client components and hooks.
- `supabase/admin.ts` — **service-role client. Bypasses RLS.** Only for routes/jobs whose purpose makes the bypass explicit; callers must re-verify tenant scope themselves.
- `supabase/fetch.ts` — fetch wrapper used by the clients.
- `date.ts` — `parseLocalDate` / `formatLocalDate`: parse and format `YYYY-MM-DD` strings as **local** dates to avoid the UTC-midnight off-by-one-day bug (relevant for GMT-3 Argentina users). Always use these for date-only values instead of `new Date(str)`.

## Local rules

- Never import `admin.ts` from client code or generic helpers.
- Auth checks belong at the entry point (page/route), not buried in utilities.
- Any date-only column (vencimientos, fechas de certificado, etc.) goes through `date.ts` helpers.

## Related documentation

- `docs/obsidian-brain/02 - Multi-Tenancy & Auth.md`
- `docs/obsidian-brain/31 - RLS & Security Policies.md`

## Validation

- `pnpm lint`
- Changes to client factories are high-impact: run `pnpm test` and smoke-check an authenticated page.
