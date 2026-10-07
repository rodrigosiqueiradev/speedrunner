# Speedrunner

Tools that show speedrunners where they lose time, how fast they could realistically be,
and (later) how their runs score against other runners across games and categories.

## Packages

- `packages/core`: parses LiveSplit `.lss` split files and analyses them. Shared by the web app
  and the desktop app. Runs in Node and the browser.
- `packages/web`: React web app. Upload an `.lss` file (or try the sample) to see your PB, realistic
  target, where time is lost, and what to practise. Files are analysed in the browser and never uploaded.
- `packages/desktop`: the web app packaged as a desktop app for Windows, macOS and Linux.

## Running the web app

```sh
npm install
npm run dev --workspace @speedrunner/web
```

## Desktop app

`packages/desktop` packages the web app as a desktop app with [Tauri](https://tauri.app). It is the
same page in a native window, with no backend: split files are still read and analysed locally, and
the app makes no network requests.

Every push to `main` and every pull request builds installers for Linux (`.deb`, `.AppImage`),
Windows (`.msi`, `.exe`) and macOS (`.dmg`). Download them from the run's artifacts on the
**Desktop app** workflow in GitHub Actions. The builds aren't code-signed yet, so Windows SmartScreen
and macOS Gatekeeper will warn on first launch (on macOS, right-click the app and choose Open).

To build or run it yourself you need [Rust](https://rustup.rs) and the
[Tauri prerequisites](https://tauri.app/start/prerequisites/) for your OS:

```sh
npm install
npm run dev -w packages/desktop   # desktop window with live reload
npm run app                       # installers in packages/desktop/src-tauri/target/release/bundle
```

The sample run (`packages/web/public/sample.lss`) comes from the MIT-licensed
[livesplit-core](https://github.com/LiveSplit/livesplit-core) test suite.

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

For a full, plain-language explanation of every number, see [docs/how-it-works.md](docs/how-it-works.md).

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
