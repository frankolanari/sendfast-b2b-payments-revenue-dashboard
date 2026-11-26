/**
 * The same /api as the Metabase proxy, answered by running metabase/cards/*.sql straight in
 * Postgres. Local only (reads files, uses node-postgres); see
 * docs/superpowers/specs/2026-11-26-direct-postgres-design.md.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  cards,
  parameterContract,
  type ParamName,
} from "../../web/src/api/cards.generated";
import { CardError, createCardApp } from "./app";

const CARD_DIR = join(import.meta.dirname, "../../metabase/cards");
const ROW_LIMIT = 2000; // Metabase's limit for a saved native query

const sqlByName = new Map(
  readdirSync(CARD_DIR)
    .filter((file) => file.endsWith(".sql"))
    .map((file) => {
      const sql = readFileSync(join(CARD_DIR, file), "utf8");
      return [/^-- name: (.+)$/m.exec(sql)?.[1]?.trim() ?? file, sql] as const;
    }),
);

/** Metabase template syntax -> SQL with bound parameters. */
export function renderQuery(
  sql: string,
  given: Record<string, string>,
): { text: string; values: string[] } {
  const values: string[] = [];
  const placeholders = new Map<string, string>();
  const body = sql
    .replace(/^\s*--.*$/gm, "")
    // An optional clause stays only when every value it names was given.
    .replace(/\[\[([\s\S]*?)\]\]/g, (_, clause: string) =>
      [...clause.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].every((m) =>
        Object.hasOwn(given, m[1]!),
      )
        ? clause
        : "",
    );
  const text = body.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, name: string) => {
    let placeholder = placeholders.get(name);
    if (!placeholder) {
      const spec = parameterContract[name as ParamName];
      const value =
        given[name] ?? (spec && "default" in spec ? spec.default : undefined);
      if (value === undefined)
        throw new Error(`no value for parameter ${name}`);
      values.push(value);
      const type = spec.type === "date" ? "date" : "text";
      placeholder = `$${values.length}::${type}`;
      placeholders.set(name, placeholder);
    }
    return placeholder;
  });
  return { text: text.trim().replace(/;$/, ""), values };
}

// Postgres type id -> the base type name Metabase reports for it.
const BASE_TYPES: Record<number, string> = {
  16: "type/Boolean",
  20: "type/BigInteger",
  21: "type/Integer",
  23: "type/Integer",
  25: "type/Text",
  700: "type/Float",
  701: "type/Float",
  1042: "type/Text",
  1043: "type/Text",
  1082: "type/Date",
  1114: "type/DateTime",
  1184: "type/DateTimeWithLocalTZ",
  1700: "type/Decimal",
};

export interface DirectConfig {
  /** Runs one query and returns rows as arrays, values already in their JSON form. */
  query: (
    text: string,
    values: string[],
  ) => Promise<{
    fields: { name: string; dataTypeID: number }[];
    rows: unknown[][];
  }>;
}

export function createDirectApp({ query }: DirectConfig) {
  return createCardApp(async (slug, parameters) => {
    const sql = sqlByName.get(cards[slug].name);
    if (!sql) throw new CardError(`card ${slug} has no SQL file`);
    const { text, values } = renderQuery(sql, parameters);
    let out;
    try {
      out = await query(text, values);
    } catch (err) {
      console.error(`card ${slug}:`, (err as Error).message);
      throw new CardError("the query failed");
    }
    return {
      card: slug,
      columns: out.fields.map((f) => ({
        name: f.name,
        type: BASE_TYPES[f.dataTypeID] ?? "type/*",
      })),
      rows: out.rows.slice(0, ROW_LIMIT),
    };
  });
}
