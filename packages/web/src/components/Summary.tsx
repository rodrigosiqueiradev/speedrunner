import { formatTime, type RunAnalysis } from "@speedrunner/core";
import { METRICS, type MetricDoc } from "../explain";
import { formatSave } from "../format";
import { InfoTip } from "./InfoTip";

export function Summary({ analysis: a }: { analysis: RunAnalysis }) {
  const realisticSave =
    a.personalBest != null && a.realisticTarget != null ? a.personalBest - a.realisticTarget : null;
  return (
    <div className="summary">
      <div className="hero">
        <div className="hero-label">
          Realistic target <InfoTip doc={METRICS.realisticTarget} />
        </div>
        <div className="hero-value">{formatTime(a.realisticTarget)}</div>
        <div className="hero-note">
          {realisticSave != null
            ? realisticSave > 0
              ? `${formatSave(realisticSave)} faster than your PB if each segment goes like a good attempt`
              : "Your PB already matches your good-day pace everywhere"
            : `Needs more attempts per segment`}
        </div>
        <TimeScale analysis={a} />
      </div>
      <div className="tiles">
        <Tile doc={METRICS.personalBest} value={formatTime(a.personalBest)} />
        <Tile
          doc={METRICS.sumOfBest}
          value={formatTime(a.sumOfBest)}
          note={a.possibleTimeSave != null ? `${formatSave(a.possibleTimeSave)} under PB` : undefined}
        />
        <Tile
          doc={METRICS.attempts}
          value={a.attemptCount.toLocaleString()}
          note={`${a.finishedAttempts.toLocaleString()} finished`}
        />
      </div>
    </div>
  );
}

function Tile({ doc, value, note }: { doc: MetricDoc; value: string; note?: string }) {
  return (
    <div className="tile">
      <div className="tile-label">
        {doc.label} <InfoTip doc={doc} />
      </div>
      <div className="tile-value">{value}</div>
      {note && <div className="tile-note">{note}</div>}
    </div>
  );
}

/** Places sum of best, realistic target and PB on one line so the gaps are visible. */
function TimeScale({ analysis: a }: { analysis: RunAnalysis }) {
  if (a.personalBest == null || a.sumOfBest == null || a.realisticTarget == null) return null;
  const span = a.personalBest - a.sumOfBest;
  if (span <= 0) return null;
  const at = (t: number) => `${((t - a.sumOfBest!) / span) * 100}%`;
  return (
    <div className="scale" aria-hidden>
      <div className="scale-track">
        <span className="scale-fill" style={{ left: at(a.realisticTarget), right: 0 }} />
        <span className="scale-mark" style={{ left: at(a.sumOfBest) }} />
        <span className="scale-mark target" style={{ left: at(a.realisticTarget) }} />
        <span className="scale-mark" style={{ left: at(a.personalBest) }} />
      </div>
      <div className="scale-labels">
        <span>Sum of best {formatTime(a.sumOfBest)}</span>
        <span>PB {formatTime(a.personalBest)}</span>
      </div>
    </div>
  );
}
