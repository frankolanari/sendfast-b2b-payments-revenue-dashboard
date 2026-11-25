import { useRef } from "react";
import {
  SankeyChart,
  SankeyLink,
  SankeyNode,
  SankeyTooltip,
} from "@/components/ui/charts";
import { count, currency, percent } from "@/lib/format";
import type { FlowLink, FlowNode } from "./flows";
import { TooltipBody } from "./TooltipBody";

/** Draws a Sankey from prepared nodes and links (colours included); see flows.ts. */
export function Sankey({
  nodes,
  links,
  ariaLabel,
  aspectRatio = "16 / 7",
  onSelect,
}: {
  nodes: FlowNode[];
  links: FlowLink[];
  ariaLabel: string;
  aspectRatio?: string;
  /** Click on a group's node or band (the group's node name). */
  onSelect?: (name: string) => void;
}) {
  const hovered = useRef<string | null>(null);
  const all = links.reduce((a, l) => a + l.value, 0);
  const of = (side: "source" | "target", i: number) =>
    links.filter((l) => l[side] === i);
  const sum = (ls: FlowLink[], k: "value" | "amount") =>
    ls.reduce((a, l) => a + l[k], 0);
  return (
    <div
      className={onSelect ? "cursor-pointer" : undefined}
      onClick={() => hovered.current && onSelect?.(hovered.current)}
      onMouseLeave={() => (hovered.current = null)}
    >
      <SankeyChart
        ariaLabel={ariaLabel}
        aspectRatio={aspectRatio}
        data={{
          nodes: nodes.map(({ name, category }) => ({ name, category })),
          links: links.map(({ source, target, value }) => ({
            source,
            target,
            value,
          })),
        }}
        // Room for the longest group name on the left (rep names, industries).
        margin={{
          left: Math.max(
            90,
            8 * Math.max(...nodes.map((n) => n.name.length), 0),
          ),
          right: 90,
        }}
      >
        <SankeyLink
          getLinkColor={(_, i) => links[i]?.color ?? "var(--chart-neutral-bar)"}
        />
        <SankeyNode
          getNodeColor={(_, i) => nodes[i]?.color ?? "var(--chart-neutral-bar)"}
          formatValue={(v) => count(v)}
        />
        <SankeyTooltip
          linkContent={({ link }) => {
            const l = links.find(
              (x) => x.source === link.source && x.target === link.target,
            );
            if (!l) return null;
            hovered.current = nodes[l.source].name;
            const fromSource = sum(of("source", l.source), "value");
            return (
              <TooltipBody
                title={`${nodes[l.source].name} → ${nodes[l.target].name}`}
                total={`${count(l.value)} deals`}
                rows={[
                  {
                    label: "Share of this group's deals",
                    value: percent(l.value / fromSource),
                  },
                  {
                    label: "Share of all deals",
                    value: percent(l.value / all),
                  },
                  { label: "Deal value", value: currency(l.amount) },
                ]}
              />
            );
          }}
          nodeContent={({ index }) => {
            const isSource = of("source", index).length > 0;
            const mine = of(isSource ? "source" : "target", index);
            hovered.current = isSource ? nodes[index].name : null;
            const deals = sum(mine, "value");
            return (
              <TooltipBody
                title={nodes[index].name}
                total={`${count(deals)} deals`}
                rows={[
                  { label: "Share of all deals", value: percent(deals / all) },
                  { label: "Deal value", value: currency(sum(mine, "amount")) },
                  // The breakdown on the other side: where a source went, or where an outcome came from.
                  ...mine.map((l) => {
                    const other = nodes[isSource ? l.target : l.source];
                    return {
                      color: other.color,
                      label: other.name,
                      value: `${count(l.value)} (${percent(l.value / deals, 0)})`,
                    };
                  }),
                ]}
              />
            );
          }}
        />
      </SankeyChart>
    </div>
  );
}
