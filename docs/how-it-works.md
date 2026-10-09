# How Speedrunner calculates each number

Everything is worked out from your LiveSplit split file (`.lss`), in your browser. Nothing is uploaded.
The app shows the same explanations next to each number (the **?** buttons) and in its
"How it's calculated" section, with examples taken from the run you load.

Defaults below come from `ANALYSIS_DEFAULTS` and `ADVICE_THRESHOLDS` in
[`packages/core/src/analyze.ts`](../packages/core/src/analyze.ts).

| Setting | Default |
| --- | --- |
| Recent attempts used for "current form" stats | last 50 clean times per segment |
| Minimum clean times before form stats appear | 5 |
| Good-day time | 25th percentile |
| Mis-split cut-off | under 60% of the segment's median |

## Clean segment times

LiveSplit records how long each segment took in every attempt. Before using those times, three kinds are dropped:

- **Skipped splits.** If you skipped a split, the next segment's recorded time covers two segments, so neither is used for that attempt.
- **Mis-splits.** A time under 60% of the segment's median, such as a double press that split a 3 minute level after 5 seconds. Only applies once a segment has at least 5 times.
- **Imported history.** Entries LiveSplit marks with a zero or negative attempt id come from merged or imported files, not real attempts.

Every per-segment stat below uses clean times only.

## Run totals

| Number | How it's calculated |
| --- | --- |
| **Personal best** | The last split of LiveSplit's "Personal Best" comparison, read straight from the file. |
| **Realistic target** | PB minus the sum of every segment's good-day save (see below). It answers "what would my PB be if every segment went like a typical good attempt?" |
| **Sum of best** | All segment golds added together. The theoretical best with what you've already done. |
| **Theoretical save** | PB minus sum of best. |
| **Attempts** | LiveSplit's attempt counter. **Finished** counts attempts with a time on the final segment. |

Example (Dishonored sample, real time): PB 40:01.52 − 10.85s of good-day saves from 4 segments = realistic target 39:50.66.

## Per segment

| Column | How it's calculated |
| --- | --- |
| **PB** | This segment's split time in the PB minus the previous split's. Blank if the PB skipped a neighbouring split. |
| **Gold** | The fastest of LiveSplit's stored best segment, every clean time in your history, and the PB segment. A stored gold under 60% of your median is treated as a mis-split and ignored (shown as "gold ignored"). |
| **Typical** | Median of your last 50 clean times. Used instead of the average so one disaster attempt doesn't drag it. |
| **Save to gold** | PB segment − gold, never below zero. The most this segment can ever give back. |
| **Good-day save** | PB segment − your good-day time (25th percentile of your last 50 clean times, the time you beat 1 attempt in 4), never below zero. Zero means your PB already had a good version of this segment. |
| **Variability** | (75th percentile − 25th percentile) ÷ median, over your last 50 clean times. 10% on a 2 minute segment means the middle half of your attempts spans about 12 seconds. |
| **Reset rate** | Attempts that reached the segment but have no time for it ÷ attempts that reached it. A high rate on the first segment is normal. |

## Practice advice

Every segment is checked against four rules. Advice is grouped by segment and ranked by its estimated worth, biggest first.

| Advice | Shown when | Estimated worth |
| --- | --- | --- |
| **Slow in PB** | The PB segment was slower than your typical time. | PB segment − good-day time. |
| **Inconsistent** | Variability is above 10%. | Half the gap between your 25th and 75th percentile. |
| **Gold is rare** | Your typical time is more than 8% slower than your gold. | The smaller of save to gold and typical − gold. |
| **Runs die here** | Reset rate is above 15% and at least 10 attempts reached the segment. | The segment's good-day save. |

## Category score

Each game and category gets a score from 0 to 100 for how well you run it, worked out from that category's split
file alone. Every part is a ratio of your own run rather than a time, so a 12 minute category and a 2 hour one sit on
the same scale. It doesn't compare you with other runners. Settings come from `SCORE_SETTINGS` in
[`packages/core/src/score.ts`](../packages/core/src/score.ts).

