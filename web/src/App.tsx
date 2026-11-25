import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { fetchCard } from "@/api/client";
import type { CardSlug } from "@/api/cards.generated";
import { currency, percent } from "@/lib/format";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: Infinity, retry: 1 } },
});

// Work-in-progress preview (Stage 7): the shell and tiles in the new design direction.
// Replaced page by page as the real dashboard is built.
const PAGES = [
  "Pipeline & funnel",
  "Revenue & retention",
  "Account health & risk",
  "Account 360",
];
const TRAILING_12 = { date_from: "2025-11-01", date_to: "2026-10-31" };

const TILES: {
  slug: CardSlug;
  label: string;
  format: (v: unknown) => string;
}[] = [
  {
    slug: "pipeline_created",
    label: "Pipeline created",
    format: (v) => currency(v),
  },
  { slug: "win_rate", label: "Win rate", format: (v) => percent(v) },
  { slug: "net_revenue", label: "Net revenue", format: (v) => currency(v) },
  {
    slug: "total_payment_volume",
    label: "Payment volume",
    format: (v) => currency(v),
  },
];

function KpiTile({ slug, label, format }: (typeof TILES)[number]) {
  const q = useQuery({
    queryKey: ["card", slug, TRAILING_12],
    queryFn: () => fetchCard(slug, TRAILING_12),
  });
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="text-sm text-muted-foreground">{label}</div>
      {/* No tabular-nums here: Cal Sans makes the decimal point full-width under it. */}
      <div className="mt-3 font-display text-4xl tracking-tight">
        {q.isPending ? (
          <span className="inline-block h-9 w-28 animate-pulse rounded-md bg-muted" />
        ) : q.isError ? (
          <span className="text-base text-destructive">Couldn't load</span>
        ) : (
          format(q.data.rows[0]?.[0])
        )}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        Nov 2025 – Oct 2026
      </div>
    </div>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-background">
        <header className="sticky top-2 z-10 mx-auto mt-2 flex max-w-6xl items-center gap-6 rounded-2xl bg-muted/80 px-4 py-2.5 backdrop-blur">
          <span className="font-display text-xl tracking-tight">SendFast</span>
          <nav className="flex gap-1 text-sm" aria-label="Pages">
            {PAGES.map((p, i) => (
              <span
                key={p}
                className={
                  i === 0
                    ? "rounded-lg bg-card px-3 py-1.5 font-medium shadow-sm"
                    : "rounded-lg px-3 py-1.5 text-ink-secondary"
                }
              >
                {p}
              </span>
            ))}
          </nav>
          <span className="ml-auto rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground">
            Synthetic data
          </span>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-10">
          <span className="rounded-md border bg-card px-2 py-1 text-xs uppercase tracking-widest text-muted-foreground">
            Work in progress
          </span>
          <h1 className="mt-4 font-display text-5xl tracking-tight">
            Pipeline &amp; funnel
          </h1>
          <p className="mt-2 max-w-2xl text-ink-secondary">
            Live from Metabase through the proxy, trailing 12 months. Charts,
            filters and the other pages come next.
          </p>
          <section className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {TILES.map((t) => (
              <KpiTile key={t.slug} {...t} />
            ))}
          </section>
          <section className="mt-6 rounded-2xl bg-paper p-6">
            <div className="font-display text-2xl tracking-tight">
              Insight panels use the warm paper colour
            </div>
            <p className="mt-1 text-sm text-ink-secondary">
              Chart titles will state the finding, e.g. "Partner leads close at
              27%, the lowest of any source".
            </p>
          </section>
        </main>
      </div>
    </QueryClientProvider>
  );
}
