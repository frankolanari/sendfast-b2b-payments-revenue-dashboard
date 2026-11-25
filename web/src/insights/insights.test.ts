/** The audit's failures (2026-11-25), each now a test. */
import { describe, expect, it } from "vitest";
import {
  channelInsight,
  funnelInsight,
  pipelineByMonthInsight,
  repInsight,
  winRateInsight,
} from "./pipeline";
import {
  activationInsight,
  bridgeInsight,
  cohortInsight,
  firstYearInsight,
  trendInsight,
} from "./revenue";

const outcome = (
  lead_source: string,
  deals: number,
  won: number,
  still_open: number,
  open_usd: number,
) => ({
  lead_source,
  deals,
  won,
  still_open,
  open_usd,
  won_share: deals ? won / deals : 0,
});

describe("never compare one thing with itself", () => {
  it("one source on the Sankey: describes it", () => {
    const t = channelInsight(
      [outcome("partner", 116, 23, 39, 5_109_600)],
      "t12",
    ).title;
    expect(t).toBe("Partner: 23 of 116 deals won so far, $5.1M still open");
    expect(t).not.toMatch(/least|most/);
  });
  it("one source on pipeline by month", () => {
    expect(
      pipelineByMonthInsight(
        [{ partner: 12_617_700 }],
        ["inbound", "partner"],
        "t12",
      ).title,
    ).toBe("Partner brought $12.6M of new pipeline in the last 12 months");
  });
  it("one source on win rate and first-year revenue", () => {
    expect(
      winRateInsight([
        {
          lead_source: "partner",
          closed_opportunities: 77,
          won_opportunities: 23,
          win_rate: 0.299,
        },
      ]).title,
    ).toMatch(/^Partner: 23 of 77/);
    expect(
      firstYearInsight([
        {
          lead_source: "partner",
          accounts: 16,
          median_net_revenue_first_12m_usd: 55239,
        },
      ]).title,
    ).toMatch(/median of 16 accounts/);
  });
});

describe("recent periods and empty numbers", () => {
  it("says most September deals are still open instead of a win share", () => {
    const funnel = [
      { stage: "discovery", stage_rank: 1, opportunities: 42 },
      { stage: "won", stage_rank: 5, opportunities: 1 },
    ];
    const t = funnelInsight(
      funnel,
      [outcome("inbound", 42, 1, 38, 3_000_000)],
      "sep2026",
    ).title;
    expect(t).toBe(
      "90% of deals created in Sep 2026 are still open; 2% won so far",
    );
  });
  it("never reports $0 open pipeline as the most", () => {
    const rows = [
      outcome("inbound", 50, 20, 0, 0),
      outcome("partner", 40, 10, 0, 0),
    ];
    expect(channelInsight(rows, "y2025").title).toBe(
      "Partner deals win least (25%); no deals in this view are still open",
    );
  });
  it("no past-due problem is not a problem", () => {
    const reps = [
      { rep_name: "A", past_due_share: 0 },
      { rep_name: "B", past_due_share: 0 },
    ];
    expect(repInsight(reps)).toEqual({
      title: "No open pipeline is past its close date",
    });
    expect(
      repInsight([
        { rep_name: "A", past_due_share: 0.04 },
        { rep_name: "B", past_due_share: 0 },
      ]).highlight,
    ).toBeUndefined();
  });
});

describe("small samples are not ranked", () => {
  it("win rates", () => {
    const rows = [
      { lead_source: "partner", closed_opportunities: 2, win_rate: 0 },
      { lead_source: "inbound", closed_opportunities: 3, win_rate: 0.5 },
    ];
    expect(winRateInsight(rows)).toEqual({
      title: "Too few closed deals to compare sources (under 10 each)",
    });
  });
  it("cohorts and activation", () => {
    expect(
      cohortInsight([
        {
          cohort_quarter: "2025Q1",
          months_since_live: 12,
          cohort_accounts: 3,
          logo_retention: 0,
        },
      ]).title,
    ).toMatch(/Too few/);
    expect(
      activationInsight([
        { activation_speed: "slow", accounts: 4, churn_rate: 1 },
        { activation_speed: "fast", accounts: 30, churn_rate: 0.1 },
      ]).title,
    ).toMatch(/Too few/);
  });
});

describe("real findings still show", () => {
  it("finds the planted cohort story", () => {
    const grid = [
      ["2024Q4", 0.72],
      ["2025Q1", 0.31],
      ["2025Q2", 0.8],
      ["2025Q3", 0.47],
    ].map(([q, r]) => ({
      cohort_quarter: q,
      months_since_live: 12,
      cohort_accounts: 29,
      logo_retention: r,
    }));
    expect(cohortInsight(grid).highlight?.cohort_quarter).toBe("2025Q1");
  });
  it("compares the first and last month of the trend", () => {
    const rows = [
      { month: "2025-11-01", fee: 100 },
      { month: "2026-10-01", fee: 150 },
    ];
    expect(trendInsight(rows, [{ key: "fee", label: "Fee" }]).title).toBe(
      "Net revenue up 50%: $100 in Nov 2025 to $150 in Oct 2026",
    );
  });
  it("bridge with gains only", () => {
    expect(
      bridgeInsight(
        [
          { step: "start", amount_usd: 1 },
          { step: "new", amount_usd: 500 },
        ],
        { new: "New" },
      ).title,
    ).toBe("New added $500; nothing was lost");
  });
});
