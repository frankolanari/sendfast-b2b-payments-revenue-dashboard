import { useCard, type Row } from "@/api/useCard";
import { BarBreakdown } from "@/charts/BarBreakdown";
import { ChartCard } from "@/charts/ChartCard";
import { Funnel } from "@/charts/Funnel";
import { KpiTile } from "@/charts/KpiTile";
import { FilterBar } from "@/components/FilterBar";
import { currency, days, month, percent, toNumber } from "@/lib/format";
import { cardParams, PERIODS, useFilters } from "@/state/filters";

const SOURCES = ["inbound", "outbound", "paid", "partner", "unknown"] as const;
const SOURCE_COLOR: Record<string, string> = {
  inbound: "var(--chart-1)",
  outbound: "var(--chart-2)",
  paid: "var(--chart-3)",
  partner: "var(--chart-4)",
  unknown: "var(--chart-5)",
};
const cap = (v: unknown) => {
  const s = String(v ?? "");
  return s === "mid_market"
    ? "Mid-market"
    : s.charAt(0).toUpperCase() + s.slice(1);
};
// Insights compare real sources only: "unknown" is a missing CRM value, not a source.
const known = (rows: Row[] | undefined) =>
  (rows ?? []).filter((r) => r.lead_source !== "unknown");
const by = (rows: Row[] | undefined, key: string, pick: "min" | "max") =>
  (rows ?? []).reduce<Row | undefined>((best, r) => {
    const v = toNumber(r[key]);
    if (v === null) return best;
    const b = best ? toNumber(best[key]) : null;
    return b === null || (pick === "max" ? v > b : v < b) ? r : best;
  }, undefined);

