// @ts-check
import eslint from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import prettier from "eslint-plugin-prettier";
import prettierConfig from "eslint-config-prettier";
import globals from "globals";

/** @type {import('eslint').Linter.Config[]} */
export default [
  eslint.configs.recommended,
  {
    files: ["src/**/*.ts", "tests/**/*.ts"],
    plugins: {
      "@typescript-eslint": tseslint,
      prettier: prettier,
    },
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        project: "./tsconfig.lint.json",
        ecmaVersion: 2022,
        sourceType: "module",
      },
      globals: {
        ...globals.node,
      },
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      ...prettierConfig.rules,
      "prettier/prettier": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/explicit-function-return-type": "warn",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": "error",
      "no-console": "error",
    },
  },
  {
    ignores: ["dist/**", "node_modules/**", "coverage/**"],
  },
];
