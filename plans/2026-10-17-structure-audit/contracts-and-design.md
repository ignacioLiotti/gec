# Contract and design review

An independent reviewer traced the default-sync and notification paths after the initial server audit. A separate reviewer compared the design worktrees. Neither used credentials, live HTTP, database queries, or browser runtime during this review.

## F04 Destructive edits include disabling OCR

`app/api/obra-defaults/route.ts:1492` removes table configuration when saving `isOcr=false`; `:1497` immediately synchronizes it. With no OCR configuration, `lib/obra-defaults/apply-default-folder.ts:1107` deletes materialized obra tables. Migration `0048_obra_tablas.sql:30` cascades deletion to their rows.

For OCR edits, force sync replaces columns and remaps data. `lib/tablas.ts:484` retains new columns and `__*` metadata, so removed fields lose their values. The `admin:obra-defaults` permission at `route.ts:1424` authorizes feature access but does not implement an impact preview or approval snapshot. ADR 0009 explicitly records this pending gap; `CONTEXT.md:311` also forbids destructive force sync without preview.

Block incompatible PUT changes before writing the default configuration. Reuse the migration-required response until the accepted migration contract exists. The initial acceptance case is an existing table with data: removing a column or disabling its data-folder configuration must preserve defaults, rows, and files when returning 409. A transaction or equivalent domain operation is needed to prevent partial destructive writes, in addition to reporting errors accurately.

## F20 Document reminder boundary lacks authentication and scope

`proxy.ts:308` allows requests without a user to continue. Its CSRF check is not authentication. `app/api/doc-reminders/route.ts:38` leaves an absent user as null, catches the immediate insert failure, then emits an event at `:63` using client-supplied recipient and obra values without tenant scope.

`lib/notifications/rules.ts:55` accepts `notifyUserId`. The workflow delivers through `insertNotificationEdge`, using service role at `lib/workflow/notifications.ts:27`. Migration `0052_workflow_notifications_function.sql:8` inserts the payload without an actor/tenant check. Notification `tenant_id` can be null.

The code permits an anonymous POST with a valid known recipient to request a fabricated in-app notification. Actual delivery depends on configured workflow/service-role runtime and was not tested. This rule has no email effect. No live app caller was found; an unreferenced HTTP route is still an exposed entrypoint.

Authenticate before any effect, resolve tenant on the server, verify obra/pendiente ownership, and derive or validate the recipient. If obsolete, retire the route with consumer/documentation checks. Acceptance is anonymous 401 and rejection of foreign recipients, with zero event emissions in either case. Review effective execution privileges of `workflow_insert_notification` separately: it is SECURITY DEFINER, lacks authority checks in its body, and no function-specific REVOKE was found. Its deployed exposure is unverified.

## F21 Queue authority needs a deployment privilege check

Migration `0076_background_jobs.sql:33` gives every tenant member a `FOR ALL` RLS policy with no restriction on job type, payload, or transition. `app/api/jobs/run/route.ts:65` accepts a force-sync payload, and `:104` also supports `remove_default_folder`, using service role. The cron secret protects invocation of the worker rather than authority of the queued command.

If an ordinary member has effective INSERT or UPDATE privileges, the member can request privileged destructive work that a later authorized worker consumes. No later policy hardening was found in the migration files. However, this migration does not establish effective table grants and the deployed scheduler was not queried. This is a confirmed permissive policy/consumer combination with conditional deployment exploitability, not proof of a production incident. The helpers scope obras to the queued tenant; cross-tenant execution was not established.

Before implementation, inspect actual grants in a permitted test environment. Restrict enqueue/transitions to the authorized server path and require persisted destructive-operation approval at execution. Test member/admin RLS and rejection of unapproved destructive commands. A new permission/schema migration requires explicit authority under the project agreement.

## F22 Architecture documentation has actionable drift

`docs/obsidian-brain/01 - Architecture Overview.md` says there is no middleware interceptor, while `proxy.ts` resolves auth, tenant, subscription, and security headers. It also labels the `workflow` integration as Temporal without evidence in the inspected runtime contract. Describe the installed runtime directly rather than assuming a provider from its API shape.

`docs/obsidian-brain/30 - Background Jobs.md:20` lists `locked_at`, absent from the table definition, and `error_message`, while code uses `last_error`. It omits immediate execution during PUT. Reminder walkthroughs describe an app call to `/api/doc-reminders` for which no current caller was found. Observability docs say CI runs, but no `.github` directory was present.

Update these bounded facts after choosing the relevant repair. Preserve ADR 0009: it already distinguishes an accepted decision from pending implementation. Historical plan status should be checked against code before reuse.

## F23 Paper is not a superset of the current product contract

Paper's `design-system/components/button.tsx:42` still defines `ghost` as an 88px tile. It lacks root's `primary`, `field`, and `ghost-tile` variants. Root uses `primary` at `app/admin/main-table-config/page.tsx:1040`. Paper's Card at `card.tsx:5` lacks root variants used by dashboard and reporting. Replacing folders would break types or change behavior.

Root has already consolidated overlapping primitives into canonical `design-system` owners with public `components/ui` reexports. Paper still contains different Dialog implementations in those two locations, and duplicates the configured `cn` helper. Preserve root's owner and move approved Paper recipes into it. Root also shares `field-styles.ts` among Input, Textarea, NativeSelect, SelectTrigger, and Button field. Paper Input adds useful appearance/density/icon options, but that does not replace the shared field contract.

Paper's `paper.css` and `paper:` variant are intentional theme/portal mechanisms, not unnecessary layers merely because they add files. Its orange palette differs from root's theme-specific contrast decisions. Integration must check both themes rather than assuming equal appearance means preserved accessibility.

The source guard scripts have different limits. Root checks JSX primitives and wrappers but does not resolve every computed class or inline style. Paper checks component ownership, global selectors, and CSS modules, with narrower runtime examples. Keep their distinct coverage visible. A passed guard is not a complete screen/runtime proof.

## Latest design evidence and integration sequence

`gloss-preview/README.md:5` records a document-generation proposal dated 2026-10-15 and explicitly labels it local fixture work. This is the latest explicitly dated proposal found, not evidence that its source is the remembered branch or shipping product. Paper's decision log through 2026-09-11 is not its complete change history; a component file has a local modification date of 2026-09-24. Modification dates do not establish Git lineage.

Choose one product owner per component, preserve current contracts, apply one approved recipe at a time, and run root UI/type/Storybook checks plus the Paper ownership checks. Exercise Button/Card/Input/Select/Dialog, focus/disabled/open states, portals, narrow containers, sidebar states, and representative Excel/admin/report controls in both themes. Build and runtime checks from the other worktree remain future integration work. Historical screenshots are not fresh proof.

Gloss can inform an approved user flow, but its fixture tests do not prove production permissions, persistence, or generation. FigJam updates belong with an implemented, verified product change.
