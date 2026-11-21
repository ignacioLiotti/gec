# ADR 0044: Bound platform operations to observed data

## Status

Accepted and implemented locally on 2026-10-17. Production collection coverage, authenticated browser runtime, and backup activation remain unverified. The real client component was exercised with synthetic fixtures in a local browser.

## Context

Platform operators need one place to inspect tenants, product activity, recorded costs, audit changes, OCR processing, source health, and recovery evidence. The repository already stores fragments of this information in audit rows, quota events, and mutable OCR processing records. These sources were built for different jobs. They do not form a complete product analytics or billing system.

Treating those records as complete would create false adoption rates, false cost totals, and false recovery claims. Building a durable event catalog, transactional outbox, invoice reconciliation system, and production backup service requires schema, credential, and production decisions outside this local increment.

## Decision

Add a local platform operations console with six views: Resumen, Tenants, Uso, Costos, Trazabilidad, and Salud y backups. Serve the same projection through `GET /api/admin/operations`.

Check the effective superadmin role before creating or using an admin client. Permission simulation changes the effective role and can deny access. Existing limit-management exceptions do not grant access to this console.

Build a bounded read model from existing sources. Read at most 200 tenants. Read at most 1,000 records from each event source for each current or previous period, in pages of 250. Mark a source `partial` when rows fail validation, a read fails after some rows arrive, or the cap truncates the result. Mark the source `unavailable` when the read fails before any valid rows arrive. Show each source state and coverage note in the console.

Use UTC observation windows. Activity and cadence include only completed UTC days before the start of today. Operation, audit, and cost inspection can include records through the live request time, with today labeled partial. Every result is an `observed_sample`. The console does not report adoption rates, full historical coverage, or an absence of activity outside the loaded sample.

Expose only the audit values on this allowlist:

- `status`
- `is_active`
- `rows_extracted`
- `retry_count`
- `processing_duration_ms`
- `materialization_version`

Return a count for changed fields outside the allowlist. Preserve the exact extraction ID as a correlation key when a structured audit context or an OCR record provides it. Do not expose arbitrary `before_data`, `after_data`, document content, provider responses, or secret values.

Record OCR request-attempt phases as zero-amount usage ledger rows. The phases are `started`, `completed`, and `failed`. Phase writes are best effort. They do not share a transaction with the OCR business write and are not exactly once. One server-generated extraction ID correlates a route attempt with its audit, metering, and mutable document state. A retry receives a new extraction ID and counts as another request attempt. The console therefore reports observed OCR requests, not unique human business actions.

Use the server-verified request origin to decide whether an OCR request can contribute to ordinary human activity. A known regular origin attributes the authenticated user. A verified impersonation origin attributes the initiating operator and keeps the executing identity separate, but remains excluded from the ordinary human-activity count. Unknown origins remain visible for operations investigation but do not count as human activity.

Use `ocr_document_processing` as a fallback for the current mutable document state. It does not provide an execution history. A later update can replace the prior status for the same document.

Classify known reservation and rollback contexts as ineligible for priced or unpriced cost-event counts. Keep `netAmount` as the signed sum recorded in the quota ledger. The ledger can contain reservation and settlement entries that double-count quantities when read as incurred usage. Price coverage, invoices, shared allocations, currencies, and provider reconciliation remain unknown unless a separate source supplies them.

Read recovery status only from the sanitized file named by `OPERATIONS_RECOVERY_STATUS_PATH`. The status contract covers database, Auth, Storage object bytes and metadata, and configuration. A `verified` evidence state means that local size and checksum checks passed and a complete restore attestation was recorded. It does not prove that the application independently observed a restore. This decision does not capture production data, install a scheduler, create backup storage, or apply retention.

This increment adds no database schema, dependency, production job, credential use, or external service.

## Consequences

The console gives operators one investigation flow without claiming that current records are complete analytics, accounting, or recovery proof. Tenant and period filters apply to all six views. Exact IDs connect the bounded records when the source provides them.

The limits can omit older or high-volume records. The console reports truncation instead of extrapolating. A source failure can leave other views usable because every source carries its own state.

OCR phase loss, duplicate attempts, and late records remain possible. The mutable OCR document source can show the latest state when phase evidence is missing, but it cannot reconstruct prior attempts.

Cost quantities remain operational ledger values. They are not invoices. Recovery remains unconfigured or locally evidenced until an operator authorizes and runs production backup and restore work.

Future work needs a versioned action catalog and a dedicated transactional outbox for covered business actions. It also needs wider feature instrumentation, deterministic cost classification and invoice reconciliation, and authorized production backup activation with complete Auth and Storage recovery.

## Alternatives considered

### Treat existing rows as complete analytics

Rejected because audit triggers, actor attribution, OCR phases, pricing, and historical coverage are incomplete. Missing records cannot be interpreted as zero activity.

### Add a generic event ledger and outbox now

Deferred because this increment has no schema-change authority. A generic ledger also needs an action catalog, retry identity, retention, and migration plan before it can replace domain records.

### Use sampled technical telemetry for product activity

Rejected because sampled traces and page analytics cannot count business actions or establish tenant adoption.

### Activate production backup automation with the console

Rejected because the destination, retention, recovery objectives, credentials, spend, and production authority are unresolved.

## Related files

- `app/admin/operations/`
- `app/api/admin/operations/route.ts`
- `lib/admin/operations/`
- `lib/ocr-observation.ts`
- `lib/operations-recovery.ts`
- `scripts/recovery/`

## Related domain docs

- [Platform operations architecture](../architecture/platform-operations.md)
- [Supabase backup and recovery](../supabase-backup.md)
- [Platform telemetry and tenant operations plan](../../plans/2026-10-17-platform-telemetry/README.md)

## Agent notes

Keep the `observed_sample` label and source states when adding fields or views. Do not turn a missing, partial, truncated, or pre-instrumentation source into zero. Do not add a feature to human activity until its actor origin and retry semantics are explicit.
