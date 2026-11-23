# Synthetic-First Dashboard Project: Execution Plan (v2)

Status: Plan finalized 2026-11-23. Ready to hand off to a coding environment.
Supersedes v1 (`metabase-portfolio-plan.md`). Drop this file into the repo root as `PLAN.md`.

---

## 0. How to use this document

- Work stage by stage, in order. Each stage has a **goal**, **deliverables**, **acceptance criteria** and **CI additions**.
- Every stage ends in a **gate** (Section 4A). A stage is done only when its gate passes locally **and** in CI. No work on the next stage starts before that.
- Stages 7 and 8 can run in parallel once Stage 6 is done.
- Anything marked **[decision]** is locked. Change it only on purpose, and update this file when you do.
- Anything marked **[verify]** was not confirmed in vendor docs. Check it when you reach it.

---

## 1. Locked decisions

| # | Decision | Why |
|---|---|---|
| D1 | **Primary front-end route: custom React app on the Metabase REST API**, through a small local proxy. The SDK is not the main route | The SDK is Pro/Enterprise only. API-key auth is for local evaluation only. Theming in code and drill-through in embeds are paid. The REST route runs on free open source, so the production swap is real and the design is fully ours |
| D2 | Metabase **open-source edition**, self-hosted in Docker, **image tag pinned** | Reproducibility. SDK and API behaviour change between versions |
| D3 | Metabase app DB is its **own Postgres**, not H2 | Durability, and it can be dumped and restored |
| D4 | **Stripe data is already in Postgres** (an upstream pipeline, out of scope). Billing tables keep Stripe's shape (minor units, Unix timestamps) | Every competent data team has this pipeline. Don't build it here |
| D5 | **The CRM is the messy, swappable source.** Each CRM gets a readable YAML map file. A compiler turns the map into staging models | The hub principle: the dashboard plugs into one canonical shape, and each CRM gets an adapter |
| D6 | **dbt Core** (dbt-postgres) for staging → intermediate → marts, plus tests | Tests, lineage, docs, and an industry-standard keyword |
| D7 | **All metric logic lives in SQL marts.** The YAML metric dictionary is the spec plus expected values. Metabase metrics/measures are only for simple additive metrics | Metabase metrics are query-builder-only and limited to one table. NRR, cohorts and velocity need SQL |
| D8 | **Metabase content as code:** React-facing questions are native SQL files in the repo, created idempotently through the API | Serialization and remote sync are paid. Native SQL cards move cleanly between instances |
| D9 | Charts: **OPEN — owner decides at Stage 7.** Two preferred candidates to be named by the owner; Apache ECharts is the fallback. UI: **Radix primitives + Tailwind**, driven by our own tokens. Data fetching: **TanStack Query** | Choose against the chart-library criteria in Stage 7 |
| D10 | Four pages: **Pipeline & funnel**, **Revenue & retention** (incl. activation), **Account health & risk**, **Account 360** (drill target). The rep deep dive becomes a filter on page 1 | The full loop is better shown by one account's timeline than by a fourth summary page |
| D11 | **Fixed as-of date** for all data: `2026-10-31`, with 24 months of history. Never use `now()` | Deterministic data, tests and screenshots |
| D12 | **The AI boundary is enforced, not just a rule.** Production credentials never live in the repo, in CI, or anywhere the coding agent can read | This is what makes the privacy claim credible |
| D13 | GitHub Actions for CI/CD. The static snapshot is deployed to Cloudflare Pages | Automated proof at every stage. A clickable demo with no hosted Metabase |
| D14 | **Build locally now, deploy to cloud later (Stage 10).** Target: data DB on **Supabase Cloud**, Metabase self-hosted on a **VPS via Coolify**, React on **Cloudflare Pages**, proxy as a **Cloudflare Worker**. Everything built locally must follow the cloud-ready rules in Section 2A | Local is faster to build. The cloud move should be configuration, not a rewrite |

---

## 2. Architecture

```
                 ┌──────────────── upstream (out of scope) ────────────────┐
                 │  Stripe → Postgres pipeline   Payments ledger DB   CRM sync│
                 └──────────────────────────────────────────────────────────┘
                                        │
Postgres (data)                         ▼
  raw schemas:   crm_hubspot | crm_salesforce | billing (Stripe-shaped) | ledger | rates
        │
        │  mappings/crm/<crm>.yml ──compile──▶ dbt staging models (generated)
        ▼
  staging  (canonical names, types, units, timezones, enum values)
        ▼
  intermediate  (identity resolution, stage transitions, FX conversion, pricing lookup)
        ▼
  marts / analytics schema  (facts + dims; ALL metric logic)
        │
        ▼   read-only BI role
Metabase OSS (pinned)  ── native SQL cards (from repo) + models + simple metrics + native dashboards
        │
        ▼   REST API (POST /api/card/:id/query with parameters)
Local proxy (holds Metabase API key)
        │
        ▼
React (Vite + TS + ECharts)   ── live mode: via proxy | snapshot mode: static JSON
        │
        ▼
Cloudflare Pages (snapshot build only)
```

Database roles (D12):

| Role | Reads | Writes | Used by |
|---|---|---|---|
| `transformer` | raw schemas, staging, intermediate, marts | staging, intermediate, marts only | dbt |
| `bi_reader` | marts only | none | Metabase |
| `conformance` | raw schemas + all analytics schemas | none | conformance CLI |

---

## 2A. Local now, cloud later

### Target cloud setup (Stage 10)

```
Cloudflare Pages (React)  ──▶  Cloudflare Worker (proxy, holds Metabase API key)
                                        │ HTTPS
                                        ▼
                     VPS + Coolify: Metabase (pinned) + its own Postgres app DB
                                        │ SSL, bi_reader role
                                        ▼
                     Supabase Cloud: data Postgres (raw, staging, intermediate, analytics)
                                        ▲
                     GitHub Actions: generator + dbt build (transformer role)
```

