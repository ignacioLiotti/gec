# Agent Context: emails

## Purpose

React Email templates rendered to HTML for outbound mail. Templates are presentation-only; sending logic lives in `lib/email/**` and `lib/workflow/email.ts`, and scheduling in `workflows/`.

## Main files

- `obra-completion.tsx` — obra completion notification (used by `workflows/obra-complete.ts`).

## Local rules

- Email HTML is its own rendering world: inline-friendly styles only, no app design-system classes, no client-side JS. Do not import from `@/components/**`.
- Copy is Spanish (Argentine, voseo) to match the product; keep domain terms from `CONTEXT.md`.
- Keep templates pure: all data via props, no fetching.
- New templates: add here, wire sending through `lib/email/**`, and update this file.

## Related documentation

- `docs/obsidian-brain/13 - Notifications Engine.md`
- `workflows/AGENT_CONTEXT.md`

## Validation

- `pnpm lint`
- Send a test via `workflows/test-email.ts` or the `workflow-test` API route and inspect the rendered HTML.
