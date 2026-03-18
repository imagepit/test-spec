import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    "src/index": "src/index.ts",
  },
  format: "esm",
  dts: true,
  clean: true,
  target: "node18",
  splitting: false,
  sourcemap: true,
  external: ["vitest"],
});
