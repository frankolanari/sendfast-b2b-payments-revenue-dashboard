import { describe, expect, it } from "vitest";
import { cssVariables, themeCss, tokens } from "./tokens";

/** WCAG 2 relative luminance contrast between two #rrggbb colours. */
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, b2] = [1, 3, 5].map(
      (i) => parseInt(hex.slice(i, i + 2), 16) / 255,
    );
    const lin = (c: number) =>
      c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b2);
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe("tokens", () => {
  it("keeps the validated categorical order (re-run validate_palette.js before changing it)", () => {
    expect(tokens.series.light).toEqual([
      "#2a78d6",
      "#eb6834",
      "#1baf7a",
      "#eda100",
      "#e87ba4",
      "#008300",
      "#6250d6",
      "#e34948",
    ]);
    expect(tokens.series.dark).toHaveLength(8);
  });

  it.each(["light", "dark"] as const)(
    "text meets WCAG AA (4.5:1) on page and surface, %s",
    (mode) => {
      const c = tokens.color;
      for (const bg of [c.page[mode], c.surface[mode]]) {
        for (const ink of [
          c.ink[mode],
          c.inkSecondary[mode],
          c.inkMuted[mode],
        ]) {
          expect(contrast(ink, bg), `${ink} on ${bg}`).toBeGreaterThanOrEqual(
            4.5,
          );
        }
      }
      expect(contrast(c.onInk[mode], c.ink[mode])).toBeGreaterThanOrEqual(4.5);
    },
  );

  it("sequential ramp gets darker step by step", () => {
    const lum = tokens.sequential.map((hex) => contrast(hex, "#000000"));
    lum.slice(1).forEach((l, i) => expect(l).toBeLessThan(lum[i]));
  });

  it("emits every variable the chart kit and shadcn read, for both modes", () => {
    for (const mode of ["light", "dark"] as const) {
      const v = cssVariables(mode);
      for (const name of [
        "--background",
        "--foreground",
        "--card",
        "--border",
        "--chart-1",
        "--chart-8",
        "--chart-positive",
        "--chart-negative",
        "--chart-grid",
        "--font-sans",
        "--radius",
        "--spacing",
        "--text-sm",
      ]) {
        expect(v[name], `${mode} ${name}`).toBeTruthy();
      }
    }
    expect(themeCss()).toMatch(/^:root\{.*\n\.dark\{/s);
  });
});
