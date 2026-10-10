# Speedrunner

Tools that show speedrunners where they lose time, how fast they could realistically be,
and how well they run each category on one 0-100 scale across games.

## Packages

- `packages/core`: parses LiveSplit `.lss` split files and analyses them. Shared by the web app
  and the desktop app. Runs in Node and the browser.
- `packages/web`: React web app. Upload an `.lss` file (or try the sample) to see your PB, realistic
  target, where time is lost, and what to practise, plus a category score. The Profile page combines the scores of
  several split files into an overall score. Files are analysed in the browser and never uploaded.
- `packages/desktop`: the web app packaged as a desktop app for Windows, macOS and Linux.

## Node and npm

The project uses **Node 24** (the current LTS) with the npm it ships with (**npm 11**). `.nvmrc`
holds the Node version, so `nvm use` or `fnm use` picks it up, and `package.json` declares both in
`engines` and `devEngines`, so npm warns when a different version runs an install. CI and the desktop
builds read the same `.nvmrc`, so they run the same versions as your machine.

## Running the web app

```sh
npm install
npm run dev --workspace @speedrunner/web
```

## Live stats (prototype)

The **Live stats** page follows LiveSplit's timer while you run and shows the stats you pick, in your
order, on a small card you can open as its own window or capture in OBS. It reads the timer through
LiveSplit's built-in server on your own computer (in LiveSplit, right-click › Control › Start
WebSocket Server; it listens on `ws://localhost:16834/livesplit` unless you change the port). It never
splits or resets for you.

When LiveSplit's server can say which splits file it has open, the page follows it: if your profile
has a file with the same name it switches to that, and otherwise it tells you which file to choose. A
file you pick by hand stays picked until LiveSplit opens a different one.

Without LiveSplit, pick **Demo** to replay your own recent attempts from the split file, or run a
pretend LiveSplit server that replays one attempt:

```sh
node packages/web/scripts/mock-livesplit.mjs path/to/splits.lss [attempt id] [speed]
```

## Desktop app

`packages/desktop` packages the web app as a desktop app with [Tauri](https://tauri.app). It is the
same page in a native window, with no backend: split files are still read and analysed locally, and
the app makes no network requests, apart from the optional connection to LiveSplit on the same computer for live stats.

Every push to `main` and every pull request builds portable apps, with nothing to install, and
pushing a version tag publishes them as a release on the public
[speedrunner-releases](https://github.com/rodrigosiqueiradev/speedrunner-releases) repo, so this
repo can stay private. Download them from the
[latest release](https://github.com/rodrigosiqueiradev/speedrunner-releases/releases/latest), or
from a run's artifacts on the **Desktop app** workflow in GitHub Actions:

- **Windows:** `Speedrunner-windows.exe`. Put it anywhere and run it. It uses the WebView2 runtime
  that ships with Windows 10 and 11.
- **macOS:** `Speedrunner-macos.zip` holds `Speedrunner.app`, which runs on Apple Silicon and Intel.
  Unzip it and run it from any folder.
- **Linux:** `Speedrunner-linux.AppImage`. Make it executable (`chmod +x`) and run it.

To publish a version, push a new tag such as `v0.2.0` (`git tag v0.2.0 && git push origin v0.2.0`);
a release with the apps appears on the releases repo a few minutes later. Its notes list every pull
request merged since the previous tag. To put a summary on top, use an annotated tag
(`git tag -a v0.2.0`) and write it in the tag message. To rebuild the apps for
an existing tag, run the **Desktop app** workflow by hand from the Actions tab and enter the tag.
Publishing needs a `RELEASES_TOKEN` secret in this repo: a fine-grained token with **Contents**
read and write access to `speedrunner-releases` only.

The apps aren't signed with a developer certificate yet, so both Windows and macOS warn on first launch:

- **Windows:** on the SmartScreen prompt, choose **More info**, then **Run anyway**.
- **macOS:** the first time, right-click the app and choose **Open**, or allow it under System
  Settings › Privacy & Security › **Open Anyway**. If macOS says the app "is damaged and can't be
  opened", that's the download quarantine flag on an unsigned app; clear it with
  `xattr -cr Speedrunner.app` and open it again.

To build or run it yourself you need [Rust](https://rustup.rs) and the
[Tauri prerequisites](https://tauri.app/start/prerequisites/) for your OS:

```sh
npm install
npm run dev -w packages/desktop   # desktop window with live reload
npm run app                       # portable app in packages/desktop/src-tauri/target/release
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

`pbOdds(run)` simulates attempts from your recent segment times to give the PB chance per attempt and from
every split, the deficit at each split where a reset finds a PB sooner, and a forecast of attempts (and a date) until a PB.
Its per-segment sampling model, `buildSegmentModel(run)`, is exported for other features to reuse.

Data handling choices:
- A segment time recorded right after a skipped split covers two segments, so it is ignored.
- Times under 60% of the segment's median are treated as mis-splits and ignored, including a
  stored gold that is clearly one (`suspiciousGold`).
- History entries with non-positive ids (imported/merged history in LiveSplit) are ignored.
- Real time is used unless the PB only has game time; pass `{ timingMethod: "GameTime" }` to override.
- Supports LiveSplit 1.0 through current split files.
