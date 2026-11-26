/** Local entry point without Metabase: Postgres as bi_reader, configured from env only. */
import { serve } from "@hono/node-server";
import pg from "pg";
import { createDirectApp } from "./direct";

function env(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Set ${name} (see .env.example).`);
    process.exit(1);
  }
  return value;
}

// Values in the JSON form Metabase uses: numbers as numbers, dates as UTC instants.
const asNumber = (v: string) => Number(v);
const asInstant = (v: string) =>
  new Date(v.length === 10 ? `${v}T00:00:00Z` : v)
    .toISOString()
    .replace(".000Z", "Z");
pg.types.setTypeParser(20, asNumber); // bigint
pg.types.setTypeParser(1700, asNumber); // numeric
pg.types.setTypeParser(1082, asInstant); // date
pg.types.setTypeParser(1184, asInstant); // timestamptz
pg.types.setTypeParser(1114, (v) => asInstant(`${v.replace(" ", "T")}Z`)); // timestamp (UTC, D15)

const pool = new pg.Pool({
  host: env("DATA_DB_HOST"),
  port: Number(env("DATA_DB_HOST_PORT")),
  database: env("DATA_DB_NAME"),
  user: env("BI_READER_USER"),
  password: env("BI_READER_PASSWORD"),
  ssl: process.env.DATA_DB_SSLMODE === "require",
  options:
    "-c timezone=UTC -c default_transaction_read_only=on -c statement_timeout=30000",
});

const app = createDirectApp({
  query: (text, values) => pool.query({ text, values, rowMode: "array" }),
});
const port = Number(process.env.PROXY_PORT ?? 8788);
serve({ fetch: app.fetch, port }, () => {
  console.log(
    `direct server on http://localhost:${port} -> Postgres (no Metabase)`,
  );
});
