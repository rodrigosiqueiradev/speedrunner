# Speedrunner

Tools that show speedrunners where they lose time, how fast they could realistically be,
and (later) how their runs score against other runners across games and categories.

## Packages

- `packages/core`: parses LiveSplit `.lss` split files and analyses them. Shared by the web app
  and any future desktop app. Runs in Node and the browser.

## Using the analyzer

```sh
npm install
npm test
npm run analyze --workspace @speedrunner/core -- path/to/splits.lss
```

```ts
import { parseLss, analyzeRun } from "@speedrunner/core";
const analysis = analyzeRun(parseLss(xmlText), { recentWindow: 50 });
```

## What the analysis reports

| Field | Meaning |
| --- | --- |
| `personalBest` | Final time of the PB. |
| `sumOfBest` | Sum of every segment's gold: the theoretical best run. |
| `realisticTarget` | The PB with each segment replaced by your good-day time (25th percentile of recent attempts) where that is faster. |
| `segments[].timeSaveVsGold` | PB segment minus gold. |
| `segments[].realisticTimeSave` | PB segment minus good-day time. |
| `segments[].variability` | Interquartile range / median of recent times. Higher means less consistent. |
| `segments[].resetRate` | Share of attempts reaching the segment that reset during it. |
| `advice[]` | Ranked suggestions: weak in PB, inconsistent, gold is rare, run killer. |

Data handling choices:
- A segment time recorded right after a skipped split covers two segments, so it is ignored.
- Times under 60% of the segment's median are treated as mis-splits and ignored, including a
  stored gold that is clearly one (`suspiciousGold`).
- History entries with non-positive ids (imported/merged history in LiveSplit) are ignored.
- Real time is used unless the PB only has game time; pass `{ timingMethod: "GameTime" }` to override.
- Supports LiveSplit 1.0 through current split files.
