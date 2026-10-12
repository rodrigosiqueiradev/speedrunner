# How Speedrunner calculates each number

Everything is worked out from your LiveSplit split file (`.lss`), in your browser. Nothing is uploaded.
The app shows the same explanations next to each number (the **?** buttons) and in its
"How it's calculated" section, with examples taken from the run you load.

For what each feature does and where to find it, see the [feature guide](features.md). For every formula written out
with definitions, derivations and the assumptions behind it, see [The mathematics of Speedrunner](calculations.md).

Defaults below come from `ANALYSIS_DEFAULTS` and `ADVICE_THRESHOLDS` in
[`packages/core/src/analyze.ts`](../packages/core/src/analyze.ts).

**Any category length.** Nothing below assumes how long a category is. Rules are ratios of your own times or counts
of your own attempts, never fixed seconds, so the same rule works for a 10 minute category with thousands of attempts
and a 6 hour one with a few dozen. "Recent" is defined once, in
[`packages/core/src/recency.ts`](../packages/core/src/recency.ts): the latest half of a segment's clean times, at least
10 (or all of them) and at most 50. A category with 1,000 times per segment uses its last 50; one with 20 uses its last
10, instead of months of history.

| Setting | Default |
| --- | --- |
| Recent attempts used for "current form" stats | the latest half of each segment's clean times, 10 to 50 |
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

Example (Dishonored sample, real time): PB 40:01.51 − 12.15s of good-day saves from 4 segments = realistic target 39:49.37.

## Per segment

| Column | How it's calculated |
| --- | --- |
| **PB** | This segment's split time in the PB minus the previous split's. Blank if the PB skipped a neighbouring split. |
| **Gold** | The fastest of LiveSplit's stored best segment, every clean time in your history, and the PB segment. A stored gold under 60% of your median is treated as a mis-split and ignored (shown as "gold ignored"). |
| **Typical** | Median of your recent clean times (the latest half, 10 to 50). Used instead of the average so one disaster attempt doesn't drag it. |
| **Save to gold** | PB segment − gold, never below zero. The most this segment can ever give back. |
| **Good-day save** | PB segment − your good-day time (25th percentile of your recent clean times, the time you beat 1 attempt in 4), never below zero. Zero means your PB already had a good version of this segment. |
| **Variability** | (75th percentile − 25th percentile) ÷ median, over your recent clean times. 10% on a 2 minute segment means the middle half of your attempts spans about 12 seconds. |
| **Reset rate** | Attempts that reached the segment but have no time for it ÷ attempts that reached it. A high rate on the first segment is normal. It counts every reset, including runs you reset for being behind pace. |

## Luck-based segments

Some segments depend on luck: a boss pattern, a minigame, a cycle. Their times fall into a good and a bad outcome you
don't control, so the usual stats would read the gap between them as shaky execution and suggest practising it away.
Tick **Luck** on the Segments tab to mark one. Marks are kept in the app per game and category, by segment name (not
in the split file, which LiveSplit rewrites on every save), and the profile score, live page and overlay use them too.

**Outcomes.** A marked segment's clean times are split where they best separate into a fast and a slow group (Otsu's
method on log times), each holding at least a tenth of them. The segment shows how often luck goes your way recently
and what bad luck typically costs. With fewer than 10 clean times it's treated like any other segment.

**What changes for a marked segment:**

| Number | With a luck mark |
| --- | --- |
| **Variability** and **Inconsistent** | Measured within each outcome and averaged, so only execution counts. |
| **Good-day save** and **Slow in PB** | Compared with your times with the luck the PB had there. Better luck isn't a save you can earn. |
| **Gold is rare** | Your gold against your typical good-luck time. |
| **Runs die here** | Says these may be resets on bad luck, and points to the reset coach. |
| **Practice plan** | The gap practice can close is typical − good-day time within each outcome, weighted by how often each happens. |
| **Sum of best** | Also says how much luck it needs: the share of recent attempts with good luck in each marked segment, multiplied. |
| **Efficiency** | Where the PB had bad luck in a marked segment, the sum of best uses your best bad-luck time there, so luck counts on neither side. |
| **Goal planner** | A target faster than any time you've had there with bad luck is tagged "needs luck". |
| **PB odds** | Still samples your real times, so luck comes up as often as it really does, but a lucky segment no longer counts towards an attempt's form of the day. |

