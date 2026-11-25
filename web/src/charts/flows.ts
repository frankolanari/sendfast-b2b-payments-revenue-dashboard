/**
 * Lead source -> outcome flow for a Sankey (owner's choice, 2026-11-25: two columns, clean;
 * the funnel shows the stage gates). Pure data shaping of the deal_gates card: counts per
 * source and outcome are summed, so each source's band equals its deals.
 */
import type { Row } from "@/api/useCard";
import { toNumber } from "@/lib/format";

export const GATES = [
  "Discovery",
  "Qualified",
  "Proposal",
  "Negotiation",
] as const;
export const OUTCOMES = [
  { key: "won", label: "Won", color: "var(--brand-accent)" },
  { key: "open", label: "Still open", color: "var(--chart-neutral-bar)" },
  { key: "lost", label: "Lost", color: "var(--chart-negative)" },
] as const;

export type NodeCategory = "source" | "landing" | "outcome";
export interface FlowNode {
  name: string;
  category: NodeCategory;
  color: string;
}
export interface FlowLink {
  source: number;
  target: number;
  value: number;
  color: string;
}

export function buildOutcomeFlow(
  rows: Row[],
  sources: readonly string[],
  sourceLabel: (s: string) => string,
  sourceColor: (s: string) => string,
): { nodes: FlowNode[]; links: FlowLink[] } {
  const totals = new Map<string, number>(); // "source|outcome" -> deals
  for (const r of rows) {
    const n = toNumber(r.deals) ?? 0;
    if (n <= 0) continue;
    const key = `${r.lead_source}|${r.outcome}`;
    totals.set(key, (totals.get(key) ?? 0) + n);
  }
  const has = (s: string, o: string) => (totals.get(`${s}|${o}`) ?? 0) > 0;
  const srcs = sources.filter((s) => OUTCOMES.some((o) => has(s, o.key)));
  const outs = OUTCOMES.filter((o) => srcs.some((s) => has(s, o.key)));

  const nodes: FlowNode[] = [
    ...srcs.map((s) => ({
      name: sourceLabel(s),
      category: "source" as const,
      color: sourceColor(s),
    })),
    ...outs.map((o) => ({
      name: o.label,
      category: "outcome" as const,
      color: o.color,
    })),
  ];
  const links: FlowLink[] = [];
  srcs.forEach((s, i) =>
    outs.forEach((o, j) => {
      const value = totals.get(`${s}|${o.key}`) ?? 0;
      if (value > 0)
        links.push({
          source: i,
          target: srcs.length + j,
          value,
          color: sourceColor(s),
        });
    }),
  );
  return { nodes, links };
}
