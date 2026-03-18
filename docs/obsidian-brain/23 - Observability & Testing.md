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

## Testing Strategy

### Unit Tests (Vitest)

`vitest.config.ts` + `vitest.setup.ts`

Location: `tests/lib/` and `tests/components/`

**Current unit tests:**
```
tests/lib/
  tablas.test.ts                          — date/number parsing, formula eval
  spreadsheet-preview-summary.test.ts     — spreadsheet parsing
  http/validation.test.ts                 — HTTP input validation
  security/rate-limit.test.ts             — rate limiter logic
  macro-table-source-selection.test.ts    — macro source resolution

tests/components/
  form-table/cell-suggestions.test.ts     — autocomplete suggestions
```

**Key tested logic:**
- `parseFlexibleDateValue()` — handles all date format variants
- `parseLocalizedNumber()` — European vs US number formats
- `evaluateTablaFormula()` — formula safety and evaluation
- `resolveMacroSourceTablas()` — template vs manual source resolution

### E2E Tests (Playwright)

`playwright.config.ts`

Location: `tests/e2e/`

**Setup:**
- `tests/e2e/auth.setup.ts` — authenticates test user, stores auth state
- `tests/e2e/helpers/auth.ts` — auth helpers
- `tests/e2e/helpers/obras.ts` — obra creation/cleanup helpers

**Test suites:**
```
tests/e2e/
  excel-navigation.spec.ts    — navigate between obra tabs
  excel/
    api/obras-api.spec.ts     — API endpoint tests
    ui/page.spec.ts           — UI smoke tests for excel view
```

**Test patterns:**
- API tests: direct HTTP requests to API routes
- UI tests: browser automation, full user flow
- Auth: Playwright's built-in auth state storage (avoids re-login per test)

---

## Test Data

Tests use a dedicated test tenant + test user. Obras created in tests are cleaned up after.

`tests/e2e/helpers/obras.ts`:
```typescript
createTestObra(page) → creates obra, returns { id, cleanup }
```

---

## CI/CD

Tests run via GitHub Actions (or similar). The existing `test-plan/` in docs defines the manual test protocol.

---

## Related Notes

- [[01 - Architecture Overview]]
- [[26 - Key Libraries & Utilities]]
