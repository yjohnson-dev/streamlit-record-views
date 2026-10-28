import { resolve } from "path";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: {
    outDir: "build",
    emptyOutDir: true,
    cssCodeSplit: true,
    lib: {
      entry: {
        card: resolve(__dirname, "src/cards/index.ts"),
        lineage_trail: resolve(__dirname, "src/lineage/trail/index.ts"),
        lineage_strip: resolve(__dirname, "src/lineage/strip/index.ts"),
        lineage_graph: resolve(__dirname, "src/lineage/graph/index.ts"),
        lineage_flow: resolve(__dirname, "src/lineage/flow/index.ts"),
        lineage_tree: resolve(__dirname, "src/lineage/tree/index.ts"),
        lineage_steps: resolve(__dirname, "src/lineage/steps/index.ts"),
        lineage_timeline: resolve(__dirname, "src/lineage/timeline/index.ts"),
        lineage_sankey: resolve(__dirname, "src/lineage/sankey/index.ts"),
        lineage_split: resolve(__dirname, "src/lineage/split/index.ts"),
      },
      formats: ["es"],
    },
    rollupOptions: {
      output: {
        entryFileNames: "[name]-[hash].js",
        chunkFileNames: "[name]-[hash].js",
        assetFileNames: "[name]-[hash].[ext]",
      },
    },
  },
});