**Suggestions.** Times can't prove luck: a trick that fails a third of the time looks the same. So the app only
suggests ("looks like luck") and nothing changes until you tick it. A segment is suggested when, over at least 20
clean times, the two groups are clearly apart (Ashman's D of 2 or more on log times), the slow one is at least 10%
slower, good luck happens in 20% to 80% of attempts, and the outcomes don't streak or drift over time (a runs test
within 3 standard deviations, and the good share moving less than 20 points between the older and newer half). A
change of strat makes old attempts slow and new ones fast; luck doesn't. Segments with "RNG" in their name are
suggested too. Every rule is a share or ratio of your own times, so it works the same for any run length.

On the reference files it suggests boss knights in Shovel Knight Any%, the chest minigame in OoT 100%, and DDD Skip in
SM64 0 Star. Marking them moved PB odds calibration (where real finishes land in the predicted spread, ideally 50%) by at most 4 points on every file with 7 or more finishes to check.

## Practice advice

Every segment is checked against four rules. Advice is grouped by segment and ranked by its estimated worth, biggest first.

| Advice | Shown when | Estimated worth |
| --- | --- | --- |
| **Slow in PB** | The PB segment was slower than your typical time. | PB segment − good-day time. |
| **Inconsistent** | Variability is above 10%. | Half the gap between your 25th and 75th percentile. |
| **Gold is rare** | Your typical time is more than 8% slower than your gold. | The smaller of save to gold and typical − gold. |
| **Runs die here** | Runs that were going well reset here at least 1.5× as often per minute as in the rest of the run (every other segment after the first), with at least 3 such resets and 10 such runs reaching it. "Going well" means in the faster half of your times at the split before, so resetting a run that was already behind pace (a choice, not a deadly segment) doesn't count. The first segment has no split before it and its resets are mostly bad starts, so it is never flagged. The rate per minute is −ln(1 − good-run reset rate) ÷ typical time, so a long segment isn't flagged for being long, and a 15% reset rate means something different in a 5 segment run and a 60 segment one. | The segment's good-day save. |

## Category score

Each game and category gets a score from 0 to 100 for how well you run it, worked out from that category's split
file alone. Every part is a ratio of your own run rather than a time, so a 12 minute category and a 2 hour one sit on
the same scale. It doesn't compare you with other runners. Settings come from `SCORE_SETTINGS` in
[`packages/core/src/score.ts`](../packages/core/src/score.ts).

| Part | Weight | How it's calculated |
| --- | --- | --- |
| **Efficiency** | 40% | Gap = (PB − sum of best) ÷ sum of best. Score = 100 × (1 − gap ÷ 10%): 100 when the PB equals the sum of best, 0 at a 10% gap or more. |
| **Consistency** | 25% | Segment variabilities averaged with each segment's typical time as its weight. Score = 100 × (1 − variability ÷ 20%), so 10% (where Inconsistent advice starts) scores 50. Segments with fewer than 5 clean times are left out. |
| **Completion** | 20% | Of the attempts that reached the middle segment going well (the faster half of their times at the split before it), the share that finished, × 100. Early resets don't count, and neither do runs reset for being behind pace: the reset coach often recommends those, and short categories do it far more than long ones. |
| **Improvement** | 15% | Your finishes split into two equal groups, the latest and the ones just before, half of your finishes each and at most 10. Change = (median of the earlier group − median of the latest) ÷ earlier median. Score = 50 + 50 × change ÷ 3%: no change is 50, 3% faster is 100, 3% slower is 0. Needs 8 finished runs. |

Every part is clamped to 0–100. A part that can't be worked out is left out and the other weights are scaled up to
make 100%. The score is rounded to a whole number.

A score is **provisional** when the file has fewer than 8 finished runs, fewer than 10 clean times in a typical
segment, fewer than 5 segments, or fewer than 3 parts could be worked out. These are low enough that a long category
with a few dozen attempts can reach them.

