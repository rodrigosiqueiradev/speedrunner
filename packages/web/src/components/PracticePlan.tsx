import { PRACTICE_SETTINGS, formatTime, planPractice, type Run, type RunAnalysis } from "@speedrunner/core";
import { useMemo, useState } from "react";
import { formatSave } from "../format";
import { PRACTICE_DOCS as D } from "../practice-explain";
import { InfoTip } from "./InfoTip";

const SESSIONS = [30, 60, 90, 120];
const P = PRACTICE_SETTINGS;

/** A practice session plan, and the per-segment ranking it is built from. */
export function PracticePlan({
  run,
  analysis,
  onSelect,
}: {
  run: Run;
  analysis: RunAnalysis;
  onSelect: (index: number) => void;
}) {
  const [minutes, setMinutes] = useState<number>(P.sessionMinutes);
  const plan = useMemo(() => planPractice(run, analysis, { sessionMinutes: minutes }), [run, analysis, minutes]);

  if (plan.items.length === 0) {
    return (
      <p className="empty-note">
        No plan yet. Segments need at least a handful of clean times before their practice value can be estimated.
      </p>
    );
  }

  const longest = Math.max(...plan.items.map((i) => i.minutes), plan.fullRuns?.minutes ?? 0);
  const runTime = plan.fullRuns?.runTime;

  return (
    <>
      <div className="plan-controls">
        <span className="plan-controls-label">
          <span id="plan-length">Session length</span> <InfoTip doc={D.plan} />
        </span>
        <div className="toggle small" role="group" aria-labelledby="plan-length">
          {SESSIONS.map((m) => (
            <button key={m} aria-pressed={minutes === m} onClick={() => setMinutes(m)}>
              {m} min
            </button>
          ))}
        </div>
      </div>

      <ol className="plan" aria-label={`${minutes} minute practice plan`}>
        {plan.items.map((i) => (
          <li key={i.segmentIndex} className="plan-row">
            <span className="plan-minutes">{i.minutes} min</span>
            <span className="plan-what">
              <button className="link-button plan-name" onClick={() => onSelect(i.segmentIndex)}>
                {i.name}
              </button>
              <span className="plan-detail">
                about {i.reps} {i.reps === 1 ? "rep" : "reps"}
              </span>
            </span>
            <span className="plan-bar" aria-hidden>
              <span style={{ width: `${(i.minutes / longest) * 100}%` }} />
            </span>
            <span className="plan-save" title="Expected time off a typical run">
              ~{formatSave(i.expectedSave)}
            </span>
          </li>
        ))}
        {plan.fullRuns && (
          <li className="plan-row full-runs">
            <span className="plan-minutes">{plan.fullRuns.minutes} min</span>
            <span className="plan-what">
              <span className="plan-name">Full runs</span>
              <span className="plan-detail">
                {plan.fullRuns.runs} {plan.fullRuns.runs === 1 ? "run" : "runs"} of about {formatTime(runTime!)}
              </span>
            </span>
            <span className="plan-bar" aria-hidden>
              <span style={{ width: `${(plan.fullRuns.minutes / longest) * 100}%` }} />
            </span>
            <span className="plan-save" />
          </li>
        )}
      </ol>
      <p className="section-foot plan-total">
        If this practice pays off the way your past attempts suggest, it takes about{" "}
        <b>{formatSave(plan.expectedSave)}</b> off a typical run. <InfoTip doc={D.expected} />
        {!plan.fullRuns && " A full run doesn't fit in this session, so it's all segment practice."}
        {plan.segmentsWithoutData > 0 &&
          ` ${plan.segmentsWithoutData} ${plan.segmentsWithoutData === 1 ? "segment has" : "segments have"} too few clean times to plan for.`}
      </p>

      <h3 className="plan-subhead" id="roi-title">
        Time saved per hour of practice
      </h3>
      <div className="table-wrap">
        <table className="roi" aria-labelledby="roi-title">
          <thead>
            <tr>
              <th scope="col">Segment</th>
              {[D.perHour, D.gap, D.rep, D.learning].map((doc) => (
                <th key={doc.id} scope="col">
                  <span className="th-inner">
                    {doc.label} <InfoTip doc={doc} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {plan.ranking.map((r) => (
              <tr key={r.index}>
                <th scope="row">
                  <button className="link-button" onClick={() => onSelect(r.index)}>
                    {r.name}
                  </button>
                </th>
                <td className="roi-main">{formatSave(r.savePerHour)}</td>
                <td>{formatSave(r.gap)}</td>
                <td>{formatTime(r.repTime)}</td>
                <td>
                  {formatSave(r.perDoubling)}
                  {r.ownCurveWeight < 0.5 && (
                    <span className="flag muted" title="Mostly the assumed learning rate: this segment has little history">
                      assumed
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </>
  );
}
