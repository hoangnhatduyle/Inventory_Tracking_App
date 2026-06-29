// @ts-check
const eslint = require("@eslint/js");
const { defineConfig } = require("eslint/config");
const tseslint = require("typescript-eslint");
const angular = require("angular-eslint");

// Baseline config committed during the web migration. Stylistic and
// accessibility rules are warnings (not errors) so CI can stay green
// while the codebase is gradually modernized; security-relevant rules
// remain errors.
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
        { type: "attribute", prefix: "app", style: "camelCase" },
      ],
      "@angular-eslint/component-selector": [
        "warn",
        { type: "element", prefix: "app", style: "kebab-case" },
      ],
      "@typescript-eslint/consistent-generic-constructors": "warn",
      "@angular-eslint/prefer-inject": "warn",
      "@angular-eslint/prefer-standalone": "warn",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-empty-function": "warn",
      "@typescript-eslint/no-empty-object-type": "warn",
      "@typescript-eslint/no-unused-expressions": "warn",
      "@typescript-eslint/no-inferrable-types": "warn",
      "@typescript-eslint/array-type": "warn",
      "@typescript-eslint/consistent-indexed-object-style": "warn",
      "@typescript-eslint/consistent-type-definitions": "warn",
      "@typescript-eslint/prefer-for-of": "warn",
      "@typescript-eslint/class-literal-property-style": "warn",
      "no-empty": "warn",
      "no-useless-escape": "warn",
      "no-prototype-builtins": "warn",
      "no-case-declarations": "warn",
      "no-async-promise-executor": "warn",
      "prefer-const": "warn",
    },
  },
  {
    files: ["**/*.html"],
    extends: [
      angular.configs.templateRecommended,
      angular.configs.templateAccessibility,
    ],
    rules: {
      "@angular-eslint/template/prefer-control-flow": "warn",
      "@angular-eslint/template/prefer-self-closing-tags": "warn",
      "@angular-eslint/template/click-events-have-key-events": "warn",
      "@angular-eslint/template/interactive-supports-focus": "warn",
      "@angular-eslint/template/label-has-associated-control": "warn",
      "@angular-eslint/template/alt-text": "warn",
      "@angular-eslint/template/elements-content": "warn",
    },
  },
]);
