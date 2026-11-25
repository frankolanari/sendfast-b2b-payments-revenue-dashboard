import type { Row } from "@/api/useCard";
import { count, percent, toNumber } from "@/lib/format";

/**
 * Rate by two categories (corridor x rail) as a real table: one hue for magnitude, the value
 * written in every cell, and counts on hover or focus. A click filters by the row.
 */
export function RateMatrix({
  rows,
  rowKey,
  colKey,
  caption,
  onSelectRow,
  selected,
}: {
  rows: Row[];
  rowKey: string;
  colKey: string;
  caption: string;
  onSelectRow?: (v: string) => void;
  selected?: string;
}) {
  const ys = [...new Set(rows.map((r) => String(r[rowKey])))].sort();
  const xs = [...new Set(rows.map((r) => String(r[colKey])))].sort();
  const cell = new Map(rows.map((r) => [`${r[rowKey]}|${r[colKey]}`, r]));
  const max = Math.max(
    0.000001,
    ...rows.map((r) => toNumber(r.failure_rate) ?? 0),
  );
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
              Corridor
            </th>
            {xs.map((x) => (
              <th
                key={x}
                scope="col"
                className="px-1 py-1 text-center font-medium uppercase text-muted-foreground"
              >
                {x}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ys.map((y) => (
            <tr key={y}>
              <th
                scope="row"
                className="whitespace-nowrap px-2 py-1 text-left font-medium"
              >
                {onSelectRow ? (
                  <button
                    type="button"
                    aria-pressed={selected === y}
                    onClick={() => onSelectRow(y)}
                    className="underline-offset-4 hover:underline aria-pressed:text-brand-accent"
                  >
                    {y}
                  </button>
                ) : (
                  y
                )}
              </th>
              {xs.map((x) => {
                const r = cell.get(`${y}|${x}`);
                const v = r ? toNumber(r.failure_rate) : null;
                if (!r || v === null)
                  return (
                    <td
                      key={x}
                      className="rounded-sm px-1 py-1.5 text-center text-muted-foreground"
                    >
                      –
                    </td>
                  );
                const share = v / max;
                const detail = `${y} on ${x.toUpperCase()}: ${count(r.failed)} failed of ${count(r.transactions)} payments (${percent(v, 2)})`;
                return (
                  <td
                    key={x}
                    title={detail}
                    aria-label={detail}
                    className={`rounded-sm px-1 py-1.5 text-center ${share > 0.55 ? "text-white" : ""}`}
                    style={{
                      background: `color-mix(in oklab, var(--seq-5) ${Math.round(share * 85)}%, var(--card))`,
                    }}
                  >
                    {percent(v)}
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
