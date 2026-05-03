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
    resolve: [/^@teleforge\//]
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
  external: ["qrcode-terminal"],
  noExternal: ["@teleforge/core", "@teleforge/bot", "@teleforge/web", "@teleforge/devtools"],
  format: ["esm", "cjs"],
  outDir: "dist",
  shims: true,
  sourcemap: true,
  splitting: false,
  target: "node18",
  banner: {
    js: "#!/usr/bin/env node"
  }
});