| Part | Weight | How it's calculated |
| --- | --- | --- |
| **Efficiency** | 40% | Gap = (PB − sum of best) ÷ sum of best. Score = 100 × (1 − gap ÷ 10%): 100 when the PB equals the sum of best, 0 at a 10% gap or more. |
| **Consistency** | 25% | Segment variabilities averaged with each segment's typical time as its weight. Score = 100 × (1 − variability ÷ 20%), so 10% (where Inconsistent advice starts) scores 50. Segments with fewer than 5 clean times are left out. |
| **Completion** | 20% | Finished attempts ÷ attempts that reached the middle segment, × 100. Early resets don't count. |
| **Improvement** | 15% | Change = (median of the previous 10 finishes − median of the last 10) ÷ previous median. Score = 50 + 50 × change ÷ 3%: no change is 50, 3% faster is 100, 3% slower is 0. Needs 20 finished runs. |

Every part is clamped to 0–100. A part that can't be worked out is left out and the other weights are scaled up to
make 100%. The score is rounded to a whole number.

A score is **provisional** when the file has fewer than 20 finished runs, fewer than 5 segments, or fewer than 3 parts
could be worked out.

Example (Dishonored sample, real time): efficiency 76 (2.4% gap) × 40% + consistency 64 (7.2% variability) × 25% +
completion 26 (30 of 116 attempts from halfway finished) × 20% + improvement 74 (1.4% faster) × 15% = 63.

### Profile

The profile keeps one score per game and category, saved in your browser (or on your computer in the desktop app).
Adding a newer file for the same game and category replaces the old one.

- **Overall score:** the average of your 5 best category scores, leaving out provisional ones.
- **WR pace:** a reference time ÷ PB, also shown for the realistic target. The reference is a time you type in, or a
  comparison in the split file named "World Record" or "WR". It's shown next to the score but doesn't change it.

## Practice plan

The practice plan ranks segments by the time an hour of practice is expected to take off a typical run, then turns
the ranking into a session. Settings come from `PRACTICE_SETTINGS` in
[`packages/core/src/practice.ts`](../packages/core/src/practice.ts). The assumed learning rate and the rep overhead
are first guesses, to be tuned against real split files.

| Number | How it's calculated |
| --- | --- |
| **Gap to good day** | Typical time − good-day time. The most practice is expected to take off a typical run. A shaky segment has a wider gap. |
| **One rep** | Typical time + 20 seconds to reload a save or get back into position. |
| **Learning per doubling** | How much faster the segment got each time your number of clean times doubled: a straight line through (log2 of rep number, segment time), fitted to 8 equal groups of your clean times in attempt order (average log2 rep number, median time). Getting slower counts as no learning. Needs 10 clean times. |
| **Learning rate used** | Your own rate blended with an assumed 2% of the typical time per doubling. Your rate's weight is n ÷ (n + 30) for n clean times, so it counts as much as the assumption at 30 times. |
| **Per hour** | Learning rate used × log2((n + reps in an hour) ÷ n), capped at the gap to good day. Each extra rep is worth less than the last, so a segment you've played 500 times gains less from an hour than one you've played 50 times. |

**The session** (60 minutes unless you pick 30, 90 or 120): a quarter of it, rounded so the rest is whole 5 minute
blocks, is kept for full runs when one typical run (median of your last 50 finishes) fits in it. Otherwise the whole
session is segment practice. The blocks are handed out one at a time, each to the segment whose next block is
expected to save the most, so time spreads out as a segment's returns shrink. The plan's total is the sum of what each
segment's minutes are expected to save. Segments with fewer than 5 clean times are left out.

## Goal planner

You type a goal such as sub 40:00. The plan starts from your PB and finds the least demanding set of segment times
that finishes under it (a hundredth under, so LiveSplit shows it as sub).

