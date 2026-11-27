import { describe, expect, it } from "vitest";
import { snapshotKey } from "./client";

describe("snapshotKey", () => {
  it("matches the exporter's key: sorted, compact", () => {
    expect(snapshotKey({ segment: "smb", date_from: "2025-11-01" })).toBe(
      '{"date_from":"2025-11-01","segment":"smb"}',
    );
    expect(snapshotKey({})).toBe("{}");
  });
});
