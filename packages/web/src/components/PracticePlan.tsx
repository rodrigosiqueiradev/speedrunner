import { PRACTICE_SETTINGS, formatTime, planPractice, type Run, type RunAnalysis } from "@speedrunner/core";
import { useMemo, useState } from "react";
import { formatSave } from "../format";
import { PRACTICE_DOCS as D } from "../practice-explain";
import { TextButton, Toggle } from "./Controls";
import { InfoTip } from "./InfoTip";
import { MetricHeader } from "./Metric";
import { TableWrap } from "./Layout";

const SESSIONS = [30, 60, 90, 120].map((m) => ({ value: m, label: `${m} min` }));
const TOP = 10;
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
  const [showAll, setShowAll] = useState(false);
  const plan = useMemo(() => planPractice(run, analysis, { sessionMinutes: minutes }), [run, analysis, minutes]);

  const controls = (
    <div className="plan-controls">
      <span className="plan-controls-label">
        <span id="plan-length">Session length</span> <InfoTip doc={D.plan} />
      </span>
      <Toggle small labelledBy="plan-length" options={SESSIONS} value={minutes} onChange={setMinutes} />
    </div>
  );

  if (plan.items.length === 0 && !plan.fullRuns && !plan.stretch) {
    if (plan.shortestRep == null) {
      return (
        <p className="empty-note">
          No plan yet. Segments need at least a handful of clean times before their practice value can be estimated.
        </p>
      );
    }
    return (
      <>
        {controls}
        <p className="empty-note">
          Your segments take longer than {minutes} minutes: the quickest takes about {formatTime(plan.shortestRep, 0)} to
          play once, reload included. Pick a longer session, or practise part of a segment.
        </p>
      </>
    );
  }

  const longest = Math.max(...plan.items.map((i) => i.minutes), plan.fullRuns?.minutes ?? 0, plan.stretch?.minutes ?? 0);
  const runTime = plan.fullRuns?.runTime;

  return (
    <>
      {controls}

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
        {plan.stretch && (
          <li className="plan-row full-runs">
            <span className="plan-minutes">{plan.stretch.minutes} min</span>
            <span className="plan-what">
              <span className="plan-name">
                <button className="link-button" onClick={() => onSelect(plan.stretch!.from)}>
                  {plan.stretch.fromName}
                </button>{" "}
                to{" "}
                <button className="link-button" onClick={() => onSelect(plan.stretch!.to)}>
                  {plan.stretch.toName}
                </button>
              </span>
              <span className="plan-detail">
                in one go, {plan.stretch.runs} {plan.stretch.runs === 1 ? "time" : "times"} at about {formatTime(plan.stretch.runTime)}
              </span>
            </span>
            <span className="plan-bar" aria-hidden>
              <span style={{ width: `${(plan.stretch.minutes / longest) * 100}%` }} />
            </span>
            <span className="plan-save" />
          </li>
        )}
      </ol>
      <p className="section-foot plan-total">
        If this practice pays off the way your past attempts suggest, it takes about{" "}
        <b>{formatSave(plan.expectedSave)}</b> off a typical run. <InfoTip doc={D.expected} />
        {!plan.fullRuns && plan.stretch && " A full run doesn't fit in this session, so part of it plays a stretch of the route in one go."}
        {!plan.fullRuns && !plan.stretch && " A full run doesn't fit in this session, so it's all segment practice."}
        {plan.spareMinutes > 0 &&
          ` ${plan.spareMinutes} ${plan.spareMinutes === 1 ? "minute is" : "minutes are"} left over, too short for another rep of any segment.`}
        {plan.segmentsWithoutData > 0 &&
          ` ${plan.segmentsWithoutData} ${plan.segmentsWithoutData === 1 ? "segment has" : "segments have"} too few clean times to plan for.`}
      </p>

      <h3 className="plan-subhead" id="roi-title">
        Time saved per hour of practice
      </h3>
      <TableWrap>
        <table className="roi" aria-labelledby="roi-title">
          <thead>
            <tr>
              <th scope="col">Segment</th>
              {[D.perHour, D.gap, D.rep, D.learning].map((doc) => (
                <MetricHeader key={doc.id} doc={doc} />
              ))}
            </tr>
          </thead>
          <tbody>
            {(showAll ? plan.ranking : plan.ranking.slice(0, TOP)).map((r) => (
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
      </TableWrap>
      {plan.ranking.length > TOP && (
        <p className="section-foot">
          <TextButton aria-expanded={showAll} onClick={() => setShowAll((v) => !v)}>
            {showAll ? `Show the top ${TOP}` : `Show all ${plan.ranking.length} segments`}
          </TextButton>
        </p>
      )}
    </>
  );
}
