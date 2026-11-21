# ADR 0037: Document generation editor session ownership

## Status

Accepted. Implemented and verified locally on 2026-10-17. Not committed or deployed.

## Date

2026-10-17

## Context

The document-generation client coordinates draft persistence, autosave, document assistance and generation through independent busy flags, draft identity mirrors, dirty markers and request refs. A late save can overwrite subsequent edits, and an obsolete operation can update another selection. The generate endpoint reloads input from an existing draft, so generating a captured revision requires ordering its save and generation together.

The inline editor preserves DOM identity while calculations and autosave update surrounding UI. Its input buffer receives keystrokes before blur. Those edits already belong to the current revision and must be protected from request completion before they are committed to the rendered data.

## Decision

Give the route a local editor session state machine that owns content revision, acknowledged revision, draft identity, operation admission and response acceptance. Keep the server document lifecycle, permissions and storage contracts unchanged. Catalog loading and presentation remain with the page.

Draft save, assistance and generation enter the same operation admission model. A response may acknowledge only the revision it submitted. Server-normalized input can replace current input only when no newer edit exists. All accepted inline input mutations advance revision ownership synchronously.

Work, folder and document-type changes establish a new document context. Template changes invalidate obsolete results while retaining the existing draft identity. Invalidating response ownership does not undo a sent mutation or release its physical write sequence. A first save may still supply draft identity to a newer template in the same document context without applying its obsolete content.

When generation references an existing draft, persist the requested content and keep the write sequence reserved until generation finishes. Later edits remain pending and cannot overwrite that source draft between the two requests. Stale success, error, completion, validation and notification effects must not mutate the current editor.

Preserve purchase-order-only autosave, its debounce, explicit generation validation, URL draft recovery, generated-document correction rules and the inline focus/caret contract. Failed automatic saves remain dirty without an unbounded retry loop. Explicit retry or another edit can restart persistence.

## Consequences

Operation flags and dirty/pending identity mirrors become derived session state. Request/timer handles and the imperative DOM input buffer remain where they represent real external mechanisms. No runtime dependency, database migration, server endpoint or permission change is required.

Tests must cover observable content, saved payloads, stale completion and actual save-before-generate ordering. Reducer tests alone cannot establish inline DOM identity or duplicate effects under Strict Mode. Use a fixture-driven real-component browser check as well.

The state machine governs one mounted editor. It does not guarantee ordering between tabs, roll back a server mutation after navigation, or provide server-side draft creation idempotency.

## Alternatives considered

- A complete editor reducer would also own catalog/bootstrap loading and all presentation state. Its wider migration is unnecessary for the pilot.
- An operation-only enum would retain independent input, dirty and draft identity writers and would not protect edits or write ordering.
- A third-party machine framework adds a dependency before the local transition model demonstrates a need for hierarchical or multi-actor machinery.

## Related files

- `app/document-generation/page-client.tsx`
- `app/document-generation/editor-session.ts`
- `tests/app/document-generation/editor-session.test.ts`
- `stories/product/document-generation.stories.tsx`
- `scripts/check-document-generation-state.mjs`
- `app/api/document-generation/drafts/route.ts`
- `app/api/document-generation/generate/route.ts`
- `plans/2026-10-17-generation-state-machine/README.md`

## Related domain docs

- `docs/obsidian-brain/10 - Documents & File Manager.md`
- `docs/adr/0011-document-generation-capability-permissions.md`
- `docs/adr/0016-document-ai-context-for-document-generation.md`
- `docs/adr/0027-generated-document-editing-and-rejected-downloads.md`

## Agent notes

Keep the session feature-local. Extend transitions where ownership changes rather than adding another independent flag or response guard. Do not interpret a client operation state as authority to approve, edit, download or migrate stored documents.
