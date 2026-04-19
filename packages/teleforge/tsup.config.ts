import { defineConfig } from "tsup";

export default defineConfig({
  clean: true,
  dts: true,
  entry: {
    bff: "src/bff.ts",
    bot: "src/bot.ts",
    cli: "src/cli.ts",
    "core-browser": "src/core-browser.ts",
    core: "src/core.ts",
    devtools: "src/devtools.ts",
    index: "src/index.ts",
    "server-hooks": "src/server-hooks-entry.ts",
    ui: "src/ui.ts",
    web: "src/web.ts"
  },
  format: ["esm", "cjs"],
  outDir: "dist",
  sourcemap: true,
  splitting: false,
  target: "node18"
});
