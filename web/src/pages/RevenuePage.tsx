import type { CardSlug } from "@/api/cards.generated";
import { useCard, type Row } from "@/api/useCard";
import { BarBreakdown } from "@/charts/BarBreakdown";
import { ChartCard } from "@/charts/ChartCard";
import { CohortHeatmap } from "@/charts/CohortHeatmap";
import { KpiTile } from "@/charts/KpiTile";
import { Waterfall } from "@/charts/Waterfall";
import { FilterBar } from "@/components/FilterBar";
import { cap, num } from "@/insights/common";
import {
  activationInsight,
  bridgeInsight,
  cohortInsight,
  firstYearInsight,
  trendInsight,
} from "@/insights/revenue";
import { calendarWindow } from "@/lib/cohort";
import { bps, count, currency, days, month, percent } from "@/lib/format";
import {
  cardParams,
  ignoredFilters,
  PERIODS,
  useFilters,
} from "@/state/filters";

const COMPONENTS = [
  { key: "platform_fee", label: "Platform fee", color: "var(--chart-1)" },
  { key: "usage_fee", label: "Usage fee", color: "var(--chart-2)" },
  { key: "fx_margin", label: "FX margin", color: "var(--chart-3)" },
  { key: "true_up", label: "Min-commit true-up", color: "var(--chart-4)" },
] as const;
const BRIDGE_LABEL: Record<string, string> = {
  start: "Start",
  new: "New",
  reactivation: "Reactivated",
  expansion: "Expansion",
  contraction: "Contraction",
  churn: "Churn",
  end: "End",
};
const monthTotal = (r: Row) =>
  COMPONENTS.reduce((a, c) => a + num(r[c.key]), 0);

function cohortDetails(r: Row) {
  const m = num(r.months_since_live);
  const quarter = String(r.cohort_quarter);
  return {
    title: `${quarter} · month ${m}`,
    total: `${percent(r.logo_retention, 0)} kept`,
    note: `${calendarWindow(quarter, m)}${m === 0 ? " (go-live month, partial)" : ""}`,
    rows: [
      { label: "Accounts that went live", value: count(r.cohort_accounts) },
      { label: `Still active in month ${m}`, value: count(r.active_accounts) },
      { label: `Revenue in month ${m}`, value: currency(r.net_revenue_usd) },
      {
        label: m === 0 ? "Revenue to date" : `Revenue, months 0–${m}`,
        value: currency(r.revenue_to_date_usd),
      },
      ...(m > 1 && r.nrr !== null
        ? [{ label: "Net revenue retention vs month 1", value: percent(r.nrr) }]
        : []),
    ],
  };
}