Example (Dishonored sample, real time): efficiency 76 (2.4% gap) × 40% + consistency 66 (6.7% variability) × 25% +
completion 68 (27 of the 40 good runs from halfway finished) × 20% + improvement 74 (1.4% faster) × 15% = 72. Of the
116 attempts that reached the middle, only 30 finished, but most of the rest were reset for being behind pace.

### Profile

The profile keeps one score per game and category, saved in your browser (or on your computer in the desktop app). It also keeps a copy of each category's split file there, so Year in runs starts from your profile's files and any category opens in Analyse a run without choosing the file again. Categories added before files were kept need their file added once more.
Adding a newer file for the same game and category replaces the old one.

- **Overall score:** the average of your 5 best category scores, leaving out provisional ones.
- **WR pace:** a reference time ÷ PB, also shown for the realistic target. The reference is a time you type in, or a
  comparison in the split file named "World Record" or "WR". It's shown next to the score but doesn't change it.

## PB odds and the reset coach

The app plays 10,000 runs on paper from a model of how you run right now, and counts how often they beat your PB.
Categories run from a few minutes to many hours, so nothing in it is a fixed time: every setting is a count of your own
attempts or a ratio of your own times. Settings come from `PB_ODDS_SETTINGS` in
[`packages/core/src/pb-odds.ts`](../packages/core/src/pb-odds.ts). The model is `buildFormModel` in
[`packages/core/src/segment-model.ts`](../packages/core/src/segment-model.ts), so other features can sample whole runs
from it too.

**The form model.**

- **Recent times count more.** A sample's weight halves every quarter of your samples, kept between 5 and 25 newer
  samples. Each segment's typical time is its recency-weighted median.
- **Times from finished runs.** A segment uses times from runs that reached the end once it has at least 5 of them,
  and all clean times before that. Runs you reset are mostly bad runs, and would drag the odds down.
- **Form of the day.** An attempt's form is the average log ratio of its segment times to typical, for attempts with
  clean times in at least 25% of the segments. Each simulated run picks one recent form (recency-weighted) and applies
  it to every segment, so a good day is good across the whole run. Each segment then adds its own variation: one of
  its times, with its attempt's form taken out. Without a shared form, many segments average out and a long run's
  finishes cluster tightly around the typical one.
- **Improvement.** A recency-weighted straight line through form against attempt number, projected to your next
  attempt. Half of that is taken off every simulated run. A slowdown is never projected.

**Mistakes.** For each segment the segment model also keeps a mistake rate: resets among your last 50 attempts that
reached it while in the faster half at the split before. Those runs were going well, so their resets are mostly
mistakes rather than pace resets. It's never higher than the segment's reset rate among all runs: a mistake can end a
slow run as easily as a fast one, so that rate already counts every mistake. Late in a long category only a handful
of good runs get that far, and one reset among five of them would otherwise read as a 20% chance of dying there.

