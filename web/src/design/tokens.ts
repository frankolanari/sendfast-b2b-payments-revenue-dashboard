/**
 * Design tokens: the single source for every colour, font, type size, spacing and radius
 * (PLAN.md Stage 7, rule 10). `applyTokens()` writes them as CSS variables before the first
 * render; Tailwind utilities, shadcn/ui and the chart kit all read those variables.
 *
 * Look: inspired by the owner's reference (warm neutrals, near-black ink, one warm accent,
 * Cal Sans display type, 10px radius, hairline borders). Inspiration only: no third-party
 * brand assets.
 *
 * Chart colours follow the dataviz method: the categorical order is the validated reference
 * palette (CVD and normal-vision separation checked with validate_palette.js on 2026-11-25:
 * light worst adjacent CVD ΔE 9.1, dark 8.4; all checks pass). Three light slots sit below 3:1
 * on the surface, so charts using them must show direct labels or offer the table view.
 * Never cycle or generate a 9th hue: fold extra series into "Other".
 */

export type Mode = "light" | "dark";
type Pair = Record<Mode, string>;

const pair = (light: string, dark: string): Pair => ({ light, dark });

export const tokens = {
  color: {
    page: pair("#fafaf9", "#0f0f0f"), // the plane behind the cards
    surface: pair("#ffffff", "#1c1c1c"), // cards, charts, popovers
    surfaceSunken: pair("#f3f4f6", "#262626"), // segmented controls, wells, hover washes
    paper: pair("#e3dccd", "#242321"), // the warm highlight panel
    ink: pair("#242424", "#fafafa"), // primary text, primary buttons
    inkSecondary: pair("#4b4f58", "#d4d5d8"),
    inkMuted: pair("#676b75", "#a1a1a1"), // labels, axis text
    border: pair("#e5e7eb", "#ffffff1a"),
    input: pair("#e5e7eb", "#ffffff26"),
    ring: pair("#9ca3af", "#737373"),
    accent: pair("#e8602a", "#f08a5f"), // the one warm accent: insight highlights, focus
    onInk: pair("#ffffff", "#171717"), // text on an ink-filled button
  },

  /** Categorical series, fixed order (never cycled). Dark steps are selected, not flipped. */
  series: {
    light: [
      "#2a78d6",
      "#eb6834",
      "#1baf7a",
      "#eda100",
      "#e87ba4",
      "#008300",
      "#6250d6",
      "#e34948",
    ],
    dark: [
      "#3987e5",
      "#d95926",
      "#199e70",
      "#c98500",
      "#d55181",
      "#0ca30c",
      "#9085e9",
      "#e66767",
    ],
  },

  /** Sequential (one hue, light -> dark) for magnitude: the cohort heatmap. */
  sequential: [
    "#cde2fb",
    "#9ec5f4",
    "#6da7ec",
    "#3987e5",
    "#256abf",
    "#184f95",
    "#0d366b",
  ],

  /** Diverging poles for polarity (waterfall gains/losses), with a neutral midpoint. */
  diverging: {
    positive: pair("#2a78d6", "#3987e5"),
    negative: pair("#e34948", "#e66767"),
    neutral: pair("#f0efec", "#383835"),
  },

  /** Reserved state colours: always paired with an icon and a label, never a series. */
  status: {
    good: "#0ca30c",
    warning: "#fab219",
    serious: "#ec835a",
    critical: "#d03b3b",
  },

  chart: {
    grid: pair("#e1e0d9", "#2c2c2a"),
    baseline: pair("#c3c2b7", "#383835"),
    label: pair("#676b75", "#a1a1a1"),
    // Non-highlighted bars: recede, but stay >= 3:1 on the surface (WCAG 1.4.11).
    neutralBar: pair("#8a8880", "#6b6b6b"),
  },

  font: {
    display: '"Cal Sans", "Inter Variable", system-ui, sans-serif',
    sans: '"Inter Variable", system-ui, -apple-system, "Segoe UI", sans-serif',
    mono: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
  },

  /** Type scale (rem). Display sizes use Cal Sans with tight tracking. */
  text: {
    xs: "0.75rem",
    sm: "0.875rem",
    base: "1rem",
    lg: "1.125rem",
    xl: "1.25rem",
    "2xl": "1.5rem",
    "3xl": "1.875rem",
    "4xl": "2.25rem",
    "5xl": "3rem",
  },
  tracking: { display: "-0.02em", tight: "-0.01em", caps: "0.08em" },

  /**
   * Liquid glass for floating chrome (nav bar, filter bar, popovers): a translucent fill,
   * a strong blur and a saturation boost, a hairline edge and a faint top highlight.
   * Designed dark-first; light keeps the same structure.
   */
  glass: {
    bar: pair("#ffffff85", "#1c1c1c85"), // nav and filter bars
    material: pair("#f3f4f6bd", "#181818b8"), // popovers, menus, tooltips
    edge: pair("#0000000f", "#ffffff14"), // hairline border
    highlight: pair("#ffffffb3", "#ffffff0f"), // inset top edge
    barBlur: "blur(30px) saturate(1.8)",
    materialBlur: "blur(40px) saturate(1.8)",
  },

  shadow: {
    card: pair(
      "0 1px 2px #0000000f, 0 10px 18px -10px #00000038",
      "0 1px 2px #0003, 0 8px 14px -8px #0000005c",
    ),
    lift: pair("0 10px 18px -10px #00000052", "0 14px 22px -12px #0003"),
  },

  /** Tailwind's spacing unit: p-4 = 4 x this. */
  spacing: "0.25rem",
  radius: "0.625rem",
} as const;

