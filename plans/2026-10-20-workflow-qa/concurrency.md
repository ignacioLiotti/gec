# Draft concurrency repair

## Reproduced failure

Run `8523ec23` opened one saved draft in two independent editor contexts. The first tab saved a new revision. The second tab then submitted its older snapshot. `POST /api/document-generation/drafts` returned `200` instead of `409`, so the older snapshot replaced the first tab's text.

The offline case in the same run passed. The editor already retained local text after a failed request. The missing contract was server-side version comparison between independent clients.

## Contract

`generated_document_drafts.updated_at` is the opaque revision token. The database's existing `BEFORE UPDATE` trigger assigns the next token. Clients carry the exact returned string without converting it through `Date`.

Draft recovery returns `updatedAt`. Draft create and update responses return `updated_at`. An update sends `expectedUpdatedAt` and applies one actor-scoped update filtered by both `id` and `updated_at`.

The endpoint returns these status codes:

- `428` when an existing-draft update omits `expectedUpdatedAt`.
- `400` when `expectedUpdatedAt` is not a timestamp with an explicit offset.
- `404` when the authenticated actor cannot read the requested draft.
- `409` when the draft exists but its token changed.

The conflict response is `Este borrador cambió en otra pestaña. Conservamos tus cambios; recargá para revisar la última versión.` The editor keeps its local input and dirty revision after this response. Reloading retrieves the newer stored revision and token.

## Generation

Generation first saves the requested editor revision with compare-and-swap. The generate request carries the token returned by that save. The route checks the token before generating and uses the same token for its final draft normalization update.

If the final normalization succeeds, the generate response returns the new source-draft token. The editor adopts that token even if the user typed while generation was running. The newer local input stays dirty and its next save compares against the generator's legitimate update.

If another actor updates the draft during generation, the final normalization matches no row and does not overwrite the newer draft. The generated document can still complete because PDF storage, generated-document persistence, extraction synchronization, event insertion, and source-draft normalization do not share one database transaction. This change closes the lost-update path on the draft row. It does not make the full generation workflow atomic.

Rejecting a generated purchase order no longer copies the generated input over an existing source draft. If the source draft still has the generated snapshot, rejection changes only its status and validation errors with a version check. If its input is newer, rejection preserves the newer content.

## Verification boundary

Focused Vitest covers token forwarding, generator token advancement, edits made during generation, and dirty local state after a conflict. Type checks cover the product client and Storybook transport. The Storybook network fixture implements the same token contract for runtime checks.

The owning workflow run executes authenticated Playwright against an immutable app snapshot. This work does not start Docker, replace that runtime, or claim the database behavior passed until the owning run reports the post-change result.

The user-visible conflict branch also belongs on the Product OS board and the `Journeys 03 / Documentos y Automatizacion` FigJam board. The workspace quota is exhausted, so the visual update remains open.
