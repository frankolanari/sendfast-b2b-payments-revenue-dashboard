import { describe, expect, it } from "vitest";
import { buildOutcomeFlow } from "./flows";

const rows = [
  {
    lead_source: "partner",
    furthest_stage_rank: 1,
    outcome: "lost",
    deals: 11,
  },
  {
    lead_source: "partner",
    furthest_stage_rank: 2,
    outcome: "lost",
    deals: 19,
  },
  {
    lead_source: "partner",
    furthest_stage_rank: 3,
    outcome: "open",
    deals: 11,
  },
  { lead_source: "partner", furthest_stage_rank: 5, outcome: "won", deals: 23 },
  { lead_source: "inbound", furthest_stage_rank: 5, outcome: "won", deals: 4 },
];
const flow = buildOutcomeFlow(
  rows,
  ["inbound", "outbound", "partner"],
  (s) => s,
  (s) => `color-${s}`,
);
const named = (n: string) => flow.nodes.findIndex((x) => x.name === n);
const sum = (pred: (l: (typeof flow.links)[number]) => boolean) =>
  flow.links.filter(pred).reduce((a, l) => a + l.value, 0);

describe("buildOutcomeFlow", () => {
  it("each source's band equals its deals, summed across stages", () => {
    expect(sum((l) => l.source === named("partner"))).toBe(64);
    expect(
      sum((l) => l.source === named("partner") && l.target === named("Lost")),
    ).toBe(30);
  });
  it("outcome totals add up across sources", () => {
    expect(sum((l) => l.target === named("Won"))).toBe(27);
  });
  it("leaves out sources and outcomes with no deals; bands keep the source colour", () => {
    expect(named("outbound")).toBe(-1);
    expect(flow.nodes.map((n) => n.name)).toEqual([
      "inbound",
      "partner",
      "Won",
      "Still open",
      "Lost",
    ]);
    expect(
      flow.links.every((l) => l.color === `color-${flow.nodes[l.source].name}`),
    ).toBe(true);
  });
});
