import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Dev: /api goes to the local proxy (which alone talks to the database). Ports from env.
const proxyPort = process.env.PROXY_PORT ?? "8787";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Unit tests live beside the code; e2e/ belongs to Playwright (pnpm e2e).
  test: { include: ["src/**/*.test.ts"] },
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "./src") } },
  server: {
    port: Number(process.env.WEB_PORT ?? 5173),
    strictPort: true,
    proxy: { "/api": `http://localhost:${proxyPort}` },
  },
});
