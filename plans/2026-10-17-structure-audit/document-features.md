# Document feature findings

These additions cover document generation and Document AI boundaries that were not the focus of the table/server reviews. The coordinator inspected the cited source and retained an executable chat-race reproduction. Remote persistence and browser behavior were not exercised.

## F24 Opening a chat has no response owner

`app/document-ai/page-client.tsx:182` starts history loading and applies messages/chatId when each request finishes. History controls remain available, and `startNewChat` at `:174` does not invalidate pending opens. `catch` and `finally` also belong to whichever response finishes rather than the current selection.

The retained proof extracts actual `openChat` and `startNewChat` callbacks. It starts A then B, completes B then A, and observes chat A selected. A second scenario starts a new chat while A loads; A's completion restores it. Both use deferred fake responses. This establishes the callback mechanism, not a rendered browser regression.

Give the current selection one request identity or cancellation owner, invalidated on new/delete/select. Check ownership on success, error, and completion. Keep streaming `useChat` behavior separate. `app/document-generation/page-client.tsx:1188` already provides a request-generation pattern; its stale-response checks extend through `:1241`.

Acceptance includes inverted completions, new chat during a pending open, a stale failure while B loads, and deletion while opening. The page is active through `app/document-ai/page.tsx:39`; the fixture/demo branch intentionally avoids the request.

## F25 Generation reloads tenant catalogs on every context change

`app/api/document-generation/bootstrap/route.ts:44` loads works, templates, and tenant user options for each bootstrap. Changes of obra, type, and folder call the endpoint at `app/document-generation/page-client.tsx:1530`, `:1561`, and `:1587`, as does initial/draft recovery at `:1197`. The response overwrites the same catalogs at `:1213`.

`lib/document-generation-server.ts:283` queries memberships and profiles, and `:245` performs an Auth Admin lookup per unique user. Changing only a folder repeats that tenant directory work. No latency estimate was measured.

Separate the tenant/session catalog from destination-dependent generation context. Invalidate the catalog after template/options changes and tenant switches. Keep work ownership, extraction destination, and next sequence resolution on the server for each relevant request. No process-global permission or user cache is justified.

Acceptance is one tenant directory load for repeated folder changes, a fresh load on tenant switch, refreshed selectors after catalog edits, and unchanged recovery/generation results. Existing pure generation tests do not establish this request policy.

## F26 Review lists fetch unused filter catalogs

`app/api/document-generation/generated/route.ts:98` loads document actors, then all works. It always returns works and creator filter options. Review at `app/document-generation/review-page-client.tsx:183` consumes documents and counts, while approved documents at `approved-documents-page-client.tsx:95` consumes documents. History at `drafts-page-client.tsx:237` uses the filter options.

Make the need for filter catalogs explicit, and omit the obra catalog query for consumers that do not use it. For history, load independent catalogs concurrently or reuse the tenant catalog. Preserve actor resolution needed to display document authors. Acceptance compares documents/authors/counts for review and approved lists with no extra works query, while history retains filters.

## Findings rejected after inspection

`app/admin/dashboard/page.tsx:617` already executes five independent loaders with `Promise.all` and passes query errors to the current workspace at `:822`. No serial-loader finding is supported there. Type-only imports from server helpers are not evidence that server runtime code leaks into a client bundle.

Review covered generation entries and bootstrap, history/review/approved lists, actor helpers, Document AI selection, related domain/ADR contracts, run orchestrator boundaries, and relevant dashboard/admin consumers. It did not exhaustively inspect extraction, RLS, chat tools, every renderer, or HTML templates.
