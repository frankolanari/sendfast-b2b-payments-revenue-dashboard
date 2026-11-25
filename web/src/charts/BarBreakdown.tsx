import {
  Bar,
  BarChart,
  BarXAxis,
  BarYAxis,
  ChartTooltip,
  Grid,
} from "@/components/ui/charts";
import type { Row } from "@/api/useCard";
import { toNumber } from "@/lib/format";
import { TooltipBody, type TooltipRow } from "./TooltipBody";

/** Above this many categories (e.g. 24 months), axis labels thin to fit. */
const MAX_LABELLED_CATEGORIES = 8;

export interface Series {
  key: string;
  label: string;
  /** A CSS colour from the tokens, e.g. var(--chart-1). */
  color: string;
}

/**
 * Bars by category. Two modes:
 * - one measure, with an optional highlight: the highlighted bar is the accent, the rest are
 *   neutral (the insight pops; identity is in the labels, not the colour);
 * - several series (stacked), each a fixed token colour that follows the entity.
 * Values are labelled on the bars and in the tooltip, formatted.
 */
export function BarBreakdown({
  rows,
  category,
  value,
  series,
  format,
  highlight,
  horizontal = false,
  ariaLabel,
  aspectRatio,
  categoryLabel = (v) => String(v),
  labelWidth = 120,
  details,
}: {
  rows: Row[];
  category: string;
  value?: string;
  series?: Series[];
  format: (v: unknown) => string;
  highlight?: (row: Row) => boolean;
  horizontal?: boolean;
  ariaLabel: string;
  aspectRatio?: string;
  categoryLabel?: (v: unknown) => string;
  /** Room for category labels on a horizontal chart, in px. */
  labelWidth?: number;
  /** Tooltip rows for a bar: counts, shares, comparisons. Replaces the default series rows. */
  details?: (row: Row) => TooltipRow[];
}) {
  const stacked = Boolean(series);
  const data = rows.map((r) => {
    const out: Row = { ...r, __cat: categoryLabel(r[category]) };
    if (!stacked && value) {
      const n = toNumber(r[value]) ?? 0;
      const hl = highlight?.(r) ?? false;
      out.__base = hl ? 0 : n;
      out.__hl = hl ? n : 0;
    }
    return out;
  });
  const bars: Series[] = stacked
    ? series!
    : [
        { key: "__base", label: "Value", color: "var(--chart-neutral-bar)" },
        { key: "__hl", label: "Highlighted", color: "var(--brand-accent)" },
      ];
  const total = (p: Row) =>
    stacked
      ? bars.reduce((s, b) => s + (toNumber(p[b.key]) ?? 0), 0)
      : (toNumber(p.__base) ?? 0) + (toNumber(p.__hl) ?? 0);

  return (
    <BarChart
      ariaLabel={ariaLabel}
      data={data}
      xDataKey="__cat"
      orientation={horizontal ? "horizontal" : "vertical"}
      stacked
      aspectRatio={aspectRatio ?? (horizontal ? "2 / 1" : "16 / 7")}
      margin={
        horizontal ? { left: labelWidth, right: 56 } : { left: 64, top: 24 }
      }
    >
      <Grid horizontal={!horizontal} vertical={horizontal} />
      {bars.map((b) => (
        <Bar
          key={b.key}
          dataKey={b.key}
          label={b.label}
          fill={b.color}
          // Direct label on the highlighted bar only: selective, never a number on every bar.
          showValue={!stacked && b.key === "__hl"}
          valueLabelFormatter={(v) => (v ? format(v) : "")}
        />
      ))}
      {horizontal ? (
        <BarYAxis showAllLabels />
      ) : (
        // Short category lists (sources, stages) show every label; long time series thin to the
        // labels that fit the plot width, so months never collide. The tooltip names every bar.
        <BarXAxis showAllLabels={data.length <= MAX_LABELLED_CATEGORIES} />
      )}
      {!horizontal && <BarYAxis numTicks={4} formatValue={(v) => format(v)} />}
      <ChartTooltip
        content={({ point }) => (
          <TooltipBody
            title={String(point.__cat)}
            total={format(total(point))}
            rows={
              details
                ? details(point)
                : stacked
                  ? // Top of the stack first, as the eye reads it; zero series left out.
                    [...bars]
                      .reverse()
                      .filter((b) => (toNumber(point[b.key]) ?? 0) !== 0)
                      .map((b) => ({
                        color: b.color,
                        label: b.label,
                        value: format(point[b.key]),
                      }))
                  : []
            }
          />
        )}
      />
    </BarChart>
  );
}
