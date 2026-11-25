/** The audit's failures (2026-11-25), each now a test. */
import { describe, expect, it } from "vitest";
import {
  channelInsight,
  pipelineByMonthInsight,
  repInsight,
  winRateInsight,
  ageingInsight,
  biggestLeak,
  leadFunnelInsight,
  velocityInsight,
} from "./pipeline";
import {
  activationInsight,
  bridgeInsight,
  cohortInsight,
  firstYearInsight,
  trendInsight,
} from "./revenue";

const outcome = (
  grp: string,
  deals: number,
  won: number,
  still_open: number,
  open_usd: number,
) => ({
  grp,
  label: grp.charAt(0).toUpperCase() + grp.slice(1),
  inline: grp,
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

const step = (
  stage_rank: number,
  reached: number,
  open_here = 0,
  lost_here = 0,
  lost_here_usd = 0,
) => ({
  stage_rank,
  reached,
  open_here,
  lost_here,
  lost_here_usd,
  stage: ["lead", "discovery", "qualified", "proposal", "negotiation", "won"][
    stage_rank
  ],
});

describe("lead funnel with leakage, ageing, velocity", () => {
  const rows = [
    step(0, 1529),
    step(1, 438, 41, 52, 3_660_600),
    step(2, 345, 30, 59, 5_475_500),
    step(3, 256, 33, 33, 1_716_400),
    step(4, 190, 37, 57, 5_741_800),
    step(5, 96),
  ];
  it("says the share without a deal and where the most value leaks", () => {
    const i = leadFunnelInsight(rows, "t12");
    expect(i.title).toBe(
      "71% of leads created in the last 12 months have no deal; negotiation leaks the most, $5.7M lost",
    );
    expect(i.highlight?.stage).toBe("negotiation");
  });
  it("young cohorts are reported as open, empty ones say so, tiny losses aren't ranked", () => {
    expect(
      leadFunnelInsight([step(0, 100), step(1, 20, 18)], "sep2026").title,
    ).toMatch(/90% of the deals are still open/);
    expect(leadFunnelInsight([step(0, 0)], "sep2026").title).toBe(
      "No leads were created in Sep 2026",
    );
    expect(biggestLeak([step(1, 20, 0, 2, 100)])).toBeUndefined();
  });
  it("ageing: old share, and nothing old", () => {
    const rows = [
      { age_bucket: "0-30 days", open_usd: 9_000_000, past_due_usd: 0 },
      {
        age_bucket: "Over 90 days",
        open_usd: 5_250_000,
        past_due_usd: 727_900,
      },
    ];
    expect(ageingInsight(rows).title).toBe(
      "$5.3M, 37% of open pipeline, is over 90 days old; $727.9K of it is past its close date",
    );
    expect(ageingInsight([rows[0]]).title).toBe(
      "No open deal is older than 90 days or past its close date",
    );
  });
  it("velocity: headline, fastest group, and small samples", () => {
    const total = { closed_deals: 426, velocity_usd_per_day: 47050 };
    const g = (grp: string, closed_deals: number, v: number) => ({
      grp,
      inline: grp,
      closed_deals,
      velocity_usd_per_day: v,
    });
    const groups = [
      g("smb", 205, 3837),
      g("enterprise", 71, 28847),
      g("tiny", 3, 99999),
      g("unknown", 50, 99999),
    ];
    const i = velocityInsight(total, groups, "segment");
    expect(i.highlight?.grp).toBe("enterprise");
    expect(i.title).toBe(
      "Open pipeline turns into $47.1K of won revenue a day; by segment, enterprise is highest at $28.8K",
    );
    expect(velocityInsight(total, [groups[0]]).title).toBe(
      "Open pipeline turns into $47.1K of won revenue a day",
    );
    expect(velocityInsight({ ...total, closed_deals: 3 }).title).toMatch(
      /Too few/,
    );
  });
});