| Layer | Local (now) | Cloud (later) |
|---|---|---|
| Data DB | `postgres-data` container | Supabase Cloud |
| Metabase + app DB | containers | VPS, deployed with Coolify from the same compose file |
| Proxy | Hono on Node | Same Hono app on a Cloudflare Worker |
| Front end | Vite dev server | Cloudflare Pages (live mode + snapshot mode) |
| Generator + dbt | `make` locally | GitHub Actions job against Supabase |

**Important distinction.** The cloud deployment still runs **synthetic data**. It's the public demo, not the "production swap" the method describes. So the cloud environment's credentials can live in GitHub secrets. Real company production credentials still never go anywhere the agent or CI can reach (D12).

### Cloud-ready rules (apply from Stage 0)

1. **Everything is configured by environment variables.** No hard-coded `localhost`, ports, hosts, schema names or keys. One `.env.example` per environment: `.env.local.example`, `.env.cloud.example`.
2. **Postgres compatibility with Supabase.** Run the local Postgres on the same major version as the Supabase project **[verify at Stage 0]**. Use only standard Postgres features and extensions Supabase supports.
3. **Never put project data in Supabase's `public` schema.** Supabase exposes `public` through its auto-generated API. Use `raw_*`, `staging`, `intermediate`, `analytics` schemas only.
4. **Database roles are created by a SQL migration script** (`deploy/sql/roles.sql`), not by hand, so the same three roles exist locally and on Supabase.
5. **Connections use SSL settings from env** (off locally, required in cloud). For Metabase and dbt on Supabase, use a direct or session-mode connection, not transaction-mode pooling **[verify: Supabase pooler modes and Metabase/dbt compatibility at Stage 10]**.
6. **The proxy is written to run on both Node and Cloudflare Workers.** Hono supports both. No Node-only APIs (filesystem, `process` outside config).
7. **Metabase is rebuilt from the repo**, never hand-configured (D8). The bootstrap script takes the Metabase URL and credentials from env, so it works the same against the VPS.
8. **The front end reads its API base URL from env.** Live mode and snapshot mode both work on Pages.
9. **Data size stays within Supabase's plan limits.** Check full-scale data size at Gate 3 against the plan in use **[verify current Supabase free-tier database size and inactivity-pause rules]**.

---

## 3. Repo structure

```
.
├── PLAN.md                      # this file
├── CLAUDE.md                    # rules for the coding agent (see Section 13)
├── JOURNAL.md                   # build journal for content (see Section 14)
├── skill/                       # reusable skill, extracted in Stage 11
├── Makefile                     # single entry point for everything
├── docker-compose.yml           # profiles: synthetic (default), prod (human-only)
├── .env.example                 # synthetic defaults only; no real secrets ever
├── contract/
│   ├── schema_contract.yml      # canonical tables + columns + types + nullability + grain
│   ├── data_dictionary.md       # human-readable version (generated from the YAML)
│   └── CHANGELOG.md             # contract versions
├── mappings/
│   ├── crm/
│   │   ├── hubspot.yml
│   │   └── salesforce.yml
│   └── README.md                # how to write a new CRM map
├── generator/                   # Python, seeded synthetic data
│   ├── config.yml               # scale, date range, rates, planted stories
│   ├── src/...
│   └── tests/
├── scripts/
│   ├── compile_mappings.py      # YAML maps → dbt staging SQL
│   ├── metabase_bootstrap.py    # idempotent: setup, DB connection, collections, cards, dashboards
│   ├── metabase_export_snapshot.py
│   ├── golden_check.py          # answer key vs marts vs Metabase cards
│   └── conformance/             # aggregate-only checks CLI
├── dbt/
│   ├── models/{staging,intermediate,marts}/
│   ├── tests/
│   └── profiles.yml             # reads env vars only
├── metrics/
│   └── metrics.yml              # metric dictionary (spec + expected values)
├── metabase/
│   ├── cards/*.sql              # native SQL cards with YAML front matter
│   └── dashboards/*.yml         # native dashboard layouts + cross-filter wiring
├── proxy/                       # Hono proxy: runs on Node locally, Cloudflare Worker in cloud
├── deploy/
│   ├── sql/roles.sql            # the three DB roles (local + Supabase)
│   ├── coolify/                 # Metabase + app DB compose for the VPS
│   └── wrangler.toml            # Worker + Pages config
├── web/                         # Vite + React + TS (chart library: see D9)
│   ├── src/design/tokens.ts
│   ├── src/charts/              # reusable chart components
│   └── src/pages/
├── docs/
│   ├── method.md                # the method write-up
│   ├── swap_runbook.md
│   ├── what_broke.md
│   └── decision_memo.md
└── .github/workflows/
```

---

## 4. Stages

### Stage 0: Scaffold, tooling, CI skeleton

**Goal:** an empty but runnable repo where every later stage plugs into `make` and CI.

**Deliverables**
- Repo structure above, `Makefile` with targets: `up`, `down`, `generate`, `compile-maps`, `transform`, `test`, `metabase-bootstrap`, `golden`, `conformance`, `web`, `snapshot`, `demo` (everything end to end).
- `docker-compose.yml`: `postgres-data`, `postgres-metabase`, `metabase` (pinned tag). A `prod` profile that reads credentials from the host environment only.
- Python 3.12 managed by `uv`. Node 24 LTS with `pnpm` (changed from Node 22 on 2026-11-23: 24 is the active LTS line; see JOURNAL.md).
- Pre-commit hooks: `ruff`, `ruff format`, `sqlfluff` (postgres dialect, jinja templater with dbt built-ins: changed from the dbt templater on 2026-11-23 because it needs a live database just to lint; see JOURNAL.md), `prettier`, `eslint`, `gitleaks`.
- `CLAUDE.md` with the agent rules (Section 13).

**Acceptance criteria**
- `make up` starts all containers. Metabase reaches healthy state.
- `pre-commit run --all-files` passes.

**CI additions:** `ci.yml` with a `lint` job (pre-commit) and a `secrets` job (gitleaks).

---

### Stage 1: Schema contract

