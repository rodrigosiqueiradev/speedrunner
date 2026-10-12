/**
 * The content security policy is the engine's own backstop for "nothing is uploaded": whatever the
 * code does, the browser only loads the app's own files and only connects to the three places the
 * privacy audit documented. A policy is easy to widen by accident, so it is pinned here address by
 * address, and pinned to the desktop app's, which Tauri applies to this same index.html.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const html = readFileSync(resolve(__dirname, "../index.html"), "utf8");
const tauri = JSON.parse(readFileSync(resolve(__dirname, "../../desktop/src-tauri/tauri.conf.json"), "utf8")) as {
  app: { security: { csp: string } };
};

const webPolicy = /http-equiv="Content-Security-Policy"\s+content="([^"]+)"/.exec(html)?.[1];

/** A policy as its directives, each with its list of sources. */
function directives(policy: string): Record<string, string[]> {
  const pairs = policy
    .split(";")
    .map((d) => d.trim())
    .filter(Boolean)
    .map((d) => {
      const [name, ...sources] = d.split(/\s+/);
      return [name, sources] as const;
    });
  return Object.fromEntries(pairs);
}

describe("the built app's content security policy", () => {
  it("is in index.html, so the built app carries it", () => {
    expect(webPolicy).toBeTruthy();
  });

  it("is word for word the desktop app's, which Tauri applies to the same file", () => {
    expect(webPolicy).toBe(tauri.app.security.csp);
  });

  it("allows the app's own files and nothing else", () => {
    const policy = directives(webPolicy!);
    expect(Object.keys(policy).sort()).toEqual(["connect-src", "default-src", "font-src", "img-src", "style-src"]);
    // No script-src, so scripts fall back to default-src: the app's own, never inline, never remote.
    expect(policy["default-src"]).toEqual(["'self'"]);
    expect(policy["font-src"]).toEqual(["'self'"]);
    // Inline styles are React's style attributes; the card's colours are the runner's own choices.
    expect(policy["style-src"]).toEqual(["'self'", "'unsafe-inline'"]);
    // data: is the favicon, which is an inline SVG.
    expect(policy["img-src"]).toEqual(["'self'", "data:"]);
  });

  it("allows exactly the three connections the privacy audit documented", () => {
    expect(directives(webPolicy!)["connect-src"]).toEqual([
      // The app's own files: the sample run.
      "'self'",
      // The desktop app's webview talking to the app itself.
      "ipc:",
      "http://ipc.localhost",
      // LiveSplit's server, on this computer, on whichever port its settings say.
      "ws://localhost:*",
      "ws://127.0.0.1:*",
      // The desktop app's update check. The browser build never asks (src/App.tsx).
      "https://api.github.com",
    ]);
  });

  it("has the one directive the dev server widens, so that widening keeps working", () => {
    // vite.config.ts allows inline scripts while serving, for React's hot reload. If this prefix
    // moves, say by sorting the directives, update the plugin there or `npm run dev` goes blank.
    expect(webPolicy!.startsWith("default-src 'self';")).toBe(true);
  });
});
