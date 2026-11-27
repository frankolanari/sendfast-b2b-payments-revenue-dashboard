# Proposed plan change: Stage 7B, targets, deal history and the new layout

Status, 2026-11-27: **A and B approved. D decided: drop Metabase; the direct Postgres version
(`local-direct-postgres`) is the way forward. C open.** Nothing in this plan is built yet. The
Metabase removal changes D1-D3, D7, D8, D13, D14 and the gates; that list needs approval before
any check is changed (rule 1a).

Source: audit of the Dear Lucy demo (nine pages, owner screenshots, 2026-11-27).

## Decided by the owner

1. Sales targets can be set on the dashboard.
2. Deal change history is added now.
3. The five-page layout below.

## 1. Pages (replaces D10)

Each metric has one home. Elsewhere it may appear only as a link.

| Page                | Contents                                                                                                                                                                                                                      |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Overview (new)      | Won against target; forecast against target; pipeline coverage; win rate, sales cycle and deal size, each with change on the previous period; forecast by month with target and last year; top deals closing; needs attention |
| Pipeline            | Funnel and leakage; pipeline movement; slippage; stage by close month; ageing; source performance (merges the two win-percentage charts); deals                                                                               |
| Team (new)          | Rep scorecard: attainment, won, pipeline created, win rate, cycle, velocity, overdue, data quality; set targets                                                                                                               |
| Revenue & retention | As now                                                                                                                                                                                                                        |
| Account health      | At-risk accounts and concentration first; payment operations lower down                                                                                                                                                       |

Account 360 stays as the drill-through page. "Open pipeline by rep" and the velocity table move to Team.

## 2. Metric definitions

| Metric            | Definition                                                                                                |
| ----------------- | --------------------------------------------------------------------------------------------------------- |
| Won               | Amount of deals won with a close date in the period (CRM bookings, not net revenue)                       |
| Stage probability | Of deals that entered the stage and closed in the trailing 12 months, the share won                       |
| Weighted pipeline | Open deal amount x stage probability                                                                      |
| Forecast          | Won in the period + weighted pipeline closing in the period (overdue deals excluded and shown separately) |
| Attainment        | Won / target                                                                                              |
| Coverage          | Open pipeline closing in the period / (target - won); "target met" when nothing remains                   |
| Slippage          | Of deals due in a quarter at its start, the share whose close date later moved past its end               |
| Forecast accuracy | 1 - abs(forecast at quarter start - actual won) / actual won; can be negative, shown as is                |
| Pipeline movement | Start + created + moved in + increased - decreased - moved out - lost - won = end                         |

All are computed in marts (rule 4). Definitions go in `metrics/metrics.yml` with answer keys.

## 3. Targets

- Grain: one rep, one quarter, USD. Team and company targets are sums.
- The generator seeds targets, so the dashboard works out of the box.
- Edits are stored in `app.sales_targets`, a separate schema that data reloads do not wipe. The
  target in force is the edit if there is one, otherwise the seeded value.
- A new database role may write that table and nothing else. `bi_reader` stays read-only.
- The server gets one write endpoint with validation. This is the first write path in the product.
- **No login exists yet,** so editing is enabled locally only. Stage 10 must add sign-in before any
  deployment allows edits.
- Static demo: edits are kept in the viewer's browser and labelled as such.
- Gates and answer keys use seeded targets only, so an edit cannot break a number check.

## 4. Deal change history

- New CRM source table: one row per change of a deal's amount or close date.
- Compiled through the CRM map into staging. Contract version bump and changelog (rule 6).
- The generator uses a separate random stream, so existing figures should not change. The gate
  checks this: the 19 current golden values must be identical.
- Test: the last history value equals the deal's current value.
- Assumption to check at Stage 8: the real CRM sync delivers property history. If it does not,
  slippage, accuracy and movement show "not available", and history is collected from then on.

## 5. Order of work

1. Data: contract, generator, map, marts, metric definitions, answer keys.
2. Queries: new cards; targets storage and write endpoint.
3. Front end: Overview and Team, then the changes to the other pages; static demo.
4. Gate 7B.

## 6. Gate 7B

- Gates 0-7 still pass, locally and in CI.
- The 19 existing golden values are unchanged; the new metrics match the answer key.
- Movement reconciles to the cent: start plus the moves equals the end.
- Targets: an edit changes attainment; invalid input is refused; the write role cannot touch
  other tables.
- Every page renders in live and static mode with no console errors; accessibility 90 or more.
- Owner sign-off on screenshots.

## 7. Needs your approval

|     | Item                                                         | Recommendation                                                               |
| --- | ------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| A   | Add Stage 7B and replace D10 as above                        | Approve                                                                      |
| B   | Contract change and new answer-key entries (rule 1a)         | Approve                                                                      |
| C   | Finish gate 7 on the current four pages first, then start 7B | Yes: a verified baseline to change from                                      |
| D   | Metabase                                                     | Decide before step 2. It affects how the write path and new cards are served |

## Not included

Calls and activities (no data), new versus cross-sell ranking (too few repeat wins), Cube, D3
rewrites and the product idea (parked in the journal).
