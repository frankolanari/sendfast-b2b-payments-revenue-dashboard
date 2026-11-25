import {
  AlertTriangle,
  Banknote,
  CircleDollarSign,
  Flag,
  Handshake,
  Rocket,
  Tag,
  UserPlus,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type { CardSlug } from "@/api/cards.generated";
import { useCard, type Row } from "@/api/useCard";
import { BarBreakdown } from "@/charts/BarBreakdown";
import { ChartCard } from "@/charts/ChartCard";
import { DataTable } from "@/charts/DataTable";
import { TrendLine } from "@/charts/TrendLine";
import { FilterBar } from "@/components/FilterBar";
import { cap, num } from "@/insights/common";
import { accountInsight } from "@/insights/risk";
import { count, currency, day, days, month, percent } from "@/lib/format";
import { cardParams, PERIODS, useFilters } from "@/state/filters";

/** The largest customer: the page needs an account to show before one is picked. */
export const DEFAULT_ACCOUNT = "10000006";

const COMPONENTS = [
  { key: "platform_fee", label: "Platform fee", color: "var(--chart-1)" },
  { key: "usage_fee", label: "Usage fee", color: "var(--chart-2)" },
  { key: "fx_margin", label: "FX margin", color: "var(--chart-3)" },
  { key: "true_up", label: "Min-commit true-up", color: "var(--chart-4)" },
];
const EVENT_ICON: Record<string, LucideIcon> = {
  lead: UserPlus,
  deal: Handshake,
  won: Flag,
  lost: XCircle,
  live: Rocket,
  first_payment: Banknote,
  pricing: Tag,
  risk: AlertTriangle,
  churn: XCircle,
};

/** Rows of (month, column, value) -> one row per month with a field per column value. */
const pivot = (rows: Row[], column: string, value: string) => {
  const out = new Map<string, Row>();
  for (const r of rows) {
    const key = String(r.month);
    const row = out.get(key) ?? { month: key };
    row[String(r[column])] = num(r[value]);
    out.set(key, row);
  }
  return [...out.values()];
};

export function AccountPage() {
  const [f, set] = useFilters();
  const id = f.account ?? DEFAULT_ACCOUNT;
  const p = (slug: CardSlug) => cardParams(slug, f, { account_id: id });
  const periodLabel = PERIODS[f.period].label;

  const accounts = useCard("filter_accounts", {});
  const profile = useCard("account_profile", p("account_profile"));
  const timeline = useCard("account_timeline", p("account_timeline"));
  const revenue = useCard("account_revenue", p("account_revenue"));
  const volume = useCard("account_volume", p("account_volume"));
  const health = useCard("account_health", p("account_health"));
  const opps = useCard("account_opportunities", p("account_opportunities"));

  const a = profile.data?.[0];
  const revenueTotal = (revenue.data ?? []).reduce(
    (s, r) => s + num(r.amount_usd),
    0,
  );
  const corridors = [
    ...new Set((volume.data ?? []).map((r) => String(r.corridor))),
  ]
    .sort()
    .slice(0, 8);
  const volumeTotal = (volume.data ?? []).reduce(
    (s, r) => s + num(r.volume_usd),
    0,
  );
  const healthRows: Row[] = health.data ?? [];
  const latest = healthRows[healthRows.length - 1];
  const events: Row[] = timeline.data ?? [];

  const facts: [string, string][] = a
    ? [
        ["Segment", a.segment ? cap(a.segment) : "–"],
        ["Rep", String(a.rep_name ?? "–")],
        ["Lead source", cap(a.lead_source)],
        ["Country", String(a.country ?? "–")],
        ["Industry", String(a.industry ?? "–")],
        ["Won", day(a.won_date)],
        ["Went live", day(a.live_date)],
        [
          "Activation",
          a.activation_days === null || a.activation_days === undefined
            ? "–"
            : days(a.activation_days),
        ],
        [
          "Health",
          a.health_status
            ? cap(String(a.health_status).replace("_", " "))
            : "–",
        ],
        ["Contract end", a.contract_end_date ? day(a.contract_end_date) : "–"],
      ]
    : [];

  return (
    <>
      <FilterBar show={[]} />
      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        <label htmlFor="account-picker" className="text-muted-foreground">
          Account
        </label>
        <select
          id="account-picker"
          value={id}
          onChange={(e) => set({ account: e.target.value })}
          className="h-9 min-w-72 rounded-lg border border-input bg-card px-2 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {!(accounts.data ?? []).some((r) => String(r.account_id) === id) && (
            <option value={id}>{String(a?.name ?? id)}</option>
          )}
          {(accounts.data ?? []).map((r) => (
            <option key={String(r.account_id)} value={String(r.account_id)}>
              {String(r.account_name)}
            </option>
          ))}
        </select>
      </div>

      <section className="mt-4">
        <ChartCard
          name="Account profile"
          insight={accountInsight(a).title}
          note="Who they are and where they stand"
          query={profile}
        >
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {facts.map(([k, v]) => (
              <div key={k} className="rounded-lg border px-3 py-2">
                <dt className="text-xs text-muted-foreground">{k}</dt>
                <dd className="mt-0.5 text-sm font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </ChartCard>
      </section>

      <section className="mt-4">
        <ChartCard
          name="Net revenue"
          insight={
            revenueTotal
              ? `${currency(revenueTotal)} of net revenue, ${periodLabel.toLowerCase()}`
              : "No revenue in this period"
          }
          note="Per month, by component"
          query={revenue}
        >
          <BarBreakdown
            rows={pivot(revenue.data ?? [], "component", "amount_usd")}
            category="month"
            categoryLabel={(v) => month(v)}
            series={COMPONENTS}
            format={(v) => currency(v)}
            ariaLabel="Account net revenue by month and component"
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

      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        <ChartCard
          name="Payment volume"
          insight={
            volumeTotal
              ? `${currency(volumeTotal)} across ${corridors.length} corridor${corridors.length === 1 ? "" : "s"}`
              : "No payments in this period"
          }
          note={`By corridor and month, ${periodLabel.toLowerCase()}`}
          query={volume}
        >
          <TrendLine
            rows={pivot(volume.data ?? [], "corridor", "volume_usd")}
            series={corridors.map((c, i) => ({
              key: c,
              label: c,
              color: `var(--chart-${i + 1})`,
            }))}
            format={(v) => currency(v)}
            ariaLabel="Account payment volume by corridor and month"
            aspectRatio="4 / 3"
          />
          <ul
            className="mt-3 flex flex-wrap gap-4 text-xs text-ink-secondary"
            aria-label="Legend"
          >
            {corridors.map((c, i) => (
              <li key={c} className="flex items-center gap-1.5">
                <span
                  className="size-2.5 rounded-full"
                  style={{ background: `var(--chart-${i + 1})` }}
                />
                {c}
              </li>
            ))}
          </ul>
        </ChartCard>
        <ChartCard
          name="Health score"
          insight={
            latest
              ? `${count(latest.health_score)} out of 100 in ${month(latest.month)}${latest.failure_rate !== null ? `, with ${percent(latest.failure_rate)} of payments failing` : ""}`
              : "No health history in this period"
          }
          note="Falls with payment failures and shrinking volume"
          query={health}
        >
          <TrendLine
            rows={healthRows}
            series={[
              {
                key: "health_score",
                label: "Health score",
                color: "var(--chart-1)",
              },
            ]}
            format={(v) => count(v)}
            ariaLabel="Account health score by month"
            aspectRatio="4 / 3"
          />
        </ChartCard>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        <ChartCard
          name="Timeline"
          insight={
            events.length
              ? `${events.length} events from ${day(events[events.length - 1].event_date)} to ${day(events[0].event_date)}`
              : "No events"
          }
          note="From first lead to today, newest first (all time)"
          query={timeline}
        >
          <ol
            className="max-h-96 space-y-3 overflow-auto pr-2"
            tabIndex={0}
            aria-label="Account events, newest first"
          >
            {events.map((e, i) => {
              const Icon = EVENT_ICON[String(e.event_type)] ?? CircleDollarSign;
              const bad = e.event_type === "risk" || e.event_type === "churn";
              return (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border">
                    <Icon
                      className={`size-3.5 ${bad ? "text-destructive" : "text-ink-secondary"}`}
                      aria-hidden
                    />
                  </span>
                  <span>
                    <span className="block">
                      {String(e.title)}
                      {e.amount_usd !== null &&
                        ` · ${currency(e.amount_usd)}${e.event_type === "pricing" ? " platform fee" : ""}`}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {day(String(e.event_date).slice(0, 10))}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
        </ChartCard>
        <ChartCard
          name="Deals"
          insight={`${count(opps.data?.length ?? 0)} deal${opps.data?.length === 1 ? "" : "s"} with this account`}
          note="Every opportunity, oldest first (all time)"
          query={opps}
        >
          <DataTable
            rows={opps.data ?? []}
            rowKey="opportunity_id"
            caption="Account opportunities"
            columns={[
              { key: "stage" },
              { key: "lead_source" },
              { key: "amount_usd" },
              { key: "created_date" },
              { key: "close_date" },
            ]}
          />
        </ChartCard>
      </section>
    </>
  );
}
