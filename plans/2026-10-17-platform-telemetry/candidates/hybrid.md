# Candidate B: hybrid platform observability

Status: TODO. Design only, 2026-10-17. Grounding: [repository evidence](../evidence.md). No vendor selected; no schema, dependencies, credentials or remote changes authorized.

## Usage, caller's view

```ts
// Existing domain command owns mutation, audit and semantic capture together.
const result = await saveDataFlowConfig(authorizedActor, {
  operationId, tenantId, configId, changes,
}); // same operationId returns the original result after a retry

// Operator overview explicitly selects tenants and observation timezone.
const overview = await readTenantOperations(operator, {
  tenantIds, asOf, timezone: "America/Argentina/Buenos_Aires",
}); // independent activity, money and recovery freshness/coverage

// Recovery worker verifies an isolated restoration, including object bytes.
const proof = await verifyRecovery(approvedRecoveryTarget, backupManifest);
// proof records measured recovery time, recoverable point and failures
```

## Problem

Existing UTC-month metering enforces quotas, audit triggers retain full row JSON, and Sentry samples technical traces. None supplies reliable semantic activity counts. Tenant expenses currently mix quantities and incomplete price estimates. The backup document has no verified runner or restore evidence. A hybrid design keeps authoritative business records in Postgres while moving behavioral exploration to a separate analytics backend.

## Shape and ownership

```ts
type Actor =
  | { kind: "human"; userId: UserId; impersonatorId: UserId | null }
  | { kind: "system"; job: JobName; initiatedBy: UserId | null };
type SemanticAction = keyof typeof actionCatalog;
type Activity = {
  eventId: EventId; tenantId: TenantId; actor: Actor;
  action: SemanticAction; occurredAt: Instant; operationId: OperationId;
};
type Coverage =
  | { status: "complete"; start: Instant; through: Instant }
  | { status: "partial"; gaps: Interval[]; through: Instant }
  | { status: "unavailable"; reason: string };
type Cost =
  | { kind: "actual"; amount: Decimal; currency: Currency; invoiceId: string }
  | { kind: "estimate"; amount: Decimal; currency: Currency; rateVersion: string }
  | { kind: "allocated"; amount: Decimal; currency: Currency; ruleVersion: string }
  | { kind: "unknown"; reason: string };
declare function saveDataFlowConfig(actor: AuthorizedActor,
  input: ConfigChange): Promise<ConfigResult>;
declare function readTenantOperations(actor: AuthorizedOperator,
  query: OperationsQuery): Promise<TenantOperations[]>;
declare function verifyRecovery(target: ApprovedRecoveryTarget,
  manifest: BackupManifest): Promise<RecoveryProof>;
// Sketch only. Bodies are not implemented. IDs and authority types are opaque.
```

Domain commands execute a database transaction, using an RPC where existing REST writes cannot share one transaction. The transaction authenticates tenant scope, sets transaction-local actor context, changes domain rows, writes redacted audit, and captures eligible semantic events. Missing actor or tenant context rejects covered writes. Audit failures roll back changes. Request payloads cannot declare their own trusted actor.

`lib/audit/` owns redaction, attribution and the trigger/RPC contract. Store changed field names and allowlisted before/after values, excluding credentials, document contents, messages and sensitive configuration. Secret changes record the field and operation only. Preserve domain histories through correlation IDs. Existing full JSON needs a separately approved retention/redaction migration; new redaction cannot retroactively protect it. Append-only writes and tenant/operator reads require reviewed policies.

`lib/activity/` owns one versioned action catalog, payload validation, bounded Postgres delivery spool, backend adapter and aggregate queries. Each catalog entry specifies its success boundary, actor eligibility, task unit and allowed dimensions. Initial candidates include obra creation, document upload completion, configuration save and extraction request acceptance. A bulk command counts one task; item counts are a separate measure. Retries, reservations, rollbacks, page renders and polling never create extra task completions. The backend receives pseudonymous tenant/user keys, action, time and bounded dimensions, never audit payloads or direct personal identifiers. Mapping remains first-party.

`lib/tenant-usage.ts` remains the sole quota writer, preserving UTC periods and reservation/settlement behavior. A cost module reads its events, versioned provider rates and reconciled invoices. Costs do not change limits or backfill billing from analytics. Missing prices stay unknown. Estimates, invoice actuals and shared allocations remain separate; actuals replace matching estimates in consolidated totals through explicit reconciliation, never addition. Preserve native currencies; cross-currency totals require a dated exchange-rate source. Coverage reports unpriced quantities and unallocated invoice amounts. No prices or historical baseline are assumed.

