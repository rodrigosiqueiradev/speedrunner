import {
  addComparisons,
  analyzeRun,
  COMPARISON_NAMES,
  formatTime,
  parseLss,
  planGoal,
  realisticTargetSplits,
  recentGoldSplits,
  suggestGoal,
  ANALYSIS_DEFAULTS,
  type ComparisonToWrite,
  type GoalPlan,
  type Run,
  type RunAnalysis,
  type TimingMethod,
} from "@speedrunner/core";
import { useMemo, useState } from "react";
import { copyName, saveTextFile } from "../download";
import { formatSave, parseTypedTime } from "../format";
import { METRICS, type MetricDoc } from "../explain";
import { GOAL_DOCS } from "../goal-explain";
import { isDesktop } from "../platform";
import { InfoTip } from "./InfoTip";

interface Props {
  run: Run;
  analysis: RunAnalysis;
  xml: string;
  fileName: string;
}

/** "What does sub-X take?" plus saving a copy of the splits with comparisons for LiveSplit. */
export function GoalPlanner({ run, analysis, xml, fileName }: Props) {
  const pb = analysis.personalBest;
  const [typed, setTyped] = useState(() => (pb != null ? formatTime(suggestGoal(pb), 0) : ""));
  const goal = parseTypedTime(typed);
  const plan = useMemo(() => (goal != null ? planGoal(run, goal, {}, analysis) : null), [run, analysis, goal]);

  return (
    <>
      <section className="block" aria-labelledby="goal-title">
        <div className="block-head">
          <h2 id="goal-title" className="title-with-tip">
            What does your goal take? <InfoTip doc={GOAL_DOCS.plan} />
          </h2>
          <p className="section-note">Pick a goal time to see where the time would come from.</p>
        </div>
        <div className="goal">
          <form className="reference-form" onSubmit={(e) => e.preventDefault()}>
            <label htmlFor="goal-time">Goal: sub</label>
            <input
              id="goal-time"
              value={typed}
              inputMode="decimal"
              placeholder="1:00:00"
              aria-invalid={typed.trim() !== "" && goal == null}
              aria-describedby="goal-help"
              onChange={(e) => setTyped(e.target.value)}
            />
            <span id="goal-help" className="goal-help">
              Type a time like 59:30 or 1:00:00.
            </span>
          </form>
          {plan && <PlanSummary plan={plan} />}
        </div>
        {plan && plan.status !== "out-of-reach" && plan.segments.some((s) => s.cut > 0) && <PlanTable plan={plan} />}
      </section>

      <ExportComparisons run={run} analysis={analysis} xml={xml} fileName={fileName} plan={plan} />
    </>
  );
}

function PlanSummary({ plan }: { plan: GoalPlan }) {
  const goal = formatTime(plan.goal, plan.goal % 1000 === 0 ? 0 : 2);
  const cuts = plan.segments.filter((s) => s.cut > 0).sort((a, b) => b.cut - a.cut);
  const named = cuts.slice(0, 3).map((s) => `${formatSave(s.cut)} from ${s.name}`);
  const rest = cuts.slice(named.length);
  const restCut = rest.reduce((sum, s) => sum + s.cut, 0);
  const where = joinAnd(rest.length ? [...named, `${formatSave(restCut)} from ${rest.length} more segment${rest.length > 1 ? "s" : ""}`] : named);

  switch (plan.status) {
    case "no-data":
      return (
        <p className="goal-text">
          Planning needs a PB with every split, and at least {ANALYSIS_DEFAULTS.minSamples} clean times in a segment.
        </p>
      );
    case "already":
      return (
        <p className="goal-text">
          Your PB of <b>{formatTime(plan.personalBest)}</b> already beats sub {goal}. Try a faster goal.
        </p>
      );
    case "out-of-reach":
      return (
        <p className="goal-text">
          Sub {goal} is <b>{formatSave(plan.shortfall)}</b> faster than every segment at its gold. It needs new golds
          first, so pick a slower goal for now.
        </p>
      );
    case "needs-golds":
      return (
        <p className="goal-text">
          Sub {goal} needs <b>{formatSave(plan.timeToCut)}</b>: {where}. That's faster than your best recent time in
          those segments, so it means matching golds you set before your last {ANALYSIS_DEFAULTS.recentWindow} attempts.
        </p>
      );
    case "reachable": {
      const pace = plan.pace!;
      return (
        <>
          <p className="goal-text">
            Sub {goal} needs <b>{formatSave(plan.timeToCut)}</b>: {where}.
          </p>
          <p className="goal-text">
            Each of those segments has to come in at a time you hit in {share(pace)} recent attempts.{" "}
            <InfoTip doc={GOAL_DOCS.pace} />{" "}
            {pace >= ANALYSIS_DEFAULTS.goodDayPercentile
              ? "That's no harder than your realistic target, so a good day already gets there."
              : `To make it a good-day goal, you'd need to hit those times about ${ratio(ANALYSIS_DEFAULTS.goodDayPercentile / pace)} as often as you do now.`}
          </p>
        </>
      );
    }
  }
}

