# ADR 0025: Insurance Policy Financial Movements

## Status

Accepted

## Context

Insurance policy imports now receive two different producer spreadsheet families:

- policy master/list spreadsheets, which describe the operational policy record;
- exigible/current-account spreadsheets, which describe financial rows by policy, endorsement, installment, due date, and balance.

The exigible spreadsheet does not carry obra matching, cancellation workflow, definitive reception, or whether a policy is maintenance of offer. It does carry positive balances and negative balances. The policy owner confirmed that negative balances are credit notes that must be checked against Tango.

Storing only one `balance` on `insurance_policies` would collapse audit detail and make negative credit notes look like ordinary negative debt.

## Decision

Keep `insurance_policies` as the canonical operational policy summary and add `insurance_policy_financial_movements` for exigible/current-account rows.

The importer detects exigible spreadsheets by headers such as `PolizaNro`, `EndosoNro`, `SaldoPremio`, and `VigenciaHastaEndoso`.

For exigible imports:

- `PolizaNro` and `EndosoNro` compose the operational policy identity as `PolizaNro / EndosoNro`, matching the master spreadsheet policy-number shape;
- existing policy obra assignments and operational workflow fields are preserved;
- missing policies are created as unmatched and presumed active until validated;
- `SaldoPremio < 0` is stored as `movement_type = credit_note`;
- the policy summary keeps net observed balance for prioritization;
- detailed movement rows retain policy, endorsement, installment, invoice, dates, due/upcoming/balance amounts, source file, cutoff date, and raw row.

## Consequences

The UI can distinguish observed debt from credit notes and avoid presenting credits as savings or confirmed overbilling.

Confirmed savings still requires comparing charges after the expected cancellation date against credit notes/compensations. The exigible import alone only supports risk and validation buckets.
