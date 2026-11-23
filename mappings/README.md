# CRM maps

The dashboard only knows one CRM shape: the canonical tables in
[`contract/data_dictionary.md`](../contract/data_dictionary.md). Each real CRM gets one map file
here that says how its raw tables turn into that shape. Swapping CRMs means writing a new map,
not touching any SQL downstream.

```
mappings/crm/hubspot.yml ──make compile-maps CRM=hubspot──▶ dbt/models/staging/crm/*  (generated)
```

Never edit the generated files. Change the map and compile again.

## Writing a map

Start by copying `crm/hubspot.yml`. A map has four settings at the top and one block per
canonical table.

```yaml
crm: hubspot # the map's name; must match the file name
contract_version: 1.0.0 # contract version the map was written for
source_schema: crm_hubspot # schema where your CRM sync lands the raw tables
timezone: UTC # zone of raw timestamps that carry no zone of their own
```

Then one block for each of the six canonical tables: `users`, `accounts`, `contacts`, `leads`,
`opportunities`, `opportunity_stage_history`.

```yaml
opportunities:
  source: deals # the raw table to read
  filter: "is_deleted = false" # optional SQL condition on the raw table
  columns: # canonical column: where it comes from
    opportunity_id: hs_object_id # a raw column...
    name: { expr: "concat_ws(' ', first_name, last_name)" } # ...or a SQL expression
    domain: { column: website, transform: domain } # ...or a column with a clean-up step
  values: # translate the CRM's values into canonical ones
    stage:
      closedwon: won
      closedlost: lost
  derived: # canonical columns computed from other canonical columns
    is_won: "stage = 'won'"
```

### The rules

- **Every canonical column must appear** in `columns` or `derived`. If your CRM doesn't have
  one, say so on purpose: `industry: { expr: "null" }`.
- **Canonical values must be ones the contract allows.** `closedwon: won` is fine;
  `closedwon: closed_won` is rejected, because `closed_won` isn't a canonical stage. Columns with
  a format instead of a list (such as two-letter country codes) must match that format.
- **Source values you didn't map** are passed through unchanged. They then fail the contract's
  tests, and they are listed in `intermediate.int_crm__unmapped_values` with a row count, so you
  know exactly what to add to the map.
- **A CRM that can't provide stage history** can say so; the table is then created empty with
  the right columns, and pages that need it show that the data isn't available:

  ```yaml
  opportunity_stage_history:
    supported: false
  ```

  Only tables the contract marks as optional can be unsupported.

- **Timestamps** are read as wall-clock times in `timezone` and stored in UTC. If one column is
  in a different zone, override it: `created_at: { column: createdate, timezone: Europe/London }`.
- **Clean-up steps** (`transform`): `domain` (lower-case, no `https://`, no `www.`, no path),
  `lower`, `upper`, `trim`.

## Checking a map

```bash
uv run python scripts/compile_mappings.py validate mappings/crm/<crm>.yml   # just check it
make compile-maps CRM=<crm>                                                  # check and compile
make compiled-check CRM=<crm>                                                # committed output current?
```

A rejected map lists every problem at once, for example:

```
map rejected: salesforce.yml (2 problem(s))
  - opportunities: missing required contract column 'close_date'
  - opportunities.values.stage: 'Closed Won' maps to unknown canonical value 'closed_won' (allowed: [...])
```
