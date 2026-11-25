import type { CardSlug, ParamName } from "./cards.generated";

/** What the proxy returns for a card: column names and types, and the rows. */
export interface CardResult {
  card: CardSlug;
  columns: { name: string; type: string }[];
  rows: unknown[][];
}

export type CardParams = Partial<Record<ParamName, string>>;

export class CardError extends Error {}

/** Run one allow-listed card through the proxy (live mode). */
export async function fetchCard(
  slug: CardSlug,
  parameters: CardParams = {},
): Promise<CardResult> {
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
