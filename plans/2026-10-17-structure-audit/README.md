# Structure and overhead audit

Date: 2026-10-17. Tracking branch: `codex/structure-improvements-2026-10-17`. Base: `e04d720`.

The largest useful reductions are to give table edits and document loading one owner, resolve request permissions once, remove unused prefetch work, and make background effects report their actual outcome. Fix the reproduced stale-table and blob-cache defects before splitting their owners into more modules. Destructive default synchronization needs its existing domain contract enforced before performance work.

This is an investigation and implementation backlog. Product source, database state, dependencies, and permissions were not changed. New audit artifacts and an appended decision log are the local changes from this session. No commit or push was requested or performed.

## Branch provenance

There is no local or cached remote branch named `clean-design`. The current checkout started on `mobile-navigation`. These worktrees share committed base `e04d720`, but contain different uncommitted work:

| Worktree | Existing work | Treatment |
| --- | --- | --- |
| `multi-tenant` | Canonical UI consolidation, Storybook, product edits, portfolio guide, and Gloss previews | Main structural audit and dated tracking branch. Preserve all inherited changes. |
| `multi-tenant-paper-redesign` | Paper design, component-owned recipes, shell containment, NotchedSurface, and ownership/runtime checks | Compare as the likely design branch. Do not merge its dirty tree wholesale. |
| `multi-tenant-form-table` | A substantial table refactor with separate editing, fetch, navigation, and visual regions | Review and reuse before starting a second table rewrite. The stale refresh defect remains there. |
| `multi-tenant-flow-demos` | UI consolidation and contextual demonstrations | Inspect only where its shared UI contract overlaps. |
| `multi-tenant-ux-flows` | UX documentation and prototypes | Preserve as separate proposal work. |

`origin/main` in the local ref cache points to `75aa7b9`, dated 2026-09-15. This is more recent by commit date than the design worktree base; it does not identify the most recent uncommitted design. No fetch or merge was performed. The exact branch the user remembered remains unconfirmed. The dated branch was created at the current HEAD without changing files.

At the start, `git status --porcelain=v1 -uall` recorded 132 modified tracked files and 646 untracked files. Directory-collapsed status displayed 31 untracked entries. Baseline status and hashes of modified tracked files are retained under `%TEMP%/multi-tenant-audit-2026-10-17/`.

Final comparison preserves all original status entries and matches all 132 tracked-file hashes. Existing untracked paths were recorded without content hashes; their preservation is based on the audit's write scope, not a cryptographic comparison. The independent deliverable review found no remaining material inaccuracies after correcting JSX inventory coverage and source line references.

## Structural map

The [reproducible inventory](inventory.json) covers 631 core source files and 217,493 lines, including 125 API route modules and 79 page modules. It includes JSX landing/animation modules as well as TypeScript. Counts include blank lines and type declarations. They identify investigation targets, not runtime cost or code quality.

| Boundary | Responsibility | Main finding |
| --- | --- | --- |
| `proxy.ts`, `app/layout.tsx`, auth and route guards | Session, active tenant, permissions, shell | Request context is reconstructed across loaders. The proxy is not a universal authentication rejection boundary. |
| `app/excel`, `components/form-table` | Obras, editing, document and data workspaces | Multiple owners of rows, dirty baseline, tree, selection, and cache complicate refresh behavior. |
| `app/api`, `lib` | HTTP boundaries and business logic | Shared helpers exported by a route couple other endpoints to that route's imports and registration effects. |
| `lib/notifications`, `lib/workflow`, `workflows` | Event expansion and durable delivery | Work occurs before effect filtering; failed delivery can be recorded as success. |
| `lib/obra-defaults`, jobs, Supabase migrations | Materialization and background execution | Destructive changes, claims, and outcome reporting are not represented by one enforceable contract. |
| `components/ui`, `design-system` | Stable app imports and canonical component implementations | Reexports are intentional. Preserve them and migrate recipes through their owner. |
| `stories`, `.storybook` | Executable component catalog | Keep independent validation of the component contract and the composed screen. |
| `portfolio-guide`, `gloss-preview`, `hierarchy-explorer`, `remotion` | Separate demonstrations, prototypes, and rendered media | Give each its own check boundary. Do not delete or ship them based on their names. |
| `tests`, scripts, root configuration | Verification and developer tooling | Baseline results and coverage gaps are recorded below. |

Largest modules include file-manager at 7,767 lines, obra-defaults page at 6,536, dashboard at 4,242, obra detail at 4,227, and FormTable at 3,885. The AST finds 73 `useState` and 19 `useEffect` calls in file-manager, and 30 and 42 in FormTable. These are ownership review leads. Moving those calls into wrapper hooks would not remove their state relationships.

## Implementation order

All work below is proposed. No task is marked implemented by this audit. Priorities reflect impact; phases group compatible work rather than promising dates.

