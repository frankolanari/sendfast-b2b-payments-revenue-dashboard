import type { CardSlug } from "@/api/cards.generated";
import { useCard, type Row } from "@/api/useCard";
import { BarBreakdown } from "@/charts/BarBreakdown";
import { ChartCard } from "@/charts/ChartCard";
import { buildOutcomeFlow, GATES } from "@/charts/flows";
import { Funnel } from "@/charts/Funnel";
import { KpiTile } from "@/charts/KpiTile";
import { Sankey } from "@/charts/Sankey";
import { VelocityTable } from "@/charts/VelocityTable";
import { FilterBar } from "@/components/FilterBar";
import { cap, num } from "@/insights/common";
import {
  channelInsight,
  ageingInsight,
  leadFunnelInsight,
  leakNote,
  pipelineByMonthInsight,
  repInsight,
  stageDaysInsight,
  velocityInsight,
  winRateInsight,
} from "@/insights/pipeline";
import { count, currency, days, month, percent } from "@/lib/format";
import {
  cardParams,
  ignoredFilters,
  PERIODS,
  useFilters,
} from "@/state/filters";

const SOURCES = ["inbound", "outbound", "paid", "partner", "unknown"] as const;
const SOURCE_COLOR: Record<string, string> = {
  inbound: "var(--chart-1)",
  outbound: "var(--chart-2)",
  paid: "var(--chart-3)",
  partner: "var(--chart-4)",
  unknown: "var(--chart-5)",
};

