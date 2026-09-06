// @ts-check
const eslint = require("@eslint/js");
const { defineConfig } = require("eslint/config");
const tseslint = require("typescript-eslint");
const angular = require("angular-eslint");

module.exports = defineConfig([
  {
    files: ["**/*.ts"],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      "@angular-eslint/directive-selector": [
        "error",
        {
          type: "attribute",
          prefix: "app",
          style: "camelCase",
        },
      ],
      // Off: existing components mix "app-", "exp-", and bare kebab-case selectors
      // (e.g. "login-page", "exp-dialog"). Enforcing one prefix means renaming every
      // selector plus every template/route reference to it -- a dedicated task, not
      // a side effect of wiring up the lint gate.
      "@angular-eslint/component-selector": "off",
      // Off: this repo's documented convention (.claude/rules/code-style.md) is
      // constructor injection with `private readonly` params, not inject().
      "@angular-eslint/prefer-inject": "off",
      // Off: stylistic preferences that don't catch bugs and would otherwise touch
      // ~80 pre-existing call sites across the codebase.
      "@typescript-eslint/array-type": "off",
      "@typescript-eslint/no-inferrable-types": "off",
      "@typescript-eslint/consistent-indexed-object-style": "off",
    },
  },
  {
    files: ["**/*.html"],
    extends: [
      angular.configs.templateRecommended,
      angular.configs.templateAccessibility,
    ],
    rules: {},
  }
]);
