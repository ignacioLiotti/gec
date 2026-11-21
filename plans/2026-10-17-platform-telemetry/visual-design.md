# Visual tenant operations console

Status: interactive proposal, 2026-10-17. The user explicitly requires a visual way to understand the platform in addition to the logic. The console is part of the feature scope. Operator-only access remains a provisional audience choice.

The local proposal is implemented in `visualizations/operations-console.html`. It is shown inline in the conversation, not deployed as an app route. The browser checks are reproducible with `node plans/2026-10-17-platform-telemetry/visualizations/check-operations-console.mjs` after regenerating the preview using the Visualize skill renderer. Results are in `visualizations/visual-verification.json`.

## Navigation and investigation

Use one console centered on tenants, with a global overview and shared selection. Six isolated dashboards would make an operator repeat tenant and period selection while investigating the same incident. Keep these six perspectives within one navigation system:

| View | Main visual | Investigation |
| --- | --- | --- |
| Resumen | Compact tenant comparison and matters needing attention | Identify a tenant or issue and continue into the relevant view |
| Tenants | Tenant rows with activity trends and a selected-tenant profile | Inspect active users and recent operations; enter a person's usage pattern |
| Uso de funciones | Function activity and a daily/weekly/monthly recurrence calendar | Select a feature/person and inspect repeated human tasks versus system outcomes |
| Costos | Service breakdown by tenant with priced and unpriced usage | Inspect known costs, their estimation/invoice basis and linked operations |
| Trazabilidad | Chronological changes with an inspectable field difference | See actor, initiating request, executor, allowed before/after values and operation stages |
| Salud y backups | Technical status plus recovery timeline and component coverage | Distinguish the last complete capture from an independently successful restore drill |

App navigation and tenant/period selectors belong in shared chrome. Feature/person controls belong in Uso de funciones; audit record selection belongs in Trazabilidad. Selected details preserve the investigation context. A selected tenant must not make a platform backup appear independently restorable for that tenant.

The prototype's observation-window selector appears only in Uso de funciones, where it changes the calendar. Overview and costs identify their own snapshot/billing scope. Human tasks and automated results are separate measurements. The individual-user list is explicitly a sample, with distinct fictional person histories and a way to return to tenant-wide activity.

## Visual language

Match the product's restrained neutral surfaces, orange action/selection accent, compact typography and dense structured tables. Apply colors only for real category or status meaning. Product implementation uses `@/components/ui/*` and tokens from `docs/styleguide/design-system.md`. The standalone proposal uses scoped equivalents; it does not introduce a second styling system into app code.

Every proposal screen carries a persistent fictional-data label. Unknown cost, no observed activity, missing coverage and unavailable source are separate states. Do not replace any of them with zero. Display source freshness near the visual it qualifies.

## Five journeys to validate

1. Select a tenant from Resumen or Tenants, inspect its users, and continue into feature usage while keeping the tenant selected.
2. Select a function/person and switch Día, Semana and Mes. Calendar marks, units and observation windows change together. Distinguish a tenant's combined activity from individual recurrence.
3. Inspect a tenant's service costs. Distinguish priced estimates or actual charges from missing prices and avoid presenting a partial sum as a complete total.
4. Select a creation, edit or configuration change. Show allowed changed fields and before/after values, then the initiating and executing identities and the operation stages. Sensitive values remain redacted.
5. Inspect recovery coverage across database, Auth, Storage and configuration. Show the last complete set and last successful restoration separately, including a clearly unverified state.

## Observation and task meaning

The production frequency view uses the metric definitions in the main plan: complete local-calendar observation windows, coverage and eligibility denominators, unique human task boundaries and separate system throughput. Daily/weekly/monthly views are independent observation scales. They are not a claim that all user behavior belongs to one exclusive frequency class.

The prototype uses synthetic values only. It illustrates interface behavior; no screen establishes customer adoption, operational cost, deployed health or backup success. Production endpoints must return explicit coverage/freshness, authorization and pagination alongside each source's results.

## Responsive and interaction acceptance

- All six navigation destinations render distinct content and preserve the tenant selection.
- Controls update the selected visual. Avoid decorative buttons implying a restore, export or mutation that does not exist.
- Tenant, feature, cadence and selected audit changes have observable results. Include a fictional new tenant with insufficient history and partial costs.
- Verify 320px, 736px and 1024px widths in light and dark appearance. Reflow chrome and tables without hiding essential controls or causing page-level horizontal overflow.
- Preserve semantic headings, native labeled controls, visible keyboard focus and a polite announcement for selection changes. Color is accompanied by labels.
- No backend request, credential, production dataset, schema change or remote mutation is needed for the local proposal.

## FigJam inspection and remaining documentation

Inspected Product OS `NDzN30GN3koTteiTdkgV3P` and Journeys 04 / Plataforma y Acceso `ySjUIomuoMG00LNK0sKajF` read-only during this visual design pass. Product OS includes the superadmin actor at `1:33`, admin navigation at `1:51`, and audit capability at `1:175`. Journeys 04 includes audit nodes such as `1:78`, `1:198` and `1:261` and the superadmin investigation flow beginning at `1:87`.

Those inspected boards do not provide the proposed connected tenant operations console. No board content or backlog state has been changed. Before shipping a product route, add the proposed console entry and the five investigation journeys to Product OS and Journeys 04, with accurate links, source-state branches and sanitized screenshots. Keep its status proposed until the implementation and source integration pass their checks. The local proposal must not be marked shipped.
