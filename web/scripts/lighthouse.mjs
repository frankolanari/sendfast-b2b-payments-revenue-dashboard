// Gate 7: Lighthouse accessibility >= 90 on each page, in both themes' default (dark),
// against the snapshot preview. Usage: node scripts/lighthouse.mjs (starts its own server).
import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";
import { launch } from "chrome-launcher";
import lighthouse from "lighthouse";

const PORT = Number(process.env.LH_PORT ?? 4175);
const MIN = 0.9;
const PAGES = ["/pipeline", "/revenue", "/risk", "/accounts"];
const base = `http://localhost:${PORT}`;

const server = spawn(
  "pnpm",
  [
    "exec",
    "vite",
    "preview",
    "--outDir",
    "dist-snapshot",
    "--port",
    String(PORT),
    "--strictPort",
  ],
  { stdio: "ignore" },
);
let chrome;
let failed = false;
try {
  for (let i = 0; i < 60; i++) {
    if (
      await fetch(base).then(
        (r) => r.ok,
        () => false,
      )
    )
      break;
    await new Promise((r) => setTimeout(r, 500));
  }
  chrome = await launch({
    chromePath: chromium.executablePath(),
    chromeFlags: ["--headless=new", "--no-sandbox"],
  });
  for (const path of PAGES) {
    const result = await lighthouse(base + path, {
      port: chrome.port,
      onlyCategories: ["accessibility"],
      output: "json",
      logLevel: "error",
    });
    const { categories, audits, runtimeError } = result.lhr;
    if (runtimeError) throw new Error(`${path}: ${runtimeError.message}`);
    const score = categories.accessibility.score;
    console.log(
      `${score >= MIN ? "PASS" : "FAIL"}  ${path}  accessibility ${Math.round(score * 100)}`,
    );
    for (const ref of categories.accessibility.auditRefs) {
      const a = audits[ref.id];
      if (ref.weight > 0 && a.score !== null && a.score < 1) {
        const nodes = (a.details?.items ?? [])
          .slice(0, 3)
          .map((x) => x.node?.selector)
          .filter(Boolean);
        console.log(`        ${ref.id}: ${a.title} ${nodes.join(" | ")}`);
      }
    }
    if (score < MIN) failed = true;
  }
} finally {
  await chrome?.kill();
  server.kill();
}
process.exit(failed ? 1 : 0);
