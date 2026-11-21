# Candidate A: Postgres owns durable operational facts

## Usage, caller first

Existing domain commands gain transactional implementations. Callers never separately emit audit or successful-action events.

```ts
// Existing configuration route, after request parsing.
await saveDataFlowConfig(session, {
  tenantId, operationId, config,
});
// Returns the existing domain result; commit also records redacted audit
// and one configuration.saved action. Repeated operationId returns its result.

// Extraction worker completes the durable operation created at submission.
await completeExtraction(worker, {
  operationId, result,
});
// Loads tenant and initiating identity from the operation, not worker input.
// Commits results and extraction.completed once; reservations are not actions.

// Operator tenant overview; filter is an explicit server-validated scope.
const overview = await readTenantOperations(session, {
  scope: { kind: "tenant", tenantId }, asOf,
});
// Returns usage, activity, costs, health and recovery with separate freshness.
```

## Problem and grounding

The current system has useful but incompatible evidence: UTC-month billing counters, optionally logged signed usage deltas, trigger-based row audits, domain histories, and sampled Sentry traces. None alone describes completed human tasks. Audit currently stores full row JSON, may lose service-role attribution, and silently skips unresolved tenants. Backup documentation describes procedures without an executable runner or restore evidence. These constraints come from `../evidence.md`; production configuration remains unverified.

## Shape and ownership

```ts
type Initiator =
  | { kind: "human"; userId: UserId }
  | { kind: "system"; job: JobName };
type ActionName = "configuration.saved" | "extraction.completed"
  | "obra.created" | "document.generated";
type Operation = {
  id: OperationId; tenantId: TenantId; initiator: Initiator;
  action: ActionName; state: "pending" | "completed" | "failed";
};
type Cost =
  | { kind: "actual"; money: Money; invoiceLine: InvoiceLineId }
  | { kind: "estimated"; money: Money; rateVersion: RateVersion }
  | { kind: "allocated"; money: Money; allocationVersion: AllocationVersion }
  | { kind: "unknown"; reason: string };
type Cadence = {
  zone: IanaZone; window: "28-days" | "8-weeks" | "3-months";
  activePeriods: number; eligiblePeriods: number;
  status: "complete" | "insufficient-history" | "coverage-gap";
};
declare function saveDataFlowConfig(
  session: VerifiedSession, command: SaveDataFlowConfig
): Promise<DataFlowConfig>;
declare function completeExtraction(
  worker: VerifiedWorker, command: CompleteExtraction
): Promise<ExtractionResult>;
declare function readTenantOperations(
  session: VerifiedSession, query: OperationsQuery
): Promise<TenantOperations>;
// Sketch only. Supporting ID, command and result types retain domain ownership.
```

Domain modules own their writes. Each covered mutation uses a dedicated Postgres function through the existing Supabase client, with business write, operation completion, trigger audit and semantic event in one transaction. This is not a generic command dispatcher or callback transaction wrapper. Supabase calls on different requests cannot share a transaction.

`lib/product-activity` owns the versioned action catalog, cadence calculations and queries. A catalog entry defines its successful boundary, permitted dimensions and bulk counting rule. SQL constraints and TypeScript names derive from that catalog through a checked generation step. Migration snapshots remain immutable. `lib/operations` owns authorized composite reads, not competing counters. `lib/operating-costs` owns pricing and reconciliation. Existing `lib/tenant-usage.ts` remains billing's owner, preserving limits, signed adjustments and UTC periods.

The database owns audit guarantees. Approved triggers resolve tenant explicitly and reject unresolved scope on covered tables. They persist changed field names and allowlisted values; secret values, document contents and arbitrary metadata never enter audit payloads. Secret rotation records identifiers and outcome only. Existing historical payload exposure needs immediate read redaction, with retention or historical sanitization requiring separate approval. Preserve domain histories and correlate operation IDs instead of duplicating them.

Human identity comes from authenticated claims. Worker identity and initiating identity remain separate. Trusted worker functions recover the tenant and initiator from a persisted operation, with job authorization; arbitrary client actor settings are forbidden. Transaction-local context cannot leak between pooled sessions. Revoke direct audit insertion and restrict mutation functions, audit reads and cross-tenant summaries under reviewed grants/RLS. Respect effective permissions during simulation.

This small command interface hides authorization, atomicity, redaction and deduplication per boundary-discipline. Routes retain domain validation; no parallel manual event API competes with commands.

## Storage and read patterns