An operations query joins tenant identity and cost summaries from Postgres with backend activity aggregates and recovery manifests. Tenant filters are authorized before every source query; the service client is never sufficient authorization. Cross-tenant reads use existing effective superadmin rules, including permission simulation. Tenant-admin access stays within existing memberships. Partial source failure returns marked partial sections, never zeros. Reads use tenant/time keys, audit tenant/time cursors and daily tenant/user/action aggregates; no raw-event scan per tenant card.

This interface hides transport, retries, redaction and query policy behind domain commands and one overview query. No caller coordinates audit plus analytics. Backend wire types remain private, per boundary discipline; catalog-derived validation and aggregations avoid hand-synchronized lists.

## Delivery and habit definitions

Proposed approval parameters are seven days of raw spool/replay and thirteen months of daily aggregates. Bound payload bytes, queue size, batch size and worker concurrency using measured capacity before rollout. A claimed-row lease allows workers to compete safely. Transactional uniqueness on tenant, operation and semantic action prevents duplicate capture; retries send the same event ID. Backend deduplication must cover the replay window. Delivery is at least once, never assumed exactly once.

Business changes continue when analytics capacity is exhausted: the transaction records a compact coverage gap instead of an event. Audit remains mandatory. Expired or permanently invalid events also mark gaps, with alerts and a replay/export manifest. ACK loss retries safely; an unavailable backend delays delivery. First-party exports contain only approved spool events within retention plus manifests and daily aggregates, not an indefinite shadow event warehouse. A gap cannot be repaired from sampled traces or guessed audit semantics.

Habit means observed human interaction, independent of system execution. A human extraction request counts when accepted; its automated completion is a separate system event. Impersonation, demos and tests are excluded from ordinary adoption. Successful synchronous edits count at commit. No inferred “human” attribution from a job's initiating user.

All buckets use an explicit IANA timezone, stored with the report definition. Days are local calendar days, weeks Monday through Sunday, months calendar months. Display current partial buckets separately. Report per-user and per-tenant active bucket ratios: active completed days / last 28 completed days, active weeks / last 12 completed weeks, active months / last 12 completed months. An active bucket has at least one qualifying event. “Every day/week/month” requires activity in every bucket of that corresponding window; ratios remain visible and labels may overlap. Also show unique active humans and task counts by action.

Qualification requires membership and complete observation for the entire relevant window. Otherwise show insufficient history or incomplete coverage, observed counts and start date; never extrapolate. Use event time, deduplication and a published ingestion watermark. Late arrivals revise affected buckets and report revision time. Timezone changes recompute available history; missing retained detail prevents a comparable historical label.

## Recovery

An approved recovery runner produces encrypted database and Storage manifests with object versions/checksums, capture boundaries and retention. Include required auth/platform configuration in the documented recovery scope. Concurrent Storage changes require versioned copies or a controlled consistent capture procedure. Database backups alone omit object bytes, as the [Supabase documentation](https://supabase.com/docs/guides/platform/backups) states. Restore into isolation, verify schema, tenant isolation, row/object references and downloaded object checksums, then run application smoke checks. Report measured RPO/RTO against approved targets. A successful upload never means recovery passed.

## Tradeoffs and alternatives

Compared with Postgres-only behavior collection, this accepts external transfer, eventual consistency and another failure boundary in exchange for separating exploratory analytics load and retention from transactional operations. Postgres-only hides delivery complexity and simplifies joins, but owns event growth, aggregation performance and analytic query isolation. It is preferable if measured volume and reporting needs remain small; this candidate needs a demonstrated analytics workload to justify adoption.

Reject client-only capture because blocked scripts lose authoritative completions. Reject external audit/billing because transactional failures and retention would cross services. Reject Sentry-derived usage because sampling cannot establish exact counts. No vendor choice is justified yet.

## Acceptance, approvals and next step

1. Drift-check cited commands, audit triggers, usage contracts and current user changes. Stop if ownership differs. Build pure catalog/cadence/cost fixtures first: DST, year boundaries, retries, bulk actions, gaps, unknown prices and invoice reconciliation.
2. Propose ADR, domain contracts, retention and migration SQL. Obtain approval before schema/stored-data/permission changes. In an approved disposable database, prove rollback atomicity, actor attribution, redaction, duplicate handling and cross-tenant denial.
3. Evaluate backend candidates from current primary documentation for deduplication, deletion, export, tenancy, residency and cost. Approval covers service/dependency, spend, credentials and data transfer before integration. Test ACK loss, spool saturation, expiry and backend outage with fakes first.
4. Obtain recovery targets/destination/retention and credential authorization; run and record an isolated database-plus-Storage restore before claiming protection. UI implementation requires styleguide and FigJam maintenance. Deployment requires approval.

Synthesis decision belongs to the owning architect. Immediate implementation step after selection is the pure catalog and metric fixture suite.
