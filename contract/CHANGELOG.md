# Schema contract changelog

Every semantic change to `schema_contract.yml` bumps `contract_version` and adds an entry here.
Major: a column or table removed or renamed, a type or nullability tightened, an allowed value removed.
Minor: a table, column or allowed value added, or a constraint loosened. Patch: descriptions only.

## 1.0.0 · 2026-11-23

First version: 15 canonical staging tables across CRM (6), billing (4), ledger (3) and rates (2).

- Money is in major units in staging (`amount` + `currency`), as PLAN.md Stage 4 requires. Stage 1's `amount_minor` columns stay in the raw schemas only.
- Added `stg_ledger__disputes.dispute_type` (`dispute` | `return`), needed for the dispute/return rate metric.
- `stg_crm__opportunity_stage_history` is optional: a CRM map may declare it unsupported and emit it typed and empty.