- `operations`: unique tenant/operation ID, request fingerprint and result reference. Duplicate matching requests reuse results; conflicting payloads fail. Row locking serializes completion. Pending work survives crashes; retry resumes it without repeating external side effects, using provider idempotency where available and reconciliation otherwise.
- `product_action_events`: append-only successful tasks, unique tenant/operation/action/version. UTC server completion time, actor category, action version, correlation ID and bounded dimensions. No text content. Bulk completion produces one task event with affected-object count; individual row audit remains detailed.
- Audit indexes support tenant/time/ID cursor pagination and tenant/entity/time investigations. Action indexes support tenant/time/action and tenant/actor/time. Operation IDs join audit, action and existing domain histories.
- Daily actor/action aggregates are rebuildable projections with a source watermark and timezone version. Recompute affected buckets from source facts; do not increment on replay. Coverage records identify instrumented intervals per action and tenant.
- Cost facts retain invoice source/version, period, currency and charge identity. Unique source/line/revision prevents duplicate imports. Overview reads paginated tenant summaries plus bounded period aggregates, never raw-event scans across every tenant. Verify query plans against representative fixtures before adding indexes or partitioning.

## Meaning of usage and habit

An action counts when its domain result commits. A directly requested asynchronous task counts as human activity at completion when its durable initiator is human; scheduled recomputation counts as system activity. Retries, previews, page views, reservation/settlement pairs and failed tasks do not count as successful tasks. Show system throughput separately.

Use a persisted tenant reporting timezone, explicitly UTC until configured. Half-open local-calendar intervals handle DST. Days start at midnight, weeks on Monday, months on day one. Evaluate the last 28 complete days, eight complete weeks and three complete months before `asOf`; omit the current partial period. These are proposed reporting windows, not observed behavior.

For each tenant or user and action, report distinct active periods divided by eligible periods. Eligible periods require full instrumentation coverage and, for users, continuous membership. Never treat unobserved periods as zero. “Daily recurring” means 28/28, “weekly recurring” 8/8 and “monthly recurring” 3/3; labels can coexist. Otherwise display the ratio without an invented habit class. Too few eligible periods means insufficient history; missing collection intervals mean coverage gap. Tenant activity is the union of human actors. Distinct-user totals use event-level actor identity, not sums of daily distinct counts. Timezone changes rebuild reports with a visible version; no historical actions are inferred from billing deltas.

## Costs, health and recovery

Keep measured quantities separate from money. Effective-dated rates require source, unit, currency and applicability. Missing Gemini pricing stays unknown. Actual invoices supersede corresponding estimates only after charge-level reconciliation; never add both. Shared infrastructure allocations show their basis and unallocated remainder. Do not silently combine currencies or present incomplete estimates as complete operating costs.

Sentry retains sampled diagnostics with scrubbed tenant/operation correlation. Exact action counts come from Postgres. Tenant overview shows last human activity, cadence, limits, costs and evidence freshness. Recovery health is platform-scoped; sampled absence of errors is not proof of tenant health.

Recovery requires approved RPO/RTO, destination and retention. Package database schema/data, required auth/platform configuration, bucket policies and Storage bytes with a manifest, object hashes, capture interval and recovery-point consistency checks. Deletes during capture must be covered by version retention or coordinated capture. Encrypt offsite copies and record backup runs outside the source database. Restore into an isolated environment, verify roles/RLS, tenant isolation, authentication, document downloads and object completeness, then record measured loss window and restoration duration. A successful dump alone never means recoverable.

## Decisions, alternatives and acceptance

We accept analytical workload on Postgres in exchange for transactional collection and one durable source. A hybrid external collector hides analytics query complexity but exposes delivery lag, consent/export boundaries, reconciliation and another operator dependency. It wins only after measured volume or exploratory needs justify those costs. Sending Sentry traces as product counts loses unsampled actions and cannot meet exactness.

Synthesis decision remains with the parent review. This candidate passed the red-flag screen by keeping one owner per fact and domain-specific commands.

Implement one configuration flow first. Fixture checks prove DST windows, sparse history, bulk/retry counting, missing prices and invoice replacement. Disposable database tests prove rollback atomicity, concurrent deduplication, redaction, worker attribution and cross-tenant denial. Then expand the action coverage matrix and verify billing regression tests unchanged. Approve schema/permission changes before application; credentials, external jobs, storage destinations and spending require separate authority. UI implementation requires design-system and FigJam workflow updates. Production recovery claims require an actual restore drill. No implementation or remote action is authorized by this candidate.
