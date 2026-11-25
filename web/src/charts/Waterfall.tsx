import {
  BarXAxis,
  BarYAxis,
  ChartTooltip,
  Grid,
  Waterfall as KitWaterfall,
  WaterfallChart,
} from "@/components/ui/charts";
import type { Row } from "@/api/useCard";
import { toNumber } from "@/lib/format";

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
  const data = rows.map((r) => {
    const s = String(r[step]);
    return totals.includes(s)
      ? { label: label(s), total: true, value: toNumber(r[value]) ?? 0 }
      : { label: label(s), value: toNumber(r[value]) ?? 0 };
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
      <ChartTooltip />
    </WaterfallChart>
  );
}
