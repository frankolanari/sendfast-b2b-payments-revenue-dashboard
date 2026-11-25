import { describe, expect, it } from "vitest";
import {
  cardParams,
  ignoredFilters,
  parseFilters,
  serializeFilters,
} from "./filters";

describe("URL filters", () => {
  it("round-trips, and the default period stays out of the URL", () => {
    const f = parseFilters("?period=sep2026&segment=smb&owner_id=70000005");
    expect(f).toEqual({
      period: "sep2026",
      segment: "smb",
      owner_id: "70000005",
    });
    expect(parseFilters(serializeFilters(f))).toEqual(f);
    expect(serializeFilters({ period: "t12" })).toBe("");
  });
  it("falls back to the default period on junk", () => {
    expect(parseFilters("?period=forever").period).toBe("t12");
  });
});

describe("cardParams", () => {
  it("sends each card only the parameters it accepts", () => {
    const f = parseFilters(
      "?segment=smb&lead_source=partner&owner_id=7&corridor=USD-NGN",
    );
    // open_pipeline takes segment, lead_source, owner_id: no dates, no corridor
    expect(cardParams("open_pipeline", f)).toEqual({
      segment: "smb",
      lead_source: "partner",
      owner_id: "7",
    });
    // win_rate takes dates too
    expect(cardParams("win_rate", f)).toEqual({
      date_from: "2025-11-01",
      date_to: "2026-10-31",
      segment: "smb",
      lead_source: "partner",
      owner_id: "7",
    });
  });
  it("'All time' sends no dates", () => {
    expect(cardParams("win_rate", parseFilters("?period=all"))).toEqual({});
  });
  it("lets a page pin a parameter (e.g. one account)", () => {
    expect(
      cardParams("account_profile", parseFilters(""), {
        account_id: "10000006",
      }),
    ).toEqual({
      account_id: "10000006",
    });
  });
});

describe("ignoredFilters", () => {
  it("names the active filters a chart cannot apply", () => {
    const f = parseFilters("?period=sep2026&owner_id=7&segment=smb");
    expect(ignoredFilters(["cohort_retention_grid"], f)).toEqual([
      "period",
      "rep",
    ]);
    expect(ignoredFilters(["open_pipeline_by_rep"], f)).toEqual(["period"]);
    expect(ignoredFilters(["win_rate"], f)).toEqual([]);
  });
  it("says nothing at the default view", () => {
    expect(ignoredFilters(["cohort_retention_grid"], parseFilters(""))).toEqual(
      [],
    );
  });
});
