import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { fetchCard } from "@/api/client";
import type { CardSlug } from "@/api/cards.generated";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: Infinity, retry: 1 } },
});

// Work-in-progress preview (Stage 7). Replaced page by page as the real dashboard is built.
const PAGES = [
  "Pipeline & funnel",
  "Revenue & retention",
  "Account health & risk",
  "Account 360",
];
const LIVE: { slug: CardSlug; label: string }[] = [
  { slug: "pipeline_created", label: "Pipeline created (USD)" },
  { slug: "win_rate", label: "Win rate" },
  { slug: "net_revenue", label: "Net revenue (USD)" },
  { slug: "total_payment_volume", label: "Total payment volume (USD)" },
];

function LiveValue({ slug, label }: { slug: CardSlug; label: string }) {
  const q = useQuery({
    queryKey: ["card", slug],
    queryFn: () => fetchCard(slug),
  });
  const value = q.data?.rows[0]?.[0];
  return (
    <div className="rounded-xl border p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">
        {q.isPending ? "…" : q.isError ? "error" : String(value)}
      </div>
    </div>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <main className="mx-auto max-w-5xl p-6">
        <h1 className="text-xl font-semibold">SendFast revenue</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Work in progress. Live data: browser → proxy → Metabase → marts (all
          time, no filters yet).
        </p>
        <nav className="mt-4 flex gap-2 text-sm">
          {PAGES.map((p) => (
            <span
              key={p}
              className="rounded-full border px-3 py-1 text-muted-foreground"
            >
              {p}
            </span>
          ))}
        </nav>
        <section className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          {LIVE.map((c) => (
            <LiveValue key={c.slug} {...c} />
          ))}
        </section>
      </main>
    </QueryClientProvider>
  );
}
