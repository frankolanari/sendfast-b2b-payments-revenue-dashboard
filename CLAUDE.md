# SendFast B2B Payments Revenue Dashboard: agent rules

Synthetic-first revenue dashboard for SendFast, a fictional B2B cross-border payments API.
`PLAN.md` is the source of truth (locked decisions in Section 1, stages in Section 4, gates in Section 4A).
`JOURNAL.md` is the build journal (Section 14).

## Commands

- `make help`: list every target
- `make up` / `make down`: local data Postgres, all config from `.env`
- `make dev`: dashboard server and web app (http://localhost:5174)
- `make lint`: pre-commit on all files. `make secrets`: gitleaks over the full history
- `make gate-N`: run gate N and every gate before it. `make gates`: all gates built so far

Toolchain: Python 3.12 via `uv`, Node 24 LTS via `pnpm`. Docker for the stack.

## Rules (PLAN.md Section 13)

1. Work one stage at a time, in order. Don't start a stage until the previous gate passes locally and in CI (Section 4A). If a gate fails, loop: find the root cause, fix the code, rerun the full gate. After the same failure 3 times with no progress, stop, write `docs/gates/blocked-gate-N.md`, and ask the owner.
   1a. Never weaken a check to pass a gate: no editing tests, answer key, tolerances, contract or thresholds without the owner's approval (logged in `docs/gates/log.md`), and no skips, `xfail`, `|| true` or `continue-on-error`.
   1b. At a gate with a human sign-off, prepare the evidence and stop until the owner approves.
2. Never read, create, or reference production credentials, `.env.prod`, or the `prod` compose profile. Never connect to any database except the local synthetic one.
3. Never hand-edit generated files (`dbt/models/staging/crm/*`, `contract/data_dictionary.md`). Change the source (map, contract) and regenerate.
4. Every metric is computed in a mart. No business logic in React or the dashboard server.
5. Every new card uses the shared parameter contract (Stage 6).
6. Any change to the schema contract needs a version bump and a changelog entry.
7. Keep the data deterministic: fixed seed, fixed as-of date (`2026-10-31`), never `now()`.
8. Conformance output is aggregates only. Never print row values or sample records.
9. When something new breaks, reproduce it in the generator before fixing it, and log it in `docs/what_broke.md` if it came from the swap rehearsal.
10. Use design tokens for every color, font size and spacing value. No hard-coded styles.
11. Follow the cloud-ready rules in Section 2A from the first commit: config from env only, no data in the `public` schema, roles via `deploy/sql/roles.sql`, and a proxy that runs on both Node and Cloudflare Workers.
12. Keep `JOURNAL.md` as you go (Section 14). Write an entry at every gate pass, every blocked gate, every approved exception, every owner decision, and every surprise. Be honest: failures and dead ends are the most valuable entries. Never edit or delete past entries; add a correction entry instead.
13. Tag reusable lessons `#skill`, and for each stage note what was generic vs domain-specific. Stage 11 is built from these.
14. UTC everywhere (D15): generated data, staging, marts, database sessions, the front end and charts. Never introduce a local time zone; a source that lands local times is converted to UTC in staging.

## Workflow

- One branch per stage (`stage-N-<name>`). Merge to `main` only through a PR with green CI. Tag the merge commit `gate-N`, and add a line to `docs/gates/log.md`.
- `PLAN.md` and `JOURNAL.md` are excluded from prettier (`.prettierignore`): they are owner-facing prose, kept as written.
