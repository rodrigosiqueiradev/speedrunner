# The mathematics of Speedrunner

*A complete account of every calculation in Speedrunner: definitions, formulas, and the arguments for why each one
measures what it claims to, with every assumption stated.*

**Companion documents.** [The feature guide](features.md) describes what each feature shows and where to find it.
[How Speedrunner calculates each number](how-it-works.md) is the plain-language reference the app itself shows. This
paper is the formal version of the latter: where they differ in wording, they agree in substance, and both follow the
code in [`packages/core/src`](../packages/core/src), which is the source of truth. Every constant quoted here is read
from the exported settings objects named in [Appendix A](#appendix-a-settings).

**Worked examples** use two files throughout:

- **D**: the Dishonored Any% sample shipped with the app (13 segments, about 40 minutes, 1,958 attempts, 30 finished
  attempts with full segment history), real time.
- **TP**: a Twilight Princess JP Glitchless Any% file (56 segments, about 5 hours 43 minutes, 76 attempts, 13 finished),
  real time. It is one of the project's private reference files and is not in the repository.

## Contents

0. [Abstract and conventions](#0-abstract-and-conventions)
1. [The data and its cleaning](#1-the-data-and-its-cleaning)
2. [Run totals](#2-run-totals)
3. [Per-segment statistics](#3-per-segment-statistics)
4. [Practice advice](#4-practice-advice)
5. [Luck-based segments](#5-luck-based-segments)
6. [Category score](#6-category-score)
7. [The form model and PB odds](#7-the-form-model-and-pb-odds)
8. [Goal planner](#8-goal-planner)
9. [Practice plan](#9-practice-plan)
10. [Session insights](#10-session-insights)
11. [Year in runs](#11-year-in-runs)
12. [LiveSplit comparisons](#12-livesplit-comparisons)
13. [Live stats](#13-live-stats)
14. [Numerical details](#14-numerical-details)
- [Appendix A: Settings](#appendix-a-settings)
- [Appendix B: Notation](#appendix-b-notation)
- [References](#references)

---

## 0. Abstract and conventions

Speedrunner turns one LiveSplit split file into estimates of where a runner loses time, what they could
realistically run, how likely a personal best (PB) is, what to practise and how well they run the category. Every
estimate is built from the runner's own history only. The guiding design constraint is **scale freedom**: categories
last from a few minutes to many hours and have from a few dozen to tens of thousands of attempts, so no rule may
depend on a fixed number of seconds or a fixed number of attempts. Section [1.5](#15-scale-freedom) makes this
precise and lists the few deliberate exceptions.

**Conventions.**

- Times are in milliseconds. A *segment* is the stretch between two splits; the run has $n$ segments, numbered
  $1,\dots,n$ in this paper (the code counts from 0).
- $\mathrm{clamp}_{[a,b]}(x) = \min(b, \max(a, x))$.
- For a finite multiset $X$, $\lvert X\rvert$ is its size, $\min X$ its least element and $Q(X; q)$ its quantile
  (Definition 1.4). $\mathrm{med}\, X = Q(X; \tfrac12)$.
- $\mathbf 1[\cdot]$ is the indicator function. $\lceil\cdot\rceil$ and $\lfloor\cdot\rfloor$ round up and down.
- "Recent" always means the window of Definition 1.7 unless stated otherwise.

Each section gives **definitions**, the **formula**, and then **propositions** with short proofs or arguments. A
statement labelled *Assumption* is not proved; it is the modelling choice the result depends on.

---

## 1. The data and its cleaning

### 1.1 What a split file records

LiveSplit stores, for a run with segments $1,\dots,n$:

- an **attempt history**: attempts with a positive integer id $a$, optional start and end timestamps (LiveSplit 1.6
  and later, in UTC), and a final time $T(a)$ if the attempt finished;
- for each segment $i$, a **segment history** $H_i$: a partial map from attempt ids to either a positive duration or
  the mark $\bot$ ("split skipped");
- the PB's cumulative split times $S_1,\dots,S_n$ (any may be missing) and LiveSplit's stored best segment
  $g^{\text{stored}}_i$;
- custom comparisons, such as a "World Record" comparison.

**Definition 1.1 (reaching and resetting).** Attempt $a$ *reached* segment $i$ if $i=1$ or $H_{i-1}(a)$ is defined
(a duration or $\bot$). It *reset in* segment $i$ if it reached $i$ and $H_i(a)$ is undefined. It *finished* if
$H_n(a)$ is a duration. Write $A_i$ for the set of real attempts ($a>0$) that reached segment $i$.

Entries with $a \le 0$ are excluded everywhere: LiveSplit uses non-positive ids for history imported or merged from
other files, which are not attempts the runner played in this file.

### 1.2 Clean segment times

**Definition 1.2 (candidate time).** The pair $(a, t)$ with $t = H_i(a)$ is a *candidate* for segment $i$ if $t > 0$ and
either $i = 1$ or $H_{i-1}(a)$ is a duration (not $\bot$, not undefined).

**Lemma 1.1.** A candidate time is exactly the duration of segment $i$ in attempt $a$.

*Argument.* LiveSplit records a segment's time as the split time minus the previous *recorded* split time. If split
$i-1$ was skipped, the time stored for segment $i$ runs from split $i-2$ (or the start) to split $i$, so it covers two
segments. Requiring $H_{i-1}(a)$ to be a duration is therefore necessary and sufficient for $t$ to cover segment $i$
alone. *(Assumption: LiveSplit's storage rule as just described, which holds for versions 1.0 to current.)* $\square$

**Definition 1.3 (mis-split floor and clean times).** Let $K_i$ be the candidates of segment $i$. If
$\lvert K_i\rvert \ge 5$, the floor is $\varphi_i = 0.6 \cdot \mathrm{med}\,\lbrace t : (a,t)\in K_i\rbrace$,
otherwise $\varphi_i = 0$. The **clean times** are $C_i = \lbrace (a,t) \in K_i : t \ge \varphi_i\rbrace$, ordered by
attempt id (oldest first). Every per-segment statistic in this paper uses $C_i$.

*Why 60% of the median.* A time 40% faster than the runner's own median is not a plausible execution of the same
segment; it is a double press or a split at the wrong moment. The median is used because it has a 50% breakdown point:
even if nearly half the candidates were mis-splits, the floor would still sit at a real segment's scale. The rule
only applies with at least 5 candidates, when the median means something.

### 1.3 Quantiles

**Definition 1.4 (quantile).** For values sorted as $x_{(1)} \le \dots \le x_{(m)}$ and $q \in [0,1]$, let
$p = (m-1)q$, $\ell = \lfloor p\rfloor$, $h = \lceil p\rceil$. Then

```math
Q(x; q) = x_{(\ell+1)} + \bigl(x_{(h+1)} - x_{(\ell+1)}\bigr)\,(p - \ell).
```

This is the linear-interpolation estimator (type 7 in Hyndman and Fan [1]). The per-segment statistics round it to the
nearest millisecond; the goal planner keeps it unrounded.

**Lemma 1.2.** $Q(x;q)$ is continuous and non-decreasing in $q$, $Q(x;0) = \min x$, $Q(x;1) = \max x$, and
$\min x \le Q(x;q) \le \max x$. For $c > 0$, $Q(cx; q) = c\,Q(x;q)$.

*Proof.* $Q$ is piecewise linear in $q$ with non-negative slopes $x_{(h+1)}-x_{(\ell+1)}$ and agrees at the knots, so
it is continuous and non-decreasing; the endpoints follow from $p = 0$ and $p = m-1$. Scaling every $x$ by $c>0$
preserves the order and scales each term. $\square$

**Definition 1.5 (weighted quantile).** For values $v_k$ with weights $w_k > 0$ and total $W$, the weighted
$q$-quantile is the smallest $v$ (in sorted order) whose cumulative weight reaches $qW$. The weighted median is the
case $q = \tfrac12$.

### 1.4 Recency

Current form matters more than history from months ago, but "recent" cannot be a fixed number of attempts: 50 is a
fortnight of a 10 minute category and years of a 6 hour one.

**Definition 1.6 (half-life and weights).** For a history of $m$ samples ordered oldest first,

```math
h(m) = \mathrm{clamp}_{[5,\,25]}\!\left(\tfrac{m}{4}\right), \qquad
w_k = 2^{-(m-1-k)/h(m)}, \quad k = 0,\dots,m-1 .
```

The newest sample weighs 1 and a sample's weight halves every $h(m)$ samples back.

**Definition 1.7 (recent window).** $r(m) = \min\bigl(m, \lceil 2h(m)\rceil\bigr)$, and the *recent* times of a
segment are the latest $r(\lvert C_i\rvert)$ clean times, written $R_i$.

**Proposition 1.3.** The recent window is the latest half of the history, at least 10 (or all of it) and at most 50:

```math
r(m) = \begin{cases}
m & m \le 10,\\
10 & 10 \le m \le 20,\\
\lceil m/2 \rceil & 20 \le m \le 100,\\
50 & m \ge 100.
\end{cases}
```

*Proof.* For $m \le 20$, $m/4 \le 5$ so $h = 5$ and $r = \min(m, 10)$. For $20 \le m \le 100$, $h = m/4$ and
$\lceil 2h\rceil = \lceil m/2\rceil \le m$. For $m \ge 100$, $h = 25$ and $r = \min(m, 50) = 50$. $\square$

**Proposition 1.4.** The recent window holds the samples whose recency weight is above a quarter of the newest one's.

*Proof.* The sample $j$ places back from the newest has weight $2^{-j/h}$, which exceeds $\tfrac14 = 2^{-2}$ exactly
when $j < 2h$. The number of such $j \ge 0$ is $\lceil 2h\rceil$, capped by $m$. $\square$

So the two notions of recency (weights for the PB odds model, a plain window everywhere else) are one rule seen two
ways. In **D**, a segment with 145 clean times uses its last 50; in **TP**, one with 17 uses its last 10.

### 1.5 Scale freedom

**Theorem 1.5 (scale freedom).** Let a split file be transformed by multiplying every duration (segment times, split
times, final times, golds, comparison times) by $c > 0$. Then every *ratio* Speedrunner reports (variabilities,
shares, rates, probabilities, scores, paces) is unchanged, and every *time* it reports is multiplied by $c$, with the
exceptions listed below.

*Argument.* Every rule in this paper is built from these operations: quantiles and medians (equivariant by Lemma 1.2),
minima, maxima, sums and differences of times (equivariant), ratios of times (invariant), logarithms of ratios
(invariant), comparisons of times with times (invariant), and counts of attempts (untouched). Selections such as "the
faster half at a split" or "the clean times" compare times with times scaled by the same $c$, so the same attempts are
selected. The recency window and weights depend only on counts. A composition of equivariant and invariant steps is
equivariant or invariant. The project's tests check this by scaling real files by 36 and comparing every answer
(`packages/core/test/run-length.test.ts`). $\square$

**Deliberate exceptions.** A few settings are human times rather than ratios, because they describe the runner, not the
category: the 20 second overhead to reload a save for a practice rep (§9), the practice session length (§9), the
30 minute break that separates sessions (§10), the minute buckets and fatigue points of session insights (§10, cut to
the length of the runner's own sessions), the 12 hour limit for an attempt in a category with no finish or PB to judge
by (§10.1), and the calendar (dates, days, the 28 day grind window in §7.6). Tiny floors that only prevent division by
zero (1 ms) are also absolute.

---

## 2. Run totals

**Definition 2.1.** Let $S_i$ be the PB's cumulative split times.

- **Personal best**: $\mathrm{PB} = S_n$, the PB's time at the last split. As in LiveSplit, a file whose last split has
  no PB time (a split added after the PB, say) has no PB.
- **PB segment time**: $p_1 = S_1$ and $p_i = S_i - S_{i-1}$, undefined if either split is missing.
- **Gold**: $g_i = \min\bigl(g^{\text{stored}}_i,\ \min C_i,\ p_i\bigr)$ over the terms that exist, where the stored
  gold is dropped if $g^{\text{stored}}_i < \varphi_i$ (a stored mis-split, shown as "gold ignored"). The PB segment is
  included because the PB attempt's own history can be missing from imported files.
- **Sum of best**: $\mathrm{SoB} = \sum_i g_i$ (when every gold exists).
- **Typical, good-day and bad-day times**: with $R_i$ the recent clean times, if $\lvert R_i\rvert \ge 5$,
  $m_i = Q(R_i;\tfrac12)$, $q^{-}_i = Q(R_i;\tfrac14)$ and $q^{+}_i = Q(R_i;\tfrac34)$; otherwise undefined.
- **Good-day save**: $s_i = \max(0, p_i - q^{-}_i)$, or 0 when undefined.
- **Skipped stretch**: when the PB skipped a split, it has no $p_i$ for the segments on either side of it. A skipped
  stretch $K = \{a, \dots, b\}$ is a maximal run of segments with PB splits $S_{a-1}$ (or $S_0 = 0$) and $S_b$ but none
  in between. Its PB time is $P_K = S_b - S_{a-1}$, and its save is $s_K = \max\bigl(0, P_K - \sum_{i \in K} q^{-}_i\bigr)$
  when every $q^-_i$ in it exists, otherwise 0. Inside a stretch the PB's luck is unknown, so $q^-_i$ is taken over all
  recent clean times even for a segment marked as luck (§5).
- **Realistic target**: $\mathrm{RT} = \mathrm{PB} - \sum_{i \notin \cup K} s_i - \sum_K s_K$ (when PB exists). Every
  segment either has its own $p_i$ or lies in exactly one stretch, so this is the PB with each segment, or each
  stretch, at its good-day time where that is faster.
- **Theoretical save**: $\mathrm{PB} - \mathrm{SoB}$.

The good-day time $q^{-}_i$ is the time the runner beats in one recent attempt out of four. The realistic target asks
"what would my PB be if every segment that went worse than a typical good attempt had gone like one?" A stretch is
compared as one piece because the PB only says how long the whole stretch took, not how it was shared out.

**Theorem 2.1 (ordering).** When all quantities exist, $\mathrm{SoB} \le \mathrm{RT} \le \mathrm{PB}$, provided each skipped stretch's PB time is at least the sum of its golds, $P_K \ge \sum_{i \in K} g_i$ (the right inequality needs no condition).

*Proof.* With every split present, $\mathrm{PB} = \sum_i p_i$, so $\mathrm{RT} = \sum_i (p_i - s_i) = \sum_i \min(p_i, q^{-}_i)$ (taking $\min(p_i, q^-_i) = p_i$ when $q^-_i$ is undefined). Since $s_i \ge 0$, $\mathrm{RT} \le \mathrm{PB}$. For the left inequality it suffices that $g_i \le \min(p_i, q^{-}_i)$ for each $i$. The gold includes
$p_i$ in its minimum, so $g_i \le p_i$. And $q^-_i$ lies between the smallest and largest recent time (Lemma 1.2; the
rounding to whole milliseconds rounds between two integer times and cannot go below the smaller), so $q^-_i \ge \min R_i \ge \min C_i \ge g_i$.

With skipped stretches, $\mathrm{PB} = \sum_{i \notin \cup K} p_i + \sum_K P_K$, so $\mathrm{RT} = \sum_{i \notin \cup K} \min(p_i, q^-_i) + \sum_K \min\bigl(P_K, \sum_{i \in K} q^-_i\bigr) \le \mathrm{PB}$. Each stretch term is at least $\sum_{i \in K} g_i$: the second argument by $q^-_i \ge g_i$ as above, the first by the proviso. $\square$

The proviso can only fail if the PB played a stretch faster than its golds add up to, which means the golds miss the
PB's own unrecorded segment times there; without it, $\mathrm{SoB} \le \mathrm{PB}$ could fail for the same reason.

**Corollary 2.1 (a skipped split never makes the target harder).** For the same good-day times, a stretch's term
$\min(P_K, \sum_{i\in K} q^-_i)$ is at least $\sum_{i \in K}\min(p_i, q^-_i)$, whatever the hidden $p_i$ were, since a
minimum of sums is at least the sum of minimums. So the target with a skipped split is never faster than it would have
been had the PB split there.

The same holds with luck marks (§5), because the reference quantile there is taken over a subset of $C_i$.

**Remark 2.2 (what the realistic target is not).** The realistic target is a per-segment benchmark, not a forecast. If
segments were independent, the chance of every one of $n$ segments coming in at or under its good-day time in the same
attempt would be about $4^{-n}$. It is attainable segment by segment, which is what makes it a good practice target;
the chance of actually beating a time is the job of the PB odds (§7).

**Example (D).** $\mathrm{PB} = 40{:}01.517$, $\mathrm{SoB} = 39{:}06.356$, theoretical save 55.161 s. Four segments
have a good-day save (WatchYr<3Die 0.198 s, Fuckin Celia 0.192 s, Troubled Waters 9.079 s, Don't Mind Me 2.676 s,
12.145 s in all), so $\mathrm{RT} = 40{:}01.517 - 12.145\ \mathrm{s} = 39{:}49.372$. **TP**: PB $5{:}42{:}54.89$, RT $5{:}36{:}43.39$, SoB $5{:}31{:}16.98$.

**Example (skipped splits).** An Ocarina of Time 100% Glitchless file (75 segments, PB $5{:}41{:}23.111$) skipped two
PB splits. FROG HP'S and DIN'S FIRE form a stretch with $P_K = 5{:}57.344$ against good-day times $3{:}54.188 + 1{:}58.625 = 5{:}52.813$, so $s_K = 4.531$ s; GANONDORF and ESCAPE form one with $P_K = 6{:}06.000$ and $s_K = 2.187$ s. With every
other segment's save, $\mathrm{RT} = 5{:}36{:}27.781$.

---

## 3. Per-segment statistics

### 3.1 Typical time

The typical time $m_i$ is the median of the recent clean times. The median rather than the mean is used because one
disastrous attempt (a death, a long pause that wasn't caught as a timer left running) moves the mean by an unbounded
amount but moves the median by at most one rank.

### 3.2 Variability

**Definition 3.1.** $v_i = (q^{+}_i - q^{-}_i) / m_i$, the interquartile range over the median (the *quartile
coefficient of variation*).

**Proposition 3.1.** (a) $v_i$ is scale-free. (b) It is unaffected by any change to the slowest or fastest quarter of
the recent times. (c) If segment times were normally distributed with mean $\mu$ and standard deviation $\sigma$, then
$v_i \approx 1.349\,\sigma/\mu$.

*Proof.* (a) By Lemma 1.2 numerator and denominator both scale by $c$. (b) The quartiles and median depend only on the
middle order statistics. (c) The normal distribution's quartiles are $\mu \pm 0.6745\sigma$, so the IQR is
$1.349\sigma$ and the median is $\mu$. $\square$

So the "Inconsistent" threshold of 10% (§4) corresponds to a coefficient of variation of about 7.4% for normally
distributed times: on a 2 minute segment, the middle half of attempts spans about 12 seconds.

### 3.3 Gold

See Definition 2.1. A stored gold below the mis-split floor is replaced by the best clean time, because LiveSplit keeps
a mis-split gold forever otherwise and every save-to-gold figure would be wrong.

### 3.4 Saves

- **Save to gold**: $\max(0, p_i - g_i)$, the most this segment can ever give back against the PB.
- **Good-day save**: $s_i$ of Definition 2.1, what a typical good attempt would give back.

Since $g_i \le q^-_i$ (proof of Theorem 2.1), the good-day save never exceeds the save to gold. The **route strip**
draws each segment as a column of width $p_i$ and a bar of height $s_i / \max_j s_j$; the **Where the time is** chart
draws the save to gold with the good-day save inside it.

### 3.5 Reset rates

**Definition 3.2.** For segment $i$, the reset rate is $\rho_i = \lvert\lbrace a \in A_i : a \text{ reset in } i\rbrace \rvert / \lvert A_i\rvert$.

A raw reset rate mixes two kinds of reset: *mistakes* (the run died) and *pace resets* (the run was already behind,
and the runner chose to start over, as the reset coach of §7.9 often recommends). Only the first says anything about
the segment.

**Definition 3.3 (split times and good runs).** Let $X_j(a)$ be attempt $a$'s cumulative time at split $j$, defined
when every segment $1..j$ has a duration in $a$. For $i \ge 2$ let $D_i = \lbrace a \in A_i : X_{i-1}(a) \text{ defined}\rbrace$ and $M = \mathrm{med}\,\lbrace X_{i-1}(a) : a \in D_i\rbrace$. The **good runs** at segment $i$
are $G_i = \lbrace a \in D_i : X_{i-1}(a) \le M\rbrace$, the attempts in the faster half of times at the split before.
The **good-run reset rate** is $\rho^{\mathrm{good}}_i$, the share of $G_i$ that reset in $i$. It is undefined for
$i=1$, which has no split before it.

**Proposition 3.2.** $\lvert G_i\rvert \ge \lceil \lvert D_i\rvert / 2\rceil$, with equality when the split times are
distinct.

*Proof.* At least half the values of a multiset are at or below its median, by definition of the median (for an even
count, the interpolated median lies between the two middle values). $\square$

*Why it filters pace resets.* A run in the faster half at the split before is, by construction, not behind the
runner's usual pace, so a reset in segment $i$ is unlikely to be a pace reset. *(Assumption: runners rarely reset runs
that are ahead of their median pace except after a mistake.)*

### 3.6 Reset hazard per minute

Comparing reset rates across segments is unfair in two ways: a long segment has more time for things to go wrong, and
a run cut into 60 segments has smaller per-segment rates than the same run cut into 5. Both are removed by measuring
resets per unit of time played.

**Assumption 3.3 (constant hazard within a segment).** For a good run playing segment $i$, a run-ending mistake
arrives at a constant rate $\lambda_i$ per millisecond.

**Proposition 3.4.** Under Assumption 3.3, a good run survives segment $i$ (of duration $m_i$) with probability
$e^{-\lambda_i m_i}$, and therefore

```math
\lambda_i = \frac{-\ln\bigl(1 - \rho^{\mathrm{good}}_i\bigr)}{m_i}.
```

*Proof.* A constant hazard gives an exponential survival function $P(\text{survive } t) = e^{-\lambda t}$. Setting
$1 - \rho^{\mathrm{good}}_i = e^{-\lambda_i m_i}$ and solving gives the formula. (The code caps $\rho$ at 0.999 to keep
the logarithm finite.) $\square$

**Proposition 3.5 (invariance to how the route is split).** If a segment of hazard $\lambda$ is divided into two
segments, both have hazard $\lambda$.

*Proof.* The pieces of lengths $t_1, t_2$ have survival $e^{-\lambda t_1}$ and $e^{-\lambda t_2}$, and each piece's
formula returns $\lambda$. The raw reset rate, $1 - e^{-\lambda t}$, would instead fall with $t$. $\square$

**Definition 3.4 (hazard ratio).** The hazard of the rest of the run, seen from segment $i$, pools every other
segment $j \ge 2$, $j \ne i$, that has a hazard:

```math
\Lambda_{-i} = \frac{\sum_{j} \lambda_j m_j}{\sum_j m_j}, \qquad H_i = \frac{\lambda_i}{\Lambda_{-i}} .
```

$H_i = \infty$ when good runs reset in $i$ and nowhere else.

**Proposition 3.6.** $\Lambda_{-i}$ is the expected number of run-ending mistakes per millisecond over the rest of the
run, i.e. the time-weighted average hazard.

*Proof.* $\lambda_j m_j$ is the integrated hazard (expected mistakes, for small hazards) over segment $j$; dividing
the total by the total time gives the average rate per unit of time. $\square$

So $H_i = 1.5$ means good runs die in segment $i$ 1.5 times as fast, per minute, as in the rest of the run, whatever the
category's length or number of segments. The first segment is left out of the comparison because its resets are
mostly bad starts.

**Example (D).** Elevator Land: 13 of 94 good runs reset there ($\rho^{\mathrm{good}} = 13.8\%$), typical time
1:16.57, hazard ratio 4.8. Not At Fault: 0 of 27, ratio 0.

---

## 4. Practice advice

Every segment is checked against four rules. Each produces an **estimated worth** $W$ in milliseconds, and all advice
is sorted by $W$, largest first. For segments without luck marks:

| Advice | Fires when | Worth $W$ |
| --- | --- | --- |
| **Slow in PB** | $p_i > m_i$ | $p_i - q^{-}_i$ |
| **Inconsistent** | $v_i > 0.10$ | $\tfrac12 (q^{+}_i - q^{-}_i)$ |
| **Gold is rare** | $(m_i - g_i)/g_i > 0.08$ | $\min(p_i - g_i,\ m_i - g_i)$ |
| **Runs die here** | $H_i \ge 1.5$, $\lvert G_i\rvert \ge 10$, at least 3 good-run resets | $s_i$ (for ranking only) |

**Proposition 4.1 (Slow in PB).** If segment $i$ of the PB had been replaced by the runner's good-day time, the PB
would have been $p_i - q^-_i$ faster; the rule fires exactly when the PB segment was slower than a typical attempt, so
an ordinary attempt there would already save $p_i - m_i > 0$.

*Proof.* Immediate from the definitions; the worth uses the good-day time so that it is comparable with the realistic
target. $\square$

**Proposition 4.2 (Inconsistent).** For normally distributed times, $\tfrac12$ IQR $= 0.674\sigma$, which is
$0.845$ times the mean absolute deviation $E\lvert T - \mu\rvert = 0.798\sigma$.

*Proof.* Standard normal moments. $\square$

So the worth of "Inconsistent" is close to the average amount a single attempt loses or gains against the typical
time: what making the segment repeatable is worth per attempt. For other distributions this is a heuristic; the
quantity is robust, unlike the standard deviation.

**Gold is rare.** The gold is at least 8% faster than the typical time, so the runner has shown a faster strategy but
does not execute it reliably. The worth is the gap between typical and gold, capped by what the PB could actually give
back.

**Runs die here.** See §3.6. The minimum counts (10 good runs, 3 good-run resets) keep a single unlucky reset from
flagging a segment: with 3 resets in 10 runs the 95% binomial interval for the rate is roughly 7% to 65%, already wide.
The worth is the segment's good-day save, used only to place the advice among the others, because a reset is not a
time save.

**Example (TP).** The top advice is *Gold is rare* on Spinner (gold 6:25.26, typical 7:14.91, worth 47.9 s), then
*Slow in PB* on Master Sword (PB 7:16.18 against typical 6:30.37, worth 47.4 s).

---

## 5. Luck-based segments

Some segments have two outcomes the runner does not control (a boss pattern, a minigame, a cycle). Their times form
two clusters, and the statistics of §3 would read the gap between the clusters as poor execution. A segment the runner
marks as **luck** is analysed within each outcome instead. Times alone cannot prove luck (a trick that fails a third of
the time produces the same picture), so the app only *suggests* marks; nothing changes until the runner ticks one.

### 5.1 Splitting times into two outcomes

Work with log times $x_k = \ln t_k$, sorted, so that the split is about ratios and is scale-free.

**Definition 5.1 (Otsu split).** For a cut after the $k$-th smallest log time, let $\bar x_1, \bar x_2$ be the means of
the lower and upper groups. Among cuts with at least $\max(2, \lceil 0.1N\rceil)$ times on each side (and not between
equal values), choose $k$ maximising

```math
B(k) = k\,(N-k)\,(\bar x_2 - \bar x_1)^2 .
```

The *cut* is $c = t_{(k)}$, the slowest good time; times $t \le c$ are the **good** outcome. At least 10 clean times
are required.

**Proposition 5.1 (Otsu [2]).** Maximising $B(k)$ is the same as minimising the pooled within-group sum of squares
of the log times.

*Proof.* The total sum of squares splits as $\mathrm{SS}_{\text{tot}} = \mathrm{SS}_{\text{within}} + \mathrm{SS}_{\text{between}}$ with $\mathrm{SS}_{\text{between}} = k(\bar x_1 - \bar x)^2 + (N-k)(\bar x_2 - \bar x)^2 = \tfrac{k(N-k)}{N}(\bar x_2 - \bar x_1)^2 = B(k)/N$. $\mathrm{SS}_{\text{tot}}$ does not depend on $k$, so
maximising $B$ minimises $\mathrm{SS}_{\text{within}}$. $\square$

The minimum share of 10% keeps one odd attempt from forming an "outcome".

**Definition 5.2 (separation and cost).** With within-group variances $\sigma_1^2, \sigma_2^2$ of the log times,

```math
D = \frac{\bar x_2 - \bar x_1}{\sqrt{(\sigma_1^2 + \sigma_2^2)/2}}, \qquad \text{cost ratio} = e^{\bar x_2 - \bar x_1}.
```

$D$ is Ashman's D [3]; a mixture of two normal distributions has clearly separated modes when $D > 2$. The cost ratio
is the ratio of the two groups' geometric means: how much slower the bad outcome typically is.

### 5.2 Suggestions

A segment is suggested ("looks like luck") when it has at least 20 clean times and all of the following hold:

1. $D \ge 2$ (two clear groups) and cost ratio $\ge 1.1$ (bad luck costs at least 10%);
2. the good share $\pi = k/N$ is in $[0.2, 0.8]$ (both outcomes common; a rare slow tail looks like mistakes);
3. **no streaks**: the Wald–Wolfowitz runs test on the good/bad sequence in attempt order gives $\lvert z\rvert < 3$;
4. **no drift**: the good share of the newer half of the times differs from the older half's by less than 0.2.

Segments whose name contains the word "RNG" are suggested too.

**Proposition 5.2 (runs test [4]).** If $N_1$ good and $N_2$ bad outcomes ($N = N_1 + N_2$) arrive in random order,
the number of runs $U$ (maximal blocks of equal outcomes) has

```math
E[U] = \frac{2N_1N_2}{N} + 1, \qquad \mathrm{Var}[U] = \frac{2N_1N_2\,(2N_1N_2 - N)}{N^2(N-1)},
```

and $z = (U - E[U])/\sqrt{\mathrm{Var}[U]}$ is approximately standard normal for moderate $N$.

*Why rules 3 and 4.* Luck is independent from attempt to attempt; a change of strategy is not: old attempts are slow,
new ones fast. A strategy change produces few long runs (strongly negative $z$) and a large drift in the good share.
Luck produces neither. $\lvert z\rvert < 3$ tolerates chance at about the 0.3% level.

### 5.3 What a mark changes

For a marked segment with at least 10 clean times, the cut $c$ comes from the whole clean history (more evidence). Let
$R^{g}$, $R^{b}$ be the recent good and bad times (falling back to the whole history for an outcome with fewer than 5
recent times), $\pi$ the recent good share, and $m^g, q^{-,g}$, $m^b, q^{-,b}$ their medians and good-day times.

- **Variability** is the within-outcome variability, weighted by how many recent times each outcome has:
  $v = \sum_o n_o v_o / \sum_o n_o$, over outcomes with at least 5 recent times.
- **PB luck**: the PB had good luck if $p_i \le c$, bad luck otherwise. **Slow in PB** and the **good-day save**
  compare the PB with the median and good-day time *of the outcome the PB had*. Better luck is not a save the runner
  can earn.
- **Gold is rare** compares the gold with $m^g$, the typical good-luck time.
- **Practice gap** (used by the practice plan, §9):

```math
\mathrm{gap} = \pi\,(m^g - q^{-,g}) + (1-\pi)\,(m^b - q^{-,b}).
```

**Proposition 5.3.** The practice gap is the expected gap between a typical and a good-day time *given the outcome*,
averaged over outcomes; the gap between outcomes ($m^b - m^g$) is excluded.

*Proof.* Law of total expectation over the outcome $O$: $E[\mathrm{gap}\mid O]$ is $m^g - q^{-,g}$ with probability
$\pi$ and $m^b - q^{-,b}$ with probability $1-\pi$. $\square$

- **Sum of best at the PB's luck**: where the PB had bad luck, the segment's gold in the efficiency score (§6) is
  replaced by $\max(g_i, b^{\min}_i)$, the best bad-luck time ever. Comparing the PB with a sum of best that assumes
  good luck would mark the PB down for luck it didn't have.
- **Luck the sum of best needs**: with marked segments $L$, the chance a run gets good luck in all of them is
  $\prod_{j \in L} \pi_j$. *(Assumption: outcomes in different segments are independent.)*
- **Goal planner**: a target faster than every bad-luck time ever recorded in that segment is tagged "needs luck".
- **PB odds**: a marked segment still samples its real times, so luck comes up as often as it really does, but it is
  left out of each attempt's form of the day (§7.2), because good luck is not a good day.

---

## 6. Category score

The score rates how well a runner runs a category on a 0 to 100 scale, from that category's file alone. It is built
from four parts, each a ratio of the runner's own times or counts (Theorem 1.5), so a 12 minute and a 2 hour category
sit on the same scale. It does not compare the runner with anyone else.

### 6.1 Efficiency (weight 0.40)

Let $B$ be the sum of best at the PB's luck (§5.3; equal to SoB without marks). The **efficiency gap** is
$\gamma = \max\bigl(0, (\mathrm{PB} - B)/B\bigr)$ and

```math
E = \mathrm{clamp}_{[0,100]}\!\left(100\left(1 - \frac{\gamma}{0.10}\right)\right).
```

A PB equal to the sum of best scores 100; a PB 10% or more above it scores 0. The gap measures how much of the
runner's demonstrated ability (their golds) the PB already captures.

### 6.2 Consistency (weight 0.25)

**Definition 6.1.** Over segments with a variability, $\bar v = \sum_i v_i m_i / \sum_i m_i$ and
$C = \mathrm{clamp}_{[0,100]}\bigl(100(1 - \bar v/0.20)\bigr)$.

**Proposition 6.1.** $\bar v = \sum_i \mathrm{IQR}_i \big/ \sum_i m_i$: the run's total interquartile spread over its
total typical time.

*Proof.* $v_i m_i = \mathrm{IQR}_i$ by Definition 3.1. $\square$

Weighting by typical time therefore makes the measure independent of how the route is divided into splits: two halves
of a segment with the same spreads contribute what the whole would. A variability of 10%, where "Inconsistent" advice
starts, scores 50. (For a luck segment, $v_i$ is the within-outcome variability of §5.3, so luck does not cost
consistency.)

### 6.3 Completion (weight 0.20)

Let $\mu = \lfloor n/2\rfloor + 1$ be the middle segment. Its good runs $G_\mu$ (Definition 3.3) are the attempts that
reached it in the faster half of times at the split before. Completion is the share of them that finished:

```math
\kappa = \frac{\lvert\lbrace a \in G_\mu : a \text{ finished}\rbrace\rvert}{\lvert G_\mu\rvert}, \qquad P = 100\,\kappa .
```

*Why from the middle, and why good runs.* Early resets are mostly bad starts and say little about holding a run
together. Runs reset for being behind pace are a choice (often the right one, §7.9), and short categories do it far
more than long ones; counting them would make completion measure reset habits rather than reliability. Conditioning on
runs that were going well halfway leaves the share that a good run converts into a finish.

### 6.4 Improvement (weight 0.15)

Let $f_1, \dots, f_F$ be the final times of finished attempts in id order (from the attempt history). The window is
$w = \min(10, \lfloor F/2\rfloor)$, used only if $w \ge 4$ (so at least 8 finishes). With $M_{\text{prev}}$ the median
of $f_{F-2w+1..F-w}$ and $M_{\text{rec}}$ the median of $f_{F-w+1..F}$,

```math
\Delta = \frac{M_{\text{prev}} - M_{\text{rec}}}{M_{\text{prev}}}, \qquad
I = \mathrm{clamp}_{[0,100]}\!\left(50 + 50\,\frac{\Delta}{0.03}\right).
```

No change scores 50, 3% faster scores 100, 3% slower scores 0. The window is counted in finishes rather than days, so a
category with a dozen finishes gets a score like one with hundreds.

### 6.5 Combining the parts

Let $K$ be the set of parts that could be computed, $s_k$ their scores and $\omega_k$ their weights. Then

```math
\mathrm{Score} = \mathrm{round}\!\left(\frac{\sum_{k \in K} \omega_k s_k}{\sum_{k \in K} \omega_k}\right).
```

**Proposition 6.2.** The score lies in $[0, 100]$ and is the weighted mean of the available parts with their weights
rescaled to sum to 1, keeping their proportions.

*Proof.* Each $s_k \in [0,100]$ and the normalised weights $\omega_k/\sum_{K}\omega$ are positive and sum to 1, so the
result is a convex combination. $\square$

### 6.6 Provisional scores

A score is **provisional** (shown, but left out of the overall score) when the file has fewer than 8 finished runs,
fewer than 10 clean times in the typical segment (the median over segments of $\lvert C_i\rvert$), fewer than 5
segments, or fewer than 3 computable parts. These are counts of the runner's own data, low enough for a long category
with a few dozen attempts to reach.

### 6.7 Overall score

The overall score is the rounded mean of the runner's 5 best non-provisional category scores. Taking the best five
rewards range without punishing a runner for trying a new category.

### 6.8 WR pace

For a reference time $T_{\mathrm{ref}}$ (typed in, or a comparison named "World Record" or "WR" in the file), WR pace
is $T_{\mathrm{ref}}/\mathrm{PB}$, and also $T_{\mathrm{ref}}/\mathrm{RT}$. A value of 1 means the PB equals the
reference. It is shown beside the score and never enters it.

### 6.9 Worked examples

| | Efficiency | Consistency | Completion | Improvement | Score |
| --- | --- | --- | --- | --- | --- |
| **D** | $\gamma = 2.35\%$, 76.5 | $\bar v = 6.70\%$, 66.5 | 27 of 40 good runs, 67.5 | $\Delta = 1.41\%$, 73.6 | **72** |
| **TP** | $\gamma = 3.51\%$, 64.9 | $\bar v = 5.46\%$, 72.7 | 4 of 7 good runs, 57.1 | $\Delta = 6.55\%$, 100 | **71** |

For **D**: $0.40 \cdot 76.49 + 0.25 \cdot 66.49 + 0.20 \cdot 67.5 + 0.15 \cdot 73.58 = 71.76$, rounded to 72. Of the 116
attempts that reached the middle segment (Tr4p Haus), only 30 finished, but most of the others were reset while behind
pace; among the 40 good runs, 27 finished.

---

## 7. The form model and PB odds

The PB odds simulate 10,000 runs from a model of how the runner plays *right now* and count how often they beat the
PB. The same simulated runs answer "what are my chances from this split?" and "should I reset?". The model lives in
`buildFormModel` and `sampleRun` (`segment-model.ts`); the odds in `pb-odds.ts`.

### 7.1 Samples and typical times

For each segment $i$, the model's samples are its clean times from **finished** attempts if there are at least 5 of
them, and all its clean times otherwise (or the PB segment alone if there are none). Samples keep their attempt ids and
are ordered oldest first, with recency weights $w_k$ (Definition 1.6). The segment's **typical time** $\tau_i$ is the
recency-weighted median of its samples.

*Why finished runs.* The model answers "if I play this run to the end, what time do I get?", which is a question about
finished runs. Times from runs that were later reset are biased slow (pace resets happen to slow runs), and would make
the odds pessimistic. §7.4 shows that conditioning on finishing is exactly what the decomposition of the per-attempt
chance needs.

### 7.2 Form of the day and residuals

**Definition 7.1.** For a sample time $t$ of segment $i$ in attempt $a$, its log ratio is $\ell_{a,i} = \ln(t/\tau_i)$.
An attempt's **form** is the mean log ratio over the non-luck segments in which it has a sample:

```math
F_a = \frac{1}{\lvert J_a\rvert}\sum_{i \in J_a} \ell_{a,i}.
```

Only attempts with samples in at least $\lceil 0.25\, n'\rceil$ segments count ($n'$ the number of non-luck segments),
unless fewer than 5 attempts qualify, in which case every attempt with a sample counts. The forms are ordered by
attempt id and given recency weights.

**Definition 7.2.** A sample's **residual** is what is left once its attempt's form is taken out:
$\varepsilon_{a,i} = \ell_{a,i} - F_a$ (or $\ell_{a,i}$ for a luck segment, or for an attempt without a form).

### 7.3 The model and how a run is simulated

**Definition 7.3 (simulated run).** Draw one form $\Phi$ from the forms by their recency weights and add the trend
$\delta$ (§7.3.2). For each segment independently, draw one residual $E_i$ from that segment's residuals by their
recency weights. The simulated segment times and total are

```math
T_i = \tau_i \exp\bigl(\mathbf 1[i \notin L]\,(\Phi + \delta) + E_i\bigr), \qquad T = \sum_{i=1}^n T_i ,
```

where $L$ is the set of luck segments.

This is a non-parametric bootstrap [5] of the random-effects model

```math
\ln T_{a,i} = \ln \tau_i + F_a + \varepsilon_{a,i}.
```

*Assumption 7.1.* Given the attempt's form, segment residuals are independent of each other. (Dependence *through*
the form, the fact that good days are good across the whole run, is modelled; any other dependence is not.)

Resampling real residuals rather than fitting a normal distribution keeps the true shape of each segment's times,
including the long right tail of a segment that sometimes goes badly.

#### 7.3.1 Why a shared form is necessary

**Proposition 7.2.** Write $\sigma_F^2 = \mathrm{Var}\,\Phi$ and $\sigma_i^2 = \mathrm{Var}\, E_i$, and
suppose deviations are small enough that $e^x \approx 1 + x$. Then

```math
\frac{\mathrm{Var}\, T}{\bigl(\sum_i \tau_i\bigr)^2} \approx \sigma_F^2 + \frac{\sum_i \tau_i^2 \sigma_i^2}{\bigl(\sum_i\tau_i\bigr)^2}.
```

*Proof.* $T \approx \sum_i \tau_i + \Phi\sum_i \tau_i + \sum_i \tau_i E_i$ with $\Phi$ and the $E_i$ independent, so
$\mathrm{Var}\,T \approx (\sum\tau_i)^2\sigma_F^2 + \sum \tau_i^2\sigma_i^2$. $\square$

**Corollary.** For $n$ equal segments with equal residual spread $\sigma$, the relative spread of the total is
$\sqrt{\sigma_F^2 + \sigma^2/n}$. Without a shared form ($\sigma_F = 0$) it shrinks like $1/\sqrt n$, so a 56 segment
run would almost always finish near its typical time and a PB well under it would look nearly impossible. With the
form it stays at least $\sigma_F$. This is why the model before the form model predicted long runs far too tightly
(§7.10).

#### 7.3.2 Improvement trend

**Definition 7.4.** Fit a weighted least-squares line to the forms against attempt id $x_a$, with the recency weights
normalised to sum to 1: slope $\beta = \sum w (x - \bar x)(F - \bar F) / \sum w (x - \bar x)^2$ with weighted means
$\bar x, \bar F$. Let $x^\ast$ be one more than the largest attempt id. The trend is

```math
\delta = \tfrac12 \min\bigl(0,\ \beta\,(x^\ast - \bar x)\bigr),
```

and is applied only when at least 5 attempts have a form.

**Proposition 7.3.** The fitted form at the next attempt is $\hat F(x^\ast) = \bar F + \beta(x^\ast - \bar x)$. Since a
form drawn by the same recency weights has mean $\bar F$, adding $\beta(x^\ast - \bar x)$ would move the simulated
form's mean to the projected one. The model applies half of that, and never a slowdown.

*Proof.* The weighted least-squares line passes through $(\bar x, \bar F)$. $E[\Phi] = \sum w_a F_a = \bar F$. $\square$

Taking half is a shrinkage towards no change: extrapolating a trend is uncertain, and a runner's improvement slows as
they approach their limit. A slowdown is not projected because a bad patch is usually temporary and projecting it
would make the coach recommend giving up.

### 7.4 Odds if you finish and per attempt

With $N = 10{,}000$ simulated totals $T^{(1)},\dots,T^{(N)}$ and a target $\Theta$ (the PB, or a goal):

```math
\hat p_{\text{fin}} = \frac1N \sum_{s=1}^N \mathbf 1\bigl[T^{(s)} < \Theta\bigr], \qquad
\hat p = \hat p_{\text{fin}} \cdot \phi ,
```

where the **finish rate** $\phi$ is the share of the last 50 attempts that finished, reaching further back when
those hold fewer than 5 finished runs until the window holds 5 (or covers every attempt), so a category where most
attempts are reset doesn't read as never finishing (or $\prod_i (1 - \rho_i)$ without an attempt history).

**Proposition 7.4.** $P(\text{PB in one attempt}) = P(\text{finish}) \cdot P(\text{beat } \Theta \mid \text{finish})$.

*Proof.* An attempt can only beat the target if it finishes, so $\lbrace\text{beat}\rbrace \subseteq \lbrace\text{finish}\rbrace$ and the identity is the definition of conditional probability. $\square$

No independence between speed and finishing is assumed: $\phi$ estimates the first factor and the model, built from
finished runs, estimates the second.

**Proposition 7.5 (simulation error).** The Monte Carlo standard error of $\hat p_{\text{fin}}$ is
$\sqrt{p(1-p)/N} \le 0.005$.

*Proof.* $N\hat p_{\text{fin}}$ is binomial; $p(1-p) \le \tfrac14$. $\square$

The random generator is seeded (§14), so a file always gives the same odds.

The **typical finish** is the simulated total of rank $\lfloor N/2\rfloor + 1$ and the **good finish** the one of rank
$\lfloor N/10\rfloor + 1$ (beaten by one run in ten). The chance per attempt is shown as "1 in $1/\hat p$", rounded to
a multiple of 5 from 20 up.

### 7.5 Forecast

**Proposition 7.6.** If attempts are independent with constant chance $p$, the number of attempts needed for the
chance of at least one PB to reach $\alpha$ is

```math
k_\alpha = \left\lceil \frac{\ln(1-\alpha)}{\ln(1-p)} \right\rceil .
```

*Proof.* $P(\text{no PB in } k) = (1-p)^k$, so $1 - (1-p)^k \ge \alpha \iff k \ln(1-p) \le \ln(1-\alpha) \iff k \ge \ln(1-\alpha)/\ln(1-p)$, since $\ln(1-p) < 0$. $\square$

The app reports $k_{0.5}$ and $k_{0.9}$. The **dates** divide them by the runner's grind rate, the attempts started per
day over the 28 days up to their latest attempt (or since their first attempt, if that is more recent), and count
whole days from today.

*Assumption 7.2.* $p$ stays constant. In reality it rises as the runner improves, so the forecast is conservative.

**Example (D).** $\hat p_{\text{fin}} = 9.6\%$, $\phi = 8\%$ (4 of the last 50 attempts finished), $\hat p = 0.77\%$
("1 in 130"). $k_{0.5} = 91$ and $k_{0.9} = 299$ attempts; at 9.4 attempts a day that is about 10 and 32 days.

### 7.6 Mistake rates and survival

Simulated runs are finished runs, so they contain no run-ending mistakes. Mistakes enter separately.

**Definition 7.5.** For segment $i \ge 2$, over the last 50 attempts that reached it, let $\rho_i$ be the reset rate
and $\rho^{\mathrm{good}}_i$ the reset rate among those in the faster half at the split before (Definition 3.3). The
**mistake rate** is

```math
\mu_i = \begin{cases} \min\bigl(\rho_i,\ \rho^{\mathrm{good}}_i\bigr) & \text{if at least 10 of those attempts had a time at the split before,} \\ \rho_i & \text{otherwise (and for } i = 1). \end{cases}
```

The **survival** from split $i$ is $\Sigma_i = \prod_{j > i}(1 - \mu_j)$, with $\Sigma_n = 1$. Before the first split there is no split yet, so write $\Sigma_0 = \prod_{j \ge 1}(1 - \mu_j) = (1 - \mu_1)\Sigma_1$: the same product over every segment, including the first.

*Why the cap at $\rho_i$.* A mistake ends a slow run as easily as a fast one, so the all-runs reset rate already
includes every mistake; it can only be higher than the true mistake rate (it adds pace resets). A good-run rate above
it is noise from few good runs: late in a long category, one reset among five good runs would read as a 20% chance of
dying there.

*Assumption 7.3.* Run-ending mistakes are independent of pace and of each other.

### 7.7 PB chance from a split

**Definition 7.6.** For a run at split $i$ with time $x$ on the clock, let $X^{(s)}_i$ be simulated run $s$'s time at
split $i$, $R^{(s)}_i = T^{(s)} - X^{(s)}_i$ its remaining time, and $b_i = \max(0.3\,\mathrm{sd}_i,\ 10^{-4}\, \mathrm{mean}_i,\ 1)$ a bandwidth from the spread of the $X^{(s)}_i$. With Gaussian kernel weights
$K_s = \exp\bigl(-\tfrac12 ((X^{(s)}_i - x)/b_i)^2\bigr)$,

```math
c_i(x) = \Sigma_i \cdot \frac{\sum_s K_s\,\mathbf 1\bigl[x + R^{(s)}_i < \Theta\bigr]}{\sum_s K_s}.
```

This is the Nadaraya–Watson kernel regression estimate [6] of $P(x + R < \Theta \mid X_i = x)$, multiplied by the
chance of no run-ending mistake in the segments left.

**Proposition 7.7 (being behind says something about today's form).** In the model, $X_i$ and $R_i$ are positively
dependent through the shared form, so conditioning on a slow split time shifts the remaining time slower.

*Argument.* Both $X_i = \sum_{j \le i} T_j$ and $R_i = \sum_{j > i} T_j$ are increasing functions of the
independent variables $\Phi, E_1, \dots, E_n$. Increasing functions of independent variables are positively
associated (Harris–FKG inequality [7]), so $\mathrm{Cov}(X_i, R_i) \ge 0$. More precisely, $R_i$ depends on
$X_i$ only through $\Phi$, because the residuals before and after split $i$ are independent (Assumption 7.1). If the
distribution of $X_i$ given $\Phi$ has a monotone likelihood ratio in $\Phi$ (true, for example, when the residual
distributions are log-concave), the posterior of $\Phi$ given $X_i = x$ is stochastically increasing in $x$ [10],
and so is the distribution of $R_i$. Kernel weighting estimates exactly this conditional distribution from the
simulated runs. Without a shared form, $X_i$ and $R_i$ would be independent and $c_i(x)$ would reduce to
$\Sigma_i \, P(R_i < \Theta - x)$. $\square$

*Numerical note.* The code subtracts the smallest squared distance in the exponent before exponentiating; this
multiplies every $K_s$ by the same constant, which cancels in the ratio, and keeps the weights from underflowing when
$x$ is far outside the simulated range.

"On pace" at split $i$ means $x = S_i$, the PB's own time there.

### 7.8 Average attempt length

$\bar L$ is the mean length (end minus start) of the last 50 attempts with both timestamps, where an attempt longer
than the timer-left-running limit counts only for the time on its splits (§10.1). Without timestamps,

```math
\bar L = \sum_{i=1}^n \Bigl(\prod_{j < i}(1 - \rho_j)\Bigr)\,\tau_i\,\bigl(1 - \tfrac{\rho_i}{2}\bigr).
```

**Proposition 7.8.** If a run reaching segment $i$ resets there with probability $\rho_i$, at a uniformly distributed
moment, the expected attempt length is the formula above.

*Proof.* By linearity, the expected length is the sum over segments of $P(\text{reach } i) \cdot E[\text{time in } i \mid \text{reach } i]$. The first factor is $\prod_{j < i}(1-\rho_j)$. Given that the run reaches $i$, it plays the
whole segment ($\tau_i$) with probability $1 - \rho_i$ and half of it on average with probability $\rho_i$, giving
$\tau_i(1 - \rho_i/2)$. $\square$

### 7.9 The reset rule

**Theorem 7.9 (when to reset).** Let fresh attempts beat the target at a long-run rate of $r_0 = \hat p / \bar L$ per
unit of play. A run at split $i$ with chance $c = c_i(x)$ and expected remaining time $\bar R_i$ should be played on
if and only if

```math
\frac{c}{\bar R_i} \ge r_0 .
```

*Argument.* Attempts are renewal cycles: each starts fresh, and the PBs found are rewards. By the renewal-reward
theorem [8], a policy's long-run rate of PBs per unit of play is $E[\text{PBs per attempt}] / E[\text{attempt length}]$, which for the runner's current play is $\hat p/\bar L = r_0$. At split $i$ there are two choices. Playing
on costs $\bar R_i$ of play and yields a PB with probability $c$, after which play starts fresh. Resetting starts
fresh now; in the same $\bar R_i$ of play, fresh attempts yield $r_0\bar R_i$ PBs in expectation. Everything after
that point is the same under both choices, so playing on is at least as good exactly when $c \ge r_0 \bar R_i$. This
is the marginal value theorem of optimal foraging [9]: leave a patch when its rate falls below the average rate of the
environment. $\square$

Here $\bar R_i$ is the mean remaining time of the simulated runs from split $i$.

*Assumptions and approximations.*

- $r_0$ is measured from the runner's actual play (their real reset habits through $\phi$ and $\bar L$), not from the
  optimal policy. If the runner follows the rule, $r_0$ rises a little and the threshold tightens slightly; the
  fixed point is not iterated.
- $\bar R_i$ comes from finished simulated runs and ignores that a mistake would end the run sooner; this slightly
  overstates the cost of playing on, so the rule leans very slightly towards resetting.
- "Fresh attempts" includes the time of attempts that are themselves reset early, which is what makes the comparison
  fair.

**Reset threshold.** For each split with a PB time $S_i$, the deficit $d$ (time behind PB pace) at which the rule flips
is searched for in $[-0.2\,S_i,\ 0.2\,S_i]$: if playing on still wins at $d = 0.2\,S_i$, the split says **Never**; if
resetting wins even at $d = -0.2\,S_i$ (20% *ahead*), it says **Always**; otherwise bisection (40 steps or to 1 ms)
finds the largest $d$ at which playing on still wins. *(Assumption: $c_i(S_i + d)$ decreases in $d$, which
Proposition 7.7 makes true of the model up to sampling noise.)* The threshold is shown in time and as the share
$d/S_i$, which reads the same at any run length.

**PB hunting and Practising.** In Practising mode, for runners who play every run out, the coach shows only $c_i(x)$
and no verdicts.

**Example (D).** At Try Not Falling? (PB split 10:28.4) the rule says reset when more than 6.9 s behind (1.1% of the
split time); at Not At Fault, 56.6 s (3.1%). On **TP**, the early splits tolerate only a few seconds behind, the middle of the run about 1 to 1.8
minutes (1% to 2% of the split time), while Arbiter's Grounds and Coral Earring need the run to be about 9 s and 6 s *ahead*: the PB
lost time from Master Sword to Arbiter's Grounds and won it back later, so being merely on pace there is worse than it
looks.

### 7.10 Calibration

To check the model, the project rebuilt it before each of a file's recent finishes from the history up to that point
and computed the *probability integral transform* $u_j = \hat P(T < y_j)$, where $y_j$ is the real finish time. For a
calibrated model the $u_j$ are uniform on $[0,1]$, so their mean is $\tfrac12$. The form model gave a mean of 48% on
**D** (15 finishes) and 54% on **TP** (5 finishes); the previous independent-segment model gave 21% and 0% (its
predictions for long runs were far too tight, as Proposition 7.2 explains, and it did not follow improvement).
Marking the suggested luck segments in the reference files moved this figure by at most 4 points on every file with 7
or more finishes to check.

### 7.11 Goal odds

The goal planner's odds reuse the same simulated totals with $\Theta$ set to the goal: $\hat p_{\text{fin}}(\Theta)$
and $\hat p_{\text{fin}}(\Theta)\,\phi$.

---

## 8. Goal planner

Given a goal time $G$ (such as "sub 40:00"), the planner finds the least demanding set of segment times that beats it,
starting from the PB.

### 8.1 Plan at one shared pace

Let $R_i$ be segment $i$'s recent clean times and $\mathcal P$ the *plannable* segments, those with
$\lvert R_i\rvert \ge 5$. Write $\tilde Q_i(q)$ for the unrounded quantile of $R_i$ (Definition 1.4) and
$\tilde F_i$ for its inverse, the interpolated empirical distribution function. For a **pace** $q \in [0,1]$ define the
segment targets and their total

```math
t_i(q) = \begin{cases} \min\bigl(p_i,\ \tilde Q_i(q)\bigr) & i \in \mathcal P \\ p_i & i \notin \mathcal P \end{cases},
\qquad \mathcal T(q) = \sum_i t_i(q).
```

"Sub $G$" means strictly under $G$ as LiveSplit displays it, so the plan aims at the limit $\Lambda = G - 10$ ms.

- If $\mathrm{PB} \le \Lambda$: the goal is already beaten.
- If $\mathcal T(0) \le \Lambda$: **reachable**. The pace is $q^\ast = \sup\lbrace q : \mathcal T(q) \le \Lambda\rbrace$,
  found by 40 steps of bisection, and the targets are $\lfloor t_i(q^\ast)\rfloor$.

**Lemma 8.1.** $\mathcal T$ is continuous and non-decreasing in $q$.

*Proof.* Each $\tilde Q_i$ is continuous and non-decreasing (Lemma 1.2); so is the minimum with a constant and a sum
of such functions. $\square$

Hence bisection converges to $q^\ast$, and $\mathcal T(q^\ast) = \Lambda$ unless even $q = 1$ fits. Rounding every
target down keeps the planned total at or under $\Lambda$.

**Theorem 8.2 (the shared pace is the fairest plan).** Call a segment *cut* by a plan $t$ if $t_i < p_i$, and its
*required pace* $\tilde F_i(t_i)$, the share of recent attempts at least that fast. Suppose the recent times in each
plannable segment are distinct, so each $\tilde Q_i$ is strictly increasing. Then no plan with $t_i \le p_i$,
$t_i = p_i$ outside $\mathcal P$, and $\sum_i t_i \le \Lambda$ has every cut segment at a required pace greater than
$q^\ast$. In other words, the shared-pace plan maximises the required pace of its hardest segment.

*Proof.* Suppose such a plan $t'$ exists with every cut segment at a pace above $q^\ast$, and assume $q^\ast < 1$ so
that $\mathcal T(q^\ast) = \Lambda$. For a cut segment, $t'_i = \tilde Q_i(\tilde F_i(t'_i)) > \tilde Q_i(q^\ast) \ge t_i(q^\ast)$ by strict monotonicity. For an uncut segment, $t'_i = p_i \ge t_i(q^\ast)$. At least one segment is cut
(otherwise $\sum t' = \mathrm{PB} > \Lambda$), so $\sum_i t'_i > \mathcal T(q^\ast) = \Lambda$, a contradiction.
$\square$

*Why pace rather than seconds.* The runner's own spread is the difficulty of each segment: taking a second off a
segment played within a second of its best every time is much harder than taking it off one that swings by ten. A
plan in equal seconds or equal percentages would ignore that; a plan in equal *pace* asks every segment for a time the
runner hits equally often.

**Reading the pace.** The pace $q^\ast$ is shown as "a time you hit in 1 of every $1/q^\ast$ recent attempts". The
realistic target is the same construction at the fixed pace $\tfrac14$ (good-day times). When $q^\ast < \tfrac14$,
the app says the runner would need to hit those times about $\tfrac14 / q^\ast$ times as often to make the goal a
good-day goal. Each segment also shows its hit rate (the share of recent times at or under its target) and whether
the target is at or slower than its typical time ("consistency") or faster ("faster").

### 8.2 Beyond recent bests

If even $\mathcal T(0)$, every plannable segment at its recent best, exceeds $\Lambda$, the plan moves each plannable
segment from its recent best $\beta_i = t_i(0)$ towards its gold $\gamma_i = \min(g_i, \beta_i)$ by one shared
fraction $f$:

```math
t_i(f) = \beta_i - f\,(\beta_i - \gamma_i),
```

with $f$ the smallest fraction whose total fits, again found by bisection (the total is continuous and decreasing in
$f$). The status is **needs golds**. If $\sum_i \gamma_i > \Lambda$, the goal is **out of reach** and the shortfall
$\sum_i\gamma_i - \Lambda$ is reported. The same argument as Theorem 8.2 shows that one shared fraction minimises the
largest fraction any single segment must cover.

Segments marked as luck get a **needs luck** tag when their target is under the best time ever played there with bad
luck (§5.3).

### 8.3 Suggested goal

**Definition 8.1.** The step $\sigma$ is the largest of 1 s, 5 s, 10 s, 15 s, 30 s, 1 min, 5 min, 10 min, 15 min,
30 min that is at most 1% of the PB (1 s if none is). The suggested goal is
$\lfloor (\mathrm{PB} - 1)/\sigma\rfloor\,\sigma$.

**Proposition 8.3.** The suggested goal is the largest multiple of $\sigma$ strictly below the PB, so it asks for at
most $\sigma$, and $\sigma \le \max(1\%\cdot\mathrm{PB},\ 1\ \mathrm{s})$.

*Proof.* $\lfloor(\mathrm{PB}-1)/\sigma\rfloor\sigma \le \mathrm{PB} - 1 < \mathrm{PB}$, and the next multiple is
$\ge \mathrm{PB}$. $\square$

**Example.** **D**: 1% of 40:01.517 is 24.0 s, so $\sigma = 15$ s and the goal is 40:00. The plan is reachable at
pace $q^\ast = 0.47$ (about 1 in 2 recent attempts). **TP**: 1% of 5:42:54.89 is 3:25.7, so $\sigma = 1$ min, the goal
is 5:42:00, and the pace is 0.76.

### 8.4 A PB with a skipped split

A skipped stretch $K$ (§2) has no $p_i$ for its segments, only the stretch's PB time $P_K$, so the plan treats it as one
piece, the same way the realistic target does. At pace $q$ the piece's time is

```math
t_K(q) = \begin{cases} \min\bigl(P_K,\ \sum_{i \in K} \tilde Q_i(q)\bigr) & K \subseteq \mathcal P \\ P_K & \text{otherwise} \end{cases},
```

and $\mathcal T(q)$ sums the pieces: $t_i(q)$ for every segment outside a stretch and $t_K(q)$ for every stretch. Beyond
recent bests the piece's recent best is $\beta_K = t_K(0)$, its gold $\gamma_K = \min\bigl(\beta_K, \sum_{i \in K}\gamma_i\bigr)$
when $K \subseteq \mathcal P$ (otherwise $\gamma_K = \beta_K$), and $t_K(f) = \beta_K - f\,(\beta_K - \gamma_K)$. Each
piece is still continuous and monotone, so Lemma 8.1 and both bisections carry over, and Theorem 8.2 holds with pieces
in place of segments.

Within a stretch, the piece's time is shared out among its segments in proportion to their own values at the plan's
pace ($\tilde Q_i(q)$, or $\beta_i - f\,(\beta_i - \gamma_i)$), and each segment's cut is its share of $P_K - t_K$ in
the same proportion. When a stretch can't be planned, or the PB already beats the goal, its PB time is shared out by
typical time (then gold, then evenly) in whole milliseconds, so the plan's splits still add up to the PB.

**Proposition 8.4 (a skipped split never makes a goal look easier).** For the same recent times, the pace $q^\ast$
with a skipped stretch is at most what it would be had the PB split there.

*Proof.* For any hidden $p_i$ adding up to $P_K$, $\min\bigl(P_K, \sum_{i \in K}\tilde Q_i(q)\bigr) \ge \sum_{i \in K}\min\bigl(p_i, \tilde Q_i(q)\bigr)$, since a minimum of sums is at least the sum of minimums (and $P_K \ge \sum_{i \in K} \min(p_i, \cdot)$ when $K \not\subseteq \mathcal P$). So $\mathcal T(q)$ with the stretch is at least the per-segment total at every $q$, the set of paces that fit $\Lambda$ is no larger, and its supremum is no larger. $\square$

The plan can't give the runner credit for a fast part of the stretch it has no split for, the mirror image of
Corollary 2.1, where the realistic target is never more ambitious.

**Example (skipped splits).** The Ocarina of Time 100% Glitchless file of §2 has two skipped stretches. Its suggested
goal is 5:41:00 ($\sigma = 1$ min), reachable at pace $q^\ast = 0.94$; a goal 2% under the PB (5:34:33.45) needs
$q^\ast = 0.09$, about 1 in 11 recent attempts.

---

## 9. Practice plan

The practice plan ranks segments by how much an hour of practice is expected to take off a typical run, then turns the
ranking into a session.

### 9.1 How much a segment can still give

The **gap** of segment $i$ is $\mathrm{gap}_i = m_i - q^-_i$, the typical time minus the good-day time (for a luck
segment, the execution gap of Proposition 5.3). It is the most practice is expected to take off a *typical* run:
practice moves the typical attempt towards the good attempts the runner already produces, not towards the gold.
Segments with fewer than 5 recent clean times are left out.

### 9.2 Learning curve

*Assumption 9.1 (log-linear learning).* A segment's typical time after $k$ reps follows $y(k) = a - \beta\log_2 k$:
each doubling of reps takes the same amount $\beta$ off. (This is the classic log-linear learning curve of practice
[11]; a power law $y = a k^{-b}$ behaves the same way locally.)

**Definition 9.1 (measured learning rate).** With $n \ge 10$ clean times in attempt order, split them into
$B = \min(8, \lfloor n/2\rfloor)$ consecutive groups. For group $b$, let $x_b$ be the mean of $\log_2(\text{rep number})$ over its times and $y_b$ their median. The measured rate is
$\hat\beta = \max(0, -\text{slope})$ of the ordinary least-squares line of $y$ on $x$. Medians of groups rather than
single times keep a few disasters from tilting the line; getting slower counts as no learning.

**Definition 9.2 (rate used).** Blend the measured rate with a prior of 2% of the typical time per doubling:

```math
\beta = \frac{n}{n + 30}\,\hat\beta + \frac{30}{n + 30}\,(0.02\,m_i),
```

(with weight 0 on $\hat\beta$ when it can't be measured).

**Proposition 9.2.** This is the posterior mean of $\beta$ in a normal model where the prior is worth 30 observations.

*Argument.* In a conjugate normal model the posterior mean is the precision-weighted average of the prior mean and the
data mean; if the prior's precision equals that of $n_0$ observations, the weights are $n/(n+n_0)$ and $n_0/(n+n_0)$.
$\square$

The runner's own curve counts as much as the assumption at 30 clean times, and dominates soon after.

### 9.3 Expected save

**Proposition 9.3.** Under Assumption 9.1, $k$ more reps after $n$ reps so far save

```math
\mathrm{save}_i(k) = \min\Bigl(\mathrm{gap}_i,\ \beta\,\log_2\frac{n+k}{n}\Bigr),
```

and $\mathrm{save}_i$ is non-decreasing and concave in $k$.

*Proof.* $y(n) - y(n+k) = \beta(\log_2(n+k) - \log_2 n)$, capped at the gap. $\log_2((n+k)/n)$ is increasing and
concave in $k$, and the minimum of a concave function and a constant is concave. $\square$

Concavity is the diminishing return of practice: a segment played 500 times gains less from an hour than one played
50 times. A rep takes the typical time plus 20 s to reload a save or get back into position, so an hour is
$3{,}600{,}000 / (m_i + 20{,}000)$ reps, and **per hour** is $\mathrm{save}_i$ of that many reps.

### 9.4 Building the session

For a session of $S$ minutes (30, 60, 90 or 120):

1. **In context.** $\lfloor 0.75 S/5\rfloor$ five-minute blocks go to single segments and the rest (about a quarter)
   to playing in context. If one typical run (the median of the recent finished runs) fits in that time, it is full
   runs. Otherwise it is a **stretch** of the route: start from the segment with the best save per hour and repeatedly
   add whichever neighbour gains more per hour, while the stretch's typical times plus one rep overhead fit. If not even
   two segments fit, the whole session is single-segment practice.
2. **Blocks.** Blocks are handed out one at a time, each to the segment whose next block saves the most per minute,
   $(\mathrm{save}_i(k + \Delta k) - \mathrm{save}_i(k)) / \text{block length}$. A segment whose rep takes longer than
   5 minutes gets blocks of the smallest multiple of 5 minutes that holds a whole rep.
3. **Leftovers.** Minutes too short for any block go to the in-context play if there is any, or are shown as spare.

The plan's expected save is $\sum_i \mathrm{save}_i(k_i)$ for the reps $k_i$ given to each segment.

**Proposition 9.4 (greedy allocation).** When every block has the same length, giving each block to the segment with
the largest marginal save maximises the total expected save over all ways to share the blocks.

*Proof.* The objective $\sum_i \mathrm{save}_i(k_i)$ is separable and each term is concave (Proposition 9.3), so the
marginal gains of each segment form a non-increasing sequence. The greedy rule takes the largest available marginal
gain each time; an exchange argument shows that any allocation that differs can be improved by moving a block from a
segment whose last gain is smaller to one whose next gain is larger, which is what greedy did. This is the classical
result for separable concave resource allocation [12]. $\square$

With unequal block lengths (segments longer than 5 minutes), ranking by gain per minute is a heuristic, close to
optimal when the blocks are small compared with the session.

*Assumptions.* The 2% prior and 20 s overhead are first guesses, to be tuned against real files. Practice is assumed
to transfer fully to runs.

**Example (D, 60 minutes).** 45 minutes of blocks and 15 minutes in context. A typical run (over 40 minutes) does not
fit, so the context time is one stretch from Gross, Rats to Tr4p Haus (14:27 with the overhead). The blocks go 30
minutes to Men of the Faith and 15 to Tr4p Haus, for an expected 5.4 s off a typical run. **TP**: 35 minutes on
Ganondorf, 10 on BOSS: Zant, and 15 minutes from Hyrule Castle to Ganondorf in one go, for an expected 15.4 s.

---

## 10. Session insights

### 10.1 Sessions and timers left running

**Definition 10.1 (timer-left-running limit).** $\ell^{\max} = 3 \times$ the median finished time (or the PB, or
12 hours with neither). An attempt whose end minus start exceeds $\ell^{\max}$ counts as played only for its final time,
or the sum of its segment times if it did not finish.

**Definition 10.2 (sessions).** Sort attempts with a start time by start. A new session begins when an attempt starts
more than 30 minutes after the current session's latest end (end = start + played length).

The limit follows the category: a timer left open overnight would otherwise join two days into one session, but a
6 hour run must not be mistaken for one. 30 minutes is a human break, not a category length (§1.5).

### 10.2 Pace

**Definition 10.3 (usual time).** For a segment with at least 5 clean times $c$, each clean time's *usual time* $u$ is
the median of a window of $W = \min(51, r(c)+1)$ consecutive clean times centred on it (shifted to fit at the ends).

A rolling median follows the runner's improvement, so months of getting faster are not mistaken for a session effect.

**Definition 10.4 (plays and pace).** Every clean segment time of a timed attempt is a *play*: its time $t$ (capped at
$2u$, so a pause does not swamp the rest), its usual time $u$, and its *minutes in*: the attempt's start minutes into
the session plus the time on its earlier segments. The **pace** of a set of plays is

```math
\mathrm{pace} = \frac{\sum t}{\sum u} - 1 .
```

**Proposition 10.1.** $\mathrm{pace} = \sum_k \frac{u_k}{\sum u}\bigl(\frac{t_k}{u_k} - 1\bigr)$: the mean
relative slowdown, weighted by usual time.

*Proof.* Expand the right-hand side: $\sum_k (t_k - u_k)/\sum u$. $\square$

So a long segment counts for more than a short one, in proportion to its share of the time played, and +2% means 2%
slower than usual.

### 10.3 Comparing a split only with itself

**Definition 10.5.** Within one session, take the segments played at least twice. Each play's time is re-centred on
that segment's own average in the session: $t' = u + (t - \bar t_{\text{seg}})$.

**Proposition 10.2.** After re-centring, (a) each segment's plays in the session have pace 0, and (b) a play's
deviation $t' - u = t - \bar t_{\text{seg}}$ depends only on how it compares with the same segment in the same session.

*Proof.* (a) $\sum (t' - u) = \sum (t - \bar t_{\text{seg}}) = 0$ over the segment's plays. (b) Immediate. $\square$

*Why.* In a long category with one run per session, the first splits are always played first, so "early in the
session" would otherwise mean "early in the route", and resets would pile easy early splits into the start of
sessions. Proposition 10.2 removes route order and segment difficulty from every minutes-in comparison (warm-up, peak
window, fatigue): only a split against itself, earlier or later in the same session, counts. Those findings therefore
need sessions in which segments are replayed.

### 10.4 Statistical method

**Sessions are the unit.** Attempts within a session share fatigue, mood and setup, so they are not independent;
treating them as independent would overstate the evidence (pseudo-replication). Every finding except tilt computes one
value per session and treats sessions as independent.

**Intervals.** For values $y_1..y_k$, the interval is $\bar y \pm t_{k-1}\, s/\sqrt k$ (Student). For two groups,
Welch's interval with the Welch–Satterthwaite degrees of freedom [13]:

```math
\mathrm{se}^2 = \frac{s_a^2}{n_a} + \frac{s_b^2}{n_b}, \qquad
\nu = \frac{\mathrm{se}^4}{\frac{(s_a^2/n_a)^2}{n_a - 1} + \frac{(s_b^2/n_b)^2}{n_b - 1}} .
```

For two proportions, the Wald interval $\hat p_a - \hat p_b \pm z\sqrt{\hat p_a(1-\hat p_a)/n_a + \hat p_b(1-\hat p_b)/n_b}$. The $t$ quantiles use closed-form approximations, $t_{0.975,\nu} \approx 1.96 + 2.5/\nu + 3/\nu^2$ and
$t_{0.995,\nu} \approx 2.576 + 5/\nu + 10/\nu^2$, which are within about 0.015 of the exact values from $\nu = 7$
on (for example 2.378 against 2.365 at $\nu = 7$, and 3.176 against 3.169 at 99%, $\nu = 10$).

**Definition 10.6 (clear effect).** An effect is stated only when its interval excludes zero **and** its size is at
least 0.5% of pace (or 5 points of reset rate) **and** at least 8 sessions (or 15 events, for tilt) back it. When a
finding picks the best of several windows, thresholds, times or days, it uses a 99% interval instead of 95%, a
Bonferroni-style guard: the chance that one of $k$ null comparisons crosses a 99% interval is at most $k$ times 1%.

Otherwise the app says there is no clear effect (enough data, nothing beyond noise) or not enough data (and what is
missing). An insights page needs attempt dates and at least 8 sessions.

### 10.5 The findings

Let the **reach** be the 90th percentile of session lengths. Minute buckets are 0, 20, 40, 60, 90 minutes and 2, 3, 4,
5, 6, 8, 10 hours; candidate fatigue points are 30, 45, 60, 90 minutes and 2, 2.5, 3, 4, 5, 6, 8 hours. Only buckets and
points that start before the reach are used, so 45 minute sessions and 6 hour sessions both get questions that fit
them.

- **Warm-up.** Per session (re-centred plays, at least 3 on each side): pace of plays within 20 minutes of the
  session's first split minus pace of the rest. Mean over sessions with a 95% interval.
- **Peak window.** Per session with at least 6 re-centred plays in at least two buckets: each bucket's pace minus the
  session's pace. A bucket is shown when 8 sessions have plays in it (95% interval). The fastest bucket grows into
  neighbours that are also faster than average, and the merged window is tested at 99%; it is a finding only if
  clearly negative.
- **Fatigue.** For each candidate point: per session, the change in reset rate (sessions with at least 3 attempts on
  each side, by attempt start) and in pace (at least 3 re-centred plays on each side), after minus before, each over at
  least 8 sessions at 99%. The point with the largest clear worsening of reset rate is reported, or else of pace.
- **Tilt.** A *late reset* is an attempt reset at or after segment $\lceil 2n/3\rceil + 1$ (the last third of the
  route; needs $n \ge 3$). A *near-PB* is a finish no faster than, and within 2% of, the PB standing at the time (the
  best earlier finish). The next attempt in the same session after such an event is compared with every other next
  attempt: how often it resets early (in the first $\max(1, \lfloor n/3\rfloor)$ segments), by a 95% Wald interval, and
  its pace (Definition 10.4, not re-centred), by a 95% Welch interval. Both groups need at least 15. Here attempts are
  the unit, because the question is about one attempt following another.
- **Time of day** (night 0–6, morning 6–12, afternoon 12–18, evening 18–24, by the session's local start) and **day of
  week.** One pace per session over all its plays. Each group with at least 8 sessions (and at least 8 outside it) is
  compared with the rest by a 99% Welch interval; at least two groups must be testable. The clear difference with the
  largest size is reported. The charts show each group's mean pace against the average session (95% interval).

---

## 11. Year in runs

The recap summarises one calendar year across several split files (one per game and category; with two, the newer
wins).

- **Year of an attempt**: the local calendar year of its start (LiveSplit saves UTC; the recap converts to the
  computer's time zone). Attempts without a start time are in no year and are counted as undated.
- **Attempts, finished runs, attempts per month, days played, longest streak**: counts over the year's attempts. The
  streak is the longest run of consecutive calendar days with at least one attempt.
- **Hours played**: $\sum$ of each attempt's played length (Definition 10.1).
- **Personal bests**: walking a category's finished attempts in id order, an attempt in the year is a PB if it is
  faster than every earlier finish. The category's improvement is $(B_{\text{start}} - B_{\text{end}})/B_{\text{start}}$
  with $B$ the best finish before and at the end of the year; a first-ever finish ranks after any real improvement.
- **Golds**: a clean time in the year faster than every earlier clean time of that segment, once the segment has at
  least 5 earlier clean times (so the first few attempts at a new category don't all count). The **best gold** has the
  largest $(\text{old best} - \text{new})/\text{old best}$.
- **Most improved**: for each segment with clean times in the year, let $w = \min(10, \lfloor c/2\rfloor)$ for its
  $c$ clean times in the year, required to be at least 5. The improvement is $(M_{\text{early}} - M_{\text{late}}) / M_{\text{early}}$ with the medians of its first and last $w$ times; the segment with the largest positive value wins.

**Proposition 11.1.** Each highlight (biggest PB, best gold, most improved) is unchanged when one category's times are
all scaled by $c > 0$.

*Proof.* Each is a difference of two times of the same category divided by one of them. $\square$

This is why the highlights compare shares: measured in seconds, a 6 hour category's long segments would win every
time over a 10 minute category's short ones.

---

## 12. LiveSplit comparisons

"Race these in LiveSplit" writes up to three comparisons into a copy of the split file, as cumulative split times.

- **Realistic target**: segment times $\min(p_i, q^-_i) = p_i - s_i$, accumulated. A skipped stretch's target
  $T_K = P_K - s_K$ is shared out among its segments in proportion to their good-day times $q^-_i$ (their golds when a
  good-day time is missing, equal shares when a gold is missing too), each share rounded to the millisecond and the
  last segment taking the remainder, so the stretch's shares add up to exactly $T_K$.
- **Recent golds**: segment times $\min R_i$, the best recent clean time, accumulated. A split after a segment with no
  recent times is left empty, and so is every split after it.
- **Sub $G$ (balanced)**: the goal plan's targets (§8), accumulated.

**Proposition 12.1.** The last split of the realistic target comparison equals the realistic target.

*Proof.* $\sum_i (p_i - s_i) = \mathrm{PB} - \sum_i s_i = \mathrm{RT}$ when the PB has every split. A skipped stretch
contributes $T_K = P_K - s_K$ instead, and $\sum_{i \notin \cup K} p_i + \sum_K P_K = \mathrm{PB}$, so the last split is
still $\mathrm{RT}$. $\square$

The split at a skipped PB split is an estimate (the PB has no time there to compare with), but every split at the end
of a stretch is exact.

Unlike the sum of best, the recent golds comparison drops golds set long ago and never matched since: it is the best
run the runner has *recently* shown each piece of. The realistic target and recent golds are written for both real and
game time when the file has both. Existing comparisons with the same names are replaced, and nothing else in the file
changes.

---

## 13. Live stats

Live stats compares a run in progress with the runner's own history. Let $u_i$ be the usual time of segment $i$ (the
typical time $m_i$, or the PB segment when there are too few times), $g_i$ the gold, and let the run be at split $j$
with split times $x_1, \dots, x_j$ and $\theta$ on the timer.

### 13.1 Split comparisons

- **vs PB**: $x_j - S_j$ (negative is ahead). While segment $j+1$ is being played it shows
  $\theta - S_{j+1}$ instead, ticking with the timer: the delta the run would have if it split now.
- **vs goal**: $x_j - C_j$ (negative is ahead), where $C_j$ is the comparison's cumulative split. Until the runner
  sets a goal, $C_j = \sum_{i \le j} \min(p_i, q^{-}_i)$, the realistic target's splits (§2, §12; a skipped PB split's
  stretch is shared out as in §12). With a goal $G$,
  $C_j$ is the goal plan's cumulative target (§8), the same splits as the **Sub $G$ (balanced)** comparison. A goal
  that is out of reach has no plan, so there is no comparison. Both are sums of the runner's own segment times, so
  the difference scales with the run like vs PB does. It ticks the same way, with $C_{j+1}$ in place of
  $S_{j+1}$.
- **Last segment**: $d_j = x_j - x_{j-1}$, shown as $d_j - u_j$ and as the share $(d_j - u_j)/u_j$, so a 2 second loss
  in a 30 second segment and a 2 minute loss in a 1 hour segment read the same. It is a **gold** when $d_j < g_j$.
- **Golds this run**: the number of segments with $d_i < g_i$.
- **Up next**: segment $j+2$ (the one after the segment being played; segment 1 before the run starts) with $u_{j+2}$,
  $g_{j+2}$ and its good-run reset rate (§3.5), or the plain reset rate when the good-run rate is undefined (always
  for segment 1). Nothing is shown during the last segment or after the run ends.

### 13.2 PB chance and advice

The PB chance is $\hat p_{\text{fin}}\,\Sigma_0$ before the first split and $c_j(x_j)$ (Definition 7.6) at split $j$. $\Sigma_0$ counts a run-ending mistake in the first segment as well as every later one. $\Sigma_1$ is the chance only once that split has already been hit, so using it here would leave out the segment being played.
The arrow compares it with the chance one split earlier.
While segment $j+1$ is being played with $e = \theta - x_j$ spent in it, the chance comes from the simulated runs
near $x_j$ at split $j$ (the same kernel weights $w_s$ as Definition 7.6) whose next segment took longer than $e$,
since only they still look like this run:

```math
c_j(x_j; e) = \Sigma_j \cdot \frac{\sum_{s:\, d_s > e} w_s\, [x_j + R_s < \mathrm{PB}]}{\sum_{s:\, d_s > e} w_s},
```

where $d_s$ is run $s$'s time for segment $j+1$ and $R_s$ its time from split $j$ to the end. At $e = 0$ it is
$c_j(x_j)$, it falls as the segment runs long, and it is 0 once no simulated run took that long or $\theta$ passes the
PB. The chance shown is the smaller of this and $c_j(x_j)$, with the arrow from $c_j(x_j)$.
Before the first split there is no split $j$. The same weighted count uses $\Sigma_0$, a time of 0 and an equal weight on every simulated run, and $d_s$ is segment 1's time. At the instant the timer starts, that is $\hat p_{\text{fin}}\,\Sigma_0$.

When a split was skipped, the segment being played is not segment $j+1$, so the formula above does not apply. Instead
it uses $c_k(\theta)$ (Definition 7.6), the chance of beating the PB if the current segment $k$ were split now. If that
segment is the last one, it keeps the split-time chance $c_j(x_j)$ rather than a live one. Without a skipped split, the
last segment gets the live chance like any other.
During a segment **Keep going?** shows reset as soon as Theorem 7.9 says reset at split $j+1$ with time $\theta$.
At the end it is 1 if the final time beat the PB (and every
PB already set this session) and 0 otherwise. **Keep going?** applies Theorem 7.9 at the last split, from the first
split until the second to last.

### 13.3 Projections

With $\bar u_{\ge k} = \sum_{i \ge k} u_i$:

```math
\text{Likely finish} = \begin{cases} \theta + \bar u_{\ge j+2} & \text{if } \theta > x_j + u_{j+1} \text{ (the current segment is already over its usual time)}, \\ x_j + \bar u_{\ge j+1} & \text{otherwise.}\end{cases}
```

**Best possible** is the same with golds in place of usual times. The first case keeps the projection from ever
falling below the time already on the timer.

### 13.4 Session tracking

An attempt is counted when the timer goes from idle to running, or when it goes back in time while running without
the split index increasing (a reset and restart between two reads; undoing a split keeps the time). A finish is a PB
when its final time beats both the file's PB and every earlier finish this session, since the file's PB is out of date
after a new one.

### 13.5 Demo replay

The demo replays recent attempts that reached the first split, in random order. An attempt that was reset is shown
resetting $\max(1\ \mathrm{s},\ u_{k}/2)$ into the segment $k$ it died in (half the usual time, by the reasoning of
Proposition 7.8). When the usual time $u_k$ for the dying segment is missing, it falls back to that segment's gold time, or to a flat 2 seconds if the gold is also missing. Replay speed is set as the time a whole run takes on screen (real time, 2 minutes or 30 seconds), so
a 6 hour category demos as fast as a 10 minute one. The speed is never slower than real time: when the PB is shorter than the chosen time on screen (under 2 minutes, or under 30 seconds), the demo plays at real time instead.

---

## 14. Numerical details

- **Random numbers.** Simulations use mulberry32, a 32-bit generator with a fixed seed (20261009), so the same file
  always gives the same odds.
- **Weighted picks.** A sample is picked by inverse transform sampling: with cumulative normalised weights
  $W_0 < W_1 < \dots < W_{m-1} = 1$ and a uniform $U$, pick the first $k$ with $W_k \ge U$ (binary search). Then
  $P(\text{pick } k) = W_k - W_{k-1} = w_k / \sum w$.
- **Time display.** Times are cut (not rounded) to the shown precision, as LiveSplit does, so 39:59.995 still reads
  under 40 minutes. This is why **D**'s PB of 2,401,517 ms reads 40:01.51.
- **Time parsing.** LiveSplit's `[d.]hh:mm:ss.fffffff` is read to the nearest millisecond.
- **Thin data.** Where a quantity needs more data than a segment has (fewer than 5 clean times for form statistics,
  10 for luck outcomes, 20 for luck suggestions), it is left out rather than guessed, and the app says so.

---

## Appendix A: Settings

Every constant, where it lives, and what kind of quantity it is. *Ratio* and *count* settings are scale-free
(Theorem 1.5); *human* settings are deliberate human-time choices.

| Setting | Value | Kind | Source |
| --- | --- | --- | --- |
| Minimum clean times for form stats | 5 | count | `ANALYSIS_DEFAULTS.minSamples` |
| Mis-split floor | 0.6 × median | ratio | `ANALYSIS_DEFAULTS.outlierFloor` |
| Good-day percentile | 25th | ratio | `ANALYSIS_DEFAULTS.goodDayPercentile` |
| Segment model window (reset and mistake rates) | last 50 | count | `ANALYSIS_DEFAULTS.recentWindow` |
| Half-life | n/4, clamped 5 to 25 | count | `RECENCY_SETTINGS` |
| Inconsistent | variability > 10% | ratio | `ADVICE_THRESHOLDS.inconsistent` |
| Gold is rare | typical > 1.08 × gold | ratio | `ADVICE_THRESHOLDS.goldGap` |
| Runs die here | hazard ratio ≥ 1.5, ≥ 10 good runs, ≥ 3 resets | ratio, counts | `ADVICE_THRESHOLDS` |
| Luck outcomes | ≥ 10 times, ≥ 10% per outcome | count, ratio | `LUCK_SETTINGS` |
| Luck suggestions | ≥ 20 times, D ≥ 2, cost ≥ 1.1, good share 0.2–0.8, z < 3, drift < 0.2 | counts, ratios | `LUCK_SETTINGS` |
| Score weights | 0.40 / 0.25 / 0.20 / 0.15 | ratio | `SCORE_SETTINGS.weights` |
| Efficiency zero | 10% gap | ratio | `SCORE_SETTINGS.efficiencyZeroGap` |
| Consistency zero | 20% variability | ratio | `SCORE_SETTINGS.consistencyZeroVariability` |
| Improvement full change | 3% | ratio | `SCORE_SETTINGS.improvementFullChange` |
| Improvement window | ≤ 10 finishes a side, ≥ 4 | count | `SCORE_SETTINGS.improvementWindow` |
| Provisional | < 8 finishes, < 10 times, < 5 segments, < 3 parts | count | `SCORE_SETTINGS.provisional` |
| Overall score | best 5 | count | `SCORE_SETTINGS.overallTop` |
| Simulations | 10,000, seed 20261009 | count | `PB_ODDS_SETTINGS` |
| Finish rate and attempt length | last 50 attempts | count | `PB_ODDS_SETTINGS.recentAttempts` |
| Finished runs the finish rate reaches back for | 5 | count | `PB_ODDS_SETTINGS.minRecentFinishes` |
| Kernel bandwidth | 0.3 × sd at the split | ratio | `PB_ODDS_SETTINGS.nearShare` |
| Reset search range | ± 20% of the PB split | ratio | `PB_ODDS_SETTINGS.searchShare` |
| Grind window | 28 days | human | `PB_ODDS_SETTINGS.grindWindowDays` |
| Finished-run samples | ≥ 5 | count | `FORM_MODEL_SETTINGS.minFinishedSamples` |
| Form coverage | ≥ 25% of segments | ratio | `FORM_MODEL_SETTINGS.formCoverage` |
| Trend share | 0.5, never a slowdown | ratio | `FORM_MODEL_SETTINGS.trendShare` |
| Attempts with a form for a trend | ≥ 5, else every attempt's form and no trend | count | `FORM_MODEL_SETTINGS.minFormAttempts` |
| Goal step | largest round step ≤ 1% of PB | ratio | `GOAL_STEP_SHARE` |
| Practice session | 60 min (30/90/120) | human | `PRACTICE_SETTINGS.sessionMinutes` |
| Practice block | 5 min | human | `PRACTICE_SETTINGS.blockMinutes` |
| Rep overhead | 20 s | human | `PRACTICE_SETTINGS.repOverheadMs` |
| In-context share | 25% | ratio | `PRACTICE_SETTINGS.fullRunShare` |
| Learning prior | 2% of typical per doubling, worth 30 times | ratio, count | `PRACTICE_SETTINGS` |
| Learning curve | ≥ 10 times, 8 groups | count | `PRACTICE_SETTINGS` |
| Session gap | 30 min | human | `SESSION_DEFAULTS.gapMinutes` |
| Timer left running | 3 × median finish (12 h fallback) | ratio (human fallback) | `SESSION_DEFAULTS` |
| Usual-time window | ≤ 51, half the history | count | `SESSION_INSIGHT_SETTINGS.paceWindow` |
| Pace cap | 2 × usual | ratio | `SESSION_INSIGHT_SETTINGS.paceCap` |
| Evidence | 8 sessions, 15 events | count | `SESSION_INSIGHT_SETTINGS` |
| Warm-up | 20 min | human | `SESSION_INSIGHT_SETTINGS.warmupMinutes` |
| Segment times each side (warm-up, fatigue pace) | ≥ 3 | count | `SESSION_INSIGHT_SETTINGS.minSegmentsPerSide` |
| Attempts each side (fatigue resets) | ≥ 3 | count | `SESSION_INSIGHT_SETTINGS.fatigueMinAttemptsPerSide` |
| Session reach | 90th percentile of session length | ratio | `SESSION_INSIGHT_SETTINGS.sessionReach` |
| Late and early resets | last third, first third of the route | ratio | `SESSION_INSIGHT_SETTINGS` |
| Near-PB | within 2% | ratio | `SESSION_INSIGHT_SETTINGS.nearPbFraction` |
| Smallest effect | 0.5% pace, 5 points of reset rate | ratio | `SESSION_INSIGHT_SETTINGS` |
| Confidence | 95%, 99% for searches | ratio | `SESSION_INSIGHT_SETTINGS` |
| Recap golds | ≥ 5 earlier times | count | `RECAP_SETTINGS.minGoldHistory` |
| Recap most improved | first and last 10 clean times in the year, ≥ 5 each | count | `RECAP_SETTINGS.improvementWindow`, `RECAP_SETTINGS.minImprovementSamples` |
| Live stats: reading LiveSplit | every 250 ms | human | `POLL_MS` in `packages/web/src/live/feeds.ts` |
| Live stats: demo speeds | real time, 2 min or 30 s per run | human | `DEMO_SPEEDS` in `packages/web/src/live/feeds.ts` |
| Live stats: demo reset point | half the usual time, ≥ 1 s (gold, then 2 s, when the usual time is missing) | ratio (human floor) | `replayAttempt` in `packages/core/src/live.ts` |

## Appendix B: Notation

| Symbol | Meaning |
| --- | --- |
| $n$ | number of segments |
| $a$ | attempt id (positive) |
| $H_i(a)$ | segment $i$'s recorded time in attempt $a$, or $\bot$ (skipped) |
| $A_i$ | attempts that reached segment $i$ |
| $C_i$, $R_i$ | clean times, recent clean times |
| $S_i$, $p_i$ | PB split time, PB segment time |
| $g_i$ | gold |
| $m_i$, $q^-_i$, $q^+_i$ | median, 25th and 75th percentile of recent times |
| $v_i$ | variability |
| $s_i$ | good-day save |
| $K$, $P_K$, $s_K$ | a skipped stretch of segments, its PB time and its good-day save (§2) |
| $\rho_i$, $\rho^{\mathrm{good}}_i$ | reset rate, good-run reset rate |
| $\lambda_i$, $H_i$ | reset hazard, hazard ratio |
| $\tau_i$ | recency-weighted typical time (form model) |
| $F_a$, $\varepsilon_{a,i}$ | attempt form, residual |
| $\Phi$, $\delta$ | sampled form, trend |
| $\hat p_{\text{fin}}$, $\phi$, $\hat p$ | chance if finished, finish rate, chance per attempt |
| $\mu_i$, $\Sigma_i$ | mistake rate, survival from split $i$ ($\Sigma_0$ from the start, including segment 1) |
| $c_i(x)$ | PB chance from split $i$ at time $x$ |
| $\bar L$, $\bar R_i$, $r_0$ | mean attempt length, mean remaining time, fresh PB rate |
| $q^\ast$ | goal plan pace |

## References

1. R. J. Hyndman and Y. Fan, "Sample quantiles in statistical packages", *The American Statistician* 50(4), 1996.
2. N. Otsu, "A threshold selection method from gray-level histograms", *IEEE Transactions on Systems, Man, and
   Cybernetics* 9(1), 1979.
3. K. M. Ashman, C. M. Bird and S. E. Zepf, "Detecting bimodality in astronomical datasets", *The Astronomical
   Journal* 108, 1994.
4. A. Wald and J. Wolfowitz, "On a test whether two samples are from the same population", *Annals of Mathematical
   Statistics* 11(2), 1940.
5. B. Efron and R. J. Tibshirani, *An Introduction to the Bootstrap*, Chapman & Hall, 1993.
6. E. A. Nadaraya, "On estimating regression", *Theory of Probability and its Applications* 9(1), 1964; G. S. Watson,
   "Smooth regression analysis", *Sankhyā A* 26, 1964.
7. J. D. Esary, F. Proschan and D. W. Walkup, "Association of random variables, with applications", *Annals of
   Mathematical Statistics* 38(5), 1967.
8. S. M. Ross, *Stochastic Processes*, 2nd ed., Wiley, 1996, chapter 3 (renewal-reward theorem).
9. E. L. Charnov, "Optimal foraging, the marginal value theorem", *Theoretical Population Biology* 9(2), 1976.
10. P. R. Milgrom, "Good news and bad news: representation theorems and applications", *The Bell Journal of Economics*
    12(2), 1981.
11. A. Newell and P. S. Rosenbloom, "Mechanisms of skill acquisition and the law of practice", in *Cognitive Skills
    and Their Acquisition*, 1981.
12. T. Ibaraki and N. Katoh, *Resource Allocation Problems: Algorithmic Approaches*, MIT Press, 1988.
13. B. L. Welch, "The generalization of 'Student's' problem when several different population variances are
    involved", *Biometrika* 34, 1947.