| ID | Priority | Proposed unit | Acceptance check | Dependency or risk |
| --- | --- | --- | --- | --- |
| F01 | P1 | Apply fresh FormTable values when clean, including stable row IDs | Same-ID refresh, dirty edits, save/refetch, add/delete rows | Review the existing sibling refactor first. Dirty baseline is a public behavior contract. |
| F02 | P1 | Deduplicate pending blob downloads and define URL ownership | Simultaneous thumbnail/preview, invalidation during fetch, URL release | Avoid revoking a URL still held by a consumer. |
| F03 | P1 | Reject document-load results whose obra/generation no longer owns the store | Resolve A after navigation to B; B retains its own tree and selection | Statically identified race; browser reproduction remains required. |
| F04 | P1 | Enforce ADR 0009 on incompatible default edits and stop reporting partial apply as success | Custom columns, removed/type-changed fields, failed insert after delete | Domain/schema behavior requires an approved design before implementation. |
| F05 | P1 | Give immediate and cron default synchronization the same execution claim | Concurrent executors produce one apply; interrupted claim has a recovery policy | Related to F04. Do not increase concurrency first. |
| F06 | P2 | Propagate unsuccessful email delivery and classify retryable failures | Fake 200, 429, 500, absent configuration, lost response | Design delivery idempotency before broad retries. Preserve durable step contracts. |
| F07 | P2 | Filter notification effects before email lookup and workflow start | In-app uses zero email lookups; fully disabled emission starts zero workflows | Small pure-boundary change. No schema needed. |
| F08 | P2 | Resolve roles, grants, and denies from one request access context | Actor/tenant/override matrix and bounded calls per request | Never use a process-global authorization cache. |
| F09 | P2 | Remove the pending-doc prefetch with no live query consumer | Sidebar, obra table, selector navigation; no redundant `/pendientes` request | Preserve obra and memoria prefetches. |
| F10 | P2 | Remove inactive selection store and disabled alternate tree prefetch | Reference search, typecheck, document selection and refresh | Update the file-manager context after deletion. |
| F11 | P2 | Make reminder insert and schedule progress idempotent | Concurrent dispatch and failure between insert/update | Existing unique index prevents duplicates but can block retries. SQL change needs authority. |
| F12 | P2 | Replace the read-modify-write usage fallback with an authorized atomic increment | Concurrent deltas, limit boundary, compensation, foreign tenant | Database and actor authority contract. Do not solve by widening admin access. |
| F13 | P3 | Move shared obra exports out of a route module | No feature route imports `app/api/obras/route`; serializer/completion tests | Keep registration at the required entrypoints. No generic repository layer. |
| F14 | P3 | Remove internal calendar imports through its own public barrel | Direct internal imports, typecheck, calendar navigation/drag checks | Four detected source cycles include type-only edges; only classify runtime edges after inspection. |
| F15 | P3 | Measure whether detail warmup is consumed before changing its policy | Requests and bytes on General-only visits versus actual tab visits | Existing warmup trades background work for faster tab switches. No measured speedup yet. |
| F16 | P2 | Give product and Vite previews explicit typecheck boundaries | Product, portfolio, Storybook, and root/build checks all have defined passing targets | Full tsc currently fails on portfolio `?raw`; do not hide product errors. |
| F17 | P2 | Exclude intended scratch output from lint and address live-source debt separately | Generated scratch is absent from inputs; live-source rules remain enabled | Scratch accounts for only part of 413 current errors. |
| F18 | P2 | Merge Sentry options and apply its config wrapper once | Resolved production config and one authorized instrumented build | Existing wrapper nesting is confirmed; performance cost is unmeasured. |
| F19 | P3 | Remove unused `@ai-sdk/google` with its lockfile entry | Reference search, package consistency, tests, sample analysis | ADR 0032 already records the incompatibility. No blanket AI SDK upgrade. |
| F20 | P1 | Authenticate and scope document reminder emission, or retire the obsolete route | Anonymous/foreign recipient rejected before effects | Code path confirmed; actual delivery depends on configured workflow runtime. |
| F21 | P1 conditional | Restrict queue command authority and destructive approval | Test effective grants, member/admin RLS, worker command validation | Permissive policy and privileged consumer confirmed; deployment privileges not queried. |
| F22 | P3 | Correct bounded architecture/job/reminder documentation drift | Every revised lifecycle/column/caller claim matches source | Preserve ADR 0009's explicit pending implementation status. |
| F23 | P2 | Integrate approved Paper recipes into current canonical component contracts | Variant, theme, portal, keyboard, narrow-container, and consumer checks | Paper lacks root variants; copying folders is unsafe. |
| F24 | P1 | Give Document AI chat opening one response owner | Inverted A/B completion and new chat while A loads | Actual-source isolated proof retained; browser regression still needed. |
| F25 | P2 | Separate tenant generation catalog from changing destination context | Multiple folder changes reuse one directory load; tenant change invalidates it | Preserve live authorization, destination, and sequence validation. |
| F26 | P2 | Load generated-document filter catalogs only for consumers that need them | Review/approved lists retain authors and counts without extra obra catalog query | History still needs filters. Keep necessary actor resolution. |

