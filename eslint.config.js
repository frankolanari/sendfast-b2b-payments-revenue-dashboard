// Root ESLint config. web/ and proxy/ extend this when they arrive (Stage 7).
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/dist/**", "**/node_modules/**", "web/public/snapshot/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
);
