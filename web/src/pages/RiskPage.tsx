import type { CardSlug } from "@/api/cards.generated";
import { useCard, type Row } from "@/api/useCard";
import { BarBreakdown } from "@/charts/BarBreakdown";
import { ChartCard } from "@/charts/ChartCard";
import { DataTable } from "@/charts/DataTable";
import { KpiTile } from "@/charts/KpiTile";
import { RateMatrix } from "@/charts/RateMatrix";
import { StatusBar } from "@/charts/StatusBar";
import { TrendLine } from "@/charts/TrendLine";
import { AccountLink } from "@/components/AccountLink";
import { FilterBar } from "@/components/FilterBar";
import { num } from "@/insights/common";
import {
  atRiskInsight,
  concentrationInsight,
  corridorInsight,
  disputeInsight,
  healthInsight,
  railInsight,
  riskByRepInsight,
} from "@/insights/risk";
import { count, currency, month, percent } from "@/lib/format";
import {
  cardParams,
  ignoredFilters,
  PERIODS,
  useCrossFilter,
  useFilters,
} from "@/state/filters";

export function RiskPage() {
  const [f] = useFilters();
  const cross = useCrossFilter();
  const p = (slug: CardSlug) => cardParams(slug, f);
  const skip = (...slugs: CardSlug[]) => ignoredFilters(slugs, f);
  const periodLabel = PERIODS[f.period].label;
  // Month-based cards fall back to their fixed default month (Oct 2026) on "All time".
  const asOfMonth = month(p("health_mix").date_to ?? "2026-10-31");
  const snapshot = `Status in ${asOfMonth} (the period's last month)`;

  const atRisk = useCard("accounts_at_risk", p("accounts_at_risk"));
  const health = useCard("health_mix", p("health_mix"));
  const byRep = useCard("revenue_at_risk_by_rep", p("revenue_at_risk_by_rep"));
  const corridors = useCard(
    "failure_rate_by_corridor",
    p("failure_rate_by_corridor"),
  );
  const rails = useCard("corridor_rail_failures", p("corridor_rail_failures"));
  const top = useCard("top_accounts", p("top_accounts"));
  const concentration = useCard(
    "top10_concentration",
    p("top10_concentration"),
  );
  const disputes = useCard("dispute_rate_by_month", p("dispute_rate_by_month"));

  const atRiskI = atRiskInsight(atRisk.data ?? []);
  const healthI = healthInsight(health.data ?? []);
  const repI = riskByRepInsight(byRep.data ?? []);
  const corridorI = corridorInsight(corridors.data ?? []);
  const railI = railInsight(rails.data ?? []);
  const topI = concentrationInsight(
    top.data ?? [],
    concentration.data?.[0]?.top10_share,
  );
  const disputeI = disputeInsight(disputes.data ?? []);

  // Failure lines: one value per corridor per month. One corridor is drawn in the accent (the
  // filtered one, or the one with the spike); the others stay grey context.
  const months = new Map<string, Row>();
  for (const r of corridors.data ?? []) {
    const key = String(r.month);
    const row = months.get(key) ?? { month: key };
    row[String(r.corridor)] = num(r.failure_rate);
    months.set(key, row);
  }
  const focus = f.corridor ?? corridorI.corridor;
  const names = [
    ...new Set((corridors.data ?? []).map((r) => String(r.corridor))),
  ].sort((a, b) => Number(a === focus) - Number(b === focus));
  const series = names.map((c) => ({
    key: c,
    label: c,
    color: c === focus ? "var(--brand-accent)" : "var(--chart-neutral-bar)",
  }));

  return (
    <>
      <FilterBar show={["segment", "corridor", "owner_id"]} />

      <section className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <KpiTile
          slug="revenue_at_risk"
          params={p("revenue_at_risk")}
          label="Revenue at risk"
          column="revenue_at_risk_usd"
          format={(v) => currency(v)}
          note={`Monthly, ${asOfMonth}`}
          ignores={skip("revenue_at_risk")}
        />
        <KpiTile
          slug="health_mix"
          params={p("health_mix")}
          label="Accounts at risk"
          column="accounts"
          pick={(rows) =>
            num(rows.find((r) => r.health_status === "at_risk")?.accounts)
          }
          format={(v) => count(v)}
          note={`In ${asOfMonth}`}
          ignores={skip("health_mix")}
        />
        <KpiTile
          slug="failure_rate"
          params={p("failure_rate")}
          label="Failure rate"
          column="failure_rate"
          format={(v) => percent(v, 2)}
          note={periodLabel}
        />
        <KpiTile
          slug="dispute_return_rate"
          params={p("dispute_return_rate")}
          label="Disputes and returns"
          column="dispute_return_rate"
          format={(v) => percent(v, 2)}
          note={periodLabel}
        />
        <KpiTile
          slug="top10_concentration"
          params={p("top10_concentration")}
          label="Top-10 revenue share"
          column="top10_share"
          format={(v) => percent(v)}
          note={periodLabel}
          ignores={skip("top10_concentration")}
        />
      </section>

      <section className="mt-4">
        <ChartCard
          name="At-risk accounts"
          insight={atRiskI.title}
          note={`${snapshot}: payment volume under half its 3-month average, or failures above 10%. Open an account to see its story.`}
          query={atRisk}
          ignores={skip("accounts_at_risk")}
        >
          <DataTable
            rows={atRisk.data ?? []}
            rowKey="account_id"
            caption="Accounts at risk"
            columns={[
              {
                key: "account_name",
                label: "Account",
                render: (r) => (
                  <AccountLink id={r.account_id} name={r.account_name} />
                ),
              },
              { key: "segment" },
              { key: "rep_name", label: "Rep" },
              { key: "risk_reason", label: "Why" },
              { key: "volume_trend", label: "Volume vs 3-month avg" },
              { key: "failure_rate" },
              { key: "revenue_at_risk_usd" },
            ]}
          />
        </ChartCard>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        <ChartCard
          name="Account health"
          insight={healthI.title}
          note={snapshot}
          query={health}
          ignores={skip("health_mix")}
        >
          <StatusBar rows={health.data ?? []} />
        </ChartCard>
        <ChartCard
          name="Revenue at risk by rep"
          insight={repI.title}
          note={`${snapshot}. Click a bar to filter by rep.`}
          query={byRep}
          ignores={skip("revenue_at_risk_by_rep")}
        >
          <BarBreakdown
            rows={byRep.data ?? []}
            category="rep_name"
            value="revenue_at_risk_usd"
            format={(v) => currency(v)}
            highlight={(r) => r.owner_id === repI.highlight?.owner_id}
            horizontal
            aspectRatio="2 / 1"
            ariaLabel="Revenue at risk by rep"
            onSelect={(r) => cross("owner_id", r.owner_id)}
            details={(r) => [
              { label: "Accounts at risk", value: count(r.accounts) },
            ]}
          />
        </ChartCard>
      </section>

      <section className="mt-4">
        <ChartCard
          name="Failure rate by corridor"
          insight={corridorI.title}
          note={`Failed share of all payments per month, ${periodLabel.toLowerCase()}. ${focus ? `${focus} in orange; ` : ""}hover for the others, click to filter.`}
          query={corridors}
        >
          <TrendLine
            rows={[...months.values()]}
            series={series}
            format={(v) => percent(v)}
            ariaLabel="Failure rate by corridor and month"
            onSelect={(c) => cross("corridor", c)}
          />
        </ChartCard>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        <ChartCard
          name="Corridor and rail failures"
          insight={railI.title}
          note={`Failure rate for each corridor on each payment rail, ${periodLabel.toLowerCase()}. Click a corridor to filter.`}
          query={rails}
        >
          <RateMatrix
            rows={rails.data ?? []}
            rowKey="corridor"
            colKey="rail"
            caption="Failure rate by corridor and rail"
            selected={f.corridor}
            onSelectRow={(c) => cross("corridor", c)}
          />
        </ChartCard>
        <ChartCard
          name="Revenue concentration"
          insight={topI.title}
          note={`Top 10 accounts by net revenue, ${periodLabel.toLowerCase()}`}
          query={top}
          ignores={skip("top_accounts")}
        >
          <ol className="space-y-1.5">
            {(top.data ?? []).map((r, i) => (
              <li
                key={String(r.account_id)}
                className="flex items-center gap-3 text-sm"
              >
                <span className="w-44 overflow-hidden text-ellipsis whitespace-nowrap">
                  <AccountLink id={r.account_id} name={r.account_name} />
                </span>
                <span
                  className="h-2.5 flex-1 overflow-hidden rounded-full bg-foreground/10"
                  aria-hidden
                >
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: `${(num(r.net_revenue_usd) / Math.max(1, num(top.data?.[0]?.net_revenue_usd))) * 100}%`,
                      background:
                        i === 0
                          ? "var(--brand-accent)"
                          : "var(--chart-neutral-bar)",
                    }}
                  />
                </span>
                <span className="w-16 text-right tabular-nums">
                  {currency(r.net_revenue_usd)}
                </span>
                <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">
                  {percent(r.share_of_net_revenue, 0)}
                </span>
              </li>
            ))}
          </ol>
        </ChartCard>
      </section>

      <section className="mt-4">
        <ChartCard
          name="Disputes and returns"
          insight={disputeI.title}
          note={`Disputes and returns opened each month, ${periodLabel.toLowerCase()}`}
          query={disputes}
        >
          <BarBreakdown
            rows={disputes.data ?? []}
            category="month"
            categoryLabel={(v) => month(v)}
            series={[
              { key: "disputes", label: "Disputes", color: "var(--chart-1)" },
              { key: "returns", label: "Returns", color: "var(--chart-2)" },
            ]}
            format={(v) => count(v)}
            ariaLabel="Disputes and returns by month"
            aspectRatio="16 / 5"
            details={(r) => [
              {
                color: "var(--chart-2)",
                label: "Returns",
                value: count(r.returns),
              },
              {
                color: "var(--chart-1)",
                label: "Disputes",
                value: count(r.disputes),
              },
              {
                label: "Share of succeeded payments",
                value: percent(r.dispute_return_rate, 2),
              },
            ]}
          />
          <ul
            className="mt-3 flex gap-4 text-xs text-ink-secondary"
            aria-label="Legend"
          >
            <li className="flex items-center gap-1.5">
              <span
                className="size-2.5 rounded-full"
                style={{ background: "var(--chart-1)" }}
              />
              Disputes
            </li>
            <li className="flex items-center gap-1.5">
              <span
                className="size-2.5 rounded-full"
                style={{ background: "var(--chart-2)" }}
              />
              Returns
            </li>
          </ul>
        </ChartCard>
      </section>
    </>
  );
}
