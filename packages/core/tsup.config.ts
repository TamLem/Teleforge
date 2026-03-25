import { defineConfig } from "tsup";

export default defineConfig({
  clean: true,
  dts: true,
  entry: {
    browser: "src/browser.ts",
    "validation/ed25519": "src/validation/ed25519.ts",
    index: "src/index.ts",
    react: "src/events/react.ts"
  },
  format: ["esm", "cjs"],
  outDir: "dist",
  sourcemap: true,
  splitting: false,
  target: "node18"
});
