import { expect, test, type Page } from "@playwright/test";

const PAGES = [
  {
    path: "/pipeline",
    name: "pipeline",
    charts: [
      "Sales funnel",
      "Pipeline ageing",
      "Sales velocity",
      "Deal outcomes",
      "Pipeline created by month",
      "Win rate by lead source",
      "Time in stage",
      "Open pipeline by rep",
      "Deals",
    ],
  },
  {
    path: "/revenue",
    name: "revenue",
    charts: [
      "Monthly net revenue",
      "Revenue bridge",
      "Cohort retention",
      "Churn by activation speed",
      "First-year revenue by lead source",
    ],
  },
  {
    path: "/risk",
    name: "risk",
    charts: [
      "At-risk accounts",
      "Account health",
      "Revenue at risk by rep",
      "Failure rate by corridor",
      "Corridor and rail failures",
      "Revenue concentration",
      "Disputes and returns",
    ],
  },
  {
    path: "/accounts",
    name: "account-360",
    charts: [
      "Account profile",
      "Net revenue",
      "Payment volume",
      "Health score",
      "Timeline",
      "Deals",
    ],
  },
];

function watchConsole(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

async function settled(page: Page) {
  await expect(
    page.locator('[aria-busy="true"], [aria-label="Loading"]'),
  ).toHaveCount(0, { timeout: 30_000 });
}

// Every finite animation has finished (loading shimmers repeat for ever and are gone by now).
async function drawn(page: Page) {
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every(
        (a) =>
          a.playState !== "running" ||
          a.effect?.getTiming().iterations === Infinity,
      ),
  );
  // The chart kit also tweens in script, which getAnimations() cannot see.
  await page.waitForTimeout(2_000);
}

for (const p of PAGES) {
  test(`${p.name}: every chart renders with no console errors`, async ({
    page,
  }) => {
    const errors = watchConsole(page);
    // Charts animate in; without this the evidence screenshot catches them half drawn.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(p.path);
    for (const chart of p.charts) {
      const heading = page.getByRole("heading", {
        level: 2,
        name: chart,
        exact: true,
      });
      await expect(heading).toBeVisible();
    }
    await settled(page);
    await expect(
      page.getByText(/couldn.t load|isn.t in the static demo/i),
    ).toHaveCount(0);
    await drawn(page);
    await page.screenshot({
      path: `test-results/screens/${p.name}.png`,
      fullPage: true,
    });
    expect(errors).toEqual([]);
  });
}

test("filters: one at a time in the static demo, kept in the URL, removable", async ({
  page,
}) => {
  const errors = watchConsole(page);
  await page.goto("/pipeline");
  await settled(page);
  await page.locator('select[name="segment"]').selectOption("smb");
  await expect(page).toHaveURL(/segment=smb/);
  await expect(page.locator('select[name="lead_source"]')).toBeDisabled();
  await settled(page);
  await expect(
    page.getByText(/couldn.t load|isn.t in the static demo/i),
  ).toHaveCount(0);
  await page.getByRole("button", { name: /Remove filter Segment/ }).click();
  await expect(page).not.toHaveURL(/segment=/);
  expect(errors).toEqual([]);
});

test("group by and focus change the outcomes chart", async ({ page }) => {
  await page.goto("/pipeline");
  await settled(page);
  await page
    .getByRole("group", { name: "Deal outcomes: group by" })
    .getByRole("button", { name: "Rep" })
    .click();
  await expect(page).toHaveURL(/outcome_by=rep/);
  const cards = page
    .getByRole("list", { name: "Focus on a group" })
    .getByRole("button");
  await cards.nth(2).click();
  await expect(cards.nth(2)).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/outcome_focus=/);
});

test("drill-through: an account name opens Account 360", async ({ page }) => {
  const errors = watchConsole(page);
  await page.goto("/risk");
  await settled(page);
  // The concentration list has rows at every data scale (the at-risk list may be empty).
  const link = page
    .locator("section", {
      has: page.getByRole("heading", {
        name: "Revenue concentration",
        exact: true,
      }),
    })
    .getByRole("link")
    .first();
  const name = await link.innerText();
  await link.click();
  await expect(page).toHaveURL(/\/accounts\?.*account=/);
  await settled(page);
  await expect(page.locator("#account-picker option:checked")).toHaveText(name);
  await expect(
    page.getByText(/couldn.t load|isn.t in the static demo/i),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("every chart offers its data and a CSV", async ({ page }) => {
  await page.goto("/revenue");
  await settled(page);
  await page.getByRole("button", { name: "Show data: Revenue bridge" }).click();
  await expect(
    page.getByRole("region", { name: "Revenue bridge: data" }),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download Revenue bridge as CSV" })
    .click();
  expect((await download).suggestedFilename()).toBe("revenue-bridge.csv");
});
