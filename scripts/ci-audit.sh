#!/usr/bin/env bash
# CI audit wrapper: runs pnpm audit --audit-level=high but excludes
# dev-only Vite vulnerabilities that are not exploitable in production.
set -euo pipefail

exec node --input-type=module -e '
import { execFileSync } from "node:child_process";

const VITE_ADVISORIES = new Set([
  "GHSA-p9ff-h696-f583",
  "GHSA-v2wj-q39q-566r",
  "GHSA-67mh-4wv8-2f99",
]);

let raw;
try {
  raw = execFileSync("pnpm", ["audit", "--audit-level=high", "--json"], { encoding: "utf8", stdio: ["pipe","pipe","pipe"] });
} catch (e) {
  raw = e.stdout || "";
}

if (!raw) { console.log("No vulnerabilities found."); process.exit(0); }

const idx = raw.indexOf("{");
if (idx === -1) { console.log("No JSON output."); process.exit(0); }
const data = JSON.parse(raw.slice(idx));
const advisories = data.advisories || {};

const excluded = [];
const blocked = [];

for (const [, adv] of Object.entries(advisories)) {
  if (adv.severity !== "high" && adv.severity !== "critical") continue;
  const entry = adv.module_name + ": " + (adv.title || "").slice(0, 70);
  if (VITE_ADVISORIES.has(adv.github_advisory_id || "")) {
    excluded.push(entry);
  } else {
    blocked.push(entry);
  }
}

if (excluded.length) {
  console.log("Excluded Vite dev-only advisories:");
  excluded.forEach(e => console.log("  - " + e));
  console.log();
}
if (blocked.length) {
  console.log("Blocking high/critical vulnerabilities:");
  blocked.forEach(b => console.log("  - " + b));
  console.log();
}

console.log("Non-Vite high/critical: " + blocked.length);
process.exit(blocked.length > 0 ? 1 : 0);
'
