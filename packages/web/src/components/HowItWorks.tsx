import type { CategoryScore, PbOdds, RunAnalysis } from "@speedrunner/core";
import { ChevronIcon } from "./Icons";
import { ADVICE_RULES, CLEAN_TIME, METRICS, SCORE_METRICS, type MetricDoc, type ScoreDoc } from "../explain";
import { localPlace } from "../platform";
import { PB_ODDS_METRICS } from "../pbExplain";
import { PRACTICE_ENTRIES } from "../practice-explain";
import { GOAL_ENTRIES } from "../goal-explain";
import { SESSION_ENTRIES } from "../session-explain";

const SUMMARY = ["personalBest", "realisticTarget", "sumOfBest", "attempts"];
const SEGMENT = ["pbTime", "gold", "median", "timeSaveVsGold", "realisticTimeSave", "variability", "resetRate"];

export function HowItWorks({
  analysis,
  score,
  odds,
}: {
  analysis: RunAnalysis;
  score: CategoryScore;
  odds?: PbOdds | null;
}) {
  return (
    <section id="how-it-works" className="how" aria-labelledby="how-title">
      <h2 id="how-title">How it's calculated</h2>
      <p className="section-note">
        Everything is worked out from your split file {localPlace}. Examples use the run you loaded.
      </p>

      <h3>Run totals</h3>
      {SUMMARY.map((k) => <Entry key={k} doc={METRICS[k]} example={METRICS[k].example?.(analysis)} />)}

      <h3>Per segment</h3>
      <Entry doc={CLEAN_TIME} />
      {SEGMENT.map((k) => <Entry key={k} doc={METRICS[k]} example={METRICS[k].example?.(analysis)} />)}

      <h3>Practice advice</h3>
      <details id="how-advice" className="how-entry">
        <summary>
          <ChevronIcon />
          <span className="how-label">Advice rules</span>
          <span className="how-short">When each kind of advice appears and how it's ranked.</span>
        </summary>
        <div className="how-body">
          <p>
            Every segment is checked against four rules. Advice is ranked by the time it is estimated to be worth,
            biggest first.
          </p>
          <div className="table-wrap">
            <table className="rules">
              <thead>
                <tr>
                  <th>Advice</th>
                  <th>Shown when</th>
                  <th>Estimated worth</th>
                </tr>
              </thead>
              <tbody>
                {ADVICE_RULES.map((r) => (
                  <tr key={r.tag}>
                    <td>{r.tag}</td>
                    <td>{r.when}</td>
                    <td>{r.worth}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </details>

      {odds && (
        <>
          <h3>PB odds</h3>
          {Object.values(PB_ODDS_METRICS).map((doc) => (
            <Entry key={doc.id} doc={doc} example={doc.example?.(odds)} />
          ))}
        </>
      )}

      <h3>Practice plan</h3>
      {PRACTICE_ENTRIES.map((doc) => <Entry key={doc.id} doc={doc} />)}

      <h3>Goal planner and LiveSplit comparisons</h3>
      {GOAL_ENTRIES.map((doc) => <Entry key={doc.id} doc={doc} />)}

      <h3>Session insights</h3>
      {SESSION_ENTRIES.map((doc) => <Entry key={doc.id} doc={doc} />)}

      <h3>Category score</h3>
      <ScoreEntries score={score} />
    </section>
  );
}

const SCORE_ENTRIES = ["category", "efficiency", "consistency", "completion", "improvement", "provisional", "overall", "pace"] as const;

/** Explanations for the category score and its parts, with examples from the given score. */
export function ScoreEntries({ score }: { score: CategoryScore | null }) {
  return (
    <>
      {SCORE_ENTRIES.map((k) => (
        <Entry key={k} doc={SCORE_METRICS[k]} example={score ? SCORE_METRICS[k].example?.(score) : null} />
      ))}
    </>
  );
}

/** One explanation, collapsed to its label and short description until opened. */
export function Entry({ doc, example }: { doc: Pick<MetricDoc, "id" | "label" | "short" | "how">; example?: string | null }) {
  return (
    <details id={`how-${doc.id}`} className="how-entry">
      <summary>
        <ChevronIcon />
        <span className="how-label">{doc.label}</span>
        <span className="how-short">{doc.short}</span>
      </summary>
      <div className="how-body">
        {doc.how.length > 1 ? (
          <ul>
            {doc.how.map((line) => <li key={line}>{line}</li>)}
          </ul>
        ) : (
          <p>{doc.how[0]}</p>
        )}
        {example && (
          <p className="how-example">
            <span>Your run:</span> {example}
          </p>
        )}
      </div>
    </details>
  );
}
