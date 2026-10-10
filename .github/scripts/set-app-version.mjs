// Gives the desktop app the version of the tag it's built from, so it can tell when a newer
// release is out. Usage: node set-app-version.mjs v0.2.0
import { readFileSync, writeFileSync } from "node:fs";

const tag = process.argv[2] ?? "";
const match = /^v(\d+\.\d+\.\d+)$/.exec(tag);
if (!match) {
  console.error(`::error::"${tag}" isn't a version tag like v0.2.0, so the app can't take its version from it.`);
  process.exit(1);
}
const path = "packages/desktop/src-tauri/tauri.conf.json";
const config = JSON.parse(readFileSync(path, "utf8"));
config.version = match[1];
writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`);
console.log(`App version set to ${match[1]}.`);
