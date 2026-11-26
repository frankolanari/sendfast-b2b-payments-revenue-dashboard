import { describe, expect, it, vi } from "vitest";
import { createDirectApp, renderQuery } from "./direct";

const SQL = `-- name: Demo {{ignored}} [[ ignored ]]
select * from t
where d <= {{date_to}}
  [[ and segment = {{segment}} ]]
  [[ and (owner_id = {{owner_id}} or segment = {{segment}}) ]]`;

describe("renderQuery", () => {
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

  it("uses the given value over the default", () => {
    expect(renderQuery(SQL, { date_to: "2026-01-31" }).values).toEqual([
      "2026-01-31",
    ]);
  });
});

describe("createDirectApp", () => {
  const post = (app: ReturnType<typeof createDirectApp>, body: unknown) =>
    app.request("/api/cards/lead_funnel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  it("returns columns and rows in the Metabase proxy's shape, at most 2000 rows", async () => {
    const query = vi.fn(async () => ({
      fields: [{ name: "reached", dataTypeID: 20 }],
      rows: Array.from({ length: 2001 }, () => [1]),
    }));
    const res = await post(createDirectApp({ query }), {});
    const body = (await res.json()) as { rows: unknown[] };
    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      card: "lead_funnel",
      columns: [{ name: "reached", type: "type/BigInteger" }],
    });
    expect(body.rows).toHaveLength(2000);
  });

  it("rejects a bad parameter without querying", async () => {
    const query = vi.fn();
    const res = await post(createDirectApp({ query }), {
      parameters: { segment: "nope" },
    });
    expect(res.status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });

  it("hides database errors", async () => {
    const query = vi.fn(async () => {
      throw new Error("password authentication failed");
    });
    const res = await post(createDirectApp({ query }), {});
    expect(res.status).toBe(502);
    expect(await res.text()).not.toContain("password");
  });
});
