/** Generic display of card columns: headers and cells formatted from the column's name. */
import { cap } from "@/insights/common";
import { count, currency, day, percent, toNumber } from "./format";

export function columnLabel(key: string): string {
  const s = key
    .replace(/_usd/g, "")
    .replace(/^__.*/, "")
    .replace(/_/g, " ")
    .trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const CODE_COLUMNS = new Set([
  "segment",
  "lead_source",
  "stage",
  "outcome",
  "health_status",
  "event_type",
  "activation_speed",
  "component",
  "step",
  "category",
  "dimension",
]);

export function formatCell(key: string, v: unknown): string {
  if (v === null || v === undefined || v === "") return "–";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}($|T)/.test(v))
    return day(v.slice(0, 10));
  if (/(_id|^id$|_rank|_order)$/.test(key)) return String(v);
  if (CODE_COLUMNS.has(key))
    return cap(String(v).replace(/_/g, key === "segment" ? "_" : " "));
  const n = toNumber(v);
  if (n === null) return String(v);
  if (/(rate|share|retention|^nrr$|trend)/.test(key)) return percent(n);
  if (/_usd/.test(key)) return currency(n, { compact: false });
  return Number.isInteger(n)
    ? count(n)
    : n.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

/** Columns worth showing: internal keys and ids are left out. */
export const visibleColumns = (rows: Record<string, unknown>[]) =>
  rows.length
    ? Object.keys(rows[0]).filter(
        (k) => !/^__|_id$|_rank$|_order$|^color$/.test(k),
      )
    : [];

export function toCsv(rows: Record<string, unknown>[]): string {
  const cols = rows.length
    ? Object.keys(rows[0]).filter((k) => !k.startsWith("__") && k !== "color")
    : [];
  const cell = (v: unknown) => {
    let s = v === null || v === undefined ? "" : String(v);
    if (/^[=+\-@]/.test(s) && Number.isNaN(Number(s))) s = `'${s}`; // no spreadsheet formulas
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [
    cols.join(","),
    ...rows.map((r) => cols.map((c) => cell(r[c])).join(",")),
  ].join("\n");
}
