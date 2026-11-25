import type { ReactNode } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

/**
 * The card every chart sits in. The title states the insight (PLAN.md Stage 7); the subtitle
 * says what is measured. Loading, empty and error states are handled here once.
 */
export function ChartCard({
  title,
  subtitle,
  query,
  isEmpty,
  className,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  query: Pick<UseQueryResult<unknown[]>, "isPending" | "isError" | "data">;
  isEmpty?: boolean;
  className?: string;
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
        <h2 className="font-display text-lg tracking-tight">
          {query.isPending ? (
            <span className="inline-block h-5 w-64 animate-pulse rounded bg-muted" />
          ) : (
            title
          )}
        </h2>
        {subtitle && (
          <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
        )}
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
