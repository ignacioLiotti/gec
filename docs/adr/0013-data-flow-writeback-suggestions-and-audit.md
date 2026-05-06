# ADR 0013: Data-flow writeback with suggestions and audit

## Status

Accepted

## Context

Data-flow results can derive official obra values from obra fields, extracted tables, macro tables, and tenant-level configuration. Some results need to feed back into obra fields so the main obra table and General tab can consume them.

Direct writeback is risky when a result depends on the same field it overwrites, when the calculation is incomplete, or when users need to approve business-critical changes.

## Decision

Each data-flow result has an explicit writeback mode:

- `none`: result is display-only.
- `suggest`: result creates a pending obra-field suggestion.
- `auto`: result writes the target obra field automatically.

Writeback targets can be base obra fields or custom obra fields stored in `custom_data`.

The recompute layer blocks writeback when:

- the result has no target field;
- the result is not `ok`;
- the target field is not allowed;
- the target is the internal `dataFlowBuilder` custom key;
- the result depends on the same obra field it wants to overwrite;
- the calculated value equals the current value.

Every recompute run is recorded. Suggestions and automatic writes are persisted separately so UI and audit surfaces can show what happened, why, and which result caused it.

## Consequences

Data-flow becomes the owner of official calculated business values when configured to write back. Main-table formulas remain lightweight view/local-row derivations and should not be treated as the source of data-flow truth.

Automatic recompute can be triggered by a source-change route, but importers should call it deliberately so each import flow can decide whether to block, suggest, or write automatically.
