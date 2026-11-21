# Server findings

These findings describe the working tree at `e04d720` with inherited local changes on 2026-10-17. Source inspection establishes the listed control paths. The notification proof additionally executes actual source with fake I/O. No deployed database or provider was queried.

## F04 and F05 Default synchronization

`app/api/obra-defaults/route.ts:1497` and `:1731` enqueue forced synchronization. `lib/obra-defaults/apply-default-folder.ts:1284` removes existing columns, `:1336` inserts replacements, and `:1379` remaps rows. The path does not require the preview, frozen snapshot, compatibility decision, or approval token described in ADR 0009. The DELETE guard does not cover these PUT branches.

If column insertion fails, the helper continues at `:1341` and can return overall success at `:1394`. The immediate caller records `done` at `app/api/obra-defaults/route.ts:641`. Outcome reporting must distinguish affected obras and partial failures before the operation can be trusted.

The immediate path inserts a `pending` job at `:574`, executes at `:607`, then closes it. Meanwhile `app/api/jobs/run/route.ts:25` selects pending jobs and conditionally claims them at `:46`. The immediate executor has no equivalent claim, so cron and PUT can both execute the same work. There is also no lease recovery for a process that dies after marking a job running.

First enforce compatibility before destructive writes. Then choose one execution owner, require its claim, and return an outcome that cannot conceal partial apply. Reuse the existing domain terms and ADR rather than creating another queue abstraction. Tests need custom columns, field deletion/type change, concurrent executors, injected materialization failure, and interrupted execution.

## F06 Email outcomes

`lib/workflow/email.ts:21` returns normally when configuration is absent. At `:40`, an unsuccessful HTTP response is logged but not thrown. `lib/notifications/workflows.ts:88` then continues to the completed status at `:104`.

The retained proof feeds HTTP 500 through the actual email helper and actual delivery workflow, observes one send, and records `completed`. A repair must propagate a delivery outcome or error and define retry/idempotency behavior. Do not rename or reorder durable steps casually. Verify 200, 429, 500, missing configuration, and an ambiguous lost response.

## F07 Notification work before filtering

`lib/notifications/engine.ts:152` resolves every recipient's email before evaluating effect guards and filtering at `:95`. `lib/notifications/recipients.ts:3` creates an admin client and reads Auth Admin per recipient. `document.reminder.requested` has only an in-app effect in `lib/notifications/rules.ts:60`.

The proof registers two unique recipients with a disabled in-app effect. The engine performs two email lookups and starts a workflow with zero effects. Move effect evaluation before channel-specific recipient I/O, and return without a workflow when filtering removes every effect. Keep deduplication by user and reuse email results within one emission. Do not add a global identity cache.

Callers include doc reminders, flujo actions, and obra completion. Verify zero email lookups for in-app delivery, one lookup per unique email recipient, and zero workflow starts after all effects are disabled.

## F08 Request permission resolution

`app/layout.tsx:121` resolves access context, `:177` and `:196` load role records, then `:245` calls separate grant and deny loaders. `lib/route-guard.ts:680` and `:824` repeat auth, role, and override work. `getUserRoles` also calls `auth()` and then `getUser()` at `:118` and `:129`; `lib/auth.ts` itself has no memoization.

The investigator counted nine explicit `getUser()` invocations along the ordinary member graph. This is a static count, not a measurement of nine network requests. Framework or fetch deduplication was not traced. The design improvement is one request context and one permission result containing grants and denies. Use request-local reuse only. Test active tenant changes, owner/admin/member, role grants/denies, per-user overrides, superadmin, and permission simulation.

## F11 Reminder retry progress

`app/api/schedules/dispatch/route.ts:55` inserts notifications, then `:62` marks schedules processed in a separate statement. Migration `0019_pendientes_notifications_link.sql:15` creates a unique stage index.

If insertion succeeds and progress update fails, the retry attempts the same insert and the index rejects the batch. The index prevents duplicate stage notifications; it does not make the two-statement operation idempotent. Mixed batches can leave new schedules blocked behind previously delivered ones. A transactional operation that tolerates legitimate existing deliveries and records progress together is preferable. SQL implementation requires the repository's schema approval and migration review. Verify concurrent dispatch and failure between the two statements.

## F12 Usage fallback concurrency

`lib/tenant-usage.ts:103` reads usage, computes absolute totals, and upserts at `:147`. The path is selected after RPC `insufficient_privilege` at `:206`. Two callers can read the same total and overwrite each other's increments. The RPC in migration 0066 is atomic, but its actor checks differ from the fallback contexts.

Define one authorized atomic operation for the actors that actually need it. Preserve plan enforcement, compensation semantics, and tenant boundaries. Do not substitute admin access for missing authority. Tests need simultaneous increments, near-limit requests, negative compensation, and a foreign tenant. The existing tenant-usage POST test verifies method rejection rather than this concurrency contract.

## F13 Shared exports owned by an HTTP route

`app/api/obras/route.ts:48`, `:84`, `:120`, `:135`, and `:149` export context, mapping, sanitization, or completion helpers. At least 17 other route modules import them. The module also registers notification rules at `:6`.

Move only the shared domain helpers to named `lib/obras` owners or the existing request-context owner. Leave HTTP handlers and necessary registration in entrypoints. This reduces coupling and unexpected registration imports. It does not establish a measured cold-start or bundle-size saving. Verify serializers, completion contracts, typecheck, and absence of route-to-route helper imports.

## Coverage

Reviewed Supabase factories, auth/tenant/demo and route guards, root layout, obra CRUD/completion imports, defaults/apply/jobs, notifications/rules/recipients/workflows, schedules, usage/upload, related migrations, relevant ADRs, and earlier plans. Not every endpoint was inspected. Old standalone workflows without observed callers remain cleanup candidates, not confirmed active defects.
