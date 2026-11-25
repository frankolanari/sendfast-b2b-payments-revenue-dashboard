// Root ESLint config. web/ and proxy/ extend this when they arrive (Stage 7).
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "web/public/snapshot/**",
      "web/dist-snapshot/**",
      // Vendored from shadcn.io (bklit-ui on TanStack Charts): wrapped, not edited.
      "web/src/components/ui/charts/**",
      "web/src/components/charts/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Node scripts (build and check tooling) run on Node's globals.
    files: ["web/scripts/**/*.mjs"],
    languageOptions: {
      globals: {
        process: "readonly",
        console: "readonly",
        fetch: "readonly",
        setTimeout: "readonly",
      },
    },
  },
);
