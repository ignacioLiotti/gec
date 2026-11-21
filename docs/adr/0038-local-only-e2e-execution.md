# ADR 0038: Explicit local targets for mutating E2E tests

## Status

Initial local guard implemented on 2026-10-17. Runtime selection and shared fixture setup are superseded by [ADR 0039](0039-owned-local-integration-fixtures.md). The loopback guard remains a second check inside authenticated fixtures.

## Context

The Playwright setup loaded ordinary development environment files, accepted arbitrary app/Supabase URLs and provisioned an owner through a service-role client. Its helpers reuse a fixed tenant and may update an existing auth user's password. Running the suite could therefore mutate a configured remote or ordinary development environment.

## Decision

Require an explicit disposable-local marker and loopback HTTP(S) app/Supabase URLs before starting the server or constructing service-role fixture clients. Load only a dedicated ignored `.env.e2e.local` for execution. Do not reuse an existing app server with unknown configuration. Reject credentials embedded in URLs and report missing configuration names without their values.

Start the fixed `npm run dev` command and reject custom `PLAYWRIGHT_WEB_SERVER_COMMAND` values, which could replace the child's validated target. Pass the validated URL/keys explicitly to that process and set its `SUPABASE_SERVICE_ROLE_KEY_VERSION` selector to an empty value. The admin-client secret resolver then uses the same plain local key as the fixture helpers, including when ordinary Next environment files contain version selectors.

Test discovery remains credential-free and starts no server. The guard is tested with synthetic configuration and no network calls. This task does not provision users, run migrations, contact a database or exercise authenticated journeys.

## Consequences

Remote preview/prod E2E execution and implicit reuse of an ordinary dev server stop working by design. A future remote sandbox runner needs a separate reviewed ownership contract, not a bypass flag in this guard.

The local marker cannot prove that an instance is disposable. Fixed tenant/user reuse, partial setup cleanup, retry safety and user-scoped RLS evidence still need replacement before claiming isolated integration testing. These limitations and the migration order are documented in `docs/test-plan/testing-strategy.md`.

No production route, permission, database schema or dependency changes are part of this decision.