export function PipelinePage() {
  const [f] = useFilters();
  const p = (slug: Parameters<typeof cardParams>[0]) => cardParams(slug, f);
  const periodLabel = PERIODS[f.period].label;

  const funnel = useCard("stage_funnel", p("stage_funnel"));
  const winBySource = useCard("win_rate_by_source", p("win_rate_by_source"));
  const byMonth = useCard("pipeline_by_month", p("pipeline_by_month"));
  const reps = useCard("open_pipeline_by_rep", p("open_pipeline_by_rep"));
  const stageDays = useCard("days_in_stage", p("days_in_stage"));
  const conversion = useCard(
    "lead_conversion_by_source",
    p("lead_conversion_by_source"),
  );

  // Insight titles, computed from the data on screen, so they stay true under any filter.
  const top = funnel.data?.[0];
  const won = funnel.data?.find((r) => r.stage === "won");
  const funnelTitle =
    top && won && toNumber(top.opportunities)
      ? `${percent(toNumber(won.opportunities)! / toNumber(top.opportunities)!)} of deals created reach won`
      : "Deals by furthest stage reached";
  const lowestWin = by(known(winBySource.data), "win_rate", "min");
  const winTitle =
    lowestWin && known(winBySource.data).length > 1
      ? `${cap(lowestWin.lead_source)} leads close at ${percent(lowestWin.win_rate)}, the lowest of any source`
      : "Win rate by lead source";
  const slipping = by(reps.data, "past_due_share", "max");
  const repTitle = slipping
    ? `${slipping.rep_name}: ${percent(slipping.past_due_share, 0)} of open pipeline is past its close date`
    : "Open pipeline by rep";
  const slowest = by(stageDays.data, "median_days_in_stage", "max");
  const stageTitle = slowest
    ? `Deals wait longest in ${cap(slowest.stage).toLowerCase()}: ${days(slowest.median_days_in_stage)} at the median`
    : "Median days in stage";
  const bestConv = by(known(conversion.data), "conversion_rate", "max");
  const convTitle =
    bestConv && known(conversion.data).length > 1
      ? `${cap(bestConv.lead_source)} leads convert best: ${percent(bestConv.conversion_rate)} become opportunities`
      : "Lead conversion by source";

  // Pipeline by month: pivot (month, source) rows into one row per month.
  const months = new Map<string, Row>();
  for (const r of byMonth.data ?? []) {
    const m = String(r.month);
    const row = months.get(m) ?? { month: m };
    row[String(r.lead_source)] = toNumber(r.pipeline_created_usd) ?? 0;
    months.set(m, row);
  }
  const monthRows = [...months.values()];
  const totals = SOURCES.map(
    (s) =>
      [s, monthRows.reduce((a, r) => a + (toNumber(r[s]) ?? 0), 0)] as const,
  );
  const lead = totals.reduce((a, b) => (b[1] > a[1] ? b : a), totals[0]);
  const monthTitle =
    monthRows.length && lead[1] > 0
      ? `${cap(lead[0])} brings the most new pipeline: ${currency(lead[1])}`
      : "Pipeline created by month";

  return (
    <>
      <FilterBar show={["segment", "lead_source", "owner_id"]} />

      <section className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiTile
          slug="pipeline_created"
          params={p("pipeline_created")}
          label="Pipeline created"
          column="pipeline_created_usd"
          format={(v) => currency(v)}
          note={periodLabel}
        />
        <KpiTile
          slug="win_rate"
          params={p("win_rate")}
          label="Win rate"
          column="win_rate"
          format={(v) => percent(v)}
          note={`Deals closed, ${periodLabel.toLowerCase()}`}
        />
        <KpiTile
          slug="sales_cycle"
          params={p("sales_cycle")}
          label="Sales cycle"
          column="sales_cycle_days"
          format={(v) => days(v)}
          note="Median, won deals"
        />
        <KpiTile
          slug="open_pipeline"
          params={p("open_pipeline")}
          label="Open pipeline"
          column="open_pipeline_usd"
          format={(v) => currency(v)}
          note="As of Oct 31, 2026"
        />
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        <ChartCard
          title={funnelTitle}
          subtitle={`Deals created, ${periodLabel.toLowerCase()}, by the furthest stage they reached`}
          query={funnel}
        >
          <Funnel
            rows={funnel.data ?? []}
            stage="stage"
            value="opportunities"
            stageLabel={cap}
            ariaLabel="Deals by furthest stage reached"
          />
        </ChartCard>
        <ChartCard
          title={winTitle}
          subtitle="Won / closed deals by lead source"
          query={winBySource}
        >
          <BarBreakdown
            rows={winBySource.data ?? []}
            category="lead_source"
            categoryLabel={cap}
            value="win_rate"
            format={(v) => percent(v)}
            highlight={(r) => r === lowestWin}
            ariaLabel="Win rate by lead source"
          />
        </ChartCard>
      </section>

      <section className="mt-4">
        <ChartCard
          title={monthTitle}
          subtitle="Pipeline created per month, by lead source"
          query={byMonth}
        >
          <BarBreakdown
            rows={monthRows}
            category="month"
            categoryLabel={(v) => month(v)}
            series={SOURCES.map((s) => ({
              key: s,
              label: cap(s),
              color: SOURCE_COLOR[s],
            }))}
            format={(v) => currency(v)}
            ariaLabel="Pipeline created by month and lead source"
            aspectRatio="16 / 5"
          />
          <ul
            className="mt-3 flex flex-wrap gap-4 text-xs text-ink-secondary"
            aria-label="Legend"
          >
            {SOURCES.map((s) => (
              <li key={s} className="flex items-center gap-1.5">
                <span
                  className="size-2.5 rounded-full"
                  style={{ background: SOURCE_COLOR[s] }}
                />
                {cap(s)}
              </li>
            ))}
          </ul>
        </ChartCard>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        <ChartCard
          title={repTitle}
          subtitle="Open pipeline as of Oct 31, 2026; highlighted: the largest past-due share"
          query={reps}
        >
          <BarBreakdown
            rows={reps.data ?? []}
            category="rep_name"
            value="open_pipeline_usd"
            format={(v) => currency(v)}
            highlight={(r) => r === slipping}
            horizontal
            aspectRatio="4 / 3"
            ariaLabel="Open pipeline by rep"
          />
        </ChartCard>
        <ChartCard
          title={stageTitle}
          subtitle="Median days in each stage, for stage entries in the period"
          query={stageDays}
        >
          <BarBreakdown
            rows={stageDays.data ?? []}
            category="stage"
            categoryLabel={cap}
            value="median_days_in_stage"
            format={(v) => days(v)}
            highlight={(r) => r === slowest}
            ariaLabel="Median days in stage"
          />
        </ChartCard>
      </section>

      <section className="mt-4">
        <ChartCard
          title={convTitle}
          subtitle="Share of leads created in the period that became an opportunity"
          query={conversion}
        >
          <BarBreakdown
            rows={conversion.data ?? []}
            category="lead_source"
            categoryLabel={cap}
            value="conversion_rate"
            format={(v) => percent(v)}
            highlight={(r) => r === bestConv}
            ariaLabel="Lead conversion by source"
            aspectRatio="16 / 4"
          />
        </ChartCard>
      </section>
    </>
  );
}
