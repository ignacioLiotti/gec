# Supabase backup and recovery

## Current status

The repository has a manual production-to-local clone tool, but no scheduled backup runner, offsite upload, retention configuration or recorded restore drill. Production's managed backup settings have not been verified. This runbook defines the proposed recovery requirements; it does not establish that production is protected.

`scripts/clone-prod-to-local.ps1` is a separate, explicitly gated local-clone tool. Its selected public/Auth/Storage handling must not be treated as a complete backup or scheduled recovery process.

## Operator decisions before activation

Record the production project, backup owner, alert destination, independent encrypted storage destination and budget. Approve:

- **Recovery point objective:** the maximum acceptable age of recovered data. A nightly copy alone can lose changes made since that copy. Evaluate managed point-in-time recovery if this loss is unacceptable.
- **Recovery time objective:** the maximum acceptable time to restore and validate the service. Establish this through a timed restore, rather than a guessed duration.
- **Retention:** proposed baseline of 30 daily recovery sets and a weekly restore drill. Approve actual retention, storage versioning and lifecycle rules before activation.
- **Recovery scope:** full-platform recovery, including Auth, database policies and document objects. A production database restore affects all tenants.

Credential use, a new cloud destination, paid services and production changes require explicit authorization under `AGENTS.md`. Keep secret values in the approved secret manager. Never write connection strings, tokens, dumps or tenant data to Git or general job logs.

The disabled template at `scripts/recovery/activation-config.example.json` records every activation input without containing a schedule or usable secret. Before any production job is created, an operator must provide and approve all of these values:

- exact Supabase project reference and the secret-manager reference for its backup credential;
- schedule, timezone and the age at which a missing or stale run alerts;
- maximum data-loss and recovery durations;
- independent encrypted destination provider, container and path prefix;
- secret-manager reference for the destination encryption key;
- destination versioning setting, daily and weekly retention counts, lifecycle policy and minimum known-good sets that retention cannot remove;
- isolated restore target, drill schedule and accountable operator;
- backup owner and alert destination; and
- budget and authority for credentials, external services and any production change.

Keep `enabled` false until those values and the destination's deletion behavior have been reviewed. This repository does not install a cron job or lifecycle policy.

## Recovery set

Each recovery set needs a unique run ID and a manifest with environment, source project reference, capture start/end times, PostgreSQL/tool versions, deployed migration version, available application release SHA, artifact sizes and checksums. Keep the manifest private because it identifies the production environment.

| Component | Required evidence |
| --- | --- |
| Database | Recoverable schema, data, functions, policies, required roles/extensions and migration history. Test the selected tool's coverage of managed schemas and project customizations. |
| Auth | Verified recovery of identities and required authentication data. Document external Auth settings and credentials that need separate provisioning. A selected `auth.users` CSV is insufficient. |
| Storage | Bucket configuration, object bytes and metadata required for the application to resolve each object. Capture object versions or checksums and retain deleted/overwritten versions for the approved period. |
| Configuration | Inventory of required application, Supabase and provider configuration, with secret references and a provisioning procedure. Do not place plaintext secrets in the manifest. |

