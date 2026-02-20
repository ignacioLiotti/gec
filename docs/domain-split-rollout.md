# Domain Split Rollout (`sintesis.dev` + `app.sintesis.dev`)

This app now supports a controlled migration where authenticated users are moved from the marketing host to the app host.

## What was added

- `proxy.ts` host-based redirect:
  - If domain split is enabled and request host is the marketing host, authenticated users are redirected to app host.
  - Redirect preserves path and query.
  - `/api/*`, `/_next/*`, `/auth/callback`, `/.well-known/*`, and `/favicon.ico` are excluded.
- `components/domain-migration-guard.tsx`:
  - Client-side fallback for already-open sessions.
  - Shows a toast and redirects to app host after 15s for logged-in users on the marketing host.

## Environment variables

Set these in production:

- `ENABLE_DOMAIN_SPLIT=true`
- `APP_HOST=app.sintesis.dev`
- `MARKETING_HOST=sintesis.dev`
- `NEXT_PUBLIC_ENABLE_DOMAIN_SPLIT=true`
- `NEXT_PUBLIC_APP_HOST=app.sintesis.dev`
- `NEXT_PUBLIC_MARKETING_HOST=sintesis.dev`

## Guardrail for active users

During rollout, users already working on `sintesis.dev` can hit stale assets in an open tab.

- Server-side middleware catches next navigation/request and moves authenticated users to `app.sintesis.dev`.
- Client-side guard moves authenticated users even if they stay on an already-open page.

## API endpoints impact

- In this app deployment, `/api/*` behavior is unchanged.
- Middleware does not redirect `/api/*`.

For a full split with a separate marketing app, keep old sessions safe by adding a same-origin API proxy in the marketing app:

- Rewrite `/api/:path*` on `sintesis.dev` to `https://app.sintesis.dev/api/:path*` server-side.
- Keep it for a migration window, then remove once users have moved.
