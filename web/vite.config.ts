import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Dev: /api goes to the local proxy (which alone holds the Metabase key). Ports from env.
const proxyPort = process.env.PROXY_PORT ?? "8787";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "./src") } },
  server: {
    port: Number(process.env.WEB_PORT ?? 5173),
    strictPort: true,
    proxy: { "/api": `http://localhost:${proxyPort}` },
  },
});
