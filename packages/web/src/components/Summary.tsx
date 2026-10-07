import { formatTime, type RunAnalysis } from "@speedrunner/core";
import { formatSave } from "../format";

export function Summary({ analysis: a }: { analysis: RunAnalysis }) {
  const realisticSave =
    a.personalBest != null && a.realisticTarget != null ? a.personalBest - a.realisticTarget : null;
  return (
    <div className="tiles">
      <Tile label="Personal best" value={formatTime(a.personalBest)} />
      <Tile
        label="Realistic target"
        value={formatTime(a.realisticTarget)}
        note={realisticSave != null ? `${formatSave(realisticSave)} faster with good-day segments` : "Needs more attempts"}
      />
      <Tile
        label="Sum of best"
        value={formatTime(a.sumOfBest)}
        note={a.possibleTimeSave != null ? `${formatSave(a.possibleTimeSave)} theoretical save` : undefined}
      />
      <Tile
        label="Attempts"
        value={a.attemptCount.toLocaleString()}
        note={`${a.finishedAttempts.toLocaleString()} finished`}
      />
    </div>
  );
}

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="tile">
      <div className="tile-label">{label}</div>
      <div className="tile-value">{value}</div>
      {note && <div className="tile-note">{note}</div>}
    </div>
  );
}
