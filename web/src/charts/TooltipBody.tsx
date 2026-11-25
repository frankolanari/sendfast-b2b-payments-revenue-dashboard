/**
 * Our tooltip panel body, used by every bar chart: a header line with the category (e.g. the
 * month) on the left and its total on the right, then one row per series. Owner, 2026-11-25:
 * "I want to see the total value in the same line as the month, on the right side".
 */
export function TooltipBody({
  title,
  total,
  rows,
}: {
  title: string;
  total?: string;
  rows: { color: string; label: string; value: string }[];
}) {
  return (
    <div className="min-w-44 px-3 py-2 text-xs">
      <div className="flex items-baseline justify-between gap-6">
        <span className="font-medium text-foreground">{title}</span>
        {total !== undefined && (
          <span className="font-semibold tabular-nums text-foreground">
            {total}
          </span>
        )}
      </div>
      {rows.length > 0 && (
        <ul className="mt-1.5 space-y-1 border-t border-border pt-1.5">
          {rows.map((r) => (
            <li
              key={r.label}
              className="flex items-center justify-between gap-6"
            >
              <span className="flex items-center gap-1.5 text-ink-secondary">
                <span
                  className="size-2 rounded-full"
                  style={{ background: r.color }}
                  aria-hidden
                />
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
