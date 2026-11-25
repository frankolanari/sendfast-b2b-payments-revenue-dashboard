import { describe, expect, it, vi } from "vitest";
import { checkParameters, createApp, metabaseParameters } from "./app";

const KEY = "test-key-not-real";

function fakeMetabase(overrides: Partial<Record<string, () => Response>> = {}) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetchMock = vi.fn(
    async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url);
      calls.push({ url: u, init });
      if (u.endsWith("/api/card?f=all")) {
        return (
          overrides.list?.() ??
          Response.json([
            { id: 11, name: "Win rate" },
            { id: 12, name: "Pipeline created (USD)" },
            { id: 99, name: "Win rate", archived: true },
          ])
        );
      }
      if (
        u.includes("/api/card/11/query") ||
        u.includes("/api/card/12/query")
      ) {
        return (
          overrides.query?.() ??
          Response.json({
            status: "completed",
            data: {
              cols: [
                { name: "win_rate", base_type: "type/Decimal", extra: "x" },
              ],
              rows: [[0.33]],
            },
          })
        );
      }
      return new Response("not found", { status: 404 });
    },
  );
  const app = createApp({
    metabaseUrl: "http://mb.test/",
    apiKey: KEY,
    fetch: fetchMock as typeof fetch,
  });
  return { app, calls };
}

const post = (
  app: ReturnType<typeof createApp>,
  slug: string,
  body?: unknown,
) =>
  app.request(`/api/cards/${slug}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

describe("checkParameters", () => {
  it("accepts the card's own parameters with valid values", () => {
    expect(
      checkParameters("win_rate", { date_from: "2025-11-01", segment: "smb" }),
    ).toEqual([]);
  });
  it("rejects a parameter the card doesn't take", () => {
    expect(
      checkParameters("open_pipeline", { date_from: "2025-11-01" })[0],
    ).toMatch(/not accepted/);
  });
  it("rejects a bad date, a value outside a static list and SQL-ish text", () => {
    expect(checkParameters("win_rate", { date_from: "2025-13-45" })[0]).toMatch(
      /date/,
    );
    expect(checkParameters("win_rate", { segment: "giant" })[0]).toMatch(
      /one of/,
    );
    expect(
      checkParameters("win_rate", { owner_id: "1; drop table x --" })[0],
    ).toMatch(/characters/);
    expect(checkParameters("win_rate", { owner_id: 7 })[0]).toMatch(/string/);
  });
});

describe("metabaseParameters", () => {
  it("targets native template tags; text values are lists", () => {
    expect(
      metabaseParameters({ date_to: "2026-09-30", segment: "smb" }),
    ).toEqual([
      {
        id: "date_to",
        type: "date/single",
        target: ["variable", ["template-tag", "date_to"]],
        value: "2026-09-30",
      },
      {
        id: "segment",
        type: "string/=",
        target: ["variable", ["template-tag", "segment"]],
        value: ["smb"],
      },
    ]);
  });
});

describe("POST /api/cards/:slug", () => {
  it("runs an allowed card through Metabase with the key, and returns columns and rows only", async () => {
    const { app, calls } = fakeMetabase();
    const res = await post(app, "win_rate", {
      parameters: { date_from: "2025-11-01" },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      card: "win_rate",
      columns: [{ name: "win_rate", type: "type/Decimal" }],
      rows: [[0.33]],
    });
    const query = calls.find((c) => c.url.endsWith("/api/card/11/query"))!;
    expect(new Headers(query.init!.headers).get("x-api-key")).toBe(KEY);
    expect(JSON.parse(String(query.init!.body)).parameters[0].id).toBe(
      "date_from",
    );
  });

  it("never returns the API key to the browser", async () => {
    const { app } = fakeMetabase();
    const res = await post(app, "win_rate", {});
    expect(await res.text()).not.toContain(KEY);
    expect([...res.headers.values()].join(" ")).not.toContain(KEY);
  });

  it("refuses cards that aren't in the allow-list, without calling Metabase", async () => {
    const { app, calls } = fakeMetabase();
    expect((await post(app, "drop_everything", {})).status).toBe(404);
    expect(calls).toHaveLength(0);
  });

  it("refuses bad parameters with 400, without calling Metabase", async () => {
    const { app, calls } = fakeMetabase();
    const res = await post(app, "win_rate", {
      parameters: { segment: "giant" },
    });
    expect(res.status).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it("caches card ids and skips archived duplicates", async () => {
    const { app, calls } = fakeMetabase();
    await post(app, "win_rate", {});
    await post(app, "pipeline_created", {});
    expect(calls.filter((c) => c.url.endsWith("/api/card?f=all"))).toHaveLength(
      1,
    );
    expect(calls.some((c) => c.url.includes("/api/card/99/"))).toBe(false);
  });

  it("turns Metabase failures into 502 without leaking details", async () => {
    const { app } = fakeMetabase({
      query: () => Response.json({ status: "failed", error: "secret sql" }),
    });
    const res = await post(app, "win_rate", {});
    expect(res.status).toBe(502);
    expect(await res.text()).not.toContain("secret sql");
  });

  it("502 when the card isn't in Metabase yet", async () => {
    const { app } = fakeMetabase({ list: () => Response.json([]) });
    expect((await post(app, "win_rate", {})).status).toBe(502);
  });
});
