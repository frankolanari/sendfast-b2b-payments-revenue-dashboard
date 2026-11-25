/** Insight titles for Pipeline & funnel. Pure functions of the card rows; unit-tested. */
import type { Row } from "@/api/useCard";
import { currency, days, percent } from "@/lib/format";
import type { PeriodKey } from "@/state/filters";
import {
  cap,
  inPeriod,
  type Insight,
  knownSources,
  MIN_SAMPLE,
  num,
  pickBy,
  plural,
} from "./common";

/** Above this open share, deals are too young for win rates to mean much. */
const STILL_OPEN_SHARE = 0.35;

function totals(outcomes: Row[]) {
  const sum = (k: string) => outcomes.reduce((a, r) => a + num(r[k]), 0);
  return {
    deals: sum("deals"),
    won: sum("won"),
    open: sum("still_open"),
    openUsd: sum("open_usd"),
  };
}

export function winRateInsight(rows: Row[]): Insight {
  if (!rows.length) return { title: "No closed deals in this view" };
  if (rows.length === 1) {
    const r = rows[0];
    return {
      title: `${cap(r.lead_source)}: ${num(r.won_opportunities)} of ${plural(num(r.closed_opportunities), "closed deal")} won (${percent(r.win_rate)})`,
    };
  }
  const sized = knownSources(rows).filter(
    (r) => num(r.closed_opportunities) >= MIN_SAMPLE,
  );
  if (sized.length < 2)
    return {
      title: `Too few closed deals to compare sources (under ${MIN_SAMPLE} each)`,
    };
  const low = pickBy(sized, "win_rate", "min")!;
  const high = pickBy(sized, "win_rate", "max")!;
  if (num(high.win_rate) - num(low.win_rate) < 0.02)
    return {
      title: `Win rates are close across sources, around ${percent(low.win_rate, 0)}`,
    };
  return {
    title: `${cap(low.lead_source)} closes at ${percent(low.win_rate)}, the lowest; ${cap(high.lead_source).toLowerCase()} leads at ${percent(high.win_rate)}`,
    highlight: low,
  };
}

/** The source -> outcome Sankey. Returns the weakest source (for highlighting) when fair. */
export function channelInsight(outcomes: Row[], period: PeriodKey): Insight {
  const t = totals(outcomes);
  if (!t.deals) return { title: `No deals were created ${inPeriod[period]}` };
  if (outcomes.length === 1) {
    const r = outcomes[0];
    return {
      title: `${cap(r.lead_source)}: ${num(r.won)} of ${plural(num(r.deals), "deal")} won so far, ${currency(r.open_usd)} still open`,
    };
  }
  if (t.open / t.deals > STILL_OPEN_SHARE)
    return {
      title: `${num(t.open)} of ${plural(t.deals, "deal")} created ${inPeriod[period]} are still open, worth ${currency(t.openUsd)}`,
    };
  const sized = knownSources(outcomes).filter(
    (r) => num(r.deals) >= MIN_SAMPLE,
  );
  if (sized.length < 2)
    return {
      title: `Too few deals to compare channels (under ${MIN_SAMPLE} each)`,
    };
  const worst = pickBy(sized, "won_share", "min")!;
  const richest = pickBy(sized, "open_usd", "max")!;
  const lead = `${cap(worst.lead_source)} deals win least (${percent(worst.won_share, 0)})`;
  if (num(richest.open_usd) <= 0)
    return {
      title: `${lead}; no deals in this view are still open`,
      highlight: worst,
    };
  const money = currency(richest.open_usd);
  return {
    title:
      richest === worst
        ? `${lead} yet hold the most open pipeline (${money})`
        : `${lead}; ${cap(richest.lead_source).toLowerCase()} holds the most open pipeline (${money})`,
    highlight: worst,
  };
}

/** Where the weakest source's lost deals stopped, for the Sankey subtitle. */
export function leakNote(
  gates: Row[],
  worst: Row | undefined,
  stages: readonly string[],
): string {
  if (!worst) return "";
  const lost = gates.filter(
    (r) => r.lead_source === worst.lead_source && r.outcome === "lost",
  );
  const top = pickBy(lost, "deals", "max");
  if (!top || num(top.deals) < 3) return "";
  const stage = stages[num(top.furthest_stage_rank) - 1];
  return stage
    ? ` Most lost ${String(worst.lead_source)} deals stopped at ${stage.toLowerCase()}.`
    : "";
}

export function pipelineByMonthInsight(
  rows: Row[],
  sources: readonly string[],
  period: PeriodKey,
): Insight {
  const sums = sources
    .map((s) => ({ source: s, usd: rows.reduce((a, r) => a + num(r[s]), 0) }))
    .filter((x) => x.usd > 0);
  const total = sums.reduce((a, x) => a + x.usd, 0);
  if (!total) return { title: `No new pipeline ${inPeriod[period]}` };
  if (sums.length === 1)
    return {
      title: `${cap(sums[0].source)} brought ${currency(total)} of new pipeline ${inPeriod[period]}`,
    };
  const ranked = sums
    .filter((x) => x.source !== "unknown")
    .sort((a, b) => b.usd - a.usd);
  const top = ranked[0];
  if (!top)
    return { title: `${currency(total)} of new pipeline ${inPeriod[period]}` };
  return {
    title: `${cap(top.source)} brings the most new pipeline: ${currency(top.usd)} of ${currency(total)} ${inPeriod[period]}`,
  };
}