**Goal:** one versioned file that defines the canonical model. It's the only thing both synthetic and production data must satisfy.

**Deliverables:** `contract/schema_contract.yml`. For each table: grain, primary key, columns (name, type, nullable, description, allowed values where relevant), foreign keys. Plus the generated `data_dictionary.md`.

**Canonical staging tables**

CRM (source-agnostic, produced by the mapping compiler)
- `stg_crm__accounts`: account_id, name, domain, industry, country, segment, owner_id, created_at, billing_customer_ref (nullable)
- `stg_crm__contacts`: contact_id, account_id, email, title, created_at
- `stg_crm__leads`: lead_id, contact_id, account_id (nullable), lead_source, created_at, converted_at (nullable)
- `stg_crm__opportunities`: opportunity_id, account_id, owner_id, amount_usd, created_at, close_date, stage, is_closed, is_won, lead_source
- `stg_crm__opportunity_stage_history`: opportunity_id, stage, entered_at (empty table + `supported=false` flag allowed)
- `stg_crm__users`: user_id, name, team, active

Billing (Stripe-shaped source, hand-written staging)
- `stg_billing__customers`, `stg_billing__subscriptions` (platform fee), `stg_billing__invoices`, `stg_billing__invoice_lines` (platform fee, usage true-up)

Ledger (the payments platform's own DB)
- `stg_ledger__merchants`: merchant_id, billing_customer_id (nullable), legal_name, domain, live_at
- `stg_ledger__transactions`: transaction_id, merchant_id, created_at, status (`succeeded|failed|reversed`), rail, source_currency, dest_currency, corridor, amount_minor, currency, failure_reason
- `stg_ledger__disputes`: dispute_id, transaction_id, opened_at, resolved_at, outcome, amount_minor, currency

Rates
- `stg_rates__fx_rates`: rate_date, base_currency, quote_currency, rate, source
- `stg_rates__pricing_rates`: account_ref, fee_bps, fx_margin_bps, platform_fee_usd, min_commit_usd, effective_from, effective_to

**Acceptance criteria**
- The contract validates against a JSON Schema (`make contract-check`).
- `data_dictionary.md` is generated from the YAML, not hand-written.
- Version `1.0.0` in `CHANGELOG.md`.

**CI additions:** `contract-check` job. It fails if the contract changes without a version bump and a changelog entry, or if `data_dictionary.md` is stale.

---

### Stage 2: CRM mapping layer (the hub)

**Goal:** swapping CRMs means editing one readable YAML file, not touching SQL downstream.

**Map file format** (`mappings/crm/hubspot.yml`)

```yaml
crm: hubspot
contract_version: 1.0.0
source_schema: crm_hubspot
timezone: UTC
amount_currency: USD

opportunities:
  source: deals
  columns:
    opportunity_id: hs_object_id
    account_id:     associated_company_id
    owner_id:       hubspot_owner_id
    amount_usd:     amount
    created_at:     createdate
    close_date:     closedate
    stage:          dealstage
    lead_source:    lead_source
  values:
    stage:
      appointmentscheduled:  discovery
      qualifiedtobuy:        qualified
      presentationscheduled: proposal
      contractsent:          negotiation
      closedwon:             won
      closedlost:            lost
    lead_source:
      PAID_SEARCH: paid
      ORGANIC_SEARCH: inbound
      REFERRALS: partner
      OFFLINE: outbound
  derived:
    is_closed: "stage in ('won','lost')"
    is_won:    "stage = 'won'"

stage_history:
  source: deal_property_history
  supported: true
  filter: "property_name = 'dealstage'"
  columns:
    opportunity_id: object_id
    stage:          value
    entered_at:     timestamp
# accounts, contacts, leads, users follow the same pattern
```

**Deliverables**
- `scripts/compile_mappings.py`: reads a map, validates it against the contract, and writes `dbt/models/staging/crm/stg_crm__*.sql` (generated files carry a "DO NOT EDIT" header). Handles: column renames, casts to contract types, timezone conversion to UTC, value maps, derived columns, `supported: false` (emits an empty typed table).
- An `int_crm__unmapped_values` model listing any source value with no mapping.
- `mappings/README.md`: how to write a new CRM map, in plain language.
- `hubspot.yml` now. `salesforce.yml` in Stage 8.

**Acceptance criteria**
- The compiler rejects a map that misses a required contract column or uses an unknown canonical value.
- Compiling twice produces identical output.
- Selecting the CRM is one variable: `CRM=hubspot make transform`.

**CI additions:** unit tests for the compiler (pytest, fixture maps). A `compiled-up-to-date` check that fails if the committed generated SQL differs from a fresh compile.

---

### Stage 3: Synthetic data generator

**Goal:** seeded, reproducible data that looks like what the upstream pipelines actually land, with planted stories and a known answer key.

**The fictional company:** a B2B cross-border payments API. Revenue = monthly platform fee + usage fee (bps on volume) + FX margin (bps) + minimum-commit true-up.

**Deliverables**
- `generator/` writes into raw schemas: `crm_hubspot` (HubSpot-shaped), `billing` (Stripe-shaped: minor units, Unix timestamps), `ledger`, `rates`.
- `config.yml`: `seed`, `as_of: 2026-10-31`, `months: 24`, `scale` (1.0 = full, 0.1 = CI).
- Scale at 1.0: about 4,000 leads, 1,200 opportunities, 350 won accounts, about 500k transactions. At 0.1: about 50k transactions.
- Realism rules:
  - Deal size: log-normal. Win rate varies by source and rep. Deals cluster at month-end and quarter-end. Close dates slip. Some deals skip stages, move backwards, or reopen.
  - Onboarding: delay from won to live varies (some fast, some 90+ days, a few never go live).
  - Usage: S-curve ramp after go-live. Power-law volume (top 10% of accounts carry about 70% of volume). Weekly and payday patterns, December peak.
  - Churn: hazard highest in the first 90 days. Two kinds: contract churn and silent churn (no successful transactions for 60 days).
  - Expansion and contraction via volume changes and renegotiated pricing (new `pricing_rates` row with new effective dates).
  - Failures by rail and corridor. Disputes and returns arrive 30–90 days after the transaction.
  - FX rates: a smooth synthetic series per pair with realistic volatility, including at least one devaluation step on an NGN pair.
- Identity: CRM accounts carry `stripe_customer_id` for about 85% of won accounts. The rest must be matched by domain. Include name variants ("Acme Ltd" vs "ACME Limited").
- Dirty rows (each type counted in the answer key):
  - currency written as `NGN` / `ngn` / `₦`
  - duplicate contacts with mixed-case emails
  - test and internal accounts (`test`, `@ourcompany.com`)
  - close date earlier than created date
  - null lead sources
  - timestamps without a timezone in one source
  - a few orphaned transactions (merchant not in billing)
- **Planted stories**, each with a parameter in `config.yml` and an entry in the answer key:
  1. Corridor failure spike in one month (one corridor, one rail)
  2. Partner-sourced leads: lower win rate, but highest 12-month net revenue per account
  3. A cohort with poor retention after a pricing change
  4. A rep with high pipeline but repeated slipped close dates
  5. Revenue concentration: one customer at about 30% of volume
  6. Slow activation (over 45 days to first live transaction) predicts churn
- `answer_key.json`: expected values for every golden metric (Stage 5), computed from the generator's internal truth **after** excluding the rows that correct cleaning should exclude. This also tests the cleaning logic.

**Acceptance criteria**
- Same seed → byte-identical output (checked by hash).
- Invariant tests pass: no transactions before an account goes live; no revenue after contract churn; every planted story is detectable in raw data.
- A full-scale run finishes in under 5 minutes on a laptop.

**CI additions:** `generator-unit` job (pytest invariants, determinism hash at scale 0.1).

---

### Stage 4: Transformations (dbt)

**Goal:** all business logic in tested SQL.

**Deliverables**
- Staging: CRM (generated, Stage 2), billing, ledger, rates (hand-written). All amounts to major units, all timestamps to UTC, currencies normalized.
- Intermediate:
  - `int_identity_map`: crm_account_id ↔ billing_customer_id ↔ merchant_id, with `match_method` (`explicit_id|domain|unmatched`)
  - `int_opportunity_stage_transitions`: entered/exited per stage, time in stage
  - `int_transactions_enriched`: USD amount at transaction-date FX rate; fee and FX margin from the pricing rate effective on that date
  - `int_account_lifecycle`: won date, live date, activation days, churn date and type
- Marts:
  - `dim_accounts` (one unified account: source, segment, owner, lifecycle, health status)
  - `dim_reps`, `dim_date`
  - `fct_leads_funnel`, `fct_opportunities`, `fct_stage_transitions`
  - `fct_account_daily` (account × day × corridor: volume, count, failures, revenue)
  - `fct_revenue_monthly` (account × month: platform fee, usage fee, FX margin, true-up, net revenue USD)
  - `fct_revenue_bridge` (month × new / expansion / contraction / churn / reactivation)
  - `fct_cohort_retention` (cohort quarter × months since live: NRR, GRR, logo retention)
  - `fct_account_health_monthly` (failure rate, dispute rate, volume trend, health score, revenue at risk)
- Tests: unique and not-null on every primary key; relationships on every foreign key; accepted values on every enum; custom tests for grain, sanity ranges, and identity match rate ≥ 95%.
- `dbt docs generate` for the lineage screenshot.

**Acceptance criteria:** `make transform` (dbt build) passes with zero test failures on the synthetic data.

**CI additions:** `integration` job: Postgres service container → generate (scale 0.1) → compile maps → `dbt build`. Upload `dbt docs` as an artifact.

---

### Stage 5: Metric dictionary and golden numbers

**Goal:** one written definition per metric, and automated proof that the numbers are right.

**`metrics/metrics.yml` entry format**

```yaml
- name: net_revenue_retention
  label: Net revenue retention (NRR)
  definition: >
    Net revenue in month M from accounts live 12 months earlier,
    divided by those same accounts' net revenue in month M-12.
  grain: month
  unit: ratio
  mart: fct_cohort_retention
  column: nrr
  owner: RevOps
  edge_cases:
    - Reactivated accounts count toward the numerator.
    - Test and internal accounts are excluded.
  golden:
    month: 2026-09
    expected: from_answer_key
    tolerance: 0.001
```

**First batch of metrics:** pipeline created, lead → opportunity conversion, win rate, sales cycle days, sales velocity, total payment volume, net revenue, take rate, platform MRR, NRR, GRR, logo churn (contract and silent), activation days, failure rate, dispute/return rate, top-10 revenue concentration, revenue at risk, 12-month net revenue by lead source.

**Deliverables**
- `metrics.yml` with the batch above.
- `scripts/golden_check.py`, stage 1 of 2: compare `answer_key.json` with mart values. (Stage 6 adds Metabase as the third source.)

**Acceptance criteria:** every golden metric matches within tolerance. A mismatch prints the metric, expected, actual, and the mart query used.

**CI additions:** `golden` step in the integration job.

---

### Stage 6: Metabase layer

**Goal:** Metabase as the governed BI layer, fully rebuilt from the repo.

**Deliverables**
- `scripts/metabase_bootstrap.py` (idempotent, safe to rerun):
  1. First-run setup using the setup token **[verify: current setup API flow for the pinned version]**
  2. Add the data DB connection as `bi_reader`, pointed at the marts schema only
  3. Create collections, an API key in a view-only group for the proxy
  4. Upsert every card in `metabase/cards/*.sql` by name
  5. Create models on key marts and simple metrics/measures (volume, net revenue, deals won)
  6. Build native dashboards from `metabase/dashboards/*.yml`, including cross-filter click behaviour
- **Card format** (`metabase/cards/revenue_bridge.sql`):

```sql
-- name: Revenue bridge by month
-- collection: Revenue
-- display: waterfall
-- params: [date_from, date_to, segment, lead_source]
select month, category, amount_usd
from analytics.fct_revenue_bridge
where 1=1
  [[ and month >= {{date_from}} ]]
  [[ and month <= {{date_to}} ]]
  [[ and segment = {{segment}} ]]
  [[ and lead_source = {{lead_source}} ]]
```

- **Parameter contract** shared by all cards: `date_from`, `date_to`, `segment`, `lead_source`, `owner_id`, `corridor`, `account_id`. Every card takes a subset of these, with the same names and types.
- `golden_check.py`, stage 2 of 2: run each golden card through the API and compare it with the marts and the answer key (three-way agreement).
- **Optional, 30 minutes max:** an SDK spike. Record what the paid gates do in API-key evaluation mode on open source (code theming, drill-through, cross-filter). This goes in `docs/method.md` only. It does not change D1.

**Acceptance criteria**
- Starting from an empty Metabase app DB, `make metabase-bootstrap` builds everything in under 3 minutes.
- Three-way golden check passes.
- Cross-filtering works on the native dashboards (take screenshots).

**CI additions:** `metabase` job: start the pinned Metabase container with its app DB, wait for health, run bootstrap, run the three-way golden check. Allow about 3 minutes for Metabase startup.

---

### Stage 7: Proxy and React front end

**Goal:** a polished, consistent front end that only talks to Metabase.

**Deliverables**
- `proxy/`: a small Hono server. It holds the Metabase API key from the environment, exposes `POST /api/cards/:name` with parameters, maps card names to IDs, and allows only listed cards and parameters. The browser never sees the key.
- `web/`:
  - `design/tokens.ts`: colors (colorblind-safe chart palette, max 8 series), type scale, spacing, radii. Tailwind reads from these tokens.
  - **Chart library decision (owner, at the start of this stage).** Judge each candidate on: (1) can it draw funnel, waterfall, cohort heatmap and Sankey, natively or with little custom work; (2) can it read colors, fonts and spacing from `design/tokens.ts`; (3) does it support React 19 and TypeScript; (4) does it look distinct out of the box rather than like a stock template; (5) bundle size and maintenance activity. Record the choice and reasons here. Fallback: Apache ECharts.
  - Chart components built on the chosen library, behind our own wrapper API so the library can be swapped: `KpiTile`, `TrendLine`, `Funnel`, `Waterfall`, `CohortHeatmap`, `Sankey`, `BarBreakdown`, `DataTable`. Each one has loading, empty and error states.
  - Formatting helpers: currency (`$1.2M`, `₦`), percentages, basis points, durations.
  - Filter state in the URL (shareable links). A global filter bar drives all cards on a page.
  - Pages:
    1. **Pipeline & funnel:** lead → opp → won funnel, stage conversion and time in stage, velocity breakdown, win rate by source, rep filter
    2. **Revenue & retention:** net revenue trend, revenue bridge, cohort NRR/GRR heatmap, activation days vs retention, 12-month revenue by lead source
    3. **Account health & risk:** at-risk accounts, failure rate by corridor and rail, disputes/returns, revenue at risk, concentration
    4. **Account 360:** one account's timeline from lead to opportunity, onboarding, volume, pricing changes and risk. Every account name elsewhere links here.
  - **Chart titles state the insight**, e.g. "Partner-sourced accounts earn 2× net revenue per account in their first 12 months".
  - **Snapshot mode** (`VITE_MODE=snapshot`): reads static JSON instead of calling the proxy. Supports a fixed set of filter presets; other filter combinations are disabled with a note.
- `scripts/metabase_export_snapshot.py`: runs every card for every preset and writes `web/public/snapshot/*.json`.

**Acceptance criteria**
- All four pages render in live mode and snapshot mode with no console errors.
- Every planted story is visible on at least one page.
- Lighthouse accessibility score ≥ 90 on each page.

**CI additions**
- `web` job: typecheck, lint, unit tests (Vitest) for formatters and the parameter builder, production build.
- `e2e` job: Playwright against snapshot mode. Visit each page, assert no console errors, assert key charts render, upload screenshots as artifacts.

---

### Stage 8: Conformance suite and swap rehearsal

**Goal:** prove the swap works, and record honestly what broke.

**Deliverables**
- `scripts/conformance/`: a CLI that takes a target profile (`synthetic` or `prod`) and runs:
  - schema match against the contract (tables, columns, types)
  - null rates per column vs contract nullability
  - primary key uniqueness and grain checks
  - referential integrity (orphan rate per foreign key)
  - unmapped CRM values (from `int_crm__unmapped_values`)
  - identity match rate
  - sanity ranges (negative amounts, future dates, close before create)
  - freshness (max timestamp per source)
  - distribution drift vs the synthetic profile (row counts, quantiles)
  - reconciliation against an external control total (for example, finance-reported net revenue for a closed month, supplied by a human)
- **Output rule:** a JSON report of pass/fail plus counts and rates only. No row values, no sample records, ever. The CLI enforces this.
- `mappings/crm/salesforce.yml` and a **Salesforce-shaped raw variant** from the generator (`Opportunity.StageName`, `CloseDate`, `Amount`, `OpportunityFieldHistory`), with messier distributions and some extra dirty-row types the HubSpot run didn't have.
- `docs/swap_runbook.md`: the human-only steps for a real swap (see Section 6).
- `docs/what_broke.md`: a log of every failure found during the Salesforce rehearsal, how it was detected, and the fix (map change vs generator change vs model change).

**Acceptance criteria**
- `CRM=salesforce make demo` passes all tests, golden checks and conformance with **no changes** outside `mappings/` and the generator.
- Any fix that needed a change outside `mappings/` is logged in `what_broke.md` with the reason.

**CI additions:** turn the integration, Metabase and golden jobs into a **matrix over `crm: [hubspot, salesforce]`**. CI then proves on every push that the swap works for both adapters.

---

### Stage 9: Packaging and release

**Goal:** something a hiring manager can see in 3 minutes, and an engineer can run in one command.

**Deliverables**
- `README.md`, in this order: one-paragraph TL;DR → a planted-story insight with a screenshot → link to the live snapshot → the method in one diagram → architecture → swap runbook and "what broke" → how to run (`make demo`) → limitations.
- `docs/method.md`: the synthetic-first method as a standalone write-up. Include the enforced AI boundary, the conformance rules, the SDK findings, and the honest caveat: synthetic data does not guarantee production behaviour.
- `docs/decision_memo.md`: one page, "3 things the CRO should do", based on the planted stories.
- Screenshots: React pages, native Metabase dashboards with cross-filtering, the metric dictionary, the dbt lineage graph.
- A walkthrough video of 3 minutes or less.

**Acceptance criteria**
- On a clean machine: `git clone` → `cp .env.example .env` → `make demo` → working dashboards.
- The snapshot is live on Cloudflare Pages.

**CI/CD additions:** `deploy.yml` (see Section 5).

---

### Stage 11: Extract the reusable skill

**Goal:** next time, you state an objective ("a delivery logistics dashboard") and the same method runs again with a fraction of the effort.

**When:** after Gate 9. It can run before or after Stage 10. It relies on the `#skill` notes collected in `JOURNAL.md` during every stage, so the raw material is captured while it's fresh, not reconstructed at the end.

**Deliverables** in `skill/`:
- `SKILL.md`: the method as instructions. An intake step (questions to turn an objective into a domain brief: the business, revenue loop, sources, pages, metrics, planted stories), then the stages, gates, loop rules and agent rules, written domain-free.
- `templates/`: schema contract, CRM/source map, metrics dictionary, generator config with planted stories, card file, dashboard layout, `CLAUDE.md`, `Makefile`, CI workflows, `JOURNAL.md`.
- `generic_vs_specific.md`: for each part of this project, what is reusable as is, what is a template to fill in, and what is fintech-specific. Built from the journal's `#skill` entries.
- `examples/fintech-b2b/`: this project's filled-in brief, as the reference example.

**Acceptance criteria**
- **Dry run on a different domain:** start a delivery logistics project from `SKILL.md` alone and reach Gate 3 (contract, maps, generator with planted stories) without needing this repo's history. Record every gap it exposes and fix the skill.
- Every fintech-specific choice in the templates is either removed or marked as an example.

**CI additions:** none required. Optionally, a check that the templates still render and the template `Makefile` runs `gate-0` on an empty scaffold.

---

### Stage 10: Cloud deployment (later)

**Goal:** the same project, live in the cloud, with configuration changes only.

**Deliverables**
- Supabase project: run `deploy/sql/roles.sql`, create the schemas, load synthetic data and `dbt build` from a GitHub Actions job (`cloud-data.yml`, manual trigger plus on release).
- VPS: Coolify deploys `deploy/coolify/` (pinned Metabase + its own Postgres app DB), HTTPS through Coolify's proxy, a strong admin password, and app DB backups switched on. Run `metabase_bootstrap.py` against it.
- Cloudflare Worker: the proxy, with the Metabase API key stored as a Worker secret, CORS limited to the Pages domain, an allowlist of cards and parameters, and rate limiting.
- Cloudflare Pages: the front end in live mode (via the Worker), with snapshot mode kept as a fallback if Metabase is down.
- `docs/cloud_runbook.md`: how to redeploy each layer, rotate keys, and restore the Metabase app DB.

**Acceptance criteria**
- Moving to cloud needed no code changes outside `deploy/`, env files and CI workflows. Anything else is logged with a reason.
- Three-way golden check passes against the cloud stack.
- The public URL shows all 4 pages in live mode. The Metabase API key never appears in browser network traffic or the JS bundle.

**CI/CD additions:** `cloud-data.yml` (load + transform on Supabase), Worker deploy in `deploy.yml`, and a post-deploy smoke test (Playwright against the public URL).

---

## 4A. Stage gates (how a stage is passed)

A stage's **acceptance criteria are its gate**. Gates are automated wherever possible, and **cumulative**: passing gate N means gates 0 to N all pass on the same commit. Later work must never break an earlier gate.

### Gate commands

Each gate is one Makefile target: `make gate-N`. It runs that stage's checks plus `make gate-(N-1)`. `make gates` runs all of them.

| Gate | Stage | Automated checks | Human sign-off |
|---|---|---|---|
| G0 | Scaffold | containers healthy; pre-commit passes; gitleaks clean | none |
| G1 | Schema contract | contract validates; version + changelog present; dictionary regenerated and unchanged | owner reviews the canonical tables once |
| G2 | Mapping layer | compiler unit tests; a broken map is rejected (negative tests); compiled SQL up to date; compile is idempotent | owner reads `hubspot.yml` and confirms it's understandable |
| G3 | Generator | invariant tests; determinism hash matches; each planted story detectable in raw data; full run under 5 minutes | owner looks at 5 quick profile charts (deal sizes, volume curve, churn timing, failures by corridor, revenue trend) and confirms it looks real |
| G4 | Transformations | `dbt build` with zero test failures; identity match rate ≥ 95% | none |
| G5 | Golden numbers | every metric in `metrics.yml` matches the answer key within tolerance | none |
| G6 | Metabase | bootstrap from an empty app DB in under 3 minutes; bootstrap rerun changes nothing; three-way golden check passes | owner confirms cross-filtering on native dashboards (screenshot saved to `docs/evidence/`) |
| G7 | Front end | typecheck, lint, Vitest, build; Playwright on all 4 pages with zero console errors; Lighthouse accessibility ≥ 90 | owner confirms design quality and that every planted story is visible |
| G8 | Swap rehearsal | full CI matrix green for `hubspot` and `salesforce`; conformance report passes with aggregate-only output; `what_broke.md` has entries; no diffs outside `mappings/` and the generator except those logged | owner reads `what_broke.md` |
| G9 | Release | fresh-clone `make demo` succeeds on a clean CI runner; deploy succeeded; Definition of Done (Section 11) all ticked | owner watches the video and reads the README |
| G11 | Skill | `skill/` complete; dry run on a logistics domain reaches its Gate 3 from `SKILL.md` alone; gaps logged and fixed | owner reads `SKILL.md` and the dry-run notes |
| G10 | Cloud (later) | cloud data load + `dbt build` green on Supabase; bootstrap on the VPS; three-way golden check against cloud; post-deploy Playwright smoke test on the public URL; API key absent from the bundle and network traffic | owner checks the live site and the cloud runbook |

### The loop (what happens when a gate fails)

```
build → run gate → pass? ── yes ──▶ record pass → open PR → CI gate green → merge → tag gate-N → next stage
                     │
                     no
                     ▼
        read failure → find root cause → fix the code → rerun the SAME gate (full, not just the failing test)
                     │
     same failure 3 times with no progress?  ── yes ──▶ STOP: write docs/gates/blocked-gate-N.md
                     │                                    (what failed, what was tried, best guess) and ask the owner
                     no ──▶ loop
```

### Rules that keep the gates honest

1. **Fix the code, not the check.** Changing a test, the answer key, a tolerance, the schema contract, or a gate threshold to make a gate pass needs the owner's explicit approval, and gets logged in `docs/gates/log.md` with the reason.
2. **No skipping.** No `skip`, `xfail`, `|| true`, `continue-on-error`, or commented-out checks.
3. **Flaky means broken.** Data is deterministic, so a test that passes sometimes is a bug to fix, not to rerun until green.
4. **Rerun the whole gate after every fix**, because a fix can break something an earlier check covered.
5. **Human sign-offs are real stops.** The agent prepares the evidence (screenshots, profile charts, report) and waits.

### Journal check

A gate is not passed until `JOURNAL.md` has an entry for it (Section 14), including any failures and loops along the way.

### Recording passes

- One branch per stage (`stage-3-generator`). Merge to `main` only through a PR whose CI gate is green. Branch protection enforces it.
- After merge, tag the commit `gate-N` (for example `gate-3`). The tags show exactly where each stage was proven.
- `docs/gates/log.md`: one line per pass: gate, date, commit, and any approved exceptions.

---

## 5. CI/CD design (GitHub Actions)

**The CI jobs are the gates.** They're chained with `needs`, in gate order, so a failure at one gate stops everything after it. A PR for stage N must pass the jobs for gates 0 to N. Jobs for later stages are added as each stage starts.

CI grows with each stage (see each stage's "CI additions"). Final state:

### `ci.yml`: runs on every pull request and every push to `main`

| Job | Needs | What it does |
|---|---|---|
| `lint` | none | pre-commit: ruff, sqlfluff, prettier, eslint |
| `secrets` | none | gitleaks scan |
| `contract-check` | none | contract schema valid, version bumped on change, dictionary regenerated |
| `unit` | lint | pytest (generator invariants, mapping compiler, conformance output rule), Vitest (web) |
| `compiled-up-to-date` | unit | fresh compile of maps equals committed staging SQL |
| `integration` (matrix: hubspot, salesforce) | unit | Postgres service → generate scale 0.1 → compile maps → `dbt build` → golden (answer key vs marts) → conformance (synthetic profile) |
| `metabase` (matrix: hubspot, salesforce) | integration | pinned Metabase + app DB → bootstrap → three-way golden check → export snapshot (artifact) |
| `web` | unit | typecheck, build |
| `e2e` | metabase, web | Playwright on snapshot mode; screenshots as artifacts |

Notes
- Cache `uv`, `pnpm` and the Metabase image to keep runs fast.
- Determinism means CI results are stable. Any flaky test is a bug, not noise.
- Branch protection on `main`: all jobs must pass.

### `deploy.yml`: runs on push to `main` after CI passes
- Build the snapshot (full-scale data, HubSpot adapter), build `web` in snapshot mode, deploy to Cloudflare Pages with `wrangler`.
- Secrets needed in GitHub: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`. Nothing else.

### What CI never does (D12)
- CI never holds production credentials and never connects to production.
- Production conformance runs only on a human's machine, with the `prod` profile and credentials from the host environment.

---

## 6. Swap runbook (human-only, summary)

Full version in `docs/swap_runbook.md`.

1. Revoke any Metabase API key or session the coding agent used.
2. Create the three database roles in production (`transformer`, `bi_reader`, `conformance`).
3. If the CRM differs, write `mappings/crm/<crm>.yml` using **synthetic data only**, then check it in CI.
4. Locally, with the `prod` profile: compile maps → `dbt build` → run conformance. Read only the aggregate report.
5. Fix failures by changing maps or models. Reproduce any new data problem in the generator first, so the AI can help using synthetic data.
6. In Metabase, **edit the existing database connection details** (do not delete and re-add it). Then sync the schema and re-scan field values **[verify: filter dropdown values refresh after re-scan]**.
7. Run the reconciliation check against finance's control total.
8. Spot-check dashboards (human).

---

## 7. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Metabase API or setup flow changes between versions | Pinned image tag. Bootstrap tested in CI on every push |
| Generated data looks fake | Realism rules + planted stories in Stage 3; review charts before Stage 7 is done |
| Scope creep | Cut order in Section 9 |
| Snapshot mode can't support every filter combination | Fixed presets, other combinations clearly disabled |
| Metabase startup slows CI | Cache the image, run Metabase jobs only after integration passes |
| Privacy claim challenged | D12 enforced; stated precisely in `method.md` ("no credentials or network path to production; only aggregate metadata comes back") |

---

## 8. Order of work and parallelism

```
Stage 0 → 1 → 2 → 3 → 4 → 5 → 6 ─┬─ 7 ─┐
                                   └─ 8 ─┴─ 9 ─┬─ 11 (skill)
                                               └─ 10 (cloud, later)
```

- Stages 2 and 3 can overlap once the contract (Stage 1) is fixed.
- Stage 7 (front end) and Stage 8 (Salesforce swap) can run in parallel after Stage 6.

---

## 9. Cut order if time runs short

Cut from the top. Never cut golden numbers or planted stories.

1. Cloudflare deploy (keep snapshot build locally)
2. Salesforce-shaped variant → replace with a messier HubSpot variant
3. Account 360 page → turn into a simple account table
4. Lighthouse and Playwright screenshot jobs

---

## 10. Out of scope (parked)

- The Stripe → Postgres pipeline (upstream project)
- The remittance and fraud-monitoring dashboard (second project)
- Cube or dbt MetricFlow (named as the upgrade path in `method.md`)
- An n8n workflow that turns "newly at-risk accounts" into Slack alerts or CRM tasks (good follow-up for the GTM engineering angle)
- Profile-driven generator calibration from production aggregates (describe as a design in `method.md`)

---

## 11. Definition of done (whole project)

- [ ] `make demo` works from a clean clone
- [ ] CI green on both CRM adapters
- [ ] Three-way golden check passes for every metric in the dictionary
- [ ] Every planted story visible in the React app and written up in the decision memo
- [ ] `what_broke.md` has real entries from the Salesforce rehearsal
- [ ] Snapshot live on Cloudflare Pages
- [ ] README, method write-up and video done

---

## 12. References (checked 2026-11-23)

- SDK introduction (Pro/Enterprise only; React 18/19; version matching): https://www.metabase.com/docs/latest/embedding/sdk/introduction
- SDK quickstart (API key, localhost, works with open source for evaluation): https://metabase.com/docs/master/embedding/sdk/quickstart
- SDK authentication (API keys for local development and evaluation only): https://www.metabase.com/docs/latest/embedding/sdk/authentication
- SDK appearance (presets on all plans; theme options in code are Pro/Enterprise): https://www.metabase.com/docs/latest/embedding/sdk/appearance
- What is free in embedding (drill-through, custom colors/fonts are paid): https://www.metabase.com/articles/is-metabase-embedding-free
- Guest embeds (free, no drill-through, light/dark only): https://www.metabase.com/docs/latest/embedding/guest-embedding
- Compare plans (serialization and remote sync are paid; API keys and models on all plans): https://www.metabase.com/pricing/compare-plans
- Cross-filtering on dashboards: https://www.metabase.com/docs/latest/dashboards/interactive
- Metrics (query builder only): https://www.metabase.com/docs/latest/data-modeling/semantic-layer/metrics
- Editing a connection for dev → prod migration: https://www.metabase.com/docs/latest/databases/danger-zone

---

## 13. Rules for the coding agent (copy into `CLAUDE.md`)

1. Work one stage at a time, in order. Don't start a stage until the previous gate passes locally and in CI (Section 4A). If a gate fails, loop: find the root cause, fix the code, rerun the full gate. After the same failure 3 times with no progress, stop, write `docs/gates/blocked-gate-N.md`, and ask the owner.
1a. Never weaken a check to pass a gate: no editing tests, answer key, tolerances, contract or thresholds without the owner's approval (logged in `docs/gates/log.md`), and no skips, `xfail`, `|| true` or `continue-on-error`.
1b. At a gate with a human sign-off, prepare the evidence and stop until the owner approves.
2. Never read, create, or reference production credentials, `.env.prod`, or the `prod` compose profile. Never connect to any database except the local synthetic one.
3. Never hand-edit generated files (`dbt/models/staging/crm/*`, `contract/data_dictionary.md`). Change the source (map, contract) and regenerate.
4. Every metric is computed in a mart. No business logic in React, the proxy, or Metabase GUI questions beyond simple additive metrics.
5. Every new card uses the shared parameter contract (Stage 6).
6. Any change to the schema contract needs a version bump and a changelog entry.
7. Keep the data deterministic: fixed seed, fixed as-of date, never `now()`.
8. Conformance output is aggregates only. Never print row values or sample records.
9. When something new breaks, reproduce it in the generator before fixing it, and log it in `docs/what_broke.md` if it came from the swap rehearsal.
10. Use design tokens for every color, font size and spacing value. No hard-coded styles.
11. Follow the cloud-ready rules in Section 2A from the first commit: config from env only, no data in the `public` schema, roles via `deploy/sql/roles.sql`, and a proxy that runs on both Node and Cloudflare Workers.
12. Keep `JOURNAL.md` as you go (Section 14). Write an entry at every gate pass, every blocked gate, every approved exception, every owner decision, and every surprise. Be honest: failures and dead ends are the most valuable entries. Never edit or delete past entries; add a correction entry instead.
13. Tag reusable lessons `#skill`, and for each stage note what was generic vs domain-specific. Stage 11 is built from these.

---

## 14. Build journal (`JOURNAL.md`)

**Purpose:** one running record that can feed a technical article, LinkedIn and X posts, a case study, a book chapter, and video. It captures context, not just code: decisions, pushback, rejected options, what broke, and numbers.

**Who writes it:** the coding agent writes entries as it works (rule 12). The owner adds "Owner notes" in their own words whenever something is worth saying. Short and raw is fine.

**When to write an entry:** every gate pass; every blocked gate or loop of 2+ attempts; every owner decision or approved exception; every time reality differed from the plan; every interesting number (runtime, row counts, match rates, CI time).

**Entry template**

```markdown
## YYYY-MM-DD · Stage N · <short title>
**Type:** decision | gate-pass | blocked | problem-fix | surprise | pushback | milestone
**What happened:** 2–4 sentences, plain language.
**Why it matters:** the business or method point, for a non-technical reader.
**Options considered / pushback:** what else was on the table and why it lost.
**Problem → fix (if any):** symptom, root cause, fix, how it was caught (which gate/check).
**Numbers:** anything measurable.
**Quotable line:** one sentence that could open a post.
**Evidence:** screenshot, commit, PR, report path.
**Tags:** #linkedin #x #article #case-study #video #book #skill
```

**Sections at the bottom of `JOURNAL.md`** (updated at each gate):
- **Content bank:** post ideas with the entries they draw from.
- **Running "what I'd tell someone starting this":** lessons so far.
- **Metrics of the build:** stages done, loops per gate, CI duration, time per stage.