Small, low-risk overhead work starts with F07, F09, and F10. F01 and F02 have retained reproductions and should become behavioral regression tests before refactoring. F04 and F05 address data integrity and should be designed before any throughput optimization of default sync. F08 is a useful cross-cutting refactor after the permission matrix is executable.

F20 needs immediate boundary hardening; confirm F21's deployed grants in an authorized test environment. F24 can reuse the request-generation pattern already present in document generation. F25 and F26 remove repeated data loading without inventing another state framework.

See [the server findings](server-findings.md), [the React findings](react-findings.md), [the document feature findings](document-features.md), [the independent contract/design review](contracts-and-design.md), and [tooling results](tooling-findings.md) for evidence, consumers, minimal changes, and validation boundaries.

## Verification outcome

UI contract checks pass for 1,112 controls. Product UI and Storybook typechecks pass. Vitest passes all 218 tests in 37 files. The global typecheck fails only on the portfolio's raw import. Final full lint exits 1 with 413 errors and 2,832 warnings. All four new audit scripts pass targeted ESLint. Three retained proof scripts execute six defect scenarios with fake I/O.

The initial lint run caught four import-style errors in the first audit proof as well as existing source debt. Converting the proofs to ESM removed those errors without suppressions. The final lint log is `%TEMP%/multi-tenant-audit-2026-10-17/final-lint.log`. Full details and remaining runtime gaps are in the tooling report.

## Reproductions

Run from the repository root with existing local dependencies:

```powershell
node plans/2026-10-17-structure-audit/inventory.mjs
node plans/2026-10-17-structure-audit/proofs/react-cache-and-table.mjs
node plans/2026-10-17-structure-audit/proofs/notification-overhead.mjs
node plans/2026-10-17-structure-audit/proofs/chat-response-ownership.mjs
```

The three proof files transpile actual source and isolate I/O in a VM. They use fake fetch, URL, secrets, and workflow functions. They do not call remote services, send email, or use credentials. Their assertions reproduce the current defects, so a successful repair should invalidate those assertions and replace them with desired-behavior tests in the normal suite. They are not end-to-end browser or database proofs.

Observed results:

- Same-ID external table update makes zero calls to `setFormRows`.
- Simultaneous requests for one blob cause two downloads; the first consumer's URL is revoked. Clearing the obra leaves the blob cached.
- A provider response with HTTP 500 still leads to execution status `completed`.
- Two unique recipients with only disabled in-app effects cause two email lookups and one workflow start with an empty effect array.
- Opening chat A, then B, and completing A last replaces B with A. Starting a new chat while A is pending can also reopen A.

## Pstack installation

Installed all 54 skill directories from [poteto's original pstack](https://github.com/cursor/plugins/tree/101b274dd991f694e1f7024be2157e5f3adf07de/pstack), fixed at commit `101b274dd991f694e1f7024be2157e5f3adf07de`, using the local skill-installer helper. The destination is `~/.codex/skills`. The pre-existing `unslop` was preserved; pstack's version is in `pstack-unslop`. [The installation manifest](pstack-installation.json) records presence and SHA256 of each entrypoint.

The skills become discoverable on the next turn. Original Cursor-specific tool names and model defaults do not establish host support. This audit used native subagents because no T3 capability tool or ACP transport was available. Project model routing and authority rules took precedence.

Applied leaf principles were Subtract Before You Add, Minimize Reader Load, Laziness Protocol, Boundary Discipline, and Prove It Works. They changed concrete choices: reuse the existing table refactor, delete inactive work before adding hooks, retain the intentional UI boundary, concentrate notification filtering before I/O, and retain executable reproductions. Poteto Mode was installed rather than activated as an additional autonomous workflow.

## Scope and documentation

Seven native subagents covered server architecture, React ownership, baseline tooling, independent contract adjudication, design-branch comparison, document feature boundaries, and independent audit review. The coordinator inspected their claims, reran proofs, and reconciled shared recommendations. No agent changed product source.

The inventory traverses core source metadata. Deep review follows the high-impact owners and their direct consumers; it does not claim a line-by-line review of all 217,493 lines. Browser navigation, deployed RLS/grants, production tracing, full builds, and remote integrations are not established by this audit.

No domain document, ADR, styleguide, or FigJam behavior was changed because implementation and product behavior were not changed. Future work involving default synchronization, usage, queue authority, permissions, or delivery semantics needs its corresponding domain/ADR review. User-visible repairs also need the FigJam maintenance specified in `app/AGENT_CONTEXT.md`.

The older [June implementation plans](../README.md) remain historical, unmodified input. Their TODO labels are not evidence that a finding still exists. Completion-side-effect plans were not presented as new discoveries. Existing document tabs, progressive desktop previews, UI reexports, and type-only import cycles were not classified as dead code merely from their names or shape.
