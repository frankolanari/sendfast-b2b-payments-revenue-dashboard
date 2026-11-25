import { curveLinear } from "d3-shape";
import { useRef } from "react";
import {
  ChartTooltip,
  Grid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "@/components/ui/charts";
import type { Row } from "@/api/useCard";
import { month, toNumber } from "@/lib/format";
import { TooltipBody } from "./TooltipBody";

export interface LineSeries {
  key: string;
  label: string;
  color: string;
}

/**
 * Straight segments (a smoothed curve would invent dips between months). Lines over months. `rows` hold one month each (`month` ISO date) with a value per series key.
 * Dates are pinned to mid-month UTC so no time zone can shift a month (D15). Clicking selects
 * the series nearest the top of the hovered month when `onSelect` is given.
 */
export function TrendLine({
  rows,
  series,
  format,
  ariaLabel,
  aspectRatio = "16 / 6",
  tooltipLimit = 6,
  onSelect,
}: {
  rows: Row[];
  series: LineSeries[];
  format: (v: unknown) => string;
  ariaLabel: string;
  aspectRatio?: string;
  tooltipLimit?: number;
  onSelect?: (key: string) => void;
}) {
  const top = useRef<string | null>(null);
  const data = rows.map((r) => ({
    ...r,
    date: new Date(`${String(r.month).slice(0, 7)}-15T12:00:00Z`),
  }));
  return (
    <div
      className={onSelect ? "cursor-pointer" : undefined}
      onClick={() => top.current && onSelect?.(top.current)}
      onMouseLeave={() => (top.current = null)}
    >
      <LineChart
        ariaLabel={ariaLabel}
        data={data}
        xDataKey="date"
        aspectRatio={aspectRatio}
        margin={{ left: 56, top: 16 }}
      >
        <Grid horizontal />
        {series.map((s) => (
          <Line
            key={s.key}
            dataKey={s.key}
            label={s.label}
            stroke={s.color}
            curve={curveLinear}
            fadeEdges={false}
          />
        ))}
        <XAxis formatValue={(d) => month(d.toISOString().slice(0, 10))} />
        <YAxis formatValue={(v) => format(v)} />
        <ChartTooltip
          content={({ point }) => {
            const ranked = series
              .filter((s) => toNumber(point[s.key]) !== null)
              .sort(
                (a, b) =>
                  (toNumber(point[b.key]) ?? 0) - (toNumber(point[a.key]) ?? 0),
              );
            top.current = ranked[0]?.key ?? null;
            return (
              <TooltipBody
                title={month(point.month)}
                note={
                  onSelect && ranked[0]
                    ? `Click to filter to ${ranked[0].label}`
                    : undefined
                }
                rows={ranked.slice(0, tooltipLimit).map((s) => ({
                  color: s.color,
                  label: s.label,
                  value: format(point[s.key]),
                }))}
              />
            );
          }}
        />
      </LineChart>
    </div>
  );
}