| Number | How it's calculated |
| --- | --- |
| **If you finish** | Simulated runs under your PB ÷ all of them. Typical finish is the middle simulated finish; a good finish is the one you beat 1 run in 10. |
| **PB chance per attempt** | If you finish × your finish rate, the share of your last 50 attempts that reached the end (reaching further back until it holds 5 finished runs, so a category where most attempts are reset still gets odds). Shown as "1 in N". |
| **PB forecast** | With chance p per attempt, the chance of at least one PB in n attempts is 1 − (1 − p)ⁿ. The forecast is the n where that reaches 50% and 90%. The dates divide n by your attempts per day over the last 28 days you ran (from LiveSplit's attempt start dates) and count from today. |
| **PB chance from a split** | The simulated runs at about your time at that split, weighted by how close they were (a Gaussian whose width is 30% of the spread of simulated times there), and how many of them went on to beat your PB. Being behind also says something about today's form, and that carries forward. Then × the chance of no run-ending mistake in the segments left. "On pace" means you're at exactly your PB's time for the split. |
| **Reset if behind by** | Starting over finds PBs at PB chance per attempt ÷ your average attempt length (from LiveSplit's start and end times of your last 50 attempts, with a timer left running counted only for the time on its splits, as in Year in runs; without dates, from typical segment times and reset rates). Playing on finds them at PB chance from here ÷ the average time left. This is the deficit where the two are equal, searched within 20% of the PB's split time either way, and shown in seconds and as a share of the split time. "Never" means playing on stays faster across that range; "Always" means starting over is faster even 20% ahead. |
| **Goal odds** | The same simulated runs, counted against the goal planner's goal instead of the PB. |

**Should I reset?** Pick a split and how far behind PB pace you are, in seconds or as minutes and seconds (2:30) for
long runs. In **PB hunting** mode the coach says keep going
when playing on finds a PB at least as fast as starting over. In **Practising** mode, for runners who play runs out
anyway, it only gives the PB chance from there and the table drops the reset points.

**How well it's calibrated.** Before each of a file's recent finishes, the model was built from the history up to that
point and the real finish placed within its predicted spread. 50% means well calibrated. On the Dishonored sample
(about 40 minutes, 15 finishes checked) it came out at 48%; on a 6 hour Twilight Princess file (5 finishes) at 54%.
The model before this one gave 21% and 0%: it didn't follow improvement, and long runs came out too tight.

Example (Dishonored sample, real time): 10% of finished runs beat the PB (40:01.51), and 8% of recent attempts
finished, so about 1 in 130 attempts PBs. At Try Not Falling? the coach says reset when more than 6.9s behind PB pace
(1.1% of the split time); at Not At Fault, 56.6s (3.1%).

## Year in runs

A recap of one calendar year across every split file you add, drawn as a 1080 × 1350 image on your machine. Nothing
is uploaded; the PNG is only shared if you share it. Settings come from `RECAP_SETTINGS` in
[`packages/core/src/recap.ts`](../packages/core/src/recap.ts).

- **Year:** each attempt counts in the year it started, on your computer's clock (LiveSplit saves times in UTC).
  Attempts with no start time, as in files from before LiveSplit 1.6, aren't in any year.
- **Hours played:** start to reset or finish, summed. An attempt that lasted more than 3 times the category's typical
  finished run is treated as a timer left running, and only the time on its splits counts. The limit follows each
  category's own length (12 hours for a category with no finishes or PB to judge by).
- **Personal bests:** finished runs faster than every earlier finish in that category. The biggest PB is the category
  whose best time dropped by the biggest share of itself over the year.
- **Golds:** clean segment times faster than all earlier clean times of that segment, once it has at least 5. The best
  gold is the one that beat the old best by the biggest share of it.
- **Most improved:** the segment whose median over its last 10 clean times of the year is the biggest share faster than
  over its first 10 (or each half of the year's times, when it has fewer than 20). Needs 10 clean times in the year.
- The three highlights compare shares, not seconds, because the recap mixes categories: in seconds, a 6 hour
  category's long segments would win every time over a 10 minute category's short ones.
- **Longest streak:** the most days in a row with at least one attempt.

Adding two files for the same game and category keeps only the newer one, so attempts aren't counted twice.

## Practice plan

The practice plan ranks segments by the time an hour of practice is expected to take off a typical run, then turns
the ranking into a session. Settings come from `PRACTICE_SETTINGS` in
[`packages/core/src/practice.ts`](../packages/core/src/practice.ts). The assumed learning rate and the rep overhead
are first guesses, to be tuned against real split files.

| Number | How it's calculated |
| --- | --- |
| **Gap to good day** | Typical time − good-day time. The most practice is expected to take off a typical run. A shaky segment has a wider gap. |
| **One rep** | Typical time + 20 seconds to reload a save or get back into position. The overhead is about menus and reloads, not the category's length. |
| **Learning per doubling** | How much faster the segment got each time your number of clean times doubled: a straight line through (log2 of rep number, segment time), fitted to 8 equal groups of your clean times in attempt order (average log2 rep number, median time). Getting slower counts as no learning. Needs 10 clean times. |
| **Learning rate used** | Your own rate blended with an assumed 2% of the typical time per doubling. Your rate's weight is n ÷ (n + 30) for n clean times, so it counts as much as the assumption at 30 times. |
| **Per hour** | Learning rate used × log2((n + reps in an hour) ÷ n), capped at the gap to good day. Each extra rep is worth less than the last, so a segment you've played 500 times gains less from an hour than one you've played 50 times. |

**The session** (60 minutes unless you pick 30, 90 or 120): a quarter of it, rounded so the rest is whole 5 minute
blocks, is kept for playing segments in context. That's full runs when one typical run (median of your recent
finishes) fits in it. When it doesn't, as in a long category, it's a stretch of the route in one go: the top segment
and its neighbours (growing towards whichever gains more per hour), as many as fit with one reload. If not even two
segments fit, the whole session is segment practice. The blocks are handed out one at a time, each to the segment
whose next block is expected to save the most per minute, so time spreads out as a segment's returns shrink. A
segment whose rep takes longer than 5 minutes gets blocks of the next multiple of 5 that holds a whole rep. The plan's total is the sum of what each
segment's minutes are expected to save. Segments with fewer than 5 clean times are left out.

## Goal planner

You type a goal such as sub 40:00. The suggested goal is a round time just under your PB, on the largest round step
(1 s, 5 s, 10 s, 15 s, 30 s, 1 min, 5 min and so on) that is at most 1% of the PB: 40:01.51 suggests 40:00, and
5:42:54.89 suggests 5:42:00. The plan starts from your PB and finds the least demanding set of segment times
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
- **Recent golds**: the best clean time in each segment over its recent times (the latest half, 10 to 50). Unlike the
  sum of best, a gold set long ago and never matched since doesn't count.

The realistic target and recent golds are written for both real time and game time when the file has both.

## Live stats

Live stats follows LiveSplit's timer while you run and compares the attempt against your own history. The timer is
read from LiveSplit's own server on your computer (`ws://localhost:16834/livesplit` by default), four times a second.
It only reads: it never starts, splits or resets your timer.

Most of these are numbers from the sections above, read from where your run is now, so what follows is what each one
means live. They compare against your **usual** time for a segment: the **Typical** time above, the median of your
recent clean times (the latest half, 10 to 50), or the segment's PB time when it has too few clean times for one. The
formulas are in [§13 of the maths](calculations.md#13-live-stats).

| Number | How it's calculated |
| --- | --- |
| **Split** | The segment LiveSplit is timing now, and how many segments the run has. **Finished** once the run ends. |
| **Run time** | The time on LiveSplit's timer, in whichever timing method LiveSplit is showing. |
| **PB chance** | **PB chance from a split** above, for the split you are on: the simulated runs that reached it at about your time, and how many of them went on to beat your PB. Before your first split it's the chance a run you start now beats your PB and has no run-ending mistake, including in the first segment. During a segment it keeps moving, because only the simulated runs whose segment took at least as long as yours is taking still look like this run: it falls as the segment runs long, and is 0% once the timer passes your PB. The arrow shows how the last segment, or the one you're on, moved it. At the end it reads **New PB** or **No PB**. |
| **Keep going?** | The reset coach's verdict above for where your run is now: keep going while playing on finds a PB at least as fast as starting over. During a segment it turns to **Reset** as soon as splitting right now would already say reset, because a reset verdict at this split holds for every later one too. It's shown from your first split to your last, and it never resets for you. |
| **vs PB** | Your time at the last split minus your PB's time at the same split: ahead is −, behind is +. A split your PB skipped has no comparison. During a segment it ticks with the timer, showing the delta you'd have if you split now. |
| **vs goal** | The same against your goal's splits: your realistic target until you set a goal, then the goal plan's splits for it, the same times as the **Sub X (balanced)** comparison above. The goal is the goal planner's, kept per game and category, so setting it in either place sets it in both. A goal out of reach has no plan, so the stat reads **Out of reach**. |
| **Last segment** | The segment you just finished minus your usual time for it, in time and as a share of the usual, or **Gold** when it beat your gold. The share makes a 2 second loss in a 30 second segment and a 2 minute loss in a 1 hour segment read the same way. |
| **Likely finish** | Your time at the last split plus your usual time for every segment still to play. When the segment you're on has already run longer than usual, it counts on from the time on the timer instead, so the projection never drops behind the clock. |
| **Best possible** | The same with every segment still to play at its gold. |
| **This segment** | Your usual time for the segment you're on, with its gold and its time in your PB. |
| **Up next** | The segment after it, or the first segment before a run starts: its usual time, its gold and its **Runs die here** share. Nothing shows during the last segment. |
| **Runs die here** | Of your attempts that reached this segment going well — in the faster half of your times at the split before — the share that were reset in it. It's the rate behind the **Runs die here** advice above, not the **Reset rate** column, which counts every attempt. The first segment has no split before it, so it falls back to the reset rate over every attempt that reached it, as does a segment no good run has reached. |
| **Golds this run** | Segments in this attempt faster than your gold, counted against the golds in the file you loaded, so one LiveSplit has saved since you loaded it still counts here. |
| **This session** | Attempts, finishes, PBs and best time since you opened the page: an attempt when the timer starts, a finish when it ends, and a PB when a finish beats both your file's PB and every earlier finish this session. |

**Demo.** Without LiveSplit, the demo replays your own recent attempts — the ones that reached the first split,
finishes and resets alike, in no fixed order. An attempt you reset is replayed resetting half your usual time into
the segment it died in (at least a second). The two faster speeds scale the replay against your PB, or your usual run
length when you have no PB, so a whole run takes 2 minutes or 30 seconds on screen whatever the category's length.

## Session insights

Settings come from `SESSION_INSIGHT_SETTINGS` in
[`packages/core/src/session-insights.ts`](../packages/core/src/session-insights.ts). Session grouping
on its own is in [`packages/core/src/sessions.ts`](../packages/core/src/sessions.ts) for other features to reuse.

- **Sessions.** LiveSplit 1.6 and later save when every attempt started and ended (in UTC). A break of more than
  30 minutes starts a new session. An attempt that lasted more than 3 times the category's typical finished run is a
  timer left running and ends when its splits do (the Year in runs rule), so a timer left open overnight doesn't join
  two days into one session. Files without attempt dates, or with fewer than 8 sessions, get no insights.
- **Pace.** Each clean segment time is compared with your usual time for that segment: the median of the clean
  times around that attempt, half of the segment's history (at least 10, at most 50). Using nearby attempts keeps
  months of improvement from looking like a session effect, however many attempts you have. A
  segment counts as at most 2× its usual time, so a pause doesn't swamp the rest. A time after a skipped split
  covers two segments, so it isn't compared.
- **When a split was played.** Each split is placed at the time it was played within its session, not when its
  attempt started, so one long run (a 5-hour Twilight Princess run, say) spreads across the whole session.
- **Same split, same session.** Warm-up, peak window and fatigue compare a split only with the same split played at
  another time in the same session (each play against that segment's average in the session). In a long category
  with one run a session, the first splits are always played first, so "early in the session" would otherwise just
  mean "early in the route", and the runs you reset early would drag the start of the session down. Those findings
  need sessions where you replay segments; with one run a session they say there isn't enough data.
- **Warm-up.** The first 20 minutes from a session's first split against the rest of that session.
- **Peak window.** Pace in each stretch of a session (0-20 min, 20-40 min, 40 min-1h, 1-1.5h, 1.5-2h, 2-3h, 3-4h,
  4-5h, 5-6h, 6-8h, 8-10h, 10h+) against that session's own average. Only stretches that start before the length 90%
  of your sessions fit in are used, so 45 minute sessions and 6 hour sessions both get a chart that fits them.
- **Fatigue.** Pace before and after 30 min, 45 min, 1h, 1.5h, 2h, 2.5h, 3h, 4h, 5h, 6h and 8h into a session (up to
  the length 90% of your sessions fit in), for sessions that replay at least 3 splits on each side, and reset rate for
  sessions with at least 3 attempts on each side. The point where things get
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
