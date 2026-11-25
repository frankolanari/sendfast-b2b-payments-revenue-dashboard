/** Local entry point: the proxy on Node, configured from env only (cloud-ready rule 1). */
import { serve } from "@hono/node-server";
import { createApp } from "./app";

const metabaseUrl = process.env.MB_SITE_URL;
const apiKey = process.env.MB_API_KEY;
if (!metabaseUrl || !apiKey) {
  console.error(
    "Set MB_SITE_URL and MB_API_KEY (make metabase-bootstrap writes .env.metabase).",
  );
  process.exit(1);
}
const port = Number(process.env.PROXY_PORT ?? 8787);
serve({ fetch: createApp({ metabaseUrl, apiKey }).fetch, port }, () => {
  console.log(`proxy listening on http://localhost:${port} -> ${metabaseUrl}`);
});
