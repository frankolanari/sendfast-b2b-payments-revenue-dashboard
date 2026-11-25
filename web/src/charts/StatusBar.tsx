import { AlertTriangle, CheckCircle2, Eye } from "lucide-react";
import type { Row } from "@/api/useCard";
import { count, percent, toNumber } from "@/lib/format";

const STATUS = [
  {
    key: "healthy",
    label: "Healthy",
    color: "var(--status-good)",
    Icon: CheckCircle2,
  },
  { key: "watch", label: "Watch", color: "var(--status-warning)", Icon: Eye },
  {
    key: "at_risk",
    label: "At risk",
    color: "var(--status-critical)",
    Icon: AlertTriangle,
  },
] as const;

/** One stacked bar of account health. State colours always come with an icon and a label. */
export function StatusBar({ rows }: { rows: Row[] }) {
  const n = (k: string) =>
    toNumber(rows.find((r) => r.health_status === k)?.accounts) ?? 0;
  const total = STATUS.reduce((a, s) => a + n(s.key), 0);
  return (
    <div>
      <div
        className="flex h-8 w-full gap-0.5 overflow-hidden rounded-lg"
        aria-hidden
      >
        {STATUS.filter((s) => n(s.key) > 0).map((s) => (
          <span
            key={s.key}
            style={{
              width: `${(n(s.key) / total) * 100}%`,
              background: s.color,
            }}
          />
        ))}
      </div>
      <ul className="mt-3 grid grid-cols-3 gap-2">
        {STATUS.map(({ key, label, color, Icon }) => (
          <li key={key} className="rounded-lg border px-3 py-2">
            <span className="flex items-center gap-1.5 text-xs text-ink-secondary">
              <Icon className="size-3.5" style={{ color }} aria-hidden />
              {label}
            </span>
            <span className="mt-1 block font-display text-2xl">
              {count(n(key))}
            </span>
            <span className="text-xs text-muted-foreground">
              {total ? percent(n(key) / total) : "–"} of live accounts
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
