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

## Timing method

Real time is used unless the PB only has game time. When a file has both, the app shows a Real time / Game time switch and every number is recalculated for the one you pick.
