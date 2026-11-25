import { useCard, type Row } from "@/api/useCard";
import { BarBreakdown } from "@/charts/BarBreakdown";
import { ChartCard } from "@/charts/ChartCard";
import { CohortHeatmap } from "@/charts/CohortHeatmap";
import { KpiTile } from "@/charts/KpiTile";
import { Waterfall } from "@/charts/Waterfall";
import { FilterBar } from "@/components/FilterBar";
import { bps, currency, days, month, percent, toNumber } from "@/lib/format";
import { cardParams, PERIODS, useFilters } from "@/state/filters";

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
const cap = (v: unknown) => {
  const s = String(v ?? "");
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const num = (v: unknown) => toNumber(v) ?? 0;
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length
    ? s.length % 2
      ? s[(s.length - 1) / 2]
      : (s[s.length / 2 - 1] + s[s.length / 2]) / 2
    : 0;
};

export function RevenuePage() {
  const [f] = useFilters();
  const p = (slug: Parameters<typeof cardParams>[0]) => cardParams(slug, f);
  const periodLabel = PERIODS[f.period].label;
  const bridgePeriod = f.period === "all" ? "Last 12 months" : periodLabel;

  const byMonth = useCard("revenue_by_month", p("revenue_by_month"));
  const bridge = useCard("revenue_bridge_period", p("revenue_bridge_period"));
  const cohorts = useCard("cohort_retention_grid", {});
  const churn = useCard(
    "churn_by_activation_speed",
    p("churn_by_activation_speed"),
  );
  const activation = useCard("activation_days", p("activation_days"));
  const firstYear = useCard(
    "revenue_first_12m_by_source",
    p("revenue_first_12m_by_source"),
  );

  // Net revenue by month: pivot (month, component) into one row per month.
  const months = new Map<string, Row>();
  for (const r of byMonth.data ?? []) {
    const m = String(r.month);
    const row = months.get(m) ?? { month: m };
    row[String(r.component)] = num(r.amount_usd);
    months.set(m, row);
  }
  const monthRows = [...months.values()];
  const monthTotal = (r: Row | undefined) =>
    r ? COMPONENTS.reduce((a, c) => a + num(r[c.key]), 0) : 0;
  const first = monthTotal(monthRows[0]);
  const last = monthTotal(monthRows[monthRows.length - 1]);
  const trendTitle =
    monthRows.length > 1 && first > 0
      ? `Net revenue ${last >= first ? "up" : "down"} ${percent(Math.abs(last / first - 1), 0)} to ${currency(last)} a month`
      : "Net revenue by month";

  // Bridge: the biggest gain and the biggest loss.
  const moves = (bridge.data ?? []).filter(
    (r) => r.step !== "start" && r.step !== "end",
  );
  const gain = moves.reduce<Row | undefined>(
    (b, r) => (num(r.amount_usd) > num(b?.amount_usd) ? r : b),
    undefined,
  );
  const loss = moves.reduce<Row | undefined>(
    (b, r) => (num(r.amount_usd) < num(b?.amount_usd ?? 0) ? r : b),
    undefined,
  );
  const bridgeTitle =
    gain && loss
      ? `${BRIDGE_LABEL[String(gain.step)]} added ${currency(gain.amount_usd)}; ${BRIDGE_LABEL[String(loss.step)].toLowerCase()} took back ${currency(-num(loss.amount_usd))}`
      : "Revenue bridge";

  // Cohorts: the quarter with the weakest logo retention at month 12, against the others.
  const m12 = (cohorts.data ?? []).filter(
    (r) => num(r.months_since_live) === 12,
  );
  const weakest = m12.reduce<Row | undefined>(
    (b, r) => (!b || num(r.logo_retention) < num(b.logo_retention) ? r : b),
    undefined,
  );
  const others = median(
    m12.filter((r) => r !== weakest).map((r) => num(r.logo_retention)),
  );
  const cohortTitle = weakest
    ? `Accounts live in ${String(weakest.cohort_quarter)} keep ${percent(weakest.logo_retention, 0)} of logos at month 12, vs ${percent(others, 0)} for other quarters`
    : "Logo retention by go-live quarter";

  // Activation: slow starters vs fast starters.
  const slow = churn.data?.find((r) => r.activation_speed === "slow");
  const fast = churn.data?.find((r) => r.activation_speed === "fast");
  const churnTitle =
    slow && fast && num(fast.churn_rate) > 0
      ? `Slow starters churn at ${percent(slow.churn_rate, 0)}, ${(num(slow.churn_rate) / num(fast.churn_rate)).toFixed(1)}× fast starters`
      : "Churn by activation speed";

  // First-year revenue: the best real source against the median of the others.
  const known = (firstYear.data ?? []).filter(
    (r) => r.lead_source !== "unknown",
  );
  const best = known.reduce<Row | undefined>(
    (b, r) =>
      num(r.median_net_revenue_first_12m_usd) >
      num(b?.median_net_revenue_first_12m_usd)
        ? r
        : b,
    undefined,
  );
  const rest = median(
    known
      .filter((r) => r !== best)
      .map((r) => num(r.median_net_revenue_first_12m_usd)),
  );
  const yearTitle =
    best && rest > 0
      ? `${cap(best.lead_source)} accounts earn ${currency(best.median_net_revenue_first_12m_usd)} in their first year, ${(num(best.median_net_revenue_first_12m_usd) / rest).toFixed(1)}× other sources`
      : "First-year net revenue per account by lead source";

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
          note="Net revenue / payment volume"
        />
        <KpiTile
          slug="platform_mrr"
          params={p("platform_mrr")}
          label="Platform MRR"
          column="platform_mrr_usd"
          format={(v) => currency(v)}
          note="Month of the period's end"
        />
        <KpiTile
          slug="nrr"
          params={p("nrr")}
          label="Net revenue retention"
          column="nrr"
          format={(v) => percent(v)}
          note="Same month, a year earlier"
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
          title={trendTitle}
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
          title={bridgeTitle}
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
          title={cohortTitle}
          subtitle="Share of each go-live quarter's accounts still active, by months since go-live (fixed cohorts: the period filter doesn't apply)"
          query={cohorts}
        >
          <CohortHeatmap
            rows={cohorts.data ?? []}
            cohort="cohort_quarter"
            period="months_since_live"
            value="logo_retention"
            format={(v) => percent(v, 0)}
            highlight={weakest ? String(weakest.cohort_quarter) : undefined}
            periodLabel={(m) => `M${m}`}
            caption="Logo retention by go-live quarter and months since go-live"
          />
        </ChartCard>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        <ChartCard
          title={churnTitle}
          subtitle={`Accounts live in the data window; slow = more than 45 days from won to first payment. Median activation: ${activation.data ? days(activation.data[0]?.activation_days) : "…"} for deals won ${periodLabel.toLowerCase()}`}
          query={churn}
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
            highlight={(r) => r.activation_speed === "slow"}
            ariaLabel="Churn rate by activation speed"
          />
        </ChartCard>
        <ChartCard
          title={yearTitle}
          subtitle="Median net revenue per account in its first 12 months from go-live (accounts with a full first year)"
          query={firstYear}
        >
          <BarBreakdown
            rows={firstYear.data ?? []}
            category="lead_source"
            categoryLabel={cap}
            value="median_net_revenue_first_12m_usd"
            format={(v) => currency(v)}
            highlight={(r) => r === best}
            ariaLabel="First-year net revenue per account by lead source"
          />
        </ChartCard>
      </section>
    </>
  );
}
