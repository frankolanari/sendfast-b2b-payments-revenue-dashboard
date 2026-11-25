import type { Row } from "@/api/useCard";
import { toNumber } from "@/lib/format";

/**
 * Cohort x period heatmap as a real table (screen readers get rows, columns and values).
 * Magnitude is one hue: each cell mixes from the card colour toward a deep blue by its value,
 * so it works in light and dark mode; text flips to white on the strong end. One row can be
 * highlighted (the insight) with the accent.
 */
export function CohortHeatmap({
  rows,
  cohort,
  period,
  value,
  format,
  caption,
  highlight,
  periodLabel = (p) => String(p),
}: {
  rows: Row[];
  cohort: string;
  period: string;
  value: string;
  format: (v: unknown) => string;
  caption: string;
  highlight?: string;
  periodLabel?: (p: number) => string;
}) {
  const cohorts = [...new Set(rows.map((r) => String(r[cohort])))].sort();
  const periods = [...new Set(rows.map((r) => toNumber(r[period]) ?? 0))].sort(
    (a, b) => a - b,
  );
  const cell = new Map(
    rows.map((r) => [
      `${r[cohort]}|${toNumber(r[period])}`,
      toNumber(r[value]),
    ]),
  );
  const max = Math.max(1, ...rows.map((r) => toNumber(r[value]) ?? 0));

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-0.5 text-xs tabular-nums">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th
              scope="col"
              className="px-2 py-1 text-left font-medium text-muted-foreground"
            >
              Go-live
            </th>
            {periods.map((p) => (
              <th
                key={p}
                scope="col"
                className="px-1 py-1 text-center font-medium text-muted-foreground"
              >
                {periodLabel(p)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cohorts.map((c) => (
            <tr
              key={c}
              className={
                c === highlight
                  ? "outline outline-2 -outline-offset-1 outline-brand-accent rounded"
                  : undefined
              }
            >
              <th
                scope="row"
                className="whitespace-nowrap px-2 py-1 text-left font-medium"
              >
                {c}
              </th>
              {periods.map((p) => {
                const v = cell.get(`${c}|${p}`);
                const share =
                  v === null || v === undefined
                    ? null
                    : Math.max(0, Math.min(1, v / max));
                return (
                  <td
                    key={p}
                    className={
                      share !== null && share > 0.55
                        ? "rounded-sm px-1 py-1.5 text-center text-white"
                        : "rounded-sm px-1 py-1.5 text-center"
                    }
                    style={
                      share === null
                        ? undefined
                        : {
                            background: `color-mix(in oklab, var(--seq-5) ${Math.round(share * 85)}%, var(--card))`,
                          }
                    }
                  >
                    {share === null ? "" : format(v)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
