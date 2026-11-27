/**
 * Answers a card by running its committed SQL in Postgres. `{{name}}` becomes a bound parameter
 * and a `[[ ... ]]` clause drops out when its value is missing (queries/parameters.yml).
 */
import {
  parameterContract,
  type ParamName,
} from "../../web/src/api/cards.generated";
import { CardError, createCardApp } from "./app";
import { cardSql } from "./sql.generated";

const ROW_LIMIT = 2000; // no card needs more; protects the browser

/** Card SQL -> SQL with bound parameters. Values are never pasted into the text. */
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

// Postgres type id -> the column type the web app formats by.
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

export interface AppConfig {
  /** Runs one query and returns rows as arrays, values already in their JSON form. */
  query: (
    text: string,
    values: string[],
  ) => Promise<{
    fields: { name: string; dataTypeID: number }[];
    rows: unknown[][];
  }>;
}

export function createApp({ query }: AppConfig) {
  return createCardApp(async (slug, parameters) => {
    const sql = cardSql[slug];
    if (!sql) throw new CardError(`card ${slug} has no query`);
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
