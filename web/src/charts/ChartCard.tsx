import type { ReactNode } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

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
        <h2 className="font-display text-xl tracking-tight">{name}</h2>
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
        ) : (
          children
        )}
      </div>
    </section>
  );
}
