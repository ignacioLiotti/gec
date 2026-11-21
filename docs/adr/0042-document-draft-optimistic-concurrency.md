# ADR 0042: Reject stale document draft writes

## Status

Accepted and implemented locally on 2026-10-20. Not committed or deployed.

## Context

Two independent editor tabs can load the same document draft. The draft update endpoint previously matched only `id` and `created_by`. A later save from the older tab could therefore replace text already saved by the newer tab.

The editor session already protects newer edits from late responses inside one mounted tab. That ordering cannot protect writes from another browser context.

## Decision

Use `generated_document_drafts.updated_at` as an opaque optimistic-concurrency token. The existing `generated_document_drafts_updated_at` database trigger assigns a new value before each update, so this decision needs no schema migration.

Draft recovery and mutation responses expose the exact database timestamp string. An existing-draft update must send that string as `expectedUpdatedAt`. The route validates the timestamp syntax, confirms that the actor can read the draft, and performs one update filtered by `id`, `created_by`, and `updated_at`.

The endpoint returns `428` when the token is missing, `400` when its syntax is invalid, `404` when the actor cannot read the draft, and `409` when the stored token has changed. A conflict leaves the database row and the editor's local text unchanged.

Generation carries the token returned by its required pre-generation save. The route checks that token before generating and uses it again when normalizing the source draft after generation. A successful normalization returns its new token to the editor. If another writer changed the draft during generation, normalization skips the stale update.

Rejecting a generated purchase order does not copy generated input over an existing source draft. Rejection reopens only a source draft whose input still matches the generated snapshot, and the status update also checks the draft token.

## Consequences and limits

The API contract now requires every existing-draft caller to retain and return the version token. Callers must not parse the token through `Date` or rewrite its precision or offset.

Optimistic concurrency protects the draft row from lost updates. It does not place PDF storage, generated-document persistence, extraction synchronization, event insertion, and source-draft normalization in one transaction. A generated document can finish after a concurrent edit causes the final draft normalization to skip.

Authenticated browser coverage verifies missing, malformed, foreign, stale, and matching tokens. Editor-session tests verify that conflicts retain dirty local text and that generation advances the token without replacing text typed during generation.

The Product OS and `Journeys 03 / Documentos y Automatizacion` FigJam boards still need the conflict branch. The workspace quota is exhausted, so this local change cannot add the nodes or screenshot.
