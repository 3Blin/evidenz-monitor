// Leitplanken aus dem dev-guardrails-Skill (Phase 2/3):
// kein console-Logging, kein any, keine leeren catch-Blöcke.
import tseslint from "typescript-eslint";

export default tseslint.config(
  ...tseslint.configs.recommended,
  {
    rules: {
      "no-console": "error",                              // nur pino-Logger
      "@typescript-eslint/no-explicit-any": "error",      // kein any
      "no-empty": ["error", { "allowEmptyCatch": false }],// kein Error Masking
      "@typescript-eslint/no-unused-vars": "error",
      "@typescript-eslint/no-floating-promises": "off"
    }
  }
);
