import { defineConfig, devices } from "@playwright/test";

// End-to-end against snapshot mode (PLAN.md Stage 7): no Metabase needed at test time.
const port = Number(process.env.E2E_PORT ?? 4174);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0, // deterministic data: a flaky test is a bug (PLAN.md 4A)
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${port}`,
    viewport: { width: 1440, height: 1000 },
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 },
      },
    },
  ],
  webServer: {
    command: `pnpm exec vite preview --outDir dist-snapshot --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: false,
  },
});
