# CLAUDE.md

Guidance for Claude Code and other Claude-based agents working in this repository.

## Project

This is a Next.js multi-tenant obras platform. The domain centers on tenants, obras, document extraction, editable tables, cross-obra consolidation, schema/version governance, permissions, and migration safety.

Use the project language in `CONTEXT.md` when discussing domain concepts. Avoid inventing alternate names for established terms such as `Plantilla Tenant`, `Instancia de Obra`, `Sincronizacion No Destructiva`, `Cambio Destructivo`, `Migration Run`, `Baseline Schema Version`, and `Effective Schema Version`.

## First Rules

- Follow `AGENTS.md`; it is the shared agent contract for this repo.
- Keep changes small, focused, and local to the requested behavior.
- Prefer existing patterns over new abstractions.
- Do not commit automatically unless the user explicitly asks.
- Do not change database schema, storage, permissions, extraction flows, tenant behavior, or migration behavior without checking the relevant docs and ADRs first.

## Before Editing

1. Identify the target folder for the change.
2. Read the nearest `AGENT_CONTEXT.md` if one exists.
3. Prefer local context over scanning the whole repository.
4. Read direct imports before expanding into sibling folders.
5. Only inspect sibling folders when there is a concrete dependency, failing check, or unclear contract.
6. Check related documentation referenced by local context.

## Design System

- Before changing product UI, read `docs/styleguide/design-system.md`.
- App code should import UI primitives from `@/components/ui/*`; do not import directly from `@/design-system/*` unless editing the design-system layer itself.
- Use the documented token classes for product UI colors, spacing, surfaces, borders, and text.
- Preserve domain-specific visual systems for report/document output, charts, calendars, landing pages, and viewer canvases unless the task explicitly targets them.

Common context locations:

- Root domain vocabulary: `CONTEXT.md`
- Documentation index: `docs/README.md`
- Domain docs: `docs/domain`
- ADRs: `docs/adr`
- Architecture docs: `docs/architecture`
- Styleguide docs: `docs/styleguide`
- Developer handbook: `docs/dev` (getting started, structure, testing, conventions)
- Customer user guide (Spanish): `docs/guide`
- Local agent context: every major top-level folder has an `AGENT_CONTEXT.md` (`app/`, `app/api/`, `components/`, `components/ui/`, `lib/`, `hooks/`, `utils/`, `supabase/`, `tests/`, `scripts/`, `workflows/`, `emails/`, plus deeper feature folders)

## Development Commands

Use the smallest relevant check first.

```bash
pnpm lint
pnpm test
pnpm test:e2e
pnpm build
pnpm dev
```

Targeted Vitest and Playwright checks are preferred when the changed surface is narrow. Use route or API smoke checks when relevant.

Supabase scripts exist for local development:

```bash
pnpm supabase:start
pnpm supabase:status
pnpm supabase:stop
pnpm db:reset
pnpm db:push
```

Treat database and migration commands as high-impact. Confirm intent and review relevant docs before using them.

## Documentation Decisions

Before proposing a commit or handing work back, decide whether the change requires updates to:

- `docs/domain`
- `docs/adr`
- `docs/architecture`
- `docs/styleguide`
- local `AGENT_CONTEXT.md`

Create or update an ADR when changing architecture, data model, storage, permissions, extraction flow, important dependencies, or any decision with meaningful tradeoffs.

## Handoff Checklist

When finishing code changes, report:

- Files changed
- Behavior changed
- Checks run
- Risks or follow-up concerns
- Whether domain docs, ADRs, styleguide docs, or local agent context were updated, or why they were not needed
- Suggested commit message, if the user is likely to commit

# Model Selection Guide

| Model    | Cost | Intelligence | Taste | Best Use                                            |
| -------- | ---- | ------------ | ----- | --------------------------------------------------- |
| GPT-5.5  | 9    | 9            | 8     | Large implementations, coding, analysis, migrations |
| Sonnet 5 | 5    | 8            | 7     | General-purpose Claude default                      |
| Opus 4.8 | 4    | 8            | 8     | Design reviews, architecture, second opinions       |
| Fable 5  | 7    | 5            | 9     | UI/UX, copywriting, product thinking, API design    |

## Rating Definitions

- **Cost** reflects my actual usage cost, not vendor list prices. OpenAI usage is effectively free for my workflow because of generous limits.
- **Intelligence** measures how difficult a task can be delegated to the model without supervision.
- **Taste** measures judgment in areas like:
  - UI/UX
  - API design
  - software architecture
  - code quality
  - writing and copy
  - product decisions

When work will be shipped to users, **taste matters almost as much as intelligence.**

---

# Model Selection Rules

These are defaults, not hard rules.

You have standing permission to upgrade to a more capable model whenever the current one is producing mediocre work.

Never optimize for model cost at the expense of output quality.

The priority order is:

```
Intelligence > Taste > Cost
```

Cost should only be used as a tiebreaker between models that are otherwise equally suitable.

---

# Which Model to Use

## GPT-5.5

Use for:

- large implementations
- mechanical coding
- refactors
- migrations
- debugging
- data analysis
- investigation
- long-running coding tasks
- anything with a precise specification

GPT-5.5 is the default workhorse.

---

## Sonnet 5

Use for:

- everyday Claude tasks
- planning
- brainstorming
- lightweight implementation
- orchestration
- wrapper agents

---

## Opus 4.8

Use for:

- reviewing implementations
- reviewing architecture
- validating plans
- second opinions
- difficult design decisions

It is often valuable to review GPT-5.5 output with Opus before shipping.

---

## Fable 5

Use whenever taste is the dominant requirement:

- UI
- UX
- API ergonomics
- product decisions
- copywriting
- naming
- documentation
- user-facing content

Anything visible to end users should generally involve a model with **Taste ≥ 7**.

---

# Model Escalation

If the current model produces output below the expected quality bar:

1. Retry if the issue is prompt-related.
2. Switch to a stronger model.
3. Continue without asking for permission.

Shipping mediocre work is more expensive than using a better model.

---

# Models to Avoid

## Haiku

Never use Haiku.

---

# GPT-5.5 Access

GPT-5.5 is only available through the Codex CLI.

Typical commands:

```bash
codex exec
codex review
```

My `~/.codex/config.toml` already defaults to GPT-5.5.

Prefer the built-in skills whenever applicable:

- codex-implementation
- codex-review
- codex-computer-use

For work outside those skills (research, investigation, analysis, custom workflows), use:

```bash
codex exec -s read-only
```

with a fully self-contained prompt.

---

# Using GPT-5.5 from Claude Workflows

Claude workflow `model` parameters only support Claude models.

When a workflow should use GPT-5.5:

1. Spawn a lightweight Sonnet 5 agent (`effort: low`).
2. Have it generate a complete, self-contained Codex prompt.
3. Execute `codex exec` via Bash.
4. Return the Codex output.
5. Continue the workflow normally.

Think of Sonnet as the orchestrator and GPT-5.5 as the implementation engine.
