import type { Row } from "@/api/useCard";
import { cap, num } from "@/insights/common";
import { count, currency, days, percent } from "@/lib/format";

/**
 * Sales velocity and the four things that drive it, per segment: open deals x average won deal
 * x win rate / sales cycle. A table, because the drivers are in different units; the bar in the
 * last column compares velocity.
 */
export function VelocityTable({
  rows,
  highlight,
}: {
  rows: Row[];
  highlight?: unknown;
}) {
  const max = Math.max(
    1,
    ...rows
      .filter((r) => r.segment !== "all")
      .map((r) => num(r.velocity_usd_per_day)),
  );
  const head = "px-3 py-2 text-right font-medium text-muted-foreground";
  const cell = "px-3 py-3 text-right tabular-nums";
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">
          Sales velocity and its drivers by segment
        </caption>
        <thead>
          <tr className="border-b">
            <th
              scope="col"
              className="px-3 py-2 text-left font-medium text-muted-foreground"
            >
              Segment
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
          {rows.map((r) => {
            const all = r.segment === "all";
            const share = all ? 0 : num(r.velocity_usd_per_day) / max;
            return (
              <tr
                key={String(r.segment)}
                className={
                  all ? "border-b font-medium" : "border-b border-border/60"
                }
              >
                <th scope="row" className="px-3 py-3 text-left font-medium">
                  {all ? "All segments" : cap(r.segment)}
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
                              r.segment === highlight
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
