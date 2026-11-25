import { DEFAULT_THEME, type Mode } from "./tokens";

/** Light/dark: dark by default (owner's call), the viewer's choice remembered in this browser. */
const KEY = "sendfast-theme";

export function storedTheme(): Mode {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME; // private mode or blocked storage: fall back, never fail
  }
}

export function applyTheme(mode: Mode, doc: Document = document): void {
  doc.documentElement.classList.toggle("dark", mode === "dark");
  doc.documentElement.style.colorScheme = mode;
}

export function saveTheme(mode: Mode): void {
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    // the choice just won't persist
  }
}
