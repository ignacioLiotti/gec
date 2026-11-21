# Independent cohort repair pass

The prepared shared baseline runtime was owned by another active task performing the same user-requested QA. That task also prepared the account-entry, anonymous-privacy and blueprint-fingerprint repairs. Those changes were preserved and inspected. The shared runtime was disposed at 22:26:36 UTC while this cohort's breaker was opening organization creation. Its connection failure is infrastructure evidence, not an additional product defect.

The first repair patch for this cohort changed `app/page.tsx`:

- Isolate the landing's stacking contexts and remove the header's arbitrary million-level index so the existing portaled dialog covers decorations and navigation.
- Open the contact form directly from the header demo button.
- Render essential hero text visible before hydration.
- Initially show a disabled `Preparando acceso…` entry while hydration prepares the auth interaction. The second round exposed a Back/Forward failure in that approach; the final implementation replaces it with native links to dedicated auth pages.

The integration runner copied the repaired source into a new independent runtime, run `ebf28309-24f4-4aae-93fb-078b45b85b3a`. All five second-round personas used that frozen application snapshot and fresh sessions. `independent-repaired-snapshot.json` records the initial repair hashes; HEAD alone would not identify the existing dirty working tree.

## Second repair and final cohort

The second round found additional product failures. The first patch did not meet the requested one-pass outcome. After all second-round browsers finished, the following changes were copied into the same owned disposable runtime and recorded in `independent-final-snapshot.json`:

- Native `/auth/sign-up` and `/auth/sign-in` pages reuse the existing auth form. Landing links and browser Back/Forward work without relying on landing hydration state.
- The authenticated organization-creation server action sets the active-organization cookie before redirecting directly to `/setup`. This preserves the organization context after successful atomic creation.
- The demo dialog restores focus to its opening control when Escape closes it.
- `SidebarInset` uses full mobile width in CSS before hydration; desktop width subtraction starts at the existing `md` breakpoint.

All five personas repeated their journeys in real Chrome on that snapshot. Four reached a usable dashboard with their newly created organization. The mobile journey retained the 375px viewport and network throttling throughout. The breaker verified native validation, Back/Forward, and one signup and one organization request after double-clicks. The skeptic still stopped before signup because approved prices and terms were unavailable; a diagnostic signup is never counted as that persona's success.

The literal reader reached first success but reported one misleading setup instruction. A final text and help-link change in `app/dashboard/page.tsx` points to `/setup` and proposes creating the first work item. `independent-copy-delta.json` records this separate change. A fresh-account browser journey verified it in `independent-copy-proof.json`; the five original round-three reports remain unchanged. The two focused proof screenshots show navigation transitions and are labeled accordingly in the visual report.

The final source comparison found a concurrent auth repair made after this cohort's snapshot was frozen: `components/auth/auth-modal.tsx` now keeps submission pending and performs a full document navigation at the session boundary. Its current SHA256 matches `verified-source-snapshot.json` from the other task's independent verified cohort (four activations, skeptic commercially blocked). `independent-source-reconciliation.json` records that provenance. Those additional personas are not added to this cohort's issue frequencies or five-person denominator. All nine other compared files match this cohort's round-three snapshot or its separately verified dashboard copy delta.

Database migration0133 is applied only by creation of this fresh disposable stack. The ordinary local database and production are not selected. Read-only checks prove known SHA256 and Unicode fingerprint equivalence and the restricted search path. The inherited anonymous execution ACL is observable; authentication is still enforced inside the function, and a separate rollback-only anonymous invocation proves tenant creation is denied. No claim is made that inherited anonymous EXECUTE privileges were removed.

## Verification

- 20 focused Vitest tests passed: public-route contracts, the integration runner, and the standard-construction blueprint.
- `npm run typecheck:ui` and `npm run check:ui` passed. The UI contract covered 1,163 controls.
- Scoped ESLint completed with zero errors; existing landing and dashboard warnings were retained (eight and six respectively). Scoped `git diff --check` passed.
- A newly built Storybook artifact passed the repository's real-browser checks: 193 stories, 386 renders, 16 screen/theme/viewport renders, and interaction checks. A non-failing Select controlled/uncontrolled warning remains in the log. The isolated build workspace was removed; see `independent-storybook-proof.json`.
- Read-only database checks verified four final-cohort organizations with one owner each and the expected blueprint seed data. Separate fingerprint and anonymous-denial proofs are saved alongside the report.
- The visual report itself passed Chrome checks at 1,280px and 375px, with no page overflow or runtime errors; all 56 local evidence references resolved.

Browser journeys, network observations and screenshots are preserved separately under `round1/*`, `round2/*` and `round3/*`. The report ranks the union of unique affected personas, without adding a person twice across rounds or including another task's cohort.

Architecture documentation: ADR0030 records the additive fingerprint migration 0133 and direct activation during organization creation. The existing multi-tenancy/auth domain note lists the new public auth entries and activation behavior. No new blueprint version, dependency, data model, RLS policy or commercial/legal text was introduced. Existing design-system tokens and landing visual rules suffice, so the styleguide needs no new convention.

## Remaining release work

No commit, push, deployment or ordinary-database migration was performed. Migration 0133 was exercised only in a fresh disposable database and still requires authorized application to the intended target before release. Approved prices and terms remain required content. FigJam synchronization is blocked by the connector's call quota; exact pending boards and flows are listed in `independent-figjam-gap.md`.

The owned application process, temporary source snapshot, database containers, volume and network were removed; `independent-disposal-proof.json` records the checks. The user's existing development server was preserved. Google OAuth, real email delivery, payments and production performance are outside the verified scope.
