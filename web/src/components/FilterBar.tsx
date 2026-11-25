import { parameterContract } from "@/api/cards.generated";
import { useCard } from "@/api/useCard";
import {
  PERIODS,
  useFilters,
  type FilterKey,
  type PeriodKey,
} from "@/state/filters";

const pretty = (v: string) =>
  v === "mid_market" ? "Mid-market" : v[0].toUpperCase() + v.slice(1);

function Select({
  name,
  label,
  value,
  options,
  onChange,
}: {
  name: FilterKey;
  label: string;
  value?: string;
  options: { value: string; label: string }[];
  onChange: (v: string | undefined) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <select
        name={name}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-transparent [&>option]:bg-card"
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** The global filter bar (glass). Which dimension filters show depends on the page. */
export function FilterBar({ show }: { show: FilterKey[] }) {
  const [f, set] = useFilters();
  const reps = useCard("filter_reps", {});
  const corridors = useCard("filter_corridors", {});
  const options: Record<FilterKey, { value: string; label: string }[]> = {
    segment: parameterContract.segment.values.map((v) => ({
      value: v,
      label: pretty(v),
    })),
    lead_source: parameterContract.lead_source.values.map((v) => ({
      value: v,
      label: pretty(v),
    })),
    owner_id: (reps.data ?? []).map((r) => ({
      value: String(r.rep_id),
      label: String(r.rep_name),
    })),
    corridor: (corridors.data ?? []).map((r) => ({
      value: String(r.corridor),
      label: String(r.corridor),
    })),
  };
  const labels: Record<FilterKey, string> = {
    segment: "Segment",
    lead_source: "Lead source",
    owner_id: "Rep",
    corridor: "Corridor",
  };
  const active = show.some((k) => f[k]) || f.period !== "t12";
  return (
    <div
      role="search"
      aria-label="Filters"
      className="glass-bar sticky top-[4.75rem] z-10 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl px-3 py-2"
    >
      <div
        className="flex rounded-lg bg-foreground/5 p-0.5"
        role="group"
        aria-label="Period"
      >
        {(Object.keys(PERIODS) as PeriodKey[]).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={f.period === k}
            onClick={() => set({ period: k })}
            className={
              f.period === k
                ? "rounded-md bg-card px-3 py-1 text-sm font-medium shadow-sm"
                : "rounded-md px-3 py-1 text-sm text-ink-secondary hover:text-foreground"
            }
          >
            {PERIODS[k].label}
          </button>
        ))}
      </div>
      {show.map((k) => (
        <Select
          key={k}
          name={k}
          label={labels[k]}
          value={f[k]}
          options={options[k]}
          onChange={(v) => set({ [k]: v })}
        />
      ))}
      {active && (
        <button
          type="button"
          onClick={() =>
            set({
              period: "t12",
              segment: undefined,
              lead_source: undefined,
              owner_id: undefined,
              corridor: undefined,
            })
          }
          className="ml-auto text-sm text-ink-secondary underline-offset-4 hover:text-foreground hover:underline"
        >
          Reset filters
        </button>
      )}
    </div>
  );
}
