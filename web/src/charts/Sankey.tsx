import {
  SankeyChart,
  SankeyLink,
  SankeyNode,
  SankeyTooltip,
} from "@/components/ui/charts";
import { count } from "@/lib/format";
import type { FlowLink, FlowNode } from "./flows";

/** Draws a Sankey from prepared nodes and links (colours included); see gateFlow.ts. */
export function Sankey({
  nodes,
  links,
  ariaLabel,
  aspectRatio = "16 / 7",
}: {
  nodes: FlowNode[];
  links: FlowLink[];
  ariaLabel: string;
  aspectRatio?: string;
}) {
  return (
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
      margin={{ left: 90, right: 90 }}
    >
      <SankeyLink
        getLinkColor={(_, i) => links[i]?.color ?? "var(--chart-neutral-bar)"}
      />
      <SankeyNode
        getNodeColor={(_, i) => nodes[i]?.color ?? "var(--chart-neutral-bar)"}
        formatValue={(v) => count(v)}
      />
      <SankeyTooltip />
    </SankeyChart>
  );
}
