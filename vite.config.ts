import { defineConfig } from "vite"

export default defineConfig({
  build: {
    emptyOutDir: true,
    outDir: "dist",
    rollupOptions: {
      input: "src/background.ts",
      output: {
        entryFileNames: "background.js",
      },
    },
  },
})
