# Conventions

Working agreements for humans and agents. `AGENTS.md` is the compact contract; this page is the explanation.

## Language

- **Domain terms are Spanish and canonical.** `CONTEXT.md` defines them (Plantilla Tenant, Instancia de Obra, Sincronizacion No Destructiva, Cambio Destructivo, Migration Run, Lineage Row Key, Baseline/Effective Schema Version…). Use them verbatim in code identifiers, docs, and PRs. Each entry lists names to *avoid* — respect those too.
- User-facing copy is Spanish (Argentine, voseo). Code infrastructure vocabulary is English.

## Change philosophy

- Small, focused diffs local to the requested behavior. No drive-by refactors or unrelated cleanup.
- Prefer existing patterns over new abstractions; look for prior art in the folder you're editing.
- Read the nearest `AGENT_CONTEXT.md` before editing; prefer local context over repo-wide scanning.
- Never commit automatically; commits happen when the author asks.

## Governed areas (check docs first, always)

| Area | Where the rules live |
| --- | --- |
| Database schema / migrations | `supabase/migrations/AGENT_CONTEXT.md`, `docs/obsidian-brain/28`, ADRs |
| Permissions / roles / RLS | ADRs 0012, 0016, 0023, 0024, 0026, 0028, 0029; `docs/obsidian-brain/31` |
| Extraction / OCR / lineage | ADRs 0001, 0002, 0007; `CONTEXT.md` lineage rules |
| Template↔obra sync & migrations | ADR 0009; `CONTEXT.md` Migration Run contract |
| Storage | ADRs 0014, 0018 |
| Data-flow / KPIs / layout | ADRs 0003, 0004, 0005, 0010, 0013 |

If a change in these areas has tradeoffs, write an ADR (`docs/adr/TEMPLATE.md`).

## UI

- Primitives from `@/components/ui/*`; never import `@/design-system/*` in app code.
- Token classes for color/spacing/surface/border/text; no hardcoded hex in product UI.
- Read `docs/styleguide/design-system.md` before visual changes; `docs/sintesis-ds.md` documents the migration patterns (lifted buttons, tray+chip tabs, notch details).
- Report/document output, charts, calendars, landing pages, and viewer canvases keep their own visual systems.

## Code style

- TypeScript throughout; `cn()` from `@/lib/utils` for class merging.
- Server/client boundary discipline: server-only helpers (service-role, secrets) must never be imported by client components.
- Comments state constraints the code can't express (timezone traps, RLS assumptions, ADR-backed invariants) — not narration of what the next line does.
- Tenant-scoped helpers accept `tenantId` explicitly; no ambient tenant state in `lib/**`.

## Handoff checklist

When finishing a change, report: files changed, behavior changed, checks run, risks, whether domain docs / ADRs / styleguide / local `AGENT_CONTEXT.md` need updates (or why not), and a suggested commit message.
