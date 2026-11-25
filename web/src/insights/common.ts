/** Rules every chart title follows (owner, 2026-11-25: titles must hold under any filter). */
import type { Row } from "@/api/useCard";
import { toNumber } from "@/lib/format";
import type { PeriodKey } from "@/state/filters";

/** A group needs at least this many records before it is compared or ranked. */
export const MIN_SAMPLE = 10;

export const num = (v: unknown) => toNumber(v) ?? 0;

export const cap = (v: unknown) => {
  const s = String(v ?? "");
  if (s === "smb") return "SMB";
  return s === "mid_market"
    ? "Mid-market"
    : s.charAt(0).toUpperCase() + s.slice(1);
};

/** "unknown" is a missing CRM value, not a lead source: insights never rank it. */
export const knownSources = (rows: Row[]) =>
  rows.filter((r) => r.lead_source !== "unknown");

export const pickBy = (
  rows: Row[],
  key: string,
  dir: "min" | "max",
): Row | undefined =>
  rows.reduce<Row | undefined>((best, r) => {
    const v = toNumber(r[key]);
    if (v === null) return best;
    const b = best ? toNumber(best[key]) : null;
    return b === null || (dir === "max" ? v > b : v < b) ? r : best;
  }, undefined);

export const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  if (!s.length) return 0;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** The period as it reads inside a sentence. */
export const inPeriod: Record<PeriodKey, string> = {
  t12: "in the last 12 months",
  sep2026: "in Sep 2026",
  y2025: "in 2025",
  all: "across all time",
};

export const plural = (n: number, word: string) =>
  `${n.toLocaleString("en-US")} ${word}${n === 1 ? "" : "s"}`;

export interface Insight {
  title: string;
  /** The row a chart should highlight, only when the comparison is fair. */
  highlight?: Row;
}
