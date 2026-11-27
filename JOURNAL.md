# Build Journal: Synthetic-First Dashboard Project

A running record of decisions, pushback, problems and lessons, written so it can become a technical article, LinkedIn and X posts, a case study, a book chapter, or a video.

Rules: add entries, never rewrite old ones. Honest beats polished. Template and rules are in `PLAN.md`, Section 14.

---

## 2026-11-23 · Planning · The idea: let AI build dashboards without ever touching real data
**Type:** milestone
**What happened:** Set the core idea for the project. AI builds the whole dashboard stack against a schema contract and synthetic data only. A human swaps in real credentials at the end, after automated conformance checks that return only aggregate pass/fail results.
**Why it matters:** Teams want the speed of AI-built dashboards but can't let an AI near customer or payment data. This separates the two: the AI gets speed, the human keeps control of the data.
**Options considered / pushback:** Building directly on real data with AI (fast, but a privacy problem). Building by hand (safe, slow).
**Quotable line:** "The fastest way to build a dashboard with AI is to make sure the AI never sees your data."
**Tags:** #linkedin #article #case-study #book #skill

## 2026-11-23 · Planning · Asked for a critical review instead of validation
**Type:** pushback
**What happened:** Before building, asked for a critical audit of the plan: "don't just validate it." The review found three main weaknesses: the front-end route depended on a paid feature, the "swap to production" was claimed but never demonstrated, and Metabase content wasn't version-controlled on the free edition.
**Why it matters:** The weaknesses were found in an afternoon of review instead of day three of a build.
**Quotable line:** "I asked the AI to tear my plan apart before I let it build anything."
**Tags:** #linkedin #x #book #skill

## 2026-11-23 · Planning · Dropped the Metabase React SDK as the main route
**Type:** decision
**What happened:** Checked Metabase's current docs. The React SDK is Pro/Enterprise only, API-key authentication is for local evaluation only, and theming in code plus drill-through in embeds are paid features. Switched the main route to a custom React app calling the Metabase REST API through a small proxy.
**Why it matters:** The whole method is about swapping to production. A front end that can't go to production on the free edition breaks that promise. The REST route also gives full design control.
**Options considered / pushback:** SDK in evaluation mode (fine for a demo, dead end for production). Guest embeds (free, but no drill-through and only light/dark themes). Paying for Pro (breaks reproducibility for anyone cloning the repo).
**Quotable line:** "Check what's free in production before you build the demo, not after."
**Tags:** #article #case-study #skill

## 2026-11-23 · Planning · Pushback: Stripe data is already in Postgres
**Type:** pushback
**What happened:** The review suggested modelling raw data as connector-shaped sources. Pushed back on the billing side: any team with a competent data engineer already has a Stripe → Postgres pipeline, so this project starts from those landed tables. The CRM is the genuinely messy part.
**Why it matters:** Kept scope tight. Effort goes where real-world mess actually lives.
**Quotable line:** "Don't rebuild the pipeline your data engineer already owns."
**Tags:** #linkedin #case-study #book

## 2026-11-23 · Planning · The hub principle: one readable map file per CRM
**Type:** decision
**What happened:** The dashboard plugs into one canonical, normalized CRM shape. Each real CRM gets a YAML map file that a person can read and edit: column renames, value mappings (deal stages, lead sources), and flags for things a CRM can't provide (such as stage history). A script compiles the map into staging SQL. Swapping HubSpot for Salesforce means writing a new map file; nothing downstream changes.
**Why it matters:** This is the "hub" or "modular" way of building: the core never changes, only the adapters do. Value mapping (not column renaming) is where CRMs really differ.
**Quotable line:** "Renaming columns is easy. Mapping what 'closed won' means in each CRM is the real work."
**Tags:** #article #case-study #book #skill

## 2026-11-23 · Planning · Rates are first-class tables
**Type:** decision
**What happened:** FX rates and per-customer pricing (basis points, FX margin, platform fee, minimum commit) are their own tables with effective dates.
**Why it matters:** Without effective dates, a renegotiated price silently rewrites last year's revenue. Fintech readers will look for this.
**Quotable line:** "If your pricing table has no effective date, your historical revenue is a guess."
**Tags:** #linkedin #x #article

## 2026-11-23 · Planning · Stage gates with a loop-until-green rule
**Type:** decision
**What happened:** Every stage ends in a gate: automated checks plus, where needed, an owner sign-off. Gates are cumulative. If a gate fails, the agent finds the root cause, fixes the code and reruns the whole gate. Same failure 3 times → stop and ask. Weakening a test to pass needs owner approval.
**Why it matters:** AI builds fast; gates make sure fast doesn't mean broken. "Fix the code, not the check" keeps the AI honest.
**Quotable line:** "An AI that can edit its own tests will eventually pass them. Gates stop that."
**Tags:** #linkedin #x #article #skill

## 2026-11-23 · Planning · Local first, cloud later
**Type:** decision
**What happened:** Build everything locally for speed, but follow cloud-ready rules from the first commit. Later target: Supabase Cloud (data), Metabase on a VPS via Coolify, Cloudflare Pages (front end) and a Cloudflare Worker (proxy). The public cloud version still runs synthetic data; it's the demo, not the production swap.
**Why it matters:** Moving to cloud should be configuration, not a rewrite.
**Tags:** #case-study #skill

## 2026-11-23 · Planning · Chart library left open on purpose
**Type:** decision
**What happened:** Have two preferred chart libraries in mind; ECharts is the fallback. Decision deferred to Stage 7, judged on chart types needed, design-token support, React 19, distinct look, and maintenance. Charts sit behind our own components so the library can be swapped.
**Tags:** #skill

## 2026-11-23 · Planning · Turning the method into a skill
**Type:** decision
**What happened:** Goal beyond this project: next time, state an objective (for example, a delivery logistics dashboard) and the same method runs again. Decided to capture reusable lessons with `#skill` tags during the build and extract the skill at the end (Stage 11), proven by a dry run on a logistics domain.
**Quotable line:** "Build it once properly, then turn the process into the product."
**Tags:** #linkedin #book #skill

## 2026-11-23 · Planning · Naming: SendFast B2B Payments Revenue Dashboard
**Type:** decision
**What happened:** Named the project and the fictional company. "Synthetic-first" was the first idea, but it describes how the project is built, not what the dashboard shows. A stranger reading the repo name should know the business and the purpose at a glance. Settled on "SendFast B2B Payments Revenue Dashboard". SendFast is the fictional cross-border payments API company the synthetic data describes.
**Why it matters:** The name is the first thing a hiring manager or reader sees. It should say what the dashboard is for; the method belongs in the README's first line.
**Options considered / pushback:** `synthetic-first-revenue-dashboard` (method-first, no business context), `b2b-payments-revenue-dashboard` (clear but generic), `payments-lead-to-revenue-dashboard`. The owner chose to add a company name to give the fictional business an identity.
**Quotable line:** "Name the project for what it shows, not how you built it."
**Tags:** #linkedin #case-study #skill

