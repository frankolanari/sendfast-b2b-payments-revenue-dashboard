/** Cloudflare Workers entry point (Stage 10): the same app, configured from Worker secrets. */
import { createApp } from "./app";

interface Env {
  MB_SITE_URL: string;
  MB_API_KEY: string;
}

let app: ReturnType<typeof createApp> | null = null; // one per isolate, so the card-id cache lives

export default {
  fetch(request: Request, env: Env): Response | Promise<Response> {
    app ??= createApp({ metabaseUrl: env.MB_SITE_URL, apiKey: env.MB_API_KEY });
    return app.fetch(request);
  },
};
