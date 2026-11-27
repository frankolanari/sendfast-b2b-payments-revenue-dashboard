import { DIMENSIONS, type Dimension } from "@/lib/groups";

/** The "Group by" switch on a chart card. */
export function GroupBy({
  value,
  onChange,
  name,
}: {
  value: Dimension;
  onChange: (d: Dimension) => void;
  name: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted-foreground" aria-hidden>
        Group by
      </span>
      <div
        className="flex flex-wrap rounded-lg bg-foreground/5 p-0.5"
        role="group"
        aria-label={`${name}: group by`}
      >
        {(Object.keys(DIMENSIONS) as Dimension[]).map((d) => (
          <button
            key={d}
            type="button"
            aria-pressed={value === d}
            onClick={() => onChange(d)}
            className={
              value === d
                ? "rounded-md bg-card px-2.5 py-1 font-medium shadow-sm"
                : "rounded-md px-2.5 py-1 text-ink-secondary hover:text-foreground"
            }
          >
            {DIMENSIONS[d].label}
          </button>
        ))}
      </div>
    </div>
  );
}
