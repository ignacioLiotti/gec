# Platform operations measurements

The platform operator investigates tenants through `/admin/operations`. Effective superadmin access is required. This is a read-only investigation across existing records and newly recorded OCR attempt phases.

| Concept | Meaning |
| --- | --- |
| Tenant | Organization in the current bounded inventory |
| Member | Current membership, not historical eligibility |
| Audit change | One persisted row mutation recorded by deployed audit triggers |
| Observed actor | Identity stored with an audit change or OCR observation; automation and historical attribution may be incomplete |
| OCR request attempt | One server-generated extraction ID and an observed start phase; retries are separate attempts |
| Human-attributed OCR attempt | Authenticated user, explicit non-preview/non-demo/non-simulation/non-impersonation/non-test flags, with a known origin |
| Initiating identity | Original authenticated owner during verified impersonation, or the executing user for an ordinary request; unknown origin remains unknown |
| Executing identity | Authenticated session used to execute the request, which can differ from the initiating operator |
| Active day | Completed UTC day with at least one observed record for the stated metric |
| Recorded cost estimate | Finite eligible `metadata.costUsd`; it is not an invoice |
| Unpriced event | Eligible incurred-cost movement with no usable recorded price; known quota bookkeeping is excluded |
| Recorded signed quantity | Sum of loaded resource movements, including reservations and corrections; it may double-count incurred usage |
| Recovery evidence | Local artifact integrity checks and a recorded isolated restore attestation for database, Auth, Storage and configuration |

Daily, weekly and monthly charts regroup the same completed UTC day observations. A zero cell means no record in the loaded sample. It does not prove no product use. Window-edge weeks and months are partial. Historical collection coverage is not inferred from a successful database read.

Audit comparisons require both sampled period queries to be complete and the tenant to predate both windows. This checks query comparability, not historical trigger completeness. Newly instrumented OCR attempts have no historical comparison until a collection-coverage contract exists.

Operations, audit and costs include today's partial observations. Exact tenant and extraction identifiers connect records. The console never guesses relationships from proximity in time or a shared obra alone. Mutable OCR document status remains a fallback with no claim of full attempt history.

All-feature task adoption, retention cohorts, exactly-once business actions, actual invoices, shared infrastructure allocation, production backup scheduling and independently exercised recovery remain outside this increment. See [the architecture](../architecture/platform-operations.md), [ADR 0039](../adr/0039-platform-operations-observed-data.md), and [the recovery runbook](../supabase-backup.md).
