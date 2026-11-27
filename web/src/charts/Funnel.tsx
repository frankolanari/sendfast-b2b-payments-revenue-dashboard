import { useState } from "react";
import { FunnelChart } from "@/components/ui/charts";
import type { Row } from "@/api/useCard";
import { count, toNumber } from "@/lib/format";
import { TooltipBody, type TooltipRow } from "./TooltipBody";

/**
 * Stage funnel with its own tooltip: a transparent button over each segment (mouse, keyboard
 * and touch), which also drives the chart's highlight.
 */
export function Funnel({
  rows,
  stage,
  value,
  ariaLabel,
  stageLabel = (s) => String(s),
  details,
  unit = "deals",
}: {
  rows: Row[];
  stage: string;
  value: string;
  ariaLabel: string;
  stageLabel?: (s: unknown) => string;
  details?: (index: number) => TooltipRow[];
  /** What each step counts, for labels and tooltips. */
  unit?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [pinned, setPinned] = useState<number | null>(null);
  const active = pinned ?? hover;
  const data = rows.map((r) => {
    const n = toNumber(r[value]) ?? 0;
    return { label: stageLabel(r[stage]), value: n, displayValue: count(n) };
  });
  return (
    <div className="relative" onMouseLeave={() => setHover(null)}>
      <FunnelChart
        ariaLabel={ariaLabel}
        data={data}
        color="var(--chart-1)"
        layers={3}
        formatValue={(v) => count(v)}
        formatPercentage={(p) => `${Math.round(p)}%`}
        hoveredIndex={active}
      />
      <div
        className="absolute inset-0 grid"
        style={{
          gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))`,
        }}
      >
        {data.map((d, i) => (
          <button
            key={d.label}
            type="button"
            className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`${d.label}: ${d.displayValue} ${unit}`}
            aria-pressed={pinned === i}
            onMouseEnter={() => setHover(i)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
            onClick={() => setPinned((p) => (p === i ? null : i))}
            onKeyDown={(e) => e.key === "Escape" && setPinned(null)}
          />
        ))}
      </div>
      {active !== null && data[active] && (
        <div
          role="tooltip"
          className="glass pointer-events-none absolute top-2 z-10 rounded-lg"
          style={
            active < data.length / 2
              ? { left: `${((active + 0.5) / data.length) * 100}%` }
              : {
                  right: `${((data.length - active - 0.5) / data.length) * 100}%`,
                }
          }
        >
          <TooltipBody
            title={data[active].label}
            total={`${data[active].displayValue} ${unit}`}
            rows={details?.(active) ?? []}
          />
        </div>
      )}
    </div>
  );
}
