# Schema contract changelog

Every semantic change to `schema_contract.yml` bumps `contract_version` and adds an entry here.
Major: a column or table removed or renamed, a type or nullability tightened, an allowed value removed.
Minor: a table, column or allowed value added, or a constraint loosened. Patch: descriptions only.

## 2.0.0 · 2026-11-24

- **Breaking:** `stg_rates__pricing_rates.account_ref` (a CRM account) is replaced by `billing_customer_id` (a billing customer), and the primary key and foreign key follow it. Pricing lives with billing, so every customer's usage revenue can be computed even when the CRM match fails (about 2% of customers have no Stripe id and no domain in the CRM).

## 1.0.0 · 2026-11-23

First version: 15 canonical staging tables across CRM (6), billing (4), ledger (3) and rates (2).

- Money is in major units in staging (`amount` + `currency`), as PLAN.md Stage 4 requires. Stage 1's `amount_minor` columns stay in the raw schemas only.
- Added `stg_ledger__disputes.dispute_type` (`dispute` | `return`), needed for the dispute/return rate metric.
- `stg_crm__opportunity_stage_history` is optional: a CRM map may declare it unsupported and emit it typed and empty.
