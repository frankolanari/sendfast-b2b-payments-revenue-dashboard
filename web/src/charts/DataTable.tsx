import type { ReactNode } from "react";
import type { Row } from "@/api/useCard";
import { columnLabel, formatCell, visibleColumns } from "@/lib/table";
import { toNumber } from "@/lib/format";

export interface Column {
  key: string;
  label?: string;
  render?: (row: Row) => ReactNode;
}

/** The table used for drill-downs and "Show data". Numbers right-aligned; scrolls if tall. */
export function DataTable({
  rows,
  columns,
  caption,
  rowKey,
}: {
  rows: Row[];
  columns?: Column[];
  caption: string;
  rowKey?: string;
}) {
  const cols: Column[] =
    columns ?? visibleColumns(rows).map((key) => ({ key }));
  const numeric = (k: string) =>
    rows.some((r) => r[k] !== null && toNumber(r[k]) !== null) &&
    !/_id$/.test(k);
  return (
    <div
      className="max-h-96 overflow-auto rounded-lg border"
      tabIndex={0}
      role="region"
      aria-label={caption}
    >
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 bg-card">
          <tr className="border-b">
            {cols.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={`px-3 py-2 font-medium text-muted-foreground ${numeric(c.key) ? "text-right" : "text-left"}`}
              >
                {c.label ?? columnLabel(c.key)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={rowKey ? String(r[rowKey]) : i}
              className="border-b border-border/60 hover:bg-foreground/5"
            >
              {cols.map((c) => (
                <td
                  key={c.key}
                  className={`px-3 py-2 ${numeric(c.key) ? "text-right tabular-nums" : ""}`}
                >
                  {c.render ? c.render(r) : formatCell(c.key, r[c.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
