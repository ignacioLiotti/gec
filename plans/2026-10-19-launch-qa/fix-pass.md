# Unified repair pass

The baseline app snapshot remained frozen until all five users finished and was disposed. Repairs ran in another fresh stack. Further failed navigation attempts were retained before the verified revision. No baseline browser observed a partially repaired app.

## Confirmed activation failure

The literal persona registered through the UI and failed twice at organization creation. PostgreSQL logs show SQLSTATE42883: `function digest(text, unknown) does not exist`, from `create_tenant_from_blueprint(text,jsonb)`. The pgcrypto extension is installed in `extensions`, while the security-definer wrapper has `search_path=public,pg_temp` and calls unqualified `digest`.

The repair is an additive function migration. It retains the existing signature, atomic transaction, owner checks, search path and execution ACL. It computes the same SHA256 fingerprint with PostgreSQL's built-in `pg_catalog.sha256` over UTF8 JSON text. This avoids depending on the deployment-specific pgcrypto schema or expanding a security-definer search path. Historical migration0128 stays unchanged. Execution is restricted to the owned disposable QA instance; no existing development or remote database is selected.

## Confirmed public privacy failure

The skeptic could not find a privacy link before signup. Independent anonymous-browser diagnosis also reproduced a non-dismissible auth dialog over `/privacy`. The repair exposes the existing policy from the landing/auth flow, treats exactly `/privacy` as pre-tenant and renders it without the app sidebar. It does not change the policy's legal contents.

## First-time entry

The impatient user took the first prominent auth method and reached an unsupported Google provider in this local stack. This is an environment limit, not proof of a production OAuth defect. An explicit Create account entry and visible email form will make the tested signup path discoverable without requiring an unavailable provider. OAuth itself remains outside verified coverage.

## Content and provider limits

Approved terms and public pricing are unavailable in the repository and were requested from the operator asynchronously. Do not fabricate legal or commercial content to mark the skeptic passed. External email, OAuth and payments are not configured or exercised. Slow3G timings collected against Next development mode are not production performance claims.

## Follow-up navigation repairs and verified result

The first repair pass exposed organization creation succeeding in SQL while the switch HTTP hop returned users to marketing or the empty form. The Server Action now sets the existing selection cookie after the authenticated atomic owner RPC and redirects directly to setup. The cookie contract and RLS are unchanged. A later cold attempt left signup on its blank form, so email authentication now performs a complete document navigation with its new session and stays pending until that navigation. The exact contributor to the former client navigation race was not isolated.

The final verified cohort used run0f75819c and the session-navigation-repair revision. All previous browsers were closed before copying the two follow-up files into that owned snapshot. Fourteen product source/snapshot hashes match. Four personas completed one signup, organization and first obra; read-only SQL independently found one organization and one ready obra each. The skeptic verified public privacy, dialog layering, Escape and focus restoration, but remained blocked by prices and terms.

The mobile header can shrink/truncate, its form heading precedes fields, and Mes básico now names the contract and has a hint. Tailwind layer tokens use --z-index-* so canonical portaled dialogs cover isolated landing effects. A real synthetic UI sign-in measured the authenticated account control within375px.

The public browser check initially exposed a cold development history entry returning to about:blank. The trace remains intact. Waiting for landing compilation before starting browsers made the unchanged Back assertion pass at both widths. The browser starts cold. Argument ordering was also repaired so Playwright does not consume a spec path as a project. No failed assertion was removed or weakened.

Final regression:36/36 regular E2E,353/353 Vitest, UI/test types and UI contract passed; focused lint has zero errors and eight existing landing warnings. No commit, deployment, external message or ordinary database migration.
