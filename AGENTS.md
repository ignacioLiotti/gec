# AGENTS.md

## Goal

Help agents work with focused local context, small changes, and explicit validation.

## Before editing

1. Identify the target folder for the change.
2. Read the nearest `AGENT_CONTEXT.md` if one exists.
3. Prefer local context over scanning the whole repository.
4. Read direct imports before expanding to sibling folders.
5. Do not explore sibling folders unless there is a concrete dependency, failing check, or unclear contract.
6. Check related domain docs, ADRs, architecture docs, or styleguide docs referenced by local context.

## Design system

- Before changing product UI, read `docs/styleguide/design-system.md`.
- App code should import UI primitives from `@/components/ui/*`; do not import directly from `@/design-system/*` unless editing the design-system layer itself.
- Use token classes from the design-system guide for product UI colors, spacing, surfaces, borders, and text.
- Keep report/document output, charts, calendars, landing pages, and viewer canvases on their existing domain-specific visual rules unless the task explicitly targets them.

## Editing rules

- Keep changes small and focused.
- Follow existing patterns before introducing abstractions.
- Do not implement unrelated cleanup.
- Do not change database schema, storage, permissions, extraction flows, tenant behavior, or data migration behavior without checking docs and ADRs.
- Do not commit automatically unless explicitly asked.

## Validation

Run the smallest relevant checks first:

- `pnpm lint`
- `pnpm test`
- targeted Vitest tests
- targeted Playwright tests
- route/API smoke checks when relevant

If checks cannot be run, explain why.

## Documentation review before commit

Before proposing a commit, decide whether the change requires updates to:

- `docs/domain`
- `docs/adr`
- `docs/architecture`
- `docs/styleguide`
- local `AGENT_CONTEXT.md`

Create or update an ADR when changing architecture, data model, storage, permissions, extraction flow, important dependencies, or a decision with tradeoffs.

## Pre-commit response

Before suggesting a commit, report:

- files changed
- behavior changed
- checks run
- risks
- domain docs updated or why not needed
- ADR updated or why not needed
- styleguide updated or why not needed
- suggested commit message
