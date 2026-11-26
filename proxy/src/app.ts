/**
 * The Metabase proxy (PLAN.md Stage 7, D1). The browser calls this; only this holds the
 * Metabase API key. It runs saved cards only, from an allow-list generated from metabase/cards,
 * with parameters checked against the shared parameter contract. Web-standard APIs only, so the
 * same app runs on Node (local) and Cloudflare Workers (Stage 10): cloud-ready rule 6.
 */
import { Hono } from "hono";
import {
  cards,
  parameterContract,
  type CardSlug,
  type ParamName,
} from "../../web/src/api/cards.generated";

export interface ProxyConfig {
  /** Metabase base URL, e.g. http://localhost:3000 (from env, never hard-coded). */
  metabaseUrl: string;
  /** The view-only API key the bootstrap created (from env; never sent to the browser). */
  apiKey: string;
  /** Injected for tests; defaults to the global fetch. */
  fetch?: typeof fetch;
}

export interface CardResult {
  card: CardSlug;
  columns: { name: string; type: string }[];
  rows: unknown[][];
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TEXT_RE = /^[\p{L}\p{N} _.,:&'()/-]{1,120}$/u;

/** Validate a request's parameters against the card and the contract. Returns errors, or []. */
export function checkParameters(
  slug: CardSlug,
  given: Record<string, unknown>,
): string[] {
  const card = cards[slug];
  const allowed = new Set<string>(card.params);
  const errors: string[] = [];
  for (const [name, value] of Object.entries(given)) {
    if (!allowed.has(name)) {
      errors.push(`parameter ${name} is not accepted by ${slug}`);
      continue;
    }
    const spec = parameterContract[name as ParamName];
    if (typeof value !== "string") {
      errors.push(`parameter ${name} must be a string`);
    } else if (
      spec.type === "date" &&
      (!DATE_RE.test(value) || Number.isNaN(Date.parse(value)))
    ) {
      errors.push(`parameter ${name} must be a date (YYYY-MM-DD)`);
    } else if (spec.type === "text" && !TEXT_RE.test(value)) {
      errors.push(
        `parameter ${name} has characters or a length that isn't allowed`,
      );
    } else if (
      "values" in spec &&
      !(spec.values as readonly string[]).includes(value)
    ) {
      errors.push(`parameter ${name} must be one of ${spec.values.join(", ")}`);
    }
  }
  return errors;
}

/** Metabase's parameter list for a card query: every value targets a native template tag. */
export function metabaseParameters(given: Record<string, string>) {
  return Object.entries(given).map(([name, value]) => {
    const isDate = parameterContract[name as ParamName].type === "date";
    return {
      id: name,
      type: isDate ? "date/single" : "string/=",
      target: ["variable", ["template-tag", name]],
      value: isDate ? value : [value],
    };
  });
}

/** A card query that could not be answered; the message is safe to show in the browser. */
export class CardError extends Error {}

export type RunCard = (
  slug: CardSlug,
  parameters: Record<string, string>,
) => Promise<CardResult>;

/** The API the browser sees, whatever answers the queries. Parameters are checked here. */
export function createCardApp(run: RunCard) {
  const app = new Hono();

  app.get("/api/health", (c) => c.json({ status: "ok" }));

  app.get("/api/cards", (c) => c.json(cards));

  app.post("/api/cards/:slug", async (c) => {
    const slug = c.req.param("slug");
    if (!Object.hasOwn(cards, slug))
      return c.json({ error: `unknown card ${slug}` }, 404);

    let body: { parameters?: Record<string, unknown> } = {};
    if (c.req.header("content-length") !== "0") {
      try {
        body = await c.req.json();
      } catch {
        return c.json({ error: "body must be JSON" }, 400);
      }
    }
    const given = body.parameters ?? {};
    if (typeof given !== "object" || Array.isArray(given)) {
      return c.json({ error: "parameters must be an object" }, 400);
    }
    const errors = checkParameters(slug as CardSlug, given);
    if (errors.length)
      return c.json({ error: "invalid parameters", details: errors }, 400);

    try {
      return c.json(
        await run(slug as CardSlug, given as Record<string, string>),
      );
    } catch (err) {
      if (err instanceof CardError) return c.json({ error: err.message }, 502);
      throw err;
    }
  });

  return app;
}

export function createApp(config: ProxyConfig) {
  const doFetch = config.fetch ?? fetch;
  const base = config.metabaseUrl.replace(/\/$/, "");
  const headers = {
    "Content-Type": "application/json",
    "x-api-key": config.apiKey,
  };
  let ids: Promise<Map<string, number>> | null = null; // card name -> Metabase id, cached

  async function cardIds(): Promise<Map<string, number>> {
    if (!ids) {
      ids = (async () => {
        const res = await doFetch(`${base}/api/card?f=all`, { headers });
        if (!res.ok) throw new Error(`card list ${res.status}`);
        const list = (await res.json()) as {
          id: number;
          name: string;
          archived?: boolean;
        }[];
        return new Map(
          list.filter((c) => !c.archived).map((c) => [c.name, c.id]),
        );
      })().catch((err) => {
        ids = null; // retry next time
        throw err;
      });
    }
    return ids;
  }

  return createCardApp(async (slug, parameters) => {
    const card = cards[slug];
    let id: number | undefined;
    try {
      id = (await cardIds()).get(card.name);
    } catch {
      throw new CardError("Metabase is unavailable");
    }
    if (id === undefined)
      throw new CardError(`card ${slug} is not in Metabase (bootstrap?)`);

    const res = await doFetch(`${base}/api/card/${id}/query`, {
      method: "POST",
      headers,
      body: JSON.stringify({ parameters: metabaseParameters(parameters) }),
    });
    if (!res.ok) throw new CardError(`Metabase answered ${res.status}`);
    const out = (await res.json()) as {
      status?: string;
      data?: { cols: { name: string; base_type: string }[]; rows: unknown[][] };
    };
    if (out.status !== "completed" || !out.data)
      throw new CardError("the card failed in Metabase");
    return {
      card: slug,
      columns: out.data.cols.map((col) => ({
        name: col.name,
        type: col.base_type,
      })),
      rows: out.data.rows,
    };
  });
}
