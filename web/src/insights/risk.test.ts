import { describe, expect, it } from "vitest";
import {
  accountInsight,
  atRiskInsight,
  concentrationInsight,
  corridorInsight,
  disputeInsight,
  healthInsight,
  railInsight,
  riskByRepInsight,
} from "./risk";

const acct = (account_name: string, revenue_at_risk_usd: number) => ({
  account_name,
  revenue_at_risk_usd,
});

describe("risk titles", () => {
  it("at-risk accounts: concentration, one, none", () => {
    expect(
      atRiskInsight([
        acct("A", 22000),
        acct("B", 19000),
        acct("C", 3000),
        acct("D", 2000),
      ]).title,
    ).toBe("2 accounts make up 89% of the $46K at risk");
    expect(atRiskInsight([acct("A", 500)]).title).toBe(
      "A is at risk: $500 of monthly revenue",
    );
    expect(atRiskInsight([]).title).toBe("No account is at risk in this view");
  });
  it("health and rep ownership", () => {
    expect(
      healthInsight([
        { health_status: "healthy", accounts: 208 },
        { health_status: "watch", accounts: 48 },
        { health_status: "at_risk", accounts: 8 },
      ]).title,
    ).toBe("208 of 264 live accounts are healthy; 48 on watch, 8 at risk");
    expect(
      riskByRepInsight([
        { rep_name: "J", revenue_at_risk_usd: 89 },
        { rep_name: "B", revenue_at_risk_usd: 11 },
      ]).title,
    ).toBe("J owns 89% of the revenue at risk");
  });
  it("finds a spike against the corridor's own usual rate, else says none", () => {
    const m = (corridor: string, month: string, failure_rate: number) => ({
      corridor,
      month,
      failure_rate,
      transactions: 1000,
      failed: failure_rate * 1000,
    });
    const spike = [
      m("USD-NGN", "2026-01-01", 0.04),
      m("USD-NGN", "2026-02-01", 0.04),
      m("USD-NGN", "2026-03-01", 0.175),
    ];
    expect(corridorInsight(spike).title).toBe(
      "USD-NGN failures hit 17.5% in Mar 2026, about 4× its usual rate",
    );
    expect(corridorInsight(spike.slice(0, 2)).title).toMatch(
      /No corridor spiked/,
    );
    expect(corridorInsight([]).title).toMatch(/Too few/);
  });
  it("rails, concentration, disputes, account", () => {
    expect(
      railInsight([
        { rail: "swift", failed: 55, transactions: 1000 },
        { rail: "nip", failed: 48, transactions: 1000 },
      ]).title,
    ).toBe("SWIFT fails most (5.5%), then NIP (4.8%)");
    expect(
      concentrationInsight(
        [
          { account_name: "J", share_of_net_revenue: 0.25 },
          { account_name: "K", share_of_net_revenue: 0.05 },
        ],
        0.5,
      ).title,
    ).toBe("J earns 25% of net revenue; the top 10 earn 50%");
    expect(
      disputeInsight([
        { month: "2026-01-01", dispute_return_rate: 0.0037, succeeded: 30000 },
        { month: "2026-02-01", dispute_return_rate: 0.002, succeeded: 30000 },
      ]).title,
    ).toBe("Disputes and returns peaked in Jan 2026 at 0.37% of payments");
    expect(accountInsight({ name: "J", health_status: "watch" }).title).toBe(
      "J is on watch",
    );
    expect(accountInsight(undefined).title).toMatch(/Pick an account/);
  });
});
