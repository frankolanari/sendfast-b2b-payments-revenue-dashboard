import { describe, expect, it } from "vitest";
import {
  bps,
  count,
  currency,
  day,
  days,
  month,
  percent,
  toNumber,
} from "./format";

describe("toNumber", () => {
  it("accepts numbers and numeric strings, rejects the rest", () => {
    expect(toNumber(3)).toBe(3);
    expect(toNumber("97342000")).toBe(97342000);
    expect(toNumber(null)).toBeNull();
    expect(toNumber("")).toBeNull();
    expect(toNumber("abc")).toBeNull();
    expect(toNumber(Number.NaN)).toBeNull();
  });
});

describe("currency", () => {
  it("is compact by default", () => {
    expect(currency(97342000)).toBe("$97.3M");
    expect(currency(465120)).toBe("$465.1K");
    expect(currency(3_448_645.41)).toBe("$3.4M");
    expect(currency(87.2)).toBe("$87");
    expect(currency(0)).toBe("$0");
  });
  it("shows the naira sign for NGN", () => {
    expect(currency(1_200_000_000, { code: "NGN" })).toBe("₦1.2B");
  });
  it("can show the full amount", () => {
    expect(currency(3_448_645.41, { compact: false })).toBe("$3,448,645");
  });
  it("keeps the sign for losses", () => {
    expect(currency(-540000)).toBe("-$540K");
  });
  it("shows a dash when missing", () => {
    expect(currency(null)).toBe("–");
  });
});

describe("percent, bps, count, days", () => {
  it("formats ratios", () => {
    expect(percent(0.330986)).toBe("33.1%");
    expect(percent(0.037218, 2)).toBe("3.72%");
    expect(percent(undefined)).toBe("–");
  });
  it("formats basis points", () => {
    expect(bps(0.006686)).toBe("66.9 bps");
  });
  it("formats counts", () => {
    expect(count(32309)).toBe("32,309");
    expect(count(500059, { compact: true })).toBe("500.1K");
  });
  it("formats day durations", () => {
    expect(days(76)).toBe("76 days");
    expect(days(1)).toBe("1 day");
    expect(days(22.5)).toBe("22.5 days");
  });
});

describe("dates are UTC", () => {
  it("never shifts a month or a day with the local clock", () => {
    expect(month("2026-09-01")).toBe("Sep 2026");
    expect(month("2026-09-01", "long")).toBe("September 2026");
    expect(month("2026-09-01T00:00:00Z")).toBe("Sep 2026");
    expect(day("2026-09-30")).toBe("Sep 30, 2026");
    expect(month("not a date")).toBe("–");
  });
});
