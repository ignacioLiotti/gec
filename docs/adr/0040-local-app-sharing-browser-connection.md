# ADR 0040: Keep local browser authentication usable through a temporary tunnel

## Status

Accepted for local development on 2026-10-17. The user authorized starting the application and exposing it through Cloudflare for testing from another device.

## Context

The current development application uses a loopback Supabase gateway. A remote browser interpreting that URL would contact its own device. Exposing only Next therefore cannot support authentication or browser-side data access.

## Decision

Use a temporary loopback reverse proxy in `plans/2026-10-17-platform-telemetry/share-sintesis.mjs`. Ordinary requests reach the existing Next development server. Requests under `/__sintesis_supabase` reach only the local gateway's Auth, REST, Storage, Realtime and Functions paths. The proxy forwards caller credentials and never inserts an API key or token. Gateway management and other paths are excluded.

The browser factory uses that same-origin prefix only when all conditions hold: a development build, a configured loopback Supabase URL, and a browser visiting an HTTPS `*.trycloudflare.com` hostname. It preserves the configured gateway's original auth-cookie namespace so the unmodified server client can read the user's session. Production, remote Supabase URLs, local browsers and server rendering retain the configured connection.

Server-side clients keep their original configuration and connect directly to the local gateway. No environment file, database schema, account, permission or provider setting changes for this setup. Next's dev-resource origin is translated only when it exactly matches this tunnel's public origin. Other cross-site origins retain the existing Next checks. Application action origins are not rewritten.

## Verification and limits

The full Vitest suite passed, including browser-factory tests for the tunnel, cookie namespace and unaffected environments. A public mobile browser loaded the actual app and its login form without loopback resource requests or runtime errors. The gateway health endpoint responded. Anonymous queries returned no tenant, audit or usage rows, and the platform-operations API returned `403`.

The email form was exercised with an intercepted synthetic failure to verify its URL and error state without making a credential attempt. A successful user login still requires the user's own credentials. Google callback settings were not changed or verified for the temporary hostname; use the email form for this test session.

The helper and its tunnel are temporary processes. Their current URL, process IDs and sanitized verification receipt live in the ignored `.codex-temp/sintesis-share/` directory. This is not a production deployment or an isolated integration-test environment.
