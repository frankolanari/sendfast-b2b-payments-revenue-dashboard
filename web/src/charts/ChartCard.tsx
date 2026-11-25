import { Download, Table2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toCsv } from "@/lib/table";
import { DataTable } from "./DataTable";
import type { UseQueryResult } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

function downloadCsv(name: string, rows: Record<string, unknown>[]) {
  const url = URL.createObjectURL(
    new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" }),
  );
  const a = Object.assign(document.createElement("a"), {
    href: url,
    download: `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`,
  });
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * The card every chart sits in, read top to bottom (owner, 2026-11-25): a short name that is
 * easy to scan, the finding under it, then a small note saying what the chart shows.
 * Loading, empty and error states are handled here once.
 */
export function ChartCard({
  name,
  insight,
  note,
  query,
  isEmpty,
  className,
  ignores,
  actions,
  children,
}: {
  /** What the chart is, in a few words: "Sales funnel". */
  name: string;
  /** What it says right now, computed from the data on screen. */
  insight: ReactNode;
  /** What is measured and how to read it. */
  note?: ReactNode;
  query: Pick<UseQueryResult<unknown[]>, "isPending" | "isError" | "data">;
  isEmpty?: boolean;
  className?: string;
  /** Active filters this chart can't apply (state/filters ignoredFilters). */
  ignores?: string[];
  /** Controls that change how this chart reads (e.g. Group by). */
  actions?: ReactNode;
  children: ReactNode;
}) {
  const [showData, setShowData] = useState(false);
  const rows = (query.data ?? []) as Record<string, unknown>[];
  const empty =
    isEmpty ?? (query.data !== undefined && query.data.length === 0);
  return (
    <section
      className={cn(
        "shadow-card flex flex-col rounded-xl border bg-card p-5",
        className,
      )}
    >
      <header className="mb-4">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-xl tracking-tight">{name}</h2>
          {rows.length > 0 && (
            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                aria-pressed={showData}
                aria-label={`${showData ? "Show chart" : "Show data"}: ${name}`}
                onClick={() => setShowData((v) => !v)}
                className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-ink-secondary hover:bg-foreground/10 hover:text-foreground aria-pressed:bg-foreground/10"
              >
                <Table2 className="size-3.5" aria-hidden />
                {showData ? "Chart" : "Data"}
              </button>
              <button
                type="button"
                aria-label={`Download ${name} as CSV`}
                title="Download CSV"
                onClick={() => downloadCsv(name, rows)}
                className="grid size-7 place-items-center rounded-lg text-ink-secondary hover:bg-foreground/10 hover:text-foreground"
              >
                <Download className="size-3.5" aria-hidden />
              </button>
            </div>
          )}
        </div>
        {query.isPending ? (
          <span
            className="mt-1.5 block h-4 w-72 animate-pulse rounded bg-muted"
            aria-hidden
          />
        ) : query.isError ? null : (
          <p className="mt-1 text-sm font-medium text-ink-secondary">
            {insight}
          </p>
        )}
        {note && <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>}
        {ignores && ignores.length > 0 && (
          <p className="mt-2 inline-block rounded-md border border-brand-accent/50 px-2 py-0.5 text-xs text-ink-secondary">
            Not affected by {ignores.join(", ")}
          </p>
        )}
        {actions && <div className="mt-3">{actions}</div>}
      </header>
      <div className="relative flex-1">
        {query.isPending ? (
          <div
            className="h-56 animate-pulse rounded-lg bg-muted/60"
            aria-busy="true"
            aria-label="Loading"
          />
        ) : query.isError ? (
          <p className="py-16 text-center text-sm text-destructive">
            This chart couldn't load. Try again later.
          </p>
        ) : empty ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            No data for these filters.
          </p>
        ) : showData ? (
          <DataTable rows={rows} caption={`${name}: data`} />
        ) : (
          children
        )}
      </div>
    </section>
  );
}
