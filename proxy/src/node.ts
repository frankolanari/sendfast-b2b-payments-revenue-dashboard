/** Local entry point: the dashboard server on Node, configured from env only (cloud-ready rule 1). */
import { serve } from "@hono/node-server";
import pg from "pg";
import { databaseConfig, setTypeParsers } from "./postgres";
import { createApp } from "./query";

setTypeParsers();
const pool = new pg.Pool(databaseConfig(process.env));
const app = createApp({
  query: (text, values) => pool.query({ text, values, rowMode: "array" }),
});
const port = Number(process.env.PROXY_PORT ?? 8788);
serve({ fetch: app.fetch, port }, () => {
  console.log(`dashboard server on http://localhost:${port} -> Postgres`);
});