export const DEFAULT_THEME: Mode = "dark"; // owner, 2026-11-25: design dark-first

/** CSS variables for one mode: shadcn/ui names, Tailwind theme names and chart-kit names. */
export function cssVariables(mode: Mode): Record<string, string> {
  const c = tokens.color;
  const s = tokens.series[mode];
  const vars: Record<string, string> = {
    // shadcn/ui
    "--background": c.page[mode],
    "--foreground": c.ink[mode],
    "--card": c.surface[mode],
    "--card-foreground": c.ink[mode],
    "--popover": c.surface[mode],
    "--popover-foreground": c.ink[mode],
    "--primary": c.ink[mode],
    "--primary-foreground": c.onInk[mode],
    "--secondary": c.surfaceSunken[mode],
    "--secondary-foreground": c.ink[mode],
    "--muted": c.surfaceSunken[mode],
    "--muted-foreground": c.inkMuted[mode],
    "--accent": c.surfaceSunken[mode],
    "--accent-foreground": c.ink[mode],
    "--destructive": tokens.status.critical,
    "--border": c.border[mode],
    "--input": c.input[mode],
    "--ring": c.ring[mode],
    "--radius": tokens.radius,
    // our own names
    "--paper": c.paper[mode],
    "--brand-accent": c.accent[mode],
    "--ink-secondary": c.inkSecondary[mode],
    "--glass-bar": tokens.glass.bar[mode],
    "--glass-material": tokens.glass.material[mode],
    "--glass-edge": tokens.glass.edge[mode],
    "--glass-highlight": tokens.glass.highlight[mode],
    "--glass-bar-blur": tokens.glass.barBlur,
    "--glass-material-blur": tokens.glass.materialBlur,
    "--shadow-card": tokens.shadow.card[mode],
    "--shadow-lift": tokens.shadow.lift[mode],
    "--chart-tooltip-background": tokens.glass.material[mode],
    // charts (kit + ours)
    "--chart-grid": tokens.chart.grid[mode],
    "--chart-label": tokens.chart.label[mode],
    "--chart-positive": tokens.diverging.positive[mode],
    "--chart-negative": tokens.diverging.negative[mode],
    "--chart-neutral": tokens.diverging.neutral[mode],
    "--chart-neutral-bar": tokens.chart.neutralBar[mode],
    // type and spacing
    "--font-sans": tokens.font.sans,
    "--font-heading": tokens.font.display,
    "--font-display": tokens.font.display,
    "--font-mono": tokens.font.mono,
    "--spacing": tokens.spacing,
  };
  s.forEach((hex, i) => (vars[`--chart-${i + 1}`] = hex));
  tokens.sequential.forEach((hex, i) => (vars[`--seq-${i + 1}`] = hex));
  for (const [name, size] of Object.entries(tokens.text))
    vars[`--text-${name}`] = size;
  for (const [name, value] of Object.entries(tokens.status))
    vars[`--status-${name}`] = value;
  return vars;
}

export function themeCss(): string {
  const block = (sel: string, mode: Mode) =>
    `${sel}{${Object.entries(cssVariables(mode))
      .map(([k, v]) => `${k}:${v}`)
      .join(";")}}`;
  return [block(":root", "light"), block(".dark", "dark")].join("\n");
}

/** Write the tokens into the document once, before React renders. */
export function applyTokens(doc: Document = document): void {
  let el = doc.getElementById("design-tokens");
  if (!el) {
    el = doc.createElement("style");
    el.id = "design-tokens";
    doc.head.appendChild(el);
  }
  el.textContent = themeCss();
}