/** Slipping reps: past-due share of open pipeline, as of the as-of date. */
export function repInsight(rows: Row[]): Insight {
  if (!rows.length) return { title: "No open pipeline in this view" };
  if (rows.length === 1) {
    const r = rows[0];
    return {
      title: `${String(r.rep_name)}: ${currency(r.open_pipeline_usd)} open, ${percent(r.past_due_share, 0)} past its close date`,
    };
  }
  const worst = pickBy(rows, "past_due_share", "max")!;
  const share = num(worst.past_due_share);
  if (share === 0) return { title: "No open pipeline is past its close date" };
  if (share < 0.1)
    return {
      title: `Close dates are healthy: no rep has more than ${percent(share, 0)} past due`,
    };
  return {
    title: `${String(worst.rep_name)}: ${percent(share, 0)} of open pipeline is past its close date`,
    highlight: worst,
  };
}

export function stageDaysInsight(rows: Row[]): Insight {
  if (!rows.length) return { title: "No stage entries in this view" };
  const sized = rows.filter((r) => num(r.stage_entries) >= MIN_SAMPLE);
  if (sized.length < 2)
    return {
      title: `Too few stage entries to compare stages (under ${MIN_SAMPLE})`,
    };
  const slow = pickBy(sized, "median_days_in_stage", "max")!;
  return {
    title: `Deals wait longest in ${String(slow.stage)}: ${days(Math.round(num(slow.median_days_in_stage) * 10) / 10)} at the median`,
    highlight: slow,
  };
}

/** The stage with the most lost value, when there are enough lost deals to rank stages. */
export function biggestLeak(rows: Row[]): Row | undefined {
  const stages = rows.filter(
    (r) => num(r.stage_rank) >= 1 && num(r.stage_rank) <= 4,
  );
  const lost = stages.reduce((a, r) => a + num(r.lost_here), 0);
  const top = pickBy(stages, "lost_here_usd", "max");
  return lost >= MIN_SAMPLE && top && num(top.lost_here_usd) > 0
    ? top
    : undefined;
}

/** Lead -> won funnel with leakage: leads created in the period, followed to their deals. */
export function leadFunnelInsight(rows: Row[], period: PeriodKey): Insight {
  const at = (rank: number, key = "reached") =>
    num(rows.find((r) => num(r.stage_rank) === rank)?.[key]);
  const leads = at(0);
  if (!leads) return { title: `No leads were created ${inPeriod[period]}` };
  const deals = at(1);
  const won = at(5);
  if (leads < MIN_SAMPLE)
    return {
      title: `Only ${plural(leads, "lead")} created ${inPeriod[period]}: ${deals} became deals, ${won} won so far`,
    };
  const open = [1, 2, 3, 4].reduce((a, k) => a + at(k, "open_here"), 0);
  const noDeal = `${percent((leads - deals) / leads, 0)} of leads created ${inPeriod[period]} have no deal`;
  if (deals && open / deals > STILL_OPEN_SHARE)
    return {
      title: `${noDeal}; ${percent(open / deals, 0)} of the deals are still open`,
    };
  const leak = biggestLeak(rows);
  if (!leak)
    return { title: `${noDeal}; ${percent(won / leads)} of all leads are won` };
  return {
    title: `${noDeal}; ${String(leak.stage)} leaks the most, ${currency(leak.lost_here_usd)} lost`,
    highlight: leak,
  };
}

/** Decay: how much open pipeline is old. Buckets come from the mart (age_bucket). */
export function ageingInsight(buckets: Row[]): Insight {
  const sum = (rows: Row[], k: string) =>
    rows.reduce((a, r) => a + num(r[k]), 0);
  const total = sum(buckets, "open_usd");
  if (!buckets.length || !total)
    return { title: "No open pipeline in this view" };
  const old = buckets.filter((r) => r.age_bucket === "Over 90 days");
  const oldUsd = sum(old, "open_usd");
  const pastDue = sum(buckets, "past_due_usd");
  if (!oldUsd)
    return {
      title: pastDue
        ? `No open deal is older than 90 days; ${currency(pastDue)} is past its close date`
        : "No open deal is older than 90 days or past its close date",
    };
  const late = sum(old, "past_due_usd");
  return {
    title: `${currency(oldUsd)}, ${percent(oldUsd / total, 0)} of open pipeline, is over 90 days old${late ? `; ${currency(late)} of it is past its close date` : ""}`,
  };
}

/** Sales velocity; the first row with segment 'all' is the whole view. */
export function velocityInsight(rows: Row[]): Insight {
  const all = rows.find((r) => r.segment === "all");
  if (!all || num(all.closed_deals) < MIN_SAMPLE)
    return {
      title: `Too few closed deals to measure sales velocity (under ${MIN_SAMPLE})`,
    };
  if (!num(all.velocity_usd_per_day))
    return { title: "No open pipeline to measure velocity on" };
  const headline = `Open pipeline turns into ${currency(all.velocity_usd_per_day)} of won revenue a day`;
  const sized = rows.filter(
    (r) => r.segment !== "all" && num(r.closed_deals) >= MIN_SAMPLE,
  );
  if (sized.length < 2) return { title: headline };
  const best = pickBy(sized, "velocity_usd_per_day", "max")!;
  return {
    title: `${headline}; by segment, ${best.segment === "smb" ? "SMB" : cap(best.segment).toLowerCase()} is highest at ${currency(best.velocity_usd_per_day)}`,
    highlight: best,
  };
}
