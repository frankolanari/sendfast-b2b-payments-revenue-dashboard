# Gate log

One line per gate pass (PLAN.md Section 4A). Approved exceptions are listed with their reason.

| Gate | Date       | Commit    | Exceptions |
| ---- | ---------- | --------- | ---------- |
| G0   | 2026-11-23 | `88a4465` | none       |
| G1   | 2026-11-23 | `41231ce` | none       |
| G2   | 2026-11-23 | `b4fa09d` | none       |

## Exceptions pending owner review

- **2026-11-24, Stage 3:** `scripts/tests/test_compile_mappings.py::test_timestamps_are_converted_from_map_timezone`
  changed. It asserted the HubSpot map's old timezone (`UTC`); the map deliberately moved to
  `America/New_York`. The test now reads the timezone from the map and also checks that a different
  timezone changes the SQL: stricter, not weaker. Needs the owner's approval under rule 1a.
