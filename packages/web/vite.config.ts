import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

/**
 * The dev server puts React's hot-reload runtime in the page as an inline script, which the app's
 * own content security policy (index.html) is right to refuse. Allow inline scripts while serving,
 * so `npm run dev` keeps reloading; the built app keeps the strict policy untouched. The reload
 * socket itself needs nothing: it goes to whichever host serves the page, and the policy allows
 * this computer. Served to another machine (`vite --host`), the page works but won't hot reload.
 */
const devScripts = (): Plugin => ({
  name: "speedrunner-dev-csp",
  apply: "serve",
  transformIndexHtml: (html) =>
    html.replace("default-src 'self';", "default-src 'self'; script-src 'self' 'unsafe-inline';"),
});

export default defineConfig({
  plugins: [react(), devScripts()],
  resolve: {
    // Use the analyzer's source directly so the app doesn't need core to be built first.
    alias: { "@speedrunner/core": fileURLToPath(new URL("../core/src/index.ts", import.meta.url)) },
  },
  test: { environment: "jsdom" },
});
