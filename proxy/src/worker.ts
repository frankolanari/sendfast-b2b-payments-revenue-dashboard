/** Cloudflare Workers entry point (Stage 10): the same app, configured from Worker secrets. */
import pg from "pg";
import { databaseConfig, setTypeParsers, type Env } from "./postgres";
import { createApp } from "./query";

setTypeParsers();

export default {
  fetch(request: Request, env: Env): Response | Promise<Response> {
    // A Worker may not share a connection between requests: one client per query. Put a pooler
    // (Hyperdrive) in front of the database when deploying.
    const app = createApp({
      query: async (text, values) => {
        const client = new pg.Client(databaseConfig(env));
        await client.connect();
        try {
          return await client.query({ text, values, rowMode: "array" });
        } finally {
          await client.end();
        }
      },
    });
    return app.fetch(request);
  },
};