export function RevenuePage() {
  const [f] = useFilters();
  const p = (slug: CardSlug) => cardParams(slug, f);
  const skip = (...slugs: CardSlug[]) => ignoredFilters(slugs, f);
  const periodLabel = PERIODS[f.period].label;
  const bridgePeriod = f.period === "all" ? "Last 12 months" : periodLabel;

  const byMonth = useCard("revenue_by_month", p("revenue_by_month"));
  const bridge = useCard("revenue_bridge_period", p("revenue_bridge_period"));
  const cohorts = useCard("cohort_retention_grid", p("cohort_retention_grid"));
  const churn = useCard(
    "churn_by_activation_speed",
    p("churn_by_activation_speed"),
  );
  const activation = useCard("activation_days", p("activation_days"));
  const firstYear = useCard(
    "revenue_first_12m_by_source",
    p("revenue_first_12m_by_source"),
  );

  // Net revenue by month: pivot (month, component), remembering the month before.
  const months = new Map<string, Row>();
  for (const r of byMonth.data ?? []) {
    const m = String(r.month);
    const row = months.get(m) ?? { month: m };
    row[String(r.component)] = num(r.amount_usd);
    months.set(m, row);
  }
  const monthRows: Row[] = [...months.values()];
  monthRows.forEach(
    (r, i) => (r.__prev = i > 0 ? monthTotal(monthRows[i - 1]) : null),
  );

  const trendI = trendInsight(monthRows, COMPONENTS);
  const bridgeI = bridgeInsight(bridge.data ?? [], BRIDGE_LABEL);
  const cohortI = cohortInsight(cohorts.data ?? []);
  const churnI = activationInsight(churn.data ?? []);
  const yearI = firstYearInsight(firstYear.data ?? []);

  return (
    <>
      <FilterBar show={["segment", "lead_source"]} />

      <section className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <KpiTile
          slug="net_revenue"
          params={p("net_revenue")}
          label="Net revenue"
          column="net_revenue_usd"
          format={(v) => currency(v)}
          note={periodLabel}
        />
        <KpiTile
          slug="total_payment_volume"
          params={p("total_payment_volume")}
          label="Payment volume"
          column="total_payment_volume_usd"
          format={(v) => currency(v)}
          note={periodLabel}
        />
        <KpiTile
          slug="take_rate"
          params={p("take_rate")}
          label="Take rate"
          column="take_rate"
          format={(v) => bps(v)}
          note={`Net revenue / payment volume, ${periodLabel.toLowerCase()}`}
        />
        <KpiTile
          slug="platform_mrr"
          params={p("platform_mrr")}
          label="Platform MRR"
          column="platform_mrr_usd"
          format={(v) => currency(v)}
          note={`Month of ${month(p("platform_mrr").date_to ?? "2026-10-31")}`}
        />
        <KpiTile
          slug="nrr"
          params={p("nrr")}
          label="Net revenue retention"
          column="nrr"
          format={(v) => percent(v)}
          note={`${month(p("nrr").date_to ?? "2026-10-31")} vs a year earlier`}
        />
        <KpiTile
          slug="grr"
          params={p("grr")}
          label="Gross revenue retention"
          column="grr"
          format={(v) => percent(v)}
          note="Expansion capped per account"
        />
      </section>

      <section className="mt-4">
        <ChartCard
          title={trendI.title}
          subtitle={`Net revenue per month, by component, ${periodLabel.toLowerCase()}`}
          query={byMonth}
        >
          <BarBreakdown
            rows={monthRows}
            category="month"
            categoryLabel={(v) => month(v)}
            series={COMPONENTS.map((c) => ({
              key: c.key,
              label: c.label,
              color: c.color,
            }))}
            format={(v) => currency(v)}
            ariaLabel="Net revenue by month and component"
            aspectRatio="16 / 5"
            details={(r) => {
              const t = monthTotal(r);
              const prev =
                r.__prev === null || r.__prev === undefined
                  ? null
                  : num(r.__prev);
              return [
                ...[...COMPONENTS]
                  .reverse()
                  .filter((c) => num(r[c.key]) !== 0)
                  .map((c) => ({
                    color: c.color,
                    label: c.label,
                    value: `${currency(r[c.key])} · ${percent(num(r[c.key]) / t, 0)}`,
                  })),
                ...(prev
                  ? [
                      {
                        label: "vs month before",
                        value: `${t >= prev ? "+" : ""}${percent(t / prev - 1)}`,
                      },
                    ]
                  : []),
              ];
            }}
          />
          <ul
            className="mt-3 flex flex-wrap gap-4 text-xs text-ink-secondary"
            aria-label="Legend"
          >
            {COMPONENTS.map((c) => (
              <li key={c.key} className="flex items-center gap-1.5">
                <span
                  className="size-2.5 rounded-full"
                  style={{ background: c.color }}
                />
                {c.label}
              </li>
            ))}
          </ul>
        </ChartCard>
      </section>

      <section className="mt-4">
        <ChartCard
          title={bridgeI.title}
          subtitle={`How monthly net revenue moved, ${bridgePeriod.toLowerCase()}: the month before the period, the moves during it, and its last month${f.period === "all" ? " (the bridge needs a date range: showing the last 12 months)" : ""}`}
          query={bridge}
        >
          <Waterfall
            rows={bridge.data ?? []}
            step="step"
            value="amount_usd"
            label={(s) => BRIDGE_LABEL[s] ?? cap(s)}
            totals={["start", "end"]}
            format={(v) => currency(v)}
            ariaLabel="Revenue bridge: start, new, expansion, contraction, churn, end"
          />
        </ChartCard>
      </section>

      <section className="mt-4">
        <ChartCard
          title={cohortI.title}
          subtitle="Share of each go-live quarter's accounts still active, by months since go-live. Hover a cell for accounts and revenue."
          query={cohorts}
          ignores={skip("cohort_retention_grid")}
        >
          <CohortHeatmap
            rows={cohorts.data ?? []}
            cohort="cohort_quarter"
            period="months_since_live"
            value="logo_retention"
            format={(v) => percent(v, 0)}
            highlight={
              cohortI.highlight
                ? String(cohortI.highlight.cohort_quarter)
                : undefined
            }
            periodLabel={(m) => `M${m}`}
            caption="Logo retention by go-live quarter and months since go-live"
            details={cohortDetails}
          />
        </ChartCard>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        <ChartCard
          title={churnI.title}
          subtitle={`Accounts live in the data window; slow = more than 45 days from won to first payment. Median activation: ${activation.data?.[0]?.activation_days != null ? days(activation.data[0].activation_days) : "–"} for deals won ${periodLabel.toLowerCase()}`}
          query={churn}
          ignores={skip("churn_by_activation_speed")}
        >
          <BarBreakdown
            rows={churn.data ?? []}
            category="activation_speed"
            categoryLabel={(v) =>
              v === "slow"
                ? "Slow starters (> 45 days)"
                : "Fast starters (≤ 45 days)"
            }
            value="churn_rate"
            format={(v) => percent(v)}
            highlight={(r) =>
              r.activation_speed === churnI.highlight?.activation_speed
            }
            ariaLabel="Churn rate by activation speed"
            details={(r) => [
              { label: "Accounts", value: count(r.accounts) },
              { label: "Churned", value: count(r.churned_accounts) },
            ]}
          />
        </ChartCard>
        <ChartCard
          title={yearI.title}
          subtitle="Median net revenue per account in its first 12 months from go-live (accounts with a full first year)"
          query={firstYear}
          ignores={skip("revenue_first_12m_by_source")}
        >
          <BarBreakdown
            rows={firstYear.data ?? []}
            category="lead_source"
            categoryLabel={cap}
            value="median_net_revenue_first_12m_usd"
            format={(v) => currency(v)}
            highlight={(r) => r.lead_source === yearI.highlight?.lead_source}
            ariaLabel="First-year net revenue per account by lead source"
            details={(r) => [
              {
                label: "Accounts with a full first year",
                value: count(r.accounts),
              },
            ]}
          />
        </ChartCard>
      </section>
    </>
  );
}