function PlanTable({ plan }: { plan: GoalPlan }) {
  return (
    <div className="table-wrap goal-table">
      <table>
        <thead>
          <tr>
            <th scope="col">Segment</th>
            <th scope="col">PB</th>
            <th scope="col">Plan</th>
            <th scope="col">Cut</th>
            <th scope="col">Recently at or under plan</th>
          </tr>
        </thead>
        <tbody>
          {plan.segments
            .filter((s) => s.cut > 0)
            .map((s) => (
              <tr key={s.index}>
                <th scope="row">
                  {s.name}
                  <span className="flag muted">{s.kind === "consistency" ? "a typical attempt" : "better than usual"}</span>
                </th>
                <td>{formatTime(s.pbTime)}</td>
                <td>{formatTime(s.target)}</td>
                <td>{formatSave(s.cut)}</td>
                <td>
                  {s.hitRate == null ? "-" : `${Math.round(s.hitRate * s.samples)} of ${s.samples}`}
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

type ComparisonKey = "realistic" | "balanced" | "recentGolds";

function ExportComparisons({ run, analysis, xml, fileName, plan }: Props & { plan: GoalPlan | null }) {
  const [chosen, setChosen] = useState<Record<ComparisonKey, boolean>>({ realistic: true, balanced: true, recentGolds: true });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const balancedOk = plan != null && (plan.status === "reachable" || plan.status === "needs-golds");
  const recentGolds = useMemo(() => recentGoldSplits(run), [run]);
  const options: Array<{ key: ComparisonKey; label: string; time: number | null; note: string; doc: MetricDoc }> = [
    {
      key: "realistic",
      label: COMPARISON_NAMES.realisticTarget,
      time: analysis.realisticTarget,
      note: "Every segment at your good-day pace",
      doc: METRICS.realisticTarget,
    },
    {
      key: "balanced",
      label: balancedOk ? COMPARISON_NAMES.balanced(plan.goal) : "Sub goal (balanced)",
      time: balancedOk ? plan.plannedTime : null,
      note: balancedOk ? "The goal plan above" : "Pick a goal you can reach above to add this",
      doc: GOAL_DOCS.balanced,
    },
    {
      key: "recentGolds",
      label: COMPARISON_NAMES.recentGolds,
      time: recentGolds.at(-1) ?? null,
      note: "Your best recent time in every segment",
      doc: GOAL_DOCS.recentGolds,
    },
  ];
  const available = options.filter((o) => o.time != null);
  const picked = available.filter((o) => chosen[o.key]);

  const save = () => {
    setError(null);
    setSaved(null);
    try {
      const comparisons: ComparisonToWrite[] = [];
      // Realistic target and recent golds go in for every timing method the file has times for;
      // the goal plan only for the one it was worked out in.
      const perMethod = (["RealTime", "GameTime"] as TimingMethod[]).map((m) => {
        const r = m === run.timingMethod ? run : parseLss(xml, { timingMethod: m });
        const a = m === run.timingMethod ? analysis : analyzeRun(r);
        return { m, realistic: realisticTargetSplits(a), recent: recentGoldSplits(r) };
      });
      const collect = (pick: (p: (typeof perMethod)[number]) => Array<number | null> | null) => {
        const splits: ComparisonToWrite["splits"] = {};
        for (const p of perMethod) {
          const s = pick(p);
          if (s && s.at(-1) != null) splits[p.m] = s;
        }
        return splits;
      };
      if (chosen.realistic && analysis.realisticTarget != null) {
        comparisons.push({ name: COMPARISON_NAMES.realisticTarget, splits: collect((p) => p.realistic) });
      }
      if (chosen.balanced && balancedOk) {
        comparisons.push({ name: COMPARISON_NAMES.balanced(plan.goal), splits: { [run.timingMethod]: plan.splits } });
      }
      if (chosen.recentGolds && recentGolds.at(-1) != null) {
        comparisons.push({ name: COMPARISON_NAMES.recentGolds, splits: collect((p) => p.recent) });
      }
      const name = copyName(fileName, "with comparisons");
      saveTextFile(name, addComparisons(xml, comparisons));
      setSaved(name);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The copy couldn't be written.");
    }
  };

  return (
    <section className="block" aria-labelledby="export-title">
      <div className="block-head">
        <h2 id="export-title" className="title-with-tip">
          Race these in LiveSplit <InfoTip doc={GOAL_DOCS.copy} />
        </h2>
        <p className="section-note">Save a copy of your splits with these as comparisons. Your original file isn't changed.</p>
      </div>
      <fieldset className="export-options">
        <legend className="visually-hidden">Comparisons to add</legend>
        {options.map((o) => (
          <div key={o.key} className={`export-option${o.time == null ? " disabled" : ""}`}>
            <input
              id={`export-${o.key}`}
              type="checkbox"
              checked={o.time != null && chosen[o.key]}
              disabled={o.time == null}
              aria-describedby={`export-${o.key}-note`}
              onChange={(e) => setChosen((c) => ({ ...c, [o.key]: e.target.checked }))}
            />
            <span className="export-text">
              <span className="comparison-label">
                <label htmlFor={`export-${o.key}`} className="export-label">
                  {o.label}
                </label>{" "}
                <InfoTip doc={o.doc} />
              </span>
              <span id={`export-${o.key}-note`} className="comparison-note">
                {o.note}
              </span>
            </span>
            <span className="export-time">{formatTime(o.time)}</span>
          </div>
        ))}
      </fieldset>
      <p className="section-foot profile-action">
        <button className="primary" onClick={save} disabled={picked.length === 0}>
          Save a copy with {picked.length === 1 ? "this comparison" : "these comparisons"}
        </button>
        <span role="status">{saved && `Saved ${saved}${isDesktop ? " to your Downloads folder" : ""}.`}</span>
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

/** "62% of your", "about 1 in 7 of your". */
function share(p: number): string {
  return p >= 0.5 ? `${Math.round(p * 100)}% of your` : `about 1 in ${Math.round(1 / p)} of your`;
}

function ratio(x: number): string {
  return `${x < 10 ? x.toFixed(1) : Math.round(x)} times`;
}

function joinAnd(items: string[]): string {
  return items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}
