# Speedrunner

Speedrunner reads the [LiveSplit](https://livesplit.org) split file you already keep and shows where
your run loses time, how fast you could realistically be, and what to practise first. It runs on your
own computer and uploads nothing.

**[Download the latest version](https://github.com/rodrigosiqueiradev/speedrunner-releases/releases/latest)**
for Windows, macOS or Linux. There is nothing to install.

## Is this for you?

Yes, if you are already deep in one game and category, you know what a PB, a gold and a sum of best
are, and you want those numbers explained rather than the words. It explains your run, not
speedrunning.

You need:

- **A LiveSplit split file** (`.lss`), from LiveSplit 1.0 or later. One file, one game and category.
- **Attempt history in it.** Every number comes from your own past attempts, so a file with a handful
  of runs gives thin answers. The category score is marked provisional below 8 finished runs or 10
  clean times in a typical segment, and the session findings need attempt dates (LiveSplit 1.6 and
  later) and at least 8 play sessions.
- **A desktop screen.** The app is laid out for one.

No file to hand? **Try the sample** loads a Dishonored Any% run from the livesplit-core test suite.

## What it shows you

Open a `.lss` file and Speedrunner works out, from your own attempt history:

- **Personal best, realistic target and sum of best.** The realistic target is your PB with every
  segment at your good-day time — the time you beat in 1 attempt in 4 — so it is a time you can
  actually aim for. Sum of best is context, not the goal.
- **Where the time is.** How much each segment could give back against your PB, and how much of that
  a good attempt would get you.
- **What to practise first.** Advice per segment — **Slow in PB**, **Inconsistent**, **Gold is rare**,
  **Runs die here** — ranked by how much time it is worth, and a practice session of 30 to 120
  minutes built from that ranking.
- **Whether to keep going.** Your chance of a PB from any split at any deficit, and the deficit at
  which resetting is the better bet.
- **Live stats while you run.** A card, or a borderless overlay you can drag next to LiveSplit or
  capture in OBS, following LiveSplit's own timer.
- **Per-segment stats.** PB, gold, typical time, variability and reset rate for every split.
- **A category score from 0 to 100** for how well you run that category, and a profile page that
  combines several split files into one overall score.

There is also **Year in runs**, a recap of one calendar year across your files, drawn as an image you
can save.

Every number has a **?** that explains how it was worked out, and a **How it's calculated** tab that
does it again with examples from the run you loaded. Real time and game time are both supported.

## What it does not do

- **It does not compare you to other runners.** The score says how well you run your own category,
  not where you rank. Nothing is read from leaderboard sites. A world record time is only a reference
  you type in, or a comparison already in your file, and it never changes the score.
- **It does not know your route.** It reads times, so it can tell you which segment is losing you
  time and how much — not what to do differently in it. It does not watch the game or any video.
- **It does not change your split file.** It only reads it. One feature writes: **Race these in
  LiveSplit** saves a separate copy with comparisons added, and leaves your original alone. Luck
  marks are kept outside the file too.
- **It does not control LiveSplit.** Live stats reads the timer through LiveSplit's own server. It
  never starts, splits or resets.
- **It is not a timer and not an autosplitter.** It does not replace LiveSplit; it reads what
  LiveSplit saved.
- **There is no account, no sync and no sharing.** There is nothing to sign up for.

## Nothing leaves your computer

Your splits never leave your computer. Files are read and analysed on your own machine, and
everything the app remembers — your profile, your saved split files, luck marks, goals and settings —
is stored on that machine only.

The app makes one request to the internet: at startup it asks GitHub for the latest release, so it
can tell you when a newer version is out. It sends nothing about you or your splits, and you can turn
it off in the footer. The only other connection it makes is to LiveSplit on your own computer, at
`ws://localhost:16834` by default, and only when you turn Live stats on.

The build enforces that rather than just promising it. Its content security policy allows connections
to the app itself, to a LiveSplit WebSocket on localhost, and to `api.github.com` — nothing else.
Fonts are bundled in the download instead of fetched from a web font service. There is no analytics,
no crash reporter and no telemetry in the build.

## Get started

1. Download the file for your system below and open it.
2. Choose **Open file** and pick your LiveSplit split file (`.lss`). If you are not sure where
   LiveSplit keeps it, right-click LiveSplit and choose **Save Splits As...** to see.
3. Read the **realistic target** at the top of the overview first. The gap between it and your PB is
   the time practice can get you without a lucky run. Then read **What to practise first** underneath
   it to see which segments that time is sitting in.

**[The user manual](docs/README.md)** covers every feature and the maths behind each number.

## Download and run

Pick the file for your system from the
[latest release](https://github.com/rodrigosiqueiradev/speedrunner-releases/releases/latest). There's
nothing to install.

| System | File | How to run it |
| --- | --- | --- |
| Windows 10 or 11 | `Speedrunner-windows.exe` | Put it anywhere and double-click it. |
| macOS (Apple Silicon or Intel) | `Speedrunner-macos.zip` | Unzip it and open `Speedrunner.app`. |
| Linux | `Speedrunner-linux.AppImage` | Make it executable with `chmod +x Speedrunner-linux.AppImage`, then run it. |

### First launch warnings

The apps aren't signed with a developer certificate yet, so Windows and macOS warn you the first time
you open them.

- **Windows:** on the SmartScreen prompt, choose **More info**, then **Run anyway**.
- **macOS:** right-click the app and choose **Open**, or allow it under System Settings › Privacy &
  Security › **Open Anyway**. If macOS says the app "is damaged and can't be opened", run
  `xattr -cr Speedrunner.app` in Terminal and open it again.

Speedrunner works with split files from LiveSplit 1.0 onwards. It only reads them and never changes
them.

## What's new

Each [release](https://github.com/rodrigosiqueiradev/speedrunner-releases/releases) lists the changes
in that version.

## Feedback

Found a bug or have an idea? [Open an issue](https://github.com/rodrigosiqueiradev/speedrunner-releases/issues).