- Your own spread of times is the difficulty of each segment. The plan asks every segment for the same pace,
  measured as a share of your recent clean times ("a time you hit in 1 of every 7 attempts"), and picks the most
  relaxed pace whose segment times add up to the goal. Segments where your times swing widely give more time at the
  same pace than segments you already play close to your best.
- A segment keeps its PB time when the PB is already faster than that pace, or when it has fewer than 5 clean
  times.
- The realistic target is the same idea at a fixed pace of 1 in 4 (the good-day time). A goal that needs a rarer
  pace says how much more often you'd need to hit those times to make it a good-day goal.
- When even your best recent time in every segment isn't enough, the plan moves each segment from its recent best
  towards its gold by the same fraction. When the goal is faster than every segment at its gold, the plan says it
  needs new golds first.

## LiveSplit comparisons

"Race these in LiveSplit" saves a copy of your split file with up to three comparisons added. The original file is
never changed, and saving again from a copy replaces these comparisons rather than adding them twice.

- **Realistic target**: each segment at its good-day time, or its PB time where that's faster.
- **Sub X (balanced)**: the goal plan, split by split. It's written for the timing method the page is showing.
- **Recent golds**: the best clean time in each segment over its last 50 times. Unlike the sum of best, a gold set
  long ago and never matched since doesn't count.

The realistic target and recent golds are written for both real time and game time when the file has both.

## Session insights

Settings come from `SESSION_INSIGHT_SETTINGS` in
[`packages/core/src/session-insights.ts`](../packages/core/src/session-insights.ts). Session grouping
on its own is in [`packages/core/src/sessions.ts`](../packages/core/src/sessions.ts) for other features to reuse.

- **Sessions.** LiveSplit 1.6 and later save when every attempt started and ended (in UTC). A break of more than
  30 minutes starts a new session. Files without attempt dates, or with fewer than 8 sessions, get no insights.
- **Pace.** Each clean segment time is compared with your usual time for that segment: the median of the 51 clean
  times around that attempt. Using nearby attempts keeps months of improvement from looking like a session effect. A
  segment counts as at most 2× its usual time, so a pause doesn't swamp the rest.
- **When a split was played.** Each split is placed at the time it was played within its session, not when its
  attempt started, so one long run (a 5-hour Twilight Princess run, say) spreads across the whole session. Because
  pace is against each segment's own usual time, fatigue only shows up when the same segments get played at
  different points in a session, for example after a long block of resets one day and fresh the next.
- **Warm-up.** The first 20 minutes from a session's first split against the rest of that session.
- **Peak window.** Pace in each stretch of a session (0-20 min, 20-40 min, 40 min-1h, 1-1.5h, 1.5-2h, 2-3h, 3-4h,
  4h+) against that session's own average.
- **Fatigue.** Pace before and after 1h, 1.5h, 2h, 2.5h, 3h and 4h into a session, for sessions with at least 3
  splits on each side, and reset rate for sessions with at least 3 attempts on each side. The point where things get
  worse the most is reported.
- **Tilt.** The attempt right after a reset in the last third of the route, or after a finished run within 2% of the
  PB standing at the time, against every other next attempt: how often it resets in the first third, and its pace.
- **Time of day and day of week.** Each session's pace, grouped by when the session started (in the computer's time
  zone), against all other sessions.

Sessions, not attempts, are the unit for every comparison except tilt, because attempts in one session aren't
independent. An effect is stated only when it is at least 0.5% of pace (or 5 points of reset rate), its 95% interval
excludes zero (99% when the best of several windows, days or times is picked), and at least 8 sessions or 15 events
back it. Otherwise the app says there is no clear effect, or not enough data yet.

## Timing method

Real time is used unless the PB only has game time. When a file has both, the app shows a Real time / Game time switch and every number is recalculated for the one you pick.
