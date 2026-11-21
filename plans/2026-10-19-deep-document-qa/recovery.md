# Deep document QA: delayed draft recovery

Source HEAD: `e04d72020f0fea28c42bf603ae2960ca5e63bb07`

## Scope

This slice adds one authenticated Playwright workflow in `tests/e2e/document-generation/recovery.spec.ts`. It creates the existing ACT lifecycle scenario, edits through the document-generation UI and delays only the first outbound `POST /api/document-generation/drafts` request. The intercepted request is continued to the real Next route without a synthetic response.

The workflow proves that:

1. the first POST contains the visible submitted revision and has no draft ID;
2. the lifecycle input stays editable while that save is pending, even though the save button is disabled;
3. a newer visible revision remains in the editor after the real response for the older revision returns;
4. the editor actor reads the older submitted revision from `generated_document_drafts` through RLS, while the foreign tenant cannot see that row;
5. a second UI save sends the returned draft ID with the newer revision, updates that same row and creates no duplicate draft; and
6. a full page reload recovers the newer persisted revision and draft identity through the application bootstrap path.

Screenshots are attached while the first request is pending, after its late response, and after reload.

## Proof boundaries

The route interception controls transport timing only. It does not fulfill, abort or rewrite an application response. Both saves execute the production route, validation and actor-scoped database writes.

The optional browser-offline branch is intentionally omitted. The pending-save path exposes the stronger ordering race directly: the input remains editable while a real write is in flight, and the test observes both the older persisted revision and the newer client revision before retrying. Adding a separate offline write failure to the same workflow would test a different failure mode and add request-count ambiguity without strengthening this ordering proof.

## Verification

- `npm exec playwright test -- --list tests/e2e/document-generation/recovery.spec.ts` — passed; one authenticated test discovered.
- `npm run typecheck:tests -- --pretty false` — passed.
- `npm exec eslint -- tests/e2e/document-generation/recovery.spec.ts` — passed.
- `git diff --check -- tests/e2e/document-generation/recovery.spec.ts plans/2026-10-19-deep-document-qa/recovery.md` — passed.

The complete journey passed in the final frozen run `7481fcd3-758d-470e-abe6-4746a2983c13`. Both revisions, same draft identity, foreign invisibility and fresh-session recovery were checked against the actual backend. Final cleanup and source hashes are recorded in [README](README.md).

## Repository impact

- Production behavior: unchanged.
- Shared fixtures: unchanged; the existing `scenario.documentGeneration.createLifecycleSeed` and actor sessions are used as-is.
- Database schema and persistent developer data: unchanged.
- Domain docs, ADR and styleguide: no update needed because this adds behavioral coverage without changing the product contract.
