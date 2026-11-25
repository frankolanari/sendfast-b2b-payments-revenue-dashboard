/** Insight titles for Account health & risk. Pure functions of the card rows; unit-tested. */
import type { Row } from "@/api/useCard";
import { currency, month, percent } from "@/lib/format";
import {
  cap,
  type Insight,
  median,
  MIN_SAMPLE,
  num,
  pickBy,
  plural,
} from "./common";

export function atRiskInsight(rows: Row[]): Insight {
  if (!rows.length) return { title: "No account is at risk in this view" };
  const total = rows.reduce((a, r) => a + num(r.revenue_at_risk_usd), 0);
  if (rows.length === 1)
    return {
      title: `${String(rows[0].account_name)} is at risk: ${currency(total)} of monthly revenue`,
    };
  const sorted = [...rows].sort(
    (a, b) => num(b.revenue_at_risk_usd) - num(a.revenue_at_risk_usd),
  );
  const top2 =
    num(sorted[0].revenue_at_risk_usd) + num(sorted[1].revenue_at_risk_usd);
  if (rows.length > 2 && total && top2 / total >= 0.5)
    return {
      title: `2 accounts make up ${percent(top2 / total, 0)} of the ${currency(total)} at risk`,
    };
  return {
    title: `${plural(rows.length, "account")} at risk, ${currency(total)} of monthly revenue`,
  };
}

export function healthInsight(rows: Row[]): Insight {
  const n = (k: string) =>
    num(rows.find((r) => r.health_status === k)?.accounts);
  const total = n("healthy") + n("watch") + n("at_risk");
  if (!total) return { title: "No live accounts in this view" };
  return {
    title: `${n("healthy")} of ${total} live accounts are healthy; ${n("watch")} on watch, ${n("at_risk")} at risk`,
  };
}

export function riskByRepInsight(rows: Row[]): Insight {
  const total = rows.reduce((a, r) => a + num(r.revenue_at_risk_usd), 0);
  if (!total) return { title: "No revenue is at risk in this view" };
  const top = pickBy(rows, "revenue_at_risk_usd", "max")!;
  if (rows.length === 1)
    return {
      title: `All ${currency(total)} at risk sits with ${String(top.rep_name)}`,
    };
  return {
    title: `${String(top.rep_name)} owns ${percent(num(top.revenue_at_risk_usd) / total, 0)} of the revenue at risk`,
    highlight: top,
  };
}

/** The corridor-month that stands furthest above that corridor's usual failure rate. */
export function corridorInsight(rows: Row[]): Insight & { corridor?: string } {
  const by = new Map<string, Row[]>();
  for (const r of rows) {
    if (num(r.transactions) < 100) continue;
    by.set(String(r.corridor), [...(by.get(String(r.corridor)) ?? []), r]);
  }
  let worst: { row: Row; ratio: number; usual: number } | undefined;
  for (const list of by.values()) {
    const usual = median(list.map((r) => num(r.failure_rate)));
    for (const row of list) {
      const ratio = usual ? num(row.failure_rate) / usual : 0;
      if (list.length >= 3 && (!worst || ratio > worst.ratio))
        worst = { row, ratio, usual };
    }
  }
  if (worst && worst.ratio >= 2)
    return {
      title: `${String(worst.row.corridor)} failures hit ${percent(worst.row.failure_rate)} in ${month(worst.row.month)}, about ${worst.ratio.toFixed(0)}× its usual rate`,
      highlight: worst.row,
      corridor: String(worst.row.corridor),
    };
  if (!by.size)
    return { title: "Too few payments in this view to judge failure rates" };
  const averages = [...by.entries()].map(([corridor, list]) => ({
    corridor,
    rate:
      list.reduce((a, r) => a + num(r.failed), 0) /
      list.reduce((a, r) => a + num(r.transactions), 0),
  }));
  const high = averages.sort((a, b) => b.rate - a.rate)[0];
  return {
    title: `No corridor spiked; ${high.corridor} fails most often at ${percent(high.rate)}`,
    corridor: high.corridor,
  };
}

export function railInsight(rows: Row[]): Insight {
  const rails = new Map<string, { failed: number; total: number }>();
  for (const r of rows) {
    const x = rails.get(String(r.rail)) ?? { failed: 0, total: 0 };
    rails.set(String(r.rail), {
      failed: x.failed + num(r.failed),
      total: x.total + num(r.transactions),
    });
  }
  const ranked = [...rails.entries()]
    .filter(([, x]) => x.total >= 100)
    .map(([rail, x]) => ({
      rail: rail.toUpperCase(),
      rate: x.failed / x.total,
    }))
    .sort((a, b) => b.rate - a.rate);
  if (!ranked.length)
    return { title: "Too few payments in this view to compare rails" };
  if (ranked.length === 1)
    return {
      title: `${ranked[0].rail} fails ${percent(ranked[0].rate)} of payments`,
    };
  return {
    title: `${ranked[0].rail} fails most (${percent(ranked[0].rate)}), then ${ranked[1].rail} (${percent(ranked[1].rate)})`,
  };
}

export function concentrationInsight(top: Row[], top10Share: unknown): Insight {
  if (!top.length) return { title: "No revenue in this view" };
  const first = top[0];
  const all = num(top10Share);
  if (top.length === 1)
    return {
      title: `${String(first.account_name)} is the only account earning revenue here`,
    };
  return {
    title: `${String(first.account_name)} earns ${percent(first.share_of_net_revenue, 0)} of net revenue${all ? `; the top 10 earn ${percent(all, 0)}` : ""}`,
    highlight: first,
  };
}

export function disputeInsight(rows: Row[]): Insight {
  const sized = rows.filter((r) => num(r.succeeded) >= MIN_SAMPLE * 10);
  if (!sized.length)
    return {
      title: "Too few payments in this view to judge disputes and returns",
    };
  const peak = pickBy(sized, "dispute_return_rate", "max")!;
  if (sized.length === 1)
    return {
      title: `${percent(peak.dispute_return_rate, 2)} of payments were disputed or returned in ${month(peak.month)}`,
    };
  return {
    title: `Disputes and returns peaked in ${month(peak.month)} at ${percent(peak.dispute_return_rate, 2)} of payments`,
  };
}

export function accountInsight(profile: Row | undefined): Insight {
  if (!profile) return { title: "Pick an account to see its story" };
  if (profile.churn_type)
    return {
      title: `${String(profile.name)} has churned (${cap(profile.churn_type).toLowerCase()})`,
    };
  const status = profile.health_status
    ? cap(String(profile.health_status).replace("_", " ")).toLowerCase()
    : "not yet live";
  return {
    title: `${String(profile.name)} is ${status === "healthy" || status === "at risk" ? status : status === "watch" ? "on watch" : status}`,
  };
}
