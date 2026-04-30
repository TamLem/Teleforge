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
    }
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
  noExternal: ["@teleforgex/core", "@teleforgex/bot", "@teleforgex/web", "@teleforgex/devtools"],
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
