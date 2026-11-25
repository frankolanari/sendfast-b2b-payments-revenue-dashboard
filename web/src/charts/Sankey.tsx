import {
  SankeyChart,
  SankeyLink,
  SankeyNode,
  SankeyTooltip,
} from "@/components/ui/charts";
import type { Row } from "@/api/useCard";
import { count, toNumber } from "@/lib/format";

/** One column of the flow: which field it reads, the order of its values, and labels/colours. */
export interface SankeyStep {
  key: string;
  order: readonly string[];
  label: (v: string) => string;
  color?: (v: string) => string;
}

/**
 * A flow across consecutive columns (e.g. lead source -> last stage -> outcome). Each row is a
 * group with a count in `value`; links between neighbouring columns add those counts up, so
 * every column conserves the same total. Bands take the colour of the first column's value.
 */
export function Sankey({
  rows,
  steps,
  value,
  ariaLabel,
  aspectRatio = "16 / 7",
}: {
  rows: Row[];
  steps: SankeyStep[];
  value: string;
  ariaLabel: string;
  aspectRatio?: string;
}) {
  type Category = "source" | "landing" | "outcome";
  const categoryOf = (s: number): Category =>
    s === 0 ? "source" : s === steps.length - 1 ? "outcome" : "landing";
  const nodes: { name: string; category: Category; color: string }[] = [];
  const index = new Map<string, number>();
  steps.forEach((step, s) => {
    const present = new Set(rows.map((r) => String(r[step.key])));
    for (const v of step.order) {
      if (!present.has(v)) continue;
      index.set(`${s}:${v}`, nodes.length);
      nodes.push({
        name: step.label(v),
        category: categoryOf(s),
        color: step.color?.(v) ?? "var(--chart-neutral-bar)",
      });
    }
  });

  const links = new Map<
    string,
    { source: number; target: number; value: number; color: string }
  >();
  for (const r of rows) {
    const n = toNumber(r[value]) ?? 0;
    const origin =
      steps[0].color?.(String(r[steps[0].key])) ?? "var(--chart-neutral-bar)";
    for (let s = 0; s < steps.length - 1; s++) {
      const a = index.get(`${s}:${r[steps[s].key]}`);
      const b = index.get(`${s + 1}:${r[steps[s + 1].key]}`);
      if (a === undefined || b === undefined) continue;
      // Links out of the first column keep the source colour; later links stay neutral so
      // the outcome column reads as totals, not as a tangle of colours.
      const id = `${a}>${b}`;
      const link = links.get(id) ?? {
        source: a,
        target: b,
        value: 0,
        color: s === 0 ? origin : "var(--chart-neutral-bar)",
      };
      link.value += n;
      links.set(id, link);
    }
  }
  const linkList = [...links.values()].filter((l) => l.value > 0);

  return (
    <SankeyChart
      ariaLabel={ariaLabel}
      aspectRatio={aspectRatio}
      data={{
        nodes: nodes.map(({ name, category }) => ({ name, category })),
        links: linkList,
      }}
      margin={{ left: 110, right: 110 }}
    >
      <SankeyLink
        getLinkColor={(_, i) =>
          linkList[i]?.color ?? "var(--chart-neutral-bar)"
        }
      />
      <SankeyNode
        getNodeColor={(_, i) => nodes[i]?.color ?? "var(--chart-neutral-bar)"}
        formatValue={(v) => count(v)}
      />
      <SankeyTooltip />
    </SankeyChart>
  );
}
