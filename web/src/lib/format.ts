/**
 * Number and date formatting for every card (PLAN.md Stage 7). One locale (en-US) and one time
 * zone (UTC, D15): a month never shifts with the viewer's clock. Missing values show an en dash.
 */

const DASH = "–";

const isNumber = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

/** Card values arrive as numbers or numeric strings; anything else is "missing". */
export function toNumber(v: unknown): number | null {
  if (isNumber(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)))
    return Number(v);
  return null;
}

/** $1.2M, $465K, ₦1.2B (compact), or $3,448,645 with compact: false. */
export function currency(
  v: unknown,
  { code = "USD", compact = true }: { code?: string; compact?: boolean } = {},
): string {
  const n = toNumber(v);
  if (n === null) return DASH;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: code,
    currencyDisplay: "narrowSymbol",
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? (Math.abs(n) >= 1000 ? 1 : 0) : 0,
  }).format(n);
}

/** A ratio as a percentage: 0.3309 -> 33.1%. */
export function percent(v: unknown, decimals = 1): string {
  const n = toNumber(v);
  if (n === null) return DASH;
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

/** A ratio in basis points: 0.006686 -> 66.9 bps. */
export function bps(v: unknown, decimals = 1): string {
  const n = toNumber(v);
  if (n === null) return DASH;
  return `${(n * 10_000).toFixed(decimals)} bps`;
}

/** A count: 1,234 or 1.2K compact. */
export function count(
  v: unknown,
  { compact = false }: { compact?: boolean } = {},
): string {
  const n = toNumber(v);
  if (n === null) return DASH;
  return new Intl.NumberFormat("en-US", {
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 0,
  }).format(n);
}

/** A duration in days: 1 day, 76 days, 22.5 days. */
export function days(v: unknown): string {
  const n = toNumber(v);
  if (n === null) return DASH;
  const shown = Number.isInteger(n) ? String(n) : n.toFixed(1);
  return `${shown} ${n === 1 ? "day" : "days"}`;
}

/** A month from an ISO date (or timestamp): "2026-09-01" -> "Sep 2026", always in UTC. */
export function month(v: unknown, style: "short" | "long" = "short"): string {
  if (typeof v !== "string" || Number.isNaN(Date.parse(v))) return DASH;
  return new Intl.DateTimeFormat("en-US", {
    month: style,
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(v.length === 10 ? `${v}T00:00:00Z` : v));
}

/** A day from an ISO date: "2026-09-30" -> "Sep 30, 2026", in UTC. */
export function day(v: unknown): string {
  if (typeof v !== "string" || Number.isNaN(Date.parse(v))) return DASH;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(v.length === 10 ? `${v}T00:00:00Z` : v));
}
