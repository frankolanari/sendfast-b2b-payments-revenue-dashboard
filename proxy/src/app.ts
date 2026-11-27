/**
 * The dashboard's API (PLAN.md Stage 7, D1). The browser calls this; only this talks to the
 * database. It runs the committed queries only, from an allow-list generated from queries/cards,
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
