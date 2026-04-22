import { defineConfig } from "tsup";

export default defineConfig({
  clean: true,
  dts: {
    entry: {
      bot: "src/bot.ts",
      cli: "src/cli.ts",
      "core-browser": "src/core-browser.ts",
      index: "src/index.ts",
      "server-hooks": "src/server-hooks-entry.ts",
      "test-utils": "src/test-utils.ts",
      web: "src/web.ts"
    },
    resolve: true
  },
  entry: {
    bot: "src/bot.ts",
    cli: "src/cli.ts",
    "core-browser": "src/core-browser.ts",
    index: "src/index.ts",
    "server-hooks": "src/server-hooks-entry.ts",
    "test-utils": "src/test-utils.ts",
    web: "src/web.ts"
  },
  external: ["@teleforgex/devtools"],
  format: ["esm", "cjs"],
  outDir: "dist",
  sourcemap: true,
  splitting: false,
  target: "node18"
});
