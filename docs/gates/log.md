# Gate log

One line per gate pass (PLAN.md Section 4A). Approved exceptions are listed with their reason.

| Gate | Date       | Commit    | Exceptions                              |
| ---- | ---------- | --------- | --------------------------------------- |
| G0   | 2026-11-23 | `88a4465` | none                                    |
| G1   | 2026-11-23 | `41231ce` | none                                    |
| G2   | 2026-11-23 | `b4fa09d` | none                                    |
| G3   | 2026-11-24 | `4afeb25` | none (test change withdrawn, see below) |

## Exceptions

_Withdrawn 2026-11-24: the owner set UTC everywhere (PLAN.md D15), the HubSpot map went back to
`UTC`, and the test below was restored to its original wording. No test change stands._

- **2026-11-24, Stage 3:** `scripts/tests/test_compile_mappings.py::test_timestamps_are_converted_from_map_timezone`
  changed. It asserted the HubSpot map's old timezone (`UTC`); the map deliberately moved to
  `America/New_York`. The test now reads the timezone from the map and also checks that a different
  timezone changes the SQL: stricter, not weaker. Needs the owner's approval under rule 1a.
