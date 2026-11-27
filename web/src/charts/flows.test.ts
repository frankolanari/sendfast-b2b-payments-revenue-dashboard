import { describe, expect, it } from "vitest";
import { buildOutcomeFlow } from "./flows";

const group = (
  label: string,
  won: number,
  still_open: number,
  lost: number,
) => ({
  label,
  color: `color-${label}`,
  won,
  still_open,
  lost,
  won_usd: won * 10,
  open_usd: still_open * 10,
  lost_usd: lost * 10,
});
const flow = buildOutcomeFlow([
  group("Partner", 23, 11, 30),
  group("Inbound", 4, 0, 0),
  group("Outbound", 0, 0, 0),
]);
const named = (n: string) => flow.nodes.findIndex((x) => x.name === n);
const sum = (pred: (l: (typeof flow.links)[number]) => boolean) =>
  flow.links.filter(pred).reduce((a, l) => a + l.value, 0);

describe("buildOutcomeFlow", () => {
  it("each group's band equals its deals, with their value", () => {
    expect(sum((l) => l.source === named("Partner"))).toBe(64);
    expect(
      flow.links.find(
        (l) => l.source === named("Partner") && l.target === named("Lost"),
      )?.amount,
    ).toBe(300);
  });
  it("outcome totals add up across groups", () => {
    expect(sum((l) => l.target === named("Won"))).toBe(27);
  });
  it("leaves out empty groups; bands keep the group colour", () => {
    expect(named("Outbound")).toBe(-1);
    expect(flow.nodes.map((n) => n.name)).toEqual([
      "Partner",
      "Inbound",
      "Won",
      "Still open",
      "Lost",
    ]);
    expect(
      flow.links.every((l) => l.color === `color-${flow.nodes[l.source].name}`),
    ).toBe(true);
  });
});