## 2026-11-23 · Stage 0 · Owner decisions before the first line of code
**Type:** decision
**What happened:** Before scaffolding, the agent checked the machine and the GitHub repo against the plan and raised three mismatches. The owner decided all three: pin Node 24 LTS instead of 22 (24 is the active LTS line and is what's installed), make the repo public now so branch protection can enforce the gates on a free GitHub account, and do Stage 0 only in this session.
**Why it matters:** The gate system depends on branch protection. On a free account, a private repo can't enforce it, so "merge only on green CI" would have been a promise, not a rule.
**Options considered / pushback:** Keep the repo private and enforce by convention until Stage 9 (rejected: the gates are the point). Install Node 22 to match the plan (rejected: older LTS line, no benefit).
**Quotable line:** "A rule your tools can't enforce is just a suggestion."
**Tags:** #linkedin #skill

## 2026-11-23 · Stage 0 · Version pins checked against vendors, not memory
**Type:** decision
**What happened:** Resolved the Stage 0 [verify] items from live sources. Supabase Cloud runs Postgres 17 (17.11 builds), so the local data and app DBs pin `postgres:17.11-alpine`. Metabase is pinned to `v0.64.8.3`, the newest patch on the `v0.64-lts` line, not the newest release (`v0.65.6.3`): the 0.65 line shipped three patches in three days, which is the wrong thing to pin an API bootstrap against. Web search results disagreed on the latest Metabase version, so the Docker Hub tag list was used as the source of truth.
**Why it matters:** The bootstrap (Stage 6) talks to Metabase's REST API, which changes between versions. Pinning the LTS line means fewer surprise breaks.
**Plan deviations:** (1) The `prod` compose profile is not defined yet; it has nothing to run until the conformance CLI exists, so it moves to Stage 8. (2) Env templates are `.env.example` (local, matches the README's `cp .env.example .env`) and `.env.cloud.example`, instead of `.env.local.example`. (3) `deploy/sql/roles.sql` waits until there are schemas to grant on (Stage 3/4).
**Quotable line:** "Pin the boring version. Your bootstrap script will thank you."
**Tags:** #skill

## 2026-11-23 · Stage 0 · Gate 0 passed locally after three loops (one was a false pass)
**Type:** problem-fix
**What happened:** Gate 0 took four runs. Run 1 failed: port 5432 was already taken by another project's Postgres on the same machine. Run 2 printed "Gate 0 passed", but that was hollow: `pre-commit run --all-files` only checks files git tracks, and nothing new was staged yet, so prettier, eslint and check-yaml all skipped, and gitleaks only scanned the two old commits. Run 3, with everything staged, failed for real: prettier had reformatted `pnpm-lock.yaml`. Run 4 passed with every hook actually checking files.
**Why it matters:** A green check that checked nothing is worse than a red one, because it looks like proof. The only reason it was caught is that the output was read, not just the exit code.
**Problem → fix:**
- Port clash → the data DB's host port defaults to 55432 (env-driven, so anyone can change it). The other project's container was not touched.
- False pass → stage files before running the gate. A first run on a fresh scaffold has to be checked for "Skipped".
- Prettier on lockfiles → `.prettierignore` covers `pnpm-lock.yaml`, `uv.lock`, `PLAN.md` and `JOURNAL.md`.
- Also: the first run's exit code was 0 even though `make` failed, because the output was piped through `tail`. Reruns use `set -o pipefail`.
- Also: pnpm 11 silently wrote a `pnpm-workspace.yaml` exempting `typescript-eslint@8.74.0` (published that day) from its minimum-release-age rule. Rather than keep a supply-chain exemption, pinned 8.73.0 and deleted the file.
**Numbers:** first `make up` 17 min (image pulls on a slow connection); warm Gate 0 rerun 6 s; Metabase healthy about 2 to 3 min after container start on first boot.
**Quotable line:** "My first green check had checked nothing. Read the output, not the exit code."
**Evidence:** branch `stage-0-scaffold`.
**Tags:** #linkedin #x #skill

## 2026-11-23 · Stage 0 · Gate 0 passed in CI and merged
**Type:** gate-pass
**What happened:** CI failed once before going green: `astral-sh/setup-uv@v10` doesn't exist, because that action publishes only exact tags (`v10.4.0`), not a moving major tag. Fixed after checking every other action reference exists. Then `lint` and `secrets` went green, branch protection was switched on for `main` (PR required, both checks required, applies to admins), PR #1 was merged and tagged `gate-0`.
**Numbers:** CI lint 1m39s cold, secrets 7s.
**Evidence:** PR #1, tag `gate-0`.
**Tags:** #skill

## 2026-11-23 · Stage 1 · Owner decision: a green gate is an approved gate
**Type:** decision
**What happened:** After Gate 0, the owner set the working rule: "If it works, all the tests passes. Let's move on." From now on, when a gate's automated checks pass locally and in CI, the agent merges, tags and starts the next stage without waiting. For gates that also have a human sign-off, the agent saves the evidence and links it so the owner can object afterwards. The agent still stops on a blocked gate, on anything that would weaken a check, and on decisions the plan reserves for the owner (such as the chart library at Stage 7).
**Why it matters:** The gates are now trusted enough to replace a human approval click. That is the point of making them strict.
**Quotable line:** "Once the checks are strict enough, 'green' is the approval."
**Tags:** #linkedin #book #skill

## 2026-11-23 · Stage 1 · The schema contract, and a resolved contradiction in the plan
**Type:** milestone
**What happened:** Wrote `contract/schema_contract.yml`: 15 canonical staging tables (CRM 6, billing 4, ledger 3, rates 2), each with grain, primary key, typed columns, nullability, allowed values or regex patterns, and foreign keys. `scripts/contract_check.py` validates it against a JSON Schema plus cross-reference rules a schema can't express (keys exist, primary keys not nullable, foreign keys point at the target's primary key with matching types), generates `data_dictionary.md`, and fails if the contract's meaning changes without a version bump and a changelog entry. Comment-only edits don't need a bump: the comparison is on the parsed YAML.
**Options considered / pushback:** The plan contradicted itself. Stage 1 lists `amount_minor` on ledger tables, but Stage 4 says staging converts all amounts to major units. Went with Stage 4: the canonical shape is `amount` + `currency`, and minor units live only in the raw schemas. Also added `dispute_type` (dispute vs return), which the dispute/return rate metric needs but the plan's column list missed.
**Problem → fix:** The JSON Schema caught a bug in the contract on the first run: in YAML inline maps, an unquoted description with a comma ("Account the contact belongs to, if associated.") silently becomes an extra key. `additionalProperties: false` flagged it. Fix: quote those two descriptions. Caught by `make contract-check` before any test of the checker itself was trusted.
**Numbers:** 15 tables, 24 checker tests (18 of them negative: each proves a broken contract is rejected), Gate 1 warm run 7 s.
**Quotable line:** "My contract validator's first catch was a bug in my contract."
**Evidence:** `contract/data_dictionary.md` (Gate 1 sign-off material: the canonical tables, readable).
**Generic vs specific (#skill):** generic: contract format, JSON Schema, checker, version-bump rule, dictionary generator. Specific: the 15 tables, enums (rails, corridors, failure reasons), the payments conventions.
**Tags:** #article #skill

## 2026-11-23 · Stage 1 · Gate 1 passed, and a tag in the wrong place
**Type:** gate-pass
**What happened:** CI went green on all four jobs (lint, secrets, contract-check, unit) and PR #2 was merged and tagged `gate-1`. On the way, the agent's own command chain misfired: a branch-protection API call failed (`-f strict=true` sends the string "true", not a boolean), the merge was skipped as it should have been, but a `;` later in the same command let the tagging steps run anyway. `gate-1` was created and pushed on the Stage 0 commit. Caught immediately from the output, deleted locally and on GitHub, and redone with every step chained by `&&` plus an explicit check that the tagged commit contains the contract.
**Why it matters:** A tag is a claim ("this commit passed Gate 1"). A wrong tag is a false claim, the exact thing the gates exist to prevent.
**Problem → fix:** wrong tag target → delete and recreate after verifying the commit's contents. Lesson: in a chain of irreversible steps, never mix `;` with `&&`; and verify what you're about to label before labelling it.
**Quotable line:** "The gates were fine. My shell punctuation wasn't."
**Evidence:** PR #2, tag `gate-1` on `41231ce`.
**Tags:** #x #skill

## 2026-11-23 · Stage 2 · The hub: one readable map file per CRM
**Type:** milestone
**What happened:** Wrote `mappings/crm/hubspot.yml` and `scripts/compile_mappings.py`. The compiler checks the map against the contract (every canonical column present, every canonical value one the contract allows, `supported: false` only on optional tables, valid timezones and transforms), then writes the six staging models, a dbt sources file, dbt tests derived from the contract (not-null, unique, accepted values, relationships) and `int_crm__unmapped_values`. A real `dbt build` on a hand-made fixture with dirty rows built all 7 models; 43 of 44 tests passed, and the 1 failure was the fixture's deliberately unmapped lead source (`EMAIL_MARKETING`), which also showed up in the unmapped-values model with its row count, next to an unmapped country (`Atlantis`).
**Why it matters:** This is the swap mechanism. When a new CRM's values don't match, the system says exactly which value, in which column, how many rows, before anything reaches a dashboard.
**Options considered / pushback:** sqlfluff's dbt templater (in the plan) needs a live database connection just to lint, which would make the CI lint job depend on Postgres and credentials. Switched to the jinja templater with dbt built-ins: same SQL rules, no database; `dbt parse` separately proves sources, refs and tests resolve. Two sqlfluff rules were configured, not silenced wholesale: keyword names the contract deliberately uses (`name`, `domain`, `stage`, ...) are allowed, and ST06 (column ordering) is off because staging columns must follow contract order.
**Problem → fix:** sqlfluff flagged quoted `"timestamp"`/`"value"` as unnecessary. Rather than guess, tested against Postgres 17: non-reserved keywords work unquoted, reserved words (`order`) don't. The compiler now quotes only Postgres reserved words.
**Gap noted for Stage 4:** contract regex patterns (country codes, currencies, corridors) have no dbt test yet, so `Atlantis` passes through staging. Stage 4 adds a generic pattern test.
**Numbers:** 1 map (6 entities, 5 value maps), 9 generated files, 30 compiler tests (22 rejections), 54 tests total, Gate 2 run 19 s.
**Quotable line:** "Unmapped values aren't errors to hide. They're the to-do list for the next CRM."
**Evidence:** `mappings/crm/hubspot.yml` (Gate 2 sign-off: is it understandable?), `mappings/README.md`.
**Generic vs specific (#skill):** generic: map format, compiler, unmapped-values model, contract-derived tests, README. Specific: HubSpot's raw shape and value lists.
**Tags:** #article #case-study #video #skill

## 2026-11-23 · Stage 2 · Gate 2 passed and merged
**Type:** gate-pass
**What happened:** CI green on all five jobs (lint, secrets, contract-check, unit, compiled-up-to-date). PR #3 merged and tagged `gate-2`; `compiled-up-to-date` added to the required checks. The tag push hit a transient macOS keychain error again; a retry worked.
**Evidence:** PR #3, tag `gate-2` on `b4fa09d`.
**Tags:** #skill

## 2026-11-24 · Stage 3 · A synthetic company with a past, and an answer key
**Type:** milestone
**What happened:** Built the generator: a simulated SendFast (leads, deals with slips and stage loops, onboarding, usage with S-curve ramps, power-law volume, weekly/payday/December seasonality, churn hazards, pricing with effective dates, FX with an NGN devaluation, disputes 30-90 days late, Stripe-shaped invoices with min-commit true-ups). It lands the data the way each source really would: HubSpot with internal codes, free-text countries and naive New York timestamps; Stripe with minor units, Unix time and lower-case currencies; the ledger with `ngn`/`₦`, legal-name variants and orphan merchants. The answer key computes all 19 golden metrics from the generator's truth, after the exclusions correct cleaning must make, with each metric's definition written next to its value.
**Why it matters:** Stage 5 will compare the warehouse against this key. Every definition is now fixed before any SQL exists, so the SQL has to match the definition, not the other way round.
**Numbers:** full scale: 4,000 leads, 1,221 deals, 373 billing customers, 500,059 transactions, 15 raw tables; generate + load 7.8 s (limit 300 s). Identity match rate 98%. 26 generator tests; 76 tests in total. The Stage 2 HubSpot staging models, run by dbt on this generated data: 44/44 contract tests pass, 0 unmapped values.
**Quotable line:** "The answer key was written before the warehouse. The warehouse has to earn it."
**Evidence:** `generator/answer_keys/scale_1.json`, `docs/evidence/gate-3/*.png`.
**Generic vs specific (#skill):** generic: world -> raw emitter -> answer key -> raw-only story detectors; seeded independent RNG streams; determinism by hashing the exact bytes loaded; charts for a realism sign-off. Specific: the payments business model, corridors, rails, Stripe/HubSpot shapes.
**Tags:** #article #case-study #video #book #skill

## 2026-11-24 · Stage 3 · The first charts looked fake, so the company got a past
**Type:** problem-fix
**What happened:** The first profile charts showed volume and revenue starting from zero in early 2025: a company that didn't exist until the data began. Nobody would believe it. Fix: simulate 12 extra "warm-up" months before the data window, so customers already exist on day one. The CRM keeps its full history (as CRMs do); the ledger, invoices and FX hold the 24-month window. Metrics that follow an account from go-live only use accounts that went live inside the window.
**Why it matters:** "Looks real" was the owner's sign-off question, and the chart answered it before the owner had to.
**Problem → fix:** symptom: volume chart starting at $0 and a meaningless 10% failure spike in the first month (tiny sample). Root cause: simulation start = data start. Fix: `warmup_months: 12`. Caught by looking at the Gate 3 charts, not by any test.
**Quotable line:** "Synthetic data that starts on the first day of the dataset is a company with no past."
**Tags:** #linkedin #article #skill

## 2026-11-24 · Stage 3 · Tuning a story to one seed is cheating; test it across seeds
**Type:** pushback
**What happened:** Each planted story has a detector that reads only the raw tables and, where it can, searches for the story instead of being told where it is (the spike detector scans every corridor, rail and month). Three stories failed along the way: partner revenue (one whale account decided a mean), slow activation (too weak), and the pricing-change cohort, which flipped from pass to fail twice as unrelated changes reshuffled the random numbers. That was the warning sign: the agent was tuning to one seed. Fixes were structural, not numeric luck: median instead of mean per account; referred customers bigger and stickier; the price rise as a churn shock. Then every story was checked on six seeds; all six were detected on all six seeds.
**Why it matters:** A demo story that only appears for one random seed is a coincidence, not a finding. The dashboard's insights have to survive a re-roll.
**Options considered / pushback:** Lower the detection thresholds (rejected: thresholds were set before the results; moving them would be fitting the check to the data).
**Numbers:** 6 seeds x 6 stories = 36/36 detected. Pricing cohort month-12 activity 19-41% vs ~50-100% for other cohorts.
**Quotable line:** "If your planted story disappears when you change the seed, you didn't plant it. You found it by accident."
**Tags:** #linkedin #x #article #book #skill

## 2026-11-24 · Stage 3 · Exception: a Stage 2 test changed (pending owner review)
**Type:** decision
**What happened:** `test_timestamps_are_converted_from_map_timezone` asserted the HubSpot map's old timezone (`UTC`). The map deliberately moved to `America/New_York`, because HubSpot now lands naive local timestamps. The test was rewritten to read the timezone from the map and to check that a different timezone changes the SQL too: stricter, not weaker. Rule 1a needs owner approval for any test change at a gate, so it is listed under "Exceptions pending owner review" in `docs/gates/log.md`.
**Tags:** #skill

## 2026-11-24 · Stage 3 · Other deviations
**Type:** decision
**What happened:** (1) Billing and ledger ids are opaque hashes; the first draft built them from CRM ids, which would have let identity resolution "cheat". (2) Close-date-before-create dirty rows are a fixed count (at least 2), not a coin flip, so the 0.1 CI scale always contains them; this surfaced when the dirty-rows test found zero at scale 0.1. (3) The ruff line limit stayed at 100: 125 long lines were fixed in the code (formatter plus value-preserving string splits, verified by the answer keys not changing), not by raising the limit. (4) `deploy/sql/roles.sql` moves to Stage 4, where dbt first needs the `transformer` role.
**Tags:** #skill

## 2026-11-24 · Stage 3 · Owner decision: UTC everywhere
**Type:** decision
**What happened:** After Gate 3 the owner ruled: "timezones should always be UTC everywhere." The generator had made HubSpot land naive New York local times, to exercise time-zone conversion. That was reversed: HubSpot timestamps are now naive UTC (the dirty row is the missing zone marker, not a different zone), the map declares `UTC`, both Postgres servers and Metabase's JVM are pinned to UTC, and the rule is now locked decision D15 and agent rule 14. The pending test exception was withdrawn by restoring the test, since its reason no longer exists.
**Why it matters:** Mixed time zones are where revenue dashboards quietly disagree with finance: a transaction at 23:30 in Lagos lands in a different day, month or quarter depending on who asks. One zone end to end removes that whole class of bug.
**Options considered / pushback:** Keep a local-time source to show the compiler converting it (rejected by the owner: the realism isn't worth a second zone in the system). The compiler still supports `timezone:` in a map, as the way a future CRM's local times get converted to UTC at the door.
**Numbers:** all 6 stories still detected on all 6 seeds; answer keys regenerated.
**Quotable line:** "Pick one time zone. Then pick UTC."
**Tags:** #linkedin #x #skill

## 2026-11-24 · Stage 4 · Pricing keyed by the billing customer (contract 2.0.0), pending owner review
**Type:** decision
**What happened:** The contract keyed per-account pricing by CRM account. About 2% of customers can't be matched from CRM to billing (no Stripe id on the CRM record, no domain), so their pricing, and so their usage and FX-margin revenue, could never be found. The agent asked the owner which key to use; the owner declined the question and said to resume. The agent went ahead with its recommended option and flags it here for the owner to confirm or reverse: pricing lives with billing, keyed by the Stripe customer id. That is a breaking contract change (2.0.0, changelog entry, HubSpot map bumped).
**Why it matters:** Revenue must not depend on whether the CRM is tidy. Billing knows who pays and at what price; the CRM only adds context.
**Options considered / pushback:** Keep the CRM key and treat unmatched customers' usage revenue as unknowable (understates revenue by the unmatched share and blames the dashboard for a data-entry gap).
**Tags:** #case-study #skill

## 2026-11-24 · Stage 4 · Transformations: 196 dbt nodes green, and the marts already agree with the answer key
**Type:** milestone
**What happened:** Hand-written staging for billing, ledger and rates (minor units to major by currency exponent, Unix time to UTC, `ngn`/`₦` to NGN, website to domain); intermediate identity map (explicit Stripe id, then unique domain, else unmatched; test, internal and orphan exclusions), stage transitions, transactions enriched with USD at the day's FX rate and the pricing effective that day, and account lifecycle; marts (dim_accounts, dim_reps, dim_date, leads funnel, opportunities, stage transitions, account daily, revenue monthly, revenue bridge, cohort retention, account health). Every staging table's tests now come from the contract, including regex patterns (the Stage 2 `Atlantis` gap is closed). Roles via `deploy/sql/roles.sql`: dbt runs as `transformer`; `bi_reader` was checked to read the marts and nothing else.
**Why it matters:** Before any golden check exists, 9 metrics computed from the marts already equal the answer key exactly (TPV, net revenue, platform MRR, failure rate, win rate, sales cycle, revenue at risk, lead conversion, pipeline created). Two independent implementations of the same written definition agreeing is the point of writing the definition first.
**Problem → fix:** (1) `trailing` is a reserved word in Postgres, so it can't name a window: renamed. (2) sqlfluff couldn't render the project's own macros: pointed its jinja templater at `dbt/macros`. (3) Keyword identifiers (`year`, `lines`, `usage`, `accounts`) renamed, not whitelisted. (4) `make db-roles` echoed (synthetic) passwords: silenced. (5) Three tests pinned version numbers the 2.0.0 bump moved; made version-relative and logged for owner review.
**Numbers:** 196 dbt nodes (models + tests), 0 failures, at full scale and at 0.1; full `dbt build` ~20 s at 500k transactions; identity match rate 98%.
**Quotable line:** "Nine metrics matched the answer key to the cent before the golden check was even written."
**Generic vs specific (#skill):** generic: contract-derived dbt tests, identity map pattern (explicit id then unique domain), exclusions as one macro, a role script using psql \gexec, an at-risk rule shared by answer key and mart. Specific: payments revenue components, corridors, Stripe/ledger shapes.
**Tags:** #linkedin #article #case-study #skill

## 2026-11-24 · Stage 4 · Gate 4 passed in CI, merged, and two exceptions approved
**Type:** gate-pass
**What happened:** All 7 CI checks green on PR #6 (lint, secrets, contract-check, unit, compiled-up-to-date, generator, integration). Merged to `main` and tagged `gate-4` on `e6b3787`; `integration` is now a required check. The owner approved both items left pending: contract 2.0.0 (pricing keyed by the billing customer) and the three version-relative test changes. Both are logged as approved exceptions in `docs/gates/log.md`.
**Why it matters:** The decision the owner declined to make mid-stage (which key pricing hangs off) got an explicit yes at the gate. Going ahead with a flagged recommendation worked, but only because the flag forced a review before the next stage built on it.
**Evidence:** PR #6, tag `gate-4` on `e6b3787`, `docs/gates/log.md`.
**Tags:** #skill

## 2026-11-24 · Stage 5 · The metric dictionary and a golden check that reads what BI reads
**Type:** milestone
**What happened:** `metrics/metrics.yml` holds the 19 golden metrics in the PLAN format (label, definition, grain, unit, mart, column, owner, edge cases, golden block). Each definition is copied word for word from the answer key, and `scripts/golden_check.py` fails if they ever differ, if a metric is missing or extra, or if the spec's dates drift from the key's meta. Each metric's golden query runs as `bi_reader` (the marts only, what Metabase will see), in a read-only UTC session. Its `value` and every other column it returns (counts, revenue components) are compared with the key field of the same name. A mismatch prints metric, expected, actual, tolerance and the exact SQL run. Wired into `make golden`, `make gate-5` and the CI integration job (scale 0.1 key). 23 unit tests check the comparison: tolerance edges, nulls, wrong row counts, unknown columns, map-valued metrics, drift.
**Why it matters:** Rules live in the marts (exclusions, revenue components, at-risk flag, cycle and activation days, churn type). A golden query only filters and aggregates mart columns. So the check proves the marts, not a second copy of the logic hidden in the checker.
**Options considered / pushback:** A one-row-per-metric "KPI mart" that the check just reads (rejected: the check would prove a table built to pass it, and the printed SQL would explain nothing). Tolerances were fixed before the first run: 1e-6 for ratios (the key's rounding), one cent for money, exact for days and counts. They weren't touched after the results came in.
**Numbers:** first run at full scale: 17/19. The two failures were the gaps predicted at Stage 4.
**Generic vs specific (#skill):** generic: spec copies the key's definitions and the checker enforces it; parameters from a `periods` block checked against the key's meta; side columns compared by name; checker connects as the BI role. Specific: the 19 payments metrics and their queries.
**Tags:** #article #case-study #skill

## 2026-11-24 · Stage 5 · Two metrics the warehouse can't know, and a CI scale that hid them
**Type:** problem-fix
**What happened:** Activation days (22.5 vs 22.0, 118 vs 121 accounts) and 12-month revenue by lead source (inbound, partner and unknown off) failed at full scale. Root cause, checked by re-running the generator's truth under each candidate definition: the key used hidden truth for the 7 customers (2%) with no CRM match. The warehouse can't know their won date or lead source. With them excluded from activation and counted as `unknown` for lead source, the generator's truth equals the marts exactly, every bucket to the cent. The owner chose that definition, and the key was changed with approval (logged in `docs/gates/log.md`). The marts and the SQL were not changed.
**Surprise:** at scale 0.1 (the CI scale) all 19 passed before the fix. The single unmatched customer there happens to fall in neither cohort. CI alone would have shown green.
**Why it matters:** An answer key computed from ground truth can quietly expect knowledge no warehouse has. The fix belongs in the definition ("what can the business actually know?"), not in a tolerance wide enough to hide 3 accounts.
**Options considered / pushback:** Drop unmatched customers from both metrics (also passes, but loses 2 customers' revenue from the lead-source view). Improve identity matching to recover them (the 98% match rate is a deliberate part of the data). Widen the tolerance (never: rule 1a).
**Quotable line:** "The answer key knew things the warehouse never could. The fix was in the definition, not the SQL."
**Generic vs specific (#skill):** generic: when a golden metric is off by a few entities, re-run the truth under each candidate definition before touching SQL; a small CI scale can miss a cohort-level bug, so the full-scale local gate is the real one. Specific: unmatched billing customers and CRM-only fields.
**Tags:** #linkedin #x #article #book #skill

## 2026-11-24 · Stage 5 · Gate 5 passed in CI and merged
**Type:** gate-pass
**What happened:** All 7 CI checks green on PR #7. The integration job's new golden step printed 19/19 against the scale 0.1 key (checked in the job log, not assumed from the green tick). Merged to `main` and tagged `gate-5` on `8526e8f`, after checking that the merged commit carries `metrics/metrics.yml` and `scripts/golden_check.py`.
**Follow-up decision:** the owner asked whether the 7 unmatched customers should get matching CRM records instead. Answer: no. They are already handled (revenue fully counted; excluded or `unknown` only where CRM data is needed), and an imperfect match rate is a deliberate test of the dashboard against an untidy CRM. The owner agreed to leave them.
**Evidence:** PR #7, tag `gate-5` on `8526e8f`, `docs/gates/log.md`.
**Tags:** #skill

## 2026-11-24 · Stage 6 · Metabase rebuilt from the repo in 23 seconds, and three-way golden numbers
**Type:** milestone
**What happened:** `scripts/metabase_bootstrap.py` builds the whole Metabase layer from the repo on an empty app DB: first-run setup with the setup token, report time zone UTC, the data DB as `bi_reader` (analytics schema only), 7 collections, a view-only group and its API key for the proxy (written to the gitignored `.env.metabase`), 38 native SQL cards from `metabase/cards/*.sql`, 19 golden cards generated from `metrics/metrics.yml`, 4 models, 3 measures, and the 4 D10 dashboards from `metabase/dashboards/*.yml` with cross-filters and drill links to Account 360. It then runs every dashboard card with its default filters, and proves the proxy key is view-only: it runs a saved card, and ad-hoc SQL and card creation are refused (403). `metabase/parameters.yml` is the shared parameter contract: every card and filter uses those 7 names and types, and the bootstrap refuses anything else. `golden_check.py --metabase` adds the third source: each metric's golden card, and for 13 metrics the actual dashboard card a user sees (run with the golden filters through the proxy key), must agree with the key and the marts. `metabase` CI job runs the same compose stack.
**Why it matters:** Nothing in Metabase is hand-made, so the cloud move (Stage 10) is the same command against another URL. And the number on the dashboard tile is checked, not just the number in the warehouse.
**Options considered / pushback:** Card SQL may only filter and aggregate mart columns (rule 4). Two rules that would have lived in card SQL moved into `dim_accounts` instead: `activation_speed` (dbt var `activation_slow_days: 45`) and `net_revenue_first_12m_usd`. The new column reproduces the lead-source answer key to the cent. The PLAN's `[verify]` on the setup API was checked against the pinned instance's own OpenAPI spec (`/api/docs/openapi.json`), not memory: `/api/setup` still takes a setup token; v0.64 adds first-class measures (`/api/measure`). The optional SDK spike was skipped (it never changes D1).
**Numbers:** fresh bootstrap 23 s at full scale (limit 180 s); a rerun: 81 objects unchanged, 0 changes; 35 dashboard cards run clean; three-way golden 19/19 at scale 1.0 and 0.1; 134 unit tests.
**Quotable line:** "The number on the dashboard tile is tested against the answer key, not just the number in the warehouse."
**Generic vs specific (#skill):** generic: content as code (cards with front matter, dashboards as YAML), a parameter contract enforced at build time, upsert by name with format-neutral comparison so reruns are no-ops, generated golden cards, proxy key proven view-only by trying to misuse it, smoke-run every dashboard card. Specific: the 38 payments cards and four pages.
**Tags:** #linkedin #article #case-study #video #skill

## 2026-11-24 · Stage 6 · What broke on the way (and one bug only a screenshot found)
**Type:** problem-fix
**What happened:** (1) v0.64 stores native queries in MBQL 5 (stages, template tags as a list), so comparing what was posted with what was read back made every rerun an "update"; the bootstrap now posts MBQL 5 and compares a format-neutral fingerprint. (2) Data permissions "changed" on every run: Metabase stores `create-queries: no` by leaving the key out. (3) `MB_ADMIN_EMAIL` is a real Metabase setting name, so the bootstrap's variables became `MB_BOOTSTRAP_*`. (4) A measure update needs a `revision_message`. (5) The first full `make gate-6` failed at the last step with 401: make reads `.env.metabase` once at start, so after `metabase-reset` minted a new key the three-way check still held the old one. The check now reads the file the bootstrap just wrote. Whole gate rerun after the fix. (6) While taking the sign-off screenshots, Account 360 showed 275 activation days for the largest customer: it went live in February 2024, but the ledger starts 2024-11-01, so its "first payment" was clipped to the window start. Every account live before the window had a made-up activation time and `activation_speed`. No test caught it, because the golden metric and the churn-by-speed card already limit to accounts inside the window. Fixed in `int_account_lifecycle`: activation is unknown when go-live is before the window.
**Why it matters:** (6) is the case for human sign-offs. 197 dbt tests and a three-way golden check were green while a profile card showed a number nobody should trust.
**Quotable line:** "All checks green, and the first screenshot still found a wrong number."
**Generic vs specific (#skill):** generic: any metric measured from a first event is censored at the data window's start; null it for entities that began before the window. Make includes are read once per invocation. Specific: Metabase v0.64 API shapes.
**Tags:** #linkedin #x #article #book #skill

## 2026-11-24 · Stage 6 · Owner sign-off: cross-filtering screenshots
**Type:** decision
**What happened:** Gate 6 needs the owner to confirm cross-filtering on the native dashboards. Evidence is in `docs/evidence/gate-6/` (6 screenshots and a README): clicking a lead source bar filters Pipeline & funnel; clicking the USD-NGN spike filters Account health & risk to that corridor; clicking the top account opens Account 360 for it. Under the owner's standing rule, the agent saved the evidence and carried on; the owner can object afterwards.
**Tags:** #skill

## 2026-11-24 · Stage 6 · Gate 6 passed in CI and merged
**Type:** gate-pass
**What happened:** All 8 CI checks green on PR #8. The new `metabase` job's log shows a fresh bootstrap (79 objects, 10.7 s), a rerun with no changes and the three-way golden check at 19/19 on the 0.1 key. Merged and tagged `gate-6` on `c7a081b` after checking the merge commit carries the cards, dashboards, scripts and evidence. `metabase` is now a required check on `main` (8 in all). The tag push hit the credential flake once; a retry worked. Owner sign-off evidence: `docs/evidence/gate-6/`.
**Evidence:** PR #8, tag `gate-6` on `c7a081b`.
**Tags:** #skill

## 2026-11-24 · Stage 7 · Owner decision: the chart library
**Type:** decision
**What happened:** The owner named the two candidates held back since planning: shadcn.io charts (primary) and EvilCharts' ECharts components (secondary). The agent checked both against the plan's five criteria from the sites themselves and npm, and recorded the table in PLAN.md (Stage 7, D9). Primary: funnel, waterfall and Sankey are native; the heatmap is calendar-only, so the cohort heatmap is our own small component. Secondary is Apache ECharts underneath, so it doubles as the plan's fallback.
**Surprise:** shadcn.io's install command carries the account holder's personal token. The agent must never handle a credential, so the owner runs the chart installs once; after that the code is ordinary source in the repo and CI needs nothing.
**Options considered / pushback:** Plain shadcn/ui charts (Recharts) were not on the owner's list. ECharts alone covers every type but looks stock without heavy theming.
**Generic vs specific (#skill):** generic: an install step that needs a personal account is a human step; schedule it, write the exact command, and keep the result as source so CI never needs the account. Specific: the two libraries.
**Tags:** #article #skill

## 2026-11-25 · Stage 7 · The shadcn.io charts are in
**Type:** milestone
**What happened:** The owner signed in to shadcn.io and pasted the install commands; the agent ran them (pinned `shadcn@4.23.0`, not `@latest`), adding the Sankey and line charts with the same token so all eight planned types landed in one install: funnel, waterfall, Sankey, line, bar, sparkline, heatmap, ring. The kit is bklit-ui (MIT) ported onto `@tanstack/charts`: 786 source files, 5.7 MB, under `web/src/components/ui/charts/`, plus one sample per chart. New npm packages pinned exactly; all at least 7 days old. Before committing, the repo was grepped for the token: 0 files contain it, and `components.json` holds no registry credentials. All eight samples render under React 19 with zero console errors (`docs/evidence/stage-7/installed-charts-smoke.png`). The vendored kit is excluded from ESLint and prettier: we wrap it, never hand-edit it; reinstalling updates it.
**Problem → fix:** (1) The first install sent all eight URLs as one argument: zsh doesn't word-split a variable, and the registry answered "Invalid token", which pointed at the wrong cause. A real array fixed it. (2) ESLint was told to ignore the kit, but the pre-commit hook passes files by name, and ESLint's "file ignored" warning tripped `--max-warnings=0`; the hook now excludes the path too.
**Watch:** the bundle grew from 69 kB to 323 kB gzipped with every sample on one page; pages will load their charts lazily.
**Tags:** #skill

## 2026-11-25 · Stage 7 · The cohort heatmap lied about recent cohorts (right-censoring)
**Type:** problem-fix
**What happened:** The first Revenue page said "Accounts live in 2025Q4 keep 10% of logos at month 12". An account that went live in December 2025 reaches month 12 only in December 2026, after the as-of date, so `fct_cohort_retention` was dividing by the whole cohort while only the oldest accounts could appear in late months. Every late cell of every recent cohort understated retention. No test caught it; the insight title did, because it picked the most extreme cell. Fix in the mart: `is_complete` is true only when the cohort's latest go-live month plus the months-since-live is on or before the as-of month; the heatmap card shows complete cells only. After the fix the title found the planted story itself: 2025Q1 keeps 31% at month 12 (answer key 0.310345) vs 72% for other quarters.
**Why it matters:** Second time in this build (after activation days at Stage 6) that a data-window edge produced a confident wrong number. Both were found by looking at an insight on screen, not by a test.
**Generic vs specific (#skill):** generic: any "months since X" metric is right-censored near the as-of date; flag complete cells in the mart and never let a viz render incomplete ones as values. Specific: go-live cohorts.
**Tags:** #linkedin #article #skill

## 2026-11-25 · Stage 7 · Owner audit: titles must hold under any filter, and charts should explain themselves
**Type:** pushback
**What happened:** The owner asked for an audit of titles and richer tooltips. Switching 8 filter combinations on both pages showed titles that were true only at the default view: comparing a single source with itself ("Partner deals win least yet hold the most"), win shares for deals too young to close (Sep 2026), "$0 open pipeline" as "the most", rankings from a handful of deals, "0% past due" as a finding, and a cohort chart that ignored every filter. Fix: title logic moved into pure functions (`web/src/insights/`) with fairness rules (at least 2 groups with 10+ records before ranking; still-open share above 35% reported instead of win shares; no highlight when there is nothing to flag), each audit failure now a test. Filters wired where meaningful (cohort chart by segment/lead source through a new account x month mart; days in stage by segment; lead conversion by segment and rep); charts that truly can't apply a filter say "Not affected by ...". Every chart got a detailed tooltip, including the owner's example: a cohort cell shows accounts that went live, still active, revenue that month and to date, NRR and the calendar window.
**Evidence:** cohort refactor verified identical (116 rows, 0 differences); 41 web tests.
**Generic vs specific (#skill):** generic: insight titles need sample-size, censoring and degenerate-group rules, tested like any logic; label ignored filters instead of silently ignoring them. Specific: the pipeline and revenue findings.
**Tags:** #linkedin #article #skill

## 2026-11-25 · Stage 7 · Leakage and decay: the owner spots what the page was missing
**Type:** pushback
**What happened:** The owner pointed out that the Pipeline page showed neither deal decay nor leakage. Re-reading the plan, the agent had also dropped two items it does ask for: a lead -> opportunity -> won funnel and a velocity breakdown. The agent proposed four charts and said what the data cannot show (win rates don't fall with deal age, almost no stalled deals, close-date pushes aren't recorded). The owner declined planting a decay story ("we don't have to plant a story"), then improved the design mid-build: one bigger funnel starting at leads, with leakage under each step, instead of a separate leakage chart. Built that way, plus an ageing chart (open value by deal age, past close date marked) and a velocity table (open deals x average won x win rate / cycle, by segment).
**Problem -> fix:** following leads through the funnel needs the same people, but the CRM contract has no lead id on the opportunity. A converted lead is matched to the opportunity of the same account created on the conversion date (1,193 of 1,193 match one to one here, tested for uniqueness). That is an assumption to verify against a real CRM at the swap (Stage 8).
**Numbers:** 1,529 leads -> 96 won in 12 months; negotiation leaks most ($5.7M); $5.3M of open pipeline is over 90 days old; velocity $47,050.45 a day, equal to the golden metric.
**Quotable line:** "Two charts became one better one: the funnel already knew where it leaked."
**Generic vs specific (#skill):** generic: check a page against the plan's list before calling it done; put leakage on the funnel itself; say what data can't show instead of charting it. Specific: the lead-to-deal match rule.
**Tags:** #linkedin #article #case-study #skill

## 2026-11-25 · Stage 7 · Owner decision: name first, finding second, explanation third
**Type:** decision
**What happened:** The plan said chart titles should state the insight. In use, the owner found long sentence titles hard to scan: "these have to have recognizable titles that somebody can easily see", like the scorecards. Every chart card now reads: a short name ("Sales funnel", "Cohort retention"), the computed finding under it, then a small note saying what is measured. PLAN.md Stage 7 updated.
**Why it matters:** A headline that changes with every filter can't be the thing a reader navigates by. Names are stable landmarks; findings move underneath them.
**Quotable line:** "Titles are for finding the chart. Insights are for reading it."
**Generic vs specific (#skill):** generic: name / finding / note hierarchy for every chart card. Specific: the names chosen.
**Tags:** #linkedin #x #skill

## 2026-11-25 · Stage 7 · Owner: make it a dashboard, not a presentation (Group by)
**Type:** decision
**What happened:** The owner asked to regroup Sales velocity, then Deal outcomes too: "we can have more of a dashboard than a presentation, because you allow people to interact with it better". Both cards now switch between segment, lead source, rep, team and industry (country left out: 3 of 12 countries have under 10 closed deals). The choice is kept in the URL beside the filters.
**How:** each card returns every grouping in one result (a `dimension` column), so the shared filter contract didn't change and the switch is instant. Groups under 10 closed deals are dimmed and never ranked; dimensions with more groups than the palette has hues stay neutral, with only the flagged group coloured. "Channel outcomes" is renamed "Deal outcomes".
**Numbers:** velocity across all groups still equals the golden $47,050.45; every grouping accounts for all 453 deals.
**Quotable line:** "A presentation answers the question you picked. A dashboard answers the one the reader has."
**Generic vs specific (#skill):** generic: return all groupings in one card and switch client-side; keep view choices in the URL; never cycle colours past the palette. Specific: the five dimensions.
**Tags:** #linkedin #x #article #skill

## 2026-11-25 · Stage 7 · Owner: focus the best performer, and let a click change the focus
**Type:** decision
**What happened:** Deal outcomes highlighted the weakest group. The owner asked for the best performer by deals won as the default, and for the summary cards to act as a selector: click one, it takes the highlight and everything else fades back. Built: default focus = most deals won (value breaks ties, missing CRM values never rank); a click focuses a group, the finding and the "where lost deals stopped" note follow it, and the choice is in the URL. Changing the grouping or a filter that removes the group falls back to the default.
**Why it matters:** The default view should say who is doing well; the reader chooses who to inspect.
**Generic vs specific (#skill):** generic: summary cards double as the chart's selector (buttons with pressed state), with the selection in the URL. Specific: "best" = deals won.
**Tags:** #article #skill

## 2026-11-25 · Stage 7 · Interactivity, the last two pages, and the static demo
**Type:** milestone
**What happened:** The owner asked for Power BI-style interactivity, then "execute until you're done". Built: cross-filtering (click a lead source, rep, segment or corridor; a chip clears it), a deals drill-through, account names that open Account 360, and a data view with CSV download on every chart. Added Account health & risk (7 charts, the owner-approved list) and Account 360 (profile, revenue, volume, health, a dated timeline from lead to risk, deals). Static demo mode: an exporter runs every card for every period and single filter through Metabase with the view-only key; the site reads those files and holds one filter at a time. Playwright covers the four pages and the interactions; Lighthouse accessibility is checked per page; CI gained `web` and `e2e` jobs.
**Problem -> fix:** (1) The chart kit has no click events: our wrappers remember the hovered datum and treat a click as "filter by it". (2) Smoothed line charts drew dips either side of the corridor spike that were not in the data; lines are now straight. (3) The snapshot export takes ~10 minutes at full scale (4,969 card runs, 4.1 MB), ~4 at the CI scale.
**Numbers:** all four pages score 100 on Lighthouse accessibility; 8 end-to-end tests with zero console errors; all six planted stories visible.
**Quotable line:** "A smooth curve is a claim about data you don't have."
**Generic vs specific (#skill):** generic: card-per-preset snapshots for a database-free demo; click-to-filter on top of a chart kit via the tooltip datum; never smooth sparse time series. Specific: the pages.
**Tags:** #linkedin #article #case-study #video #skill

## 2026-11-25 · Stage 7 · Gate 7, loop 1: the unit runner ran the browser tests
**Type:** problem-fix
**What happened:** The first full `make gate-7` failed in `web-check`: Vitest's default pattern also matched `web/e2e/pages.spec.ts` and Playwright refused to be called from it. Unit tests had passed only because they were last run before the e2e file existed. Fix: Vitest includes `src/**/*.test.ts` only; the browser tests run through Playwright. Whole gate rerun.
**Tags:** #skill

## 2026-11-25 · Stage 7 · Gate 7, loops 2 and 3 attempts: the bootstrap's 3-minute limit, on a starved laptop
**Type:** problem-fix
**What happened:** Two full local `make gate-7` runs failed at the Metabase bootstrap time limit (180 s): 230 s, then 209 s. The same step took 23-51 s earlier the same day. First run: the Mac went into idle sleep during the bootstrap (pmset log: sleep 13:09 UTC, wake 13:38; matching 30-minute gap in the Metabase log); rerun with `caffeinate`. Second run, awake: Metabase startup took 2.9 minutes instead of about 40 s, one dashboard save 12.8 s, with swap at 16.2 of 17.4 GB, load average 15 on 8 cores, and about 14 containers from other projects sharing Docker's 5.8 GB. The limit was not changed. The agent pushed the branch so CI (a clean machine) could check the same gate, and asked the owner before touching other projects' containers.
**Why it matters:** A timing gate measures the machine too. The honest fix is the environment, not a bigger number.
**Generic vs specific (#skill):** generic: before blaming code for a timing failure, check sleep logs, swap and neighbouring containers; never raise a gate's limit to pass it. Specific: Metabase on a laptop.
**Tags:** #skill

## 2026-11-25 · Stage 7 · Green browser tests, useless screenshots
**Type:** surprise
**What happened:** CI passed all 10 checks on PR #9 (cb7d7c5); in its logs the Metabase bootstrap took 14.3 s against the 180 s limit, the 8 browser tests passed and Lighthouse accessibility was 100 on all four pages. Looking at the local screenshots meant for the design sign-off, though, bars were half grown and lines drawn only to February: the test captured the charts mid-animation. They also came from a snapshot built on 0.1-scale data, while the evidence notes claimed full scale. Neither was visible to any check, since the tests assert that charts exist and the console is clean. Fix: the screenshot test asks for reduced motion and waits for animations to finish; the snapshot was re-exported at full scale and all six planted stories checked by eye in the new images.
**Why it matters:** An evidence file nobody opens proves nothing. Look at every image before asking someone to approve it.
**Generic vs specific (#skill):** generic: wait for animations before visual captures; stamp or check the data scale behind any evidence. Specific: the chart kit's wipe-in animations.
**Tags:** #skill

## 2026-11-26 · Side branch · The same dashboard without Metabase
**Type:** decision
**What happened:** The owner asked whether dbt and Metabase are necessary, then asked for a second version of the dashboard without Metabase on its own port, and approved the design ("go"). Built on branch `local-direct-postgres`: a small server with the same API runs `metabase/cards/*.sql` in Postgres as `bi_reader`; the web app is unchanged (`make dev-direct`, :5174). `scripts/compare_direct.py`: 50 cards, 229 comparisons, 0 differences. Median of 5 unfiltered runs on six queries: 0.20-0.28 s through Metabase, 0.004-0.031 s direct, on the same Mac.
**Options considered / pushback:** Copy the project (rejected: drift). Use the static snapshot (rejected: still exported through Metabase, one filter at a time). Metabase stays the official path (D1); dropping it is a separate, later decision. Not merged, not part of any gate.
**Why it matters:** Because every query lived in the repo as SQL, removing the BI layer from the read path was a small change that could be proven identical.
**Generic vs specific (#skill):** generic: keep card SQL in files with a thin parameter syntax, so the query runner can be swapped and diffed. Specific: Metabase template tags, type names and 2,000-row limit.
**Tags:** #skill

## 2026-11-27 · Beyond Stage 7 · Drop Metabase; targets, deal history and a new layout
**Type:** decision
**What happened:** The owner shared screenshots of nine pages of a sales dashboard demo. The audit found repeated metrics across its pages, and in ours two different win percentages per lead source on one page, repeated risk figures, and no overview, target or forecast. The owner approved: sales targets set in the dashboard; deal change history now; five pages (Overview, Pipeline, Team, Revenue & retention, Account health); a Stage 7B with the contract change and new answer-key entries (`docs/proposals/2026-11-27-dashboard-v2.md`). The owner decided to drop Metabase because it is slower and the dashboard should be snappy; the direct Postgres version is the way forward. The Metabase containers and the :5173 preview were stopped.
**Options considered / pushback:** Keep Metabase, or use both. The cost of dropping it: no self-serve exploration, four dashboards lost, and the proxy, snapshot export, three-way number check, gates and CI need rework. No check has been changed yet. Whether to finish gate 7 first is still open.
**Why it matters:** The read path is now chosen on measured speed (0.004-0.031 s against 0.20-0.28 s).
**Generic vs specific (#skill):** generic: audit a reference dashboard for questions answered and repeats, then check each idea against the data before promising it. Specific: payments sales metrics.
**Tags:** #skill

---

## Owner notes

_(Your own words, any time. Rough is fine.)_

---

## Content bank

| Idea | Format | Draws from |
|---|---|---|
| "I let AI build my dashboard without ever seeing the data" | LinkedIn, article | idea; gates; SDK decision |
| "I asked AI to tear my plan apart first" | LinkedIn, X | critical review |
| What's actually free in Metabase embedding (and what isn't) | Technical article | SDK decision |
| The hub principle: swapping CRMs with one map file | Article, video | hub principle; (later) Salesforce swap |
| Pricing tables need effective dates | X thread | rates |
| Case study: full revenue loop for a B2B payments API | Case study, book | all entries |

---

## What I'd tell someone starting this

- Get the plan critiqued before you build.
- Check what's free in production before you build the demo.
- Put the messiness where it really lives (for revenue data: the CRM).

---

## Metrics of the build

| Stage | Started | Gate passed | Loops at gate | Notes |
|---|---|---|---|---|
| Planning | 2026-11-23 | n/a | n/a | Plan v2 finalized |
| 0 Scaffold | 2026-11-23 | 2026-11-23 | 4 local + 1 CI | one false pass (untracked files) |
| 1 Contract | 2026-11-23 | 2026-11-23 | 3 | validator caught a YAML bug in the contract |
| 2 Mapping | 2026-11-23 | 2026-11-23 | 4 | sqlfluff templater swap |
| 3 Generator | 2026-11-24 | 2026-11-24 | 6 | warm-up, story robustness, lint; then UTC everywhere |
| 4 Transformations | 2026-11-24 | 2026-11-24 | 4 | reserved word, sqlfluff macros, version-pinned tests |
| 5 Golden numbers | 2026-11-24 | 2026-11-24 | 1 | 17/19 then 19/19 after the owner-approved key change |
| 6 Metabase | 2026-11-24 | 2026-11-24 | 2 | stale API key within one make run; activation clipped by the window |
| 7 Front end | 2026-11-24 | pending (CI green) | 3 so far | e2e picked up by unit runner; two slow-laptop timeouts |
