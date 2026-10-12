/**
 * "Nothing is uploaded" is this product's first rule, so the built app may not carry an address it
 * could send anything to. This reads everything the browser runs out of `dist/` and fails on any
 * http, https, ws or wss address that is not on the list below, each of which says why it is there.
 *
 * It runs as the last step of `npm run build`, so it also guards the desktop app's release build.
 * It catches what `test/no-upload.test.tsx` cannot see, because it never reaches jsdom: a remote
 * font, a tracking pixel, or an endpoint pulled in by a dependency.
 *
 * Entries match the start of an address, so this notices a new host rather than a new path on a
 * host already allowed. Adding to ALLOWED is a visible diff with a reason attached; that is the
 * point. If a line here is in your way, the right move is to take the address out of the build,
 * not to widen the list.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The addresses the built app may contain, and why each of them sends nothing anywhere. An entry
 * matches by `prefix` (the start of the address) or, where a whole class of address is fine, by
 * `pattern`.
 */
const ALLOWED = [
  {
    prefix: "http://www.w3.org/",
    why: "XML namespace names in inline SVG and in the HTML document. Names, not addresses: never fetched.",
  },
  {
    prefix: "https://reactjs.org/docs/error-decoder.html",
    why: "The page React names in a production error message, for a developer to open by hand.",
  },
  {
    prefix: "https://api.github.com/repos/",
    why: "The desktop app's update check (src/updates.ts): asks the releases repo for its newest tag and sends nothing about the runner or their splits. Off in the browser build, and the runner can switch it off in the app.",
  },
  {
    // Exact host only. A prefix of the host would also allow every other path on it.
    pattern: /^https:\/\/api\.github\.com$/,
    why: "The content security policy names this host and no path (packages/web/index.html, the same string as tauri.conf.json). Same host as the update check above. The page does not request it; the policy only has to name it.",
  },
  {
    prefix: "https://github.com/",
    why: "The releases page the update banner's Download button opens in the runner's browser (src/updates.ts).",
  },
  {
    // The reserved .localhost names are loopback too, which is how the desktop webview reaches the app.
    pattern: /^(?:https?|wss?):\/\/(?:localhost|127\.0\.0\.1|\[::1\]|[\w-]+\.localhost)(?:[:/?#]|$)/,
    why: "The runner's own computer: a loopback address can't carry anything off the machine. The one the app uses is LiveSplit's server, which Live stats reads from (src/live/feeds.ts).",
  },
];

const allows = (address) => ALLOWED.some((a) => (a.prefix ? address.startsWith(a.prefix) : a.pattern.test(address)));

/**
 * Files that hold no code the browser could run, so a string inside them cannot be a request. Fonts
 * carry licence addresses in their metadata, and the sample run is a runner's split file. Anything
 * else in dist/ is read, so a new kind of asset is checked rather than quietly skipped.
 */
const NOT_CODE = [".woff", ".woff2", ".ttf", ".otf", ".eot", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".ico", ".lss"];

const ADDRESS = /(?:https?|wss?):\/\/[^"'`)\\\s]{1,200}/g;

const dist = fileURLToPath(new URL("../dist", import.meta.url));

function filesIn(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesIn(path) : [path];
  });
}

let files;
try {
  files = filesIn(dist);
} catch {
  console.error("packages/web/dist isn't there. Run `npm run build -w packages/web` first.");
  process.exit(1);
}

/** Every address found, as a map from the address to the files it appears in. */
const found = new Map();
for (const path of files) {
  if (NOT_CODE.includes(extname(path).toLowerCase())) continue;
  for (const [address] of readFileSync(path, "utf8").matchAll(ADDRESS)) {
    const where = found.get(address) ?? new Set();
    found.set(address, where.add(relative(dist, path)));
  }
}

const unexpected = [...found].filter(([address]) => !allows(address));

if (unexpected.length > 0) {
  console.error(`The built app carries ${unexpected.length} address${unexpected.length === 1 ? "" : "es"} that isn't allowed:\n`);
  for (const [address, where] of unexpected) console.error(`  ${address}\n    in ${[...where].join(", ")}`);
  console.error(`
"Nothing is uploaded" is this product's first rule: see PRODUCT.md. If one of these is genuinely
needed and sends nothing about the runner or their splits, add it to ALLOWED in
packages/web/scripts/check-no-upload.mjs with the reason. Otherwise take it out of the build.
`);
  process.exit(1);
}

console.log(`Nothing is uploaded: ${found.size} known address${found.size === 1 ? "" : "es"} in the built app, no new ones.`);
