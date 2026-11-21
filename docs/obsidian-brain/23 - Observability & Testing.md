# Observability & Testing

tags: #testing #sentry #playwright #vitest #e2e

## Observability

### Sentry

Three Sentry configs for three runtimes:
- `sentry.client.config.ts` — browser errors, performance monitoring
- `sentry.server.config.ts` — server-side errors (API routes, server components)
- `sentry.edge.config.ts` — edge runtime (middleware)

`instrumentation.ts` — OpenTelemetry setup for distributed tracing
`instrumentation-client.ts` — client-side instrumentation hooks

Health check: `GET /api/health` — simple 200 OK for uptime monitoring.

---

## Testing strategy

The target is documented in [Testing the application through its contracts and user journeys](../test-plan/testing-strategy.md). It maps all 40 product workflows to domain contracts, real-component browser workflows, route/local-DB integration and complete customer journeys.

The [2026-10-17 audit](../../plans/2026-10-17-test-strategy/README.md) reviewed every test and runtime-check entry. Its baseline was 38 Vitest files and 233 passing cases. The cleanup retains useful parsing, security, financial and state tests; it replaces circular expected values and shallow output checks, and removes duplicate and CSS-implementation cases. The current runner totals and proof are in the audit verification artifacts.

### Fast domain and boundary checks

`npm test` uses Vitest. `vitest.config.ts` currently selects `tests/**/*.test.ts` in a Node environment. Most tests call public domain functions; files under `tests/components` do not mount a React tree merely because of their directory name.

Use concrete outcomes, independent expected values and meaningful state sequences. A returned byte array does not prove a report contains data. A mock that ignores query predicates does not prove tenant isolation. The audit's controlled MercadoPago mutation showed that a broken signature constructor could pass all 18 original billing cases; the replacement independent fixture rejects it.

### Browser checks

`playwright.config.ts` discovers the authenticated route/API suite under `tests/e2e`. Existing obra create/reload and lineage reimport/override/conflict contracts are useful. Discovery and source review do not establish that those journeys ran successfully.

Storybook and the portfolio guide contain real production components with fixture APIs as well as copied demonstration screens. Label those boundaries. The document-generation runtime mounts the real client under Strict Mode, delays API responses and checks revision preservation, generation content, focus/caret and stale-context handling. It fails on console, page and HTTP resource errors. It does not access a real database, storage or PDF renderer.

`portfolio:check` runs the retained interaction/journey validators. The redundant broad screenshot smoke is available as `portfolio:capture`; artifact capture does not count as a separate user-journey test. Manual design-demo validators remain outside product coverage.

### Local integration execution

Test discovery needs no credentials or server:

```text
npm exec playwright test -- --list
```

`npm run test:e2e` creates an owned temporary app and Supabase project with generated local configuration. `npm run test:e2e:public` starts only the temporary app. The runner excludes `.env*`, ordinary seeds and external auth, preserves the production proxy/instrumentation, and records per-run reports. Direct execution needs the matching run manifest. See [ADR 0039](../adr/0039-owned-local-integration-fixtures.md), which replaces manual environment selection from ADR 0038.

The shared auth file and fixed tenant/user helpers were removed. Each test attempt owns two tenants and lazy synthetic actors with real SSR sessions. Specs verify business behavior through actor requests and anon-key RLS clients; administrator observers are limited to setup and lifecycle checks. Cleanup verifies contexts, Auth, profiles and Storage. Product soft-delete triggers retain SQL rows, so their durable manifests remain `awaiting-stack-disposal` until the runner verifies removal of the owned containers, volumes and network, plus the app process, port and snapshot. Marking a scope `disposed` preserves its runtime-cleanup errors. Actual proof remains separate from source review and discovery; current results are in the [integration implementation](../../plans/2026-10-17-isolated-integration/README.md).

### CI and current gaps

No CI definition was discovered under `.github/workflows` during this audit. An external CI service may exist; this repository does not establish its gates. Proposed PR, merge, nightly and provider-sandbox gates are in the target strategy.

The largest missing integration proofs are tenant/permission enforcement, onboarding and invitations, document storage/OCR/report lifecycle, review/approval/PDF generation, scheduled automation/idempotency, and persisted billing transitions. Existing unit/helper tests remain useful but do not fill those gaps.

## Related notes

- [[01 - Architecture Overview]]
- [[26 - Key Libraries & Utilities]]
- [Manual obra flow plan](../test-plan/obra-flows.md)
- [Local test instructions](../../tests/AGENT_CONTEXT.md)
