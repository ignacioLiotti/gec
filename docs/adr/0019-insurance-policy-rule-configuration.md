# ADR 0019: Insurance Policy Rule Configuration

## Status

Accepted

## Context

Insurance policies are imported from a global spreadsheet and then used operationally when an obra is completed. The spreadsheet may include a policy coverage end date, but the cancellation/baja date is a business decision that depends on a user-selected rule.

Previously the data model used `on_finish` as a default rule, which made imported policies look as if they had an explicit cancellation logic even when the user had not chosen one.

## Decision

Add `insurance_policies.cancellation_rule_configured` to distinguish imported policy data from user-configured cancellation logic.

- Imported policies keep the Excel fields as imported.
- New imports and manual policies do not calculate `calculated_cancellation_date` unless a rule was explicitly provided or later configured.
- Obra completion stores `obra_finished_at` for related policies, but only calculates a cancellation date for policies where `cancellation_rule_configured = true`.
- `obra_finished_at` is a provisional base date. Users can later provide `insurance_policies.definitive_reception_date`; when present, the definitive reception date becomes the preferred base for `calculated_cancellation_date`.
- `insurance_policies.cancellation_requested_at`, `cancellation_confirmed_at`, and `cancellation_notes` track the operational baja workflow after a policy is identified as needing action.
- Editing a policy date alone does not configure a cancellation rule.

## Consequences

The insurance tab can show two separate views:

- Imported: read-only source data from Excel.
- Related: policies attached to completed obras, with cancellation dates shown only after a user-defined rule exists.

Existing calculated dates created from implicit defaults are cleared by migration `0111_insurance_policy_rule_configuration.sql` unless the new configuration flag is true.

Migration `0115_insurance_policy_definitive_reception_date.sql` adds the optional definitive reception date. This keeps the operational approximation useful immediately after an obra is marked complete while allowing a more precise recalculation once the definitive reception document/date is available.

Migration `0120_insurance_policy_cancellation_workflow.sql` adds the minimal cancellation workflow fields. Policies with a requested baja move from unmanaged recurring risk into follow-up, and confirmed bajas can be reviewed separately for old balances, credits, or compensations.
