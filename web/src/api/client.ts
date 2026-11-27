import type { CardSlug, ParamName } from "./cards.generated";

/** What the proxy returns for a card: column names and types, and the rows. */
export interface CardResult {
  card: CardSlug;
  columns: { name: string; type: string }[];
  rows: unknown[][];
}

export type CardParams = Partial<Record<ParamName, string>>;

export class CardError extends Error {}

/** Static demo (PLAN.md Stage 7): cards come from files written by the snapshot exporter. */
export const SNAPSHOT = import.meta.env.VITE_MODE === "snapshot";
const files = new Map<string, Promise<Record<string, CardResult>>>();

/** The same key the exporter writes: parameters sorted by name. */
export function snapshotKey(parameters: CardParams): string {
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(parameters).sort(([a], [b]) => a.localeCompare(b)),
    ),
  );
}

async function fetchSnapshot(
  slug: CardSlug,
  parameters: CardParams,
): Promise<CardResult> {
  let file = files.get(slug);
  if (!file) {
    file = fetch(`${import.meta.env.BASE_URL}snapshot/${slug}.json`).then(
      (res) => {
        if (!res.ok) throw new CardError(`no snapshot for ${slug}`);
        return res.json() as Promise<Record<string, CardResult>>;
      },
    );
    files.set(slug, file);
    file.catch(() => files.delete(slug));
  }
  const hit = (await file)[snapshotKey(parameters)];
  if (!hit)
    throw new CardError(
      "This filter combination isn't in the static demo. Reset the filters.",
    );
  return hit;
}

/** Run one allow-listed card: through the proxy (live mode) or from the snapshot files. */
export async function fetchCard(
  slug: CardSlug,
  parameters: CardParams = {},
): Promise<CardResult> {
  if (SNAPSHOT) return fetchSnapshot(slug, parameters);
  const res = await fetch(`/api/cards/${slug}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ parameters }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new CardError(body.error ?? `card ${slug} failed (${res.status})`);
  }
  return (await res.json()) as CardResult;
}
