import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Use the analyzer's source directly so the app doesn't need core to be built first.
    alias: { "@speedrunner/core": fileURLToPath(new URL("../core/src/index.ts", import.meta.url)) },
  },
  test: { environment: "jsdom" },
});
