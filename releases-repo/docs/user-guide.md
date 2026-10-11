# Speedrunner user guide

This guide describes every feature of Speedrunner: what it shows, where to find it, and what it does with your data.
The numbers themselves are defined and justified in two companion documents:

- [How Speedrunner calculates each number](how-it-works.md): the plain-language reference, the same text the app shows
  under **How it's calculated** and in the **?** tooltips.
- [The mathematics of Speedrunner](mathematics.md): every calculation written out as definitions, formulas and
  arguments for why they hold, with the assumptions each one rests on.

Section numbers like **[§5]** below point into the mathematics paper.

## Contents

1. [What Speedrunner is](#1-what-speedrunner-is)
2. [Getting a split file in](#2-getting-a-split-file-in)
3. [Analyse a run](#3-analyse-a-run)
   - [Overview tab](#31-overview-tab)
   - [Practise tab](#32-practise-tab)
   - [Segments tab](#33-segments-tab)
   - [Sessions tab](#34-sessions-tab)
   - [How it's calculated tab](#35-how-its-calculated-tab)
4. [Profile](#4-profile)
5. [Year in runs](#5-year-in-runs)
6. [Live stats and the overlay](#6-live-stats-and-the-overlay)
7. [Desktop app](#7-desktop-app)
8. [App-wide settings](#8-app-wide-settings)
9. [Privacy and storage](#9-privacy-and-storage)

## 1. What Speedrunner is

Speedrunner reads the LiveSplit split file (`.lss`) you already keep and shows where your run loses time, how fast you
could realistically be, what to practise, how likely a PB is, and how well you run each category on one 0 to 100
scale. It is a desktop app for Windows, macOS and Linux.

Three principles shape every feature:

- **Everything is local.** Files are read and analysed on your machine. Nothing is uploaded, there is no account, and
  scores come only from your own files (no leaderboard sites).
- **Every number is explainable.** Each number has a **?** tooltip and an entry under **How it's calculated**.
- **No category length is assumed.** Every rule is a ratio of your own times or a count of your own attempts, so a
  10 minute category with thousands of attempts and a 6 hour one with a few dozen are treated the same way **[§1.5]**.

## 2. Getting a split file in

- **Choose or drop a file.** The landing page of **Analyse a run** takes one `.lss` file. Any LiveSplit version from
  1.0 to current works. **Try the sample** loads a Dishonored Any% file from the livesplit-core test suite.
- **From your profile.** Categories you have added to your profile are listed on the landing page and open without
  choosing the file again.
- **Timing method.** Real time is used unless the PB only has game time. When a file has both, a **Real time / Game
  time** switch appears in the page header and every number is recalculated for the clock you pick.

Before anything is calculated, the history is cleaned: times after a skipped split, mis-splits (under 60% of the
segment's median) and imported history are left out **[§1.2]**.

## 3. Analyse a run

The run page has a header (game, category, attempts and finished runs) and five tabs. Arrow keys move between tabs.

### 3.1 Overview tab

| Feature | What it shows | Maths |
| --- | --- | --- |
| **Summary** | Personal best, realistic target (your PB with every segment at your good-day time where that is faster) and sum of best, each with its gap to the PB. When segments are marked as luck, the sum of best also says how often runs get the luck it needs. | [§2](mathematics.md#2-run-totals) |
| **Route strip** | Your PB drawn as its route: one column per segment, as wide as the segment took, with a bar as tall as its good-day save. The three biggest saves are numbered. LiveSplit subsplit sections are labelled underneath. Click a column to open that segment on the Segments tab. | [§3.4](mathematics.md#34-saves) |
| **What to practise first** | The top three pieces of advice, ranked by estimated worth. **Show all** opens the Practise tab. | [§4](mathematics.md#4-practice-advice) |
| **Your PB odds** | Chance a finished run beats your PB, chance per attempt ("1 in N"), the typical and good finish of your current form, and a forecast of attempts and dates until a PB is more likely than not (50%) and very likely (90%). | [§7](mathematics.md#7-the-form-model-and-pb-odds) |
| **How well you run this category** | The 0 to 100 category score with its four parts (efficiency, consistency, completion, improvement) and a button to add the category to your profile. | [§6](mathematics.md#6-category-score) |

### 3.2 Practise tab

| Feature | What it shows | Maths |
| --- | --- | --- |
| **What to practise first** | Every piece of advice, grouped by segment and ranked by estimated worth. The four kinds are **Slow in PB**, **Inconsistent**, **Gold is rare** and **Runs die here**. Click a segment to see it in the table. | [§4](mathematics.md#4-practice-advice) |
| **Practice plan** | A practice session (30, 60, 90 or 120 minutes) split into blocks for single segments and time for playing them in context: full runs when one fits, otherwise a stretch of the route around the top segment. Each block shows minutes, reps and its expected save. A ranking table shows each segment's gap to good day, rep time, learning per doubling and expected save per hour. | [§9](mathematics.md#9-practice-plan) |
| **Should I reset?** (reset coach) | Pick a split and how far behind PB pace you are (seconds, or `m:ss` for long runs) to get the PB chance from there and a verdict: keep going or reset. A table lists, for every split, the PB chance on pace and the deficit at which to reset, in seconds and as a share of the split time. The **PB hunting / Practising** switch hides the reset verdicts for runners who play every run out. | [§7.7–7.9](mathematics.md#77-pb-chance-from-a-split) |
| **Goal planner** | Type a goal such as `sub 40:00` (a round goal just under the PB is suggested; a goal you type is kept per category and shared with Live stats' **vs goal**). The plan gives every segment a target time at one shared pace, says how often you hit those times now, marks segments that need luck, and gives the chance a finished run and an attempt beat the goal. | [§8](mathematics.md#8-goal-planner) |
| **Race these in LiveSplit** | Saves a copy of your split file with up to three comparisons added: **Realistic target**, **Sub X (balanced)** from the goal plan, and **Recent golds**. Your original file is never changed, and saving again from a copy replaces these comparisons instead of adding them twice. | [§12](mathematics.md#12-livesplit-comparisons) |

### 3.3 Segments tab

| Feature | What it shows | Maths |
| --- | --- | --- |
| **Where the time is** | A bar per segment: the full bar is the save to gold, the inner bar the good-day save. Sort by biggest save or by route order; the ten biggest are shown until you choose **Show all**. | [§3.4](mathematics.md#34-saves) |
| **All segments** | Per segment: PB time, gold, typical (median of recent clean times), save to gold, good-day save, variability, reset rate and the number of clean times. A gold that looks like a mis-split is shown as "gold ignored". | [§3](mathematics.md#3-per-segment-statistics) |
| **Luck** column | Tick **Luck** on a segment whose time depends on chance (a boss pattern, a minigame). Advice, variability, the practice plan, the goal planner, the score's efficiency and PB odds then only count what you control. Segments whose times look luck-shaped, or whose name says "RNG", show a **looks like luck** suggestion; nothing changes until you tick it. Marks are kept per game and category by segment name, outside the split file. | [§5](mathematics.md#5-luck-based-segments) |

### 3.4 Sessions tab

**How your sessions go** groups your attempts into play sessions (a break of more than 30 minutes starts a new one)
and looks for patterns. It needs attempt dates (LiveSplit 1.6 and later) and at least 8 sessions.

| Finding | Question it answers |
| --- | --- |
| **Warm-up** | Are your first 20 minutes of splits in a session slower than the rest? |
| **Peak window** | Is there a stretch of a session where you run clearly faster than that session's average? Shown with a chart of pace by minutes into the session. |
| **Fatigue** | Does your pace or reset rate get worse after some time into a session, and from when? |
| **After a late reset** | Does the attempt after a reset in the last third of the route go differently (resets early more often, runs slower)? |
| **After a near-PB** | Does the attempt after a finish within 2% of your PB go differently? |
| **Time of day** / **Day of week** | Do sessions started at one time of day, or on one weekday, go faster or slower? Shown with charts. |

Each finding says one of three things: a clear effect (with its size), no clear effect, or not enough data yet (with
what is missing). An effect is only stated when the data rules out chance **[§10]**.

### 3.5 How it's calculated tab

Every number on the page, explained with examples from the run you loaded, grouped like the page: run totals, per
segment, advice, PB odds, category score, practice plan, goal planner, sessions and Year in runs. Each **?** tooltip
elsewhere links here.

## 4. Profile

The **Profile** page combines categories into one runner profile.

- **Adding categories.** Use **Add to your profile** on a run's score, or drop several split files on the Profile page
  at once. One entry is kept per game and category; adding a newer file for the same category replaces the old one.
- **Overall score.** The average of your 5 best category scores, leaving out provisional ones (too little data to
  trust yet). **Strongest** and **Weakest** categories are listed under it. **[§6.7]**
- **Categories table.** Each category's score and its four parts. Selecting one shows its breakdown, with the weakest
  part named.
- **WR pace.** A reference time divided by your PB, also shown for your realistic target. The reference is a time you
  type in, or a comparison in the split file named "World Record" or "WR". It is shown next to the score and never
  changes it. **[§6.8]**
- **Saved split files.** The profile keeps a copy of each category's split file, so **Analyse this run**, Year in runs
  and Live stats can open it without choosing the file again. Categories added before files were kept need their file
  added once more.
- **Luck marks follow the profile.** Marking or unmarking a luck segment rescores that category in the profile.
- **Remove** takes a category and its saved file out of the profile.

Saved scores are versioned: when the score formula changes, older saved scores are not shown as current and need the
file added again.

## 5. Year in runs

A recap of one calendar year across every split file you include, drawn as a 1080 × 1350 image.

- **Files.** It starts from your profile's split files plus the run open in Analyse a run. Add more files, or **leave
  out** and **put back** categories for this recap. Two files for the same game and category count once (the newer).
- **Year.** Pick any year with dated attempts. Each attempt counts in the year it started, on your computer's clock.
  Attempts without dates (files from before LiveSplit 1.6) are counted and reported as undated.
- **On the card:** attempts, hours played, finished runs, personal bests, golds, longest streak, attempts per month,
  and three highlights: **biggest PB** (or **first finish** when the year brought a category's first finished run),
  **best gold** and **most improved** segment. Highlights compare shares, not seconds, so categories of any length
  compete fairly. **[§11]**
- **Save as PNG** or **Copy** the image. It is made on your machine and only leaves it if you share it yourself.

## 6. Live stats and the overlay

**Live stats** follows LiveSplit's timer while you run and shows the stats you pick on a small card.

- **Timer source.** **LiveSplit** reads the timer through LiveSplit's own server on your computer (in LiveSplit,
  right-click › Control › Start WebSocket Server; address `ws://localhost:16834/livesplit` by default). It only reads:
  it never starts, splits or resets. **Demo** replays your own recent attempts from the file (finishes and resets
  included) at real speed, 2 minutes per run or 30 seconds per run, so you can try it without LiveSplit.
- **Split file.** Choose a file or a run from your profile. The page follows the splits LiveSplit has open and switches
  to the matching profile file: by file name when LiveSplit says which file is open, otherwise (released LiveSplit
  1.8.37) by the attempt and finished counts LiveSplit loaded, and during an attempt by the split names. A file you
  pick by hand stays picked until LiveSplit opens different splits. When the files differ, the page says so.
- **Timing method.** Follows LiveSplit when it can say which clock it compares against; otherwise choose it.
- **On the card.** Pick which stats show and their order. Standard stats are marked; others are under **More stats**.

| Stat | What it shows | Maths |
| --- | --- | --- |
| Split | Which segment you are on, of how many. | |
| Run time | The time on LiveSplit's timer. | |
| PB chance | How often a run where yours is now still beats your PB, with an arrow showing how the last segment moved it. Shows **New PB** or **No PB** at the end. | [§13.2](mathematics.md#132-pb-chance-and-advice) |
| Keep going? | Keep going or reset, by the reset coach's rule. Shown from the first split until the last. | [§7.9](mathematics.md#79-the-reset-rule) |
| vs PB | Ahead (−) or behind (+) your PB's time at the last split. | [§13.1](mathematics.md#131-split-comparisons) |
| vs goal | Ahead (−) or behind (+) at the last split, against your realistic target until you set a goal, then against the goal planner's splits for it. A goal faster than every segment at its gold shows **Out of reach**. | [§13.1](mathematics.md#131-split-comparisons) |
| Last segment | The segment just finished against your usual time for it, in time and as a share, or **Gold**. | [§13.1](mathematics.md#131-split-comparisons) |
| Likely finish | Where the run ends if every segment left goes at your usual pace. | [§13.3](mathematics.md#133-projections) |
| Best possible | Where the run ends if every segment left is a gold. | [§13.3](mathematics.md#133-projections) |
| This segment | Your usual time for the current segment, with its gold and PB time. | |
| Up next | The next segment (the first one before a run starts): your usual time for it, its gold and how often good runs die there. | [§3.5](mathematics.md#35-reset-rates) |
| Runs die here | How often runs that reached this segment going well were reset in it. | [§3.5](mathematics.md#35-reset-rates) |
| Golds this run | Segments in this attempt that beat their gold. | |
| This session | Attempts, finishes, PBs and best time since the page opened. | [§13.4](mathematics.md#134-session-tracking) |

- **Goal.** While **vs goal** is on the card, a **vs goal: sub** field under the chosen stats sets the goal. It is the
  same goal as the goal planner's, kept per game and category, so setting it in one place sets it in the other.
  Clearing it, or **Use realistic target**, goes back to the realistic target.
- **Card style.** Colours (background, values, labels, ahead/keep going, golds, PB chance falling) and the sizes of
  values (14 to 48 px) and labels (11 to 22 px). The preview and the overlay use the same style.
- **Open as overlay.** Opens the card in a borderless window you can drag anywhere. Keep it next to LiveSplit or capture it in OBS (window capture works, including on Windows). Press
  Esc in it to close it. **Keep the overlay on top of other windows** keeps it above LiveSplit or the game.
- Settings are saved on your computer, so the overlay opens the same way as the page.

## 7. Desktop app

Speedrunner runs entirely on your computer; there is no server or account.

- **Downloads.** Portable apps (nothing to install) for Windows (`.exe`), macOS (`.app` in a zip, Apple Silicon and
  Intel) and Linux (`.AppImage`), from the [latest release](https://github.com/rodrigosiqueiradev/speedrunner-releases/releases/latest).
  The apps aren't signed yet; the [README](../README.md#first-launch-warnings) explains the first-launch warnings.
- **Overlay window.** Live stats opens its own borderless overlay window, with an optional always-on-top setting.
- **Update check.** At startup the app asks this repository for its latest release and shows a banner when a
  newer one exists. This is the app's only request to the internet; it sends nothing about you or your splits. It can
  be turned off in the footer, and a dismissed version's banner is not shown again. Versions are compared as
  `major.minor.patch` numbers.
- **Storage.** The profile, saved split files and settings stay on your computer.

## 8. App-wide settings

- **Theme.** The footer's **System / Light / Dark** switch. System follows your operating system. The overlay follows
  the main window.
- **Version and update check:** the footer shows the version and the update-check switch.

## 9. Privacy and storage

| What | Where it lives |
| --- | --- |
| Profile scores | The app's storage on this computer |
| Saved split files | The app's storage on this computer, one copy per category |
| Luck marks | The app's storage, per game and category, by segment name |
| Live stats settings | The app's storage |
| Goals (goal planner and vs goal) | The app's storage, per game and category |
| Theme | The app's storage |
| Update check choice, dismissed version | The app's storage |

Nothing above is sent anywhere. The only network connections the app makes are to LiveSplit on your own computer (Live
stats, when you choose it) and the update check, which can be turned off.
