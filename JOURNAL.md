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
