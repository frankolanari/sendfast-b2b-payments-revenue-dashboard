import { FunnelChart } from "@/components/ui/charts";
import type { Row } from "@/api/useCard";
import { count, toNumber } from "@/lib/format";

/** Stage funnel: each stage's count and its share of the first stage. */
export function Funnel({
  rows,
  stage,
  value,
  ariaLabel,
  stageLabel = (s) => String(s),
}: {
  rows: Row[];
  stage: string;
  value: string;
  ariaLabel: string;
  stageLabel?: (s: unknown) => string;
}) {
  const data = rows.map((r) => {
    const n = toNumber(r[value]) ?? 0;
    return { label: stageLabel(r[stage]), value: n, displayValue: count(n) };
  });
  return (
    <FunnelChart
      ariaLabel={ariaLabel}
      data={data}
      color="var(--chart-1)"
      layers={3}
      formatValue={(v) => count(v)}
      formatPercentage={(p) => `${Math.round(p)}%`}
    />
  );
}
