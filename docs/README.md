# Documentation Index

All project documentation lives under `docs/`, plus three root-level files:

- [`../README.md`](../README.md) — project overview and quick start
- [`../CONTEXT.md`](../CONTEXT.md) — **canonical domain vocabulary and business rules** (required reading before touching domain logic)
- [`../AGENTS.md`](../AGENTS.md) / [`../CLAUDE.md`](../CLAUDE.md) — contract for AI agents working in this repo

## By audience

| You are… | Start here |
| --- | --- |
| A new developer | [dev/getting-started.md](dev/getting-started.md) |
| A customer / end user | [guide/README.md](guide/README.md) (Spanish) |
| An AI agent | `../AGENTS.md`, then the nearest `AGENT_CONTEXT.md` to your target folder |
| Reviewing architecture | [obsidian-brain/00 - Home.md](<obsidian-brain/00 - Home.md>) and [architecture/README.md](architecture/README.md) |
| Making a governed change (schema, permissions, extraction, migrations) | [adr/README.md](adr/README.md) |

## Directory guide

### `dev/` — developer handbook

Onboarding, project structure, testing, and conventions. Written for humans joining the project.

### `guide/` — customer-facing user guide (Spanish)

How to use the product: obras, documentos, extraccion, tablas, administracion.

### `obsidian-brain/` — architecture second brain

~40 interconnected notes covering every subsystem: multi-tenancy & auth, routing, dynamic tables, macro tables, OCR pipeline, workflows, notifications, reports, database schema, RLS, admin panel, invitations, WhatsApp, usage metering, and more. Open the folder as an Obsidian vault for the graph view; start at `00 - Home.md`. This is the deepest technical reference in the repo.

### `adr/` — architecture decision records

Numbered, immutable decisions with context and tradeoffs (`0001`–`00xx`). See [adr/README.md](adr/README.md) and [adr/TEMPLATE.md](adr/TEMPLATE.md). Create a new ADR when changing architecture, data model, storage, permissions, extraction flow, or anything with meaningful tradeoffs.

### `domain/` — domain docs

Deep domain write-ups that extend `CONTEXT.md` (e.g. [domain/insurance-policies.md](domain/insurance-policies.md)).

### `architecture/` — architecture docs

Cross-cutting technical contracts. See [architecture/README.md](architecture/README.md).

### `styleguide/` — design system & UI patterns

`styleguide/design-system.md` is required reading before changing product UI. See also [sintesis-ds.md](sintesis-ds.md) (design-system migration guide) and [styleguide/table-bulk-edit.md](styleguide/table-bulk-edit.md).

### `epics/` — product epics

Larger product initiatives (lineage/identity, global document-flow editor, data-flow visualization).

### `test-plan/` — manual test plans

E.g. [test-plan/obra-flows.md](test-plan/obra-flows.md).

## Operational runbooks (top level)

- [secrets-rotation.md](secrets-rotation.md) — rotating tenant/API secrets
- [supabase-backup.md](supabase-backup.md) — backup strategy
- [uptime-monitoring.md](uptime-monitoring.md) — monitoring setup
- [load-testing.md](load-testing.md) — load-test harness
- [orphan-cleanup.md](orphan-cleanup.md) — cleaning orphaned storage/rows
- [route-access-configuration.md](route-access-configuration.md) — configuring route access rules
- [mercadopago-billing-and-limits.md](mercadopago-billing-and-limits.md) — billing integration and plan limits
- [domain-split-rollout.md](domain-split-rollout.md) — domain rollout notes

## Planning & roadmap (top level)

- [roadmap.md](roadmap.md), [roadmap-feature.md](roadmap-feature.md), [roadmap-debt.md](roadmap-debt.md)
- [feature-map.md](feature-map.md) — feature inventory
- [domain-model-backlog.md](domain-model-backlog.md) — pending domain modeling work
- [todo-ocr-improvements.md](todo-ocr-improvements.md)

## Conventions for adding docs

- Domain semantics → `domain/` (and update `CONTEXT.md` if vocabulary changes)
- A decision with tradeoffs → new numbered ADR in `adr/`
- Subsystem explanation → new note in `obsidian-brain/` (link it from `00 - Home.md`)
- Folder-local guidance for agents → `AGENT_CONTEXT.md` next to the code
- Use the established Spanish domain terms; do not translate them ad hoc.
