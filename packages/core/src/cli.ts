#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { analyzeRun } from "./analyze.js";
import { parseLss } from "./parse.js";
import { formatTime } from "./time.js";

const file = process.argv[2];
if (!file) {
  console.error("Usage: speedrunner-analyze <splits.lss>");
  process.exit(1);
}

const a = analyzeRun(parseLss(readFileSync(file, "utf8")));
const t = (ms: number | null) => formatTime(ms);

console.log(`${a.game} - ${a.category} (${a.timingMethod})`);
console.log(`Attempts: ${a.attemptCount}, finished: ${a.finishedAttempts}`);
console.log(`PB: ${t(a.personalBest)}   Sum of best: ${t(a.sumOfBest)}   Possible save: ${t(a.possibleTimeSave)}`);
console.log(`Realistic target: ${t(a.realisticTarget)}\n`);

console.table(
  a.segments.map((s) => ({
    segment: s.name,
    pb: t(s.pbTime),
    gold: t(s.gold),
    median: t(s.median),
    "save vs gold": t(s.timeSaveVsGold),
    "realistic save": t(s.realisticTimeSave),
    variability: s.variability == null ? "-" : `${Math.round(s.variability * 100)}%`,
    resets: s.resetRate == null ? "-" : `${Math.round(s.resetRate * 100)}%`,
  })),
);

console.log("\nWhere to improve:");
for (const adv of a.advice.slice(0, 8)) {
  console.log(`- [${adv.segmentName}] ${adv.message}`);
}
