import {
  BarXAxis,
  BarYAxis,
  ChartTooltip,
  Grid,
  Waterfall as KitWaterfall,
  WaterfallChart,
} from "@/components/ui/charts";
import type { Row } from "@/api/useCard";
import { count, percent, toNumber } from "@/lib/format";
import { TooltipBody, type TooltipRow } from "./TooltipBody";

/**
 * A bridge: a starting total, signed moves, an ending total. Rows come in display order; rows
 * whose `step` is in `totals` are drawn as totals (the kit computes the running sum).
 */
export function Waterfall({
  rows,
  step,
  value,
  label,
  totals,
  format,
  ariaLabel,
}: {
  rows: Row[];
  step: string;
  value: string;
  label: (step: string) => string;
  totals: readonly string[];
  format: (v: number) => string;
  ariaLabel: string;
}) {
  const first = toNumber(rows[0]?.[value]) ?? 0;
  const data = rows.map((r, i) => {
    const s = String(r[step]);
    const v = toNumber(r[value]) ?? 0;
    const running = totals.includes(s)
      ? v
      : rows.slice(0, i + 1).reduce((a, x) => a + (toNumber(x[value]) ?? 0), 0);
    return {
      label: label(s),
      value: v,
      ...(totals.includes(s) ? { total: true } : {}),
      __running: running,
      __moves: toNumber(r.account_moves),
    };
  });
  return (
    <WaterfallChart
      ariaLabel={ariaLabel}
      data={data}
      aspectRatio="16 / 7"
      margin={{ left: 64, top: 24 }}
    >
      <Grid horizontal />
      <KitWaterfall dataKey="value" formatValue={format} />
      <BarXAxis showAllLabels />
      <BarYAxis formatValue={format} />
      <ChartTooltip
        content={({ point }) => {
          const v = toNumber(point.value) ?? 0;
          const isTotal = Boolean(point.total);
          const moves = toNumber(point.__moves);
          const detail: TooltipRow[] = [];
          if (!isTotal && first)
            detail.push({
              label: "Size vs the starting month",
              value: percent(Math.abs(v) / first),
            });
          if (!isTotal)
            detail.push({
              label: "Revenue after this step",
              value: format(toNumber(point.__running) ?? 0),
            });
          if (
            isTotal &&
            point.label !== label(String(rows[0]?.[step])) &&
            first
          )
            detail.push({
              label: "Net change from start",
              value: `${v >= first ? "+" : ""}${percent(v / first - 1)}`,
            });
          if (moves !== null)
            detail.push({
              label: "Account-months with this move",
              value: count(moves),
            });
          return (
            <TooltipBody
              title={String(point.label)}
              total={`${!isTotal && v > 0 ? "+" : ""}${format(v)}`}
              note="Monthly net revenue"
              rows={detail}
            />
          );
        }}
      />
    </WaterfallChart>
  );
}
