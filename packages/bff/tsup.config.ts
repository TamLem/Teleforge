import { defineConfig } from "tsup";

export default defineConfig({
  clean: true,
  dts: true,
  entry: {
    index: "src/index.ts",
    routes: "src/routes/index.ts"
  },
  format: ["esm", "cjs"],
  sourcemap: true,
  target: "es2022"
});