Supabase's database backups include Storage metadata but exclude object bytes. Restore the objects separately. Managed backup availability and retention depend on the project's configuration. Confirm them using the [official backup guide](https://supabase.com/docs/guides/platform/backups).

For logical backups, follow the [official CLI backup and restore procedure](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore) for the deployed versions. It separates roles, schema and data exports and covers additional platform settings/customizations. A public-data-only dump is not a complete recovery set. Do not blindly combine a full schema restore with replaying all migrations into an already populated target.

## Scheduled backup contract

The future runner must:

1. Read approved configuration without printing credentials and reject an unexpected source project.
2. Capture the database and versioned Storage objects. Record their capture windows and any consistency limits. Independently timed copies do not automatically represent one consistent recovery point.
3. Encrypt and upload all artifacts to a destination independent of the production project. Use a unique path per recovery set. Do not mirror production deletions into retained backups.
4. Verify checksums and expected artifact/object coverage, then publish the manifest as complete. A failed or partial upload must remain incomplete.
5. Record success/failure, duration and the latest complete recovery point without exposing tenant data. Alert on failure and when the last complete recovery set exceeds the approved age, including when no job runs.
6. Apply the approved retention policy only to the backup destination. A failed job must not delete the last known good recovery set.

Keep backup failure and restore validation separate. A successful export/upload does not establish recoverability.

## Local recovery evidence verifier

`scripts/recovery/verify-recovery-set.mjs` validates a private recovery-set manifest without contacting Supabase or a backup destination. The manifest stays beside its artifacts in the private recovery-set directory. Artifact paths must be relative to that directory. Parent traversal, absolute paths, symlinks and non-regular files are rejected before artifact content is read.

The manifest schema requires the recovery-set capture window, source and tool metadata, and one or more artifacts for each component. The component scopes are explicit:

- database: schema, data, functions, policies, roles/extensions and migration history;
- Auth: identities, required authentication data and an external-settings inventory;
- Storage: bucket configuration, object bytes, object metadata and object versions or checksums; and
- configuration: inventory, secret references and a provisioning procedure.

The verifier recalculates each artifact's byte size and SHA-256 checksum. It also requires every artifact capture window to fall inside the declared recovery-set window, with the outer window matching the artifact envelope. A database dump, a selected `auth.users` export, Storage metadata without object bytes or an incomplete upload cannot produce a `verified` status.

Run a structural check first:

```powershell
node scripts/recovery/verify-recovery-set.mjs --manifest C:\private\recovery-set\manifest.json
```

Run byte verification only where the private artifacts are mounted:

```powershell
node scripts/recovery/verify-recovery-set.mjs --manifest C:\private\recovery-set\manifest.json --verify-artifacts --output-status var\recovery-status.json
```

`--output-status` accepts a path relative to the repository working directory and writes only the sanitized status contract. It omits the source project, artifact paths, filenames, sizes, checksums, tool versions and error text. Keep the private manifest, restore report and backup artifacts outside Git.

The output directory must already exist. Configure `OPERATIONS_RECOVERY_STATUS_PATH` on the application server with the absolute path to this sanitized output. The console reports an unset path as unconfigured and an unreadable or invalid configured file as unavailable. It never reads the private manifest.

The status states have narrow meanings:

- `unconfigured` means the manifest path does not exist;
- `partial` means evidence is incomplete, malformed, unchecked or failed validation; and
- `verified` means all four declared component scopes passed local size/checksum validation and a separate, checksummed restore-drill record for the same run is complete.

The status includes `verificationScope: artifact-integrity-and-recorded-restore-attestation`. The verifier checks the restore record's structure, checksum, run ID, timing, all four component attestations, isolation flags and application-check results. It does not independently observe the restore target or prove that those recorded assertions are true. The dashboard must label this as a recorded restore attestation until an authorized drill runner produces and reviews the evidence.

The sanitized JSON contract is defined in `scripts/recovery/status-contract.mjs`. Server code should parse a configured status file through that strict schema and fall back to `unconfigured` when no approved status path exists. Do not read the private manifest from the application process.

## Restore drill

Use an approved isolated environment with compatible PostgreSQL, Supabase services and application versions. Prefer an already provisioned test environment; creating paid cloud resources requires authorization. Never restore over production during a drill.

1. Select a complete recovery set and validate its manifest and checksums.
2. Confirm the restore target is isolated and cannot send real emails, WhatsApp messages, webhooks, billing requests or scheduled jobs. Disable outbound side effects before restoring data or starting workers.
3. Restore the database using the matching logical/physical procedure. Reconcile migration history and platform customizations without replaying conflicting schema definitions.
4. Restore the matching object versions and bucket settings. Verify database references resolve to the intended files and report inconsistencies between capture windows.
5. Validate table/constraint/index/trigger coverage, Auth identities, tenant RLS, representative obra/document relationships and application reads. Use dedicated test identities and sanitized reports; do not expose production records in logs.
6. Exercise a document download and a read in each critical business flow. Confirm the drill environment still cannot dispatch external side effects.
7. Record actual recovered timestamps, elapsed recovery time, missing components and validation failures. Compare the result to the approved recovery objectives.
8. Remove temporary resources only after retaining the sanitized drill evidence and confirming the exact disposable targets.

A tenant-specific incident should first restore into isolation. Any selective repair back into production needs a separate approved data-migration procedure; a whole-project restore can roll back every tenant.

## Evidence and dashboard status

Store backup and drill results in the approved private operations store, not in repository Markdown containing production data. Report the last complete backup, last successful restore drill, coverage, freshness and failures separately. Until a successful drill exists, show recovery validation as **unverified**.

The implementation sequence and related telemetry/audit work are tracked in [the platform telemetry plan](../plans/2026-10-17-platform-telemetry/README.md).
