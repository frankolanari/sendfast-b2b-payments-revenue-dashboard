import { describe, expect, it } from "vitest";
import { columnLabel, formatCell, toCsv, visibleColumns } from "./table";

describe("generic table", () => {
  it("labels and formats by column name", () => {
    expect(columnLabel("revenue_at_risk_usd")).toBe("Revenue at risk");
    expect(formatCell("amount_usd", 1234567.4)).toBe("$1,234,567");
    expect(formatCell("win_rate", "0.331")).toBe("33.1%");
    expect(formatCell("created_date", "2026-09-01T00:00:00Z")).toBe(
      "Sep 1, 2026",
    );
    expect(formatCell("segment", "mid_market")).toBe("Mid-market");
    expect(formatCell("deals", null)).toBe("–");
  });
  it("hides ids and internal keys", () => {
    expect(
      visibleColumns([{ account_id: "1", name: "A", __x: 1, stage_rank: 2 }]),
    ).toEqual(["name"]);
  });
  it("writes safe CSV", () => {
    expect(toCsv([{ a: 'x,"y"', b: "=HYPERLINK(1)", c: -5 }])).toBe(
      'a,b,c\n"x,""y""",\'=HYPERLINK(1),-5',
    );
  });
});
