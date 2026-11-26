# Local preview without Metabase: design

Approved by the owner on 2026-11-26 ("go").

## Intent

Run the same dashboard on live data with no Metabase, on its own port, to compare the two side by
side. Metabase stays the official path (PLAN.md D1); dropping it would be a later decision.

## Approaches

1. **Same web app, second server that runs `metabase/cards/*.sql` in Postgres** (chosen): one
   front end, one set of queries.
2. Copy the whole project (rejected: the two would drift apart).
3. Static snapshot on another port (rejected: exported through Metabase, one filter at a time).

## Design

- `proxy/src/direct.ts` serves the same `/api` as the Metabase proxy, with the same parameter
  checks. It connects as `bi_reader`, in a read-only UTC session.
- Values are bound parameters, never pasted into SQL. `[[ ... ]]` clauses drop out when their value
  is missing; required parameters take the shared contract's default.
- Results use the same shape as Metabase's.
- `make dev-direct`: web on 5174, server on 8788.
- `scripts/compare_direct.py` runs every card both ways and fails on any difference.

## Not in scope

Cloudflare Workers, deployment, the static snapshot, gates and CI. Branch `local-direct-postgres`
only; PR #9 and gate 7 are untouched.
