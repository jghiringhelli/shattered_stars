// ESLint 9 flat config. Fast, syntax-only rules (no type-checked rules);
// `npx tsc --noEmit` remains the source of truth for type errors.
import js from "@eslint/js";
import tsPlugin from "@typescript-eslint/eslint-plugin";

export default [
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "public/**",
      "art-archive/**",
      "coverage/**",
      "test-results/**",
      "scripts/**",
      "tests/**",
      "server/**",
    ],
  },
  {
    ...js.configs.recommended,
    files: ["src/**/*.ts"],
  },
  // base (parser + plugin), eslint-recommended (disables rules TS already checks), recommended
  ...tsPlugin.configs["flat/recommended"].map((config) => ({
    ...config,
    files: ["src/**/*.ts"],
  })),
  {
    files: ["src/**/*.ts"],
    rules: {
      // TypeScript resolves identifiers (incl. browser globals); no-undef false-positives on types.
      "no-undef": "off",
      // Warn, not error: dead imports/locals are hygiene debt spread across many files
      // (some owned by other workstreams); keep them visible without blocking CI.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          caughtErrors: "none",
        },
      ],
    },
  },
];
