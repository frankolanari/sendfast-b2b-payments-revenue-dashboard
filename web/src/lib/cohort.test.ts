import { describe, expect, it } from "vitest";
import { calendarWindow } from "./cohort";

describe("calendarWindow", () => {
  it("shifts the go-live quarter by N months, across years", () => {
    expect(calendarWindow("2025Q1", 0)).toBe("Jan 2025 – Mar 2025");
    expect(calendarWindow("2025Q1", 3)).toBe("Apr 2025 – Jun 2025");
    expect(calendarWindow("2025Q4", 2)).toBe("Dec 2025 – Feb 2026");
  });
  it("ignores junk", () => {
    expect(calendarWindow("later", 1)).toBe("");
  });
});
