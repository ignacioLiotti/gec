# Agent context: document generation

## Ownership

- `page.tsx` checks route access and mounts the client.
- `page-client.tsx` loads catalogs and recovered documents, renders the editor, and adapts HTTP responses and notifications.
- `editor-session.ts` owns input revisions, draft identity, operation admission, autosave, and request ordering for one mounted editor.
- `lib/document-generation.ts` owns template input, formulas, validation and rendering.
- `app/api/document-generation/` owns persisted document lifecycle and permission checks. A client operation state grants no server permission.
- `builder/` is the visual template editor. It edits a Template Spec (`lib/document-template-spec.ts`); `spec-editing.ts` holds the pure edit operations. Validation, compilation and preview run in the browser with the same functions the server uses on save.

## Template Spec and linked fields

A template can be described by a Template Spec v1, stored in `schema.spec` and compiled to the schema and HTML. `reference` fields link to app records (`usuarios`, `obras`, `tabla:<slug>`, `documento:<TYPE>`); `lookup` fields copy one attribute of the chosen record. The fill page loads records from `/api/document-generation/sources` and resolves links in `deriveInputData`; `generate` resolves them again on the server and rejects unknown values. LLM clients use `GET/POST /api/document-generation/spec`. See `docs/adr/0049-template-spec-and-linked-document-fields.md` and `docs/architecture/document-template-spec.md`.

The builder's **Asistente** mode (`builder-assistant.tsx`, `use-template-assistant.ts`) chats with `POST /api/document-generation/assistant`, which asks OpenAI for a complete spec and only returns specs that pass `validateTemplateSpec` (`lib/document-template-assistant.ts`). The canvas animates edits from `diffSpecs`; section and field identities come from `sectionIds` and `fieldId`, not indexes. See `docs/adr/0050-template-assistant.md`.

## Editing and persistence

Inline input events must reach the session before blur. The inline DOM buffer preserves field identity and caret behavior, while the session protects content from late responses. Keep those responsibilities together when changing event handling.

The session may acknowledge the revision submitted by a save. It may apply normalized input only if that revision is still current. Context changes reject obsolete completions, including errors and notifications. Leaving and returning to the same coordinates creates a new context identity.

Template changes retain the current draft identity. A pending first save may return that identity after the template changes, but must not restore its old content. Do not release the physical request queue when invalidating a command.

The generate endpoint reloads stored draft input when given `draftId`. The session must save the requested revision and retain request ordering through generation. A later autosave must wait until that transaction finishes.

Preserve purchase-order-only autosave, the 1500 ms debounce, validation on explicit generation, generated-document correction status, and rejected-download behavior. Failed autosaves remain dirty and wait for another edit or an explicit retry.

## Verification

- `npm test -- --run tests/app/document-generation/editor-session.test.ts tests/lib/document-generation.test.ts tests/lib/document-generation-server.test.ts`
- `npm test -- --run tests/lib/document-template-spec.test.ts tests/lib/document-template-assistant.test.ts tests/app/document-generation/spec-editing.test.ts`
- `npm run test:e2e -- tests/e2e/document-generation/template-spec.spec.ts tests/e2e/document-generation/template-assistant.spec.ts`
- `npm run typecheck:ui`
- `npm run typecheck:storybook`
- Start local Storybook, then run `npm run test:document-generation:runtime -- http://127.0.0.1:6006`, using its actual port.

The runtime stories mount the real client with synthetic fetch responses. They exercise deferred requests, focused editing, draft recovery and generated-document editing without tenant credentials or a database. They do not verify server authorization, storage or PDF rendering.

## Related decisions

- `docs/adr/0037-document-generation-editor-session.md`
- `docs/adr/0049-template-spec-and-linked-document-fields.md`
- `docs/adr/0050-template-assistant.md`
- `docs/adr/0027-generated-document-editing-and-rejected-downloads.md`
- `docs/obsidian-brain/10 - Documents & File Manager.md`
- FigJam maintenance rules in `app/AGENT_CONTEXT.md`
