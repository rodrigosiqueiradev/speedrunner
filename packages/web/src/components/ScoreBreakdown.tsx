import { COMPONENT_KEYS, SCORE_SETTINGS, weakestComponent, type CategoryScore, type ComponentKey } from "@speedrunner/core";
import { SCORE_METRICS } from "../explain";
import { formatScore } from "../format";
import { MetricLabel } from "./Metric";

const pct1 = (x: number) => `${(x * 100).toFixed(1)}%`;

/** One line under each part saying what it was worked out from. */
function partNote(s: CategoryScore, k: ComponentKey): string {
  switch (k) {
    case "efficiency":
      return s.efficiency.gap == null ? "Needs a PB and a sum of best" : `PB ${pct1(s.efficiency.gap)} over sum of best`;
    case "consistency":
      return s.consistency.variability == null
        ? "Needs more attempts per segment"
        : `${pct1(s.consistency.variability)} variability`;
    case "completion":
      return s.completion.rate == null
        ? "Needs attempt history"
        : `${s.completion.finished} of ${s.completion.goodRuns} good runs from halfway finished`;
    case "improvement":
      return s.improvement.change == null
        ? `Needs ${SCORE_SETTINGS.minImprovementWindow * 2} finished runs`
        : `Last ${s.improvement.window} finishes ${pct1(Math.abs(s.improvement.change))} ${s.improvement.change >= 0 ? "faster" : "slower"}`;
  }
}

/** Plain reasons a score is provisional, for the note under it. */
export function provisionalNote(s: CategoryScore): string {
  const P = SCORE_SETTINGS.provisional;
  const parts = Object.values(s.weights).filter((w) => w > 0).length;
  const reasons = s.provisionalReasons.map((r) =>
    r === "few-finished"
      ? `${s.finishedAttempts} of ${P.minFinished} finished runs`
      : r === "few-segments"
        ? `${s.segmentCount} of ${P.minSegments} segments`
        : r === "few-samples"
          ? `${s.segmentSamples ?? 0} of ${P.minSegmentSamples} clean times a segment`
          : `${parts} of ${P.minComponents} parts`,
  );
  return `Provisional: ${reasons.join(", ")}`;
}

/** The category score, laid out like the comparisons panel: the score on the left, its four parts beside it. */
export function ScoreBreakdown({ score: s }: { score: CategoryScore }) {
  const weakest = weakestComponent(s);
  return (
    <div className="score-panel">
      <div className="score-main">
        <MetricLabel doc={SCORE_METRICS.category} />
        <span className="score-value">
          {formatScore(s.score)}
          <small>/100</small>
        </span>
        <span className="comparison-note">
          {s.provisional ? provisionalNote(s) : weakest ? `Biggest drag: ${SCORE_METRICS[weakest].label.toLowerCase()}` : ""}
        </span>
      </div>
      <dl className="score-parts">
        {COMPONENT_KEYS.map((k) => (
          <div key={k} className={`score-part${s[k].score == null ? " missing" : ""}`}>
            <dt>
              <MetricLabel doc={SCORE_METRICS[k]} />
              <span className="score-weight">{s.weights[k] ? `${Math.round(s.weights[k] * 100)}%` : ""}</span>
            </dt>
            <dd className="score-part-value">{formatScore(s[k].score)}</dd>
            <dd className="score-part-note">{partNote(s, k)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
