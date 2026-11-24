# Gate 6 evidence: cross-filtering on the native dashboards

Captured 2026-11-24 from the local synthetic Metabase (v0.64.8.3, open source), rebuilt from an
empty app DB by `make metabase-bootstrap`. Headless Chromium, 1440 px wide. Owner sign-off item.

| Screenshot                             | What it shows                                                                                                                                                                                        |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pipeline-1-before.png`                | Pipeline & funnel with the default filters (trailing 12 months). Win rate 33.1% = the answer key (0.330986).                                                                                         |
| `pipeline-2-crossfiltered-partner.png` | After clicking the `partner` bar in "Win rate by lead source": the Lead source filter is set to `partner` and every card refilters (win rate 29.8%).                                                 |
| `risk-1-before.png`                    | Account health & risk. The USD-NGN failure spike in March 2026 (a planted story) stands out.                                                                                                         |
| `risk-2-crossfiltered-usd-ngn.png`     | After clicking the spike point: the Corridor filter is `USD-NGN`; failure, volume and dispute cards refilter. Revenue at risk, concentration and health mix don't take a corridor filter, by design. |
| `risk-3-top-accounts.png`              | Accounts at risk (account names link to Account 360) and Top 10 accounts: one account dominates (the planted concentration story).                                                                   |
| `account-360-drill.png`                | After clicking the top account's bar: Account 360 opens with the Account filter set to that account, shown by name.                                                                                  |

How to reproduce: `make up && make generate && make transform && make metabase-reset &&
make metabase-bootstrap`, log in at http://localhost:3000 with `MB_BOOTSTRAP_EMAIL` /
`MB_BOOTSTRAP_PASSWORD` from `.env`, and click the same bars.
