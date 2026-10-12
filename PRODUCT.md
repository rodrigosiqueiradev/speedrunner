# Product

<!-- impeccable:product-schema 1 -->

## Platform

desktop

## Users

Active grinders: speedrunners already deep in one game and category, with hundreds of attempts in their LiveSplit history, chasing PB improvements. They open Speedrunner between sessions to decide what to practise next and how fast they could realistically be. They know their route, their splits and LiveSplit's vocabulary (PB, gold, sum of best, resets) and want the numbers explained, not themselves.

## Product Purpose

Shows runners where they lose time and how fast they could realistically be, from the split file they already have. Load a LiveSplit `.lss` file and get: PB, a realistic target (the PB if every segment went like a typical good attempt), sum of best, where time is lost per segment, and ranked practice advice. Success means a runner leaves knowing which segments to grind first and why, and trusts the numbers because every one can be traced to how it was worked out.

Each category also gets a score from 0 to 100 for how well the runner runs it, worked out from their own file, and a runner profile combines those scores across games into an overall score.

## Positioning

Offline by design. Speedrunner never uploads anything and makes no network requests for analysis or scoring. Split files are analysed on the runner's computer, and the app's only internet request is an optional check for new versions on GitHub (a switch in the footer turns it off). Scores come only from the runner's own files, not from leaderboard sites (speedrun.com's usage terms rule it out). There is no account, no sync and no opt-in sharing step, because nothing leaves the user's machine.

It's an honest analysis rather than a hype dashboard. The realistic target comes from the runner's own recent form (25th percentile of clean times), not from the theoretical sum of best, and every number has a plain-language explanation of how it was calculated.

## Operating Context

- The input is a LiveSplit `.lss` file (LiveSplit 1.0 through current). The app also ships a sample run.
- Used between practice sessions, often next to LiveSplit and a game. Live stats is used during runs.
- Supports both real time and game time (there's a toggle when the file has game time).
- The profile keeps scores and a copy of each category's split file on the runner's device only (local storage and IndexedDB).

## Capabilities and Constraints

- `packages/core`: parser and analyzer that run in Node and the browser, plus a command-line tool. It's shared by the web app and the desktop app.
- `packages/web`: React and Vite app. The run page has tabs: an overview (summary, route strip, top advice, PB odds, category score), practice (advice, practice plan, reset coach, goal planner), segments (savings chart and per-segment table), sessions, and "How it's calculated". Other pages: the profile, Year in runs (a recap of one year, drawn as an image) and Live stats (a card or overlay that follows LiveSplit's timer while the runner plays). Luck marks let segments that depend on chance count only what the runner controls, and colour themes change the palette.
- `packages/desktop`: the web app in a native window with Tauri. Only Windows builds are released for now. It shows a banner when a new version is out.
- How the data is cleaned (skipped splits, mis-splits under 60% of the median, imported history) and all the thresholds are documented in `docs/how-it-works.md`. The UI has to stay consistent with that document.
- Terms the UI uses: personal best, realistic target, sum of best, gold, typical, good-day time, save to gold, good-day save, variability, reset rate, clean segment times. The advice labels are Slow in PB, Inconsistent, Gold is rare and Runs die here.
- Must never upload user data or add tracking that sends split contents anywhere.
- Scores measure how well someone runs their own category, not how they rank against other runners. A world record time is only a reference the runner types in or keeps as a comparison in their file.

## Brand Commitments

- Name: Speedrunner.
- Promise, used in the UI: "Your splits never leave your computer."
- Voice: plain, direct and specific. Numbers come with their explanations and examples taken from the user's own run. British spelling ("practise", "analyse").

## Evidence on Hand

- A sample run in `packages/web/public/sample.lss` (Dishonored, from the MIT-licensed livesplit-core test suite), plus test fixtures in `packages/core/test/fixtures`.
- The method documentation in `docs/how-it-works.md`.
- Free, early project, with no users, testimonials, community or usage metrics yet. Future work must not invent any of these.

## Product Principles

1. **Every number is explainable.** If a figure can't be traced to a plain-language method, it doesn't ship.
2. **Realistic over theoretical.** Lead with what the runner can actually achieve on a good day. Sum of best is context, not the goal.
3. **Tell them what to do next.** The analysis has to end in ranked, actionable practice priorities.
4. **Passive and private by construction.** The app reads local files and never changes them. It only writes files the runner asks for and places themselves: a copy of the split file with comparisons added (**Race these in LiveSplit**) and the Year in runs image. It never needs an account, and asks for no trust it doesn't need.
5. **Respect the runner's expertise.** Use LiveSplit's vocabulary, don't explain the obvious, and keep data-dense views readable.
