# Launch QA: five first-time users

Four personas completed signup, organization setup and a real first obra. The skeptic remains blocked by missing approved prices and terms. This is not production launch approval.

## Final journeys

| Persona | Before | Verified result | Evidence |
| --- | --- | --- | --- |
| Impatient | Stopped at unavailable local Google provider | PASS: one signup, organization and first obra visible in Tus Obras | [Report](impatient/verified/report.json), [saved obra](impatient/verified/24-observe.png) |
| Skeptic | Could not find prices, terms or privacy | BLOCKED: privacy/dialog fixed; approved prices and terms absent | [Report](skeptic/verified/report.json), [readable dialog](skeptic/verified/07-pricing-and-conditions-contact.png) |
| Mobile | Organization creation failed; heading followed the form | PASS: 375×812, 400ms latency, 50,000B/s both directions; first obra, 3/3 steps, 100% | [Report](mobile/verified/report.json), [complete setup](mobile/verified/13-first-work-result.png) |
| Literal reader | Valid organization creation and instructed retry failed | PASS: one signup, organization and first obra; correct saved row in Tus Obras | [Report](literal/verified/report.json) |
| Breaker | Valid organization creation failed after junk/back/double-click checks | PASS: validation/back work; each double-click produced one POST; one obra after reload | [Report](breaker/verified/report.json), [persisted obra](breaker/verified/22-obra-persisted.png) |

First success means visible UI signup, organization creation and usable setup identifying that organization and its persisted configuration. `/setup` is the intended destination; the earlier dashboard detour was a navigation defect. All four registering personas also created a first obra. The skeptic submitted no credentials or commercial forms.

## One issue list, ranked by affected users

Counts are unique personas across recorded rounds out of five, not an estimated production failure rate. Users who stopped earlier are not counted as having hit later bugs.

| Affected | Issue | Result |
| --- | --- | --- |
| 3/5 | Organization creation failed with a generic retry error | FIXED. SQLSTATE42883 identified unqualified pgcrypto digest outside the wrapper's restricted search path. Migration0133 uses built-in SHA256; real blueprint, ownership, provenance, hash compatibility and rollback verified. |
| 3/5 | Organization saved but navigation returned to form or marketing | FIXED. Server Action selects the returned tenant and redirects directly to setup. Four verified users reached their own setup. |
| 2/5 | Successful signup cleared the form without onboarding | FIXED. Authentication performs full navigation with the new session and keeps submit pending. No verified signup retry. The exact contributor to the prior client navigation race was not isolated. |
| 1/5 | Public prices unavailable | BLOCKED. Discoverable contact added; contact is not a price. Approved content requested, none supplied. |
| 1/5 | Terms unavailable before signup | BLOCKED. No approved terms supplied; no legal/commercial promises invented. |
| 1/5 | Privacy unavailable before signup | FIXED. Existing policy linked from landing/signup, public before membership and rendered without app shell. Legal body unchanged. |
| 1/5 | Authenticated marketing account clipped at 375px | FIXED. Shrink/truncation corrected. Real synthetic UI sign-in measured x206.61 + width148.39 within 375px. |
| 1/5 | Mobile organization form preceded its heading | FIXED. Heading now precedes the form; mobile journey verified it. |
| 1/5 | Landing content painted over the commercial dialog | FIXED. Supported Tailwind --z-index-* tokens and isolated landing effects. Skeptic confirmed legibility, Escape and restored focus. |

The literal reader also noted unexplained “Mes básico”. Its label now says “Mes básico del contrato”, with a hint pointing to the contract's month/year. No domain calculation changed.

[Merged findings](merged-report.json) retain original issue keys, personas, rounds and evidence. [Screenshot gallery](report.html) links original captures. Findings from independent work elsewhere in the shared checkout are excluded from this five-persona denominator.

## Verification

- [Read-only database proof](verified-database.json): exactly one owner organization and one obra per verified synthetic identity; eight default folders, blueprint version1, a 64-character fingerprint and ready obra provisioning. Personas used no API/admin provisioning to claim success.
- [SQL probe](blueprint-probe.json): known SHA256 vector, Unicode compatibility, unchanged signature/authority/search path/ACL, actual blueprint and rollback. No existing database migrated.
- [Anonymous policy](privacy-verified.json), [mobile account measurement](mobile-account-verified.json), [14 matching source/snapshot hashes](verified-source-snapshot.json), [direct setup diagnostic](activation-diagnostic-verified/report.json).
- 353/353 Vitest cases in 46 files; UI/test types passed; UI contract passed for 1,163 controls. Focused ESLint: zero errors, eight existing landing warnings. [Checks](static-checks.json), [Vitest](vitest-final.json), [ESLint](eslint-final.json).
- New `tests/e2e/public/first-visit.spec.ts`: real browser journeys at 1440px and 375px covering commercial dialog, Escape/focus, public privacy, signup entry and policy tab without losing typed email. Focused run 2/2. [Run](public-regression-run.json), [results](public-regression-results.json).
- Complete regular integration evidence: [run](full-regression-run.json), [results](full-regression-results.json). The long-lived interactive host passing proves orchestration only.

The active-tenant cookie remains a selection hint; membership/RLS remain authoritative. Migration0133 preserves the atomic RPC and blueprint version. No production dependency was added. ADR0030 and the styleguide describe the routing/layer decisions.

## Method and limits

Exactly five agents ran in two waves, three children at once. Each used its own actual Chromium browser/context and synthetic identity. Before/after/final directories preserve intermediate failures. Verified uses the frozen final revision. The first repair pass exposed further navigation defects, so completion required follow-up fixes and reruns.

An intermediate mobile attempt was stopped by the coordinator during development loading; it is not a reproduced signup defect. One breaker intermediate attempt overwrote an earlier incomplete run; its report discloses the lost evidence. Extra detail navigation not verified by a persona is excluded from its completion claim.

Cold development downloads and repeated document loads were slow under mobile throttling. Network interception also disables normal browser caching. These are not production performance numbers. A separate production-build mobile check remains necessary.

The first focused public run hit an empty history entry after cold development compilation. Its trace remains in run1b3b4f62. The runner now waits for landing and health before browsers; the unchanged Back assertion then passed at both widths. This warms server compilation, not browser cache. Spec/project argument ordering was also repaired without weakening tests.

The QA launcher enables email signup only in its disposable stack. Ordinary integration retains disabled signup. Local confirmation is disabled; OAuth, external email/payments and realtime are unverified. Google-provider and blocked analytics/realtime warnings are environmental findings, not proven production failures. No external account or outbound message used.

The literal persona followed the actual Spanish UI; no English localization was invented.

## Remaining launch work

1. Supply approved public prices/terms, expose them before signup, then rerun the skeptic.
2. Apply migration0133 through normal authorized deployment and verify real OAuth/email/payment configuration.
3. Verify a production build under mobile connectivity.
4. Synchronize FigJam after its MCP call limit resets. [Exact gap](figjam-gap.md) names boards, flows and screenshots. No board update or deployment is claimed.

All changes remain local and uncommitted. Unrelated work was preserved. [Runtime disposal](runtime-disposal.json) includes only QA-owned instances; unrelated stacks are excluded.