export function PipelinePage() {
  const [f] = useFilters();
  const p = (slug: CardSlug) => cardParams(slug, f);
  const skip = (...slugs: CardSlug[]) => ignoredFilters(slugs, f);
  const periodLabel = PERIODS[f.period].label;

  const funnel = useCard("lead_funnel", p("lead_funnel"));
  const ageing = useCard("pipeline_ageing", p("pipeline_ageing"));
  const velocity = useCard("sales_velocity", p("sales_velocity"));
  const gates = useCard("deal_gates", p("deal_gates"));
  const outcomes = useCard(
    "deal_outcomes_by_source",
    p("deal_outcomes_by_source"),
  );
  const winBySource = useCard("win_rate_by_source", p("win_rate_by_source"));
  const byMonth = useCard("pipeline_by_month", p("pipeline_by_month"));
  const reps = useCard("open_pipeline_by_rep", p("open_pipeline_by_rep"));
  const stageDays = useCard("days_in_stage", p("days_in_stage"));

  // Pipeline by month: pivot (month, source) rows into one row per month, keeping deal counts.
  const months = new Map<string, Row>();
  for (const r of byMonth.data ?? []) {
    const m = String(r.month);
    const row = months.get(m) ?? { month: m };
    row[String(r.lead_source)] = num(r.pipeline_created_usd);
    row[`${r.lead_source}__n`] = num(r.opportunities);
    months.set(m, row);
  }
  const monthRows = [...months.values()];

  // Insight titles: computed from the data on screen, with fairness rules (insights/).
  // Ageing: one row per age bucket, split into on schedule and past close date, with reps.
  const ageBuckets = new Map<string, Row>();
  const ageReps = new Map<string, Row[]>();
  for (const r of ageing.data ?? []) {
    const key = String(r.age_bucket);
    const row: Row = ageBuckets.get(key) ?? { age_bucket: key };
    for (const k of ["open_usd", "past_due_usd", "deals", "past_due_deals"])
      row[k] = num(row[k]) + num(r[k]);
    row.on_time_usd = num(row.open_usd) - num(row.past_due_usd);
    ageBuckets.set(key, row);
    ageReps.set(key, [...(ageReps.get(key) ?? []), r]);
  }
  const ageRows = [...ageBuckets.values()];

  const funnelI = leadFunnelInsight(funnel.data ?? [], f.period);
  const ageI = ageingInsight(ageRows);
  const velocityI = velocityInsight(velocity.data ?? []);
  const leads = num(funnel.data?.[0]?.reached);
  const noDeal = leads - num(funnel.data?.[1]?.reached);
  const channelI = channelInsight(outcomes.data ?? [], f.period);
  const winI = winRateInsight(winBySource.data ?? []);
  const monthI = pipelineByMonthInsight(monthRows, SOURCES, f.period);
  const repI = repInsight(reps.data ?? []);
  const stageI = stageDaysInsight(stageDays.data ?? []);
  const flow = buildOutcomeFlow(
    gates.data ?? [],
    SOURCES,
    cap,
    (s) => SOURCE_COLOR[s] ?? "var(--chart-neutral-bar)",
  );

  /** Funnel tooltip for step i: 0 = leads, then each stage (rank i). */
  const funnelDetails = (i: number) => {
    const row = (k: number) => funnel.data?.[k];
    const here = num(row(i)?.reached);
    const name = (k: number) => (k === 0 ? "leads" : String(row(k)?.stage));
    return [
      ...(i > 0 && leads
        ? [{ label: "Share of leads", value: percent(here / leads) }]
        : []),
      ...(i > 0 && num(row(i - 1)?.reached)
        ? [
            {
              label: `Passed from ${name(i - 1)}`,
              value: percent(here / num(row(i - 1)?.reached)),
            },
          ]
        : []),
      ...(i === 0 && leads ? [{ label: "No deal", value: count(noDeal) }] : []),
      ...(i > 0 && i <= GATES.length
        ? [
            {
              label: "Lost at this stage",
              value: `${count(row(i)?.lost_here)} · ${currency(row(i)?.lost_here_usd)}`,
              color: "var(--chart-negative)",
            },
            {
              label: "Still open here",
              value: `${count(row(i)?.open_here)} · ${currency(row(i)?.open_here_usd)}`,
              color: "var(--chart-neutral-bar)",
            },
          ]
        : []),
      ...(i > 0
        ? [
            {
              label: "Value of these deals",
              value: currency(row(i)?.value_usd),
            },
          ]
        : []),
    ];
  };

  return (
    <>
      <FilterBar show={["segment", "lead_source", "owner_id"]} />

      <section className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
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
          ignores={skip("open_pipeline")}
        />
        <KpiTile
          slug="lead_conversion"
          params={p("lead_conversion")}
          label="Leads to opportunity"
          column="conversion_rate"
          format={(v) => percent(v)}
          note={`Leads created, ${periodLabel.toLowerCase()}`}
        />
      </section>

      <section className="mt-4">
        <ChartCard
          title={funnelI.title}
          subtitle={`Leads created, ${periodLabel.toLowerCase()}, followed to their deals. Under each step: what leaked there. Hover a step for more.`}
          query={funnel}
          isEmpty={!leads}
        >
          <Funnel
            rows={funnel.data ?? []}
            stage="stage"
            value="reached"
            unit="leads"
            stageLabel={(v) => (v === "lead" ? "Leads" : cap(v))}
            ariaLabel="Leads followed to won: count reaching each step"
            details={funnelDetails}
          />
          <ul
            className="mt-3 grid grid-cols-6 gap-px"
            aria-label="Leakage at each step"
          >
            {(funnel.data ?? []).map((r, i) => {
              const leak = r.stage === funnelI.highlight?.stage;
              return (
                <li
                  key={String(r.stage)}
                  className={`mx-1 rounded-lg border px-2 py-2 text-center ${leak ? "border-brand-accent bg-foreground/5" : ""}`}
                >
                  {i === 0 ? (
                    <>
                      <div className="font-display text-lg">
                        {count(noDeal)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        no deal
                      </div>
                    </>
                  ) : i <= GATES.length ? (
                    <>
                      <div
                        className={`font-display text-lg ${leak ? "text-brand-accent" : ""}`}
                      >
                        {currency(r.lost_here_usd)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        lost · {count(r.lost_here)} deals
                      </div>
                      <div className="mt-1 text-xs text-ink-secondary">
                        {currency(r.open_here_usd)} still open
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="font-display text-lg">
                        {currency(r.value_usd)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        won · {count(r.reached)} deals
                      </div>
                      <div className="mt-1 text-xs text-ink-secondary">
                        {leads ? percent(num(r.reached) / leads) : "–"} of leads
                      </div>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </ChartCard>
      </section>

      <section className="mt-4">
        <ChartCard
          title={ageI.title}
          subtitle="Open pipeline as of Oct 31, 2026, by how long ago each deal was created"
          query={ageing}
          ignores={skip("pipeline_ageing")}
        >
          <BarBreakdown
            rows={ageRows}
            category="age_bucket"
            series={[
              {
                key: "on_time_usd",
                label: "On schedule",
                color: "var(--chart-neutral-bar)",
              },
              {
                key: "past_due_usd",
                label: "Past close date",
                color: "var(--chart-negative)",
              },
            ]}
            format={(v) => currency(v)}
            ariaLabel="Open pipeline by age, on schedule and past close date"
            aspectRatio="16 / 5"
            details={(r) => [
              { label: "Open deals", value: count(r.deals) },
              {
                label: "Past close date",
                value: `${count(r.past_due_deals)} · ${currency(r.past_due_usd)}`,
                color: "var(--chart-negative)",
              },
              ...(ageReps.get(String(r.age_bucket)) ?? [])
                .slice(0, 3)
                .map((x) => ({
                  label: `${String(x.rep_name)} · ${count(x.deals)}`,
                  value: currency(x.open_usd),
                })),
            ]}
          />
          <ul
            className="mt-3 flex flex-wrap gap-4 text-xs text-ink-secondary"
            aria-label="Legend"
          >
            <li className="flex items-center gap-1.5">
              <span
                className="size-2.5 rounded-full"
                style={{ background: "var(--chart-neutral-bar)" }}
              />
              On schedule
            </li>
            <li className="flex items-center gap-1.5">
              <span
                className="size-2.5 rounded-full"
                style={{ background: "var(--chart-negative)" }}
              />
              Past close date
            </li>
          </ul>
        </ChartCard>
      </section>

      <section className="mt-4">
        <ChartCard
          title={velocityI.title}
          subtitle={`Sales velocity: open deals today × average won deal × win rate ÷ sales cycle. The last three come from deals closed ${periodLabel.toLowerCase()}. Segment figures don't add up to the total.`}
          query={velocity}
        >
          <VelocityTable
            rows={velocity.data ?? []}
            highlight={velocityI.highlight?.segment}
          />
        </ChartCard>
      </section>

      <section className="mt-4">
        <ChartCard
          title={channelI.title}
          subtitle={`Deals created, ${periodLabel.toLowerCase()}, by lead source and where they ended up.${leakNote(gates.data ?? [], channelI.highlight, GATES)}`}
          query={gates}
        >
          <Sankey
            nodes={flow.nodes}
            links={flow.links}
            ariaLabel="Deals by lead source and outcome: won, still open or lost"
            aspectRatio="16 / 6"
          />
          <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {(outcomes.data ?? []).map((r) => (
              <div
                key={String(r.lead_source)}
                className={
                  r.lead_source === channelI.highlight?.lead_source
                    ? "rounded-lg border border-brand-accent/60 bg-foreground/5 px-3 py-2"
                    : "rounded-lg border px-3 py-2"
                }
              >
                <dt className="flex items-center gap-1.5 text-xs text-ink-secondary">
                  <span
                    className="size-2 rounded-full"
                    style={{ background: SOURCE_COLOR[String(r.lead_source)] }}
                  />
                  {cap(r.lead_source)}
                </dt>
                <dd className="mt-1 text-sm">
                  <span className="font-medium">{percent(r.won_share, 0)}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    won of {String(r.deals)}
                  </span>
                </dd>
                <dd className="text-xs text-muted-foreground">
                  {currency(r.open_usd)} still open
                </dd>
              </div>
            ))}
          </dl>
        </ChartCard>
      </section>

      <section className="mt-4">
        <ChartCard
          title={monthI.title}
          subtitle={`Pipeline created per month, by lead source, ${periodLabel.toLowerCase()}`}
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
            details={(r) =>
              [...SOURCES]
                .reverse()
                .filter((s) => num(r[`${s}__n`]) > 0)
                .map((s) => ({
                  color: SOURCE_COLOR[s],
                  label: `${cap(s)} · ${count(r[`${s}__n`])}`,
                  value: currency(r[s]),
                }))
            }
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
          title={winI.title}
          subtitle={`Won / closed deals by lead source, closed ${periodLabel.toLowerCase()}`}
          query={winBySource}
        >
          <BarBreakdown
            rows={winBySource.data ?? []}
            category="lead_source"
            categoryLabel={cap}
            value="win_rate"
            format={(v) => percent(v)}
            highlight={(r) => r.lead_source === winI.highlight?.lead_source}
            ariaLabel="Win rate by lead source"
            details={(r) => [
              {
                label: "Won",
                value: `${count(r.won_opportunities)} of ${count(r.closed_opportunities)} closed`,
              },
              { label: "Value won", value: currency(r.won_usd) },
            ]}
          />
        </ChartCard>
        <ChartCard
          title={stageI.title}
          subtitle={`Median days in each stage, for stages entered ${periodLabel.toLowerCase()}`}
          query={stageDays}
        >
          <BarBreakdown
            rows={stageDays.data ?? []}
            category="stage"
            categoryLabel={cap}
            value="median_days_in_stage"
            format={(v) => days(Math.round(num(v) * 10) / 10)}
            highlight={(r) => r.stage === stageI.highlight?.stage}
            ariaLabel="Median days in stage"
            details={(r) => [
              {
                label: "Stage entries measured",
                value: count(r.stage_entries),
              },
            ]}
          />
        </ChartCard>
      </section>

      <section className="mt-4">
        <ChartCard
          title={repI.title}
          subtitle={`Open pipeline as of Oct 31, 2026${repI.highlight ? "; highlighted: the largest past-due share" : ""}`}
          query={reps}
          ignores={skip("open_pipeline_by_rep")}
        >
          <BarBreakdown
            rows={reps.data ?? []}
            category="rep_name"
            value="open_pipeline_usd"
            format={(v) => currency(v)}
            highlight={(r) => r.owner_id === repI.highlight?.owner_id}
            horizontal
            aspectRatio="16 / 6"
            ariaLabel="Open pipeline by rep"
            details={(r) => [
              { label: "Open deals", value: count(r.deals) },
              {
                label: "Past close date",
                value: `${count(r.past_due_deals)} · ${currency(r.past_due_pipeline_usd)}`,
              },
              { label: "Past-due share", value: percent(r.past_due_share) },
            ]}
          />
        </ChartCard>
      </section>
    </>
  );
}
