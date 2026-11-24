# Gate log

One line per gate pass (PLAN.md Section 4A). Approved exceptions are listed with their reason.

| Gate | Date       | Commit    | Exceptions                                                               |
| ---- | ---------- | --------- | ------------------------------------------------------------------------ |
| G0   | 2026-11-23 | `88a4465` | none                                                                     |
| G1   | 2026-11-23 | `41231ce` | none                                                                     |
| G2   | 2026-11-23 | `b4fa09d` | none                                                                     |
| G3   | 2026-11-24 | `4afeb25` | none (test change withdrawn, see below)                                  |
| G4   | 2026-11-24 | `e6b3787` | contract 2.0.0; three version-relative tests (approved, see below)       |
| G5   | 2026-11-24 | `8526e8f` | answer key: activation and lead-source definitions (approved, see below) |
| G6   | 2026-11-24 | `c7a081b` | none (owner sign-off: cross-filter screenshots in docs/evidence/gate-6)  |

## Exceptions

_Withdrawn 2026-11-24: the owner set UTC everywhere (PLAN.md D15), the HubSpot map went back to
`UTC`, and the test below was restored to its original wording. No test change stands._

- **2026-11-24, Stage 3:** `scripts/tests/test_compile_mappings.py::test_timestamps_are_converted_from_map_timezone`
  changed. It asserted the HubSpot map's old timezone (`UTC`); the map deliberately moved to
  `America/New_York`. The test now reads the timezone from the map and also checks that a different
  timezone changes the SQL: stricter, not weaker. Needs the owner's approval under rule 1a.

- **2026-11-24, Stage 4 (APPROVED by the owner 2026-11-24):** three tests pinned contract version numbers that
  the 2.0.0 contract bump moved: `test_rejects_newer_or_other_major_contract_version`,
  `test_change_with_bump_is_accepted`, `test_version_going_backwards_is_rejected`. Each now computes
  its versions relative to the current contract (same intent; the first now checks both a newer
  and an older major). The checker code is unchanged. Approved by the owner on 2026-11-24 (rule 1a).

- **2026-11-24, Stage 4 (APPROVED by the owner 2026-11-24):** schema contract 2.0.0 (breaking): per-account
  pricing is keyed by the billing customer (Stripe customer id), not the CRM account, so the ~2% of
  customers with no CRM match still have pricing and usage revenue. Changelog entry in
  `contract/CHANGELOG.md`. Approved by the owner on 2026-11-24 (rule 1a).

- **2026-11-24, Stage 5 (APPROVED by the owner 2026-11-24):** answer key definitions changed for
  `activation_days` and `net_revenue_12m_per_account_by_lead_source`. The key used the generator's
  hidden truth for the 7 customers (2%) that can't be matched from CRM to billing; the warehouse
  can't know their won date or lead source. Now activation excludes them, and lead source counts
  them as `unknown` (revenue kept), matching `dim_accounts`. Full-scale values moved (activation
  22.0 -> 22.5 days over 118 accounts; inbound, partner and unknown medians); scale 0.1 values are
  unchanged. The marts and the SQL were not changed to fit. Approved by the owner on 2026-11-24
  (rule 1a).
