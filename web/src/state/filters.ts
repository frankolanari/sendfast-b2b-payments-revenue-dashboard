/**
 * Filter state lives in the URL (shareable links, PLAN.md Stage 7). One filter bar drives
 * every card on a page; each card receives only the parameters it accepts (the registry).
 * Periods are fixed presets over the fixed as-of date (D11): snapshot mode can pre-render them.
 */
import { useSyncExternalStore } from "react";
import { cards, type CardSlug } from "@/api/cards.generated";
import type { CardParams } from "@/api/client";

export const PERIODS = {
  t12: { label: "Last 12 months", from: "2025-11-01", to: "2026-10-31" },
  sep2026: { label: "Sep 2026", from: "2026-09-01", to: "2026-09-30" },
  y2025: { label: "2025", from: "2025-01-01", to: "2025-12-31" },
  all: { label: "All time", from: null, to: null },
} as const;
export type PeriodKey = keyof typeof PERIODS;
export const DEFAULT_PERIOD: PeriodKey = "t12";

export interface Filters {
  period: PeriodKey;
  segment?: string;
  lead_source?: string;
  owner_id?: string;
  corridor?: string;
}
export type FilterKey = Exclude<keyof Filters, "period">;
const FILTER_KEYS: FilterKey[] = [
  "segment",
  "lead_source",
  "owner_id",
  "corridor",
];

export function parseFilters(search: string): Filters {
  const q = new URLSearchParams(search);
  const p = q.get("period");
  const f: Filters = {
    period: p && p in PERIODS ? (p as PeriodKey) : DEFAULT_PERIOD,
  };
  for (const k of FILTER_KEYS) {
    const v = q.get(k);
    if (v) f[k] = v;
  }
  return f;
}

export function serializeFilters(f: Filters): string {
  const q = new URLSearchParams();
  if (f.period !== DEFAULT_PERIOD) q.set("period", f.period);
  for (const k of FILTER_KEYS) if (f[k]) q.set(k, f[k]!);
  const s = q.toString();
  return s ? `?${s}` : "";
}

/** The parameters one card should get: only those it accepts, only those that are set. */
export function cardParams(
  slug: CardSlug,
  f: Filters,
  extra: CardParams = {},
): CardParams {
  const accepts = new Set<string>(cards[slug].params);
  const period = PERIODS[f.period];
  const all: CardParams = {
    ...(period.from ? { date_from: period.from } : {}),
    ...(period.to ? { date_to: period.to } : {}),
    ...Object.fromEntries(
      FILTER_KEYS.filter((k) => f[k]).map((k) => [k, f[k]!]),
    ),
    ...extra,
  };
  return Object.fromEntries(
    Object.entries(all).filter(([k]) => accepts.has(k)),
  ) as CardParams;
}

// ── URL store (no router library: history API + useSyncExternalStore) ──
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
if (typeof window !== "undefined") window.addEventListener("popstate", notify);

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
const getSearch = () => window.location.search;
const getPath = () => window.location.pathname;

export function useFilters(): [Filters, (next: Partial<Filters>) => void] {
  const search = useSyncExternalStore(subscribe, getSearch);
  const filters = parseFilters(search);
  const set = (next: Partial<Filters>) => {
    const merged = { ...filters, ...next };
    for (const k of FILTER_KEYS) if (!merged[k]) delete merged[k];
    window.history.replaceState(
      null,
      "",
      window.location.pathname + serializeFilters(merged),
    );
    notify();
  };
  return [filters, set];
}

export function usePath(): string {
  return useSyncExternalStore(subscribe, getPath);
}

/** Go to another page, keeping the filters (search params) unless told otherwise. */
export function navigate(
  path: string,
  search: string = window.location.search,
) {
  window.history.pushState(null, "", path + search);
  window.scrollTo({ top: 0 });
  notify();
}
