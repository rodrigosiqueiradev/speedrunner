# Speedrunner

Speedrunner reads your [LiveSplit](https://livesplit.org) split files and shows you where you lose time,
how fast you could realistically be, and what to practise first.

This repository hosts the desktop app downloads. The source code is private.

**[Download the latest version](https://github.com/rodrigosiqueiradev/speedrunner-releases/releases/latest)**

## What it shows

Open a `.lss` split file and Speedrunner works out, from your own attempt history:

- **Personal best, realistic target and sum of best.** The realistic target is your PB if every
  segment went like a typical good attempt, so it's a time you can actually aim for.
- **What to practise first.** Advice for each segment, such as "inconsistent", "gold is rare" or
  "runs die here", ranked by how much time it's worth.
- **Where the time is.** How much each segment could give back against your PB, and how much of that
  a good attempt would get you.
- **Per-segment stats.** PB, gold, typical time, variability and reset rate for every split.
- **A category score from 0 to 100,** so you can compare how well you run different games and
  categories. The profile page combines several split files into one overall score.

Every number has an explanation next to it. Real time and game time are both supported.

Your splits never leave your computer. The app analyses files locally. Its only request to the internet is a check
for a newer version at startup, which sends nothing about you or your splits and can be turned off.

**[Read the user manual](docs/README.md)** for every feature and the maths behind each number.

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

## Using it

1. Open the app and choose **Open file**.
2. Pick a LiveSplit split file (`.lss`). LiveSplit saves it wherever you chose when you saved your
   splits; right-click LiveSplit and choose **Save Splits As...** if you're not sure where it is.
3. Read through your results. The **?** buttons explain how each number is calculated. The [user manual](docs/README.md) covers
   every feature in detail.

Speedrunner works with split files from LiveSplit 1.0 onwards. It only reads them and never changes them.

## What's new

Each [release](https://github.com/rodrigosiqueiradev/speedrunner-releases/releases) lists the changes
in that version.

## Feedback

Found a bug or have an idea? [Open an issue](https://github.com/rodrigosiqueiradev/speedrunner-releases/issues).
