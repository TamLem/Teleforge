module.exports = {
  root: true,
  env: {
    es2022: true,
    node: true
  },
  ignorePatterns: [
    "dist/",
    "node_modules/",
    ".teleforge/",
    "generated/",
    "docs/api/",
    "benchmark/results/",
    "coverage/",
    "*.tgz",
    "*.log",
    "**/*.d.ts",
    "**/*.d.cts"
  ],
  overrides: [
    {
      files: ["**/*.ts", "**/*.tsx"],
      parser: "@typescript-eslint/parser",
      parserOptions: {
        project: "./tsconfig.eslint.json",
        tsconfigRootDir: __dirname
      },
      plugins: ["@typescript-eslint", "import"],
      extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
      rules: {
        "@typescript-eslint/explicit-function-return-type": "off",
        "@typescript-eslint/no-empty-object-type": "off",
        "@typescript-eslint/no-unused-vars": [
          "error",
          {
            argsIgnorePattern: "^_",
            varsIgnorePattern: "^_"
          }
        ],
        "import/order": [
          "warn",
          {
            alphabetize: {
              order: "asc",
              caseInsensitive: true
            },
            "newlines-between": "always",
            groups: [
              "builtin",
              "external",
              "internal",
              "parent",
              "sibling",
              "index",
              "object",
              "type"
            ]
          }
        ]
      }
    },
    {
      files: ["**/*.mjs"],
      extends: ["eslint:recommended"],
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module"
      },
      rules: {
        "no-unused-vars": [
          "error",
          {
            argsIgnorePattern: "^_",
            varsIgnorePattern: "^_"
          }
        ]
      }
    },
    {
      files: ["**/*.js", "**/*.cjs"],
      extends: ["eslint:recommended"],
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "script"
      },
      rules: {
        "no-unused-vars": [
          "error",
          {
            argsIgnorePattern: "^_",
            varsIgnorePattern: "^_"
          }
        ]
      }
    }
  ]
};
