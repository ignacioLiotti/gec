# Operations console visual map update

Prepared 2026-10-17. Pending authorization to write to the existing Figma account.

## Product OS

Board: https://www.figma.com/board/NDzN30GN3koTteiTdkgV3P

Add an operations section linked to the existing superadmin actor and internal navigation. Represent the existing tenant inventory, expense view and audit-log flow first, then add `/admin/operations` with six views: Summary, Tenants, Usage, Costs, Traceability, Health and recovery. The effective superadmin check precedes privileged reads; permission simulation does not preserve platform-wide access.

Status: Verify locally. Production validation and deployment pending. No commit exists for this change. Do not mark Shipped.

## Journeys 04 / Platform and access

Board: https://www.figma.com/board/ySjUIomuoMG00LNK0sKajF

Add the existing tenant/expense/audit flow where absent. Then document:

1. Superadmin → tenant and period → overview → selected tenant investigation.
2. Usage → user → observed UTC activity → day/week/month grouping. Row mutations and newly attributed OCR requests have distinct meanings; incomplete collection is visible.
3. Health → OCR operation → exact extraction ID → associated audit changes and metering. Missing attribution stays unknown.
4. Costs → tenant → recorded priced amount plus unpriced events. Unknown prices are never zero; this is not invoice reconciliation.
5. Traceability → actor/action/entity filters → allowlisted before/after differences. Private document fields remain hidden.
6. Recovery → unconfigured/unavailable/evidence present → database/Auth/Storage/configuration coverage, artifact checks, recorded isolated restore and timestamps. An attestation is not an independently observed restore or a production backup schedule.

Screenshots: use the actual React operations component with explicitly synthetic fixtures, desktop/mobile and both themes. No tenant data or private paths. Keep screenshots pending until browser verification is complete and upload is authorized.
