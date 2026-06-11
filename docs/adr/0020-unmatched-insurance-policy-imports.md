# ADR 0020: Unmatched Insurance Policy Imports

## Status

Accepted

## Context

Insurance policy spreadsheets may include valid policies whose obra reference cannot be matched confidently to an existing obra. Blocking or discarding those rows hides import data and makes the general policy tables incomplete.

The previous model required `insurance_policies.obra_id`, so every imported policy had to be attached to an obra before it could be persisted.

## Decision

Allow `insurance_policies.obra_id` to be nullable for imported policies that do not have a confident obra match.

- Matched imports keep `obra_id` and `import_match_status = 'matched'`.
- Unmatched imports use `obra_id = null`, `import_match_status = 'unmatched'`, and the display label `No se encontró obra adecuada`.
- Unmatched rows are visible in general insurance policy tables.
- Per-obra synchronized tables only include policies with a matched `obra_id`.
- RLS still requires tenant membership, and matched rows must point to a non-deleted obra in the same tenant.

## Consequences

The canonical insurance policy table can now represent the import state before a policy is assigned to an obra. General policy views must account for nullable obra joins, while obra detail views continue to show only policies assigned to that obra.
