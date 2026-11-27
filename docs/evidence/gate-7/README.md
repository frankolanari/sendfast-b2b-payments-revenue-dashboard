# Gate 7 evidence: the React dashboard

Screenshots are full pages from the Playwright run of `make snapshot e2e` (static demo mode,
full-scale synthetic data, dark theme, 1440 px). Owner sign-off: design quality, and every planted story
visible.

| Screenshot        | Page                  |
| ----------------- | --------------------- |
| `pipeline.png`    | Pipeline & funnel     |
| `revenue.png`     | Revenue & retention   |
| `risk.png`        | Account health & risk |
| `account-360.png` | Account 360           |

## Where each planted story shows

| Planted story                         | Where to see it                                                       |
| ------------------------------------- | --------------------------------------------------------------------- |
| Partner accounts earn more            | Revenue & retention: "First-year revenue by lead source"              |
| Pricing change hurt the 2025Q1 cohort | Revenue & retention: "Cohort retention" (2025Q1 row)                  |
| Slipping rep                          | Pipeline & funnel: "Open pipeline by rep" (past-due share)            |
| Slow activation, higher churn         | Revenue & retention: "Churn by activation speed"                      |
| Corridor failure spike                | Account health & risk: "Failure rate by corridor" (USD-NGN, Mar 2026) |
| Revenue concentration                 | Account health & risk: "Revenue concentration"                        |

Run it yourself: `make up && make dev` (live, http://localhost:5174), or `make snapshot` then
`pnpm --filter @sendfast/web run preview --outDir dist-snapshot` (static demo).
