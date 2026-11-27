import { useQuery } from "@tanstack/react-query";
import type { CardSlug } from "./cards.generated";
import { fetchCard, type CardParams, type CardResult } from "./client";

/** Rows as objects keyed by column name: easier for charts than positional arrays. */
export type Row = Record<string, unknown>;

export function toRows(r: CardResult): Row[] {
  return r.rows.map((row) =>
    Object.fromEntries(r.columns.map((c, i) => [c.name, row[i]])),
  );
}

export function useCard(slug: CardSlug, params: CardParams) {
  return useQuery({
    queryKey: ["card", slug, params],
    queryFn: () => fetchCard(slug, params),
    select: toRows,
  });
}
