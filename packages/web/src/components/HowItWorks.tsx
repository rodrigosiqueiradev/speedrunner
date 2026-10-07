import type { RunAnalysis } from "@speedrunner/core";
import { ADVICE_RULES, CLEAN_TIME, METRICS, type MetricDoc } from "../explain";

const SUMMARY = ["personalBest", "realisticTarget", "sumOfBest", "attempts"];
const SEGMENT = ["pbTime", "gold", "median", "timeSaveVsGold", "realisticTimeSave", "variability", "resetRate"];

export function HowItWorks({ analysis }: { analysis: RunAnalysis }) {
  return (
    <section id="how-it-works" className="how" aria-labelledby="how-title">
      <h3 id="how-title">How it's calculated</h3>
      <p className="section-note">
        Everything is worked out from your split file in your browser. Examples use the run you loaded.
      </p>

      <h4>Run totals</h4>
      {SUMMARY.map((k) => <Entry key={k} doc={METRICS[k]} analysis={analysis} />)}

      <h4>Per segment</h4>
      <Entry doc={CLEAN_TIME} analysis={analysis} />
      {SEGMENT.map((k) => <Entry key={k} doc={METRICS[k]} analysis={analysis} />)}

      <h4>Practice advice</h4>
      <details id="how-advice" className="how-entry">
        <summary>When each kind of advice appears</summary>
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
    </section>
  );
}

function Entry({ doc, analysis }: { doc: MetricDoc; analysis: RunAnalysis }) {
  const example = doc.example?.(analysis);
  return (
    <details id={`how-${doc.id}`} className="how-entry">
      <summary>
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
