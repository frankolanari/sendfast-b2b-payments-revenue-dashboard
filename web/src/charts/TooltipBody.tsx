export interface TooltipRow {
  label: string;
  value: string;
  /** Series dot colour; rows without one are details (counts, shares). */
  color?: string;
}

/**
 * Our tooltip panel body, used by every chart: a header line with the category on the left and
 * its headline value on the right, an optional line of context, then detail rows.
 */
export function TooltipBody({
  title,
  total,
  note,
  rows,
}: {
  title: string;
  total?: string;
  note?: string;
  rows: TooltipRow[];
}) {
  return (
    <div className="min-w-48 px-3 py-2 text-left text-xs">
      <div className="flex items-baseline justify-between gap-6">
        <span className="font-medium text-foreground">{title}</span>
        {total !== undefined && (
          <span className="font-semibold tabular-nums text-foreground">
            {total}
          </span>
        )}
      </div>
      {note && <div className="mt-0.5 text-muted-foreground">{note}</div>}
      {rows.length > 0 && (
        <ul className="mt-1.5 space-y-1 border-t border-border pt-1.5">
          {rows.map((r) => (
            <li
              key={r.label}
              className="flex items-center justify-between gap-6"
            >
              <span className="flex items-center gap-1.5 text-ink-secondary">
                {r.color && (
                  <span
                    className="size-2 rounded-full"
                    style={{ background: r.color }}
                    aria-hidden
                  />
                )}
                {r.label}
              </span>
              <span className="tabular-nums text-foreground">{r.value}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
