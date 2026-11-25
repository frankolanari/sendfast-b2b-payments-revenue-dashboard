import { useRef, useState, type KeyboardEvent } from "react";
import type { Row } from "@/api/useCard";
import { toNumber } from "@/lib/format";
import { TooltipBody, type TooltipRow } from "./TooltipBody";

interface Active {
  cohort: string;
  period: number;
  x: number;
  y: number;
  alignRight: boolean;
}

/**
 * Cohort x period heatmap as a real table (screen readers get rows, columns and values).
 * Magnitude is one hue, so it works in light and dark mode. Hovering or focusing a cell shows
 * its details; click pins it; arrow keys move between cells; Escape closes.
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
  details,
}: {
  rows: Row[];
  cohort: string;
  period: string;
  value: string;
  format: (v: unknown) => string;
  caption: string;
  highlight?: string;
  periodLabel?: (p: number) => string;
  details: (row: Row) => {
    title: string;
    total: string;
    note: string;
    rows: TooltipRow[];
  };
}) {
  const cohorts = [...new Set(rows.map((r) => String(r[cohort])))].sort();
  const periods = [...new Set(rows.map((r) => toNumber(r[period]) ?? 0))].sort(
    (a, b) => a - b,
  );
  const cells = new Map(
    rows.map((r) => [`${r[cohort]}|${toNumber(r[period])}`, r]),
  );
  const max = Math.max(1, ...rows.map((r) => toNumber(r[value]) ?? 0));
  const box = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<Active | null>(null);
  const [pinned, setPinned] = useState<Active | null>(null);
  const [cursor, setCursor] = useState<string | null>(null); // roving tab stop
  const active = pinned ?? hover;
  const activeRow = active
    ? cells.get(`${active.cohort}|${active.period}`)
    : undefined;
  const firstKey = cohorts.length ? `${cohorts[0]}|${periods[0]}` : "";
  const tabKey = cursor && cells.has(cursor) ? cursor : firstKey;

  const locate = (el: HTMLElement, c: string, p: number): Active => {
    const b = box.current!.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const alignRight = r.left - b.left > b.width / 2;
    return {
      cohort: c,
      period: p,
      x: alignRight ? b.right - r.left + 6 : r.right - b.left + 6,
      y: r.top - b.top,
      alignRight,
    };
  };

  const onKey = (e: KeyboardEvent<HTMLElement>, ci: number, pi: number) => {
    if (e.key === "Escape") return setPinned(null);
    const step: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    };
    const d = step[e.key];
    if (!d) return;
    e.preventDefault();
    const next = box.current?.querySelector<HTMLElement>(
      `[data-cell="${ci + d[0]}-${pi + d[1]}"]`,
    );
    next?.focus();
  };

  return (
    <div ref={box} className="relative" onMouseLeave={() => setHover(null)}>
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
            {cohorts.map((c, ci) => (
              <tr
                key={c}
                className={
                  c === highlight
                    ? "rounded outline outline-2 -outline-offset-1 outline-brand-accent"
                    : undefined
                }
              >
                <th
                  scope="row"
                  className="whitespace-nowrap px-2 py-1 text-left font-medium"
                >
                  {c}
                </th>
                {periods.map((p, pi) => {
                  const key = `${c}|${p}`;
                  const row = cells.get(key);
                  const v = row ? toNumber(row[value]) : null;
                  if (v === null) return <td key={p} />;
                  const share = Math.max(0, Math.min(1, v / max));
                  const isActive = active?.cohort === c && active.period === p;
                  return (
                    <td
                      key={p}
                      data-cell={`${ci}-${pi}`}
                      tabIndex={key === tabKey ? 0 : -1}
                      aria-describedby={isActive ? "cohort-tooltip" : undefined}
                      className={`cursor-pointer rounded-sm px-1 py-1.5 text-center outline-none focus-visible:ring-2 focus-visible:ring-ring ${share > 0.55 ? "text-white" : ""} ${isActive ? "ring-2 ring-foreground" : ""}`}
                      style={{
                        background: `color-mix(in oklab, var(--seq-5) ${Math.round(share * 85)}%, var(--card))`,
                      }}
                      onMouseEnter={(e) =>
                        setHover(locate(e.currentTarget, c, p))
                      }
                      onFocus={(e) => {
                        setCursor(key);
                        setHover(locate(e.currentTarget, c, p));
                      }}
                      onBlur={() => setHover(null)}
                      onClick={(e) => {
                        const at = locate(e.currentTarget, c, p);
                        setPinned((old) =>
                          old?.cohort === c && old.period === p ? null : at,
                        );
                      }}
                      onKeyDown={(e) => onKey(e, ci, pi)}
                    >
                      {format(v)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {active && activeRow && (
        <div
          id="cohort-tooltip"
          role="tooltip"
          className="glass pointer-events-none absolute z-30 rounded-lg"
          style={{
            top: active.y,
            ...(active.alignRight ? { right: active.x } : { left: active.x }),
            transform: "translateY(-30%)",
          }}
        >
          <TooltipBody {...details(activeRow)} />
        </div>
      )}
    </div>
  );
}
