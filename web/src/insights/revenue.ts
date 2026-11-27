/** Insight titles for Revenue & retention. Pure functions of the card rows; unit-tested. */
import type { Row } from "@/api/useCard";
import { currency, month, percent } from "@/lib/format";
import {
  cap,
  type Insight,
  knownSources,
  median,
  MIN_SAMPLE,
  num,
  pickBy,
  plural,
} from "./common";

export function trendInsight(
  monthRows: Row[],
  components: readonly { key: string; label: string }[],
): Insight {
  const total = (r: Row) => components.reduce((a, c) => a + num(r[c.key]), 0);
  if (!monthRows.length) return { title: "No revenue in this view" };
  const last = monthRows[monthRows.length - 1];
  if (monthRows.length === 1) {
    const top = components.reduce(
      (b, c) => (num(last[c.key]) > num(last[b.key]) ? c : b),
      components[0],
    );
    return {
      title: `Net revenue was ${currency(total(last))} in ${month(last.month)}, mostly ${top.label.toLowerCase()}`,
    };
  }
  const first = total(monthRows[0]);
  const end = total(last);
  if (first <= 0)
    return {
      title: `Net revenue reached ${currency(end)} in ${month(last.month)}`,
    };
  const change = end / first - 1;
  if (Math.abs(change) < 0.02)
    return {
      title: `Net revenue held at about ${currency(end)} a month, ${month(monthRows[0].month)} to ${month(last.month)}`,
    };
  return {
    title: `Net revenue ${change > 0 ? "up" : "down"} ${percent(Math.abs(change), 0)}: ${currency(first)} in ${month(monthRows[0].month)} to ${currency(end)} in ${month(last.month)}`,
  };
}

export function bridgeInsight(
  rows: Row[],
  labels: Record<string, string>,
): Insight {
  const moves = rows.filter((r) => r.step !== "start" && r.step !== "end");
  const gain = pickBy(
    moves.filter((r) => num(r.amount_usd) > 0),
    "amount_usd",
    "max",
  );
  const loss = pickBy(
    moves.filter((r) => num(r.amount_usd) < 0),
    "amount_usd",
    "min",
  );
  const name = (r: Row) => labels[String(r.step)] ?? cap(r.step);
  if (gain && loss)
    return {
      title: `${name(gain)} added ${currency(gain.amount_usd)}; ${name(loss).toLowerCase()} took back ${currency(-num(loss.amount_usd))}`,
    };
  if (gain)
    return {
      title: `${name(gain)} added ${currency(gain.amount_usd)}; nothing was lost`,
    };
  if (loss)
    return {
      title: `${name(loss)} took ${currency(-num(loss.amount_usd))}; nothing was added`,
    };
  return { title: "Revenue didn't move in this view" };
}

export function cohortInsight(grid: Row[]): Insight {
  const m12 = grid.filter(
    (r) =>
      num(r.months_since_live) === 12 && num(r.cohort_accounts) >= MIN_SAMPLE,
  );
  if (!grid.length) return { title: "No accounts went live in this view" };
  if (m12.length < 2)
    return {
      title: `Too few accounts to compare cohorts at month 12 (under ${MIN_SAMPLE} per quarter)`,
    };
  const weakest = pickBy(m12, "logo_retention", "min")!;
  const others = median(
    m12.filter((r) => r !== weakest).map((r) => num(r.logo_retention)),
  );
  if (others - num(weakest.logo_retention) < 0.1) {
    const hi = pickBy(m12, "logo_retention", "max")!;
    return {
      title: `Month-12 logo retention runs ${percent(weakest.logo_retention, 0)} to ${percent(hi.logo_retention, 0)} across go-live quarters`,
    };
  }
  return {
    title: `Accounts live in ${String(weakest.cohort_quarter)} keep ${percent(weakest.logo_retention, 0)} of logos at month 12, vs ${percent(others, 0)} for other quarters`,
    highlight: weakest,
  };
}

export function activationInsight(rows: Row[]): Insight {
  const slow = rows.find((r) => r.activation_speed === "slow");
  const fast = rows.find((r) => r.activation_speed === "fast");
  if (
    !slow ||
    !fast ||
    num(slow.accounts) < MIN_SAMPLE ||
    num(fast.accounts) < MIN_SAMPLE
  )
    return {
      title: `Too few accounts to compare fast and slow starters (under ${MIN_SAMPLE} each)`,
    };
  const s = num(slow.churn_rate);
  const f = num(fast.churn_rate);
  if (f > 0 && s / f >= 1.2)
    return {
      title: `Slow starters churn at ${percent(s, 0)}, ${(s / f).toFixed(1)}× fast starters`,
      highlight: slow,
    };
  if (s > 0 && f / s >= 1.2)
    return {
      title: `Fast starters churn more here: ${percent(f, 0)} vs ${percent(s, 0)}`,
      highlight: fast,
    };
  return {
    title: `Fast and slow starters churn at similar rates (${percent(f, 0)} vs ${percent(s, 0)})`,
  };
}

export function firstYearInsight(rows: Row[]): Insight {
  const key = "median_net_revenue_first_12m_usd";
  if (!rows.length)
    return { title: "No accounts with a full first year in this view" };
  if (rows.length === 1) {
    const r = rows[0];
    return {
      title: `${cap(r.lead_source)} accounts earn ${currency(r[key])} in their first year (median of ${plural(num(r.accounts), "account")})`,
    };
  }
  const sized = knownSources(rows).filter((r) => num(r.accounts) >= MIN_SAMPLE);
  if (sized.length < 2)
    return {
      title: `Too few accounts to compare sources (under ${MIN_SAMPLE} each)`,
    };
  const best = pickBy(sized, key, "max")!;
  const rest = median(sized.filter((r) => r !== best).map((r) => num(r[key])));
  if (!rest || num(best[key]) / rest < 1.2)
    return {
      title: "First-year revenue per account is similar across sources",
    };
  return {
    title: `${cap(best.lead_source)} accounts earn ${currency(best[key])} in their first year, ${(num(best[key]) / rest).toFixed(1)}× other sources`,
    highlight: best,
  };
}
