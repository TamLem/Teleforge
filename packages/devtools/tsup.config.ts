import { defineConfig } from "tsup";

export default defineConfig({
  clean: true,
  dts: true,
  entry: {
    cli: "src/cli.ts",
    index: "src/index.ts",
    "utils/doctor/checks": "src/utils/doctor/checks.ts",
    "utils/webhook": "src/utils/webhook.ts"
  },
  format: ["esm", "cjs"],
  outDir: "dist",
  sourcemap: true,
  splitting: false,
  target: "node18"
});
