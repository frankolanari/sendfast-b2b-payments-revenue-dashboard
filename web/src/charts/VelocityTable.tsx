import type { Row } from "@/api/useCard";
import { MIN_SAMPLE, num } from "@/insights/common";
import { count, currency, days, percent } from "@/lib/format";

/**
 * Sales velocity and the four things that drive it, per group: open deals x average won deal x
 * win rate / sales cycle. A table, because the drivers are in different units; the bar in the
 * last column compares velocity. Groups with too few closed deals are dimmed, not ranked.
 */
export function VelocityTable({
  total,
  rows,
  groupLabel,
  highlight,
}: {
  total?: Row;
  rows: Row[];
  groupLabel: string;
  highlight?: unknown;
}) {
  const ranked = (r: Row) => num(r.closed_deals) >= MIN_SAMPLE;
  const sorted = [...rows].sort(
    (a, b) =>
      Number(ranked(b)) - Number(ranked(a)) ||
      num(b.velocity_usd_per_day) - num(a.velocity_usd_per_day),
  );
  const max = Math.max(
    1,
    ...sorted.filter(ranked).map((r) => num(r.velocity_usd_per_day)),
  );
  const head = "px-3 py-2 text-right font-medium text-muted-foreground";
  const cell = "px-3 py-3 text-right tabular-nums";
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">
          Sales velocity and its drivers by {groupLabel.toLowerCase()}
        </caption>
        <thead>
          <tr className="border-b">
            <th
              scope="col"
              className="px-3 py-2 text-left font-medium text-muted-foreground"
            >
              {groupLabel}
            </th>
            <th scope="col" className={head}>
              Open deals
            </th>
            <th scope="col" className={head}>
              × Avg won deal
            </th>
            <th scope="col" className={head}>
              × Win rate
            </th>
            <th scope="col" className={head}>
              ÷ Sales cycle
            </th>
            <th scope="col" className={head}>
              = Won revenue per day
            </th>
          </tr>
        </thead>
        <tbody>
          {[...(total ? [total] : []), ...sorted].map((r) => {
            const all = r === total;
            const small = !all && !ranked(r);
            const share = all || small ? 0 : num(r.velocity_usd_per_day) / max;
            return (
              <tr
                key={all ? "__all" : String(r.grp)}
                className={
                  all
                    ? "border-b font-medium"
                    : `border-b border-border/60 ${small ? "text-muted-foreground" : ""}`
                }
              >
                <th scope="row" className="px-3 py-3 text-left font-medium">
                  {all ? "All" : String(r.label)}
                  {small && (
                    <span className="ml-2 text-xs font-normal">
                      too few to rank
                    </span>
                  )}
                </th>
                <td className={cell}>{count(r.open_deals)}</td>
                <td className={cell}>{currency(r.avg_won_usd)}</td>
                <td
                  className={cell}
                  title={`${count(r.won_deals)} won of ${count(r.closed_deals)} closed`}
                >
                  {percent(r.win_rate)}
                  <span className="ml-1 text-xs text-muted-foreground">
                    of {count(r.closed_deals)}
                  </span>
                </td>
                <td className={cell}>
                  {r.cycle_days === null
                    ? "–"
                    : days(Math.round(num(r.cycle_days) * 10) / 10)}
                </td>
                <td className={cell}>
                  <span className="flex items-center justify-end gap-3">
                    {!all && (
                      <span
                        aria-hidden
                        className="hidden h-2 w-28 overflow-hidden rounded-full bg-foreground/10 sm:block"
                      >
                        <span
                          className="block h-full rounded-full"
                          style={{
                            width: `${share * 100}%`,
                            background:
                              r.grp === highlight
                                ? "var(--brand-accent)"
                                : "var(--chart-neutral-bar)",
                          }}
                        />
                      </span>
                    )}
                    <span className="w-20 font-display text-lg [font-variant-numeric:normal]">
                      {currency(r.velocity_usd_per_day)}
                    </span>
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
