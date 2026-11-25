import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { App } from "./App";
import { applyTheme, storedTheme } from "./design/theme";
import { applyTokens } from "./design/tokens";

applyTokens(); // design tokens -> CSS variables, before the first paint
applyTheme(storedTheme()); // dark by default, no light flash

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
