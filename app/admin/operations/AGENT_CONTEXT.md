# Agent context: platform operations

`page.tsx` loads the authorized server snapshot. `operations-client.tsx` owns shared URL selection. `operations-views.tsx` and `operations-console.module.css` own the six views. Never load admin clients or raw audit JSON in a client component.

Read `docs/domain/platform-operations.md`, `docs/architecture/platform-operations.md`, and ADR 0039 before changing measurements, correlation, privacy, or recovery semantics. Data comes from `lib/admin/operations/server.ts` and the private no-store `/api/admin/operations` route. The loader requires effective superadmin access before creating the admin client, including during permission simulation.

Every value describes a bounded observed sample. Keep partial/unavailable sources, unknown prices, excluded human-attribution flags, complete UTC activity days, and the partial live day visible. Audit row changes are not human tasks. An OCR attempt is not an exactly-once business action. Keep historical mutable document state distinct from phase events.

`stories/operations-console-fixture.ts` and its stories exercise the actual client with synthetic data. The isolated browser verifier is `node plans/2026-10-17-platform-telemetry/runtime-preview.mjs`; it bundles only the fixture, serves loopback temporarily, and never uses application credentials. It does not prove production queries, RLS, or backup recovery. Do not start or rebuild the user's Next server.

Checks: targeted `tests/lib/admin/operations*.test.ts`, OCR observation/recovery tests, focused ESLint, `npm run check:ui`, and `npm run typecheck:storybook`. Visible flow changes also require the Product OS and Journeys 04 FigJam updates described in `app/AGENT_CONTEXT.md`.
