import type { CardSlug } from "@/api/cards.generated";
import { useCard } from "@/api/useCard";
import type { CardParams } from "@/api/client";

/** One headline number (no chart): label, value, and what period it covers. */
export function KpiTile({
  slug,
  params,
  label,
  column,
  format,
  note,
}: {
  slug: CardSlug;
  params: CardParams;
  label: string;
  column: string;
  format: (v: unknown) => string;
  note?: string;
}) {
  const q = useCard(slug, params);
  return (
    <div className="shadow-card rounded-xl border bg-card p-5">
      <div className="text-sm text-muted-foreground">{label}</div>
      {/* No tabular-nums: Cal Sans makes the decimal point full-width under it. */}
      <div className="mt-3 font-display text-4xl tracking-tight">
        {q.isPending ? (
          <span
            className="inline-block h-9 w-28 animate-pulse rounded-md bg-muted"
            aria-label="Loading"
          />
        ) : q.isError ? (
          <span className="text-base text-destructive">Couldn't load</span>
        ) : (
          format(q.data[0]?.[column])
        )}
      </div>
      {note && <div className="mt-1 text-xs text-muted-foreground">{note}</div>}
    </div>
  );
}
