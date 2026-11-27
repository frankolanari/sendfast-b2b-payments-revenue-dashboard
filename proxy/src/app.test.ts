import { describe, expect, it, vi } from "vitest";
import { cards, parameterContract } from "../../web/src/api/cards.generated";
import { checkParameters } from "./app";
import { createApp, renderQuery, type AppConfig } from "./query";
import { cardSql } from "./sql.generated";

const SECRET = "synthetic-password-not-real";

function fakeDatabase(fail = false, rows: unknown[][] = [[0.33]]) {
  const query = vi.fn<AppConfig["query"]>(async () => {
    if (fail) throw new Error(`auth failed for ${SECRET}: select secret_sql`);
    return { fields: [{ name: "win_rate", dataTypeID: 1700 }], rows };
  });
  return { app: createApp({ query }), query };
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

describe("renderQuery", () => {
  const SQL = `-- name: Demo {{ignored}} [[ ignored ]]
select * from t
where d <= {{date_to}}
  [[ and segment = {{segment}} ]]
  [[ and (owner_id = {{owner_id}} or segment = {{segment}}) ]]`;

  it("binds values, reuses a placeholder and drops clauses without a value", () => {
    const q = renderQuery(SQL, { segment: "smb" });
    expect(q.text).toContain("d <= $1::date");
    expect(q.text).toContain("and segment = $2::text");
    expect(q.text).not.toContain("owner_id");
    expect(q.text).not.toContain("ignored");
    expect(q.values).toEqual(["2026-10-31", "smb"]);
  });

  it("never puts a value into the SQL text", () => {
    const q = renderQuery(SQL, { segment: "x' or '1'='1" });
    expect(q.text).not.toContain("'1'='1");
  });

  it("uses the given value over the contract default", () => {
    expect(renderQuery(SQL, { date_to: "2026-01-31" }).values).toEqual([
      "2026-01-31",
    ]);
  });

  it("renders every committed card, with and without all its parameters", () => {
    for (const [slug, card] of Object.entries(cards)) {
      const all = Object.fromEntries(
        card.params.map((p) => [
          p,
          parameterContract[p].type === "date" ? "2026-01-31" : "x",
        ]),
      );
      for (const given of [{}, all]) {
        const q = renderQuery(cardSql[slug]!, given);
        expect(q.text, slug).not.toMatch(/\{\{|\[\[/);
      }
    }
  });
});

describe("POST /api/cards/:slug", () => {
  it("runs an allowed card and returns columns and rows only", async () => {
    const { app, query } = fakeDatabase();
    const res = await post(app, "win_rate", {
      parameters: { date_from: "2025-11-01" },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      card: "win_rate",
      columns: [{ name: "win_rate", type: "type/Decimal" }],
      rows: [[0.33]],
    });
    expect(query.mock.calls[0]![1]).toContain("2025-11-01");
  });

  it("returns at most 2000 rows", async () => {
    const { app } = fakeDatabase(
      false,
      Array.from({ length: 2001 }, () => [1]),
    );
    const body = (await (await post(app, "win_rate", {})).json()) as {
      rows: unknown[];
    };
    expect(body.rows).toHaveLength(2000);
  });

  it("refuses cards that aren't in the allow-list, without querying", async () => {
    const { app, query } = fakeDatabase();
    expect((await post(app, "drop_everything", {})).status).toBe(404);
    expect(query).not.toHaveBeenCalled();
  });

  it("ignores SQL sent by the browser", async () => {
    const { app, query } = fakeDatabase();
    await post(app, "win_rate", { sql: "select secret", query: "select 1" });
    expect(query.mock.calls[0]![0]).not.toContain("secret");
  });

  it("refuses bad parameters with 400, without querying", async () => {
    const { app, query } = fakeDatabase();
    const res = await post(app, "win_rate", {
      parameters: { segment: "giant" },
    });
    expect(res.status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });

  it("turns database failures into 502 without leaking details", async () => {
    const { app } = fakeDatabase(true);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await post(app, "win_rate", {});
    const text = await res.text();
    expect(res.status).toBe(502);
    expect(text).not.toContain(SECRET);
    expect(text).not.toContain("secret_sql");
    log.mockRestore();
  });
});
