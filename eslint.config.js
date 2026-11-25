// Root ESLint config. web/ and proxy/ extend this when they arrive (Stage 7).
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "web/public/snapshot/**",
      // Vendored from shadcn.io (bklit-ui on TanStack Charts): wrapped, not edited.
      "web/src/components/ui/charts/**",
      "web/src/components/charts/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
);
