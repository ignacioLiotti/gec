# Agent Context: workflows

## Purpose

Durable workflows built on the `workflow` package (`"use workflow"` / `"use step"` directives). Each exported workflow function is resumable: steps are checkpointed and `sleep()` can span minutes or days. Used today for scheduled/follow-up email sequences.

## Main files

- `obra-complete.ts` — `sendObraCompletionWorkflow`: sends the obra-completion email, waits until `followUpSendAt` (or 2 minutes as fallback), then sends a follow-up. Email sending delegates to `lib/workflow/email.ts`.
- `document-reminder.ts` — document reminder/vencimiento workflow.
- `test-email.ts` — manual test harness for the email pipeline.

## Local rules

- Only code inside `"use step"` functions performs side effects; keep the orchestrating workflow function deterministic (no `Date.now()` branching outside guard clauses, no direct I/O).
- Changing a workflow's step sequence can break in-flight runs — treat step order/names as a versioned contract.
- Enable local execution with `pnpm dev:workflow` (`WORKFLOW_DEV_ENABLED=1`).
- Email templates live in `emails/`; content helpers in `lib/email/**` and `lib/workflow/**`.

## Related documentation

- `docs/obsidian-brain/30 - Background Jobs.md`
- `docs/obsidian-brain/13 - Notifications Engine.md`
- `docs/obsidian-brain/15 - Document Reminders & Pendientes.md`

## Validation

- `pnpm lint`
- Trigger via `workflow-test` API route or `test-email.ts` against local; verify both immediate and delayed steps.
